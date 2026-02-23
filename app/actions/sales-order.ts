"use server"

import { db } from "@/db"
import { salesOrders, salesOrderItems, stockLevels, customers, user, products, deliveries, deliveryItems, stockTransfers, stockTransferItems } from "@/db/schema"
import { eq, desc, inArray, sql, and, isNotNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { salesOrderSchema } from "@/lib/schemas"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { checkPermission, getAuthenticatedSession } from "@/lib/rbac"
import { deleteFile } from "./upload"

export async function getSalesOrders() {
    // Fetch orders with customer and createdByUser first
    const orders = await db.query.salesOrders.findMany({
        with: {
            customer: true,
            createdByUser: true,
        },
        orderBy: [desc(salesOrders.createdAt)],
    })

    // Fetch items with products separately to avoid nested lateral join issues
    const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
            const items = await db.query.salesOrderItems.findMany({
                where: eq(salesOrderItems.salesOrderId, order.id),
                with: {
                    product: true,
                },
            })
            return { ...order, items }
        })
    )

    return ordersWithItems
}

export async function getSalesOrderCategories() {
    const categories = await db
        .selectDistinct({ category: salesOrders.categoryProduct })
        .from(salesOrders)
        .where(isNotNull(salesOrders.categoryProduct))
        .orderBy(salesOrders.categoryProduct)

    return categories.map(c => c.category).filter(Boolean) as string[]
}


export async function getSalesOrder(id: number) {
    // Fetch order with customer first
    const order = await db.query.salesOrders.findFirst({
        where: eq(salesOrders.id, id),
        with: {
            customer: true,
        },
    })

    if (!order) return undefined

    // Fetch items with products separately
    const items = await db.query.salesOrderItems.findMany({
        where: eq(salesOrderItems.salesOrderId, id),
        with: {
            product: true,
        },
    })

    return { ...order, items }
}

