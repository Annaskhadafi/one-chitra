import { pgTable, serial, varchar, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const customerLegalDocuments = pgTable("customer_legal_documents", {
    id: serial("id").primaryKey(),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerCode: varchar("customer_code", { length: 100 }),

    // 1. NPWP
    npwpNumber: varchar("npwp_number", { length: 100 }),
    npwpFileUrl: text("npwp_file_url"),
    npwpStatus: boolean("npwp_status").default(false),

    // 2. Akta Pendirian Perusahaan
    aktaPendirianNumber: varchar("akta_pendirian_number", { length: 100 }),
    aktaPendirianFileUrl: text("akta_pendirian_file_url"),
    aktaPendirianStatus: boolean("akta_pendirian_status").default(false),

    // 3. Akta Perubahan (jika ada)
    aktaPerubahanNumber: varchar("akta_perubahan_number", { length: 100 }),
    aktaPerubahanFileUrl: text("akta_perubahan_file_url"),
    aktaPerubahanStatus: boolean("akta_perubahan_status").default(false),

    // 4. NIB (Nomor Induk Berusaha)
    nibNumber: varchar("nib_number", { length: 100 }),
    nibFileUrl: text("nib_file_url"),
    nibStatus: boolean("nib_status").default(false),

    // 5. PKP / PTKP
    pkpPtkpNumber: varchar("pkp_ptkp_number", { length: 100 }),
    pkpPtkpFileUrl: text("pkp_ptkp_file_url"),
    pkpPtkpStatus: boolean("pkp_ptkp_status").default(false),

    // 6. SK Kemenkumham Pendirian
    skKemenkumhamPendirianNumber: varchar("sk_kemenkumham_pendirian_number", { length: 100 }),
    skKemenkumhamPendirianFileUrl: text("sk_kemenkumham_pendirian_file_url"),
    skKemenkumhamPendirianStatus: boolean("sk_kemenkumham_pendirian_status").default(false),

    // 7. SK Kemenkumham Perubahan (jika ada)
    skKemenkumhamPerubahanNumber: varchar("sk_kemenkumham_perubahan_number", { length: 100 }),
    skKemenkumhamPerubahanFileUrl: text("sk_kemenkumham_perubahan_file_url"),
    skKemenkumhamPerubahanStatus: boolean("sk_kemenkumham_perubahan_status").default(false),

    // 8. KTP Shareholder / Direktur
    ktpShareholderName: varchar("ktp_shareholder_name", { length: 255 }),
    ktpShareholderNik: varchar("ktp_shareholder_nik", { length: 100 }),
    ktpShareholderFileUrl: text("ktp_shareholder_file_url"),
    ktpShareholderStatus: boolean("ktp_shareholder_status").default(false),

    // Dokumen tambahan (SIUP, Domisili, TDP, dll.)
    // Format JSON array: [{ title: string, fileUrl: string, number?: string, notes?: string }]
    otherDocuments: jsonb("other_documents").$type<Array<{
        title: string;
        fileUrl: string;
        number?: string;
        notes?: string;
    }>>().default([]),

    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CustomerLegalDocument = typeof customerLegalDocuments.$inferSelect;
export type NewCustomerLegalDocument = typeof customerLegalDocuments.$inferInsert;
