"use server"

import { db } from "@/db"
import { salesOrders, salesOrderItems, stockLevels, customers, user, products } from "@/db/schema"
import { eq, desc, inArray, sql, and, isNotNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { salesOrderSchema } from "@/lib/schemas"

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
        const invoiceNumber = data.invoiceNumber || await generateInvoiceNumber()

        // Start transaction
        return await db.transaction(async (tx) => {
            const [newOrder] = await tx.insert(salesOrders)
                .values({
                    invoiceNumber,
                    customerPo: data.customerPo || null,
                    customerId: data.customerId,
                    warehouseId: data.warehouseId,
                    salesDate: new Date(data.salesDate),
                    poReceive: data.poReceive ? new Date(data.poReceive) : null,
                    categoryPo: data.categoryPo || null,
                    categoryProduct: data.categoryProduct || null,
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

            revalidatePath("/dashboard/sales-orders")
            return { success: true, id: newOrder.id }
        })
    } catch (error) {
        console.error("Failed to create sales order:", error)
        return { success: false, error: "Failed to create sales order" }
    }
}

export async function updateSalesOrder(id: number, data: z.infer<typeof salesOrderSchema>) {
    try {
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
        await db.delete(salesOrders).where(eq(salesOrders.id, id))
        revalidatePath("/dashboard/sales-orders")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete sales order" }
    }
}

export async function bulkDeleteSalesOrders(ids: number[]) {
    try {
        await db.delete(salesOrders).where(inArray(salesOrders.id, ids))
        revalidatePath("/dashboard/sales-orders")
        return { success: true }
    } catch (_error) {
        console.error("Bulk delete SO error:", _error)
        return { success: false, error: "Failed to delete sales orders" }
    }
}

export async function bulkUpdateSalesOrderStatus(ids: number[], status: string) {
    try {
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
