#!/usr/bin/env ts-node
/**
 * Cek deliveries dengan SN spesifik dan DO SAP mereka
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

async function checkSpecificDeliveries() {
    console.log("=== CHECKING SPECIFIC DELIVERIES WITH SN ===\n")

    const normalizedSNs = SN_LIST.map(sn => sn.toUpperCase())

    // Find deliveries with these SNs
    const deliveriesResult = await db.execute(sql`
        SELECT DISTINCT
            d.id,
            d.do_sap,
            d.delivery_number,
            d.delivery_date,
            so.customer_po,
            so.invoice_number,
            c.name as customer_name,
            di.serial_numbers,
            p.material_number,
            p.material_description
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
        ORDER BY d.delivery_date DESC
    `)

    console.log(`Found ${deliveriesResult.rows.length} deliveries with matching SNs:`)
    console.log()

    for (const row of deliveriesResult.rows as any[]) {
        console.log("Delivery:", row.delivery_number)
        console.log("  DO SAP:", row.do_sap)
        console.log("  Customer:", row.customer_name)
        console.log("  Material:", row.material_number)
        console.log("  SNs:", row.serial_numbers)
        console.log()

        // Check if this DO SAP exists in sales_revenue_sap
        if (row.do_sap) {
            const salesCheck = await db.execute(sql`
                SELECT 
                    billing_date,
                    salesman,
                    customer_name,
                    delivery_no,
                    material_no,
                    revenue_in_doc_curr
                FROM sales_revenue_sap
                WHERE delivery_no = ${row.do_sap}
                   OR delivery_no = ${row.delivery_number}
                LIMIT 5
            `)
            
            if (salesCheck.rows.length > 0) {
                console.log("  ✓ FOUND in sales_revenue_sap:")
                console.log("   ", salesCheck.rows)
            } else {
                console.log("  ✗ NOT FOUND in sales_revenue_sap")
                
                // Try to find by customer and material
                const fuzzyCheck = await db.execute(sql`
                    SELECT 
                        billing_date,
                        salesman,
                        customer_name,
                        delivery_no,
                        material_no,
                        revenue_in_doc_curr
                    FROM sales_revenue_sap
                    WHERE customer_name ILIKE '%Kridatama%'
                      AND material_no = ${row.material_number}
                    ORDER BY billing_date DESC
                    LIMIT 5
                `)
                
                if (fuzzyCheck.rows.length > 0) {
                    console.log("  ~ Similar records found:")
                    console.log("   ", fuzzyCheck.rows)
                }
            }
        }
        console.log("---")
    }

    console.log("\n=== AUDIT COMPLETE ===")
}

checkSpecificDeliveries()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Audit failed:", err)
        process.exit(1)
    })
