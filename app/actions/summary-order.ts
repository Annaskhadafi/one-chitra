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

export async function getSummaryOrders(): Promise<SummaryOrderRow[]> {
    noStore()
    await getAuthenticatedSession("sales-orders", "view")

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

    const billingMap = new Map<string, { invoiceNo: string | null; doSap: string | null }>()
    if (billingResult.success) {
        for (const record of billingResult.data ?? []) {
            if (!record.poNo) continue
            billingMap.set(record.poNo, {
                invoiceNo: record.noInvSap ?? null,
                doSap: record.nomorDoSap ?? null,
            })
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
        const latestDelivery = orderDeliveries[0] ?? null
        const billingInfo = billingMap.get(order.customerPo ?? "")

        const details: SummaryOrderProductItem[] = order.items.map((item) => {
            const deliveredQty = orderDeliveries.reduce((sum, delivery) => {
                const matchedItem = delivery.items.find((deliveryItem) => {
                    if (deliveryItem.salesOrderItemId) {
                        return deliveryItem.salesOrderItemId === item.id
                    }
                    return deliveryItem.productId === item.productId
                })

                return sum + Number(matchedItem?.deliveredQuantity ?? 0)
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

        const invoiceNo = uniqueJoined(orderDeliveries.map((delivery) => delivery.invoiceNumber)) ?? billingInfo?.invoiceNo ?? null
        const doSapSummary = uniqueJoined(orderDeliveries.map((delivery) => delivery.doSap)) ?? billingInfo?.doSap ?? null
        const latestActivityDate = latestDelivery?.deliveryDate ?? latestDelivery?.scheduledDate ?? order.poReceive ?? order.salesDate ?? null

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