export async function generateInvoiceNumber() {
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`



    // Count today's orders
    const allOrders = await db.select({ invoiceNumber: salesOrders.invoiceNumber }).from(salesOrders)
    const todayOrders = allOrders.filter(o => o.invoiceNumber?.startsWith(`SO-${dateStr}`))
    const nextNum = todayOrders.length + 1

    return `SO-${dateStr}-${String(nextNum).padStart(4, "0")}`
}

export async function createSalesOrder(data: z.infer<typeof salesOrderSchema>) {
    try {
        const session = await getAuthenticatedSession('sales-orders', 'create')
        const userId = session.user.id
        const invoiceNumber = data.invoiceNumber || await generateInvoiceNumber()

        // Start transaction
        return await db.transaction(async (tx) => {
            const [newOrder] = await tx.insert(salesOrders)
                .values({
                    invoiceNumber,
                    customerPo: data.customerPo || null,
                    createdBy: userId,
                    customerId: data.customerId,
                    warehouseId: data.warehouseId,
                    salesDate: new Date(data.salesDate),
                    poReceive: data.poReceive ? new Date(data.poReceive) : null,
                    categoryPo: data.categoryPo || null,
                    categoryProduct: data.categoryProduct || null,
                    poDocument: data.poDocument || null,
                    status: data.status,
                    termsConditions: data.termsConditions || null,
                    notes: data.notes || null,
                    discount: data.discount.toString(),
                    shipping: data.shipping.toString(),
                })
                .returning()

            if (data.items.length > 0) {
                await tx.insert(salesOrderItems)
                    .values(data.items.map(item => ({
                        salesOrderId: newOrder.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toString(),
                        discount: item.discount.toString(),
                        tax: item.tax.toString(),
                    })))

                // Book stock if warehouse is selected
                if (data.warehouseId) {
                    for (const item of data.items) {
                        await tx.insert(stockLevels)
                            .values({
                                warehouseId: data.warehouseId,
                                productId: item.productId,
                                bookedStock: item.quantity,
                                totalStock: 0,
                                minStock: 0,
                            })
                            .onConflictDoUpdate({
                                target: [stockLevels.warehouseId, stockLevels.productId],
                                set: {
                                    bookedStock: sql`${stockLevels.bookedStock} + ${item.quantity}`,
                                    updatedAt: new Date(),
                                },
                            })
                    }
                }
            }

            // Automation for VHS/Consignment
            if (data.categoryPo === "VHS/Consignment" && data.warehouseId) {
                const mainWarehouseId = 4 // Central Warehouse (Jakarta)

                // 1. Create Delivery record (Scheduled)
                const deliveryNumber = `DN-AUTO-${Date.now()}`
                const [delivery] = await tx.insert(deliveries).values({
                    deliveryNumber,
                    salesOrderId: newOrder.id,
                    warehouseId: data.warehouseId,
                    warehouseToId: data.warehouseId, // Same for consignment
                    scheduledDate: new Date(data.salesDate),
                    status: "scheduled",
                    deliveryType: "full",
                    isExternal: false,
                    notes: `Automatic delivery for Consignment SO: ${invoiceNumber}`,
                }).returning()

                // 2. Create Stock Transfer from MAIN to Consignment Warehouse
                const transferRef = `ST-AUTO-${Date.now()}`
                const [transfer] = await tx.insert(stockTransfers).values({
                    referenceNumber: transferRef,
                    deliveryId: delivery.id,
                    fromWarehouseId: mainWarehouseId,
                    toWarehouseId: data.warehouseId,
                    status: "completed",
                    receivedStatus: "Received",
                    notes: `Automatic transfer for Consignment SO: ${invoiceNumber}`,
                    transferDate: new Date(),
                }).returning()

                if (data.items.length > 0) {
                    // Item records for Transfer and Delivery
                    await tx.insert(stockTransferItems).values(data.items.map(item => ({
                        transferId: transfer.id,
                        productId: item.productId,
                        quantity: item.quantity,
                    })))

                    await tx.insert(deliveryItems).values(data.items.map(item => ({
                        deliveryId: delivery.id,
                        productId: item.productId,
                        orderedQuantity: item.quantity,
                        deliveredQuantity: item.quantity,
                    })))

                    // Stock Movement: Deduct from MAIN, Add to Consignment
                    for (const item of data.items) {
                        // Deduct from MAIN
                        await tx.insert(stockLevels)
                            .values({
                                warehouseId: mainWarehouseId,
                                productId: item.productId,
                                totalStock: 0,
                                bookedStock: 0,
                                minStock: 0,
                            })
                            .onConflictDoUpdate({
                                target: [stockLevels.warehouseId, stockLevels.productId],
                                set: {
                                    totalStock: sql`${stockLevels.totalStock} - ${item.quantity}`,
                                    updatedAt: new Date(),
                                },
                            })

                        // Add to Consignment (if not already handled by the "Book Stock" logic above)
                        // Note: the "Book Stock" logic above already ensures a record exists for data.warehouseId
                        await tx.update(stockLevels)
                            .set({
                                totalStock: sql`${stockLevels.totalStock} + ${item.quantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, data.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    }
                }
            }

            revalidatePath("/dashboard/sales-orders")
            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/stock-transfers")
            return { success: true, id: newOrder.id }
        })
    } catch (error) {
        console.error("Failed to create sales order:", error)
        return { success: false, error: "Failed to create sales order" }
    }
}

