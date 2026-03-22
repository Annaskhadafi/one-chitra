import { pgTable, serial, integer, varchar, text, timestamp, decimal, date, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { stockTransfers } from "./transfers";
import { products } from "./products";
import { user } from "./auth";
import { warehouses } from "./warehouses";

// 1. Penerimaan & Validasi SN
export const evhsReceipts = pgTable("evhs_receipts", {
    id: serial("id").primaryKey(),
    transferId: integer("transfer_id").references(() => stockTransfers.id).notNull(),
    receivedDate: timestamp("received_date").defaultNow().notNull(),
    doChitraNo: varchar("do_chitra_no", { length: 100 }), // No DO Chitra
    confirmedBy: varchar("confirmed_by").references(() => user.id),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evhsReceiptItems = pgTable("evhs_receipt_items", {
    id: serial("id").primaryKey(),
    receiptId: integer("receipt_id").references(() => evhsReceipts.id, { onDelete: 'cascade' }).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    confirmedQty: integer("confirmed_qty").notNull(),
    serialNumbers: text("serial_numbers").array(), // Validasi SN Ban
});

// 2. Voucher VHS (Usage/GI tracking)
export const evhsVouchers = pgTable("evhs_vouchers", {
    id: serial("id").primaryKey(),
    vhsNo: varchar("vhs_no", { length: 100 }).unique().notNull(), // VHS/CP/CK/XXXXXXX
    woNo: varchar("wo_no", { length: 100 }), // WO Number dari PRS Customer
    date: date("date").notNull(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id).notNull(), // Project Site
    remark: text("remark"),

    // Signatures / Personnel
    issuedBy: varchar("issued_by").references(() => user.id),
    approvedByName: varchar("approved_by_name", { length: 255 }), // Input manual
    receivedByName: varchar("received_by_name", { length: 255 }), // Input manual

    status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, completed, cancelled

    // MRKO & Invoicing fields
    mrkoStatus: varchar("mrko_status", { length: 20 }).default("OPEN"), // OPEN, SETTLED
    mrkoNo: varchar("mrko_no", { length: 100 }),
    sapInvoiceNo: varchar("sap_invoice_no", { length: 100 }),
    settledDate: timestamp("settled_date"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const evhsVoucherItems = pgTable("evhs_voucher_items", {
    id: serial("id").primaryKey(),
    voucherId: integer("voucher_id").references(() => evhsVouchers.id, { onDelete: 'cascade' }).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    materialNumberCk: varchar("material_number_ck", { length: 100 }), // Material Number Site Customer
    unitPrice: decimal("unit_price", { precision: 15, scale: 2 }),
    qty: integer("qty").notNull(),
    stockBalance: integer("stock_balance"), // Snapshot sisa stok saat itu
    serialNumber: varchar("serial_number", { length: 100 }), // SN Tire specifically
    pos: varchar("pos", { length: 50 }),
    unitId: varchar("unit_id", { length: 100 }),
});

// 3. GI Records (Crosscheck Data Customer)
export const evhsGiRecords = pgTable("evhs_gi_records", {
    id: serial("id").primaryKey(),
    documentNo: varchar("document_no", { length: 100 }), // GI Number form SAP
    woNo: varchar("wo_no", { length: 100 }), // WO Number dari Customer
    source: varchar("source", { length: 20 }).default("upload").notNull(), // upload, manual
    filename: text("filename"), // Jika dari upload CSV
    periodDate: date("period_date"), // Periode GI
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    isMatched: boolean("is_matched").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evhsGiItems = pgTable("evhs_gi_items", {
    id: serial("id").primaryKey(),
    giRecordId: integer("gi_record_id").references(() => evhsGiRecords.id, { onDelete: 'cascade' }).notNull(),
    materialNumber: varchar("material_number", { length: 100 }).notNull(),
    qty: decimal("qty", { precision: 12, scale: 2 }).notNull(),
    price: decimal("price", { precision: 15, scale: 2 }),
    status: varchar("status", { length: 50 }), // matched, mismatch_qty, mismatch_price, not_found
});

// 4. MRKO Tracking
export const evhsMrko = pgTable("evhs_mrko", {
    id: serial("id").primaryKey(),
    mrkoNumber: varchar("mrko_number", { length: 100 }),
    releaseDate: timestamp("release_date"),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, released
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 5. Master Data Price PT. CK
export const evhsMasterPrices = pgTable("evhs_master_prices", {
    id: serial("id").primaryKey(),
    materialNumberCp: varchar("material_number_cp", { length: 100 }).notNull(),
    materialNumberCk: varchar("material_number_ck", { length: 100 }),
    warehouseId: integer("warehouse_id").references(() => warehouses.id).notNull(),
    price: decimal("price", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const evhsReceiptsRelations = relations(evhsReceipts, ({ one, many }) => ({
    transfer: one(stockTransfers, {
        fields: [evhsReceipts.transferId],
        references: [stockTransfers.id],
    }),
    confirmedByUser: one(user, {
        fields: [evhsReceipts.confirmedBy],
        references: [user.id],
    }),
    items: many(evhsReceiptItems),
}));

export const evhsReceiptItemsRelations = relations(evhsReceiptItems, ({ one }) => ({
    receipt: one(evhsReceipts, {
        fields: [evhsReceiptItems.receiptId],
        references: [evhsReceipts.id],
    }),
    product: one(products, {
        fields: [evhsReceiptItems.productId],
        references: [products.id],
    }),
}));

export const evhsVouchersRelations = relations(evhsVouchers, ({ one, many }) => ({
    warehouse: one(warehouses, {
        fields: [evhsVouchers.warehouseId],
        references: [warehouses.id],
    }),
    issuedByUser: one(user, {
        fields: [evhsVouchers.issuedBy],
        references: [user.id],
    }),
    items: many(evhsVoucherItems),
}));

export const evhsVoucherItemsRelations = relations(evhsVoucherItems, ({ one }) => ({
    voucher: one(evhsVouchers, {
        fields: [evhsVoucherItems.voucherId],
        references: [evhsVouchers.id],
    }),
    product: one(products, {
        fields: [evhsVoucherItems.productId],
        references: [products.id],
    }),
}));

export const evhsGiRecordsRelations = relations(evhsGiRecords, ({ one, many }) => ({
    warehouse: one(warehouses, {
        fields: [evhsGiRecords.warehouseId],
        references: [warehouses.id],
    }),
    items: many(evhsGiItems),
}));

export const evhsGiItemsRelations = relations(evhsGiItems, ({ one }) => ({
    giRecord: one(evhsGiRecords, {
        fields: [evhsGiItems.giRecordId],
        references: [evhsGiRecords.id],
    }),
}));

export const evhsMasterPricesRelations = relations(evhsMasterPrices, ({ one }) => ({
    warehouse: one(warehouses, {
        fields: [evhsMasterPrices.warehouseId],
        references: [warehouses.id],
    }),
}));
