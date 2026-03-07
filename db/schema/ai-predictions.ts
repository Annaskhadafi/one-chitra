import { pgTable, serial, text, timestamp, varchar, integer } from "drizzle-orm/pg-core";

export const aiInventoryPredictions = pgTable("ai_inventory_predictions", {
    id: serial("id").primaryKey(),
    productCode: varchar("product_code", { length: 100 }).notNull(),
    productName: text("product_name"),
    predictionType: varchar("prediction_type", { length: 50 }).notNull(), // 'REPLENISHMENT' or 'SAFETY_STOCK'
    recommendedStock: integer("recommended_stock").notNull(),
    rationale: text("rationale").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
