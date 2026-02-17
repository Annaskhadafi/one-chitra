import { pgTable, serial, varchar, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { products } from "./products";

export const quotations = pgTable("quotations", {
    id: serial("id").primaryKey(),
    customerName: varchar("customer_name", { length: 200 }).notNull(),
    createdBy: varchar("created_by").references(() => user.id).notNull(),
    status: varchar("status", { length: 50 }).default("DRAFT").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    approvedAt: timestamp("approved_at"),
    approvedBy: varchar("approved_by").references(() => user.id),
});

export const quotationItems = pgTable("quotation_items", {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id").references(() => quotations.id, { onDelete: "cascade" }).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
});

export const quotationApprovals = pgTable("quotation_approvals", {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id").references(() => quotations.id, { onDelete: "cascade" }).notNull(),
    approverId: varchar("approver_id").references(() => user.id).notNull(),
    decision: varchar("decision", { length: 20 }), // 'APPROVED' or 'REJECTED'
    decidedAt: timestamp("decided_at").defaultNow().notNull(),
    comments: text("comments"),
});
