import { db } from "../db"
import { sql } from "drizzle-orm"

async function runMigration() {
    console.log("Updating rfid_scans table schema...")
    try {
        await db.execute(sql`ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS tire_condition VARCHAR(50);`)
        await db.execute(sql`ALTER TABLE rfid_scans ADD COLUMN IF NOT EXISTS remarks TEXT;`)
        console.log("✓ Columns tire_condition and remarks successfully added to rfid_scans table!")
    } catch (err) {
        console.error("Migration error:", err)
    }
    process.exit(0)
}

runMigration()
