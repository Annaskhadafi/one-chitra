import { pgTable, serial, varchar, text, timestamp, numeric, integer, index } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from "./auth"

export const vendorQuotationOcrStatusEnum = ["pending", "processing", "done", "failed"] as const
export type VendorQuotationOcrStatus = (typeof vendorQuotationOcrStatusEnum)[number]

export const vendorQuotations = pgTable(
    "vendor_quotations",
    {
        id: serial("id").primaryKey(),
        eprEntryId: varchar("epr_entry_id", { length: 100 }),
        fileUrl: text("file_url").notNull(),
        fileName: varchar("file_name", { length: 500 }),
        vendorName: varchar("vendor_name", { length: 500 }),
        quoteNumber: varchar("quote_number", { length: 200 }),
        quoteDate: varchar("quote_date", { length: 100 }),
        remark: text("remark"),
        ocrStatus: varchar("ocr_status", { length: 20 }).default("pending").notNull(),
        extractedAt: timestamp("extracted_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
        createdBy: text("created_by").references(() => user.id),
    },
    (table) => ({
        vendorIdx: index("vendor_quotations_vendor_idx").on(table.vendorName),
        quoteNumberIdx: index("vendor_quotations_quote_number_idx").on(table.quoteNumber),
        ocrStatusIdx: index("vendor_quotations_ocr_status_idx").on(table.ocrStatus),
        createdAtIdx: index("vendor_quotations_created_at_idx").on(table.createdAt),
    })
)

export const vendorQuotationItems = pgTable(
    "vendor_quotation_items",
    {
        id: serial("id").primaryKey(),
        vendorQuotationId: integer("vendor_quotation_id")
            .references(() => vendorQuotations.id, { onDelete: "cascade" })
            .notNull(),
        itemName: text("item_name").notNull(),
        qty: numeric("qty", { precision: 12, scale: 4 }).default("0").notNull(),
        unit: varchar("unit", { length: 50 }),
        unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).default("0").notNull(),
        totalPrice: numeric("total_price", { precision: 18, scale: 2 }).default("0").notNull(),
        remark: text("remark"),
    },
    (table) => ({
        quotationIdx: index("vendor_quotation_items_quotation_idx").on(table.vendorQuotationId),
    })
)

export const vendorQuotationsRelations = relations(vendorQuotations, ({ one, many }) => ({
    createdByUser: one(user, {
        fields: [vendorQuotations.createdBy],
        references: [user.id],
    }),
    items: many(vendorQuotationItems),
}))

export const vendorQuotationItemsRelations = relations(vendorQuotationItems, ({ one }) => ({
    vendorQuotation: one(vendorQuotations, {
        fields: [vendorQuotationItems.vendorQuotationId],
        references: [vendorQuotations.id],
    }),
}))
