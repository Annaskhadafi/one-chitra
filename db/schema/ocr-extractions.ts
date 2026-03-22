import { pgTable, serial, varchar, integer, text, timestamp } from "drizzle-orm/pg-core"
import { index } from "drizzle-orm/pg-core"

export const ocrExtractions = pgTable("ocr_extractions", {
    id: serial("id").primaryKey(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    pagesProcessed: integer("pages_processed").default(0).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    rawText: text("raw_text").notNull(),
    structuredJson: text("structured_json").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    fileIdx: index("ocr_extractions_file_idx").on(table.fileName),
    createdIdx: index("ocr_extractions_created_idx").on(table.createdAt),
}))
