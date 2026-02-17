import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
    id: serial("id").primaryKey(),
    sku: varchar("sku", { length: 50 }).unique().notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    unit: varchar("unit", { length: 50 }),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
