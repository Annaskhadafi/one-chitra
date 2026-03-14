import { pgTable, serial, varchar, text, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { fleetDrivers, fleetVehicles } from "./fleet";
import { deliveries } from "./deliveries";
import { user } from "./auth";

export const fleetTrips = pgTable("fleet_trips", {
    id: serial("id").primaryKey(),
    tripNumber: varchar("trip_number", { length: 50 }).unique().notNull(),
    driverId: integer("driver_id").references(() => fleetDrivers.id),
    vehicleId: integer("vehicle_id").references(() => fleetVehicles.id),
    status: varchar("status", { length: 20 }).default("scheduled").notNull(),
    date: timestamp("date").notNull(),
    notes: text("notes"),

    // Cost Fields
    tripDestination: varchar("trip_destination", { length: 255 }),
    costGasoline: decimal("cost_gasoline", { precision: 15, scale: 2 }).default("0"), // Keep old column to prevent data loss
    costGasolineDexlite: decimal("cost_gasoline_dexlite", { precision: 15, scale: 2 }).default("0"),
    costGasolineBio: decimal("cost_gasoline_bio", { precision: 15, scale: 2 }).default("0"),
    costToll: decimal("cost_toll", { precision: 15, scale: 2 }).default("0"),
    costParking: decimal("cost_parking", { precision: 15, scale: 2 }).default("0"),
    costMeals: decimal("cost_meals", { precision: 15, scale: 2 }).default("0"),
    costMaintenance: decimal("cost_maintenance", { precision: 15, scale: 2 }).default("0"),
    costOthers: decimal("cost_others", { precision: 15, scale: 2 }).default("0"),
    costRapidTest: decimal("cost_rapid_test", { precision: 15, scale: 2 }).default("0"),
    costFerry: decimal("cost_ferry", { precision: 15, scale: 2 }).default("0"),
    costPortal: decimal("cost_portal", { precision: 15, scale: 2 }).default("0"),
    costWashing: decimal("cost_washing", { precision: 15, scale: 2 }).default("0"),
    costEscort: decimal("cost_escort", { precision: 15, scale: 2 }).default("0"),

    createdBy: varchar("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fleetTripsRelations = relations(fleetTrips, ({ one, many }) => ({
    driver: one(fleetDrivers, {
        fields: [fleetTrips.driverId],
        references: [fleetDrivers.id],
    }),
    vehicle: one(fleetVehicles, {
        fields: [fleetTrips.vehicleId],
        references: [fleetVehicles.id],
    }),
    deliveries: many(deliveries),
    createdByUser: one(user, {
        fields: [fleetTrips.createdBy],
        references: [user.id],
    }),
}));
