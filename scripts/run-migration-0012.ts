import { db } from "@/db"
import { sql } from "drizzle-orm"

async function runMigration() {
  try {
    console.log("Running migration 0012...")
    
    // Add new columns as nullable first
    await db.execute(sql`ALTER TABLE "stock_opname_sessions" ADD COLUMN IF NOT EXISTS "opname_date" timestamp`)
    await db.execute(sql`ALTER TABLE "stock_opname_sessions" ADD COLUMN IF NOT EXISTS "opname_time" varchar(10)`)
    await db.execute(sql`ALTER TABLE "stock_opname_sessions" ADD COLUMN IF NOT EXISTS "location" varchar(200)`)
    
    console.log("Columns added successfully")
    
    // Set default values for any existing records
    await db.execute(sql`
      UPDATE "stock_opname_sessions" 
      SET "opname_date" = COALESCE("created_at", NOW()),
          "opname_time" = '00:00',
          "location" = 'Not specified'
      WHERE "opname_date" IS NULL
    `)
    
    console.log("Default values set successfully")
    
    // Make columns NOT NULL after setting defaults
    await db.execute(sql`ALTER TABLE "stock_opname_sessions" ALTER COLUMN "opname_date" SET NOT NULL`)
    await db.execute(sql`ALTER TABLE "stock_opname_sessions" ALTER COLUMN "opname_time" SET NOT NULL`)
    await db.execute(sql`ALTER TABLE "stock_opname_sessions" ALTER COLUMN "location" SET NOT NULL`)
    
    console.log("Migration 0012 completed successfully!")
  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  }
  process.exit(0)
}

runMigration()
