import { pgTable, serial, integer, timestamp, unique, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { warehouses } from "./warehouses";
import { products } from "./products";
import { stockCustomerBookings } from "./stock-bookings";

export const stockLevels = pgTable("stock_levels", {
    id: serial("id").primaryKey(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    valuationValue: numeric("valuation_value", { precision: 20, scale: 2 }).default("0").notNull(),
    draftBookedStock: integer("draft_booked_stock").default(0).notNull(),
    bookedStock: integer("booked_stock").default(0).notNull(),
    totalStock: integer("total_stock").default(0).notNull(),
    minStock: integer("min_stock").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    unique("stock_levels_warehouse_product_unique").on(table.warehouseId, table.productId),
]);

export const stockLevelsRelations = relations(stockLevels, ({ one, many }) => ({
    product: one(products, {
        fields: [stockLevels.productId],
        references: [products.id],
    }),
    warehouse: one(warehouses, {
        fields: [stockLevels.warehouseId],
        references: [warehouses.id],
    }),
    stockBookings: many(stockCustomerBookings),
}));