export async function updateSalesOrder(id: number, data: z.infer<typeof salesOrderSchema>) {
    try {
        await checkPermission('sales-orders', 'edit')
        return await db.transaction(async (tx) => {
            // Get original order to see if items changed
            const originalOrder = await tx.query.salesOrders.findFirst({
                where: eq(salesOrders.id, id),
                with: { items: true },
            })

            if (!originalOrder) {
                return { success: false, error: "Order not found" }
            }

            // Revert original booked stock if it had a warehouse
            if (originalOrder.warehouseId) {
                for (const item of originalOrder.items) {
                    await tx.update(stockLevels)
                        .set({
                            bookedStock: sql`${stockLevels.bookedStock} - ${item.quantity}`,
                            updatedAt: new Date(),
                        })
                        .where(and(
                            eq(stockLevels.warehouseId, originalOrder.warehouseId),
                            eq(stockLevels.productId, item.productId)
                        ))
                }
            }

            await tx.update(salesOrders)
                .set({
                    invoiceNumber: data.invoiceNumber || undefined,
                    customerPo: data.customerPo || null,
                    customerId: data.customerId,
                    warehouseId: data.warehouseId,
                    salesDate: new Date(data.salesDate),
                    poReceive: data.poReceive ? new Date(data.poReceive) : null,
                    categoryPo: data.categoryPo || null,
                    categoryProduct: data.categoryProduct || null,
                    poDocument: data.poDocument || null,
                    status: data.status,
                    termsConditions: data.termsConditions || null,
                    notes: data.notes || null,
                    discount: data.discount.toString(),
                    shipping: data.shipping.toString(),
                    updatedAt: new Date(),
                })
                .where(eq(salesOrders.id, id))

            // Handle items: Update, Insert, Delete
            const existingItems = originalOrder.items
            const existingItemIds = existingItems.map(i => i.id)
            const payloadItemIds = data.items.map(i => i.id).filter(Boolean) as number[]

            const itemsToDelete = existingItemIds.filter(id => !payloadItemIds.includes(id))
            const itemsToInsert = data.items.filter(i => !i.id)
            const itemsToUpdate = data.items.filter(i => i.id)

            // Delete removed items
            if (itemsToDelete.length > 0) {
                await tx.delete(salesOrderItems).where(inArray(salesOrderItems.id, itemsToDelete))
            }

            // Update existing items
            for (const item of itemsToUpdate) {
                await tx.update(salesOrderItems)
                    .set({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toString(),
                        discount: item.discount.toString(),
                        tax: item.tax.toString(),
                    })
                    .where(eq(salesOrderItems.id, item.id!))
            }

            // Insert new items
            if (itemsToInsert.length > 0) {
                await tx.insert(salesOrderItems)
                    .values(itemsToInsert.map(item => ({
                        salesOrderId: id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toString(),
                        discount: item.discount.toString(),
                        tax: item.tax.toString(),
                    })))
            }

            // Apply new booked stock if warehouse is selected
            if (data.warehouseId) {
                for (const item of data.items) {
                    await tx.insert(stockLevels)
                        .values({
                            warehouseId: data.warehouseId,
                            productId: item.productId,
                            bookedStock: item.quantity,
                            totalStock: 0,
                            minStock: 0,
                        })
                        .onConflictDoUpdate({
                            target: [stockLevels.warehouseId, stockLevels.productId],
                            set: {
                                bookedStock: sql`${stockLevels.bookedStock} + ${item.quantity}`,
                                updatedAt: new Date(),
                            },
                        })
                }
            }

            revalidatePath("/dashboard/sales-orders")
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to update sales order:", error)
        return { success: false, error: "Failed to update sales order" }
    }
}

export async function deleteSalesOrder(id: number) {
    try {
        await checkPermission('sales-orders', 'delete')

        // Fetch order to check for assets
        const order = await db.query.salesOrders.findFirst({
            where: eq(salesOrders.id, id),
            with: { items: true }
        })

        if (!order) return { success: false, error: "Sales Order not found" }

        // Start transaction
        return await db.transaction(async (tx) => {
            // 1. Revert booked stock for SO items
            if (order.warehouseId) {
                for (const item of order.items) {
                    await tx.update(stockLevels)
                        .set({
                            bookedStock: sql`${stockLevels.bookedStock} - ${item.quantity}`,
                            updatedAt: new Date(),
                        })
                        .where(and(
                            eq(stockLevels.warehouseId, order.warehouseId),
                            eq(stockLevels.productId, item.productId)
                        ))
                }
            }

            // 2. Handle related deliveries and their stock
            const relatedDeliveries = await tx.query.deliveries.findMany({
                where: eq(deliveries.salesOrderId, id),
                with: { items: true }
            })

            for (const delivery of relatedDeliveries) {
                const wasCommitted = delivery.status !== "cancelled"
                if (wasCommitted && delivery.warehouseId) {
                    for (const dItem of delivery.items) {
                        await tx.update(stockLevels)
                            .set({
                                totalStock: sql`${stockLevels.totalStock} + ${dItem.deliveredQuantity}`,
                                bookedStock: sql`${stockLevels.bookedStock} + ${dItem.deliveredQuantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, delivery.warehouseId),
                                eq(stockLevels.productId, dItem.productId)
                            ))
                    }
                }
                // Delete delivery items (cascaded by DB but safe to be explicit if needed, 
                // though insert/delete in tx is fine)
                await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, delivery.id))
                await tx.delete(deliveries).where(eq(deliveries.id, delivery.id))
            }

            // Permanent deletion of assets
            if (order.poDocument) {
                await deleteFile(order.poDocument)
            }

            // Permanent deletion of items
            await tx.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, id))
            // Permanent deletion of the record
            await tx.delete(salesOrders).where(eq(salesOrders.id, id))

            revalidatePath("/dashboard/sales-orders")
            revalidatePath("/dashboard/deliveries")
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to delete sales order:", error)
        return { success: false, error: "Failed to delete sales order" }
    }
}

export async function bulkDeleteSalesOrders(ids: number[]) {
    try {
        await checkPermission('sales-orders', 'delete')

        // For asset deletion and stock reversion, we need to know what we are deleting
        const orders = await db.query.salesOrders.findMany({
            where: inArray(salesOrders.id, ids),
            with: { items: true }
        })

        return await db.transaction(async (tx) => {
            for (const order of orders) {
                // 1. Revert booked stock for SO items
                if (order.warehouseId) {
                    for (const item of order.items) {
                        await tx.update(stockLevels)
                            .set({
                                bookedStock: sql`${stockLevels.bookedStock} - ${item.quantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, order.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    }
                }

                // 2. Handle related deliveries
                const relatedDeliveries = await tx.query.deliveries.findMany({
                    where: eq(deliveries.salesOrderId, order.id),
                    with: { items: true }
                })

                for (const delivery of relatedDeliveries) {
                    const wasCommitted = delivery.status !== "cancelled"
                    if (wasCommitted && delivery.warehouseId) {
                        for (const dItem of delivery.items) {
                            await tx.update(stockLevels)
                                .set({
                                    totalStock: sql`${stockLevels.totalStock} + ${dItem.deliveredQuantity}`,
                                    bookedStock: sql`${stockLevels.bookedStock} + ${dItem.deliveredQuantity}`,
                                    updatedAt: new Date(),
                                })
                                .where(and(
                                    eq(stockLevels.warehouseId, delivery.warehouseId),
                                    eq(stockLevels.productId, dItem.productId)
                                ))
                        }
                    }
                    await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, delivery.id))
                    await tx.delete(deliveries).where(eq(deliveries.id, delivery.id))
                }

                // Delete files
                if (order.poDocument) {
                    await deleteFile(order.poDocument)
                }
            }

            await tx.delete(salesOrderItems).where(inArray(salesOrderItems.salesOrderId, ids))
            await tx.delete(salesOrders).where(inArray(salesOrders.id, ids))

            revalidatePath("/dashboard/sales-orders")
            revalidatePath("/dashboard/deliveries")
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to bulk delete sales orders:", error)
        return { success: false, error: "Failed to bulk delete sales orders" }
    }
}

export async function bulkUpdateSalesOrderStatus(ids: number[], status: string) {
    try {
        await checkPermission('sales-orders', 'edit')
        await db.update(salesOrders)
            .set({ status, updatedAt: new Date() })
            .where(inArray(salesOrders.id, ids))
        revalidatePath("/dashboard/sales-orders")
        return { success: true }
    } catch (_error) {
        console.error("Bulk update SO status error:", _error)
        return { success: false, error: "Failed to update sales order status" }
    }
}
