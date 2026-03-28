import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { deliveries, deliveryItems, salesOrders } from "@/db/schema"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"
import { sendSystemTemplatedEmailByCode } from "@/lib/email"
import { formatWarehouseLabel } from "@/lib/sloc"

type DeliveryNotificationResult = {
    success: boolean
    skipped?: boolean
    reason?: string
    error?: string
}

type SalesOrderNotificationOrder = {
    id: number
    invoiceNumber: string | null
    customerPo: string | null
    salesDate: Date
    status: string
    createdByUser: {
        name: string
    } | null
    warehouse: {
        sloc: string | null
        description: string | null
    } | null
    customer: {
        name: string | null
    } | null
    salesPerson: {
        name: string
        email: string
    } | null
}

type DeliveryNotificationOrderItem = {
    id: number
    productId: number | null
    quantity: number
}

type DeliveryNotificationDelivery = {
    id: number
    salesOrderId: number
    deliveryNumber: string | null
    status: string
    deliveryType: string
    doSap: string | null
    driverName: string | null
    vehicleNumber: string | null
    vendorName: string | null
    shippingAddress: string | null
    notes: string | null
    scheduledDate: Date
    deliveryDate: Date | null
    createdAt: Date
    updatedAt: Date
    createdByUser: {
        name: string
    } | null
    warehouse: {
        sloc: string | null
        description: string | null
    } | null
    warehouseTo: {
        sloc: string | null
        description: string | null
    } | null
    salesOrder: {
        invoiceNumber: string | null
        customerPo: string | null
        customer: {
            name: string | null
        } | null
        salesPerson: {
            name: string
            email: string
        } | null
        items: DeliveryNotificationOrderItem[]
    } | null
    items: Array<{
        productId: number
        salesOrderItemId: number | null
        orderedQuantity: number
        deliveredQuantity: number
        serialNumbers: string[] | null
        product: {
            materialNumber: string | null
            materialDescription: string | null
        } | null
        salesOrderItem: DeliveryNotificationOrderItem | null
    }>
}

type DeliveryItemSummary = {
    materialNumber: string
    materialDescription: string
    orderedQuantity: number
    deliveredQuantity: number
    totalDeliveredQuantity: number
    remainingQuantity: number
    serialNumbers: string[]
}

function escapeHtml(value: string | null | undefined) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function formatDate(value: Date | string | null | undefined) {
    if (!value) return "-"

    const parsed = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(parsed.getTime())) return "-"

    return parsed.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}

function formatQuantity(value: number) {
    return new Intl.NumberFormat("id-ID").format(value)
}

function normalizeText(value: string | null | undefined, fallback = "-") {
    const normalized = value?.trim()
    return normalized ? normalized : fallback
}

