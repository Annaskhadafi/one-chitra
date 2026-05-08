import { pgTable, serial, integer, text, timestamp, decimal, date, jsonb } from "drizzle-orm/pg-core";
import { deliveries } from "./deliveries";

export const deliveryCostRequests = pgTable("delivery_cost_requests", {
    id: serial("id").primaryKey(),
    requestDate: date("request_date").notNull(),
    accNo: text("acc_no"),
    bankName: text("bank_name"),
    accountName: text("account_name"),
    remarks: text("remarks"),
    requestBy: text("request_by"),
    knownBy1: text("known_by_1"),
    knownBy2: text("known_by_2"),
    approvedBy: text("approved_by"),
    receivedBy: text("received_by"),
    totalRequest: decimal("total_request", { precision: 20, scale: 2 }),
    totalTransfer: decimal("total_transfer", { precision: 20, scale: 2 }),
    totalBalance: decimal("total_balance", { precision: 20, scale: 2 }), // KURANG
    status: text("status").default("Pengajuan").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deliveryCostRequestItems = pgTable("delivery_cost_request_items", {
    id: serial("id").primaryKey(),
    requestId: integer("request_id"), // .references(() => deliveryCostRequests.id, { onDelete: "cascade" }),
    deliveryId: integer("delivery_id"), // .references(() => deliveries.id, { onDelete: "set null" }),
    noPol: text("no_pol"),
    driverName: text("driver_name"),
    tripDestination: text("trip_destination"),
    fuelCost: decimal("fuel_cost", { precision: 20, scale: 2 }).default("0"), // Keep old column to prevent data loss
    fuelCostDexlite: decimal("fuel_cost_dexlite", { precision: 20, scale: 2 }).default("0"),
    fuelCostBio: decimal("fuel_cost_bio", { precision: 20, scale: 2 }).default("0"),
    mealAllowance: decimal("meal_allowance", { precision: 20, scale: 2 }).default("0"),
    medicalTest: decimal("medical_test", { precision: 20, scale: 2 }).default("0"),
    tollRoad: decimal("toll_road", { precision: 20, scale: 2 }).default("0"),
    ferryCost: decimal("ferry_cost", { precision: 20, scale: 2 }).default("0"),
    portalCost: decimal("portal_cost", { precision: 20, scale: 2 }).default("0"),
    washGreaseCost: decimal("wash_grease_cost", { precision: 20, scale: 2 }).default("0"),
    escortCost: decimal("escort_cost", { precision: 20, scale: 2 }).default("0"),
    totalCost: decimal("total_cost", { precision: 20, scale: 2 }).default("0"),
    realizationStatus: text("realization_status").default("Done"),
    realizationRemarks: text("realization_remarks"),
    realizationDetails: jsonb("realization_details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deliveryCostCredits = pgTable("delivery_cost_credits", {
    id: serial("id").primaryKey(),
    creditDate: date("credit_date").notNull(),
    amount: decimal("amount", { precision: 20, scale: 2 }).default("0").notNull(),
    remarks: text("remarks"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
