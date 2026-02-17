import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const auditLogs = pgTable("audit_logs", {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").references(() => user.id),
    action: varchar("action", { length: 100 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
