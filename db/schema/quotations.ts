import { pgTable, serial, varchar, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { customers } from "./customers";
import { products } from "./products";
import { salesOrders } from "./sales-orders";

export const quotations = pgTable("quotations", {
    id: serial("id").primaryKey(),
    quotationNumber: varchar("quotation_number", { length: 50 }).unique(),
    customerId: integer("customer_id").references(() => customers.id).notNull(),
    quotationDate: timestamp("quotation_date").defaultNow().notNull(),
    validUntil: timestamp("valid_until"),
    subject: varchar("subject", { length: 500 }),
    createdBy: varchar("created_by").references(() => user.id).notNull(),
    status: varchar("status", { length: 50 }).default("draft").notNull(),
    paymentTerms: text("payment_terms"),
    termsConditions: text("terms_conditions"),
    notes: text("notes"),
    discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
    tax: numeric("tax", { precision: 12, scale: 2 }).default("0").notNull(),
    shipping: numeric("shipping", { precision: 12, scale: 2 }).default("0").notNull(),
    salesOrderId: integer("sales_order_id").references(() => salesOrders.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    approvedAt: timestamp("approved_at"),
    approvedBy: varchar("approved_by").references(() => user.id),
    rejectedAt: timestamp("rejected_at"),
    rejectedBy: varchar("rejected_by").references(() => user.id),
    rejectionReason: text("rejection_reason"),
    salesPersonId: text("sales_person_id").references(() => user.id),
    attn: varchar("attn", { length: 200 }),
    address: text("address"),
    closingStatus: varchar("closing_status", { length: 50 }),
    tags: text("tags"),
    currency: varchar("currency", { length: 10 }).default("IDR"),
    referenceNumber: varchar("reference_number", { length: 100 }),
    adminNote: text("admin_note"),
    clientNote: text("client_note"),
    discountType: varchar("discount_type", { length: 20 }).default("fixed"),
});

export const quotationItems = pgTable("quotation_items", {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id").references(() => quotations.id, { onDelete: "cascade" }).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    quantity: integer("quantity").notNull(),
    description: text("description"),
    longDescription: text("long_description"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
    tax: numeric("tax", { precision: 12, scale: 2 }).default("0").notNull(),
});

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
    customer: one(customers, {
        fields: [quotations.customerId],
        references: [customers.id],
    }),
    createdByUser: one(user, {
        fields: [quotations.createdBy],
        references: [user.id],
    }),
    salesOrder: one(salesOrders, {
        fields: [quotations.salesOrderId],
        references: [salesOrders.id],
    }),
    salesPerson: one(user, {
        fields: [quotations.salesPersonId],
        references: [user.id],
    }),
    items: many(quotationItems),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
    quotation: one(quotations, {
        fields: [quotationItems.quotationId],
        references: [quotations.id],
    }),
    product: one(products, {
        fields: [quotationItems.productId],
        references: [products.id],
    }),
}));
