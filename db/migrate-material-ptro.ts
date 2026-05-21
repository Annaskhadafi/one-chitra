import { db } from "@/db"
import { sql } from "drizzle-orm"

async function migrate() {
    console.log("Adding material_number_ptro column to products table...")
    try {
        await db.execute(sql`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS material_number_ptro VARCHAR(100)
        `)
        console.log("Migration complete: material_number_ptro column added.")
    } catch (error) {
        console.error("Migration failed:", error)
        process.exit(1)
    }
    process.exit(0)
}

migrate()