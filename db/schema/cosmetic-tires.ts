import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from "./auth"

export const cosmeticTires = pgTable("cosmetic_tires", {
    id: serial("id").primaryKey(),
    tyreSize: varchar("tyre_size", { length: 150 }),
    pattern: varchar("pattern", { length: 150 }),
    serialNumber: varchar("serial_number", { length: 150 }),
    month: varchar("month", { length: 50 }),
    city: varchar("city", { length: 150 }),
    year: varchar("year", { length: 50 }),
    materialNumber: varchar("material_number", { length: 150 }),
    description: text("description"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const cosmeticTiresRelations = relations(cosmeticTires, ({ one }) => ({
    creator: one(user, {
        fields: [cosmeticTires.createdBy],
        references: [user.id],
    }),
}))
