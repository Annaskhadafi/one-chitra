import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { salesOrders, salesOrderItems } from "./sales-orders";
import { warehouses } from "./warehouses";
import { products } from "./products";
import { user } from "./auth";

export const deliveries = pgTable("deliveries", {
    id: serial("id").primaryKey(),
    deliveryNumber: varchar("delivery_number", { length: 50 }).unique(),
    salesOrderId: integer("sales_order_id").references(() => salesOrders.id).notNull(),
    scheduledDate: timestamp("scheduled_date").notNull(),
    deliveryDate: timestamp("delivery_date"),
    status: varchar("status", { length: 20 }).default("scheduled").notNull(),
    deliveryType: varchar("delivery_type", { length: 20 }).default("full").notNull(),
    driverName: varchar("driver_name", { length: 255 }),
    vehicleNumber: varchar("vehicle_number", { length: 50 }),
    vehicleType: varchar("vehicle_type", { length: 50 }),
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    shippingAddress: text("shipping_address"),
    notes: text("notes"),
    createdBy: varchar("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deliveryItems = pgTable("delivery_items", {
    id: serial("id").primaryKey(),
    deliveryId: integer("delivery_id").references(() => deliveries.id, { onDelete: "cascade" }).notNull(),
    salesOrderItemId: integer("sales_order_item_id").references(() => salesOrderItems.id),
    productId: integer("product_id").references(() => products.id).notNull(),
    orderedQuantity: integer("ordered_quantity").default(0).notNull(),
    deliveredQuantity: integer("delivered_quantity").default(0).notNull(),
    serialNumbers: text("serial_numbers").array(),
});

export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
    salesOrder: one(salesOrders, {
        fields: [deliveries.salesOrderId],
        references: [salesOrders.id],
    }),
    warehouse: one(warehouses, {
        fields: [deliveries.warehouseId],
        references: [warehouses.id],
    }),
    createdByUser: one(user, {
        fields: [deliveries.createdBy],
        references: [user.id],
    }),
    items: many(deliveryItems),
}));

export const deliveryItemsRelations = relations(deliveryItems, ({ one }) => ({
    delivery: one(deliveries, {
        fields: [deliveryItems.deliveryId],
        references: [deliveries.id],
    }),
    salesOrderItem: one(salesOrderItems, {
        fields: [deliveryItems.salesOrderItemId],
        references: [salesOrderItems.id],
    }),
    product: one(products, {
        fields: [deliveryItems.productId],
        references: [products.id],
    }),
}));
