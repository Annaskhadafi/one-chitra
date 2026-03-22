import { pgTable, serial, varchar, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from "./auth"
import { customers } from "./customers"

export const ocrPoSessions = pgTable("ocr_po_sessions", {
    id: serial("id").primaryKey(),
    fileUrl: varchar("file_url", { length: 500 }).notNull(),
    fileName: varchar("file_name", { length: 255 }),
    fileType: varchar("file_type", { length: 50 }),
    
    extractedData: jsonb("extracted_data").$type<{
        customerName: string | null
        customerCode: string | null
        documentNumber: string | null
        documentDate: string | null
        items: Array<{
            productName: string
            productCode: string | null
            quantity: number
            unitPrice: number
            totalPrice: number | null
            unit: string | null
        }>
        rawText: string
    }>(),
    
    mappedData: jsonb("mapped_data").$type<{
        customerId: number | null
        customerName: string | null
        customerMatchConfidence: number
        customerSuggestions: Array<{ id: number; name: string; code: string | null; score: number }> | null
        documentNumber: string | null
        documentDate: string | null
        items: Array<{
            ocrProductName: string
            ocrProductCode: string | null
            ocrQuantity: number
            ocrUnitPrice: number
            matchedProductId: number | null
            matchedProductName: string | null
            matchConfidence: number
            isValidated: boolean
        }>
    }>(),
    
    salesOrderId: integer("sales_order_id"),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    
    uploadedById: text("uploaded_by_id").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const ocrPoSessionsRelations = relations(ocrPoSessions, ({ one }) => ({
    uploadedBy: one(user, {
        fields: [ocrPoSessions.uploadedById],
        references: [user.id],
    }),
}))
