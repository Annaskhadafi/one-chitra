import { pgTable, serial, integer, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { customers } from "./customers";

export const coverLetters = pgTable("cover_letters", {
    id: serial("id").primaryKey(),
    refNumber: text("ref_number"),
    letterDate: timestamp("letter_date"),
    custId: text("cust_id"),       // SAP customer code (historyOrders.customer)
    customerName: text("customer_name"),
    signerName: text("signer_name"),
    signerTitle: text("signer_title"),
    location: text("location").default("balikpapan"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const coverLetterItems = pgTable("cover_letter_items", {
    id: serial("id").primaryKey(),
    coverLetterId: integer("cover_letter_id").references(() => coverLetters.id, { onDelete: "cascade" }),
    poNo: text("po_no"),
    noInvSap: text("no_inv_sap"),
    dateInvoice: timestamp("date_invoice"),
    datePo: timestamp("date_po"),
    amountBeforeTax: decimal("amount_before_tax", { precision: 15, scale: 2 }),
    amountIncludeTax: decimal("amount_include_tax", { precision: 15, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
