"use server"

import { db } from "@/db"
import { stockTransfers, stockTransferItems, stockLevels, products, warehouses } from "@/db/schema"
import { eq, and, desc, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { recordStockMovement } from "./stock-movement"
import { getAuthenticatedSession } from "@/lib/rbac"

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

        const session = await getAuthenticatedSession('stock-transfers', 'create')
        const userId = session.user.id
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
                receivedStatus: "Received", // Manual creation defaults to Received for now, or we can make it an option
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

                // Record Source Movement (Out)
                await recordStockMovement(tx, {
                    productId: item.productId,
                    warehouseId: data.sourceWarehouseId,
                    quantity: -item.quantity,
                    type: "TRANSFER_OUT",
                    referenceNumber,
                    recordedBy: userId,
                })

                // Record Destination Movement (In)
                await recordStockMovement(tx, {
                    productId: item.productId,
                    warehouseId: data.destinationWarehouseId,
                    quantity: item.quantity,
                    type: "TRANSFER_IN",
                    referenceNumber,
                    recordedBy: userId,
                })

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

export async function updateStockTransferStatus(id: number, data: {
    receivedStatus: "Scheduled" | "Received" | "Rejected";
    postingDocumentNo?: string;
    batchNo?: string;
    notes?: string;
}) {
    try {
        const session = await getAuthenticatedSession('stock-transfers', 'edit')
        const userId = session.user.id

        return await db.transaction(async (tx) => {
            const transfer = await tx.query.stockTransfers.findFirst({
                where: eq(stockTransfers.id, id),
                with: { items: true }
            })

            if (!transfer) throw new Error("Transfer not found")
            if (transfer.receivedStatus === "Received") throw new Error("Transfer already received")

            await tx.update(stockTransfers)
                .set({
                    receivedStatus: data.receivedStatus,
                    postingDocumentNo: data.postingDocumentNo,
                    batchNo: data.batchNo,
                    notes: data.notes || transfer.notes,
                    status: data.receivedStatus === "Received" ? "completed" : transfer.status,
                    updatedAt: new Date(),
                })
                .where(eq(stockTransfers.id, id))

            // If status changed to Received, move the stock
            if (data.receivedStatus === "Received") {
                for (const item of transfer.items) {
                    // 1. Deduct from source
                    const sourceStock = await tx.query.stockLevels.findFirst({
                        where: and(
                            eq(stockLevels.warehouseId, transfer.fromWarehouseId),
                            eq(stockLevels.productId, item.productId)
                        )
                    })

                    if (!sourceStock || sourceStock.totalStock < item.quantity) {
                        throw new Error(`Insufficient stock for product ID ${item.productId} in source warehouse`)
                    }

                    await tx.update(stockLevels)
                        .set({
                            totalStock: sourceStock.totalStock - item.quantity,
                            updatedAt: new Date()
                        })
                        .where(eq(stockLevels.id, sourceStock.id))

                    // 2. Add to destination
                    const destStock = await tx.query.stockLevels.findFirst({
                        where: and(
                            eq(stockLevels.warehouseId, transfer.toWarehouseId),
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
                            warehouseId: transfer.toWarehouseId,
                            productId: item.productId,
                            totalStock: item.quantity,
                            minStock: 0,
                            valuationValue: '0',
                        })
                    }

                    // 3. Record Movement logs
                    // Record Source Movement (Out)
                    await recordStockMovement(tx, {
                        productId: item.productId,
                        warehouseId: transfer.fromWarehouseId,
                        quantity: -item.quantity,
                        type: "TRANSFER_OUT",
                        referenceNumber: transfer.referenceNumber as string,
                        recordedBy: userId,
                    })

                    // Record Destination Movement (In)
                    await recordStockMovement(tx, {
                        productId: item.productId,
                        warehouseId: transfer.toWarehouseId,
                        quantity: item.quantity,
                        type: "TRANSFER_IN",
                        referenceNumber: transfer.referenceNumber as string,
                        recordedBy: userId,
                    })
                }
            }

            return { success: true }
        })
    } catch (error: any) {
        console.error("Update stock transfer status error:", error)
        return { success: false, error: error.message || "Failed to update status" }
    } finally {
        revalidatePath("/dashboard/stock-transfers")
        revalidatePath("/dashboard/inventory")
    }
}

export async function updateStockTransfer(id: number, data: {
    postingDocumentNo?: string;
    batchNo?: string;
    notes?: string;
    receivedStatus?: "Scheduled" | "Received" | "Rejected";
}) {
    try {
        await getAuthenticatedSession('stock-transfers', 'edit')

        const transfer = await db.query.stockTransfers.findFirst({
            where: eq(stockTransfers.id, id),
        })

        if (!transfer) {
            return { success: false, error: "Transfer not found" }
        }

        // Allow manual status change without automatic stock movement
        await db.update(stockTransfers)
            .set({
                postingDocumentNo: data.postingDocumentNo ?? transfer.postingDocumentNo,
                batchNo: data.batchNo ?? transfer.batchNo,
                notes: data.notes ?? transfer.notes,
                receivedStatus: data.receivedStatus ?? transfer.receivedStatus,
                updatedAt: new Date(),
            })
            .where(eq(stockTransfers.id, id))

        revalidatePath("/dashboard/stock-transfers")
        return { success: true }
    } catch (error: any) {
        console.error("Update stock transfer error:", error)
        return { success: false, error: error.message || "Failed to update transfer" }
    }
}

export async function getStockTransferStats() {
    const transfers = await db.query.stockTransfers.findMany()

    const totalTransfers = transfers.length
    const receivedTransfers = transfers.filter(t => t.receivedStatus === "Received").length
    const scheduledTransfers = transfers.filter(t => t.receivedStatus === "Scheduled").length
    const rejectedTransfers = transfers.filter(t => t.receivedStatus === "Rejected").length

    return {
        totalTransfers,
        receivedTransfers,
        scheduledTransfers,
        rejectedTransfers,
    }
}
