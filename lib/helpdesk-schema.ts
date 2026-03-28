import { sql } from "drizzle-orm"

import { db } from "@/db"

let ensureHelpDeskSchemaPromise: Promise<void> | null = null

async function syncHelpDeskSchema() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS helpdesk_knowledge_sources (
            id SERIAL PRIMARY KEY,
            slug VARCHAR(140) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            page_path VARCHAR(255),
            summary TEXT,
            content TEXT NOT NULL,
            tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_by TEXT REFERENCES "user"(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS helpdesk_knowledge_chunks (
            id SERIAL PRIMARY KEY,
            source_id INTEGER NOT NULL REFERENCES helpdesk_knowledge_sources(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS helpdesk_training_logs (
            id SERIAL PRIMARY KEY,
            source_id INTEGER REFERENCES helpdesk_knowledge_sources(id) ON DELETE SET NULL,
            trained_by TEXT REFERENCES "user"(id),
            trained_at TIMESTAMP NOT NULL DEFAULT NOW(),
            notes TEXT
        );
    `)
}

export async function ensureHelpDeskSchema() {
    if (!ensureHelpDeskSchemaPromise) {
        ensureHelpDeskSchemaPromise = syncHelpDeskSchema().catch((error) => {
            ensureHelpDeskSchemaPromise = null
            throw error
        })
    }

    await ensureHelpDeskSchemaPromise
}
