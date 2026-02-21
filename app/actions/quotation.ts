"use server"

import { db } from "@/db"
import { quotations, quotationItems, salesOrders, salesOrderItems } from "@/db/schema"
import { eq, desc, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { quotationSchema } from "@/lib/schemas"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function getQuotations() {
    return await db.query.quotations.findMany({
        with: {
            customer: true,
            salesPerson: true,
            createdByUser: true,
            items: {
                with: {
                    product: true,
                },
            },
        },
        orderBy: [desc(quotations.createdAt)],
    })
}

export async function getQuotation(id: number) {
    return await db.query.quotations.findFirst({
        where: eq(quotations.id, id),
        with: {
            customer: true,
            salesPerson: true,
            items: {
                with: {
                    product: true,
                },
            },
        },
    })
}

export async function generateQuotationNumber() {
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`

    const allQuotations = await db.select({ quotationNumber: quotations.quotationNumber }).from(quotations)
    const todayQuotations = allQuotations.filter(q => q.quotationNumber?.startsWith(`QT-${dateStr}`))
    const nextNum = todayQuotations.length + 1

    return `QT-${dateStr}-${String(nextNum).padStart(4, "0")}`
}

export async function createQuotation(data: z.infer<typeof quotationSchema>) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })
        const userId = session?.user?.id || "system"
        const quotationNumber = data.quotationNumber || await generateQuotationNumber()

        return await db.transaction(async (tx) => {
            const [newQuotation] = await tx.insert(quotations)
                .values({
                    quotationNumber,
                    customerId: data.customerId,
                    quotationDate: new Date(data.quotationDate),
                    validUntil: data.validUntil ? new Date(data.validUntil) : null,
                    subject: data.subject || null,
                    salesPersonId: data.salesPersonId || null,
                    attn: data.attn || null,
                    createdBy: userId,
                    status: data.status,
                    paymentTerms: data.paymentTerms || null,
                    termsConditions: data.termsConditions || null,
                    notes: data.notes || null,
                    discount: data.discount.toString(),
                    tax: data.tax.toString(),
                    shipping: data.shipping.toString(),
                })
                .returning()

            if (data.items.length > 0) {
                await tx.insert(quotationItems)
                    .values(data.items.map(item => ({
                        quotationId: newQuotation.id,
                        productId: item.productId,
                        description: item.description || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toString(),
                        discount: item.discount.toString(),
                        tax: item.tax.toString(),
                    })))
            }

            revalidatePath("/dashboard/quotations")
            return { success: true, id: newQuotation.id }
        })
    } catch (error) {
        console.error("Failed to create quotation:", error)
        return { success: false, error: "Failed to create quotation" }
    }
}

export async function updateQuotation(id: number, data: z.infer<typeof quotationSchema>) {
    try {
        return await db.transaction(async (tx) => {
            const originalQuotation = await tx.query.quotations.findFirst({
                where: eq(quotations.id, id),
            })

            if (!originalQuotation) {
                return { success: false, error: "Quotation not found" }
            }

            await tx.update(quotations)
                .set({
                    quotationNumber: data.quotationNumber || undefined,
                    customerId: data.customerId,
                    quotationDate: new Date(data.quotationDate),
                    validUntil: data.validUntil ? new Date(data.validUntil) : null,
                    subject: data.subject || null,
                    salesPersonId: data.salesPersonId || null,
                    attn: data.attn || null,
                    status: data.status,
                    paymentTerms: data.paymentTerms || null,
                    termsConditions: data.termsConditions || null,
                    notes: data.notes || null,
                    discount: data.discount.toString(),
                    tax: data.tax.toString(),
                    shipping: data.shipping.toString(),
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, id))

            // Replace items: delete all existing, insert new
            await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id))

            if (data.items.length > 0) {
                await tx.insert(quotationItems)
                    .values(data.items.map(item => ({
                        quotationId: id,
                        productId: item.productId,
                        description: item.description || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toString(),
                        discount: item.discount.toString(),
                        tax: item.tax.toString(),
                    })))
            }

            revalidatePath("/dashboard/quotations")
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to update quotation:", error)
        return { success: false, error: "Failed to update quotation" }
    }
}

export async function deleteQuotation(id: number) {
    try {
        await db.delete(quotations).where(eq(quotations.id, id))
        revalidatePath("/dashboard/quotations")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete quotation" }
    }
}

export async function bulkDeleteQuotations(ids: number[]) {
    try {
        await db.delete(quotations).where(inArray(quotations.id, ids))
        revalidatePath("/dashboard/quotations")
        return { success: true }
    } catch (_error) {
        console.error("Bulk delete quotation error:", _error)
        return { success: false, error: "Failed to delete quotations" }
    }
}

export async function approveQuotation(id: number) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        await db.update(quotations)
            .set({
                status: "approved",
                approvedAt: new Date(),
                approvedBy: session?.user?.id || null,
                updatedAt: new Date(),
            })
            .where(eq(quotations.id, id))

        revalidatePath("/dashboard/quotations")
        revalidatePath(`/dashboard/quotations/${id}`)
        return { success: true }
    } catch (error) {
        console.error("Failed to approve quotation:", error)
        return { success: false, error: "Failed to approve quotation" }
    }
}

export async function rejectQuotation(id: number, reason: string) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        await db.update(quotations)
            .set({
                status: "rejected",
                rejectedAt: new Date(),
                rejectedBy: session?.user?.id || null,
                rejectionReason: reason,
                updatedAt: new Date(),
            })
            .where(eq(quotations.id, id))

        revalidatePath("/dashboard/quotations")
        revalidatePath(`/dashboard/quotations/${id}`)
        return { success: true }
    } catch (error) {
        console.error("Failed to reject quotation:", error)
        return { success: false, error: "Failed to reject quotation" }
    }
}

export async function convertToSalesOrder(id: number) {
    try {
        return await db.transaction(async (tx) => {
            const quotation = await tx.query.quotations.findFirst({
                where: eq(quotations.id, id),
                with: {
                    customer: true,
                    items: {
                        with: { product: true },
                    },
                },
            })

            if (!quotation) {
                return { success: false, error: "Quotation not found" }
            }

            if (quotation.status === "converted") {
                return { success: false, error: "Quotation has already been converted" }
            }

            // Generate SO invoice number
            const now = new Date()
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
            const allOrders = await tx.select({ invoiceNumber: salesOrders.invoiceNumber }).from(salesOrders)
            const todayOrders = allOrders.filter(o => o.invoiceNumber?.startsWith(`SO-${dateStr}`))
            const nextNum = todayOrders.length + 1
            const invoiceNumber = `SO-${dateStr}-${String(nextNum).padStart(4, "0")}`

            // Create Sales Order
            const [newSO] = await tx.insert(salesOrders)
                .values({
                    invoiceNumber,
                    customerId: quotation.customerId,
                    salesDate: new Date(),
                    status: "draft",
                    termsConditions: quotation.termsConditions,
                    notes: quotation.notes ? `Converted from ${quotation.quotationNumber}. ${quotation.notes}` : `Converted from ${quotation.quotationNumber}`,
                    discount: quotation.discount,
                    shipping: quotation.shipping,
                })
                .returning()

            // Create SO items from quotation items
            if (quotation.items.length > 0) {
                await tx.insert(salesOrderItems)
                    .values(quotation.items.map(item => ({
                        salesOrderId: newSO.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount,
                        tax: item.tax,
                    })))
            }

            // Update quotation status
            await tx.update(quotations)
                .set({
                    status: "converted",
                    salesOrderId: newSO.id,
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, id))

            revalidatePath("/dashboard/quotations")
            revalidatePath("/dashboard/sales-orders")
            return { success: true, salesOrderId: newSO.id }
        })
    } catch (error) {
        console.error("Failed to convert quotation to SO:", error)
        return { success: false, error: "Failed to convert quotation to Sales Order" }
    }
}

export async function duplicateQuotation(id: number) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })
        const userId = session?.user?.id || "system"

        return await db.transaction(async (tx) => {
            const originalQuotation = await tx.query.quotations.findFirst({
                where: eq(quotations.id, id),
                with: {
                    items: true,
                },
            })

            if (!originalQuotation) {
                return { success: false, error: "Original quotation not found" }
            }

            const quotationNumber = await generateQuotationNumber()

            const [newQuotation] = await tx.insert(quotations)
                .values({
                    quotationNumber,
                    customerId: originalQuotation.customerId,
                    quotationDate: new Date(),
                    validUntil: originalQuotation.validUntil,
                    subject: originalQuotation.subject ? `${originalQuotation.subject} (Copy)` : "Copy",
                    salesPersonId: originalQuotation.salesPersonId,
                    attn: originalQuotation.attn,
                    createdBy: userId,
                    status: "draft",
                    paymentTerms: originalQuotation.paymentTerms,
                    termsConditions: originalQuotation.termsConditions,
                    notes: originalQuotation.notes ? `Duplicated from ${originalQuotation.quotationNumber}. ${originalQuotation.notes}` : `Duplicated from ${originalQuotation.quotationNumber}`,
                    discount: originalQuotation.discount,
                    tax: originalQuotation.tax,
                    shipping: originalQuotation.shipping,
                })
                .returning()

            if (originalQuotation.items.length > 0) {
                await tx.insert(quotationItems)
                    .values(originalQuotation.items.map(item => ({
                        quotationId: newQuotation.id,
                        productId: item.productId,
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount,
                        tax: item.tax,
                    })))
            }

            revalidatePath("/dashboard/quotations")
            return { success: true, id: newQuotation.id }
        })
    } catch (error) {
        console.error("Failed to duplicate quotation:", error)
        return { success: false, error: "Failed to duplicate quotation" }
    }
}
