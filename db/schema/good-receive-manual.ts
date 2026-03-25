import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { products } from "./products";
import { warehouses } from "./warehouses";

export const goodReceiveManual = pgTable("good_receive_manual", {
    id: serial("id").primaryKey(),
    supplier: text("supplier").notNull(),
    poNumber: text("po_number").notNull(),
    receiveDate: date("receive_date").notNull(),
    deliveryType: text("delivery_type", { enum: ["Partial", "Complete"] }).notNull(),
    referenceDocument: text("reference_document"),
    vendorDoUrl: text("vendor_do_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const goodReceiveManualRelations = relations(goodReceiveManual, ({ many }) => ({
    items: many(goodReceiveManualItems),
}));

export const goodReceiveManualItems = pgTable("good_receive_manual_items", {
    id: serial("id").primaryKey(),
    headerId: integer("header_id").references(() => goodReceiveManual.id).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id).notNull(),
    quantity: integer("quantity").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goodReceiveManualItemsRelations = relations(goodReceiveManualItems, ({ one }) => ({
    header: one(goodReceiveManual, {
        fields: [goodReceiveManualItems.headerId],
        references: [goodReceiveManual.id],
    }),
    product: one(products, {
        fields: [goodReceiveManualItems.productId],
        references: [products.id],
    }),
    warehouse: one(warehouses, {
        fields: [goodReceiveManualItems.warehouseId],
        references: [warehouses.id],
    }),
}));
