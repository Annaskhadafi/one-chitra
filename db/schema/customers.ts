import { pgTable, serial, varchar, text, timestamp, date } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
    id: serial("id").primaryKey(),
    customerCode: varchar("customer_code", { length: 100 }).unique().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    birthday: date("birthday"),
    address1: text("address_1"),
    address2: text("address_2"),
    address3: text("address_3"),
    address4: text("address_4"),
    address5: text("address_5"),
    businessCategory: varchar("business_category", { length: 255 }),
    businessCategorySource: varchar("business_category_source", { length: 100 }),
    businessCategoryEnrichedAt: timestamp("business_category_enriched_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
