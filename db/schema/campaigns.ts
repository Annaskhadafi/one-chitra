import { pgTable, serial, integer, text, timestamp, decimal, boolean, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const campaigns = pgTable("campaigns", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    status: text("status").notNull().default('active'), // active, inactive
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaignProducts = pgTable("campaign_products", {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
    materialNo: text("material_no"), // can be null if using materialGroup
    materialGroup: text("material_group"), // can be null if using materialNo
    customerCategoryCode: text("customer_category_code"),
    incentiveAmount: decimal("incentive_amount", { precision: 20, scale: 2 }).notNull(),
    isPercentage: boolean("is_percentage").notNull().default(false),
    activeStatus: boolean("active_status").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


export const campaignCustomerCategories = pgTable("campaign_customer_categories", {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
    categoryCode: text("category_code").notNull(),
    categoryName: text("category_name").notNull(),
    incentiveAmount: decimal("incentive_amount", { precision: 20, scale: 2 }).notNull(),
    isContractual: boolean("is_contractual").notNull().default(false),
    customerMatch: text("customer_match"),
    activeStatus: boolean("active_status").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const campaignContracts = pgTable("campaign_contracts", {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }).notNull(),
    customerId: text("customer_id").notNull(), // From SAP data
    customerName: text("customer_name").notNull(),
    contractNumber: text("contract_number"),
    customerCategoryCode: text("customer_category_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaignContractDetails = pgTable("campaign_contract_details", {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id").references(() => campaignContracts.id, { onDelete: "cascade" }).notNull(),
    materialNo: text("material_no").notNull(),
    qtyContract: integer("qty_contract").notNull().default(0),
    contractPrice: decimal("contract_price", { precision: 20, scale: 2 }).notNull().default('0'),
    forecastQtyPerMonth: integer("forecast_qty_per_month").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaignsRelations = relations(campaigns, ({ many }) => ({
    products: many(campaignProducts),
    contracts: many(campaignContracts),
    customerCategories: many(campaignCustomerCategories),
}));

export const campaignProductsRelations = relations(campaignProducts, ({ one }) => ({
    campaign: one(campaigns, {
        fields: [campaignProducts.campaignId],
        references: [campaigns.id],
    }),
}));


export const campaignCustomerCategoriesRelations = relations(campaignCustomerCategories, ({ one }) => ({
    campaign: one(campaigns, {
        fields: [campaignCustomerCategories.campaignId],
        references: [campaigns.id],
    }),
}));
export const campaignContractsRelations = relations(campaignContracts, ({ one, many }) => ({
    campaign: one(campaigns, {
        fields: [campaignContracts.campaignId],
        references: [campaigns.id],
    }),
    details: many(campaignContractDetails),
}));

export const campaignContractDetailsRelations = relations(campaignContractDetails, ({ one }) => ({
    contract: one(campaignContracts, {
        fields: [campaignContractDetails.contractId],
        references: [campaignContracts.id],
    }),
}));
