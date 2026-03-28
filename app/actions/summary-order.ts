"use server"

import { db } from "@/db"
import { deliveries, salesOrders } from "@/db/schema"
import type { SummaryOrderDeliveryItem, SummaryOrderProductItem, SummaryOrderRow } from "@/lib/types"
import { getAuthenticatedSession } from "@/lib/rbac"
import { desc, inArray } from "drizzle-orm"
import { unstable_noStore as noStore } from "next/cache"
import { getBillingRecords } from "./billing"

function calculateGrandTotal(order: {
    items: Array<{
        quantity: number
        unitPrice: string
        discount: string
        tax: string
    }>
    discount: string
    shipping: string
}) {
    const subtotal = order.items.reduce((sum, item) => {
        const lineTotal = item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax)
        return sum + lineTotal
    }, 0)

    return subtotal - Number(order.discount) + Number(order.shipping)
}

function uniqueJoined(values: Array<string | null | undefined>) {
    const normalized = Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
    return normalized.length > 0 ? normalized.join(", ") : null
}

function collectUnique(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
}

function getDeliverySortTime(delivery: {
    deliveryDate: Date | null
    scheduledDate: Date | null
    createdAt: Date
}) {
    return delivery.deliveryDate?.getTime()
        ?? delivery.scheduledDate?.getTime()
        ?? delivery.createdAt.getTime()
}

