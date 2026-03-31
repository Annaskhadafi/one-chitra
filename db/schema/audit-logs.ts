import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

export const auditLogs = pgTable("audit_logs", {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").references(() => user.id),
    action: varchar("action", { length: 100 }).notNull(),
    tableName: varchar("table_name", { length: 100 }),
    recordId: varchar("record_id", { length: 100 }),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    user: one(user, {
        fields: [auditLogs.userId],
        references: [user.id],
    }),
}));
