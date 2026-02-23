import { pgTable, serial, integer, varchar, timestamp, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { warehouses } from "./warehouses";
import { products } from "./products";
import { deliveries } from "./deliveries";

export const stockTransfers = pgTable("stock_transfers", {
    id: serial("id").primaryKey(),
    referenceNumber: varchar("reference_number", { length: 50 }).unique(),
    deliveryId: integer("delivery_id").references(() => deliveries.id),
    fromWarehouseId: integer("from_warehouse_id").references(() => warehouses.id).notNull(),
    toWarehouseId: integer("to_warehouse_id").references(() => warehouses.id).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // DEPRECATED: use receivedStatus
    receivedStatus: varchar("received_status", { length: 20 }).default("Scheduled").notNull(), // Scheduled, Received, Rejected
    postingDocumentNo: varchar("posting_document_no", { length: 100 }),
    batchNo: varchar("batch_no", { length: 100 }),
    notes: text("notes"),
    transferDate: timestamp("transfer_date").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stockTransferItems = pgTable("stock_transfer_items", {
    id: serial("id").primaryKey(),
    transferId: integer("transfer_id").references(() => stockTransfers.id, { onDelete: 'cascade' }).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    quantity: integer("quantity").notNull(),
});

export const stockTransfersRelations = relations(stockTransfers, ({ one, many }) => ({
    fromWarehouse: one(warehouses, {
        fields: [stockTransfers.fromWarehouseId],
        references: [warehouses.id],
        relationName: "transfersFrom"
    }),
    toWarehouse: one(warehouses, {
        fields: [stockTransfers.toWarehouseId],
        references: [warehouses.id],
        relationName: "transfersTo"
    }),
    delivery: one(deliveries, {
        fields: [stockTransfers.deliveryId],
        references: [deliveries.id],
    }),
    items: many(stockTransferItems),
}));

export const stockTransferItemsRelations = relations(stockTransferItems, ({ one }) => ({
    transfer: one(stockTransfers, {
        fields: [stockTransferItems.transferId],
        references: [stockTransfers.id],
    }),
    product: one(products, {
        fields: [stockTransferItems.productId],
        references: [products.id],
    }),
}));
