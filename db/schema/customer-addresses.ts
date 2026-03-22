import { pgTable, serial, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { relations } from "drizzle-orm";

export const customerAddresses = pgTable("customer_addresses", {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
    address: text("address").notNull(),
    label: varchar("label", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
    customer: one(customers, {
        fields: [customerAddresses.customerId],
        references: [customers.id],
    }),
}));
