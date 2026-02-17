"use server"

import { db } from "@/db"
import { salesOrders, salesOrderItems, stockLevels } from "@/db/schema"
import { eq, desc, inArray, sql, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { salesOrderSchema } from "@/lib/schemas"

export async function getSalesOrders() {
    return await db.query.salesOrders.findMany({
        with: {
            customer: true,
            createdByUser: true,
            items: {
                with: {
                    product: true,
                },
            },
        },
        orderBy: [desc(salesOrders.createdAt)],
    })
}

export async function getSalesOrder(id: number) {
    return await db.query.salesOrders.findFirst({
        where: eq(salesOrders.id, id),
        with: {
            customer: true,
            items: {
                with: {
                    product: true,
                },
            },
        },
    })
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
                    status: data.status,
                    termsConditions: data.termsConditions || null,
                    notes: data.notes || null,
                    discount: data.discount.toString(),
                    shipping: data.shipping.toString(),
                    updatedAt: new Date(),
                })
                .where(eq(salesOrders.id, id))

            // Replace items: delete all existing, insert new
            await tx.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, id))

            if (data.items.length > 0) {
                await tx.insert(salesOrderItems)
                    .values(data.items.map(item => ({
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
