import { pgTable, serial, varchar, numeric, timestamp, integer, text } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from "./auth"

export const rmiRecords = pgTable("rmi_records", {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    quarter: integer("quarter").notNull(), // 1, 2, 3, 4
    naturalRubber: numeric("natural_rubber", { precision: 14, scale: 4 }).notNull().default("0"),
    syntheticRubber: numeric("synthetic_rubber", { precision: 14, scale: 4 }).notNull().default("0"),
    carbonBlack: numeric("carbon_black", { precision: 14, scale: 4 }).notNull().default("0"),
    steelCord: numeric("steel_cord", { precision: 14, scale: 4 }).notNull().default("0"),
    freight: numeric("freight", { precision: 14, scale: 4 }).notNull().default("0"),
    fxIndex: numeric("fx_index", { precision: 14, scale: 4 }).notNull().default("0"),
    rmiValue: numeric("rmi_value", { precision: 14, scale: 4 }).notNull().default("0"),
    source: varchar("source", { length: 255 }), // Sumber data RMI (e.g. API, Manual, IRSG)
    remarks: text("remarks"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const quarterlyExchangeRates = pgTable("quarterly_exchange_rates", {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    quarter: integer("quarter").notNull(), // 1, 2, 3, 4
    averageRate: numeric("average_rate", { precision: 14, scale: 2 }).notNull().default("0"),
    rateMonth1: numeric("rate_month_1", { precision: 14, scale: 2 }).notNull().default("0"),
    rateMonth2: numeric("rate_month_2", { precision: 14, scale: 2 }).notNull().default("0"),
    rateMonth3: numeric("rate_month_3", { precision: 14, scale: 2 }).notNull().default("0"),
    remarks: text("remarks"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const rmiRecordsRelations = relations(rmiRecords, ({ one }) => ({
    creator: one(user, {
        fields: [rmiRecords.createdBy],
        references: [user.id],
    }),
}))

export const quarterlyExchangeRatesRelations = relations(quarterlyExchangeRates, ({ one }) => ({
    creator: one(user, {
        fields: [quarterlyExchangeRates.createdBy],
        references: [user.id],
    }),
}))
