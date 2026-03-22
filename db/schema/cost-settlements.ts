import { relations } from "drizzle-orm";
import {
    date,
    decimal,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { fleetTrips } from "./fleet-trips";
import { deliveries, deliveryItems } from "./deliveries";
import { approvalRequests } from "./approval-workflows";

export const costSettlementTypeEnum = pgEnum("cost_settlement_type", ["trip", "delivery"]);
export const costSettlementStatusEnum = pgEnum("cost_settlement_status", ["draft", "submitted", "approved", "rejected", "posted"]);
export const costSettlementCategoryEnum = pgEnum("cost_settlement_category", ["gasoline", "toll", "parking", "meals", "maintenance", "others", "rapid_test", "ferry", "portal", "washing", "escort"]);

export const costSettlements = pgTable("cost_settlements", {
    id: serial("id").primaryKey(),
    settlementNumber: varchar("settlement_number", { length: 50 }).notNull().unique(),
    settlementType: costSettlementTypeEnum("settlement_type").notNull(),
    fleetTripId: integer("fleet_trip_id").references(() => fleetTrips.id),
    deliveryId: integer("delivery_id").references(() => deliveries.id),
    driverName: varchar("driver_name", { length: 255 }),
    vehicleNumber: varchar("vehicle_number", { length: 50 }),
    advanceAmount: decimal("advance_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    totalActualAmount: decimal("total_actual_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    varianceAmount: decimal("variance_amount", { precision: 15, scale: 2 }).notNull().default("0"),
    status: costSettlementStatusEnum("status").notNull().default("draft"),
    approvalRequestId: varchar("approval_request_id", { length: 36 }).references(() => approvalRequests.id),
    settlementDate: date("settlement_date").notNull(),
    remarks: text("remarks"),
    createdBy: varchar("created_by").references(() => user.id).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
}, (t) => [
    index("cost_settlements_type_idx").on(t.settlementType),
    index("cost_settlements_status_idx").on(t.status),
    index("cost_settlements_settlement_date_idx").on(t.settlementDate),
    index("cost_settlements_trip_idx").on(t.fleetTripId),
    index("cost_settlements_delivery_idx").on(t.deliveryId),
]);

export const costSettlementItems = pgTable("cost_settlement_items", {
    id: serial("id").primaryKey(),
    settlementId: integer("settlement_id").notNull().references(() => costSettlements.id, { onDelete: "cascade" }),
    costCategory: costSettlementCategoryEnum("cost_category").notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
    receiptDate: date("receipt_date"),
    vendorName: varchar("vendor_name", { length: 255 }),
    deliveryItemId: integer("delivery_item_id").references(() => deliveryItems.id),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
    index("cost_settlement_items_settlement_idx").on(t.settlementId),
    index("cost_settlement_items_category_idx").on(t.costCategory),
]);

export const costSettlementReceipts = pgTable("cost_settlement_receipts", {
    id: serial("id").primaryKey(),
    settlementItemId: integer("settlement_item_id").notNull().references(() => costSettlementItems.id, { onDelete: "cascade" }),
    fileUrl: varchar("file_url", { length: 255 }).notNull(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    fileSize: integer("file_size").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    uploadedBy: varchar("uploaded_by").references(() => user.id).notNull(),
}, (t) => [
    index("cost_settlement_receipts_item_idx").on(t.settlementItemId),
]);

export const costSettlementSignatories = pgTable("cost_settlement_signatories", {
    id: serial("id").primaryKey(),
    settlementId: integer("settlement_id").notNull().references(() => costSettlements.id, { onDelete: "cascade" }),
    signatoryName: varchar("signatory_name", { length: 255 }).notNull(),
    signatoryPosition: varchar("signatory_position", { length: 255 }).notNull(),
    signatoryRole: varchar("signatory_role", { length: 100 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
    index("cost_settlement_signatories_settlement_idx").on(t.settlementId),
]);

export const costSettlementsRelations = relations(costSettlements, ({ many, one }) => ({
    fleetTrip: one(fleetTrips, {
        fields: [costSettlements.fleetTripId],
        references: [fleetTrips.id],
    }),
    delivery: one(deliveries, {
        fields: [costSettlements.deliveryId],
        references: [deliveries.id],
    }),
    approvalRequest: one(approvalRequests, {
        fields: [costSettlements.approvalRequestId],
        references: [approvalRequests.id],
    }),
    items: many(costSettlementItems),
    signatories: many(costSettlementSignatories),
    createdByUser: one(user, {
        fields: [costSettlements.createdBy],
        references: [user.id],
    }),
}));

export const costSettlementItemsRelations = relations(costSettlementItems, ({ many, one }) => ({
    settlement: one(costSettlements, {
        fields: [costSettlementItems.settlementId],
        references: [costSettlements.id],
    }),
    deliveryItem: one(deliveryItems, {
        fields: [costSettlementItems.deliveryItemId],
        references: [deliveryItems.id],
    }),
    receipts: many(costSettlementReceipts),
}));

export const costSettlementReceiptsRelations = relations(costSettlementReceipts, ({ one }) => ({
    item: one(costSettlementItems, {
        fields: [costSettlementReceipts.settlementItemId],
        references: [costSettlementItems.id],
    }),
    uploader: one(user, {
        fields: [costSettlementReceipts.uploadedBy],
        references: [user.id],
    }),
}));

export const costSettlementSignatoriesRelations = relations(costSettlementSignatories, ({ one }) => ({
    settlement: one(costSettlements, {
        fields: [costSettlementSignatories.settlementId],
        references: [costSettlements.id],
    }),
}));
