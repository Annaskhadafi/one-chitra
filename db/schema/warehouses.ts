import { pgTable, serial, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";
import { customers } from "./customers";

export const warehouses = pgTable("warehouses", {
    id: serial("id").primaryKey(),
    sloc: varchar("sloc", { length: 50 }).notNull().unique(), // Storage Location Code
    description: text("description"),
    type: varchar("type", { length: 50 }), // MAIN, BRANCH, CONSIGNMENT, etc.
    customerId: integer("customer_id").references(() => customers.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
