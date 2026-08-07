import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const embedTokens = pgTable("embed_tokens", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    token: text("token").notNull().unique(),
    pagePath: text("page_path").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at")
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: timestamp("updated_at")
        .$defaultFn(() => new Date())
        .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
});
