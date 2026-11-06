import { relations } from "drizzle-orm"
import {
    boolean,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const vendorTenantStatusEnum = pgEnum("vendor_tenant_status", [
    "pending_invitation",
    "active",
    "suspended",
])

export const vendorInvoiceStatusEnum = pgEnum("vendor_invoice_status", [
    "draft",
    "submitted",
    "verified_admin",
    "rejected_admin",
    "validated_finance",
    "rejected_finance",
    "approved_manager",
    "rejected_manager",
    "paid",
])

// 1. Multi-Tenant Vendor Organizations
export const vendorTenants = pgTable(
    "vendor_tenants",
    {
        id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
        code: varchar("code", { length: 50 }).notNull().unique(),
        name: text("name").notNull(),
        email: text("email").notNull().unique(),
        phone: text("phone"),
        address: text("address"),
        npwp: text("npwp"),
        isPkp: boolean("is_pkp").default(false).notNull(),
        bankName: text("bank_name"),
        bankAccountNo: text("bank_account_no"),
        bankAccountHolder: text("bank_account_holder"),
        defaultTopDays: integer("default_top_days").default(30).notNull(),
        status: vendorTenantStatusEnum("status").default("pending_invitation").notNull(),
        // Invitation system
        invitationToken: varchar("invitation_token", { length: 100 }).unique(),
        invitationExpiresAt: timestamp("invitation_expires_at"),
        invitedAt: timestamp("invited_at"),
        invitedBy: text("invited_by").references(() => user.id),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        codeIdx: index("vendor_tenants_code_idx").on(table.code),
        emailIdx: index("vendor_tenants_email_idx").on(table.email),
        statusIdx: index("vendor_tenants_status_idx").on(table.status),
        invitationTokenIdx: index("vendor_tenants_invitation_token_idx").on(table.invitationToken),
    })
)

// 2. Multi-Tenant User Mapping
export const vendorTenantUsers = pgTable(
    "vendor_tenant_users",
    {
        id: serial("id").primaryKey(),
        tenantId: varchar("tenant_id", { length: 36 })
            .notNull()
            .references(() => vendorTenants.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        role: varchar("role", { length: 30 }).default("owner").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        tenantUserUnique: uniqueIndex("vendor_tenant_users_unique").on(table.tenantId, table.userId),
        tenantIdx: index("vendor_tenant_users_tenant_idx").on(table.tenantId),
        userIdx: index("vendor_tenant_users_user_idx").on(table.userId),
    })
)

// 3. Batch Payment Checkout (Finance Disbursement)
export const vendorPaymentBatches = pgTable(
    "vendor_payment_batches",
    {
        id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
        batchCode: varchar("batch_code", { length: 60 }).notNull().unique(),
        paymentDate: timestamp("payment_date").notNull(),
        totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).default("0").notNull(),
        totalInvoices: integer("total_invoices").default(0).notNull(),
        bankSource: text("bank_source").notNull(),
        proofFileUrl: text("proof_file_url").notNull(),
        referenceNo: text("reference_no"),
        notes: text("notes"),
        disbursedBy: text("disbursed_by").references(() => user.id),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        batchCodeIdx: index("vendor_payment_batches_code_idx").on(table.batchCode),
        paymentDateIdx: index("vendor_payment_batches_date_idx").on(table.paymentDate),
    })
)

