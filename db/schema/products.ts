import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
    id: serial("id").primaryKey(),
    category: varchar("category", { length: 50 }).notNull(), // ACC, FLAP, IMT PART, TUBE, TYRE, WHEEL & RIM
    materialNumber: varchar("material_number", { length: 100 }).unique().notNull(),
    oldMaterialNo: text("old_material_no"),
    materialDescription: text("material_description"),
    costSap: text("cost_sap"), // Storing as text to avoid precision issues, or can be decimal
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
