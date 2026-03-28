"use server"

import { revalidatePath } from "next/cache"
import { and, asc, desc, eq, ilike, ne, sql } from "drizzle-orm"

import { db } from "@/db"
import {
    inventoryVendorLeadTimeMaterials,
    inventoryVendorLeadTimes,
    me2lPurchDocsSap,
    zmc9StockSap,
} from "@/db/schema"
import { getAuthenticatedSession } from "@/lib/rbac"

type VendorMaterialInput = {
    materialNo: string
    materialDesc?: string | null
    leadTimeDays: number
    isPreferred?: boolean
}

export type VendorLeadTimeProfile = {
    id: number
    vendorName: string
    defaultLeadTimeDays: number | null
    notes: string | null
    isActive: boolean
    itemCount: number
    materials: Array<{
        id: number
        materialNo: string
        materialDesc: string | null
        leadTimeDays: number
        isPreferred: boolean
    }>
}

export type MaterialVendorReference = {
    materialNo: string
    materialDesc: string | null
    defaultVendorName: string | null
    defaultLeadTimeDays: number | null
    vendors: Array<{
        vendorName: string
        leadTimeDays: number | null
        source: "custom_master" | "historical"
        isPreferred: boolean
    }>
}

const normalizeVendorName = (value: string) => value.trim()
const normalizeMaterialNo = (value: string) => value.trim().toUpperCase()

const parsePositiveInteger = (value: unknown) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return null
    const rounded = Math.round(numericValue)
    return rounded > 0 ? rounded : null
}

const parseDateValue = (value: string | Date | null | undefined) => {
    if (!value) return null
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getDateDifferenceInDays = (endDate: Date, startDate: Date) => {
    const millisecondsPerDay = 1000 * 60 * 60 * 24
    return Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay)
}

export async function getInventoryVendorProfiles(): Promise<VendorLeadTimeProfile[]> {
    await getAuthenticatedSession("inventory", "view")

    const rows = await db
        .select({
            vendorId: inventoryVendorLeadTimes.id,
            vendorName: inventoryVendorLeadTimes.vendorName,
            defaultLeadTimeDays: inventoryVendorLeadTimes.defaultLeadTimeDays,
            notes: inventoryVendorLeadTimes.notes,
            isActive: inventoryVendorLeadTimes.isActive,
            materialId: inventoryVendorLeadTimeMaterials.id,
            materialNo: inventoryVendorLeadTimeMaterials.materialNo,
            materialDesc: inventoryVendorLeadTimeMaterials.materialDesc,
            leadTimeDays: inventoryVendorLeadTimeMaterials.leadTimeDays,
            isPreferred: inventoryVendorLeadTimeMaterials.isPreferred,
        })
        .from(inventoryVendorLeadTimes)
        .leftJoin(
            inventoryVendorLeadTimeMaterials,
            eq(inventoryVendorLeadTimeMaterials.vendorId, inventoryVendorLeadTimes.id),
        )
        .orderBy(
            asc(inventoryVendorLeadTimes.vendorName),
            desc(inventoryVendorLeadTimeMaterials.isPreferred),
            asc(inventoryVendorLeadTimeMaterials.materialNo),
        )

    const profileMap = new Map<number, VendorLeadTimeProfile>()

    for (const row of rows) {
        const current = profileMap.get(row.vendorId) ?? {
            id: row.vendorId,
            vendorName: row.vendorName,
            defaultLeadTimeDays: row.defaultLeadTimeDays,
            notes: row.notes,
            isActive: row.isActive,
            itemCount: 0,
            materials: [],
        }

        if (row.materialId !== null) {
            current.materials.push({
                id: row.materialId,
                materialNo: row.materialNo || "",
                materialDesc: row.materialDesc,
                leadTimeDays: row.leadTimeDays || 0,
                isPreferred: row.isPreferred || false,
            })
        }

        current.itemCount = current.materials.length
        profileMap.set(row.vendorId, current)
    }

    return Array.from(profileMap.values())
}

