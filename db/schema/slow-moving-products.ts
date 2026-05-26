import { pgTable, serial, varchar, text, timestamp, integer } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { user } from "./auth"

export const slowMovingProducts = pgTable("slow_moving_products", {
    id: serial("id").primaryKey(),
    materialKey: varchar("material_key", { length: 150 }).notNull().unique(),
    materialNumber: varchar("material_number", { length: 150 }).notNull(),
    description: text("description"),
    initialStock: integer("initial_stock").default(0).notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const slowMovingProductsRelations = relations(slowMovingProducts, ({ one }) => ({
    creator: one(user, {
        fields: [slowMovingProducts.createdBy],
        references: [user.id],
    }),
}))
