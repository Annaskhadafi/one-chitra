/**
 * SIMULASI PENUH: batchSyncInvoiceFromBilling
 * Menjalankan SEMUA langkah logika sync tanpa permission check
 * Run: npx tsx scripts/simulate-invoice-sync.ts
 */

import { db } from "../db"
import { salesRevenueSap as historyOrders, billingRecords, salesOrders, deliveries, customers } from "../db/schema"
import { eq, and, isNotNull, ne, sql } from "drizzle-orm"

// ---- Replika getInvoiceInfoByPoNo ----
async function getInvoiceInfoByPoNo(poNo: string, customerName?: string | null) {
    if (!poNo) return { success: false, error: "PO Number is required" }

    // Priority 1: billing_records
    const billingRecord = await db.query.billingRecords.findFirst({
        where: eq(billingRecords.poNo, poNo),
        columns: { noInvSap: true, dateInvoice: true, customer: true }
    })

    console.log(`    [P1] billing_records: noInvSap="${billingRecord?.noInvSap}", customer="${billingRecord?.customer}"`)

    if (billingRecord?.noInvSap) {
        const customerMatch = !customerName ||
            !billingRecord.customer ||
            billingRecord.customer.toLowerCase().includes(customerName.toLowerCase().substring(0, 10)) ||
            customerName.toLowerCase().includes((billingRecord.customer || '').toLowerCase().substring(0, 10))

        console.log(`    [P1] customerMatch=${customerMatch}`)

        if (customerMatch) {
            return { success: true, data: { noInvSap: billingRecord.noInvSap, dateInvoice: billingRecord.dateInvoice } }
        }
    }

    // Priority 2: historyOrders - Menggunakan raw sql untuk keamanan
    const query = sql`
        SELECT 
            MAX(billing_no) as "noInvSap",
            MAX(to_date(NULLIF(billing_date, ''), 'MM/DD/YYYY')) as "dateInvoice"
        FROM sales_revenue_sap
        WHERE po_no = ${poNo}
        AND billing_date IS NOT NULL AND billing_date != ''
        AND billing_no IS NOT NULL AND billing_no != ''
        AND (cancelled IS NULL OR cancelled != 'X')
    `;

    const historyResult: any = await db.execute(query);
    const row = historyResult.rows?.[0] || historyResult[0];

    console.log(`    [P2] historyOrders result: noInvSap="${row?.noInvSap}", dateInvoice="${row?.dateInvoice}"`)

    if (row && row.noInvSap) {
        return {
            success: true,
            data: {
                noInvSap: row.noInvSap,
                dateInvoice: row.dateInvoice ? new Date(row.dateInvoice) : null
            }
        }
    }

    return { success: true, data: { noInvSap: null, dateInvoice: null } }
}

// ---- Replika batchSyncInvoiceFromBilling ----
async function simulateBatchSync(dryRun = true) {
    console.log(`\n=== SIMULASI batchSyncInvoiceFromBilling (dryRun=${dryRun}) ===\n`)

    const deliveriesWithPo = await db
        .select({
            id: deliveries.id,
            deliveryNumber: deliveries.deliveryNumber,
            customerPo: salesOrders.customerPo,
            customerName: customers.name,
        })
        .from(deliveries)
        .innerJoin(salesOrders, eq(deliveries.salesOrderId, salesOrders.id))
        .leftJoin(customers, eq(salesOrders.customerId, customers.id))
        .where(isNotNull(salesOrders.customerPo))

    console.log(`Total deliveries dengan PO: ${deliveriesWithPo.length}`)

    let updated = 0
    let notFound = 0

    for (const delivery of deliveriesWithPo) {
        console.log(`\n--- Delivery: ${delivery.deliveryNumber} | PO: ${delivery.customerPo} | Customer: ${delivery.customerName} ---`)

        const invoiceInfo = await getInvoiceInfoByPoNo(delivery.customerPo!, delivery.customerName)

        if (!invoiceInfo.success || !invoiceInfo.data?.noInvSap) {
            console.log(`  ❌ Tidak ada match invoice ditemukan`)
            notFound++
            continue
        }

        console.log(`  ✅ Match: noInvSap="${invoiceInfo.data.noInvSap}", dateInvoice="${invoiceInfo.data.dateInvoice}"`)

        if (!dryRun) {
            await db.update(deliveries)
                .set({
                    invoiceNumber: invoiceInfo.data.noInvSap,
                    invoiceDate: invoiceInfo.data.dateInvoice,
                    updatedAt: new Date(),
                })
                .where(eq(deliveries.id, delivery.id))
            console.log(`  💾 Updated di database!`)
        } else {
            console.log(`  🔵 DRY RUN - tidak update database`)
        }

        updated++
    }

    console.log(`\n=== HASIL: updated=${updated}, notFound=${notFound}, total=${deliveriesWithPo.length} ===`)
}

async function main() {
    await simulateBatchSync(false)
    process.exit(0)
}

main().catch(e => {
    console.error("Error:", e)
    process.exit(1)
})
