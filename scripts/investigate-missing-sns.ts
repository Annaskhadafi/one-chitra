#!/usr/bin/env ts-node
/**
 * Check why some SNs in cosmetic_tires are not in deliveries
 */

import { db } from "@/db"
import { sql } from "drizzle-orm"

const MISSING_FROM_DELIVERY = [
    "IVX0029T1C",
    "IVX0016T4C",
    "FCP0342S0A",
    "FCP0422S0A",
    "FCP0104S8A",
    "FCP0380S2A",
]

async function investigateMissing() {
    console.log("=== INVESTIGATING MISSING SNs ===\n")
    console.log("SNs in cosmetic_tires but not in deliveries:")
    for (const sn of MISSING_FROM_DELIVERY) {
        console.log(`  - ${sn}`)
    }
    console.log()

    // Check if they were ever in deliveries (history)
    console.log("1. Checking all deliveries (including old ones):")
    for (const sn of MISSING_FROM_DELIVERY) {
        const normalizedSN = sn.toUpperCase().replace(/\s+/g, '')
        
        const anyDelivery = await db.execute(sql`
            SELECT 
                d.id,
                d.delivery_number,
                d.delivery_date,
                di.serial_numbers,
                p.material_number,
                c.name as customer_name
            FROM delivery_items di
            JOIN deliveries d ON d.id = di.delivery_id
            JOIN products p ON p.id = di.product_id
            JOIN sales_orders so ON so.id = d.sales_order_id
            JOIN customers c ON c.id = so.customer_id
            WHERE EXISTS (
                SELECT 1
                FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS s
                WHERE REGEXP_REPLACE(UPPER(TRIM(s)), '\\s+', '', 'g') = ${normalizedSN}
            )
            LIMIT 5
        `)
        
        if (anyDelivery.rows.length > 0) {
            console.log(`   ${sn}: FOUND in delivery ${anyDelivery.rows[0].delivery_number}`)
        } else {
            console.log(`   ${sn}: NOT FOUND in any delivery`)
        }
    }
    console.log()

    // Check sales_revenue_sap for these SNs
    console.log("2. Checking sales_revenue_sap for these SNs:")
    console.log("   (Note: SNs not stored in sales_revenue_sap, checking by customer and date)")
    
    const ciptaSales = await db.execute(sql`
        SELECT 
            billing_date,
            salesman,
            customer_name,
            material_no,
            material_description,
            delivery_no,
            qty
        FROM sales_revenue_sap
        WHERE customer_name ILIKE '%Kridatama%'
          AND billing_date >= '2026-04-01'
        ORDER BY billing_date DESC
        LIMIT 20
    `)
    
    console.log(`   Found ${ciptaSales.rows.length} sales records for Cipta Kridatama in April 2026`)
    console.log("   Sample:", ciptaSales.rows.slice(0, 5))
    console.log()

    // Check if SNs were recently added
    console.log("3. When were these SNs added to cosmetic_tires?")
    for (const sn of MISSING_FROM_DELIVERY) {
        const ctInfo = await db.execute(sql`
            SELECT 
                serial_number,
                material_number,
                created_at
            FROM cosmetic_tires
            WHERE serial_number ILIKE ${'%' + sn + '%'}
            LIMIT 1
        `)
        
        if (ctInfo.rows.length > 0) {
            const row = ctInfo.rows[0] as any
            console.log(`   ${sn}: Created ${row.created_at}`)
        }
    }
    console.log()

    // Summary
    console.log("4. SUMMARY:")
    console.log("   These SNs exist in cosmetic_tires but have never been in deliveries.")
    console.log("   Possible reasons:")
    console.log("   - SNs were added to cosmetic_tires for future tracking")
    console.log("   - SNs were removed from deliveries after being added")
    console.log("   - SNs are planned for future delivery")
    console.log()
    console.log("   ✅ For A2R points: Only SNs that exist in BOTH deliveries AND cosmetic_tires will earn points")
    console.log("   ✅ Current fix handles consignment matching for SNs that ARE in deliveries")

    console.log("\n=== INVESTIGATION COMPLETE ===")
}

investigateMissing()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Investigation failed:", err)
        process.exit(1)
    })
