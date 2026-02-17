import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { warehouses } from "./warehouses";
import { products } from "./products";

export const stockLevels = pgTable("stock_levels", {
    id: serial("id").primaryKey(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    realStock: integer("real_stock").default(0).notNull(),
    sapStock: integer("sap_stock").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    unique("stock_levels_warehouse_product_unique").on(table.warehouseId, table.productId),
]);
