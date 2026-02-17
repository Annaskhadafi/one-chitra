import { pgTable, serial, varchar, text } from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 50 }).unique().notNull(),
    description: text("description"),
});
