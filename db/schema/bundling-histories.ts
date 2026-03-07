import { pgTable, text, timestamp, uuid, numeric, jsonb } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const bundlingHistories = pgTable("bundling_histories", {
    id: uuid("id").defaultRandom().primaryKey(),
    scenarioName: text("scenario_name").notNull(),
    itemsData: jsonb("items_data").notNull(), // Menyimpan array of items
    competitorPrice: numeric("competitor_price").default("0").notNull(),
    targetMarginPercentage: numeric("target_margin_percentage").notNull(),
    recommendedQtyPrimary: numeric("recommended_qty_primary").default("0").notNull(),
    finalMarginAmount: numeric("final_margin_amount").notNull(),
    finalMarginPercentage: numeric("final_margin_percentage").notNull(),
    status: text("status"),
    createdById: text("created_by_id").references(() => user.id).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BundlingHistory = typeof bundlingHistories.$inferSelect;
export type NewBundlingHistory = typeof bundlingHistories.$inferInsert;
