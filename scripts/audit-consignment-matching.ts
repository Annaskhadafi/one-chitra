#!/usr/bin/env ts-node
/**
 * Audit untuk consignment delivery - matching tanpa DO SAP
 */

import { db } from "@/db"
import { sql } from "drizzle-orm"

const SN_LIST = [
    "ICO0586S6A",
    "ICO0593S9A",
    "IVX0010T0C",
    "IVX0029T1C",
    "IVX0016T4C",
    "IVX0006T4C",
    "FCP0342S0A",
    "FCP0422S0A",
    "FCP0104S8A",
    "FCP0380S2A",
]

async function auditConsignmentMatching() {
    console.log("=== CONSIGNMENT DELIVERY AUDIT ===\n")
    console.log("Serial Numbers:", SN_LIST)
    console.log()

    const normalizedSNs = SN_LIST.map(sn => sn.toUpperCase())

    // 1. Find deliveries with these SNs
    console.log("1. DELIVERIES WITH MATCHING SNs:")
    const deliveriesResult = await db.execute(sql`
        SELECT DISTINCT
            d.id,
            d.do_sap,
            d.delivery_number,
            d.delivery_date,
            d.scheduled_date,
            so.customer_po,
            so.invoice_number,
            c.name as customer_name,
            di.serial_numbers,
            p.material_number,
            p.material_description,
            p.category
        FROM deliveries d
        JOIN sales_orders so ON so.id = d.sales_order_id
        JOIN customers c ON c.id = so.customer_id
        JOIN delivery_items di ON di.delivery_id = d.id
        JOIN products p ON p.id = di.product_id
        WHERE EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
            WHERE UPPER(TRIM(sn)) IN (${sql.join(normalizedSNs.map(sn => sql`${sn}`), sql`, `)})
        )
        ORDER BY d.delivery_date DESC NULLS LAST
    `)

    console.log(`   Found ${deliveriesResult.rows.length} deliveries`)
    for (const row of deliveriesResult.rows as any[]) {
        console.log(`\n   Delivery: ${row.delivery_number}`)
        console.log(`   - DO SAP: ${row.do_sap || '(null)'}`)
        console.log(`   - Customer: ${row.customer_name}`)
        console.log(`   - Material: ${row.material_number} (${row.category || 'no category'})`)
        console.log(`   - Date: ${row.delivery_date || row.scheduled_date}`)
        console.log(`   - SNs: ${JSON.stringify(row.serial_numbers)}`)
    }
    console.log()

    // 2. Check sales_revenue_sap for these SNs
    console.log("2. CHECKING sales_revenue_sap FOR THESE SNs:")
    const salesBySN = await db.execute(sql`
        SELECT 
            billing_date,
            salesman,
            customer_name,
            material_no,
            material_description,
            delivery_no,
            qty,
            revenue_in_doc_curr
        FROM sales_revenue_sap
        WHERE customer_name ILIKE '%Kridatama%'
          AND material_description ILIKE '%27.00%'
        ORDER BY billing_date DESC
        LIMIT 20
    `)
    console.log(`   Found ${salesBySN.rows.length} R49 records for Cipta Kridatama`)
    console.log("   Sample:", salesBySN.rows.slice(0, 5))
    console.log()

    // 3. Check if these SNs are in cosmetic_tires
    console.log("3. CHECKING cosmetic_tires:")
    const cosmeticResult = await db.execute(sql`
        SELECT 
            id,
            serial_number,
            material_number,
            description
        FROM cosmetic_tires
        WHERE REGEXP_REPLACE(UPPER(TRIM(serial_number)), '\\s+', '', 'g') 
              IN (${sql.join(normalizedSNs.map(sn => sql`${sn}`), sql`, `)})
    `)
    console.log(`   Found ${cosmeticResult.rows.length} matching SNs in cosmetic_tires`)
    console.log("   Records:", cosmeticResult.rows)
    console.log()

    // 4. Check if category is TYRE
    console.log("4. CATEGORY CHECK:")
    for (const row of deliveriesResult.rows as any[]) {
        const categoryCheck = await db.execute(sql`
            SELECT category FROM products 
            WHERE material_number = ${row.material_number}
            LIMIT 1
        `)
        console.log(`   ${row.material_number}: ${categoryCheck.rows[0]?.category || 'NOT FOUND'}`)
    }
    console.log()

    // 5. Summary
    console.log("5. SUMMARY:")
    console.log(`   - SNs in deliveries: ${deliveriesResult.rows.length > 0 ? 'YES' : 'NO'}`)
    console.log(`   - SNs in cosmetic_tires: ${cosmeticResult.rows.length} of ${SN_LIST.length}`)
    console.log(`   - Customer match: PT Cipta Kridatama = ${salesBySN.rows.length > 0 ? 'FOUND' : 'NOT FOUND'}`)
    
    const missingSNs = SN_LIST.filter(sn => 
        !(cosmeticResult.rows as any[]).some((r: any) => 
            r.serial_number?.toUpperCase().replace(/\s+/g, '') === sn.toUpperCase()
        )
    )
    
    if (missingSNs.length > 0) {
        console.log(`\n   ⚠️  SNs NOT in cosmetic_tires (${missingSNs.length}):`)
        for (const sn of missingSNs) {
            console.log(`      - ${sn}`)
        }
        console.log("\n   🔧 ACTION NEEDED: Import these SNs to cosmetic_tires table")
    }

    console.log("\n=== AUDIT COMPLETE ===")
}

auditConsignmentMatching()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Audit failed:", err)
        process.exit(1)
    })
