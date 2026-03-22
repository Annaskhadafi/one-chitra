import "dotenv/config"
import { sql } from "drizzle-orm"
import { db } from "@/db"

async function main() {
    console.log("Adding new columns to approval_definition_steps...")

    await db.execute(sql`
        ALTER TABLE approval_definition_steps
        ADD COLUMN IF NOT EXISTS notify_on_assign BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notify_on_complete BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS cc_emails TEXT,
        ADD COLUMN IF NOT EXISTS sla_days INTEGER,
        ADD COLUMN IF NOT EXISTS node_position_x INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS node_position_y INTEGER DEFAULT 0
    `)

    console.log("✅ Columns added successfully!")
    process.exit(0)
}

main().catch((err) => {
    console.error("❌ Failed:", err)
    process.exit(1)
})
