import { pgTable, serial, text, timestamp, varchar, integer, real, index } from "drizzle-orm/pg-core";

export const aiInventoryPredictions = pgTable("ai_inventory_predictions", {
    id: serial("id").primaryKey(),
    productCode: varchar("product_code", { length: 100 }).notNull(),
    productName: text("product_name"),
    predictionType: varchar("prediction_type", { length: 50 }).notNull(), // 'REPLENISHMENT', 'SAFETY_STOCK', or 'CUSTOMER_RECOMMENDATION'
    recommendedStock: integer("recommended_stock").notNull(),
    rationale: text("rationale").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    
    // Accuracy tracking fields (Requirement 3)
    actualSales: integer("actual_sales"), // Actual sales data for comparison
    accuracyPercentage: real("accuracy_percentage"), // Calculated accuracy: 100 - ABS((Predicted - Actual) / Actual * 100)
    
    // Bulk prediction tracking (Requirement 4)
    batchId: varchar("batch_id", { length: 100 }), // Identifier for bulk prediction batches
    
    // Additional metadata
    currentStock: integer("current_stock"), // Stock level at time of prediction
}, (table) => ({
    // Performance indexes (Requirement 10)
    productCodeIdx: index("ai_predictions_product_code_idx").on(table.productCode),
    predictionTypeIdx: index("ai_predictions_type_idx").on(table.predictionType),
    createdAtIdx: index("ai_predictions_created_at_idx").on(table.createdAt),
    batchIdIdx: index("ai_predictions_batch_id_idx").on(table.batchId),
    accuracyIdx: index("ai_predictions_accuracy_idx").on(table.accuracyPercentage),
}));

// Notification system table (Requirement 8)
export const restockNotifications = pgTable("restock_notifications", {
    id: serial("id").primaryKey(),
    productCode: varchar("product_code", { length: 100 }).notNull(),
    productName: text("product_name"),
    currentStock: integer("current_stock").notNull(),
    recommendedStock: integer("recommended_stock").notNull(),
    urgencyLevel: varchar("urgency_level", { length: 20 }).notNull(), // 'CRITICAL', 'HIGH', 'MEDIUM'
    predictionId: integer("prediction_id").references(() => aiInventoryPredictions.id),
    isAcknowledged: integer("is_acknowledged").default(0).notNull(), // 0 = false, 1 = true (SQLite compatibility)
    acknowledgedAt: timestamp("acknowledged_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    productCodeIdx: index("notifications_product_code_idx").on(table.productCode),
    urgencyIdx: index("notifications_urgency_idx").on(table.urgencyLevel),
    acknowledgedIdx: index("notifications_acknowledged_idx").on(table.isAcknowledged),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
}));

// AI Settings table (Requirement 9)
export const aiSettings = pgTable("ai_settings", {
    id: serial("id").primaryKey(),
    settingKey: varchar("setting_key", { length: 100 }).notNull().unique(),
    settingValue: text("setting_value").notNull(),
    description: text("description"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: varchar("updated_by", { length: 100 }), // User ID who updated the setting
});
