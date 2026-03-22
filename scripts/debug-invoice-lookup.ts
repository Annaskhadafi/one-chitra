/**
 * Debug script: cek kenapa invoice lookup tidak menemukan data
 * Run: npx tsx scripts/debug-invoice-lookup.ts
 */

import { db } from "../db"
import { historyOrders, billingRecords, salesOrders, deliveries, customers } from "../db/schema"
import { eq, and, isNotNull, ne, sql } from "drizzle-orm"

const TEST_PO = "1011860660"

async function main() {
    console.log("=== DEBUG: Invoice Lookup ===\n")

    // 1. Cek raw data di historyOrders untuk PO ini
    console.log(`[1] Raw query historyOrders untuk PO: ${TEST_PO}`)
    const raw = await db
        .select({
            poNo: historyOrders.poNo,
            billingNo: historyOrders.billingNo,
            billingDate: historyOrders.billingDate,
            customerName: historyOrders.customerName,
            customer: historyOrders.customer,
            cancelled: historyOrders.cancelled,
        })
        .from(historyOrders)
        .where(eq(historyOrders.poNo, TEST_PO))
        .limit(5)

    if (raw.length === 0) {
        console.log("  ❌ Tidak ada data di historyOrders untuk PO ini!")
    } else {
        console.log(`  ✅ Ditemukan ${raw.length} row(s):`)
        raw.forEach((r, i) => {
            console.log(`  Row ${i + 1}: billingNo=${r.billingNo}, billingDate=${r.billingDate}, customer=${r.customerName}, cancelled=${r.cancelled}`)
        })
    }

    // 2. Cek dengan filter billing filled
    console.log(`\n[2] Query dengan filter billingNo & billingDate not null/empty:`)
    const filtered = await db
        .select({
            poNo: historyOrders.poNo,
            billingNo: historyOrders.billingNo,
            billingDate: historyOrders.billingDate,
            customerName: historyOrders.customerName,
            cancelled: historyOrders.cancelled,
        })
        .from(historyOrders)
        .where(
            and(
                eq(historyOrders.poNo, TEST_PO),
                isNotNull(historyOrders.billingDate),
                ne(historyOrders.billingDate, ''),
                isNotNull(historyOrders.billingNo),
                ne(historyOrders.billingNo, ''),
            )
        )
        .limit(5)

    if (filtered.length === 0) {
        console.log("  ❌ Tidak ada data setelah filter billingNo & billingDate")
    } else {
        console.log(`  ✅ Ditemukan ${filtered.length} row(s):`)
        filtered.forEach((r, i) => {
            console.log(`  Row ${i + 1}: billingNo=${r.billingNo}, billingDate=${r.billingDate}, customerName=${r.customerName}, cancelled=${r.cancelled}`)
        })
    }

    // 3. Cek dengan cancelled filter
    console.log(`\n[3] Query dengan tambahan cancelled filter:`)
    const withCancelled = await db
        .select({
            poNo: historyOrders.poNo,
            billingNo: historyOrders.billingNo,
            billingDate: historyOrders.billingDate,
            customerName: historyOrders.customerName,
            cancelled: historyOrders.cancelled,
        })
        .from(historyOrders)
        .where(
            and(
                eq(historyOrders.poNo, TEST_PO),
                isNotNull(historyOrders.billingDate),
                ne(historyOrders.billingDate, ''),
                isNotNull(historyOrders.billingNo),
                ne(historyOrders.billingNo, ''),
                sql`(${historyOrders.cancelled} IS NULL OR ${historyOrders.cancelled} != 'X')`,
            )
        )
        .limit(5)

    if (withCancelled.length === 0) {
        console.log("  ❌ Tidak ada data setelah cancelled filter — kemungkinan semua row ter-cancel!")
    } else {
        console.log(`  ✅ Ditemukan ${withCancelled.length} row(s):`)
        withCancelled.forEach((r, i) => {
            console.log(`  Row ${i + 1}: billingNo=${r.billingNo}, cancelled=${r.cancelled}`)
        })
    }

    // 4. Cek data deliveries dengan PO ini
    console.log(`\n[4] Cek deliveries yang punya SO dengan customerPo = ${TEST_PO}:`)
    const deliveriesWithPo = await db
        .select({
            deliveryId: deliveries.id,
            deliveryNumber: deliveries.deliveryNumber,
            customerPo: salesOrders.customerPo,
            customerName: customers.name,
            currentInvoiceNumber: deliveries.invoiceNumber,
        })
        .from(deliveries)
        .innerJoin(salesOrders, eq(deliveries.salesOrderId, salesOrders.id))
        .leftJoin(customers, eq(salesOrders.customerId, customers.id))
        .where(eq(salesOrders.customerPo, TEST_PO))

    if (deliveriesWithPo.length === 0) {
        console.log("  ❌ Tidak ada delivery dengan PO ini")
    } else {
        console.log(`  ✅ Ditemukan ${deliveriesWithPo.length} delivery:`)
        deliveriesWithPo.forEach((d, i) => {
            console.log(`  Delivery ${i + 1}: ${d.deliveryNumber}, Customer: ${d.customerName}, InvoiceNo saat ini: ${d.currentInvoiceNumber}`)
        })
    }

    // 5. Cek billing_records table
    console.log(`\n[5] Cek billing_records untuk PO ini:`)
    const br = await db.query.billingRecords.findFirst({
        where: eq(billingRecords.poNo, TEST_PO),
        columns: { poNo: true, noInvSap: true, dateInvoice: true, customer: true }
    })
    if (!br) {
        console.log("  ℹ️  Tidak ada row di billing_records untuk PO ini (data hanya di historyOrders/SAP)")
    } else {
        console.log(`  ✅ billing_records: noInvSap=${br.noInvSap}, customer=${br.customer}`)
    }

    console.log("\n=== SELESAI ===")
    process.exit(0)
}

main().catch(e => {
    console.error("Error:", e)
    process.exit(1)
})
