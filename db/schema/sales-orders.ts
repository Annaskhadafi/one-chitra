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
    tripDestination: varchar("trip_destination", { length: 255 }),
    customerId: integer("customer_id").references(() => customers.id).notNull(),
    salesPersonId: text("sales_person_id").references(() => user.id),
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    salesDate: timestamp("sales_date").defaultNow().notNull(),
    poReceive: timestamp("po_receive"),
    categoryPo: varchar("category_po", { length: 50 }),
    categoryProduct: varchar("category_product", { length: 50 }),
    poDocument: varchar("po_document", { length: 255 }),
    status: varchar("status", { length: 20 }).default("draft").notNull(),
    termsConditions: text("terms_conditions"),
    notes: text("notes"),
    discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
    shipping: numeric("shipping", { precision: 12, scale: 2 }).default("0").notNull(),
    sourceType: varchar("source_type", { length: 30 }),
    quotationId: integer("quotation_id"),
    quotationNumber: varchar("quotation_number", { length: 50 }),
    quotationRevision: integer("quotation_revision"),
    quotationSubject: varchar("quotation_subject", { length: 500 }),
    quotationReferenceNumber: varchar("quotation_reference_number", { length: 100 }),
    quotationValidUntil: timestamp("quotation_valid_until"),
    quotationCurrency: varchar("quotation_currency", { length: 10 }),
    quotationDiscountType: varchar("quotation_discount_type", { length: 20 }),
    quotationTax: numeric("quotation_tax", { precision: 12, scale: 2 }),
    quotationAdminNote: text("quotation_admin_note"),
    quotationClientNote: text("quotation_client_note"),
    customerAttn: varchar("customer_attn", { length: 200 }),
    createdBy: varchar("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const salesOrderItems = pgTable("sales_order_items", {
    id: serial("id").primaryKey(),
    salesOrderId: integer("sales_order_id").references(() => salesOrders.id, { onDelete: "cascade" }).notNull(),
    productId: integer("product_id").references(() => products.id),
    sourceQuotationItemId: integer("source_quotation_item_id"),
    description: text("description"),
    longDescription: text("long_description"),
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
    salesPerson: one(user, {
        fields: [salesOrders.salesPersonId],
        references: [user.id],
    }),
    warehouse: one(warehouses, {
        fields: [salesOrders.warehouseId],
        references: [warehouses.id],
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
