"use server"

import { db } from "@/db"
import { stockLevels } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { stockSchema } from "@/lib/schemas"

export async function getStocks() {
    return await db.query.stockLevels.findMany({
        with: {
            product: true,
            warehouse: true,
        },
    })
}

export async function upsertStock(data: z.infer<typeof stockSchema>, id?: number) {
    try {
        if (id) {
            await db.update(stockLevels)
                .set({
                    ...data,
                    valuationValue: data.valuationValue?.toString(),
                    updatedAt: new Date(),
                })
                .where(eq(stockLevels.id, id))
        } else {
            const existing = await db.select().from(stockLevels)
                .where(and(
                    eq(stockLevels.productId, data.productId),
                    eq(stockLevels.warehouseId, data.warehouseId)
                ))
                .limit(1)

            if (existing.length > 0) {
                await db.update(stockLevels)
                    .set({
                        ...data,
                        valuationValue: data.valuationValue?.toString(),
                        updatedAt: new Date(),
                    })
                    .where(eq(stockLevels.id, existing[0].id))
            } else {
                await db.insert(stockLevels).values({
                    ...data,
                    valuationValue: data.valuationValue?.toString(),
                })
            }
        }
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to update stock" }
    }
}

export async function deleteStock(id: number) {
    try {
        await db.delete(stockLevels).where(eq(stockLevels.id, id))
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (_error) {
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
