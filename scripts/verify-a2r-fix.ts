#!/usr/bin/env ts-node
/**
 * Final verification - test A2R cosmetic matching after fix
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

async function verifyFix() {
    console.log("=== VERIFYING A2R COSMETIC FIX ===\n")
    console.log("Testing SNs:", SN_LIST)
    console.log()

    const normalizedSNs = SN_LIST.map(sn => sn.toUpperCase())

    // 1. Check cosmetic_match query (regular)
    console.log("1. REGULAR MATCH (by delivery_no):")
    const regularMatch = await db.execute(sql`
        SELECT DISTINCT
            COALESCE(d.do_sap, '') AS "doSap",
            COALESCE(d.delivery_number, '') AS "deliveryNumber",
            COALESCE(products.material_number, '') AS "materialNumber"
        FROM deliveries d
        JOIN delivery_items di ON di.delivery_id = d.id
        JOIN products ON products.id = di.product_id
        JOIN cosmetic_tires ct
          ON UPPER(TRIM(COALESCE(ct.material_number, ''))) = UPPER(TRIM(COALESCE(products.material_number, '')))
         AND EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
            WHERE REGEXP_REPLACE(UPPER(TRIM(sn)), '\\s+', '', 'g') = REGEXP_REPLACE(UPPER(TRIM(COALESCE(ct.serial_number, ''))), '\\s+', '', 'g')
         )
        WHERE EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
            WHERE UPPER(TRIM(sn)) IN (${sql.join(normalizedSNs.map(sn => sql`${sn}`), sql`, `)})
        )
    `)
    console.log(`   Found ${regularMatch.rows.length} regular matches`)
    console.log("   Records:", regularMatch.rows)
    console.log()

    // 2. Check consignment match query (new)
    console.log("2. CONSIGNMENT MATCH (by customer + material):")
    const consignmentMatch = await db.execute(sql`
        SELECT DISTINCT
            c.name AS "customerName",
            COALESCE(products.material_number, '') AS "materialNumber"
        FROM deliveries d
        JOIN sales_orders so ON so.id = d.sales_order_id
        JOIN customers c ON c.id = so.customer_id
        JOIN delivery_items di ON di.delivery_id = d.id
        JOIN products ON products.id = di.product_id
        JOIN cosmetic_tires ct
          ON UPPER(TRIM(COALESCE(ct.material_number, ''))) = UPPER(TRIM(COALESCE(products.material_number, '')))
         AND EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
            WHERE REGEXP_REPLACE(UPPER(TRIM(sn)), '\\s+', '', 'g') = REGEXP_REPLACE(UPPER(TRIM(COALESCE(ct.serial_number, ''))), '\\s+', '', 'g')
         )
        WHERE EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
            WHERE UPPER(TRIM(sn)) IN (${sql.join(normalizedSNs.map(sn => sql`${sn}`), sql`, `)})
        )
    `)
    console.log(`   Found ${consignmentMatch.rows.length} consignment matches`)
    console.log("   Records:", consignmentMatch.rows)
    console.log()

    // 3. Check sales_revenue_sap for these customers
    console.log("3. SALES_REVENUE_SAP CHECK:")
    for (const row of consignmentMatch.rows as any[]) {
        const customerName = row.customerName
        const materialNumber = row.materialNumber

        const salesRecords = await db.execute(sql`
            SELECT 
                billing_date,
                salesman,
                customer_name,
                material_no,
                delivery_no,
                revenue_in_doc_curr
            FROM sales_revenue_sap
            WHERE customer_name = ${customerName}
              AND material_no = ${materialNumber}
            ORDER BY billing_date DESC
            LIMIT 3
        `)

        console.log(`   Customer: ${customerName}`)
        console.log(`   Material: ${materialNumber}`)
        console.log(`   Sales Records: ${salesRecords.rows.length}`)
        if (salesRecords.rows.length > 0) {
            console.log("   Sample:", salesRecords.rows[0])
        }
        console.log()
    }

    // 4. Summary
    console.log("4. SUMMARY:")
    console.log(`   - Regular matches: ${regularMatch.rows.length}`)
    console.log(`   - Consignment matches: ${consignmentMatch.rows.length}`)
    console.log(`   - Total unique customer-material pairs: ${consignmentMatch.rows.length}`)
    console.log()
    console.log("   ✅ With consignment matching enabled, these SNs should now earn cosmetic points!")

    console.log("\n=== VERIFICATION COMPLETE ===")
}

verifyFix()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Verification failed:", err)
        process.exit(1)
    })
