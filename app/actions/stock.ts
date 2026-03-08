"use server"

import { db } from "@/db"
import { stockLevels } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { recordStockMovement } from "./stock-movement"
import { getAuthenticatedSession } from "@/lib/rbac"

import { stockSchema } from "@/lib/schemas"

export async function getStocks() {
    // Optimized query - hanya ambil kolom yang diperlukan
    return await db.query.stockLevels.findMany({
        columns: {
            id: true,
            productId: true,
            warehouseId: true,
            totalStock: true,
            minStock: true,
            valuationValue: true,
        },
        with: {
            product: {
                columns: {
                    materialNumber: true,
                    materialDescription: true,
                    plant: true,
                    category: true,
                    oldMaterialNo: true,
                    costSap: true,
                }
            },
            warehouse: {
                columns: {
                    sloc: true,
                    description: true,
                    type: true,
                }
            },
        },
    })
}

export async function upsertStock(data: z.infer<typeof stockSchema>, id?: number) {
    try {
        const session = await getAuthenticatedSession('stocks', id ? 'edit' : 'create')
        const userId = session.user.id

        await db.transaction(async (tx) => {
            let oldStock = 0
            let targetStockId: number | undefined = id

            if (!targetStockId) {
                const existing = await tx.query.stockLevels.findFirst({
                    where: and(
                        eq(stockLevels.productId, data.productId),
                        eq(stockLevels.warehouseId, data.warehouseId)
                    )
                })
                if (existing) {
                    oldStock = existing.totalStock
                    targetStockId = existing.id
                }
            } else {
                const existing = await tx.query.stockLevels.findFirst({
                    where: eq(stockLevels.id, targetStockId)
                })
                if (existing) {
                    oldStock = existing.totalStock
                }
            }

            if (targetStockId) {
                await tx.update(stockLevels)
                    .set({
                        ...data,
                        valuationValue: data.valuationValue?.toString(),
                        updatedAt: new Date(),
                    })
                    .where(eq(stockLevels.id, targetStockId))
            } else {
                await tx.insert(stockLevels).values({
                    ...data,
                    valuationValue: data.valuationValue?.toString(),
                })
            }

            // Record Movement (Adjustment)
            const delta = data.totalStock - oldStock
            if (delta !== 0) {
                await recordStockMovement(tx, {
                    productId: data.productId,
                    warehouseId: data.warehouseId,
                    quantity: delta,
                    type: "ADJUSTMENT",
                    referenceNumber: "Manual Adjustment",
                    recordedBy: userId,
                })
            }
        })
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (error) {
        console.error("Upsert stock error:", error)
        return { success: false, error: "Failed to update stock" }
    }
}

export async function deleteStock(id: number) {
    try {
        const session = await getAuthenticatedSession('stocks', 'delete')
        const userId = session.user.id

        return await db.transaction(async (tx) => {
            const existing = await tx.query.stockLevels.findFirst({
                where: eq(stockLevels.id, id)
            })

            if (existing) {
                // Record Movement (Adjustment/Removal)
                await recordStockMovement(tx, {
                    productId: existing.productId,
                    warehouseId: existing.warehouseId,
                    quantity: -existing.totalStock,
                    type: "ADJUSTMENT",
                    referenceNumber: "Manual Removal",
                    recordedBy: userId,
                })

                await tx.delete(stockLevels).where(eq(stockLevels.id, id))
            }

            revalidatePath("/dashboard/stocks")
            return { success: true }
        })
    } catch (error) {
        console.error("Delete stock error:", error)
        return { success: false, error: "Failed to delete stock" }
    }
}

export async function bulkDeleteStocks(ids: number[]) {
    try {
        await db.delete(stockLevels).where(inArray(stockLevels.id, ids))
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete stocks" }
    }
}

export async function bulkUpdateStockMinStock(ids: number[], minStock: number) {
    try {
        await db.update(stockLevels)
            .set({ minStock, updatedAt: new Date() })
            .where(inArray(stockLevels.id, ids))
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to update stock min levels" }
    }
}

export async function importStocks(data: (typeof stockLevels.$inferInsert)[]) {
    try {
        for (const item of data) {
            if (!item.productId || !item.warehouseId) continue

            await db.insert(stockLevels)
                .values(item)
                .onConflictDoUpdate({
                    target: [stockLevels.productId, stockLevels.warehouseId],
                    set: {
                        totalStock: item.totalStock,
                        valuationValue: item.valuationValue,
                        minStock: item.minStock,
                        updatedAt: new Date(),
                    },
                })
        }
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to import stocks" }
    }
}
