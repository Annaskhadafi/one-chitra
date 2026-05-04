#!/usr/bin/env ts-node
/**
 * Import missing SNs to cosmetic_tires table
 * SNs yang perlu di-import ke cosmetic_tires untuk Cipta Kridatama
 */

import { db } from "@/db"
import { cosmeticTires } from "@/db/schema"
import { sql } from "drizzle-orm"

// SNs yang belum ada di cosmetic_tires berdasarkan audit
const MISSING_SNS = [
    {
        serialNumber: "IVX0010T0C",
        materialNumber: "110149C112", // Sesuaikan dengan material di delivery
        tyreSize: "27.00 R 49",
        pattern: "XD-GRIP B",
        description: "27.00 R 49 XD GRIP B E4T TL ** (Consignment)",
        month: "Apr",
        year: "2026",
        city: "Site CK"
    },
    {
        serialNumber: "IVX0029T1C",
        materialNumber: "110149C112",
        tyreSize: "27.00 R 49",
        pattern: "XD-GRIP B",
        description: "27.00 R 49 XD GRIP B E4T TL ** (Consignment)",
        month: "Apr",
        year: "2026",
        city: "Site CK"
    },
    {
        serialNumber: "IVX0016T4C",
        materialNumber: "110149C112",
        tyreSize: "27.00 R 49",
        pattern: "XD-GRIP B",
        description: "27.00 R 49 XD GRIP B E4T TL ** (Consignment)",
        month: "Apr",
        year: "2026",
        city: "Site CK"
    },
    {
        serialNumber: "IVX0006T4C",
        materialNumber: "110149C112",
        tyreSize: "27.00 R 49",
        pattern: "XD-GRIP B",
        description: "27.00 R 49 XD GRIP B E4T TL ** (Consignment)",
        month: "Apr",
        year: "2026",
        city: "Site CK"
    },
    {
        serialNumber: "FCP0342S0A",
        materialNumber: "110149C112",
        tyreSize: "27.00 R 49",
        pattern: "XD-GRIP B",
        description: "27.00 R 49 XD GRIP B E4T TL ** (Consignment)",
        month: "Apr",
        year: "2026",
        city: "Site CK"
    },
    {
        serialNumber: "FCP0422S0A",
        materialNumber: "110149C112",
        tyreSize: "27.00 R 49",
        pattern: "XD-GRIP B",
        description: "27.00 R 49 XD GRIP B E4T TL ** (Consignment)",
        month: "Apr",
        year: "2026",
        city: "Site CK"
    },
    {
        serialNumber: "FCP0104S8A",
        materialNumber: "110149C112",
        tyreSize: "27.00 R 49",
        pattern: "XD-GRIP B",
        description: "27.00 R 49 XD GRIP B E4T TL ** (Consignment)",
        month: "Apr",
        year: "2026",
        city: "Site CK"
    },
    {
        serialNumber: "FCP0380S2A",
        materialNumber: "110149C112",
        tyreSize: "27.00 R 49",
        pattern: "XD-GRIP B",
        description: "27.00 R 49 XD GRIP B E4T TL ** (Consignment)",
        month: "Apr",
        year: "2026",
        city: "Site CK"
    }
]

async function importMissingSNs() {
    console.log("=== IMPORT MISSING SNs TO COSMETIC_TIRES ===\n")
    console.log(`Will import ${MISSING_SNS.length} SNs:\n`)
    
    for (const sn of MISSING_SNS) {
        console.log(`  - ${sn.serialNumber} (Material: ${sn.materialNumber})`)
    }
    console.log()

    // Check if any of these SNs already exist
    const normalizedSNs = MISSING_SNS.map(s => s.serialNumber.toUpperCase())
    const existingCheck = await db.execute(sql`
        SELECT serial_number 
        FROM cosmetic_tires 
        WHERE REGEXP_REPLACE(UPPER(TRIM(serial_number)), '\\s+', '', 'g') 
              IN (${sql.join(normalizedSNs.map(sn => sql`${sn}`), sql`, `)})
    `)

    if (existingCheck.rows.length > 0) {
        console.log("⚠️  Some SNs already exist:")
        for (const row of existingCheck.rows as any[]) {
            console.log(`   - ${row.serial_number}`)
        }
        console.log()
    }

    // Import the missing SNs
    console.log("Importing...")
    let importedCount = 0
    let skippedCount = 0

    for (const snData of MISSING_SNS) {
        // Check if already exists (case insensitive, space insensitive)
        const normalizedSN = snData.serialNumber.toUpperCase().replace(/\s+/g, '')
        const exists = await db.execute(sql`
            SELECT 1 FROM cosmetic_tires 
            WHERE REGEXP_REPLACE(UPPER(TRIM(serial_number)), '\\s+', '', 'g') = ${normalizedSN}
            LIMIT 1
        `)

        if (exists.rows.length > 0) {
            console.log(`  ⏭️  Skipped ${snData.serialNumber} (already exists)`)
            skippedCount++
            continue
        }

        // Insert new record
        await db.insert(cosmeticTires).values({
            serialNumber: snData.serialNumber,
            materialNumber: snData.materialNumber,
            tyreSize: snData.tyreSize,
            pattern: snData.pattern,
            description: snData.description,
            month: snData.month,
            year: snData.year,
            city: snData.city,
            createdBy: null // System import
        })

        console.log(`  ✅ Imported ${snData.serialNumber}`)
        importedCount++
    }

    console.log(`\n=== IMPORT COMPLETE ===`)
    console.log(`   Imported: ${importedCount}`)
    console.log(`   Skipped: ${skippedCount}`)
    console.log(`   Total: ${importedCount + skippedCount}`)
}

importMissingSNs()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Import failed:", err)
        process.exit(1)
    })
