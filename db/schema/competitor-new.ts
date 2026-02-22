import { pgTable, text, timestamp, uuid, numeric, boolean } from "drizzle-orm/pg-core";
import { user } from "./auth";

// 1. Price Competitor (Tire Competitor Database Chitra)
export const competitorPrices = pgTable("competitor_prices", {
    id: uuid("id").defaultRandom().primaryKey(),
    infoDate: timestamp("info_date").notNull(),
    businessConsultantId: text("business_consultant_id").references(() => user.id),
    consultantName: text("consultant_name"), // Storage for raw name from API or manual entry
    customerName: text("customer_name").notNull(),
    productSize: text("product_size").notNull(),
    category: text("category").notNull(), // Earthmover, Truck & Bus
    brand: text("brand").notNull(),
    supplier: text("supplier").notNull(),
    currency: text("currency").notNull(), // IDR, USD
    price: text("price").notNull(),
    remark: text("remark"),
    createdById: text("created_by_id").references(() => user.id).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Competitor Activity
export const competitorActivities = pgTable("competitor_activities", {
    id: uuid("id").defaultRandom().primaryKey(),
    businessConsultantId: text("business_consultant_id").references(() => user.id),
    infoDate: timestamp("info_date").notNull(),
    competitorName: text("competitor_name").notNull(),
    customerName: text("customer_name").notNull(),
    industryCategory: text("industry_category").notNull(),
    location: text("location").notNull(),
    activityType: text("activity_type").notNull(),
    marketResponse: text("market_response").notNull(), // Positif, Negatif, Netral
    businessImpact: text("business_impact").notNull(), // Tidak Ada, Rendah, Sedang, Tinggi
    description: text("description"),
    createdById: text("created_by_id").references(() => user.id).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 3. Lost Sale
export const lostSales = pgTable("lost_sales", {
    id: uuid("id").defaultRandom().primaryKey(),
    businessConsultantId: text("business_consultant_id").references(() => user.id),
    productType: text("product_type").notNull(),
    offeringDate: timestamp("offering_date").notNull(),
    customerName: text("customer_name").notNull(),
    productDetail: text("product_detail").notNull(),
    totalOffering: text("total_offering").notNull(),
    reason: text("reason").notNull(), // Price, Stock Availability, Quality, TOP Payment, OTHER
    remark: text("remark"),
    createdById: text("created_by_id").references(() => user.id).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").notNull(),
});

export type CompetitorPrice = typeof competitorPrices.$inferSelect;
export type CompetitorActivity = typeof competitorActivities.$inferSelect;
export type LostSale = typeof lostSales.$inferSelect;
