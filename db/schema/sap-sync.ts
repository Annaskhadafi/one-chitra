import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const sapSyncLogs = pgTable("sap_sync_logs", {
    id: serial("id").primaryKey(),
    syncType: varchar("sync_type", { length: 50 }),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    status: varchar("status", { length: 50 }),
    notes: text("notes"),
});
