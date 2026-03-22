import { pgTable, serial, integer, varchar, text, timestamp, boolean, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { salesOrders, salesOrderItems } from "./sales-orders";
import { warehouses } from "./warehouses";
import { products } from "./products";
import { user } from "./auth";
import { fleetTrips } from "./fleet-trips";

export const deliveries = pgTable("deliveries", {
    id: serial("id").primaryKey(),
    deliveryNumber: varchar("delivery_number", { length: 50 }).unique(),
    doSap: varchar("do_sap", { length: 100 }),
    salesOrderId: integer("sales_order_id").references(() => salesOrders.id).notNull(),
    scheduledDate: timestamp("scheduled_date").notNull(),
    deliveryDate: timestamp("delivery_date"),
    status: varchar("status", { length: 20 }).default("scheduled").notNull(),
    deliveryType: varchar("delivery_type", { length: 20 }).default("full").notNull(),
    driverName: varchar("driver_name", { length: 255 }),
    vehicleNumber: varchar("vehicle_number", { length: 50 }),
    vehicleType: varchar("vehicle_type", { length: 50 }),
    // Contact Info (Restored)
    contactName: varchar("contact_name", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    contactPerson: varchar("contact_person", { length: 255 }),
    // External Delivery Fields
    isExternal: boolean("is_external").default(false).notNull(),
    vendorName: varchar("vendor_name", { length: 255 }),
    awbNumber: varchar("awb_number", { length: 100 }),
    shippingCost: decimal("shipping_cost", { precision: 15, scale: 2 }).default("0"),
    // Internal Cost Breakdown
    tripDestination: varchar("trip_destination", { length: 255 }),
    costGasoline: decimal("cost_gasoline", { precision: 15, scale: 2 }).default("0"), // Keep old column to prevent data loss
    costGasolineDexlite: decimal("cost_gasoline_dexlite", { precision: 15, scale: 2 }).default("0"),
    costGasolineBio: decimal("cost_gasoline_bio", { precision: 15, scale: 2 }).default("0"),
    costToll: decimal("cost_toll", { precision: 15, scale: 2 }).default("0"),
    costParking: decimal("cost_parking", { precision: 15, scale: 2 }).default("0"),
    costMeals: decimal("cost_meals", { precision: 15, scale: 2 }).default("0"),
    costMaintenance: decimal("cost_maintenance", { precision: 15, scale: 2 }).default("0"),
    costOthers: decimal("cost_others", { precision: 15, scale: 2 }).default("0"),
    costRapidTest: decimal("cost_rapid_test", { precision: 15, scale: 2 }).default("0"),
    costFerry: decimal("cost_ferry", { precision: 15, scale: 2 }).default("0"),
    costPortal: decimal("cost_portal", { precision: 15, scale: 2 }).default("0"),
    costWashing: decimal("cost_washing", { precision: 15, scale: 2 }).default("0"),
    costEscort: decimal("cost_escort", { precision: 15, scale: 2 }).default("0"),
    warehouseId: integer("warehouse_id").references(() => warehouses.id),
    warehouseToId: integer("warehouse_to_id").references(() => warehouses.id),
    shippingAddress: text("shipping_address"),
    notes: text("notes"),
    // DO Monitoring Fields
    returnDoDate: timestamp("return_do_date"),
    invoiceNumber: varchar("invoice_number", { length: 100 }),
    invoiceDate: timestamp("invoice_date"),
    doStatus: varchar("do_status", { length: 50 }).default("Pending"),
    remark: text("remark"),
    scanDoDocument: varchar("scan_do_document", { length: 255 }),
    fleetTripId: integer("fleet_trip_id"), // Reference to fleet_trips table (circular dependency avoided by not importing it here directly in definition if possible, or handling carefully)
    createdBy: varchar("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deliveryItems = pgTable("delivery_items", {
    id: serial("id").primaryKey(),
    deliveryId: integer("delivery_id").references(() => deliveries.id, { onDelete: "cascade" }).notNull(),
    salesOrderItemId: integer("sales_order_item_id").references(() => salesOrderItems.id),
    productId: integer("product_id").references(() => products.id).notNull(),
    orderedQuantity: integer("ordered_quantity").default(0).notNull(),
    deliveredQuantity: integer("delivered_quantity").default(0).notNull(),
    serialNumbers: text("serial_numbers").array(),
});

// Import fleetTrips here to avoid circular dependency issues in table definition if possible, 
// but for relations it's fine.
// Avoid circular dependency with fleet-trips. Import it elsewhere if needed.

export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
    salesOrder: one(salesOrders, {
        fields: [deliveries.salesOrderId],
        references: [salesOrders.id],
    }),
    warehouse: one(warehouses, {
        fields: [deliveries.warehouseId],
        references: [warehouses.id],
        relationName: "deliveryOrigin"
    }),
    warehouseTo: one(warehouses, {
        fields: [deliveries.warehouseToId],
        references: [warehouses.id],
        relationName: "deliveryDestination"
    }),
    createdByUser: one(user, {
        fields: [deliveries.createdBy],
        references: [user.id],
    }),
    fleetTrip: one(fleetTrips, {
        fields: [deliveries.fleetTripId],
        references: [fleetTrips.id],
    }),
    items: many(deliveryItems),
}));

export const deliveryItemsRelations = relations(deliveryItems, ({ one }) => ({
    delivery: one(deliveries, {
        fields: [deliveryItems.deliveryId],
        references: [deliveries.id],
    }),
    salesOrderItem: one(salesOrderItems, {
        fields: [deliveryItems.salesOrderItemId],
        references: [salesOrderItems.id],
    }),
    product: one(products, {
        fields: [deliveryItems.productId],
        references: [products.id],
    }),
}));
