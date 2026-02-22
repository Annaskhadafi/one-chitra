import { pgTable, text, varchar, timestamp, boolean, integer, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const portalItems = pgTable("portal_items", {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 100 }).notNull().default("Globe"), // Lucide icon name
    color: varchar("color", { length: 50 }).notNull().default("#3b82f6"), // Hex color
    url: text("url").notNull(),
    newTab: boolean("new_tab").default(true).notNull(),
    category: varchar("category", { length: 100 }).notNull().default("General"),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
