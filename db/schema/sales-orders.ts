import { pgTable, serial, varchar, integer, numeric, text, timestamp, index } from "drizzle-orm/pg-core";
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
    shippingApprovalStatus: varchar("shipping_approval_status", { length: 30 }).default("-").notNull(),
    shippingApprovalBatchId: varchar("shipping_approval_batch_id", { length: 100 }),
    shippingApprovalUserComment: text("shipping_approval_user_comment"),
    shippingApprovalNotes: text("shipping_approval_notes"),
    shippingApprovalRequestedAt: timestamp("shipping_approval_requested_at"),
    shippingApprovalRequestedBy: text("shipping_approval_requested_by").references(() => user.id),
    shippingApprovedAt: timestamp("shipping_approved_at"),
    shippingApprovedBy: text("shipping_approved_by").references(() => user.id),
    createdBy: varchar("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    customerIdIdx: index("sales_orders_customer_id_idx").on(table.customerId),
    salesPersonIdIdx: index("sales_orders_sales_person_id_idx").on(table.salesPersonId),
    warehouseIdIdx: index("sales_orders_warehouse_id_idx").on(table.warehouseId),
    statusIdx: index("sales_orders_status_idx").on(table.status),
    shippingApprovalStatusIdx: index("sales_orders_shipping_approval_status_idx").on(table.shippingApprovalStatus),
    salesDateIdx: index("sales_orders_sales_date_idx").on(table.salesDate),
    quotationIdIdx: index("sales_orders_quotation_id_idx").on(table.quotationId),
}));

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
}, (table) => ({
    salesOrderIdIdx: index("sales_order_items_sales_order_id_idx").on(table.salesOrderId),
    productIdIdx: index("sales_order_items_product_id_idx").on(table.productId),
}));

export const shippingApprovalRequests = pgTable("shipping_approval_requests", {
    id: varchar("id", { length: 100 }).primaryKey(),
    batchNumber: varchar("batch_number", { length: 100 }).notNull(),
    requesterId: text("requester_id").references(() => user.id).notNull(),
    approverId: text("approver_id").references(() => user.id),
    status: varchar("status", { length: 30 }).default("Waiting Approve").notNull(),
    userComment: text("user_comment"),
    approverNotes: text("approver_notes"),
    totalOrders: integer("total_orders").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    approvedAt: timestamp("approved_at"),
}, (table) => ({
    statusIdx: index("shipping_approval_requests_status_idx").on(table.status),
    requesterIdx: index("shipping_approval_requests_requester_idx").on(table.requesterId),
}));

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
    shippingApprovalRequestedByUser: one(user, {
        fields: [salesOrders.shippingApprovalRequestedBy],
        references: [user.id],
    }),
    shippingApprovedByUser: one(user, {
        fields: [salesOrders.shippingApprovedBy],
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

export const shippingApprovalRequestsRelations = relations(shippingApprovalRequests, ({ one }) => ({
    requester: one(user, {
        fields: [shippingApprovalRequests.requesterId],
        references: [user.id],
    }),
    approver: one(user, {
        fields: [shippingApprovalRequests.approverId],
        references: [user.id],
    }),
}));