export async function upsertInventoryVendorProfile(input: {
    id?: number
    vendorName: string
    defaultLeadTimeDays?: number | null
    notes?: string | null
    isActive?: boolean
    materials: VendorMaterialInput[]
}) {
    await getAuthenticatedSession("inventory", "edit")

    const vendorName = normalizeVendorName(input.vendorName || "")
    if (!vendorName) {
        return { success: false as const, error: "Nama vendor wajib diisi." }
    }

    const defaultLeadTimeDays = input.defaultLeadTimeDays == null
        ? null
        : parsePositiveInteger(input.defaultLeadTimeDays)

    if (input.defaultLeadTimeDays != null && defaultLeadTimeDays === null) {
        return { success: false as const, error: "Default lead time harus lebih dari 0 hari." }
    }

    const normalizedMaterials = Array.from(
        new Map(
            (input.materials || [])
                .map((item) => ({
                    materialNo: normalizeMaterialNo(item.materialNo || ""),
                    materialDesc: item.materialDesc?.trim() || null,
                    leadTimeDays: parsePositiveInteger(item.leadTimeDays),
                    isPreferred: Boolean(item.isPreferred),
                }))
                .filter((item) => item.materialNo && item.leadTimeDays !== null)
                .map((item) => [item.materialNo, item]),
        ).values(),
    )

    if (normalizedMaterials.length === 0) {
        return { success: false as const, error: "Pilih minimal satu material untuk vendor ini." }
    }

    const existingVendor = await db.query.inventoryVendorLeadTimes.findFirst({
        where: input.id
            ? and(
                ilike(inventoryVendorLeadTimes.vendorName, vendorName),
                ne(inventoryVendorLeadTimes.id, input.id),
            )
            : ilike(inventoryVendorLeadTimes.vendorName, vendorName),
    })

    if (existingVendor) {
        return { success: false as const, error: "Nama vendor sudah ada. Silakan edit vendor yang sudah tersedia." }
    }

    const preferredCount = normalizedMaterials.filter((item) => item.isPreferred).length
    const finalMaterials = normalizedMaterials.map((item, index) => ({
        ...item,
        isPreferred: preferredCount === 0 ? index === 0 : item.isPreferred,
    }))

    const vendorId = await db.transaction(async (tx) => {
        let currentVendorId = input.id

        if (currentVendorId) {
            await tx
                .update(inventoryVendorLeadTimes)
                .set({
                    vendorName,
                    defaultLeadTimeDays,
                    notes: input.notes?.trim() || null,
                    isActive: input.isActive ?? true,
                    updatedAt: new Date(),
                })
                .where(eq(inventoryVendorLeadTimes.id, currentVendorId))

            await tx
                .delete(inventoryVendorLeadTimeMaterials)
                .where(eq(inventoryVendorLeadTimeMaterials.vendorId, currentVendorId))
        } else {
            const inserted = await tx
                .insert(inventoryVendorLeadTimes)
                .values({
                    vendorName,
                    defaultLeadTimeDays,
                    notes: input.notes?.trim() || null,
                    isActive: input.isActive ?? true,
                })
                .returning({ id: inventoryVendorLeadTimes.id })

            currentVendorId = inserted[0]?.id
        }

        if (!currentVendorId) {
            throw new Error("Vendor gagal disimpan.")
        }

        await tx.insert(inventoryVendorLeadTimeMaterials).values(
            finalMaterials.map((item) => ({
                vendorId: currentVendorId,
                materialNo: item.materialNo,
                materialDesc: item.materialDesc,
                leadTimeDays: item.leadTimeDays || 1,
                isPreferred: item.isPreferred,
            })),
        )

        return currentVendorId
    })

    revalidatePath("/dashboard/inventory-ml")
    revalidatePath("/dashboard/inventory-ml/vendors")

    return { success: true as const, vendorId }
}

export async function deleteInventoryVendorProfile(id: number) {
    await getAuthenticatedSession("inventory", "edit")

    await db.delete(inventoryVendorLeadTimes).where(eq(inventoryVendorLeadTimes.id, id))

    revalidatePath("/dashboard/inventory-ml")
    revalidatePath("/dashboard/inventory-ml/vendors")

    return { success: true as const }
}

