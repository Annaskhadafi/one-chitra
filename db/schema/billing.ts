import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { deliveries } from "./deliveries";

export const billingRecords = pgTable("billing_records", {
    id: serial("id").primaryKey(),
    deliveryId: integer("delivery_id").references(() => deliveries.id).notNull(),
    status: varchar("status", { length: 50 }).default("PENDING").notNull(),
    exportFile: varchar("export_file", { length: 200 }),
    exportedAt: timestamp("exported_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
