import {
    boolean,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core"

export const inventoryVendorLeadTimes = pgTable("inventory_vendor_lead_times", {
    id: serial("id").primaryKey(),
    vendorName: text("vendor_name").notNull(),
    defaultLeadTimeDays: integer("default_lead_time_days"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    vendorNameUnique: uniqueIndex("inventory_vendor_lead_times_vendor_name_uidx").on(table.vendorName),
    isActiveIdx: index("inventory_vendor_lead_times_is_active_idx").on(table.isActive),
}))

export const inventoryVendorLeadTimeMaterials = pgTable("inventory_vendor_lead_time_materials", {
    id: serial("id").primaryKey(),
    vendorId: integer("vendor_id").notNull().references(() => inventoryVendorLeadTimes.id, { onDelete: "cascade" }),
    materialNo: text("material_no").notNull(),
    materialDesc: text("material_desc"),
    leadTimeDays: integer("lead_time_days").notNull(),
    isPreferred: boolean("is_preferred").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    vendorMaterialUnique: uniqueIndex("inventory_vendor_lead_time_materials_vendor_material_uidx").on(table.vendorId, table.materialNo),
    vendorIdIdx: index("inventory_vendor_lead_time_materials_vendor_id_idx").on(table.vendorId),
    materialNoIdx: index("inventory_vendor_lead_time_materials_material_no_idx").on(table.materialNo),
    preferredIdx: index("inventory_vendor_lead_time_materials_preferred_idx").on(table.isPreferred),
}))
