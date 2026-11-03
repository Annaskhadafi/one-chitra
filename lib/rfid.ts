import "server-only"

import { and, desc, eq, inArray, isNull, or } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { products, rfidDamagePhotos, rfidScans, warehouses } from "@/db/schema"

const flexibleString = z.preprocess((val) => {
    if (val === null || val === undefined) return ""
    return String(val).trim()
}, z.string())

const requiredText = z.preprocess((val) => {
    if (val === null || val === undefined) return ""
    return String(val).trim()
}, z.string().min(1))

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

const flexibleStringArray = z.preprocess((val) => {
    if (!val) return []
    if (Array.isArray(val)) {
        return val.map((v) => String(v).trim()).filter(Boolean)
    }
    if (typeof val === "string") {
        try {
            const parsed = JSON.parse(val)
            if (Array.isArray(parsed)) {
                return parsed.map((v) => String(v).trim()).filter(Boolean)
            }
        } catch {}
        return [val.trim()].filter(Boolean)
    }
    return []
}, z.array(z.string()))

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
            if (val === null || val === undefined || val === "") return null
            const num = Number(val)
            return Number.isNaN(num) ? null : Math.round(num)
        }, z.number().int().nullable()),
    }),
    items: z.array(z.object({
        sn: flexibleStringOrNull,
        epc: requiredText,
        rssi: flexibleRssi,
        linked: linkedSchema,
        scanType: flexibleStringOrNull,
        status: flexibleStringOrNull,
        tire_condition: flexibleStringOrNull,
        tireCondition: flexibleStringOrNull,
        condition: flexibleStringOrNull,
        kondisi: flexibleStringOrNull,
        remarks: flexibleStringOrNull,
        keterangan: flexibleStringOrNull,
        catatan: flexibleStringOrNull,
        damage_photos: flexibleStringArray.optional(),
        damagePhotos: flexibleStringArray.optional(),
        ekspedisi: flexibleStringOrNull,
        plat_truk: flexibleStringOrNull,
        platTruk: flexibleStringOrNull,
        tujuan: flexibleStringOrNull,
        nama_driver: flexibleStringOrNull,
        namaDriver: flexibleStringOrNull,
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

export type RfidScanRowWithDamagePhotos = typeof rfidScans.$inferSelect & {
    status: "Masuk" | "Keluar"
    damagePhotoRecords?: Array<typeof rfidDamagePhotos.$inferSelect>
    damagePhotos: string[]
    damagePhotoDetails: Array<{
        id: string
        filename: string
        url: string
    }>
}

export async function getRfidScanRows(limit = 500, statusFilter?: string): Promise<RfidScanRowWithDamagePhotos[]> {
    const rawRows = await db.query.rfidScans.findMany({
        orderBy: [desc(rfidScans.scannedAt), desc(rfidScans.id)],
        limit,
        with: {
            damagePhotoRecords: true,
        },
    })

    // Also collect all damage photos to map by SN if damagePhotoRecords is empty or unlinked
    const allDamagePhotos = await db.query.rfidDamagePhotos.findMany({
        orderBy: [desc(rfidDamagePhotos.id)],
    })

    const photosBySn = new Map<string, Array<typeof rfidDamagePhotos.$inferSelect>>()
    const photosById = new Map<string, typeof rfidDamagePhotos.$inferSelect>()

    for (const photo of allDamagePhotos) {
        photosById.set(photo.photoId, photo)
        const snKey = photo.sn.trim().toUpperCase()
        if (!photosBySn.has(snKey)) {
            photosBySn.set(snKey, [])
        }
        photosBySn.get(snKey)!.push(photo)
    }

    const formattedRows: RfidScanRowWithDamagePhotos[] = rawRows.map((row) => {
        const snKey = (row.serialNumber || "").trim().toUpperCase()
        const epcKey = (row.epc || "").trim().toUpperCase()

        const photosFromRelation = row.damagePhotoRecords || []
        const photosBySnMatch = photosBySn.get(snKey) || photosBySn.get(epcKey) || []

        // Combine photos from relation, by SN, and by explicit damagePhotos IDs in JSON
        const rawPhotoIds: string[] = Array.isArray(row.damagePhotos) ? (row.damagePhotos as string[]) : []
        const photosFromIds = rawPhotoIds
            .map((id) => photosById.get(id))
            .filter((p): p is typeof rfidDamagePhotos.$inferSelect => Boolean(p))

        const combinedPhotosMap = new Map<string, { id: string; filename: string; url: string }>()

        for (const p of [...photosFromRelation, ...photosFromIds, ...photosBySnMatch]) {
            if (!combinedPhotosMap.has(p.photoId)) {
                combinedPhotosMap.set(p.photoId, {
                    id: p.photoId,
                    filename: p.filename,
                    url: p.url,
                })
            }
        }

        const details = Array.from(combinedPhotosMap.values())
        const ids = details.map((d) => d.id)

        return {
            ...row,
            status: formatRfidStatus(row.scanType),
            damagePhotos: ids.length > 0 ? ids : rawPhotoIds,
            damagePhotoDetails: details,
        }
    })

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

export async function saveRfidScanPayload(payload: unknown, overrideStatus?: string) {
    const parsed = parseRfidScanPayload(payload)

    return db.transaction(async (tx) => {
        const product = await tx.query.products.findFirst({
            columns: { id: true },
            where: and(
                eq(products.materialNumber, parsed.material.material),
                eq(products.sloc, parsed.material.sloc),
            ),
        })
        const warehouse = await tx.query.warehouses.findFirst({
            columns: { id: true },
            where: eq(warehouses.sloc, parsed.material.sloc),
        })

        const rootScanType = overrideStatus || parsed.scanType || parsed.status || "INBOUND"

        const results = []

        // Fetch existing RFID scan rows for case-insensitive matching
        const allExistingScans = await tx.query.rfidScans.findMany({
            orderBy: [desc(rfidScans.id)],
        })

        for (const item of parsed.items) {
            const itemScanType = overrideStatus || item.scanType || item.status || rootScanType
            const normalizedScanType = itemScanType.toLowerCase().includes("keluar") || itemScanType.toLowerCase().includes("outbound")
                ? "OUTBOUND"
                : "INBOUND"

            const itemEpcUpper = item.epc?.trim().toUpperCase()
            const itemSnUpper = item.sn?.trim().toUpperCase()

            const itemTireCondition = item.tire_condition || item.tireCondition || item.condition || item.kondisi || null
            const itemRemarks = item.remarks || item.keterangan || item.catatan || null
            const itemEkspedisi = item.ekspedisi || null
            const itemPlatTruk = item.plat_truk || item.platTruk || null
            const itemTujuan = item.tujuan || null
            const itemNamaDriver = item.nama_driver || item.namaDriver || null
            const itemDamagePhotos = item.damage_photos?.length ? item.damage_photos : (item.damagePhotos ?? [])

            // Find existing scan record by matching EPC, Tag ID, or Serial Number
            const existing = allExistingScans.find((row) => {
                const rowEpc = row.epc?.trim().toUpperCase()
                const rowTag = row.tagId?.trim().toUpperCase()
                const rowSn = row.serialNumber?.trim().toUpperCase()

                const epcMatch = itemEpcUpper && (rowEpc === itemEpcUpper || rowTag === itemEpcUpper)
                const snMatch = itemSnUpper && (rowSn === itemSnUpper || rowEpc === itemSnUpper)
                return Boolean(epcMatch || snMatch)
            })

            const existingDamagePhotos = Array.isArray(existing?.damagePhotos) ? (existing?.damagePhotos as string[]) : []
            const mergedDamagePhotos = Array.from(new Set([...existingDamagePhotos, ...itemDamagePhotos]))

            let savedRecord: typeof rfidScans.$inferSelect

            if (existing) {
                // Update existing scan record so status immediately changes (e.g. Masuk -> Keluar)
                const [updated] = await tx
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
                        tireCondition: itemTireCondition ?? existing.tireCondition,
                        remarks: itemRemarks ?? existing.remarks,
                        damagePhotos: mergedDamagePhotos,
                        ekspedisi: itemEkspedisi ?? existing.ekspedisi,
                        platTruk: itemPlatTruk ?? existing.platTruk,
                        tujuan: itemTujuan ?? existing.tujuan,
                        namaDriver: itemNamaDriver ?? existing.namaDriver,
                    })
                    .where(eq(rfidScans.id, existing.id))
                    .returning()

                savedRecord = updated
                results.push(updated)
            } else {
                // Insert new scan record
                const [inserted] = await tx
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
                        tireCondition: itemTireCondition,
                        remarks: itemRemarks,
                        damagePhotos: mergedDamagePhotos,
                        ekspedisi: itemEkspedisi,
                        platTruk: itemPlatTruk,
                        tujuan: itemTujuan,
                        namaDriver: itemNamaDriver,
                    })
                    .returning()

                savedRecord = inserted
                results.push(inserted)
            }

            // Link uploaded damage photos to this rfid_scan record
            if (mergedDamagePhotos.length > 0) {
                await tx
                    .update(rfidDamagePhotos)
                    .set({ rfidScanId: savedRecord.id })
                    .where(inArray(rfidDamagePhotos.photoId, mergedDamagePhotos))
            }

            if (itemSnUpper) {
                await tx
                    .update(rfidDamagePhotos)
                    .set({ rfidScanId: savedRecord.id })
                    .where(
                        and(
                            eq(rfidDamagePhotos.sn, itemSnUpper),
                            isNull(rfidDamagePhotos.rfidScanId),
                        ),
                    )
            }
        }

        return results
    })
}

export const deleteRfidScanPayloadSchema = z.object({
    material: z.object({
        plnt: flexibleString,
        material: flexibleString,
        sloc: flexibleString,
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
