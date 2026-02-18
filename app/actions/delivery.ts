"use server"

import { db } from "@/db"
import { deliveries, deliveryItems, salesOrders, salesOrderItems, stockLevels } from "@/db/schema"
import { eq, desc, and, sql, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { deliverySchema } from "@/lib/schemas"

export async function getDeliveries() {
    return await db.query.deliveries.findMany({
        with: {
            salesOrder: {
                with: {
                    customer: true,
                },
            },
            warehouse: true,
            createdByUser: true,
            items: {
                with: {
                    product: true,
                },
            },
        },
        orderBy: [desc(deliveries.createdAt)],
    })
}

export async function getDelivery(id: number) {
    return await db.query.deliveries.findFirst({
        where: eq(deliveries.id, id),
        with: {
            salesOrder: {
                with: {
                    customer: true,
                    items: {
                        with: {
                            product: true,
                        },
                    },
                },
            },
            warehouse: true,
            items: {
                with: {
                    product: true,
                    salesOrderItem: true,
                },
            },
        },
    })
}

export async function getSalesOrdersForDelivery() {
    // Get confirmed sales orders with their items and already-delivered quantities
    const orders = await db.query.salesOrders.findMany({
        where: eq(salesOrders.status, "confirmed"),
        with: {
            customer: true,
            items: {
                with: {
                    product: true,
                },
            },
        },
        orderBy: [desc(salesOrders.createdAt)],
    })

    // For each SO, calculate already-delivered quantities
    const allDeliveryItems = await db.select({
        salesOrderItemId: deliveryItems.salesOrderItemId,
        totalDelivered: sql<number>`COALESCE(SUM(${deliveryItems.deliveredQuantity}), 0)`,
    })
        .from(deliveryItems)
        .groupBy(deliveryItems.salesOrderItemId)

    const deliveredMap = new Map<number, number>()
    for (const di of allDeliveryItems) {
        if (di.salesOrderItemId) {
            deliveredMap.set(di.salesOrderItemId, Number(di.totalDelivered))
        }
    }

    // Filter out fully delivered SOs and attach remaining qty info
    return orders.map(order => ({
        ...order,
        items: order.items.map(item => ({
            ...item,
            alreadyDelivered: deliveredMap.get(item.id) || 0,
            remainingQuantity: item.quantity - (deliveredMap.get(item.id) || 0),
        })),
    })).filter(order => order.items.some(item => item.remainingQuantity > 0))
}

export async function checkStockAvailability(warehouseId: number, items: { productId: number; quantity: number }[]) {
    const results: { productId: number; requested: number; available: number; sufficient: boolean }[] = []

    for (const item of items) {
        const stock = await db.select()
            .from(stockLevels)
            .where(and(
                eq(stockLevels.warehouseId, warehouseId),
                eq(stockLevels.productId, item.productId),
            ))
            .limit(1)

        const available = stock.length > 0 ? stock[0].totalStock : 0
        results.push({
            productId: item.productId,
            requested: item.quantity,
            available,
            sufficient: available >= item.quantity,
        })
    }

    return results
}

export async function generateDeliveryNumber() {
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`

    const allDeliveries = await db.select({ deliveryNumber: deliveries.deliveryNumber }).from(deliveries)
    const todayDeliveries = allDeliveries.filter(d => d.deliveryNumber?.startsWith(`DLV-${dateStr}`))
    const nextNum = todayDeliveries.length + 1

    return `DLV-${dateStr}-${String(nextNum).padStart(4, "0")}`
}

export async function createDelivery(data: z.infer<typeof deliverySchema>) {
    try {
        const deliveryNumber = data.deliveryNumber || await generateDeliveryNumber()

        return await db.transaction(async (tx) => {
            const [newDelivery] = await tx.insert(deliveries)
                .values({
                    deliveryNumber,
                    salesOrderId: data.salesOrderId,
                    scheduledDate: new Date(data.scheduledDate),
                    deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
                    status: data.status,
                    deliveryType: data.deliveryType,
                    // Internal Fleet
                    driverName: data.driverName || null,
                    vehicleNumber: data.vehicleNumber || null,
                    vehicleType: data.vehicleType || null,
                    // External Delivery
                    isExternal: data.isExternal || false,
                    vendorName: data.vendorName || null,
                    awbNumber: data.awbNumber || null,
                    shippingCost: data.shippingCost ? String(data.shippingCost) : "0",

                    warehouseId: data.warehouseId,
                    shippingAddress: data.shippingAddress || null,
                    notes: data.notes || null,
                })
                .returning()

            if (data.items.length > 0) {
                await tx.insert(deliveryItems)
                    .values(data.items.map(item => ({
                        deliveryId: newDelivery.id,
                        salesOrderItemId: item.salesOrderItemId || null,
                        productId: item.productId,
                        orderedQuantity: item.orderedQuantity,
                        deliveredQuantity: item.deliveredQuantity,
                        serialNumbers: item.serialNumbers || null,
                    })))

                // If status is delivered, deduct stock
                if (data.status === "delivered") {
                    for (const item of data.items) {
                        // Deduct total stock AND booked stock
                        await tx.update(stockLevels)
                            .set({
                                totalStock: sql`${stockLevels.totalStock} - ${item.deliveredQuantity}`,
                                bookedStock: sql`${stockLevels.bookedStock} - ${item.deliveredQuantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, data.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    }
                }
            }

            revalidatePath("/dashboard/deliveries")
            return { success: true, id: newDelivery.id }
        })
    } catch (error) {
        console.error("Failed to create delivery:", error)
        return { success: false, error: "Failed to create delivery" }
    }
}