export async function getSummaryOrders(): Promise<SummaryOrderRow[]> {
    noStore()
    await getAuthenticatedSession("sales-order-summary", "view")

    const [orders, billingResult] = await Promise.all([
        db.query.salesOrders.findMany({
            with: {
                customer: true,
                salesPerson: true,
                items: {
                    with: {
                        product: true,
                    },
                },
            },
            orderBy: [desc(salesOrders.createdAt)],
        }),
        getBillingRecords(),
    ])

    const orderIds = orders.map((order) => order.id)
    const relatedDeliveries = orderIds.length > 0
        ? await db.query.deliveries.findMany({
            where: inArray(deliveries.salesOrderId, orderIds),
            with: {
                items: {
                    with: {
                        product: true,
                        salesOrderItem: true,
                    },
                },
            },
            orderBy: [desc(deliveries.createdAt)],
        })
        : []

    const billingMap = new Map<string, { invoiceNos: string[]; doSaps: string[] }>()
    if (billingResult.success) {
        for (const record of billingResult.data ?? []) {
            if (!record.poNo) continue
            const existing = billingMap.get(record.poNo) ?? { invoiceNos: [], doSaps: [] }
            existing.invoiceNos = collectUnique([...existing.invoiceNos, record.noInvSap ?? null])
            existing.doSaps = collectUnique([...existing.doSaps, record.nomorDoSap ?? null])
            billingMap.set(record.poNo, existing)
        }
    }

    const deliveryMap = new Map<number, typeof relatedDeliveries>()
    for (const delivery of relatedDeliveries) {
        const current = deliveryMap.get(delivery.salesOrderId) ?? []
        current.push(delivery)
        deliveryMap.set(delivery.salesOrderId, current)
    }

    const rows: SummaryOrderRow[] = orders.map((order) => {
        const orderDeliveries = deliveryMap.get(order.id) ?? []
        const latestDelivery = [...orderDeliveries].sort((left, right) => getDeliverySortTime(right) - getDeliverySortTime(left))[0] ?? null
        const billingInfo = billingMap.get(order.customerPo ?? "")

        const details: SummaryOrderProductItem[] = order.items.map((item) => {
            const deliveredQty = orderDeliveries.reduce((sum, delivery) => {
                const matchedQty = delivery.items.reduce((deliverySum, deliveryItem) => {
                    const isMatch = deliveryItem.salesOrderItemId
                        ? deliveryItem.salesOrderItemId === item.id
                        : deliveryItem.productId === item.productId

                    return isMatch ? deliverySum + Number(deliveryItem.deliveredQuantity ?? 0) : deliverySum
                }, 0)

                return sum + matchedQty
            }, 0)

            return {
                salesOrderItemId: item.id,
                materialNumber: item.product?.materialNumber ?? null,
                materialDescription: item.product?.materialDescription ?? item.description ?? null,
                orderedQty: item.quantity ?? null,
                deliveredQty,
            }
        })

        const deliveriesSummary: SummaryOrderDeliveryItem[] = orderDeliveries.map((delivery) => ({
            deliveryId: delivery.id,
            deliveryNo: delivery.deliveryNumber ?? null,
            doSap: delivery.doSap ?? null,
            dateDelivery: delivery.deliveryDate ?? delivery.scheduledDate ?? null,
            statusDelivery: delivery.status ?? null,
            invoiceNo: delivery.invoiceNumber ?? null,
            scanDo: delivery.scanDoDocument ?? null,
            remark: delivery.remark ?? null,
        }))

        const deliveryInvoiceNo = uniqueJoined(orderDeliveries.map((delivery) => delivery.invoiceNumber))
        const billingInvoiceNo = uniqueJoined(billingInfo?.invoiceNos ?? [])
        const invoiceNo = deliveryInvoiceNo ?? billingInvoiceNo ?? null

        const deliveryDoSap = uniqueJoined(orderDeliveries.map((delivery) => delivery.doSap))
        const billingDoSap = uniqueJoined(billingInfo?.doSaps ?? [])
        const doSapSummary = deliveryDoSap ?? billingDoSap ?? null
        const latestActivityDate = latestDelivery?.deliveryDate ?? latestDelivery?.scheduledDate ?? order.poReceive ?? order.salesDate ?? null
        const totalOrderedQty = details.reduce((sum, detail) => sum + Number(detail.orderedQty ?? 0), 0)
        const totalDeliveredQty = details.reduce((sum, detail) => sum + Number(detail.deliveredQty ?? 0), 0)
        const syncSources = [
            "Sales Order",
            ...(orderDeliveries.length > 0 ? ["Delivery", "DO Monitoring"] : []),
            ...(billingInfo ? ["Billing"] : []),
        ]
        const missingSyncFields = [
            ...(!order.customerPo ? ["No. PO"] : []),
            ...(!order.customerId ? ["Customer"] : []),
            ...(orderDeliveries.length === 0 ? ["Delivery"] : []),
            ...(!invoiceNo ? ["Invoice No"] : []),
        ]
        const dataCompleteness = missingSyncFields.length === 0 ? "Lengkap" : "Perlu Review"

        return {
            rowId: `so-${order.id}`,
            salesOrderId: order.id,
            soNumber: order.invoiceNumber ?? null,
            poNo: order.customerPo ?? null,
            docPo: order.poDocument ?? null,
            datePo: order.poReceive ?? order.salesDate ?? null,
            picSales: order.salesPerson?.name ?? null,
            categoryPo: order.categoryPo ?? null,
            grandTotal: calculateGrandTotal(order),
            remark: latestDelivery?.remark ?? order.notes ?? null,
            customerName: order.customer?.name ?? null,
            latestDeliveryId: latestDelivery?.id ?? null,
            latestDeliveryNo: latestDelivery?.deliveryNumber ?? null,
            deliveryNoSummary: uniqueJoined(orderDeliveries.map((delivery) => delivery.deliveryNumber)),
            doSapSummary,
            dateDelivery: latestDelivery?.deliveryDate ?? latestDelivery?.scheduledDate ?? null,
            statusDelivery: latestDelivery?.status ?? order.status ?? null,
            invoiceNo,
            scanDo: latestDelivery?.scanDoDocument ?? null,
            latestActivityDate,
            deliveryCount: orderDeliveries.length,
            totalOrderedQty,
            totalDeliveredQty,
            syncSources,
            missingSyncFields,
            dataCompleteness,
            details,
            deliveries: deliveriesSummary,
        }
    })

    return rows.sort((left, right) => {
        const leftTime = left.latestActivityDate ? new Date(left.latestActivityDate).getTime() : 0
        const rightTime = right.latestActivityDate ? new Date(right.latestActivityDate).getTime() : 0
        return rightTime - leftTime
    })
}
