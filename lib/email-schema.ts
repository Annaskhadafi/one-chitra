import { sql } from "drizzle-orm"
import { db } from "@/db"

let ensureEmailManagementSchemaPromise: Promise<void> | null = null

async function syncEmailManagementSchema() {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)

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

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_templates (
            id                 VARCHAR(36)          PRIMARY KEY DEFAULT gen_random_uuid()::text,
            name               VARCHAR(255)         NOT NULL,
            type               email_template_type  NOT NULL,
            subject            VARCHAR(500)         NOT NULL,
            html_content       TEXT                 NOT NULL,
            text_content       TEXT,
            variables          JSONB                DEFAULT '[]'::jsonb,
            recipient_roles    JSONB                DEFAULT '[]'::jsonb,
            recipient_user_ids JSONB                DEFAULT '[]'::jsonb,
            cc_emails          JSONB                DEFAULT '[]'::jsonb,
            is_active          BOOLEAN              NOT NULL DEFAULT true,
            created_at         TIMESTAMP            NOT NULL DEFAULT now(),
            updated_at         TIMESTAMP            NOT NULL DEFAULT now(),
            code               VARCHAR(120)
        );
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_logs (
            id             VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
            template_id    VARCHAR(36),
            to_email       TEXT NOT NULL,
            subject        VARCHAR(500) NOT NULL,
            status         VARCHAR(50)  NOT NULL DEFAULT 'pending',
            error_message  TEXT,
            sent_at        TIMESTAMP,
            created_at     TIMESTAMP   NOT NULL DEFAULT now(),
            template_code  VARCHAR(120),
            template_name  VARCHAR(255),
            cc_email       TEXT,
            from_email     VARCHAR(255),
            html_content   TEXT,
            text_content   TEXT
        );
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_templates
        ADD COLUMN IF NOT EXISTS code VARCHAR(120);
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_templates
        ADD COLUMN IF NOT EXISTS cc_emails JSONB DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_templates
        ADD COLUMN IF NOT EXISTS recipient_user_ids JSONB DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_templates
        ALTER COLUMN variables SET DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_templates
        ALTER COLUMN recipient_roles SET DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_templates
        ALTER COLUMN cc_emails SET DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_templates
        ALTER COLUMN recipient_user_ids SET DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        UPDATE email_templates
        SET
            variables = COALESCE(variables, '[]'::jsonb),
            recipient_roles = COALESCE(recipient_roles, '[]'::jsonb),
            recipient_user_ids = COALESCE(recipient_user_ids, '[]'::jsonb),
            cc_emails = COALESCE(cc_emails, '[]'::jsonb)
        WHERE
            variables IS NULL
            OR recipient_roles IS NULL
            OR recipient_user_ids IS NULL
            OR cc_emails IS NULL;
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
}

export async function ensureEmailManagementSchema() {
    if (!ensureEmailManagementSchemaPromise) {
        ensureEmailManagementSchemaPromise = syncEmailManagementSchema().catch((error) => {
            ensureEmailManagementSchemaPromise = null
            throw error
        })
    }

    await ensureEmailManagementSchemaPromise
}
