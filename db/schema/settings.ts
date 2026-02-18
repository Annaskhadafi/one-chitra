import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
    key: varchar("key", { length: 50 }).primaryKey(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
