/**
 * Migration: create email tables
 * Run with: npx tsx db/migrate-email.ts
 */
import 'dotenv/config'
import { db } from './index'
import { sql } from 'drizzle-orm'

async function migrate() {
    console.log('Creating email enums and tables…')

    // Create enums (idempotent)
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE email_template_type AS ENUM (
                'magic_link', 'notification', 'welcome',
                'password_reset', 'order_confirmation', 'delivery_update', 'custom'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE email_recipient_role AS ENUM (
                'admin', 'manager', 'staff', 'customer', 'all'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    `)

    // smtp_settings
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS smtp_settings (
            id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
            host        VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
            port        VARCHAR(10)  NOT NULL DEFAULT '587',
            secure      BOOLEAN      NOT NULL DEFAULT false,
            username    VARCHAR(255) NOT NULL,
            password    VARCHAR(255) NOT NULL,
            from_email  VARCHAR(255) NOT NULL,
            from_name   VARCHAR(255) NOT NULL DEFAULT 'One Chitra',
            is_active   BOOLEAN      NOT NULL DEFAULT true,
            created_at  TIMESTAMP    NOT NULL DEFAULT now(),
            updated_at  TIMESTAMP    NOT NULL DEFAULT now()
        );
    `)

    // email_templates
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_templates (
            id               VARCHAR(36)          PRIMARY KEY DEFAULT gen_random_uuid()::text,
            name             VARCHAR(255)         NOT NULL,
            type             email_template_type  NOT NULL,
            subject          VARCHAR(500)         NOT NULL,
            html_content     TEXT                 NOT NULL,
            text_content     TEXT,
            variables        JSONB                DEFAULT '[]',
            recipient_roles  JSONB                DEFAULT '[]',
            is_active        BOOLEAN              NOT NULL DEFAULT true,
            created_at       TIMESTAMP            NOT NULL DEFAULT now(),
            updated_at       TIMESTAMP            NOT NULL DEFAULT now()
        );
    `)

    // email_logs
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_logs (
            id             VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
            template_id    VARCHAR(36),
            to_email       VARCHAR(255) NOT NULL,
            subject        VARCHAR(500) NOT NULL,
            status         VARCHAR(50)  NOT NULL DEFAULT 'pending',
            error_message  TEXT,
            sent_at        TIMESTAMP,
            created_at     TIMESTAMP   NOT NULL DEFAULT now()
        );
    `)

    console.log('✅ Email tables created (or already exist).')
    process.exit(0)
}

migrate().catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
})
