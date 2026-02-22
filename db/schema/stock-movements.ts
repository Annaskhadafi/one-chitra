import { pgTable, serial, integer, varchar, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { products } from "./products";
import { warehouses } from "./warehouses";
import { user } from "./auth";

export const stockMovements = pgTable("stock_movements", {
    id: serial("id").primaryKey(),
    productId: integer("product_id").references(() => products.id).notNull(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id).notNull(),
    quantity: integer("quantity").notNull(), // Positive for In, Negative for Out
    type: varchar("type", { length: 50 }).notNull(), // GR_SAP, GR_MANUAL, DELIVERY, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT
    referenceNumber: varchar("reference_number", { length: 100 }),
    recordedBy: text("recorded_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
    product: one(products, {
        fields: [stockMovements.productId],
        references: [products.id],
    }),
    warehouse: one(warehouses, {
        fields: [stockMovements.warehouseId],
        references: [warehouses.id],
    }),
    recordedByUser: one(user, {
        fields: [stockMovements.recordedBy],
        references: [user.id],
    }),
}));
