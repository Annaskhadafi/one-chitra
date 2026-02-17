import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { warehouses } from "./warehouses";
import { products } from "./products";

export const interWarehouseTransfers = pgTable("inter_warehouse_transfers", {
    id: serial("id").primaryKey(),
    fromWarehouse: integer("from_warehouse").references(() => warehouses.id).notNull(),
    toWarehouse: integer("to_warehouse").references(() => warehouses.id).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    quantity: integer("quantity").notNull(),
    status: varchar("status", { length: 50 }).default("PENDING").notNull(),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
});
