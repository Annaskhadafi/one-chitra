#!/usr/bin/env ts-node
/**
 * Debug - Check actual SN data in delivery_items
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

async function debugSN() {
    console.log("=== DEBUG SN MATCHING ===\n")

    // Check all delivery_items with serial numbers
    console.log("1. All delivery_items with SNs (latest 10):")
    const allItems = await db.execute(sql`
        SELECT 
            di.id,
            di.serial_numbers,
            p.material_number,
            d.delivery_number
        FROM delivery_items di
        JOIN products p ON p.id = di.product_id
        JOIN deliveries d ON d.id = di.delivery_id
        WHERE di.serial_numbers IS NOT NULL
          AND array_length(di.serial_numbers, 1) > 0
        ORDER BY di.id DESC
        LIMIT 10
    `)
    console.log("   Sample:", allItems.rows)
    console.log()

    // Check cosmetic_tires for these SNs
    console.log("2. Cosmetic_tires data:")
    const cosmeticData = await db.execute(sql`
        SELECT 
            id,
            serial_number,
            material_number
        FROM cosmetic_tires
        ORDER BY id DESC
        LIMIT 20
    `)
    console.log("   Records:", cosmeticData.rows)
    console.log()

    // Try fuzzy match
    console.log("3. Fuzzy match test:")
    for (const sn of SN_LIST) {
        const normalizedSN = sn.toUpperCase().replace(/\s+/g, '')
        
        // Check in cosmetic_tires
        const ctMatch = await db.execute(sql`
            SELECT serial_number FROM cosmetic_tires
            WHERE REGEXP_REPLACE(UPPER(TRIM(serial_number)), '\\s+', '', 'g') = ${normalizedSN}
            LIMIT 1
        `)
        
        // Check in delivery_items
        const diMatch = await db.execute(sql`
            SELECT di.id, di.serial_numbers, d.delivery_number
            FROM delivery_items di
            JOIN deliveries d ON d.id = di.delivery_id
            WHERE EXISTS (
                SELECT 1
                FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
                WHERE REGEXP_REPLACE(UPPER(TRIM(sn)), '\\s+', '', 'g') = ${normalizedSN}
            )
            LIMIT 1
        `)
        
        console.log(`   ${sn}:`)
        console.log(`      CT Match: ${ctMatch.rows.length > 0 ? 'YES' : 'NO'}`)
        console.log(`      DI Match: ${diMatch.rows.length > 0 ? 'YES' : 'NO'}`, diMatch.rows[0] || '')
    }

    console.log("\n=== DEBUG COMPLETE ===")
}

debugSN()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Debug failed:", err)
        process.exit(1)
    })
