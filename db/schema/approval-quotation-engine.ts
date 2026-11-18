import { pgTable, serial, varchar, numeric, integer, text, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from "./auth"
import { quotations } from "./quotations"

// 1. Konfigurasi Batas Limit Margin & Diskon per Kategori Produk (Gambar 2 & 3)
export const quotationApprovalTiers = pgTable("quotation_approval_tiers", {
    id: serial("id").primaryKey(),
    productCategory: varchar("product_category", { length: 30 }).notNull(), // 'prime_tyre' | 'pas'
    stagingLevel: integer("staging_level").notNull(), // 1, 2, 3, 4, 5
    positionName: varchar("position_name", { length: 100 }).notNull(), // 'Sales Engineer / Leader on Site', 'Supervisory', 'Managerial', 'General Manager', 'Director'
    minMargin: numeric("min_margin", { precision: 8, scale: 4 }).notNull(), // Batas Bawah Margin (%)
    maxMargin: numeric("max_margin", { precision: 8, scale: 4 }).notNull(), // Batas Atas Margin (%)
    maxDiscountGap: numeric("max_discount_gap", { precision: 8, scale: 4 }), // Selisih / Diskon Maksimal dari Standard 11%
    isAutoApproved: boolean("is_auto_approved").default(false).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    categoryLevelIdx: uniqueIndex("quotation_tiers_cat_level_idx").on(t.productCategory, t.stagingLevel),
}))

// 2. Matriks Rantai Approver per Sales Person (Mapping Gambar 1)
export const quotationSalesApproverMatrix = pgTable("quotation_sales_approver_matrix", {
    id: serial("id").primaryKey(),
    salesUserId: text("sales_user_id").references(() => user.id).notNull().unique(),
    spvUserId: text("spv_user_id").references(() => user.id),
    majorAccountUserId: text("major_account_user_id").references(() => user.id),
    salesManagerUserId: text("sales_manager_user_id").references(() => user.id),
    generalManagerUserId: text("general_manager_user_id").references(() => user.id),
    financeManagerUserId: text("finance_manager_user_id").references(() => user.id),
    secretaryUserId: text("secretary_user_id").references(() => user.id),
    directorUserId: text("director_user_id").references(() => user.id),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    salesUserIdx: index("quotation_sales_matrix_sales_idx").on(t.salesUserId),
}))

// 3. Log History Tracking Langkah Approval Quotation (Sequential Execution)
export const quotationApprovalProgress = pgTable("quotation_approval_progress", {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id").references(() => quotations.id, { onDelete: "cascade" }).notNull(),
    stepOrder: integer("step_order").notNull(), // 1, 2, 3, 4, 5, 6, 7
    stepRole: varchar("step_role", { length: 50 }).notNull(), // 'spv', 'major_account', 'sales_manager', 'general_manager', 'finance_manager', 'secretary', 'director'
    stepLabel: varchar("step_label", { length: 100 }).notNull(),
    assignedUserId: text("assigned_user_id").references(() => user.id).notNull(),
    status: varchar("status", { length: 30 }).default("pending").notNull(), // 'pending', 'approved', 'rejected', 'skipped'
    actedAt: timestamp("acted_at"),
    comment: text("comment"),
    requiredByMargin: numeric("required_by_margin", { precision: 8, scale: 4 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
    quotationStepIdx: index("quotation_approval_progress_quotation_idx").on(t.quotationId),
    assigneeStatusIdx: index("quotation_approval_progress_assignee_idx").on(t.assignedUserId, t.status),
}))

// Relations
export const quotationApprovalTiersRelations = relations(quotationApprovalTiers, () => ({}))

export const quotationSalesApproverMatrixRelations = relations(quotationSalesApproverMatrix, ({ one }) => ({
    salesUser: one(user, {
        fields: [quotationSalesApproverMatrix.salesUserId],
        references: [user.id],
        relationName: "matrixSalesUser",
    }),
    spvUser: one(user, {
        fields: [quotationSalesApproverMatrix.spvUserId],
        references: [user.id],
        relationName: "matrixSpvUser",
    }),
    majorAccountUser: one(user, {
        fields: [quotationSalesApproverMatrix.majorAccountUserId],
        references: [user.id],
        relationName: "matrixMajorAccountUser",
    }),
    salesManagerUser: one(user, {
        fields: [quotationSalesApproverMatrix.salesManagerUserId],
        references: [user.id],
        relationName: "matrixSalesManagerUser",
    }),
    generalManagerUser: one(user, {
        fields: [quotationSalesApproverMatrix.generalManagerUserId],
        references: [user.id],
        relationName: "matrixGeneralManagerUser",
    }),
    financeManagerUser: one(user, {
        fields: [quotationSalesApproverMatrix.financeManagerUserId],
        references: [user.id],
        relationName: "matrixFinanceManagerUser",
    }),
    secretaryUser: one(user, {
        fields: [quotationSalesApproverMatrix.secretaryUserId],
        references: [user.id],
        relationName: "matrixSecretaryUser",
    }),
    directorUser: one(user, {
        fields: [quotationSalesApproverMatrix.directorUserId],
        references: [user.id],
        relationName: "matrixDirectorUser",
    }),
}))

export const quotationApprovalProgressRelations = relations(quotationApprovalProgress, ({ one }) => ({
    quotation: one(quotations, {
        fields: [quotationApprovalProgress.quotationId],
        references: [quotations.id],
    }),
    assignedUser: one(user, {
        fields: [quotationApprovalProgress.assignedUserId],
        references: [user.id],
    }),
}))
