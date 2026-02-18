import { pgTable, serial, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const fleetDrivers = pgTable("fleet_drivers", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fleetVehicles = pgTable("fleet_vehicles", {
    id: serial("id").primaryKey(),
    policeNumber: varchar("police_number", { length: 50 }).notNull().unique(),
    type: varchar("type", { length: 50 }).notNull(), // Truck, Pick-up, Van, etc.
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