export async function updateDelivery(id: number, data: z.infer<typeof deliverySchema>) {
    try {
        return await db.transaction(async (tx) => {
            const originalDelivery = await tx.query.deliveries.findFirst({
                where: eq(deliveries.id, id),
                with: { items: true },
            })

            if (!originalDelivery) {
                return { success: false, error: "Delivery not found" }
            }

            // Revert stock if it was previously delivered
            if (originalDelivery.status === "delivered" && originalDelivery.warehouseId) {
                for (const item of originalDelivery.items) {
                    await tx.update(stockLevels)
                        .set({
                            totalStock: sql`${stockLevels.totalStock} + ${item.deliveredQuantity}`,
                            bookedStock: sql`${stockLevels.bookedStock} + ${item.deliveredQuantity}`,
                            updatedAt: new Date(),
                        })
                        .where(and(
                            eq(stockLevels.warehouseId, originalDelivery.warehouseId),
                            eq(stockLevels.productId, item.productId)
                        ))
                }
            }

            await tx.update(deliveries)
                .set({
                    deliveryNumber: data.deliveryNumber || undefined,
                    salesOrderId: data.salesOrderId,
                    scheduledDate: new Date(data.scheduledDate),
                    deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
                    status: data.status,
                    deliveryType: data.deliveryType,
                    // Internal
                    driverName: data.driverName || null,
                    vehicleNumber: data.vehicleNumber || null,
                    vehicleType: data.vehicleType || null,
                    // External
                    isExternal: data.isExternal || false,
                    vendorName: data.vendorName || null,
                    awbNumber: data.awbNumber || null,
                    shippingCost: data.shippingCost ? String(data.shippingCost) : "0",

                    warehouseId: data.warehouseId,
                    shippingAddress: data.shippingAddress || null,
                    notes: data.notes || null,
                    updatedAt: new Date(),
                })
                .where(eq(deliveries.id, id))

            // Replace items
            await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, id))

            if (data.items.length > 0) {
                await tx.insert(deliveryItems)
                    .values(data.items.map(item => ({
                        deliveryId: id,
                        salesOrderItemId: item.salesOrderItemId || null,
                        productId: item.productId,
                        orderedQuantity: item.orderedQuantity,
                        deliveredQuantity: item.deliveredQuantity,
                        serialNumbers: item.serialNumbers || null,
                    })))

                // Apply new stock deduction if delivered
                if (data.status === "delivered") {
                    for (const item of data.items) {
                        await tx.update(stockLevels)
                            .set({
                                totalStock: sql`${stockLevels.totalStock} - ${item.deliveredQuantity}`,
                                bookedStock: sql`${stockLevels.bookedStock} - ${item.deliveredQuantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, data.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    }
                }
            }

            revalidatePath("/dashboard/deliveries")
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to update delivery:", error)
        return { success: false, error: "Failed to update delivery" }
    }
}

export async function deleteDelivery(id: number) {
    try {
        await db.delete(deliveries).where(eq(deliveries.id, id))
        revalidatePath("/dashboard/deliveries")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete delivery" }
    }
}

export async function bulkDeleteDeliveries(ids: number[]) {
    try {
        await db.delete(deliveries).where(inArray(deliveries.id, ids))
        revalidatePath("/dashboard/deliveries")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete deliveries" }
    }
}

export async function bulkUpdateDeliveryStatus(ids: number[], status: string) {
    try {
        await db.update(deliveries)
            .set({ status, updatedAt: new Date() })
            .where(inArray(deliveries.id, ids))
        revalidatePath("/dashboard/deliveries")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to update delivery status" }
    }
}
