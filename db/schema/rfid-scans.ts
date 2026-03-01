import { pgTable, serial, varchar, integer, timestamp, text } from "drizzle-orm/pg-core";
import { products } from "./products";
import { warehouses } from "./warehouses";
import { user } from "./auth";

export const rfidScans = pgTable("rfid_scans", {
    id: serial("id").primaryKey(),
    tagId: varchar("tag_id", { length: 100 }).notNull(),
    serialNumber: varchar("serial_number", { length: 200 }),      // Khusus Tire/Ban
    productId: integer("product_id").references(() => products.id),
    category: varchar("category", { length: 100 }),               // TYRE, ACC, dll
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    scanType: varchar("scan_type", { length: 10 }),               // 'INBOUND' | 'OUTBOUND'
    referenceNo: varchar("reference_no", { length: 100 }),        // No. DO/SO
    notes: text("notes"),
    deviceId: varchar("device_id", { length: 100 }),              // ID perangkat scanner
    userId: varchar("user_id").references(() => user.id),
    scannedAt: timestamp("scanned_at").defaultNow().notNull(),
});

