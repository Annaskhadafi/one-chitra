import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { products } from "./products";
import { warehouses } from "./warehouses";
import { user } from "./auth";

export const rfidScans = pgTable("rfid_scans", {
    id: serial("id").primaryKey(),
    tagId: varchar("tag_id", { length: 100 }).notNull(),
    productId: integer("product_id").references(() => products.id),
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    scanType: varchar("scan_type", { length: 10 }), // 'INBOUND' or 'OUTBOUND'
    userId: varchar("user_id").references(() => user.id),
    scannedAt: timestamp("scanned_at").defaultNow().notNull(),
});
