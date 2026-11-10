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
        // SAP Master Linkage
        sapVendorCode: varchar("sap_vendor_code", { length: 20 }),
        sapTopCode: varchar("sap_top_code", { length: 10 }),
        sapCurrency: varchar("sap_currency", { length: 10 }),
        sapSalesperson: text("sap_salesperson"),
        sapTelephone: text("sap_telephone"),
        city: text("city"),
        country: varchar("country", { length: 10 }),
        postalCode: varchar("postal_code", { length: 20 }),
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
        referenceType: varchar("reference_type", { length: 20 }).default("PO").notNull(), // 'PO' | 'CONTRACT'
        contractNumber: varchar("contract_number", { length: 100 }),
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
        poStatus: varchar("po_status", { length: 30 }).default("open"), // 'open' | 'partial' | 'completed' | 'closed' | 'cancelled'
        invoicedItemsCount: integer("invoiced_items_count").default(0),
        totalPoItemsCount: integer("total_po_items_count").default(0),
        rejectionReason: text("rejection_reason"),
        rejectionStage: varchar("rejection_stage", { length: 30 }),
        rejectionNotes: text("rejection_notes"),

        // Document Attachments (Persistent S3 / Dokploy Proxied URLs)
        invoiceFileUrl: text("invoice_file_url").notNull(),
        taxInvoiceFileUrl: text("tax_invoice_file_url"),
        poFileUrl: text("po_file_url"),
        contractFileUrl: text("contract_file_url"),
        deliveryReceiptFileUrl: text("delivery_receipt_file_url"),
        grSlipFileUrl: text("gr_slip_file_url"),
        additionalFileUrl: text("additional_file_url"),

        // Entry Mode (Vendor Self-service vs Procurement Internal Entry)
        entryMode: varchar("entry_mode", { length: 30 }).default("vendor").notNull(),
        enteredBy: text("entered_by").references(() => user.id),

        // Validation Gate (Admin Checklist)
        checklistDocValid: boolean("checklist_doc_valid").default(false).notNull(),
        checklistPoValid: boolean("checklist_po_valid").default(false).notNull(),
        checklistCalcValid: boolean("checklist_calc_valid").default(false).notNull(),
        checklistBankValid: boolean("checklist_bank_valid").default(false).notNull(),
        checklistTaxValid: boolean("checklist_tax_valid").default(false).notNull(),
        adminChecklistNotes: text("admin_checklist_notes"),
        adminVerifiedAt: timestamp("admin_verified_at"),
        adminVerifiedBy: text("admin_verified_by").references(() => user.id),

        // Finance Re-Check of Admin Checklist
        financeRecheckAt: timestamp("finance_recheck_at"),
        financeRecheckBy: text("finance_recheck_by").references(() => user.id),
        financeRecheckNotes: text("finance_recheck_notes"),
        financeRecheckPassed: boolean("finance_recheck_passed").default(false).notNull(),

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

// 6. SAP Master Vendor (Mirrored from SAP MKVZ & VPMS Accenture Standard)
export const sapVendorMaster = pgTable(
    "sap_vendor_master",
    {
        id: serial("id").primaryKey(),
        supplierCode: varchar("supplier_code", { length: 20 }).notNull().unique(),
        vendorName: text("vendor_name").notNull(),
        street: text("street"),
        city: text("city"),
        country: varchar("country", { length: 10 }),
        postalCode: varchar("postal_code", { length: 20 }),
        accountGroup: varchar("account_group", { length: 20 }),
        termsOfPayment: varchar("terms_of_payment", { length: 10 }),
        topDays: integer("top_days").default(0).notNull(),
        incoterms: varchar("incoterms", { length: 20 }),
        orderCurrency: varchar("order_currency", { length: 10 }),
        salesperson: text("salesperson"),
        telephone: text("telephone"),
        isActive: boolean("is_active").default(true).notNull(),

        // Accenture VPMS Standard Master Data Fields
        npwp: varchar("npwp", { length: 50 }),
        typeOfBusiness: text("type_of_business"), // KBLI / Category
        status: varchar("status", { length: 20 }).default("Active").notNull(), // Active, Blacklisted, Inactive
        address: text("address"),

        // Vendor Director Detail
        directorName: text("director_name"),
        directorPosition: text("director_position"),
        directorEmail: text("director_email"),
        directorPhone: text("director_phone"),

        // Vendor Sales PIC Detail
        salesPicName: text("sales_pic_name"),
        salesPicPosition: text("sales_pic_position"),
        salesPicEmail: text("sales_pic_email"),
        salesPicPhone: text("sales_pic_phone"),

        // Bank Account Details
        bankName: text("bank_name"),
        bankAccountNumber: text("bank_account_number"),
        bankAccountHolder: text("bank_account_holder"),

        importedAt: timestamp("imported_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        supplierCodeIdx: index("sap_vendor_master_code_idx").on(table.supplierCode),
        vendorNameIdx: index("sap_vendor_master_name_idx").on(table.vendorName),
        topCodeIdx: index("sap_vendor_master_top_idx").on(table.termsOfPayment),
        statusIdx: index("sap_vendor_master_status_idx").on(table.status),
    })
)

