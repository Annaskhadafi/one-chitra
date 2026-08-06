import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { products } from "./products";
import { warehouses } from "./warehouses";
import { user } from "./auth";

export const rfidScans = pgTable("rfid_scans", {
    id: serial("id").primaryKey(),
    tagId: varchar("tag_id", { length: 100 }).notNull(),
    serialNumber: varchar("serial_number", { length: 100 }),
    epc: varchar("epc", { length: 100 }),
    rssi: varchar("rssi", { length: 20 }),
    linked: boolean("linked").default(false).notNull(),
    plant: varchar("plant", { length: 50 }),
    category: varchar("category", { length: 100 }),
    materialNumber: varchar("material_number", { length: 100 }),
    materialDescription: text("material_description"),
    sloc: varchar("sloc", { length: 50 }),
    slocDescription: text("sloc_description"),
    actStock: integer("act_stock"),
    createdBy: varchar("created_by", { length: 100 }),
    productId: integer("product_id").references(() => products.id),
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    scanType: varchar("scan_type", { length: 20 }), // 'INBOUND' / 'OUTBOUND' or 'MASUK' / 'KELUAR'
    doNumber: varchar("do_number", { length: 100 }),
    userId: varchar("user_id").references(() => user.id),
    tireCondition: varchar("tire_condition", { length: 50 }),
    remarks: text("remarks"),
    scannedAt: timestamp("scanned_at").defaultNow().notNull(),
});
