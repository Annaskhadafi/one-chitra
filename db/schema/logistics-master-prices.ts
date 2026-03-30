import { pgTable, serial, varchar, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const logisticsMasterPrices = pgTable("logistics_master_prices", {
    id: serial("id").primaryKey(),
    fromLocation: varchar("from_location", { length: 160 }).notNull(),
    toLocation: varchar("to_location", { length: 200 }).notNull(),
    cost: numeric("cost", { precision: 16, scale: 2 }).default("0").notNull(),
    truckType: varchar("truck_type", { length: 120 }),
    statusTb: text("status_tb"),
    ring24: integer("ring_24"),
    ring25: integer("ring_25"),
    ring29: integer("ring_29"),
    ring33: integer("ring_33"),
    ring35: integer("ring_35"),
    ring49: integer("ring_49"),
    ring51: integer("ring_51"),
    ring57: integer("ring_57"),
    ring63: integer("ring_63"),
    productType: varchar("product_type", { length: 80 }),
    notes: text("notes"),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
