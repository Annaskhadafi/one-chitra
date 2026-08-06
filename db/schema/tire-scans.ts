import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { products } from "./products";
import { warehouses } from "./warehouses";
import { user } from "./auth";

export const tireScans = pgTable("tire_scans", {
    id: serial("id").primaryKey(),
    batchId: varchar("batch_id", { length: 100 }).notNull(),
    sloc: varchar("sloc", { length: 50 }).notNull(),
    slocDescription: text("sloc_description"),
    materialNumber: varchar("material_number", { length: 100 }).notNull(),
    materialDescription: text("material_description"),
    serialNumber: varchar("serial_number", { length: 100 }).notNull(),
    qty: integer("qty").default(1).notNull(),
    dot: varchar("dot", { length: 50 }),
    brand: varchar("brand", { length: 100 }),
    size: varchar("size", { length: 100 }),
    imageUrl: text("image_url"),
    visionScanId: varchar("vision_scan_id", { length: 100 }),
    createdBy: varchar("created_by", { length: 100 }),
    userId: varchar("user_id").references(() => user.id),
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    productId: integer("product_id").references(() => products.id),
    scannedAt: timestamp("scanned_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
