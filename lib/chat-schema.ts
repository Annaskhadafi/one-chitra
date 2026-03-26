import { sql } from "drizzle-orm"

import { db } from "@/db"

let ensureChatSchemaPromise: Promise<void> | null = null

async function syncChatSchema() {
    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_room_members
        ADD COLUMN IF NOT EXISTS last_unread_reminder_at TIMESTAMP;
    `)

    await db.execute(sql`
        ALTER TABLE IF EXISTS chat_room_members
        ADD COLUMN IF NOT EXISTS unread_reminder_count INTEGER NOT NULL DEFAULT 0;
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
