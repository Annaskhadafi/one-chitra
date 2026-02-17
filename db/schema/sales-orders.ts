import { pgTable, serial, varchar, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { customers } from "./customers";
import { warehouses } from "./warehouses";
import { products } from "./products";

export const salesOrders = pgTable("sales_orders", {
    id: serial("id").primaryKey(),
    invoiceNumber: varchar("invoice_number", { length: 50 }).unique(),
    customerPo: varchar("customer_po", { length: 100 }),
    customerId: integer("customer_id").references(() => customers.id).notNull(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    salesDate: timestamp("sales_date").defaultNow().notNull(),
    status: varchar("status", { length: 20 }).default("draft").notNull(),
    termsConditions: text("terms_conditions"),
    notes: text("notes"),
    discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
    shipping: numeric("shipping", { precision: 12, scale: 2 }).default("0").notNull(),
    createdBy: varchar("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const salesOrderItems = pgTable("sales_order_items", {
    id: serial("id").primaryKey(),
    salesOrderId: integer("sales_order_id").references(() => salesOrders.id, { onDelete: "cascade" }).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
    tax: numeric("tax", { precision: 12, scale: 2 }).default("0").notNull(),
});

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
    customer: one(customers, {
        fields: [salesOrders.customerId],
        references: [customers.id],
    }),
    createdByUser: one(user, {
        fields: [salesOrders.createdBy],
        references: [user.id],
    }),
    items: many(salesOrderItems),
}));

export const salesOrderItemsRelations = relations(salesOrderItems, ({ one }) => ({
    salesOrder: one(salesOrders, {
        fields: [salesOrderItems.salesOrderId],
        references: [salesOrders.id],
    }),
    product: one(products, {
        fields: [salesOrderItems.productId],
        references: [products.id],
    }),
}));
