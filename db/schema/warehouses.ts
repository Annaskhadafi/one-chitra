import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const warehouses = pgTable("warehouses", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    location: varchar("location", { length: 200 }),
    reorderPointLevel1: integer("reorder_point_level1").default(0),
    reorderPointLevel2: integer("reorder_point_level2").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
