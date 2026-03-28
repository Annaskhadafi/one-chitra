import { relations } from "drizzle-orm"
import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const helpdeskKnowledgeSources = pgTable("helpdesk_knowledge_sources", {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 140 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    pagePath: varchar("page_path", { length: 255 }),
    summary: text("summary"),
    content: text("content").notNull(),
    tags: text("tags").array().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const helpdeskKnowledgeChunks = pgTable("helpdesk_knowledge_chunks", {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").references(() => helpdeskKnowledgeSources.id, { onDelete: "cascade" }).notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const helpdeskTrainingLogs = pgTable("helpdesk_training_logs", {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id").references(() => helpdeskKnowledgeSources.id, { onDelete: "set null" }),
    trainedBy: text("trained_by").references(() => user.id),
    trainedAt: timestamp("trained_at").defaultNow().notNull(),
    notes: text("notes"),
})

export const helpdeskKnowledgeSourcesRelations = relations(helpdeskKnowledgeSources, ({ one, many }) => ({
    creator: one(user, {
        fields: [helpdeskKnowledgeSources.createdBy],
        references: [user.id],
    }),
    chunks: many(helpdeskKnowledgeChunks),
    trainingLogs: many(helpdeskTrainingLogs),
}))

export const helpdeskKnowledgeChunksRelations = relations(helpdeskKnowledgeChunks, ({ one }) => ({
    source: one(helpdeskKnowledgeSources, {
        fields: [helpdeskKnowledgeChunks.sourceId],
        references: [helpdeskKnowledgeSources.id],
    }),
}))

export const helpdeskTrainingLogsRelations = relations(helpdeskTrainingLogs, ({ one }) => ({
    source: one(helpdeskKnowledgeSources, {
        fields: [helpdeskTrainingLogs.sourceId],
        references: [helpdeskKnowledgeSources.id],
    }),
    trainer: one(user, {
        fields: [helpdeskTrainingLogs.trainedBy],
        references: [user.id],
    }),
}))
