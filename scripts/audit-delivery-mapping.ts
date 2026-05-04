#!/usr/bin/env ts-node
/**
 * Detail audit untuk mapping DO SAP dengan sales_revenue_sap
 */

import { db } from "@/db"
import { sql } from "drizzle-orm"

async function auditDeliveryMapping() {
    console.log("=== DELIVERY MAPPING AUDIT ===\n")

    // Check deliveries table structure
    console.log("1. Deliveries dengan DO SAP untuk Cipta Kridatama...")
    const deliveriesResult = await db.execute(sql`
        SELECT 
            d.id,
            d.do_sap,
            d.delivery_number,
            d.delivery_date,
            so.customer_po,
            so.invoice_number,
            c.name as customer_name
        FROM deliveries d
        JOIN sales_orders so ON so.id = d.sales_order_id
        JOIN customers c ON c.id = so.customer_id
        WHERE c.name ILIKE '%Kridatama%'
           OR so.customer_po ILIKE '%Kridatama%'
           OR d.do_sap ILIKE '%CK%'
        ORDER BY d.delivery_date DESC
        LIMIT 20
    `)
    console.log(`   Found ${deliveriesResult.rows.length} deliveries`)
    console.log("   Sample:", deliveriesResult.rows)
    console.log()

    // Check sales_revenue_sap delivery_no patterns
    console.log("2. Delivery_no patterns in sales_revenue_sap...")
    const salesDeliveryPatterns = await db.execute(sql`
        SELECT DISTINCT delivery_no
        FROM sales_revenue_sap
        WHERE customer_name ILIKE '%Kridatama%'
          AND delivery_no IS NOT NULL
          AND TRIM(delivery_no) <> ''
        ORDER BY delivery_no DESC
        LIMIT 20
    `)
    console.log("   Delivery numbers:", salesDeliveryPatterns.rows)
    console.log()

    // Check if there's a pattern between DO SAP and delivery_no
    console.log("3. Checking DO SAP vs delivery_no relationship...")
    const doSapPattern = await db.execute(sql`
        SELECT 
            d.do_sap,
            d.delivery_number,
            so.invoice_number,
            so.customer_po,
            di.serial_numbers,
            p.material_number,
            c.name as customer_name
        FROM deliveries d
        JOIN sales_orders so ON so.id = d.sales_order_id
        JOIN customers c ON c.id = so.customer_id
        JOIN delivery_items di ON di.delivery_id = d.id
        JOIN products p ON p.id = di.product_id
        WHERE d.do_sap IS NOT NULL
          AND TRIM(d.do_sap) <> ''
        ORDER BY d.delivery_date DESC
        LIMIT 10
    `)
    console.log("   DO SAP patterns:", doSapPattern.rows)
    console.log()

    console.log("=== AUDIT COMPLETE ===")
}

auditDeliveryMapping()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Audit failed:", err)
        process.exit(1)
    })
