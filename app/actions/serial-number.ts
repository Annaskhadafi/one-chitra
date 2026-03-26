"use server"

import { db } from "@/db"
import { deliveries, deliveryItems, products, salesOrders } from "@/db/schema"
import { evhsVouchers, evhsVoucherItems, evhsReceipts, evhsReceiptItems } from "@/db/schema"
import { eq } from "drizzle-orm"

export type SerialNumberEntry = {
    serialNumber: string
    productId: number | null
    productName: string
    materialNumber: string
    source: "delivery" | "evhs-receipt" | "evhs-voucher"
    sourceRecordId: number
    documentNo: string
    documentDate: string | null
    customerOrSite: string
}

export async function getSerialNumberHistory(): Promise<SerialNumberEntry[]> {
    const results: SerialNumberEntry[] = []

    // 1. From Delivery Items
    const deliveryRows = await db
        .select({
            deliveryId: deliveries.id,
            deliveryNumber: deliveries.deliveryNumber,
            deliveryDate: deliveries.deliveryDate,
            scheduledDate: deliveries.scheduledDate,
            serialNumbers: deliveryItems.serialNumbers,
            productId: deliveryItems.productId,
            materialNumber: products.materialNumber,
            materialDescription: products.materialDescription,
            salesOrderReference: salesOrders.customerPo,
            salesOrderInvoiceNumber: salesOrders.invoiceNumber,
        })
        .from(deliveryItems)
        .innerJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
        .innerJoin(products, eq(deliveryItems.productId, products.id))
        .leftJoin(salesOrders, eq(deliveries.salesOrderId, salesOrders.id))

    for (const row of deliveryRows) {
        if (!row.serialNumbers || row.serialNumbers.length === 0) continue
        const date = row.deliveryDate ?? row.scheduledDate
        for (const sn of row.serialNumbers) {
            if (!sn) continue
            results.push({
                serialNumber: sn,
                productId: row.productId,
                productName: row.materialDescription || row.materialNumber || "-",
                materialNumber: row.materialNumber || "-",
                source: "delivery",
                sourceRecordId: row.deliveryId,
                documentNo: row.deliveryNumber || "-",
                documentDate: date ? new Date(date).toISOString().split("T")[0] : null,
                customerOrSite: row.salesOrderReference || row.salesOrderInvoiceNumber || "-",
            })
        }
    }

    // 2. From EVHS Receipt Items
    const receiptRows = await db
        .select({
            receiptId: evhsReceipts.id,
            doChitraNo: evhsReceipts.doChitraNo,
            receivedDate: evhsReceipts.receivedDate,
            serialNumbers: evhsReceiptItems.serialNumbers,
            productId: evhsReceiptItems.productId,
            materialNumber: products.materialNumber,
            materialDescription: products.materialDescription,
        })
        .from(evhsReceiptItems)
        .innerJoin(evhsReceipts, eq(evhsReceiptItems.receiptId, evhsReceipts.id))
        .innerJoin(products, eq(evhsReceiptItems.productId, products.id))

    for (const row of receiptRows) {
        if (!row.serialNumbers || row.serialNumbers.length === 0) continue
        for (const sn of row.serialNumbers) {
            if (!sn) continue
            results.push({
                serialNumber: sn,
                productId: row.productId,
                productName: row.materialDescription || row.materialNumber || "-",
                materialNumber: row.materialNumber || "-",
                source: "evhs-receipt",
                sourceRecordId: row.receiptId,
                documentNo: row.doChitraNo || "-",
                documentDate: row.receivedDate
                    ? new Date(row.receivedDate).toISOString().split("T")[0]
                    : null,
                customerOrSite: "-",
            })
        }
    }

    // 3. From EVHS Voucher Items
    const voucherRows = await db
        .select({
            voucherId: evhsVouchers.id,
            vhsNo: evhsVouchers.vhsNo,
            date: evhsVouchers.date,
            woNo: evhsVouchers.woNo,
            serialNumber: evhsVoucherItems.serialNumber,
            productId: evhsVoucherItems.productId,
            materialNumber: products.materialNumber,
            materialDescription: products.materialDescription,
        })
        .from(evhsVoucherItems)
        .innerJoin(evhsVouchers, eq(evhsVoucherItems.voucherId, evhsVouchers.id))
        .innerJoin(products, eq(evhsVoucherItems.productId, products.id))

    for (const row of voucherRows) {
        if (!row.serialNumber) continue
        results.push({
            serialNumber: row.serialNumber,
            productId: row.productId,
            productName: row.materialDescription || row.materialNumber || "-",
            materialNumber: row.materialNumber || "-",
            source: "evhs-voucher",
            sourceRecordId: row.voucherId,
            documentNo: row.vhsNo || "-",
            documentDate: row.date || null,
            customerOrSite: row.woNo || "-",
        })
    }

    // Sort by date descending
    results.sort((a, b) => {
        if (!a.documentDate && !b.documentDate) return 0
        if (!a.documentDate) return 1
        if (!b.documentDate) return -1
        return b.documentDate.localeCompare(a.documentDate)
    })

    return results
}
