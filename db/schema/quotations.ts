import { pgTable, serial, varchar, integer, numeric, text, timestamp, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";
import { customers } from "./customers";
import { products } from "./products";
import { salesOrders } from "./sales-orders";

export type QuotationRevisionSnapshot = {
    quotation: {
        quotationNumber: string | null
        customerId: number
        quotationDate: string
        validUntil: string | null
        subject: string | null
        status: string
        paymentTerms: string | null
        termsConditions: string | null
        notes: string | null
        salesPersonId: string | null
        attn: string | null
        discount: string
        tax: string
        shipping: string
        address: string | null
        closingStatus: string | null
        tags: string | null
        currency: string | null
        referenceNumber: string | null
        adminNote: string | null
        clientNote: string | null
        discountType: string | null
        customerPoNumber: string | null
        customerPoDocument: string | null
        customerPoUploadedAt: string | null
        poValidationStatus: string | null
        poValidationCheckedAt: string | null
        poValidationOcrSessionId: number | null
        poValidationSummary: QuotationPoValidationSummary | null
        salesOrderId: number | null
    }
    items: Array<{
        productId: number | null
        description: string | null
        longDescription: string | null
        quantity: number
        unitPrice: string
        discount: string
        tax: string
    }>
    attachments: Array<{
        id?: number
        kind: string
        title: string
        fileUrl: string
        fileName: string
        mimeType: string | null
        fileSize: number
        description: string | null
        includeInPdf: boolean
        createdAt?: string
    }>
}

export type QuotationPoValidationSummary = {
    status: "full_match" | "partial_match" | "mismatch" | "ocr_failed"
    checkedAt: string
    documentNumber: string | null
    documentDate: string | null
    customerName: string | null
    customerMatched: boolean
    customerConfidence: number
    matchedItemCount: number
    quotationItemCount: number
    ocrItemCount: number
    unmatchedQuotationItemCount: number
    unmatchedOcrItemCount: number
    requiresManualReview: boolean
    ocrSessionId?: number | null
    reasons: string[]
    comparisons: Array<{
        key: string
        ocrName: string
        ocrCode: string | null
        ocrQuantity: number
        ocrUnitPrice: string
        matchedQuotationItemId: number | null
        quotationMaterialNumber: string | null
        quotationDescription: string | null
        quotationQuantity: number | null
        quotationUnitPrice: string | null
        matchConfidence: number
        status: "matched" | "partial_qty" | "qty_exceeds" | "price_changed" | "unmatched_ocr"
        quantityDelta: number | null
        priceDelta: string | null
        priceDeltaPercent: number | null
    }>
    unmatchedQuotationItems: Array<{
        quotationItemId: number
        materialNumber: string | null
        description: string | null
        quantity: number
        unitPrice: string
    }>
}

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
    currentRevision: integer("current_revision").default(1).notNull(),
    lastRevisionAt: timestamp("last_revision_at"),
    expiredAt: timestamp("expired_at"),
    customerPoNumber: varchar("customer_po_number", { length: 100 }),
    customerPoDocument: varchar("customer_po_document", { length: 255 }),
    customerPoUploadedAt: timestamp("customer_po_uploaded_at"),
    customerPoUploadedBy: varchar("customer_po_uploaded_by").references(() => user.id),
    poValidationStatus: varchar("po_validation_status", { length: 30 }),
    poValidationCheckedAt: timestamp("po_validation_checked_at"),
    poValidationOcrSessionId: integer("po_validation_ocr_session_id"),
    poValidationSummary: jsonb("po_validation_summary").$type<QuotationPoValidationSummary>(),
    autoConvertedAt: timestamp("auto_converted_at"),
    autoConvertedBy: varchar("auto_converted_by").references(() => user.id),
});

export const quotationItems = pgTable("quotation_items", {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id").references(() => quotations.id, { onDelete: "cascade" }).notNull(),
    productId: integer("product_id").references(() => products.id),
    quantity: integer("quantity").notNull(),
    description: text("description"),
    longDescription: text("long_description"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 12, scale: 2 }).default("0").notNull(),
    tax: numeric("tax", { precision: 12, scale: 2 }).default("0").notNull(),
});

export const quotationAttachments = pgTable("quotation_attachments", {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id").references(() => quotations.id, { onDelete: "cascade" }).notNull(),
    kind: varchar("kind", { length: 30 }).default("supporting").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    fileUrl: varchar("file_url", { length: 255 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 150 }),
    fileSize: integer("file_size").default(0).notNull(),
    description: text("description"),
    includeInPdf: boolean("include_in_pdf").default(true).notNull(),
    uploadedBy: varchar("uploaded_by").references(() => user.id).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quotationRevisions = pgTable("quotation_revisions", {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id").references(() => quotations.id, { onDelete: "cascade" }).notNull(),
    revisionNumber: integer("revision_number").notNull(),
    snapshot: jsonb("snapshot").$type<QuotationRevisionSnapshot>().notNull(),
    changeSummary: text("change_summary"),
    createdBy: varchar("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    quotationRevisionUnique: uniqueIndex("quotation_revisions_quotation_revision_idx").on(table.quotationId, table.revisionNumber),
}));

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
    attachments: many(quotationAttachments),
    revisions: many(quotationRevisions),
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

export const quotationAttachmentsRelations = relations(quotationAttachments, ({ one }) => ({
    quotation: one(quotations, {
        fields: [quotationAttachments.quotationId],
        references: [quotations.id],
    }),
    uploadedByUser: one(user, {
        fields: [quotationAttachments.uploadedBy],
        references: [user.id],
    }),
}));

export const quotationRevisionsRelations = relations(quotationRevisions, ({ one }) => ({
    quotation: one(quotations, {
        fields: [quotationRevisions.quotationId],
        references: [quotations.id],
    }),
    createdByUser: one(user, {
        fields: [quotationRevisions.createdBy],
        references: [user.id],
    }),
}));
