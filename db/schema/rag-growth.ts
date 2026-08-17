import { relations, sql } from "drizzle-orm"
import { boolean, integer, pgTable, real, serial, text, timestamp, varchar } from "drizzle-orm/pg-core"
import { user } from "./auth"

/**
 * Tabel Memori Pintar & Fakta Self-Growth untuk Chitra Genius AI
 * Menyimpan pengetahuan, aturan bisnis, SOP, dan koreksi tanpa harus upload PDF.
 */
export const ragMemoryFacts = pgTable("rag_memory_facts", {
    id: serial("id").primaryKey(),
    topic: varchar("topic", { length: 120 }).default("Umum").notNull(),
    fact: text("fact").notNull(),
    source: varchar("source", { length: 255 }).default("Self-Growth Input").notNull(),
    tags: text("tags").array().default(sql`'{}'::text[]`).notNull(),
    confidenceScore: real("confidence_score").default(1.0).notNull(),
    ragDocumentId: varchar("rag_document_id", { length: 120 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/**
 * Tabel Feedback & Koreksi Pengguna untuk Self-Growth Chitra Genius
 * Mencatat thumbs up / thumbs down dan teks perbaikan jawaban.
 */
export const ragFeedbacks = pgTable("rag_feedbacks", {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id", { length: 120 }),
    messageId: varchar("message_id", { length: 120 }),
    query: text("query").notNull(),
    answer: text("answer").notNull(),
    rating: varchar("rating", { length: 20 }).notNull(), // 'positive' | 'negative' | 'thumbs_up' | 'thumbs_down'
    correction: text("correction"),
    isLearned: boolean("is_learned").default(false).notNull(),
    userId: text("user_id").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const ragMemoryFactsRelations = relations(ragMemoryFacts, ({ one }) => ({
    creator: one(user, {
        fields: [ragMemoryFacts.createdBy],
        references: [user.id],
    }),
}))

export const ragFeedbacksRelations = relations(ragFeedbacks, ({ one }) => ({
    user: one(user, {
        fields: [ragFeedbacks.userId],
        references: [user.id],
    }),
}))
