import { pgTable, serial, varchar, numeric, timestamp, integer, text, boolean } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from "./auth"

export const rmiWeights = pgTable("rmi_weights", {
    id: serial("id").primaryKey(),
    label: varchar("label", { length: 255 }).notNull().default("Default"),
    naturalRubberWeight: numeric("natural_rubber_weight", { precision: 5, scale: 4 }).notNull().default("0.35"),
    syntheticRubberWeight: numeric("synthetic_rubber_weight", { precision: 5, scale: 4 }).notNull().default("0.20"),
    carbonBlackWeight: numeric("carbon_black_weight", { precision: 5, scale: 4 }).notNull().default("0.20"),
    steelCordWeight: numeric("steel_cord_weight", { precision: 5, scale: 4 }).notNull().default("0.15"),
    freightWeight: numeric("freight_weight", { precision: 5, scale: 4 }).notNull().default("0.05"),
    fxWeight: numeric("fx_weight", { precision: 5, scale: 4 }).notNull().default("0.05"),
    basePeriodNaturalRubber: numeric("base_period_natural_rubber", { precision: 14, scale: 4 }).notNull().default("2.05"),
    basePeriodSyntheticRubber: numeric("base_period_synthetic_rubber", { precision: 14, scale: 4 }).notNull().default("13200.0"),
    basePeriodCarbonBlack: numeric("base_period_carbon_black", { precision: 14, scale: 4 }).notNull().default("1.45"),
    basePeriodSteelCord: numeric("base_period_steel_cord", { precision: 14, scale: 4 }).notNull().default("1.10"),
    basePeriodFreight: numeric("base_period_freight", { precision: 14, scale: 4 }).notNull().default("2800.0"),
    basePeriodExchangeRate: numeric("base_period_exchange_rate", { precision: 14, scale: 4 }).notNull().default("16500.0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

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

export const rmiWeightsRelations = relations(rmiWeights, () => ({}))
