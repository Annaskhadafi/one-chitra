import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const salesDocuments = pgTable("sales_documents", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(), // 'pdf', 'excel', 'image', 'other'
    uploadedById: text("uploaded_by_id")
        .references(() => user.id, { onDelete: "cascade" })
        .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SalesDocument = typeof salesDocuments.$inferSelect;
export type NewSalesDocument = typeof salesDocuments.$inferInsert;
