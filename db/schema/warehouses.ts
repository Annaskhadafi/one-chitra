import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const warehouses = pgTable("warehouses", {
    id: serial("id").primaryKey(),
    sloc: varchar("sloc", { length: 50 }).notNull().unique(), // Storage Location Code
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
