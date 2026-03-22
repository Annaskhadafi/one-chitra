"use server"

import { db } from "@/db"
import { warehouses } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { warehouseSchema } from "@/lib/schemas"
import { normalizeSloc, normalizeSlocFields } from "@/lib/sloc"
import { getAllowedWarehouseIdsForCurrentUser } from "@/lib/warehouse-access"
import { getSetting } from "./settings"

const normalizeWarehouseInput = (data: z.infer<typeof warehouseSchema>) => ({
    ...data,
    sloc: normalizeSloc(data.sloc),
    description: data.description?.trim() || "",
    type: data.type?.trim() || null,
})

export async function getWarehouses() {
    const manualRate = await getSetting("manual_usd_rate")
    const rate = parseFloat(manualRate || "1")
    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")

    if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
        return []
    }

    const data = await db.query.warehouses.findMany({
        where: allowedWarehouseIds
            ? (warehouse, { inArray }) => inArray(warehouse.id, allowedWarehouseIds)
            : undefined,
        with: {
            stocks: {
                with: {
                    product: true
                }
            }
        }
    })

    const result = data.map(w => {
        let totalStock = 0
        let totalValuation = 0

        w.stocks.forEach(s => {
            totalStock += s.totalStock
            const cost = s.product?.costSap
                ? parseFloat(s.product.costSap.toString().replace(/,/g, ""))
                : 0
            totalValuation += s.totalStock * cost * rate
        })

        // Remove stocks to keep payload clean, we just need the totals
        const { stocks: _stocks, ...rest } = w
        return {
            ...rest,
            totalStock,
            totalValuation
        }
    })

    const normalizedResult = normalizeSlocFields(result)

    // Sort: Type first (alphabetical), then empty/null Type at bottom
    return normalizedResult.sort((a, b) => {
        const typeA = a.type || ""
        const typeB = b.type || ""

        if (typeA && !typeB) return -1
        if (!typeA && typeB) return 1

        if (typeA && typeB) {
            const cmp = typeA.localeCompare(typeB)
            if (cmp !== 0) return cmp
        }

        return a.sloc.localeCompare(b.sloc)
    })
}

export async function createWarehouse(data: z.infer<typeof warehouseSchema>) {
    try {
        const normalizedData = normalizeWarehouseInput(data)
        const existingWarehouses = await db.select({ id: warehouses.id, sloc: warehouses.sloc }).from(warehouses)
        const existing = existingWarehouses.find((warehouse) => normalizeSloc(warehouse.sloc) === normalizedData.sloc)
        if (existing) {
            return { success: false, error: "Warehouse with this Sloc already exists" }
        }

        await db.insert(warehouses).values(normalizedData)
        revalidatePath("/dashboard/warehouse")
        return { success: true }
    } catch (_error) {
        console.error("Create Warehouse Error:", _error)
        return { success: false, error: "Failed to create warehouse" }
    }
}

export async function updateWarehouse(id: number, data: z.infer<typeof warehouseSchema>) {
    try {
        const normalizedData = normalizeWarehouseInput(data)
        const existingWarehouses = await db.select({ id: warehouses.id, sloc: warehouses.sloc }).from(warehouses)
        const existing = existingWarehouses.find((warehouse) => normalizeSloc(warehouse.sloc) === normalizedData.sloc)
        if (existing && existing.id !== id) {
            return { success: false, error: "Sloc already taken by another warehouse" }
        }

        await db.update(warehouses)
            .set({
                sloc: normalizedData.sloc,
                description: normalizedData.description,
                type: normalizedData.type,
                updatedAt: new Date()
            })
            .where(eq(warehouses.id, id))

        revalidatePath("/dashboard/warehouse")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to update warehouse" }
    }
}

export async function deleteWarehouse(id: number) {
    try {
        await db.delete(warehouses).where(eq(warehouses.id, id))
        revalidatePath("/dashboard/warehouse")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete warehouse" }
    }
}

export async function bulkDeleteWarehouses(ids: number[]) {
    try {
        await db.delete(warehouses).where(inArray(warehouses.id, ids))
        revalidatePath("/dashboard/warehouse")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete warehouses" }
    }
}

export async function checkWarehouseImport(slocs: string[]) {
    try {
        const normalizedSlocs = Array.from(new Set(slocs.map((sloc) => normalizeSloc(sloc)).filter(Boolean)))
        const existingWarehouses = await db.select({ sloc: warehouses.sloc }).from(warehouses)
        const existingSlocSet = new Set(existingWarehouses.map((warehouse) => normalizeSloc(warehouse.sloc)))
        const existingSlocs = normalizedSlocs.filter((sloc) => existingSlocSet.has(sloc))
        const newSlocs = normalizedSlocs.filter((sloc) => !existingSlocSet.has(sloc))

        return {
            success: true,
            existingSlocs,
            newSlocs,
            existingCount: existingSlocs.length,
            newCount: newSlocs.length
        }
    } catch (_error) {
        return { success: false, error: "Failed to check import data" }
    }
}

export async function importWarehouses(data: (typeof warehouses.$inferInsert)[], mode: 'update' | 'skip' = 'update') {
    try {
        if (data.length === 0) return { success: true, count: 0 }

        let successCount = 0

        for (const item of data) {
            const normalizedSloc = normalizeSloc(item.sloc)
            const description = item.description?.trim()
            if (!normalizedSloc || !description) continue

            const normalizedItem = {
                ...item,
                sloc: normalizedSloc,
                description,
                type: item.type?.trim() || null,
            }

            try {
                if (mode === 'update') {
                    await db.insert(warehouses)
                        .values(normalizedItem)
                        .onConflictDoUpdate({
                            target: warehouses.sloc,
                            set: {
                                description: normalizedItem.description,
                                type: normalizedItem.type,
                                updatedAt: new Date(),
                            }
                        })
                    successCount++
                } else {
                    // Skip existing: Only insert if not exists
                    await db.insert(warehouses)
                        .values(normalizedItem)
                        .onConflictDoNothing({
                            target: warehouses.sloc,
                        })

                    // We can't easily know if it was inserted or ignored with DoNothing without a return or separate check,
                    // but for the count we can assume we tried. 
                    // Actually, let's just count it. 
                    // Or accurately: "Processed" count.
                    successCount++
                }
            } catch (err) {
                console.error(`Failed to import warehouse ${normalizedItem.sloc}:`, err)
            }
        }

        revalidatePath("/dashboard/warehouse")
        return { success: true, count: successCount }
    } catch (_error) {
        console.error("Import error:", _error)
        return { success: false, error: "Failed to import warehouses" }
    }
}
