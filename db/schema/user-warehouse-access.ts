import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { warehouses } from "./warehouses";

export const userWarehouseAccess = pgTable("user_warehouse_access", {
    id: serial("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    warehouseId: integer("warehouse_id")
        .notNull()
        .references(() => warehouses.id, { onDelete: "cascade" }),
    accessLevel: varchar("access_level", { length: 10 }).default("edit").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
    unique("user_warehouse_access_user_warehouse_unique").on(table.userId, table.warehouseId),
]);

export const userWarehouseAccessRelations = relations(userWarehouseAccess, ({ one }) => ({
    user: one(user, {
        fields: [userWarehouseAccess.userId],
        references: [user.id],
    }),
    warehouse: one(warehouses, {
        fields: [userWarehouseAccess.warehouseId],
        references: [warehouses.id],
    }),
}));
