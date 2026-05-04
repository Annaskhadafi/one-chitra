#!/usr/bin/env ts-node
/**
 * Audit script untuk investigasi A2R Cosmetic Tire Points
 * Issue: SN sudah di delivery ke PT Cipta Kridatama tapi poin tidak nambah
 */

import { db } from "@/db"
import { sql } from "drizzle-orm"

const SN_LIST = [
    "ICO 0586 SGA",
    "ICO 0593 S9A",
    "IVX 0010 T0C",
    "IVX 0029 T1C",
    "IVX 0016 T4C",
    "IVX 0006 T4C",
    "FCP 0342 S0A",
    "FCP 0422 S0A",
    "FCP 0104 S8A",
    "FCP 0380 S2A",
]

async function auditCosmeticTirePoints() {
    console.log("=== A2R COSMETIC TIRE AUDIT ===\n")
    console.log("Serial Numbers to check:", SN_LIST)
    console.log()

    // 1. Check if SNs exist in cosmetic_tires table
    console.log("1. CHECKING cosmetic_tires table...")
    const cosmeticTiresResult = await db.execute(sql`
        SELECT 
            id,
            tyre_size,
            pattern,
            serial_number,
            material_number,
            description,
            created_at
        FROM cosmetic_tires
        WHERE serial_number IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 20
    `)
    console.log("   Recent cosmetic_tires entries:", cosmeticTiresResult.rows.length)
    console.log("   Sample:", cosmeticTiresResult.rows.slice(0, 5))
    console.log()

    // Check specific SNs
    const normalizedSNs = SN_LIST.map(sn => sn.replace(/\s+/g, "").toUpperCase())
    const specificCosmeticResult = await db.execute(sql`
        SELECT 
            id,
            serial_number,
            material_number,
            description
        FROM cosmetic_tires
        WHERE REGEXP_REPLACE(UPPER(TRIM(serial_number)), '\\s+', '', 'g') IN (${sql.join(normalizedSNs.map(sn => sql`${sn}`), sql`, `)})
    `)
    console.log(`   Found ${specificCosmeticResult.rows.length} of ${SN_LIST.length} SNs in cosmetic_tires:`)
    console.log("   ", specificCosmeticResult.rows)
    console.log()

    // 2. Check deliveries with these SNs
    console.log("2. CHECKING deliveries with these SNs...")
    const deliveriesResult = await db.execute(sql`
        SELECT DISTINCT
            d.id,
            d.do_sap,
            d.delivery_number,
            d.delivery_date,
            so.customer_po,
            so.invoice_number,
            di.serial_numbers,
            p.material_number,
            p.material_description
        FROM deliveries d
        JOIN delivery_items di ON di.delivery_id = d.id
        JOIN products p ON p.id = di.product_id
        JOIN sales_orders so ON so.id = d.sales_order_id
        WHERE EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
            WHERE REGEXP_REPLACE(UPPER(TRIM(sn)), '\\s+', '', 'g') IN (${sql.join(normalizedSNs.map(sn => sql`${sn}`), sql`, `)})
        )
        ORDER BY d.delivery_date DESC
        LIMIT 10
    `)
    console.log(`   Found ${deliveriesResult.rows.length} deliveries with matching SNs`)
    console.log("   Sample:", deliveriesResult.rows)
    console.log()

    // 3. Check sales_revenue_sap for PT Cipta Kridatama
    console.log("3. CHECKING sales_revenue_sap for PT Cipta Kridatama...")
    const salesResult = await db.execute(sql`
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
           OR customer_name ILIKE '%Cipta%'
        ORDER BY billing_date DESC
        LIMIT 20
    `)
    console.log(`   Found ${salesResult.rows.length} sales records for Cipta Kridatama`)
    console.log("   Sample:", salesResult.rows.slice(0, 5))
    console.log()

    // 4. Check if delivery_no from deliveries matches sales_revenue_sap
    console.log("4. CHECKING delivery_no matching...")
    if (deliveriesResult.rows.length > 0) {
        const deliveryNos = deliveriesResult.rows
            .map((r: any) => r.delivery_number)
            .filter(Boolean)
        
        const doSaps = deliveriesResult.rows
            .map((r: any) => r.do_sap)
            .filter(Boolean)

        console.log("   Delivery numbers from deliveries:", deliveryNos)
        console.log("   DO SAP from deliveries:", doSaps)

        const matchingSales = await db.execute(sql`
            SELECT 
                billing_date,
                salesman,
                customer_name,
                delivery_no,
                material_no
            FROM sales_revenue_sap
            WHERE delivery_no IN (${sql.join([...deliveryNos, ...doSaps].map(d => sql`${d}`), sql`, `)})
            ORDER BY billing_date DESC
            LIMIT 10
        `)
        console.log(`   Found ${matchingSales.rows.length} matching sales records by delivery_no`)
        console.log("   Matching records:", matchingSales.rows)
    }
    console.log()

    // 5. Check cosmetic_tires match query specifically
    console.log("5. CHECKING cosmetic_tires match query...")
    const matchResult = await db.execute(sql`
        SELECT DISTINCT
            COALESCE(d.do_sap, '') AS "doSap",
            COALESCE(d.delivery_number, '') AS "deliveryNumber",
            COALESCE(p.material_number, '') AS "materialNumber"
        FROM deliveries d
        JOIN delivery_items di ON di.delivery_id = d.id
        JOIN products p ON p.id = di.product_id
        JOIN cosmetic_tires ct
          ON UPPER(TRIM(COALESCE(ct.material_number, ''))) = UPPER(TRIM(COALESCE(p.material_number, '')))
         AND EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
            WHERE REGEXP_REPLACE(UPPER(TRIM(sn)), '\\s+', '', 'g') = REGEXP_REPLACE(UPPER(TRIM(COALESCE(ct.serial_number, ''))), '\\s+', '', 'g')
         )
        WHERE EXISTS (
            SELECT 1
            FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
            WHERE REGEXP_REPLACE(UPPER(TRIM(sn)), '\\s+', '', 'g') IN (${sql.join(normalizedSNs.map(sn => sql`${sn}`), sql`, `)})
        )
    `)
    console.log(`   Found ${matchResult.rows.length} cosmetic match records`)
    console.log("   Records:", matchResult.rows)
    console.log()

    console.log("=== AUDIT COMPLETE ===")
}

auditCosmeticTirePoints()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Audit failed:", err)
        process.exit(1)
    })
