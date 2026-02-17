import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
    id: serial("id").primaryKey(),
    customerCode: varchar("customer_code", { length: 100 }).unique().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    address1: text("address_1"),
    address2: text("address_2"),
    address3: text("address_3"),
    address4: text("address_4"),
    address5: text("address_5"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
