"use server"

import { db } from "@/db"
import { stockLevels } from "@/db/schema/stock-levels"
import { products } from "@/db/schema/products"
import { warehouses } from "@/db/schema/warehouses"
import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export async function getStocks() {
    return await db.select({
        id: stockLevels.id,
        productId: stockLevels.productId,
        warehouseId: stockLevels.warehouseId,
        valuationValue: stockLevels.valuationValue,
        totalStock: stockLevels.totalStock,
        minStock: stockLevels.minStock,
        updatedAt: stockLevels.updatedAt,
        // Product fields
        item: products.materialNumber,
        materialDescription: products.materialDescription,
        oldMaterialNo: products.oldMaterialNo,
        // Warehouse fields
        storeLoc: warehouses.sloc,
        slocDescription: warehouses.description,
    })
        .from(stockLevels)
        .innerJoin(products, eq(stockLevels.productId, products.id))
        .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
        .orderBy(products.materialNumber)
}

const stockSchema = z.object({
    productId: z.number(),
    warehouseId: z.number(),
    valuationValue: z.string(),
    totalStock: z.number(),
    minStock: z.number(),
})

export async function upsertStock(data: z.infer<typeof stockSchema>) {
    try {
        await db.insert(stockLevels)
            .values({
                ...data,
                updatedAt: new Date()
            })
            .onConflictDoUpdate({
                target: [stockLevels.warehouseId, stockLevels.productId],
                set: {
                    valuationValue: data.valuationValue,
                    totalStock: data.totalStock,
                    minStock: data.minStock,
                    updatedAt: new Date()
                }
            })

        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (error) {
        console.error("Upsert Stock Error:", error)
        return { success: false, error: "Failed to save stock level" }
    }
}

export async function deleteStock(id: number) {
    try {
        await db.delete(stockLevels).where(eq(stockLevels.id, id))
        revalidatePath("/dashboard/stocks")
        return { success: true }
    } catch (error) {
        return { success: false, error: "Failed to delete stock entry" }
    }
}

export async function importStocks(items: any[]) {
    try {
        let successCount = 0

        // Items should already have productId and warehouseId from the CSV parsing logic
        for (const item of items) {
            if (!item.productId || !item.warehouseId) continue;

            await db.insert(stockLevels)
                .values({
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    valuationValue: item.valuationValue?.toString() || "0",
                    totalStock: parseInt(item.totalStock?.toString() || "0"),
                    minStock: parseInt(item.minStock?.toString() || "0"),
                })
                .onConflictDoUpdate({
                    target: [stockLevels.warehouseId, stockLevels.productId],
                    set: {
                        valuationValue: item.valuationValue?.toString() || "0",
                        totalStock: parseInt(item.totalStock?.toString() || "0"),
                        minStock: parseInt(item.minStock?.toString() || "0"),
                        updatedAt: new Date()
                    }
                })

            successCount++
        }

        revalidatePath("/dashboard/stocks")
        return { success: true, count: successCount }
    } catch (error) {
        console.error("Import Stock Error:", error)
        return { success: false, error: "Stock import failed" }
    }
}
