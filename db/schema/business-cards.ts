import { pgTable, serial, varchar, timestamp, text } from "drizzle-orm/pg-core"

export const businessCards = pgTable("business_cards", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    jobTitle: varchar("job_title", { length: 255 }),
    phone: varchar("phone", { length: 255 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    businessCategory: varchar("business_category", { length: 255 }),
    imageUrl: varchar("image_url", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
})
