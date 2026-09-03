import { pgTable, serial, integer, numeric, varchar, timestamp, index, text } from "drizzle-orm/pg-core"
import { salesOrderItems } from "./sales-orders"
import { user } from "./auth"

export const noStockMonitoringAllocations = pgTable("no_stock_monitoring_allocations", {
    id: serial("id").primaryKey(),
    salesOrderItemId: integer("sales_order_item_id")
        .references(() => salesOrderItems.id, { onDelete: "cascade" })
        .notNull(),
    eprPrNumber: varchar("epr_pr_number", { length: 100 }),
    vendorPoNumber: varchar("vendor_po_number", { length: 100 }),
    vendorPoItem: integer("vendor_po_item"),
    allocatedQty: numeric("allocated_qty", { precision: 14, scale: 3 }).default("0").notNull(),
    createdBy: text("created_by").references(() => user.id),
    updatedBy: text("updated_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    salesOrderItemIdx: index("no_stock_monitoring_allocations_item_idx").on(table.salesOrderItemId),
    eprPrIdx: index("no_stock_monitoring_allocations_epr_pr_idx").on(table.eprPrNumber),
    vendorPoIdx: index("no_stock_monitoring_allocations_vendor_po_idx").on(table.vendorPoNumber, table.vendorPoItem),
}))
