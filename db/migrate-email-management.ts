/**
 * Migration: enhance email templates and logs for editable operational notifications
 * Run with: npx tsx db/migrate-email-management.ts
 */
import "dotenv/config"
import { sql } from "drizzle-orm"
import { db } from "./index"

async function migrate() {
    console.log("Enhancing email templates and logs...")

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_templates
        ADD COLUMN IF NOT EXISTS code VARCHAR(120);
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_templates
        ADD COLUMN IF NOT EXISTS cc_emails JSONB DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        UPDATE email_templates
        SET cc_emails = '[]'::jsonb
        WHERE cc_emails IS NULL;
    `)

    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS email_templates_code_unique
        ON email_templates(code)
        WHERE code IS NOT NULL;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_logs
        ALTER COLUMN to_email TYPE TEXT;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_logs
        ADD COLUMN IF NOT EXISTS template_code VARCHAR(120);
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_logs
        ADD COLUMN IF NOT EXISTS template_name VARCHAR(255);
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_logs
        ADD COLUMN IF NOT EXISTS cc_email TEXT;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_logs
        ADD COLUMN IF NOT EXISTS from_email VARCHAR(255);
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_logs
        ADD COLUMN IF NOT EXISTS html_content TEXT;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_logs
        ADD COLUMN IF NOT EXISTS text_content TEXT;
    `)

    console.log("Email template and log enhancement completed.")
    process.exit(0)
}

migrate().catch((error) => {
    console.error("Email enhancement migration failed:", error)
    process.exit(1)
})
