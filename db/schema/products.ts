import { pgTable, serial, varchar, text, timestamp, unique } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
    id: serial("id").primaryKey(),
    category: varchar("category", { length: 100 }).notNull(), // ACC, FLAP, IMT PART, Material Consumable, SPM, TUBE, TYRE, WHEEL & RIM
    materialNumber: varchar("material_number", { length: 100 }).notNull(),
    oldMaterialNo: text("old_material_no"),
    materialDescription: text("material_description"),
    costSap: text("cost_sap"), // Storing as text to avoid precision issues, or can be decimal
    plant: varchar("plant", { length: 100 }),
    sloc: varchar("sloc", { length: 100 }),
    slocDescription: text("sloc_description"),
    typeWarehouse: varchar("type_warehouse", { length: 50 }),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    unq: unique().on(t.materialNumber, t.sloc),
}));
