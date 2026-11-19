import { db } from "../db";
import { sql } from "drizzle-orm";

async function migrateWhatsappTables() {
    console.log("🚀 Menerapkan skema tabel WhatsApp Center & Bot AI ke PostgreSQL...");

    // 1. whatsapp_registered_numbers
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "whatsapp_registered_numbers" (
            "id" text PRIMARY KEY,
            "phone_number" text NOT NULL UNIQUE,
            "contact_name" text NOT NULL,
            "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
            "role" text DEFAULT 'sales' NOT NULL,
            "can_access_revenue" boolean DEFAULT false NOT NULL,
            "can_access_stock" boolean DEFAULT true NOT NULL,
            "can_access_quotation" boolean DEFAULT false NOT NULL,
            "can_receive_broadcast" boolean DEFAULT true NOT NULL,
            "is_active" boolean DEFAULT true NOT NULL,
            "notes" text,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "whatsapp_reg_phone_idx" ON "whatsapp_registered_numbers" ("phone_number");
        CREATE INDEX IF NOT EXISTS "whatsapp_reg_role_idx" ON "whatsapp_registered_numbers" ("role");
        CREATE INDEX IF NOT EXISTS "whatsapp_reg_user_idx" ON "whatsapp_registered_numbers" ("user_id");
    `);
    console.log("✅ Tabel 'whatsapp_registered_numbers' siap.");

    // 2. whatsapp_conversations
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "whatsapp_conversations" (
            "id" text PRIMARY KEY,
            "phone_number" text NOT NULL UNIQUE,
            "context" jsonb DEFAULT '{}'::jsonb,
            "last_message_at" timestamp DEFAULT now() NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "whatsapp_conv_phone_idx" ON "whatsapp_conversations" ("phone_number");
        CREATE INDEX IF NOT EXISTS "whatsapp_conv_last_msg_idx" ON "whatsapp_conversations" ("last_message_at");
    `);
    console.log("✅ Tabel 'whatsapp_conversations' siap.");

    // 3. whatsapp_messages
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
            "id" text PRIMARY KEY,
            "conversation_id" text REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE,
            "phone_number" text NOT NULL,
            "direction" text NOT NULL,
            "message_type" text DEFAULT 'text' NOT NULL,
            "content" text NOT NULL,
            "media_url" text,
            "tool_calls" jsonb DEFAULT '[]'::jsonb,
            "status" text DEFAULT 'sent' NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "whatsapp_msg_conv_idx" ON "whatsapp_messages" ("conversation_id");
        CREATE INDEX IF NOT EXISTS "whatsapp_msg_phone_idx" ON "whatsapp_messages" ("phone_number");
        CREATE INDEX IF NOT EXISTS "whatsapp_msg_created_idx" ON "whatsapp_messages" ("created_at");
    `);
    console.log("✅ Tabel 'whatsapp_messages' siap.");

    // 4. whatsapp_notification_logs
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "whatsapp_notification_logs" (
            "id" text PRIMARY KEY,
            "event_type" text NOT NULL,
            "recipient_number" text NOT NULL,
            "recipient_name" text,
            "message_content" text NOT NULL,
            "reference_id" text,
            "status" text DEFAULT 'sent' NOT NULL,
            "error_message" text,
            "created_at" timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "whatsapp_notif_type_idx" ON "whatsapp_notification_logs" ("event_type");
        CREATE INDEX IF NOT EXISTS "whatsapp_notif_phone_idx" ON "whatsapp_notification_logs" ("recipient_number");
        CREATE INDEX IF NOT EXISTS "whatsapp_notif_created_idx" ON "whatsapp_notification_logs" ("created_at");
    `);
    console.log("✅ Tabel 'whatsapp_notification_logs' siap.");

    console.log("🎉 Seluruh tabel WhatsApp Center berhasil dimigrasi.");
    process.exit(0);
}

migrateWhatsappTables().catch((err) => {
    console.error("❌ Gagal migrasi tabel WhatsApp:", err);
    process.exit(1);
});
