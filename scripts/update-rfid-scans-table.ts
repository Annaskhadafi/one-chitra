import { db } from "../db"
import { sql } from "drizzle-orm"

async function runMigration() {
    console.log("Updating rfid_scans table schema...")
    try {
        await db.execute(sql`ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS tire_condition VARCHAR(50);`)
        await db.execute(sql`ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS remarks TEXT;`)
        await db.execute(sql`ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS ekspedisi VARCHAR(100);`)
        await db.execute(sql`ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS plat_truk VARCHAR(50);`)
        await db.execute(sql`ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS tujuan VARCHAR(255);`)
        await db.execute(sql`ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS nama_driver VARCHAR(100);`)
        console.log("✓ Columns tire_condition, remarks, ekspedisi, plat_truk, tujuan, and nama_driver successfully added to rfid_scans table!")
    } catch (err) {
        console.error("Migration error:", err)
    }
    process.exit(0)
}

runMigration()
