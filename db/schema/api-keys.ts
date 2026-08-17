import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const apiKeys = pgTable("api_keys", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    key: text("key").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    scopes: jsonb("scopes").$type<string[]>().default(["all"]).notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at")
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: timestamp("updated_at")
        .$defaultFn(() => new Date())
        .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
})

export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
