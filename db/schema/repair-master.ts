import { boolean, integer, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core"

export const repairMasterItems = pgTable("repair_master_items", {
  id: serial("id").primaryKey(),
  materialCode: varchar("material_code", { length: 100 }).notNull(),
  materialName: text("material_name").notNull(),
  valuationStockValue: varchar("valuation_stock_value", { length: 100 }),
  currency: varchar("currency", { length: 20 }),
  valuatedStock: varchar("valuated_stock", { length: 100 }),
  uom: varchar("uom", { length: 30 }),
  category: varchar("category", { length: 100 }),
  smu: varchar("smu", { length: 50 }),
  defaultQty: varchar("default_qty", { length: 50 }),
  standardTime: varchar("standard_time", { length: 50 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  unqRepairMasterItemCode: unique("unq_repair_master_item_code").on(table.materialCode),
}))

export const repairMasterSites = pgTable("repair_master_sites", {
  id: serial("id").primaryKey(),
  siteCode: varchar("site_code", { length: 50 }).notNull(),
  siteName: text("site_name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  unqRepairMasterSiteCode: unique("unq_repair_master_site_code").on(table.siteCode),
}))
