import { pgTable, serial, integer, date, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { quotations } from "./quotations";
import { products } from "./products";

export const deliveries = pgTable("deliveries", {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id").references(() => quotations.id).notNull(),
    deliveryDate: date("delivery_date"),
    status: varchar("status", { length: 50 }).default("SCHEDULED").notNull(),
    podUrl: text("pod_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
});

export const deliveryItems = pgTable("delivery_items", {
    id: serial("id").primaryKey(),
    deliveryId: integer("delivery_id").references(() => deliveries.id, { onDelete: "cascade" }).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    quantity: integer("quantity").notNull(),
});
