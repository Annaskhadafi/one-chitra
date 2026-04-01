"use server"

import { db } from "@/db"
import { stockTransfers, stockTransferItems, stockLevels } from "@/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { recordStockMovement } from "./stock-movement"
import { getAuthenticatedSession } from "@/lib/rbac"
import { normalizeSlocFields } from "@/lib/sloc"

type StockTransferTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

type TransferReceiptSyncItem = {
    productId: number
    quantity: number
}

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
    const rows = await db.query.stockTransfers.findMany({
        with: {
            fromWarehouse: true,
            toWarehouse: true,
            items: {
                with: {
                    product: true
                }
            },
            delivery: {
                with: {
                    salesOrder: {
                        with: {
                            customer: true
                        }
                    }
                }
            }
        },
        orderBy: [desc(stockTransfers.createdAt)],
    })

    return normalizeSlocFields(rows)
}

export async function createStockTransfer(data: z.infer<typeof stockTransferSchema>) {
    try {
        const parsedData = stockTransferSchema.parse(data)

        if (parsedData.sourceWarehouseId === parsedData.destinationWarehouseId) {
            return { success: false, error: "Source and destination warehouses must be different" }
        }

        const session = await getAuthenticatedSession('stock-transfers', 'create')
        const userId = session.user.id
        const referenceNumber = `ST-${Date.now()}`

        return await db.transaction(async (tx) => {
            // 1. Validate all items and their stock
            for (const item of parsedData.items) {
                const sourceStock = await tx.query.stockLevels.findFirst({
                    where: and(
                        eq(stockLevels.warehouseId, parsedData.sourceWarehouseId),
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
                fromWarehouseId: parsedData.sourceWarehouseId,
                toWarehouseId: parsedData.destinationWarehouseId,
                status: "completed",
                receivedStatus: "Received", // Manual creation defaults to Received for now, or we can make it an option
                notes: parsedData.notes,
                transferDate: parsedData.transferDate,
            }).returning()

            // 3. Process Items and Stock Movements
            for (const item of parsedData.items) {
                // Deduct from source
                const sourceStock = await tx.query.stockLevels.findFirst({
                    where: and(
                        eq(stockLevels.warehouseId, parsedData.sourceWarehouseId),
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
                await tx.insert(stockLevels).values({
                    warehouseId: data.destinationWarehouseId,
                    productId: item.productId,
                    totalStock: item.quantity,
                    minStock: 0,
                    valuationValue: '0',
                })
                    .onConflictDoUpdate({
                        target: [stockLevels.productId, stockLevels.warehouseId],
                        set: {
                            totalStock: sql`${stockLevels.totalStock} + ${item.quantity}`,
                            updatedAt: new Date(),
                        },
                    })

                // Record Source Movement (Out)
                await recordStockMovement(tx, {
                    productId: item.productId,
                    warehouseId: parsedData.sourceWarehouseId,
                    quantity: -item.quantity,
                    type: "TRANSFER_OUT",
                    referenceNumber,
                    recordedBy: userId,
                })

                // Record Destination Movement (In)
                await recordStockMovement(tx, {
                    productId: item.productId,
                    warehouseId: parsedData.destinationWarehouseId,
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

export async function syncStockTransferReceipt(
    tx: StockTransferTx,
    data: {
        transferId: number
        userId: string
        receivedItems?: TransferReceiptSyncItem[]
    }
) {
    const transfer = await tx.query.stockTransfers.findFirst({
        where: eq(stockTransfers.id, data.transferId),
        with: {
            items: true,
        },
    })

    if (!transfer) {
        throw new Error("Transfer not found")
    }

    if (transfer.receivedStatus === "Received") {
        return { success: true, alreadyReceived: true, transfer }
    }

    const isAutomated = transfer.deliveryId !== null
    const referenceNumber = transfer.referenceNumber as string
    const receivedQtyByProduct = new Map<number, number>()

    for (const item of data.receivedItems || []) {
        receivedQtyByProduct.set(
            item.productId,
            (receivedQtyByProduct.get(item.productId) || 0) + Math.max(0, item.quantity)
        )
    }

    for (const item of transfer.items) {
        const receivedQty = receivedQtyByProduct.has(item.productId)
            ? (receivedQtyByProduct.get(item.productId) || 0)
            : item.quantity

        if (receivedQty <= 0) {
            continue
        }

        if (!isAutomated) {
            const sourceStock = await tx.query.stockLevels.findFirst({
                where: and(
                    eq(stockLevels.warehouseId, transfer.fromWarehouseId),
                    eq(stockLevels.productId, item.productId)
                )
            })

            if (!sourceStock || sourceStock.totalStock < receivedQty) {
                throw new Error(`Insufficient stock for product ID ${item.productId} in source warehouse`)
            }

            await tx.update(stockLevels)
                .set({
                    totalStock: sourceStock.totalStock - receivedQty,
                    updatedAt: new Date()
                })
                .where(eq(stockLevels.id, sourceStock.id))

            await recordStockMovement(tx, {
                productId: item.productId,
                warehouseId: transfer.fromWarehouseId,
                quantity: -receivedQty,
                type: "TRANSFER_OUT",
                referenceNumber,
                recordedBy: data.userId,
                fromWarehouseId: transfer.fromWarehouseId,
                toWarehouseId: transfer.toWarehouseId,
            })
        }

        await tx.insert(stockLevels).values({
            warehouseId: transfer.toWarehouseId,
            productId: item.productId,
            totalStock: receivedQty,
            minStock: 0,
            valuationValue: '0',
        })
            .onConflictDoUpdate({
                target: [stockLevels.productId, stockLevels.warehouseId],
                set: {
                    totalStock: sql`${stockLevels.totalStock} + ${receivedQty}`,
                    updatedAt: new Date(),
                },
            })

        await recordStockMovement(tx, {
            productId: item.productId,
            warehouseId: transfer.toWarehouseId,
            quantity: receivedQty,
            type: "TRANSFER_IN",
            referenceNumber,
            recordedBy: data.userId,
            fromWarehouseId: transfer.fromWarehouseId,
            toWarehouseId: transfer.toWarehouseId,
        })
    }

    await tx.update(stockTransfers)
        .set({
            receivedStatus: "Received",
            status: "completed",
            updatedAt: new Date(),
        })
        .where(eq(stockTransfers.id, transfer.id))

    return { success: true, alreadyReceived: false, transfer }
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
    receivedStatus?: "Scheduled" | "Received" | "Rejected";
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

            const oldStatus = transfer.receivedStatus
            const newStatus = data.receivedStatus ?? oldStatus
            const shouldSyncReceipt = oldStatus !== "Received" && newStatus === "Received"

            // Safeguard: Once Received, cannot go back
            if (oldStatus === "Received" && newStatus !== "Received") {
                throw new Error("Cannot change status once Received")
            }

            // Update internal fields and status
            await tx.update(stockTransfers)
                .set({
                    ...(shouldSyncReceipt
                        ? {}
                        : {
                            receivedStatus: newStatus,
                            status: newStatus === "Received" ? "completed" : transfer.status,
                        }),
                    postingDocumentNo: data.postingDocumentNo ?? transfer.postingDocumentNo,
                    batchNo: data.batchNo ?? transfer.batchNo,
                    notes: data.notes ?? transfer.notes,
                    updatedAt: new Date(),
                })
                .where(eq(stockTransfers.id, id))

            // === RECEIVED: Transition to Received ===
            if (shouldSyncReceipt) {
                await syncStockTransferReceipt(tx, {
                    transferId: transfer.id,
                    userId,
                    receivedItems: transfer.items.map((item) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                    })),
                })
            }

            // === REJECTED: Transition to Rejected (only from Scheduled) ===
            if (oldStatus === "Scheduled" && newStatus === "Rejected") {
                const referenceNumber = transfer.referenceNumber as string
                for (const item of transfer.items) {
                    const sourceStock = await tx.query.stockLevels.findFirst({
                        where: and(
                            eq(stockLevels.warehouseId, transfer.fromWarehouseId),
                            eq(stockLevels.productId, item.productId)
                        )
                    })

                    if (sourceStock) {
                        await tx.update(stockLevels)
                            .set({
                                totalStock: sourceStock.totalStock + item.quantity,
                                updatedAt: new Date()
                            })
                            .where(eq(stockLevels.id, sourceStock.id))
                    } else {
                        await tx.insert(stockLevels).values({
                            warehouseId: transfer.fromWarehouseId,
                            productId: item.productId,
                            totalStock: item.quantity,
                            minStock: 0,
                            valuationValue: '0',
                        })
                            .onConflictDoUpdate({
                                target: [stockLevels.productId, stockLevels.warehouseId],
                                set: {
                                    totalStock: sql`${stockLevels.totalStock} + ${item.quantity}`,
                                    updatedAt: new Date(),
                                },
                            })
                    }

                    // Record ADJUSTMENT
                    await recordStockMovement(tx, {
                        productId: item.productId,
                        warehouseId: transfer.fromWarehouseId,
                        quantity: item.quantity,
                        type: "ADJUSTMENT",
                        referenceNumber,
                        recordedBy: userId,
                        fromWarehouseId: transfer.fromWarehouseId,
                        toWarehouseId: transfer.toWarehouseId,
                        notes: `Revert stok karena transfer ${referenceNumber} ditolak`,
                    })
                }
            }

            return { success: true }
        })
    } catch (error: unknown) {
        console.error("Update stock transfer error:", error)
        const message = error instanceof Error ? error.message : "Failed to update transfer"
        return { success: false, error: message }
    } finally {
        try {
            revalidatePath("/dashboard/stock-transfers")
            revalidatePath("/dashboard/inventory")
        } catch (_e) { }
    }
}


export async function updateStockTransfer(id: number, data: {
    postingDocumentNo?: string;
    batchNo?: string;
    notes?: string;
    receivedStatus?: "Scheduled" | "Received" | "Rejected";
}) {
    return await updateStockTransferStatus(id, data)
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