// 7. Vendor Contracts (Sewa Menyewa, Pengadaan, Jasa, dll)
export const vendorContracts = pgTable(
    "vendor_contracts",
    {
        id: serial("id").primaryKey(),
        contractNumber: varchar("contract_number", { length: 100 }).notNull().unique(),
        vendorTenantId: varchar("vendor_tenant_id", { length: 36 }).references(() => vendorTenants.id, { onDelete: "set null" }),
        vendorSapCode: varchar("vendor_sap_code", { length: 50 }),
        vendorName: varchar("vendor_name", { length: 255 }).notNull(),
        title: varchar("title", { length: 255 }).default("Perjanjian Kerjasama / Sewa").notNull(),
        category: varchar("category", { length: 100 }).default("Sewa Kendaraan").notNull(),
        itemName: text("item_name").notNull(), // e.g. "MITSUBISHI TRITON 2.5L DC HDX-L (4X4) MT - DA 8109 HH"
        itemDetails: jsonb("item_details").$type<{
            policeNumber?: string
            chassisNumber?: string
            engineNumber?: string
            year?: number | string
            color?: string
            location?: string
            specs?: string
            qty?: number
            uom?: string
        }>().default({}),
        contractValue: numeric("contract_value", { precision: 18, scale: 2 }).default("0").notNull(),
        billingFrequency: varchar("billing_frequency", { length: 50 }).default("monthly").notNull(),
        currency: varchar("currency", { length: 10 }).default("IDR").notNull(),
        startDate: timestamp("start_date").notNull(),
        endDate: timestamp("end_date").notNull(),
        topDays: integer("top_days").default(45).notNull(),
        isPkp: boolean("is_pkp").default(true).notNull(),
        ppnPercent: numeric("ppn_percent", { precision: 5, scale: 2 }).default("11").notNull(),
        pphPercent: numeric("pph_percent", { precision: 5, scale: 2 }).default("2").notNull(),
        bankName: varchar("bank_name", { length: 100 }),
        bankAccountNumber: varchar("bank_account_number", { length: 100 }),
        bankAccountHolder: varchar("bank_account_holder", { length: 255 }),
        npwpNumber: varchar("npwp_number", { length: 50 }),
        vendorAddress: text("vendor_address"),
        vendorPicName: varchar("vendor_pic_name", { length: 100 }),
        contractFileUrl: text("contract_file_url"),
        attachmentUrls: jsonb("attachment_urls").$type<{
            stnkUrl?: string
            photoUrl?: string
            insuranceUrl?: string
            npwpUrl?: string
            otherUrl?: string
        }>().default({}),
        status: varchar("status", { length: 30 }).default("active").notNull(), // 'active' | 'expired' | 'terminated' | 'draft'
        notes: text("notes"),
        createdBy: text("created_by").references(() => user.id),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        contractNoIdx: index("vendor_contracts_number_idx").on(table.contractNumber),
        vendorNameIdx: index("vendor_contracts_vendor_name_idx").on(table.vendorName),
        statusIdx: index("vendor_contracts_status_idx").on(table.status),
    })
)

// 8. PO Tracking (Open, Partial, Completed, Closed, Cancelled)
export const vendorPoTracking = pgTable(
    "vendor_po_tracking",
    {
        id: serial("id").primaryKey(),
        poNumber: varchar("po_number", { length: 100 }).notNull().unique(),
        vendorCode: varchar("vendor_code", { length: 50 }),
        vendorName: varchar("vendor_name", { length: 255 }),
        totalItems: integer("total_items").default(0).notNull(),
        invoicedItems: integer("invoiced_items").default(0).notNull(),
        totalQty: numeric("total_qty", { precision: 18, scale: 2 }).default("0").notNull(),
        invoicedQty: numeric("invoiced_qty", { precision: 18, scale: 2 }).default("0").notNull(),
        netValue: numeric("net_value", { precision: 18, scale: 2 }).default("0").notNull(),
        invoicedValue: numeric("invoiced_value", { precision: 18, scale: 2 }).default("0").notNull(),
        currency: varchar("currency", { length: 10 }).default("IDR").notNull(),
        status: varchar("status", { length: 30 }).default("open").notNull(), // 'open' | 'partial' | 'completed' | 'closed' | 'cancelled'
        lastInvoicedAt: timestamp("last_invoiced_at"),
        itemsDetail: jsonb("items_detail").$type<Array<{
            itemNo: number
            material: string
            description: string
            poQty: number
            invoicedQty: number
            netValue: number
            invoicedValue: number
            status: "open" | "partial" | "completed"
        }>>().default([]),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        poNoIdx: index("vendor_po_tracking_po_no_idx").on(table.poNumber),
        statusIdx: index("vendor_po_tracking_status_idx").on(table.status),
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

export const vendorContractsRelations = relations(vendorContracts, ({ one }) => ({
    tenant: one(vendorTenants, {
        fields: [vendorContracts.vendorTenantId],
        references: [vendorTenants.id],
    }),
    creator: one(user, {
        fields: [vendorContracts.createdBy],
        references: [user.id],
    }),
}))