export async function getMaterialVendorReference(materialNo: string): Promise<{
    success: boolean
    data?: MaterialVendorReference
    error?: string
}> {
    await getAuthenticatedSession("inventory", "view")

    const normalizedMaterialNo = normalizeMaterialNo(materialNo || "")
    if (!normalizedMaterialNo) {
        return { success: true, data: { materialNo: "", materialDesc: null, defaultVendorName: null, defaultLeadTimeDays: null, vendors: [] } }
    }

    const [materialRow] = await db
        .select({
            materialNo: zmc9StockSap.materialNo,
            materialDesc: zmc9StockSap.materialDesc,
        })
        .from(zmc9StockSap)
        .where(sql`trim(cast(${zmc9StockSap.materialNo} as text)) = ${normalizedMaterialNo}`)
        .limit(1)

    const customRows = await db
        .select({
            vendorName: inventoryVendorLeadTimes.vendorName,
            leadTimeDays: inventoryVendorLeadTimeMaterials.leadTimeDays,
            isPreferred: inventoryVendorLeadTimeMaterials.isPreferred,
            defaultLeadTimeDays: inventoryVendorLeadTimes.defaultLeadTimeDays,
        })
        .from(inventoryVendorLeadTimeMaterials)
        .innerJoin(
            inventoryVendorLeadTimes,
            eq(inventoryVendorLeadTimes.id, inventoryVendorLeadTimeMaterials.vendorId),
        )
        .where(
            and(
                eq(inventoryVendorLeadTimeMaterials.materialNo, normalizedMaterialNo),
                eq(inventoryVendorLeadTimes.isActive, true),
            ),
        )
        .orderBy(desc(inventoryVendorLeadTimeMaterials.isPreferred), asc(inventoryVendorLeadTimes.vendorName))

    const historicalRows = await db
        .select({
            vendorName: me2lPurchDocsSap.vendorName,
            docDate: me2lPurchDocsSap.docDate,
            grProcessedDate: me2lPurchDocsSap.grProcessedDate,
        })
        .from(me2lPurchDocsSap)
        .where(
            and(
                eq(me2lPurchDocsSap.material, normalizedMaterialNo),
                sql`${me2lPurchDocsSap.grProcessedDate} IS NOT NULL`,
            ),
        )

    const historicalMap = new Map<string, number[]>()
    for (const row of historicalRows) {
        const vendorName = row.vendorName?.trim()
        const docDate = parseDateValue(row.docDate)
        const receivedDate = parseDateValue(row.grProcessedDate)
        if (!vendorName || !docDate || !receivedDate) {
            continue
        }
        const leadTimeDays = getDateDifferenceInDays(receivedDate, docDate)
        if (leadTimeDays < 0) {
            continue
        }
        const samples = historicalMap.get(vendorName) ?? []
        samples.push(leadTimeDays)
        historicalMap.set(vendorName, samples)
    }

    const vendorMap = new Map<string, MaterialVendorReference["vendors"][number]>()

    for (const row of customRows) {
        vendorMap.set(row.vendorName, {
            vendorName: row.vendorName,
            leadTimeDays: row.leadTimeDays ?? row.defaultLeadTimeDays ?? null,
            source: "custom_master",
            isPreferred: row.isPreferred,
        })
    }

    for (const [vendorName, samples] of historicalMap.entries()) {
        if (vendorMap.has(vendorName)) {
            continue
        }
        const averageLeadTime = samples.reduce((sum, item) => sum + item, 0) / Math.max(samples.length, 1)
        vendorMap.set(vendorName, {
            vendorName,
            leadTimeDays: Number(averageLeadTime.toFixed(1)),
            source: "historical",
            isPreferred: false,
        })
    }

    const vendors = Array.from(vendorMap.values()).sort((left, right) => {
        if (left.isPreferred !== right.isPreferred) {
            return left.isPreferred ? -1 : 1
        }
        if (left.source !== right.source) {
            return left.source === "custom_master" ? -1 : 1
        }
        return left.vendorName.localeCompare(right.vendorName)
    })

    const defaultVendor = vendors[0] ?? null

    return {
        success: true,
        data: {
            materialNo: normalizedMaterialNo,
            materialDesc: materialRow?.materialDesc || null,
            defaultVendorName: defaultVendor?.vendorName ?? null,
            defaultLeadTimeDays: defaultVendor?.leadTimeDays ?? null,
            vendors,
        },
    }
}
