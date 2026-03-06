import { pgTable, serial, integer, text, timestamp, decimal, doublePrecision, date } from "drizzle-orm/pg-core";

// SAP Stock Table
export const zmc9StockSap = pgTable("zmc9_stock_sap", {
    stockId: serial("stock_id").primaryKey(),
    plantCode: text("plant_code"),
    plantName: text("plant_name"),
    materialNo: text("material_no"),
    oldMaterialNo: text("old_material_no"),
    materialDesc: text("material_desc"),
    storLoc: text("stor_loc"),
    storLocDesc: text("stor_loc_desc"),
    totalStock: decimal("total_stock", { precision: 20, scale: 3 }),
    baseUnitOfMeasure: text("base_unit_of_measure"),
    valueStock: decimal("value_stock", { precision: 20, scale: 3 }),
    currency: text("currency"),
    extractedAt: timestamp("extracted_at"),
    updatedAt: timestamp("updated_at"),
});

// SAP Purchasing Documents
export const me2lPurchDocsSap = pgTable("me2l_purch_docs_sap", {
    id: serial("id").primaryKey(),
    // Definisi minimal agar drizzle tidak menghapus tabel
    // User bisa menambahkan kolom spesifik jika diperlukan
});

// SAP Sales Revenue
export const salesRevenueSap = pgTable("sales_revenue_sap", {
    salesRevId: serial("sales_rev_id").primaryKey(),
    sorg: text("sorg"),
    billTy: text("bill_ty"),
    revType: text("rev_type"),
    customer: text("customer"),
    customerName: text("customer_name"),
    salesman: text("salesman"),
    item: integer("item"),
    sloc: text("sloc"),
    plant: text("plant"),
    materialNo: text("material_no"),
    materialDescription: text("material_description"),
    sizeDimen: text("size_dimen"),
    materialGroup: text("material_group"),
    matGrpDesc: text("mat_grp_desc"),
    matGrp1: text("mat_grp1"),
    matGrp1Desc: text("mat_grp1_desc"),
    matGrp2: text("mat_grp2"),
    matGrp2Desc: text("mat_grp2_desc"),
    matGrp3: text("mat_grp3"),
    matGrp3Desc: text("mat_grp3_desc"),
    matGrp4: text("mat_grp4"),
    matGrp4Desc: text("mat_grp4_desc"),
    matGrp5: text("mat_grp5"),
    matGrp5Desc: text("mat_grp5_desc"),
    qty: integer("qty"),
    uom: text("uom"),
    curr: text("curr"),
    basePrice: doublePrecision("base_price"),
    intdeptPrice: doublePrecision("intdept_price"),
    adjustmentPrice: doublePrecision("adjustment_price"),
    revenueInDocCurr: doublePrecision("revenue_in_doc_curr"),
    revenueInLocCurr: doublePrecision("revenue_in_loc_curr"),
    billingNo: text("billing_no"),
    billingDate: date("billing_date"), // In DB it is 'date'
    inco1: text("inco1"),
    inco2: text("inco2"),
    c: text("c"),
    cancelled: text("cancelled"),
    deliveryNo: text("delivery_no"),
    salesOrder: text("sales_order"),
    workOrder: text("work_order"),
    poNo: text("po_no"),
    poDate: date("po_date"), // In DB it is 'date'
    poType: text("po_type"),
    costOfSales: doublePrecision("cost_of_sales"),
    profitMargin: doublePrecision("profit_margin"),
    extractedAt: timestamp("extracted_at"),
});

// Support Table for Cover Letters
export const coverLetterSigners = pgTable("cover_letter_signers", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
