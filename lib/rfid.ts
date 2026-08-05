import "server-only"

import { and, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { products, rfidScans, warehouses } from "@/db/schema"

const requiredText = z.string().trim().min(1)

const parseFlutterDate = (value: string) => new Date(value.includes("T") ? value : value.replace(" ", "T"))

const linkedSchema = z.preprocess((value) => {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase()
        if (normalized === "true") return true
        if (normalized === "false") return false
    }
    return value
}, z.boolean())

export const rfidScanPayloadSchema = z.object({
    material: z.object({
        plnt: requiredText,
        category: requiredText,
        material: requiredText,
        description: requiredText,
        sloc: requiredText,
        slocDescription: requiredText,
        actStock: z.coerce.number().int(),
    }),
    items: z.array(z.object({
        sn: requiredText,
        epc: requiredText,
        rssi: z.coerce.string().trim().min(1),
        linked: linkedSchema,
        scanType: z.string().optional(),
        status: z.string().optional(),
    })).min(1),
    createdBy: requiredText,
    createdAt: z.string().trim().min(1)
        .refine((value) => !Number.isNaN(parseFlutterDate(value).getTime()), "Invalid createdAt")
        .transform(parseFlutterDate),
    scanType: z.string().optional(),
    status: z.string().optional(),
})

export type RfidScanPayload = z.input<typeof rfidScanPayloadSchema>

export function parseRfidScanPayload(payload: unknown) {
    return rfidScanPayloadSchema.parse(payload)
}

export function formatRfidStatus(scanType?: string | null): "Masuk" | "Keluar" {
    if (!scanType) return "Masuk"
    const normalized = scanType.trim().toLowerCase()
    if (normalized === "keluar" || normalized === "outbound") {
        return "Keluar"
    }
    return "Masuk"
}

export async function getRfidScanRows(limit = 500, statusFilter?: string) {
    const rawRows = await db.query.rfidScans.findMany({
        orderBy: [desc(rfidScans.scannedAt), desc(rfidScans.id)],
        limit,
    })

    const formattedRows = rawRows.map((row) => ({
        ...row,
        status: formatRfidStatus(row.scanType),
    }))

    if (!statusFilter || statusFilter.toLowerCase() === "all") {
        return formattedRows
    }

    const normFilter = statusFilter.trim().toLowerCase()
    if (normFilter === "masuk" || normFilter === "inbound") {
        return formattedRows.filter((r) => r.status === "Masuk")
    }
    if (normFilter === "keluar" || normFilter === "outbound") {
        return formattedRows.filter((r) => r.status === "Keluar")
    }

    return formattedRows
}

export async function getAvailableKeluarRfidScans(query?: { materialNumber?: string; materialDescription?: string } | string) {
    const matNum = typeof query === "string" ? query : query?.materialNumber
    const matDesc = typeof query === "object" ? query?.materialDescription : undefined

    const allRows = await db.query.rfidScans.findMany({
        orderBy: [desc(rfidScans.scannedAt), desc(rfidScans.id)],
    })

    const filtered = allRows.filter((row) => {
        const isKeluar = formatRfidStatus(row.scanType) === "Keluar"
        const isDoEmpty = !row.doNumber || row.doNumber.trim() === ""
        
        let isMatch = true
        if (matNum || matDesc) {
            const matNumMatch = Boolean(matNum && row.materialNumber && row.materialNumber.trim().toLowerCase() === matNum.trim().toLowerCase())
            const matDescMatch = Boolean(matDesc && row.materialDescription && (
                row.materialDescription.trim().toLowerCase().includes(matDesc.trim().toLowerCase()) ||
                matDesc.trim().toLowerCase().includes(row.materialDescription.trim().toLowerCase())
            ))
            isMatch = matNumMatch || matDescMatch
        }
        
        return isKeluar && isDoEmpty && isMatch
    })

    // If query was provided but no exact match found, fallback to returning all unlinked Keluar items
    if (filtered.length === 0 && (matNum || matDesc)) {
        return allRows.filter((row) => {
            const isKeluar = formatRfidStatus(row.scanType) === "Keluar"
            const isDoEmpty = !row.doNumber || row.doNumber.trim() === ""
            return isKeluar && isDoEmpty
        })
    }

    return filtered
}