function toTitleCase(value: string | null | undefined) {
    const normalized = value?.trim()
    if (!normalized) return "-"

    return normalized
        .replace(/[_-]/g, " ")
        .replace(/\s+/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")
}

function resolveOrderItem(
    deliveryItem: {
        productId: number
        salesOrderItemId: number | null
        salesOrderItem: DeliveryNotificationOrderItem | null
    },
    salesOrderItems: DeliveryNotificationOrderItem[],
) {
    if (deliveryItem.salesOrderItem) {
        return deliveryItem.salesOrderItem
    }

    if (deliveryItem.salesOrderItemId) {
        const matchedById = salesOrderItems.find((item) => item.id === deliveryItem.salesOrderItemId)
        if (matchedById) return matchedById
    }

    const matchedByProduct = salesOrderItems.filter((item) => item.productId === deliveryItem.productId)
    return matchedByProduct.length === 1 ? matchedByProduct[0] : null
}

function buildItemSummaries(
    delivery: DeliveryNotificationDelivery,
    deliveredQuantityMap: Map<number, number>,
) {
    const salesOrderItems = delivery.salesOrder?.items ?? []

    return delivery.items.map<DeliveryItemSummary>((item) => {
        const orderItem = resolveOrderItem(item, salesOrderItems)
        const orderedQuantity = orderItem?.quantity ?? item.orderedQuantity ?? 0
        const totalDeliveredQuantity = orderItem?.id
            ? deliveredQuantityMap.get(orderItem.id) ?? item.deliveredQuantity
            : item.deliveredQuantity

        return {
            materialNumber: normalizeText(item.product?.materialNumber),
            materialDescription: normalizeText(item.product?.materialDescription),
            orderedQuantity,
            deliveredQuantity: item.deliveredQuantity,
            totalDeliveredQuantity,
            remainingQuantity: Math.max(orderedQuantity - totalDeliveredQuantity, 0),
            serialNumbers: item.serialNumbers ?? [],
        }
    })
}

function buildDeliveryItemRows(items: DeliveryItemSummary[]) {
    const itemsTableRows = items.length > 0
        ? items.map((item, index) => {
            const serialNumberText = item.serialNumbers.length > 0
                ? escapeHtml(item.serialNumbers.join(", "))
                : "-"

            return `
                <tr>
                    <td style="padding:10px;border:1px solid #d1d5db;text-align:center;">${index + 1}</td>
                    <td style="padding:10px;border:1px solid #d1d5db;">${escapeHtml(item.materialNumber)}</td>
                    <td style="padding:10px;border:1px solid #d1d5db;">${escapeHtml(item.materialDescription)}</td>
                    <td style="padding:10px;border:1px solid #d1d5db;text-align:right;">${formatQuantity(item.orderedQuantity)}</td>
                    <td style="padding:10px;border:1px solid #d1d5db;text-align:right;">${formatQuantity(item.deliveredQuantity)}</td>
                    <td style="padding:10px;border:1px solid #d1d5db;text-align:right;">${formatQuantity(item.totalDeliveredQuantity)}</td>
                    <td style="padding:10px;border:1px solid #d1d5db;text-align:right;">${formatQuantity(item.remainingQuantity)}</td>
                    <td style="padding:10px;border:1px solid #d1d5db;">${serialNumberText}</td>
                </tr>
            `
        }).join("")
        : `
            <tr>
                <td colspan="8" style="padding:12px;border:1px solid #d1d5db;text-align:center;">Tidak ada item delivery.</td>
            </tr>
        `

    const itemsTextRows = items.length > 0
        ? items.map((item, index) => {
            const serialLine = item.serialNumbers.length > 0
                ? ` | Serial: ${item.serialNumbers.join(", ")}`
                : ""

            return `${index + 1}. ${item.materialNumber} - ${item.materialDescription}
   Qty SO: ${formatQuantity(item.orderedQuantity)}
   Qty Delivery Ini: ${formatQuantity(item.deliveredQuantity)}
   Qty Delivered s/d Saat Ini: ${formatQuantity(item.totalDeliveredQuantity)}
   Sisa SO: ${formatQuantity(item.remainingQuantity)}${serialLine}`
        }).join("\n")
        : "Tidak ada item delivery."

    return { itemsTableRows, itemsTextRows }
}

export async function sendDeliveryDeliveredNotification(deliveryId: number): Promise<DeliveryNotificationResult> {
    const delivery = await db.query.deliveries.findFirst({
        where: eq(deliveries.id, deliveryId),
        with: {
            salesOrder: {
                with: {
                    customer: true,
                    salesPerson: true,
                    items: true,
                },
            },
            warehouse: true,
            warehouseTo: true,
            items: {
                with: {
                    product: true,
                    salesOrderItem: true,
                },
            },
        },
    }) as DeliveryNotificationDelivery | undefined

    if (!delivery) {
        return { success: false, skipped: true, reason: "Delivery not found" }
    }

    const salesPic = delivery.salesOrder?.salesPerson
    const salesPicEmail = salesPic?.email?.trim()
    if (!salesPicEmail) {
        return { success: false, skipped: true, reason: "Sales PIC email not found" }
    }

    const deliveredRows = await db.select({
        salesOrderItemId: deliveryItems.salesOrderItemId,
        totalDeliveredQuantity: sql<number>`COALESCE(SUM(${deliveryItems.deliveredQuantity}), 0)`,
    })
        .from(deliveryItems)
        .innerJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
        .where(and(
            eq(deliveries.salesOrderId, delivery.salesOrderId),
            eq(deliveries.status, "delivered"),
        ))
        .groupBy(deliveryItems.salesOrderItemId)

    const deliveredQuantityMap = new Map<number, number>()
    for (const row of deliveredRows) {
        if (row.salesOrderItemId) {
            deliveredQuantityMap.set(row.salesOrderItemId, Number(row.totalDeliveredQuantity))
        }
    }

    const items = buildItemSummaries(delivery, deliveredQuantityMap)
    const isPartialDelivery = delivery.deliveryType === "partial" || items.some((item) => item.remainingQuantity > 0)
    const { itemsTableRows, itemsTextRows } = buildDeliveryItemRows(items)
    const partialNoticeHtml = isPartialDelivery
        ? `<div style="margin:0 0 20px;padding:12px 16px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;color:#9a3412;">
                Pengiriman ini bersifat parsial. Kolom <strong>Qty Delivered s/d Saat Ini</strong> dan <strong>Sisa SO</strong>
                membantu memantau progres pengiriman terhadap Sales Order.
           </div>`
        : ""
    const partialNoticeText = isPartialDelivery
        ? "Catatan: Pengiriman ini bersifat parsial."
        : ""

    const result = await sendSystemTemplatedEmailByCode({
        code: SYSTEM_EMAIL_TEMPLATE_CODES.deliveryDeliveredSalesPic,
        to: salesPicEmail,
        data: {
            salesPicName: normalizeText(salesPic?.name, "Sales PIC"),
            deliveryNumber: normalizeText(delivery.deliveryNumber, `Delivery #${delivery.id}`),
            deliveryTypeLabel: isPartialDelivery ? "Parsial" : "Full",
            deliveryDate: formatDate(delivery.deliveryDate ?? delivery.updatedAt ?? delivery.createdAt),
            scheduledDate: formatDate(delivery.scheduledDate),
            salesOrderNumber: normalizeText(delivery.salesOrder?.invoiceNumber, `SO #${delivery.salesOrderId}`),
            customerPo: normalizeText(delivery.salesOrder?.customerPo),
            customerName: normalizeText(delivery.salesOrder?.customer?.name),
            warehouseName: formatWarehouseLabel(delivery.warehouse),
            destinationWarehouseName: formatWarehouseLabel(delivery.warehouseTo),
            driverName: normalizeText(delivery.driverName),
            vehicleNumber: normalizeText(delivery.vehicleNumber),
            vendorName: normalizeText(delivery.vendorName),
            doSap: normalizeText(delivery.doSap),
            shippingAddress: normalizeText(delivery.shippingAddress),
            notes: normalizeText(delivery.notes),
            partialNoticeHtml,
            partialNoticeText,
            itemsTableRows,
            itemsTextRows,
        },
    })

    if (!result.success) {
        return {
            success: false,
            error: result.error ?? "Failed to send delivery notification email",
        }
    }

    return { success: true }
}

export async function sendSalesOrderCreatedNotification(salesOrderId: number): Promise<DeliveryNotificationResult> {
    const order = await db.query.salesOrders.findFirst({
        where: eq(salesOrders.id, salesOrderId),
        with: {
            customer: true,
            warehouse: true,
            createdByUser: true,
            salesPerson: true,
        },
    }) as SalesOrderNotificationOrder | undefined

    if (!order) {
        return { success: false, skipped: true, reason: "Sales order not found" }
    }

    const salesPic = order.salesPerson
    const salesPicEmail = salesPic?.email?.trim()
    if (!salesPicEmail) {
        return { success: false, skipped: true, reason: "Sales PIC email not found" }
    }

    const result = await sendSystemTemplatedEmailByCode({
        code: SYSTEM_EMAIL_TEMPLATE_CODES.salesOrderCreatedSalesPic,
        to: salesPicEmail,
        data: {
            salesPicName: normalizeText(salesPic?.name, "Sales PIC"),
            salesOrderNumber: normalizeText(order.invoiceNumber, `SO #${order.id}`),
            customerPo: normalizeText(order.customerPo),
            customerName: normalizeText(order.customer?.name),
            salesDate: formatDate(order.salesDate),
            statusLabel: toTitleCase(order.status),
            warehouseName: formatWarehouseLabel(order.warehouse),
            createdByName: normalizeText(order.createdByUser?.name, "System"),
            actionUrl: `/dashboard/sales-orders/${order.id}`,
        },
    })

    if (!result.success) {
        return {
            success: false,
            error: result.error ?? "Failed to send sales order notification email",
        }
    }

    return { success: true }
}

export async function sendDeliveryCreatedNotification(deliveryId: number): Promise<DeliveryNotificationResult> {
    const delivery = await db.query.deliveries.findFirst({
        where: eq(deliveries.id, deliveryId),
        with: {
            warehouse: true,
            createdByUser: true,
            salesOrder: {
                with: {
                    customer: true,
                    salesPerson: true,
                },
            },
        },
    }) as DeliveryNotificationDelivery | undefined

    if (!delivery) {
        return { success: false, skipped: true, reason: "Delivery not found" }
    }

    const salesPic = delivery.salesOrder?.salesPerson
    const salesPicEmail = salesPic?.email?.trim()
    if (!salesPicEmail) {
        return { success: false, skipped: true, reason: "Sales PIC email not found" }
    }

    const result = await sendSystemTemplatedEmailByCode({
        code: SYSTEM_EMAIL_TEMPLATE_CODES.deliveryCreatedSalesPic,
        to: salesPicEmail,
        data: {
            salesPicName: normalizeText(salesPic?.name, "Sales PIC"),
            deliveryNumber: normalizeText(delivery.deliveryNumber, `Delivery #${delivery.id}`),
            salesOrderNumber: normalizeText(delivery.salesOrder?.invoiceNumber, `SO #${delivery.salesOrderId}`),
            customerPo: normalizeText(delivery.salesOrder?.customerPo),
            customerName: normalizeText(delivery.salesOrder?.customer?.name),
            scheduledDate: formatDate(delivery.scheduledDate),
            deliveryTypeLabel: toTitleCase(delivery.deliveryType),
            statusLabel: toTitleCase(delivery.status),
            warehouseName: formatWarehouseLabel(delivery.warehouse),
            shippingAddress: normalizeText(delivery.shippingAddress),
            createdByName: normalizeText(delivery.createdByUser?.name, "System"),
            actionUrl: `/dashboard/deliveries/${delivery.id}`,
        },
    })

    if (!result.success) {
        return {
            success: false,
            error: result.error ?? "Failed to send delivery created notification email",
        }
    }

    return { success: true }
}
