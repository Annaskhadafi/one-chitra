import { pgTable, serial, integer, timestamp, unique, numeric } from "drizzle-orm/pg-core";
import { warehouses } from "./warehouses";
import { products } from "./products";

export const stockLevels = pgTable("stock_levels", {
    id: serial("id").primaryKey(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    valuationValue: numeric("valuation_value", { precision: 20, scale: 2 }).default("0").notNull(),
    totalStock: integer("total_stock").default(0).notNull(),
    minStock: integer("min_stock").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    unique("stock_levels_warehouse_product_unique").on(table.warehouseId, table.productId),
]);