export async function linkRfidScansToDelivery(doNumber: string, serialNumbers: string[]) {
    if (!doNumber || !serialNumbers || serialNumbers.length === 0) {
        return []
    }

    const cleanSerials = serialNumbers
        .map((s) => s?.trim())
        .filter((s): s is string => Boolean(s))

    if (cleanSerials.length === 0) {
        return []
    }

    const upperSerials = cleanSerials.map((s) => s.toUpperCase())

    const matchingRows = await db.query.rfidScans.findMany()
    const targetIds = matchingRows
        .filter((row) => {
            const snMatch = row.serialNumber && upperSerials.includes(row.serialNumber.trim().toUpperCase())
            const epcMatch = row.epc && upperSerials.includes(row.epc.trim().toUpperCase())
            return snMatch || epcMatch
        })
        .map((row) => row.id)

    if (targetIds.length === 0) {
        return []
    }

    return db
        .update(rfidScans)
        .set({
            doNumber,
            linked: true,
        })
        .where(inArray(rfidScans.id, targetIds))
        .returning()
}

export async function saveRfidScanPayload(payload: unknown) {
    const parsed = parseRfidScanPayload(payload)
    const product = await db.query.products.findFirst({
        columns: { id: true },
        where: and(
            eq(products.materialNumber, parsed.material.material),
            eq(products.sloc, parsed.material.sloc),
        ),
    })
    const warehouse = await db.query.warehouses.findFirst({
        columns: { id: true },
        where: eq(warehouses.sloc, parsed.material.sloc),
    })

    const rootScanType = parsed.scanType || parsed.status || "INBOUND"

    const rows = parsed.items.map((item) => {
        const itemScanType = item.scanType || item.status || rootScanType
        const normalizedScanType = itemScanType.toLowerCase().includes("keluar") || itemScanType.toLowerCase().includes("outbound")
            ? "OUTBOUND"
            : "INBOUND"

        return {
            tagId: item.epc,
            serialNumber: item.sn,
            epc: item.epc,
            rssi: item.rssi,
            linked: item.linked,
            plant: parsed.material.plnt,
            category: parsed.material.category,
            materialNumber: parsed.material.material,
            materialDescription: parsed.material.description,
            sloc: parsed.material.sloc,
            slocDescription: parsed.material.slocDescription,
            actStock: parsed.material.actStock,
            createdBy: parsed.createdBy,
            productId: product?.id,
            warehouseId: warehouse?.id,
            scanType: normalizedScanType,
            scannedAt: parsed.createdAt,
        }
    })

    return db.insert(rfidScans).values(rows).returning()
}

export const deleteRfidScanPayloadSchema = z.object({
    material: z.object({
        plnt: requiredText,
        material: requiredText,
        sloc: requiredText,
    }).optional(),
    epcs: z.array(requiredText).min(1),
})

export type DeleteRfidScanPayload = z.input<typeof deleteRfidScanPayloadSchema>

export function parseDeleteRfidScanPayload(payload: unknown) {
    return deleteRfidScanPayloadSchema.parse(payload)
}

export async function deleteRfidScanPayload(payload: unknown) {
    const parsed = parseDeleteRfidScanPayload(payload)

    const conditions: ReturnType<typeof eq>[] = [inArray(rfidScans.epc, parsed.epcs)]

    if (parsed.material) {
        conditions.push(
            eq(rfidScans.plant, parsed.material.plnt),
            eq(rfidScans.materialNumber, parsed.material.material),
            eq(rfidScans.sloc, parsed.material.sloc),
        )
    }

    const deleted = await db.delete(rfidScans).where(and(...conditions)).returning()
    return deleted
}
