import { relations } from "drizzle-orm"
import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core"
import { customers } from "./customers"
import { deliveries } from "./deliveries"
import { stockLevels } from "./stock-levels"

export const stockCustomerBookings = pgTable("stock_customer_bookings", {
    id: serial("id").primaryKey(),
    stockLevelId: integer("stock_level_id").references(() => stockLevels.id, { onDelete: "cascade" }).notNull(),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
    quantity: integer("quantity").default(0).notNull(),
    remark: text("remark"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    unique("stock_customer_bookings_stock_level_customer_unique").on(table.stockLevelId, table.customerId),
])

export const stockBookingConsumptions = pgTable("stock_booking_consumptions", {
    id: serial("id").primaryKey(),
    stockBookingId: integer("stock_booking_id").references(() => stockCustomerBookings.id, { onDelete: "cascade" }).notNull(),
    deliveryId: integer("delivery_id").references(() => deliveries.id, { onDelete: "cascade" }).notNull(),
    quantity: integer("quantity").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    unique("stock_booking_consumptions_booking_delivery_unique").on(table.stockBookingId, table.deliveryId),
])

export const stockCustomerBookingsRelations = relations(stockCustomerBookings, ({ one, many }) => ({
    stockLevel: one(stockLevels, {
        fields: [stockCustomerBookings.stockLevelId],
        references: [stockLevels.id],
    }),
    customer: one(customers, {
        fields: [stockCustomerBookings.customerId],
        references: [customers.id],
    }),
    consumptions: many(stockBookingConsumptions),
}))

export const stockBookingConsumptionsRelations = relations(stockBookingConsumptions, ({ one }) => ({
    stockBooking: one(stockCustomerBookings, {
        fields: [stockBookingConsumptions.stockBookingId],
        references: [stockCustomerBookings.id],
    }),
    delivery: one(deliveries, {
        fields: [stockBookingConsumptions.deliveryId],
        references: [deliveries.id],
    }),
}))
