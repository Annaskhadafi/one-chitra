import { pgTable, serial, text, doublePrecision, timestamp, boolean } from "drizzle-orm/pg-core";

export const forecasts = pgTable("forecasts", {
    id: serial("id").primaryKey(),
    period: text("period").notNull(), // Format: "MM.YYYY" e.g. "01.2026"
    targetName: text("target_name").notNull(), // e.g. "Consolidate", "PA", "Service", "Kal", "East", "CK", "SIS", "MA OC", "MA WIS"
    targetType: text("target_type").notNull(), // e.g. "OVERALL", "PRODUCT", "AREA", "CUSTOMER", "SALESMAN"
    amount: doublePrecision("amount").default(0).notNull(),
    isYearly: boolean("is_yearly").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
