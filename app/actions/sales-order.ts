"use server"

import { db } from "@/db"
import { salesOrders, salesOrderItems } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { salesOrderSchema } from "@/lib/schemas"

export async function getSalesOrders() {
    return await db.query.salesOrders.findMany({
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

        const [newOrder] = await db.insert(salesOrders)
            .values({
                invoiceNumber,
                customerPo: data.customerPo || null,
                customerId: data.customerId,
                salesDate: new Date(data.salesDate),
                status: data.status,
                termsConditions: data.termsConditions || null,
                notes: data.notes || null,
                discount: data.discount.toString(),
                shipping: data.shipping.toString(),
            })
            .returning()

        if (data.items.length > 0) {
            await db.insert(salesOrderItems)
                .values(data.items.map(item => ({
                    salesOrderId: newOrder.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice.toString(),
                    discount: item.discount.toString(),
                    tax: item.tax.toString(),
                })))
        }

        revalidatePath("/dashboard/sales-orders")
        return { success: true, id: newOrder.id }
    } catch (error) {
        console.error("Failed to create sales order:", error)
        return { success: false, error: "Failed to create sales order" }
    }
}

export async function updateSalesOrder(id: number, data: z.infer<typeof salesOrderSchema>) {
    try {
        await db.update(salesOrders)
            .set({
                invoiceNumber: data.invoiceNumber || undefined,
                customerPo: data.customerPo || null,
                customerId: data.customerId,
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
        await db.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, id))

        if (data.items.length > 0) {
            await db.insert(salesOrderItems)
                .values(data.items.map(item => ({
                    salesOrderId: id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice.toString(),
                    discount: item.discount.toString(),
                    tax: item.tax.toString(),
                })))
        }

        revalidatePath("/dashboard/sales-orders")
        return { success: true }
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
