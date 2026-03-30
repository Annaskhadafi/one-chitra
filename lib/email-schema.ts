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
        DO $$ BEGIN
            CREATE TYPE notification_delivery_channel AS ENUM (
                'email', 'push'
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
            delivery_channels  JSONB                DEFAULT '["email"]'::jsonb,
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
            delivery_channel VARCHAR(20) NOT NULL DEFAULT 'email',
            html_content   TEXT,
            text_content   TEXT
        );
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_notification_reads (
            id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            email_log_id VARCHAR(36) NOT NULL REFERENCES email_logs(id) ON DELETE CASCADE,
            read_at     TIMESTAMP NOT NULL DEFAULT now(),
            created_at  TIMESTAMP NOT NULL DEFAULT now()
        );
    `)

    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS user_notification_reads_user_log_unique
        ON user_notification_reads(user_id, email_log_id);
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS user_notification_reads_user_idx
        ON user_notification_reads(user_id);
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS user_notification_reads_log_idx
        ON user_notification_reads(email_log_id);
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            endpoint    TEXT NOT NULL,
            p256dh      TEXT NOT NULL,
            auth        TEXT NOT NULL,
            user_agent  TEXT,
            created_at  TIMESTAMP NOT NULL DEFAULT now(),
            updated_at  TIMESTAMP NOT NULL DEFAULT now(),
            last_seen_at TIMESTAMP NOT NULL DEFAULT now()
        );
    `)

    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_unique
        ON push_subscriptions(endpoint);
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
        ON push_subscriptions(user_id);
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
        ADD COLUMN IF NOT EXISTS delivery_channels JSONB DEFAULT '["email"]'::jsonb;
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
        ALTER TABLE IF EXISTS email_templates
        ALTER COLUMN delivery_channels SET DEFAULT '["email"]'::jsonb;
    `)

    await db.execute(sql`
        UPDATE email_templates
        SET
            variables = COALESCE(variables, '[]'::jsonb),
            recipient_roles = COALESCE(recipient_roles, '[]'::jsonb),
            recipient_user_ids = COALESCE(recipient_user_ids, '[]'::jsonb),
            cc_emails = COALESCE(cc_emails, '[]'::jsonb),
            delivery_channels = COALESCE(delivery_channels, '["email"]'::jsonb)
        WHERE
            variables IS NULL
            OR recipient_roles IS NULL
            OR recipient_user_ids IS NULL
            OR cc_emails IS NULL
            OR delivery_channels IS NULL;
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
        ADD COLUMN IF NOT EXISTS delivery_channel VARCHAR(20) NOT NULL DEFAULT 'email';
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_logs
        ADD COLUMN IF NOT EXISTS html_content TEXT;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_logs
        ADD COLUMN IF NOT EXISTS text_content TEXT;
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_notification_rules (
            id           VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
            name         VARCHAR(255) NOT NULL,
            form_key     VARCHAR(100) NOT NULL,
            combinator   VARCHAR(3)   NOT NULL DEFAULT 'AND',
            conditions   JSONB        DEFAULT '[]'::jsonb,
            to_emails    JSONB        DEFAULT '[]'::jsonb,
            cc_emails    JSONB        DEFAULT '[]'::jsonb,
            options      JSONB        DEFAULT '{}'::jsonb,
            template_id  VARCHAR(36)  NOT NULL REFERENCES email_templates(id),
            is_active    BOOLEAN      NOT NULL DEFAULT true,
            created_at   TIMESTAMP    NOT NULL DEFAULT now(),
            updated_at   TIMESTAMP    NOT NULL DEFAULT now()
        );
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS email_notification_rules
        ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{}'::jsonb;
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS email_notification_rules_form_key_idx
        ON email_notification_rules(form_key);
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS email_notification_rules_active_idx
        ON email_notification_rules(is_active);
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_notification_rule_states (
            id                 VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            rule_id            VARCHAR(36) NOT NULL REFERENCES email_notification_rules(id) ON DELETE CASCADE,
            entity_id          VARCHAR(100) NOT NULL,
            last_matched       BOOLEAN NOT NULL DEFAULT false,
            last_evaluated_at  TIMESTAMP,
            last_sent_at       TIMESTAMP,
            created_at         TIMESTAMP NOT NULL DEFAULT now(),
            updated_at         TIMESTAMP NOT NULL DEFAULT now()
        );
    `)

    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS email_notification_rule_states_unique
        ON email_notification_rule_states(rule_id, entity_id);
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS email_notification_rule_states_rule_id_idx
        ON email_notification_rule_states(rule_id);
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS email_notification_rule_logs (
            id            VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            rule_id       VARCHAR(36) NOT NULL REFERENCES email_notification_rules(id) ON DELETE CASCADE,
            form_key      VARCHAR(100) NOT NULL,
            entity_id     VARCHAR(100) NOT NULL,
            matched       BOOLEAN NOT NULL DEFAULT false,
            sent          BOOLEAN NOT NULL DEFAULT false,
            to_email      TEXT,
            cc_email      TEXT,
            subject       VARCHAR(500),
            html_content  TEXT,
            text_content  TEXT,
            status        VARCHAR(50) NOT NULL DEFAULT 'skipped',
            error_message TEXT,
            created_at    TIMESTAMP NOT NULL DEFAULT now()
        );
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
