"use server"

import { db } from "@/db"
import { stockTransfers, stockTransferItems, stockLevels, products, warehouses } from "@/db/schema"
import { eq, and, desc, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const stockTransferItemSchema = z.object({
    productId: z.number(),
    quantity: z.number().min(1),
})

const stockTransferSchema = z.object({
    sourceWarehouseId: z.number(),
    destinationWarehouseId: z.number(),
    items: z.array(stockTransferItemSchema).min(1, "At least one item is required"),
    notes: z.string().optional(),
    transferDate: z.date(),
})

export async function getStockTransfers() {
    return await db.query.stockTransfers.findMany({
        with: {
            fromWarehouse: true,
            toWarehouse: true,
            items: {
                with: {
                    product: true
                }
            }
        },
        orderBy: [desc(stockTransfers.createdAt)],
    })
}

export async function createStockTransfer(data: z.infer<typeof stockTransferSchema>) {
    try {
        if (data.sourceWarehouseId === data.destinationWarehouseId) {
            return { success: false, error: "Source and destination warehouses must be different" }
        }

        const referenceNumber = `ST-${Date.now()}`

        return await db.transaction(async (tx) => {
            // 1. Validate all items and their stock
            for (const item of data.items) {
                const sourceStock = await tx.query.stockLevels.findFirst({
                    where: and(
                        eq(stockLevels.warehouseId, data.sourceWarehouseId),
                        eq(stockLevels.productId, item.productId)
                    )
                })

                if (!sourceStock || sourceStock.totalStock < item.quantity) {
                    throw new Error(`Insufficient stock for product ID ${item.productId}`)
                }
            }

            // 2. Create Header
            const [transfer] = await tx.insert(stockTransfers).values({
                referenceNumber,
                fromWarehouseId: data.sourceWarehouseId,
                toWarehouseId: data.destinationWarehouseId,
                status: "completed",
                notes: data.notes,
                transferDate: data.transferDate,
            }).returning()

            // 3. Process Items and Stock Movements
            for (const item of data.items) {
                // Deduct from source
                const sourceStock = await tx.query.stockLevels.findFirst({
                    where: and(
                        eq(stockLevels.warehouseId, data.sourceWarehouseId),
                        eq(stockLevels.productId, item.productId)
                    )
                })

                if (sourceStock) {
                    await tx.update(stockLevels)
                        .set({
                            totalStock: sourceStock.totalStock - item.quantity,
                            updatedAt: new Date()
                        })
                        .where(eq(stockLevels.id, sourceStock.id))
                }


                // Add to destination
                const destStock = await tx.query.stockLevels.findFirst({
                    where: and(
                        eq(stockLevels.warehouseId, data.destinationWarehouseId),
                        eq(stockLevels.productId, item.productId)
                    )
                })

                if (destStock) {
                    await tx.update(stockLevels)
                        .set({
                            totalStock: destStock.totalStock + item.quantity,
                            updatedAt: new Date()
                        })
                        .where(eq(stockLevels.id, destStock.id))
                } else {
                    await tx.insert(stockLevels).values({
                        warehouseId: data.destinationWarehouseId,
                        productId: item.productId,
                        totalStock: item.quantity,
                        minStock: 0,
                        valuationValue: '0',
                    })
                }

                // Create Item Record
                await tx.insert(stockTransferItems).values({
                    transferId: transfer.id,
                    productId: item.productId,
                    quantity: item.quantity,
                })
            }

            return { success: true }
        })
    } catch (error: unknown) {
        console.error("Stock transfer error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Transaction failed" }
    } finally {
        revalidatePath("/dashboard/stock-transfers")
        revalidatePath("/dashboard/stocks")
        revalidatePath("/dashboard/warehouse")
    }
}

export async function checkTransferStockAvailability(warehouseId: number, items: { productId: number; quantity: number }[]) {
    const results: { productId: number; requested: number; available: number; sufficient: boolean }[] = []

    for (const item of items) {
        const stock = await db.query.stockLevels.findFirst({
            where: and(
                eq(stockLevels.warehouseId, warehouseId),
                eq(stockLevels.productId, item.productId),
            )
        })

        const available = stock ? stock.totalStock : 0
        results.push({
            productId: item.productId,
            requested: item.quantity,
            available,
            sufficient: available >= item.quantity,
        })
    }

    return results
}

export async function getStockTransferStats() {
    const transfers = await db.query.stockTransfers.findMany()

    const totalTransfers = transfers.length
    const completedTransfers = transfers.filter(t => t.status === "completed").length
    const pendingTransfers = transfers.filter(t => t.status === "pending").length

    return {
        totalTransfers,
        completedTransfers,
        pendingTransfers,
    }
}
