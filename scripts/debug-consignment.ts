#!/usr/bin/env ts-node
/**
 * Debug consignment matching issue
 */

import { db } from "@/db"
import { sql } from "drizzle-orm"

async function debugConsignment() {
    console.log("=== DEBUG CONSIGNMENT MATCHING ===\n")

    // Check specific SNs that should match
    const targetSNs = ["ICO0586S6A", "ICO0593S9A"]
    
    console.log("1. CHECKING SNs in cosmetic_tires:")
    for (const sn of targetSNs) {
        const ctData = await db.execute(sql`
            SELECT 
                id,
                serial_number,
                material_number,
                description
            FROM cosmetic_tires
            WHERE serial_number ILIKE ${'%' + sn + '%'}
            LIMIT 1
        `)
        console.log(`   ${sn}:`, ctData.rows[0] || "NOT FOUND")
    }
    console.log()

    console.log("2. CHECKING deliveries with these SNs:")
    for (const sn of targetSNs) {
        const normalizedSN = sn.toUpperCase().replace(/\s+/g, '')
        const deliveryData = await db.execute(sql`
            SELECT 
                d.id,
                d.delivery_number,
                c.name as customer_name,
                di.serial_numbers,
                p.material_number as product_material
            FROM deliveries d
            JOIN sales_orders so ON so.id = d.sales_order_id
            JOIN customers c ON c.id = so.customer_id
            JOIN delivery_items di ON di.delivery_id = d.id
            JOIN products p ON p.id = di.product_id
            WHERE EXISTS (
                SELECT 1
                FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS s
                WHERE REGEXP_REPLACE(UPPER(TRIM(s)), '\\s+', '', 'g') = ${normalizedSN}
            )
            LIMIT 1
        `)
        console.log(`   ${sn}:`, deliveryData.rows[0] || "NOT FOUND")
    }
    console.log()

    console.log("3. CONSIGNMENT QUERY STEP-BY-STEP:")
    
    // Step 1: Get deliveries with cosmetic tires
    console.log("   Step 1: Get all deliveries with any cosmetic tire SN")
    const step1 = await db.execute(sql`
        SELECT DISTINCT
            d.id,
            d.delivery_number,
            c.name as customer_name
        FROM deliveries d
        JOIN sales_orders so ON so.id = d.sales_order_id
        JOIN customers c ON c.id = so.customer_id
        JOIN delivery_items di ON di.delivery_id = d.id
        JOIN products p ON p.id = di.product_id
        JOIN cosmetic_tires ct
          ON UPPER(TRIM(COALESCE(ct.material_number, ''))) = UPPER(TRIM(COALESCE(p.material_number, '')))
         AND EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
            WHERE REGEXP_REPLACE(UPPER(TRIM(sn)), '\\s+', '', 'g') = REGEXP_REPLACE(UPPER(TRIM(COALESCE(ct.serial_number, ''))), '\\s+', '', 'g')
         )
        LIMIT 10
    `)
    console.log(`   Found ${step1.rows.length} deliveries with cosmetic tire match`)
    console.log("   Sample:", step1.rows.slice(0, 3))
    console.log()

    // Step 2: Filter for Cipta Kridatama
    console.log("   Step 2: Filter for Cipta Kridatama")
    const step2 = await db.execute(sql`
        SELECT DISTINCT
            c.name as customer_name,
            COALESCE(p.material_number, '') as material_number
        FROM deliveries d
        JOIN sales_orders so ON so.id = d.sales_order_id
        JOIN customers c ON c.id = so.customer_id
        JOIN delivery_items di ON di.delivery_id = d.id
        JOIN products p ON p.id = di.product_id
        JOIN cosmetic_tires ct
          ON UPPER(TRIM(COALESCE(ct.material_number, ''))) = UPPER(TRIM(COALESCE(p.material_number, '')))
         AND EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
            WHERE REGEXP_REPLACE(UPPER(TRIM(sn)), '\\s+', '', 'g') = REGEXP_REPLACE(UPPER(TRIM(COALESCE(ct.serial_number, ''))), '\\s+', '', 'g')
         )
        WHERE c.name = 'PT. CIPTA KRIDATAMA'
    `)
    console.log(`   Found ${step2.rows.length} customer-material pairs for Cipta Kridatama`)
    console.log("   Pairs:", step2.rows)
    console.log()

    // Check if the SNs are actually matching
    console.log("4. MANUAL MATCH CHECK:")
    const deliverySNs = ["ICO0586S6A", "ICO0593S9A"]
    const ctSNs = await db.execute(sql`
        SELECT serial_number FROM cosmetic_tires
        WHERE material_number IN ('110149C112', '110149C113', '110149C114', '110149C115')
    `)
    
    console.log("   Cosmetic tire SNs:", (ctSNs.rows as any[]).map(r => r.serial_number))
    console.log("   Delivery SNs:", deliverySNs)
    
    for (const dsn of deliverySNs) {
        const normalizedDSN = dsn.toUpperCase().replace(/\s+/g, '')
        const found = (ctSNs.rows as any[]).some((r: any) => {
            const normalizedCT = r.serial_number.toUpperCase().replace(/\s+/g, '')
            return normalizedDSN === normalizedCT
        })
        console.log(`   ${dsn} match: ${found ? 'YES' : 'NO'}`)
    }

    console.log("\n=== DEBUG COMPLETE ===")
}

debugConsignment()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Debug failed:", err)
        process.exit(1)
    })
