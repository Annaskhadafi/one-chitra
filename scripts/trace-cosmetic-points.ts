#!/usr/bin/env ts-node
/**
 * Deep trace - cek kenapa poin tidak nambah untuk NUR SABRINA
 */

import { db } from "@/db"
import { sql } from "drizzle-orm"

async function traceCosmeticPoints() {
    console.log("=== DEEP TRACE: NUR SABRINA COSMETIC POINTS ===\n")

    // 1. Cek sales_revenue_sap untuk NUR SABRINA di bulan April 2026
    console.log("1. SALES_REVENUE_SAP untuk NUR SABRINA (April 2026):")
    const salesData = await db.execute(sql`
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
        WHERE salesman = 'NUR SABRINA FAZLIHUL UMAR'
          AND billing_date >= '2026-04-01'
          AND billing_date < '2026-05-01'
        ORDER BY billing_date DESC
    `)
    console.log(`   Found ${salesData.rows.length} records`)
    
    // Group by material
    const materialCounts = new Map()
    for (const row of salesData.rows as any[]) {
        const mat = row.material_no
        materialCounts.set(mat, (materialCounts.get(mat) || 0) + 1)
    }
    console.log("   Materials:")
    for (const [mat, count] of materialCounts) {
        console.log(`      - ${mat}: ${count} records`)
    }
    console.log()

    // 2. Cek apakah material 110149C112 ada di sales_revenue_sap untuk NUR SABRINA
    console.log("2. CHECKING for material 110149C112:")
    const specificMaterial = await db.execute(sql`
        SELECT 
            billing_date,
            customer_name,
            material_no,
            delivery_no,
            qty
        FROM sales_revenue_sap
        WHERE salesman = 'NUR SABRINA FAZLIHUL UMAR'
          AND material_no = '110149C112'
          AND billing_date >= '2026-04-01'
        LIMIT 10
    `)
    console.log(`   Found ${specificMaterial.rows.length} records with material 110149C112`)
    console.log("   Records:", specificMaterial.rows)
    console.log()

    // 3. Cek deliveries dengan material 110149C112 untuk Cipta Kridatama
    console.log("3. DELIVERIES dengan material 110149C112 untuk Cipta Kridatama:")
    const deliveries = await db.execute(sql`
        SELECT 
            d.id,
            d.do_sap,
            d.delivery_number,
            d.delivery_date,
            c.name as customer_name,
            di.serial_numbers,
            p.material_number
        FROM deliveries d
        JOIN sales_orders so ON so.id = d.sales_order_id
        JOIN customers c ON c.id = so.customer_id
        JOIN delivery_items di ON di.delivery_id = d.id
        JOIN products p ON p.id = di.product_id
        WHERE p.material_number = '110149C112'
          AND c.name = 'PT. CIPTA KRIDATAMA'
        ORDER BY d.delivery_date DESC
        LIMIT 10
    `)
    console.log(`   Found ${deliveries.rows.length} deliveries`)
    console.log("   Records:", deliveries.rows)
    console.log()

    // 4. Cek cosmetic_tires untuk material 110149C112
    console.log("4. COSMETIC_TIRES untuk material 110149C112:")
    const cosmeticData = await db.execute(sql`
        SELECT 
            id,
            serial_number,
            material_number,
            description,
            created_at
        FROM cosmetic_tires
        WHERE material_number = '110149C112'
        ORDER BY id DESC
        LIMIT 20
    `)
    console.log(`   Found ${cosmeticData.rows.length} cosmetic tires`)
    console.log("   SNs:", (cosmeticData.rows as any[]).map((r: any) => r.serial_number))
    console.log()

    // 5. Cek apakah ada match antara delivery SN dan cosmetic_tires
    console.log("5. MATCHING CHECK:")
    for (const delivery of deliveries.rows as any[]) {
        if (!delivery.serial_numbers || delivery.serial_numbers.length === 0) continue
        
        console.log(`   Delivery ${delivery.delivery_number}:`)
        console.log(`   SNs in delivery: ${JSON.stringify(delivery.serial_numbers)}`)
        
        for (const sn of delivery.serial_numbers) {
            const normalizedSN = sn.toUpperCase().replace(/\s+/g, '')
            const ctMatch = await db.execute(sql`
                SELECT serial_number FROM cosmetic_tires
                WHERE REGEXP_REPLACE(UPPER(TRIM(serial_number)), '\\s+', '', 'g') = ${normalizedSN}
                LIMIT 1
            `)
            
            if (ctMatch.rows.length > 0) {
                console.log(`      ✓ ${sn} MATCHES cosmetic_tires`)
            } else {
                console.log(`      ✗ ${sn} NOT in cosmetic_tires`)
            }
        }
    }
    console.log()

    // 6. Check A2R data flow simulation
    console.log("6. A2R DATA FLOW SIMULATION:")
    console.log("   Step 1: Get sales data from sales_revenue_sap")
    console.log("   Step 2: Check if delivery_no matches cosmeticMatchSet")
    console.log("   Step 3: OR check if customer+material matches consignmentMatchSet")
    console.log()
    
    // Simulate what A2R query would find
    const consignmentMatches = await db.execute(sql`
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
        WHERE c.name = 'PT. CIPTA KRIDATAMA'
    `)
    console.log(`   Consignment matches for Cipta Kridatama: ${consignmentMatches.rows.length}`)
    console.log("   Pairs:", consignmentMatches.rows)
    console.log()

    console.log("=== ANALYSIS ===")
    console.log("If consignmentMatches has results but points are still 0:")
    console.log("1. Check if sales_revenue_sap has matching customer+material")
    console.log("2. Check if salesman is correctly assigned")
    console.log("3. Check billing_date range matches selected period")
    console.log()

    console.log("=== TRACE COMPLETE ===")
}

traceCosmeticPoints()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Trace failed:", err)
        process.exit(1)
    })
