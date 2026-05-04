#!/usr/bin/env ts-node
/**
 * Fix material mismatch in cosmetic_tires
 * Update SNs to use correct material_number (110149C112)
 */

import { db } from "@/db"
import { cosmeticTires } from "@/db/schema"
import { eq, sql as sqlRaw } from "drizzle-orm"
import { sql } from "drizzle-orm"

const SN_FIXES = [
    { sn: "ICO0586S6A", oldMaterial: "110149C113", newMaterial: "110149C112" },
    { sn: "ICO0593S9A", oldMaterial: "110149C115", newMaterial: "110149C112" },
    // SN yang baru di-import sudah pakai 110149C112
]

async function fixMaterialMismatch() {
    console.log("=== FIXING MATERIAL MISMATCH ===\n")
    
    for (const fix of SN_FIXES) {
        console.log(`Fixing ${fix.sn}:`)
        console.log(`  Old material: ${fix.oldMaterial}`)
        console.log(`  New material: ${fix.newMaterial}`)
        
        // Find the record
        const record = await db.execute(sql`
            SELECT id, serial_number, material_number, description
            FROM cosmetic_tires
            WHERE serial_number = ${fix.sn}
            LIMIT 1
        `)
        
        if (record.rows.length === 0) {
            console.log(`  ⚠️ Record not found`)
            continue
        }
        
        const row = record.rows[0] as any
        console.log(`  Current: ${row.material_number}`)
        
        // Update the record
        await db.execute(sql`
            UPDATE cosmetic_tires
            SET material_number = ${fix.newMaterial},
                updated_at = NOW()
            WHERE serial_number = ${fix.sn}
        `)
        
        console.log(`  ✅ Updated to ${fix.newMaterial}`)
        console.log()
    }
    
    console.log("=== VERIFYING FIX ===")
    
    // Check all cosmetic_tires for material 110149C112
    const verify = await db.execute(sql`
        SELECT 
            id,
            serial_number,
            material_number,
            description
        FROM cosmetic_tires
        WHERE material_number = '110149C112'
        ORDER BY id
    `)
    
    console.log(`\nTotal cosmetic_tires with material 110149C112: ${verify.rows.length}`)
    console.log("SNs:", (verify.rows as any[]).map((r: any) => r.serial_number))
    
    console.log("\n=== FIX COMPLETE ===")
}

fixMaterialMismatch()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Fix failed:", err)
        process.exit(1)
    })