// 4. Invoices
export const vendorInvoices = pgTable(
    "vendor_invoices",
    {
        id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
        tenantId: varchar("tenant_id", { length: 36 })
            .notNull()
            .references(() => vendorTenants.id, { onDelete: "cascade" }),
        invoiceNumber: varchar("invoice_number", { length: 150 }).notNull(),
        poNumber: varchar("po_number", { length: 100 }).notNull(),
        invoiceDate: timestamp("invoice_date").notNull(),

        // Financial Amounts
        subtotal: numeric("subtotal", { precision: 18, scale: 2 }).default("0").notNull(),
        ppnPercent: numeric("ppn_percent", { precision: 5, scale: 2 }).default("11").notNull(),
        ppnAmount: numeric("ppn_amount", { precision: 18, scale: 2 }).default("0").notNull(),
        pphPercent: numeric("pph_percent", { precision: 5, scale: 2 }).default("0").notNull(),
        pphAmount: numeric("pph_amount", { precision: 18, scale: 2 }).default("0").notNull(),
        grandTotal: numeric("grand_total", { precision: 18, scale: 2 }).default("0").notNull(),
        currency: varchar("currency", { length: 10 }).default("IDR").notNull(),
        topDays: integer("top_days").default(30).notNull(),

        // Lifecycle & Status
        status: vendorInvoiceStatusEnum("status").default("submitted").notNull(),
        rejectionReason: text("rejection_reason"),
        rejectionStage: varchar("rejection_stage", { length: 30 }),
        rejectionNotes: text("rejection_notes"),

        // Document Attachments (Persistent S3 / Dokploy Proxied URLs)
        invoiceFileUrl: text("invoice_file_url").notNull(),
        taxInvoiceFileUrl: text("tax_invoice_file_url"),
        poFileUrl: text("po_file_url"),
        deliveryReceiptFileUrl: text("delivery_receipt_file_url"),
        additionalFileUrl: text("additional_file_url"),

        // Validation Gate (Admin Checklist)
        checklistDocValid: boolean("checklist_doc_valid").default(false).notNull(),
        checklistPoValid: boolean("checklist_po_valid").default(false).notNull(),
        checklistCalcValid: boolean("checklist_calc_valid").default(false).notNull(),
        checklistBankValid: boolean("checklist_bank_valid").default(false).notNull(),
        checklistTaxValid: boolean("checklist_tax_valid").default(false).notNull(),
        adminChecklistNotes: text("admin_checklist_notes"),
        adminVerifiedAt: timestamp("admin_verified_at"),
        adminVerifiedBy: text("admin_verified_by").references(() => user.id),

        // Finance Validation & Cut-Off Engine
        financeValidatedAt: timestamp("finance_validated_at"),
        financeValidatedBy: text("finance_validated_by").references(() => user.id),
        financeNotes: text("finance_notes"),
        bookReceivedDate: timestamp("book_received_date"),
        paymentDueDate: timestamp("payment_due_date"),
        scheduledPaymentDate: timestamp("scheduled_payment_date"),

        // Manager Authorization
        managerApprovedAt: timestamp("manager_approved_at"),
        managerApprovedBy: text("manager_approved_by").references(() => user.id),
        managerNotes: text("manager_notes"),

        // Disbursement & Checkout
        paymentBatchId: varchar("payment_batch_id", { length: 36 }).references(
            () => vendorPaymentBatches.id,
            { onDelete: "set null" }
        ),
        paidAt: timestamp("paid_at"),
        paidProofUrl: text("paid_proof_url"),
        paidReferenceNo: text("paid_reference_no"),
        paidEmailSentAt: timestamp("paid_email_sent_at"),

        // Metadata
        createdBy: text("created_by").references(() => user.id),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        tenantInvoiceUnique: uniqueIndex("vendor_invoices_tenant_number_unique").on(
            table.tenantId,
            table.invoiceNumber
        ),
        tenantIdx: index("vendor_invoices_tenant_idx").on(table.tenantId),
        poIdx: index("vendor_invoices_po_idx").on(table.poNumber),
        statusIdx: index("vendor_invoices_status_idx").on(table.status),
        scheduledPaymentIdx: index("vendor_invoices_scheduled_payment_idx").on(table.scheduledPaymentDate),
        dueDateIdx: index("vendor_invoices_due_date_idx").on(table.paymentDueDate),
        batchIdx: index("vendor_invoices_batch_idx").on(table.paymentBatchId),
    })
)

// 5. Audit Log Timeline
export const vendorInvoiceLogs = pgTable(
    "vendor_invoice_logs",
    {
        id: serial("id").primaryKey(),
        invoiceId: varchar("invoice_id", { length: 36 })
            .notNull()
            .references(() => vendorInvoices.id, { onDelete: "cascade" }),
        action: varchar("action", { length: 50 }).notNull(),
        actorId: text("actor_id").references(() => user.id),
        actorName: text("actor_name"),
        actorRole: text("actor_role"),
        notes: text("notes"),
        metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        invoiceIdx: index("vendor_invoice_logs_invoice_idx").on(table.invoiceId),
        actionIdx: index("vendor_invoice_logs_action_idx").on(table.action),
        createdAtIdx: index("vendor_invoice_logs_created_at_idx").on(table.createdAt),
    })
)

// Relations
export const vendorTenantsRelations = relations(vendorTenants, ({ many, one }) => ({
    users: many(vendorTenantUsers),
    invoices: many(vendorInvoices),
    invitedByUser: one(user, {
        fields: [vendorTenants.invitedBy],
        references: [user.id],
    }),
}))

export const vendorTenantUsersRelations = relations(vendorTenantUsers, ({ one }) => ({
    tenant: one(vendorTenants, {
        fields: [vendorTenantUsers.tenantId],
        references: [vendorTenants.id],
    }),
    user: one(user, {
        fields: [vendorTenantUsers.userId],
        references: [user.id],
    }),
}))

export const vendorInvoicesRelations = relations(vendorInvoices, ({ one, many }) => ({
    tenant: one(vendorTenants, {
        fields: [vendorInvoices.tenantId],
        references: [vendorTenants.id],
    }),
    batch: one(vendorPaymentBatches, {
        fields: [vendorInvoices.paymentBatchId],
        references: [vendorPaymentBatches.id],
    }),
    adminVerifier: one(user, {
        fields: [vendorInvoices.adminVerifiedBy],
        references: [user.id],
        relationName: "adminVerifier",
    }),
    financeValidator: one(user, {
        fields: [vendorInvoices.financeValidatedBy],
        references: [user.id],
        relationName: "financeValidator",
    }),
    managerApprover: one(user, {
        fields: [vendorInvoices.managerApprovedBy],
        references: [user.id],
        relationName: "managerApprover",
    }),
    logs: many(vendorInvoiceLogs),
}))

export const vendorPaymentBatchesRelations = relations(vendorPaymentBatches, ({ many, one }) => ({
    invoices: many(vendorInvoices),
    disbursedByUser: one(user, {
        fields: [vendorPaymentBatches.disbursedBy],
        references: [user.id],
    }),
}))

export const vendorInvoiceLogsRelations = relations(vendorInvoiceLogs, ({ one }) => ({
    invoice: one(vendorInvoices, {
        fields: [vendorInvoiceLogs.invoiceId],
        references: [vendorInvoices.id],
    }),
    actor: one(user, {
        fields: [vendorInvoiceLogs.actorId],
        references: [user.id],
    }),
}))
