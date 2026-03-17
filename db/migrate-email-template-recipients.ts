/**
 * Migration: add recipient user ids to email templates
 * Run with: npx tsx db/migrate-email-template-recipients.ts
 */
import "dotenv/config"
import { sql } from "drizzle-orm"
import { db } from "./index"

async function migrate() {
    console.log("Adding recipient_user_ids to email_templates...")

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_templates
        ADD COLUMN IF NOT EXISTS recipient_user_ids JSONB DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        UPDATE email_templates
        SET recipient_user_ids = '[]'::jsonb
        WHERE recipient_user_ids IS NULL;
    `)

    console.log("recipient_user_ids added successfully.")
    process.exit(0)
}

migrate().catch((error) => {
    console.error("Failed to add recipient_user_ids:", error)
    process.exit(1)
})
