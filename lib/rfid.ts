import "server-only"

import { and, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { products, rfidScans, warehouses } from "@/db/schema"

const flexibleString = z.preprocess((val) => {
    if (val === null || val === undefined) return ""
    return String(val).trim()
}, z.string())

const requiredText = flexibleString

const flexibleStringOrNull = z.preprocess((val) => {
    if (val === null || val === undefined) return null
    const str = String(val).trim()
    return str === "" ? null : str
}, z.string().nullable())

const flexibleRssi = z.preprocess((val) => {
    if (val === null || val === undefined) return "0"
    const str = String(val).trim()
    return str === "" ? "0" : str
}, z.string())

const parseFlutterDate = (value: unknown) => {
    if (!value) return new Date()
    const str = String(value).trim()
    const parsed = new Date(str.includes("T") ? str : str.replace(" ", "T"))
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

const flexibleDate = z.preprocess((val) => parseFlutterDate(val), z.date())

const linkedSchema = z.preprocess((value) => {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase()
        if (normalized === "true") return true
        if (normalized === "false") return false
    }
    if (typeof value === "boolean") return value
    return false
}, z.boolean())

export const rfidScanPayloadSchema = z.object({
    material: z.object({
        plnt: flexibleString,
        category: flexibleStringOrNull,
        material: flexibleString,
        description: flexibleStringOrNull,
        sloc: flexibleString,
        slocDescription: flexibleStringOrNull,
        actStock: z.preprocess((val) => {
            if (val === null || val === undefined || val === "") return 0
            const num = Number(val)
            return Number.isNaN(num) ? 0 : Math.round(num)
        }, z.number().int()),
    }),
    items: z.array(z.object({
        sn: flexibleStringOrNull,
        epc: flexibleString,
        rssi: flexibleRssi,
        linked: linkedSchema,
        scanType: flexibleStringOrNull,
        status: flexibleStringOrNull,
    })).min(1),
    createdBy: z.preprocess((val) => {
        if (!val) return "System"
        return String(val).trim()
    }, z.string()),
    createdAt: flexibleDate,
    scanType: flexibleStringOrNull,
    status: flexibleStringOrNull,
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

    const results = []

    for (const item of parsed.items) {
        const itemScanType = item.scanType || item.status || rootScanType
        const normalizedScanType = itemScanType.toLowerCase().includes("keluar") || itemScanType.toLowerCase().includes("outbound")
            ? "OUTBOUND"
            : "INBOUND"

        // Find existing record by EPC or Serial Number
        const existing = await db.query.rfidScans.findFirst({
            where: (scans, { or, eq }) => {
                const conds = []
                if (item.epc && item.epc.trim()) {
                    conds.push(eq(scans.epc, item.epc.trim()))
                    conds.push(eq(scans.tagId, item.epc.trim()))
                }
                if (item.sn && item.sn.trim()) {
                    conds.push(eq(scans.serialNumber, item.sn.trim()))
                }
                return conds.length > 0 ? or(...conds) : undefined
            },
        })

        if (existing) {
            // Update existing scan record so status immediately changes
            const [updated] = await db
                .update(rfidScans)
                .set({
                    scanType: normalizedScanType,
                    scannedAt: parsed.createdAt,
                    rssi: item.rssi || existing.rssi,
                    linked: item.linked ?? existing.linked,
                    plant: parsed.material.plnt || existing.plant,
                    category: parsed.material.category ?? existing.category,
                    materialNumber: parsed.material.material || existing.materialNumber,
                    materialDescription: parsed.material.description ?? existing.materialDescription,
                    sloc: parsed.material.sloc || existing.sloc,
                    slocDescription: parsed.material.slocDescription ?? existing.slocDescription,
                    actStock: parsed.material.actStock ?? existing.actStock,
                    createdBy: parsed.createdBy || existing.createdBy,
                    productId: product?.id ?? existing.productId,
                    warehouseId: warehouse?.id ?? existing.warehouseId,
                })
                .where(eq(rfidScans.id, existing.id))
                .returning()

            results.push(updated)
        } else {
            // Insert new scan record
            const [inserted] = await db
                .insert(rfidScans)
                .values({
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
                })
                .returning()

            results.push(inserted)
        }
    }

    return results
}

export const deleteRfidScanPayloadSchema = z.object({
    material: z.object({
        plnt: flexibleString,
        material: flexibleString,
        sloc: flexibleString,
    }).optional(),
    epcs: z.array(flexibleString).min(1),
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
