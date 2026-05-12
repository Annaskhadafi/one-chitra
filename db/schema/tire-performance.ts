import { pgTable, serial, text, timestamp, varchar, integer, numeric } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from "./auth"

export const tirePerformanceRecords = pgTable("tire_performance_records", {
    id: serial("id").primaryKey(),
    type: varchar("type", { length: 20 }).notNull(),
    performanceDate: varchar("performance_date", { length: 100 }).notNull(),
    endUser: varchar("end_user", { length: 150 }).notNull(),
    mineSite: varchar("mine_site", { length: 150 }).notNull(),
    manufacture: varchar("manufacture", { length: 150 }).notNull(),
    specification: text("specification").notNull(),
    avgHours: numeric("avg_hours", { precision: 14, scale: 2 }).notNull().default("0"),
    recordCount: integer("record_count").notNull().default(0),
    remarks: text("remarks"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const tirePerformanceRecordsRelations = relations(tirePerformanceRecords, ({ one }) => ({
    creator: one(user, {
        fields: [tirePerformanceRecords.createdBy],
        references: [user.id],
    }),
}))
