import { sql } from "drizzle-orm"

import { db } from "@/db"

let ensureChatSchemaPromise: Promise<void> | null = null

async function syncChatSchema() {
    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_rooms
        ALTER COLUMN type TYPE VARCHAR(20);
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_room_members
        ADD COLUMN IF NOT EXISTS last_unread_reminder_at TIMESTAMP;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_room_members
        ADD COLUMN IF NOT EXISTS unread_reminder_count INTEGER NOT NULL DEFAULT 0;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_room_members
        ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_room_members
        ADD COLUMN IF NOT EXISTS typing_at TIMESTAMP;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_room_members
        ADD COLUMN IF NOT EXISTS is_muted BOOLEAN NOT NULL DEFAULT FALSE;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_room_members
        ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_room_members
        ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_messages
        ADD COLUMN IF NOT EXISTS reply_to_message_id INTEGER;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_messages
        ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_messages
        ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_messages
        ADD COLUMN IF NOT EXISTS mentioned_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_messages
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_messages
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_messages
        ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_messages
        ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP;
    `)
}

export async function ensureChatSchema() {
    if (!ensureChatSchemaPromise) {
        ensureChatSchemaPromise = syncChatSchema().catch((error) => {
            ensureChatSchemaPromise = null
            throw error
        })
    }

    await ensureChatSchemaPromise
}
