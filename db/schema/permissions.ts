import { pgTable, serial, varchar, text, unique } from "drizzle-orm/pg-core";

export const permissions = pgTable("permissions", {
    id: serial("id").primaryKey(),
    resource: varchar("resource", { length: 50 }).notNull(), // e.g., 'inventory', 'users'
    action: varchar("action", { length: 50 }).notNull(),     // e.g., 'create', 'read', 'update', 'delete'
    description: text("description"),
}, (t) => [
    unique("resource_action_unique").on(t.resource, t.action),
]);
