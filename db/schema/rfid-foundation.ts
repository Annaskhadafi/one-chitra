import {
    boolean,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    unique,
    varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { user } from "./auth";
import { products } from "./products";
import { warehouses } from "./warehouses";

export const trackingModeEnum = pgEnum("tracking_mode", [
    "manual_only",
    "optional_rfid",
    "required_rfid",
]);

export const trackingScopeTypeEnum = pgEnum("tracking_scope_type", [
    "category",
    "product",
]);

export const rfidZoneTypeEnum = pgEnum("rfid_zone_type", [
    "receiving",
    "outbound",
    "staging",
    "rack",
    "quarantine",
    "service",
    "desk",
]);

export const rfidDeviceTypeEnum = pgEnum("rfid_device_type", [
    "handheld_reader",
    "desktop_encoder",
    "fixed_reader",
    "printer_encoder",
]);

export const rfidTagStatusEnum = pgEnum("rfid_tag_status", [
    "blank",
    "active",
    "damaged",
    "lost",
    "retired",
    "locked",
]);

export const inventoryUnitStatusEnum = pgEnum("inventory_unit_status", [
    "draft",
    "awaiting_tagging",
    "received",
    "in_stock",
    "reserved",
    "picked",
    "in_transfer",
    "shipped",
    "returned",
    "scrapped",
]);

export const rfidTagBindingStatusEnum = pgEnum("rfid_tag_binding_status", [
    "active",
    "replaced",
    "unbound",
]);

export const rfidOperationTypeEnum = pgEnum("rfid_operation_type", [
    "inbound",
    "outbound",
    "transfer_out",
    "transfer_in",
    "opname",
    "find_tag",
    "register_tag",
    "replace_tag",
    "reset_tag",
    "verify_tag",
]);

export const rfidSessionStatusEnum = pgEnum("rfid_session_status", [
    "open",
    "completed",
    "cancelled",
    "error",
]);

export const rfidScanResultEnum = pgEnum("rfid_scan_result", [
    "matched",
    "unknown_tag",
    "duplicate",
    "wrong_warehouse",
    "wrong_document",
    "inactive_tag",
    "manual_override",
]);

export const rfidExceptionSeverityEnum = pgEnum("rfid_exception_severity", [
    "low",
    "medium",
    "high",
    "critical",
]);

export const rfidExceptionStatusEnum = pgEnum("rfid_exception_status", [
    "open",
    "investigating",
    "resolved",
    "ignored",
]);

export const rfidWriteOperationEnum = pgEnum("rfid_write_operation", [
    "register",
    "replace",
    "unbind",
    "reset",
    "verify",
]);

export const warehouseRfidSettings = pgTable("warehouse_rfid_settings", {
    id: serial("id").primaryKey(),
    warehouseId: integer("warehouse_id")
        .notNull()
        .references(() => warehouses.id, { onDelete: "cascade" }),
    isEnabled: boolean("is_enabled").default(false).notNull(),
    defaultTrackingMode: trackingModeEnum("default_tracking_mode").default("manual_only").notNull(),
    allowManualFallback: boolean("allow_manual_fallback").default(true).notNull(),
    requireInboundValidation: boolean("require_inbound_validation").default(false).notNull(),
    requireOutboundValidation: boolean("require_outbound_validation").default(false).notNull(),
    pilotNotes: text("pilot_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    warehouseUnique: unique("warehouse_rfid_settings_warehouse_unique").on(table.warehouseId),
}));

export const warehouseTrackingPolicies = pgTable("warehouse_tracking_policies", {
    id: serial("id").primaryKey(),
    warehouseId: integer("warehouse_id")
        .notNull()
        .references(() => warehouses.id, { onDelete: "cascade" }),
    scopeType: trackingScopeTypeEnum("scope_type").notNull(),
    productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 100 }),
    trackingMode: trackingModeEnum("tracking_mode").default("optional_rfid").notNull(),
    allowManualFallback: boolean("allow_manual_fallback").default(true).notNull(),
    serialRequired: boolean("serial_required").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const warehouseZones = pgTable("warehouse_zones", {
    id: serial("id").primaryKey(),
    warehouseId: integer("warehouse_id")
        .notNull()
        .references(() => warehouses.id, { onDelete: "cascade" }),
    zoneCode: varchar("zone_code", { length: 50 }).notNull(),
    zoneName: varchar("zone_name", { length: 120 }).notNull(),
    zoneType: rfidZoneTypeEnum("zone_type").default("receiving").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    warehouseZoneCodeUnique: unique("warehouse_zones_warehouse_zone_code_unique").on(table.warehouseId, table.zoneCode),
}));

export const rfidDevices = pgTable("rfid_devices", {
    id: serial("id").primaryKey(),
    deviceCode: varchar("device_code", { length: 100 }).notNull().unique(),
    deviceName: varchar("device_name", { length: 150 }).notNull(),
    deviceType: rfidDeviceTypeEnum("device_type").default("handheld_reader").notNull(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    zoneId: integer("zone_id").references(() => warehouseZones.id, { onDelete: "set null" }),
    canRead: boolean("can_read").default(true).notNull(),
    canWrite: boolean("can_write").default(false).notNull(),
    canReset: boolean("can_reset").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rfidTags = pgTable("rfid_tags", {
    id: serial("id").primaryKey(),
    epc: varchar("epc", { length: 128 }).notNull().unique(),
    tid: varchar("tid", { length: 128 }).unique(),
    tagSerial: varchar("tag_serial", { length: 120 }),
    tagType: varchar("tag_type", { length: 50 }).default("label").notNull(),
    status: rfidTagStatusEnum("status").default("blank").notNull(),
    isReusable: boolean("is_reusable").default(false).notNull(),
    memoryMaterialNumber: varchar("memory_material_number", { length: 100 }),
    memorySerialNumber: varchar("memory_serial_number", { length: 150 }),
    lastSeenWarehouseId: integer("last_seen_warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    lastSeenAt: timestamp("last_seen_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryUnits = pgTable("inventory_units", {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
        .notNull()
        .references(() => products.id, { onDelete: "restrict" }),
    warehouseId: integer("warehouse_id")
        .notNull()
        .references(() => warehouses.id, { onDelete: "restrict" }),
    zoneId: integer("zone_id").references(() => warehouseZones.id, { onDelete: "set null" }),
    serialNumber: varchar("serial_number", { length: 150 }),
    currentTagId: integer("current_tag_id").references(() => rfidTags.id, { onDelete: "set null" }),
    trackingMode: trackingModeEnum("tracking_mode").default("manual_only").notNull(),
    status: inventoryUnitStatusEnum("status").default("draft").notNull(),
    originDocumentType: varchar("origin_document_type", { length: 50 }),
    originDocumentId: integer("origin_document_id"),
    lastMovementAt: timestamp("last_movement_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    inventoryUnitsSerialUnique: unique("inventory_units_serial_number_unique").on(table.serialNumber),
    inventoryUnitsCurrentTagUnique: unique("inventory_units_current_tag_unique").on(table.currentTagId),
}));

export const rfidTagBindings = pgTable("rfid_tag_bindings", {
    id: serial("id").primaryKey(),
    rfidTagId: integer("rfid_tag_id")
        .notNull()
        .references(() => rfidTags.id, { onDelete: "cascade" }),
    inventoryUnitId: integer("inventory_unit_id")
        .notNull()
        .references(() => inventoryUnits.id, { onDelete: "cascade" }),
    status: rfidTagBindingStatusEnum("status").default("active").notNull(),
    writeOperation: rfidWriteOperationEnum("write_operation").default("register").notNull(),
    boundBy: text("bound_by").references(() => user.id),
    boundAt: timestamp("bound_at").defaultNow().notNull(),
    unboundBy: text("unbound_by").references(() => user.id),
    unboundAt: timestamp("unbound_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryUnitEvents = pgTable("inventory_unit_events", {
    id: serial("id").primaryKey(),
    inventoryUnitId: integer("inventory_unit_id")
        .notNull()
        .references(() => inventoryUnits.id, { onDelete: "cascade" }),
    productId: integer("product_id")
        .notNull()
        .references(() => products.id, { onDelete: "restrict" }),
    warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    zoneId: integer("zone_id").references(() => warehouseZones.id, { onDelete: "set null" }),
    rfidTagId: integer("rfid_tag_id").references(() => rfidTags.id, { onDelete: "set null" }),
    operationType: rfidOperationTypeEnum("operation_type").notNull(),
    documentType: varchar("document_type", { length: 50 }),
    documentId: integer("document_id"),
    captureMethod: varchar("capture_method", { length: 20 }).default("manual").notNull(),
    referenceNumber: varchar("reference_number", { length: 100 }),
    quantity: integer("quantity").default(1).notNull(),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rfidScanSessions = pgTable("rfid_scan_sessions", {
    id: serial("id").primaryKey(),
    sessionCode: varchar("session_code", { length: 100 }).notNull().unique(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    zoneId: integer("zone_id").references(() => warehouseZones.id, { onDelete: "set null" }),
    deviceId: integer("device_id").references(() => rfidDevices.id, { onDelete: "set null" }),
    operationType: rfidOperationTypeEnum("operation_type").notNull(),
    documentType: varchar("document_type", { length: 50 }),
    documentId: integer("document_id"),
    captureMethod: varchar("capture_method", { length: 20 }).default("rfid").notNull(),
    status: rfidSessionStatusEnum("status").default("open").notNull(),
    manualOverrideReason: text("manual_override_reason"),
    startedBy: text("started_by").references(() => user.id),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rfidScanEvents = pgTable("rfid_scan_events", {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
        .notNull()
        .references(() => rfidScanSessions.id, { onDelete: "cascade" }),
    epc: varchar("epc", { length: 128 }).notNull(),
    tid: varchar("tid", { length: 128 }),
    rfidTagId: integer("rfid_tag_id").references(() => rfidTags.id, { onDelete: "set null" }),
    inventoryUnitId: integer("inventory_unit_id").references(() => inventoryUnits.id, { onDelete: "set null" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    zoneId: integer("zone_id").references(() => warehouseZones.id, { onDelete: "set null" }),
    scanResult: rfidScanResultEnum("scan_result").default("unknown_tag").notNull(),
    readCount: integer("read_count").default(1).notNull(),
    rssi: numeric("rssi", { precision: 10, scale: 2 }),
    antenna: varchar("antenna", { length: 50 }),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rfidExceptions = pgTable("rfid_exceptions", {
    id: serial("id").primaryKey(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    zoneId: integer("zone_id").references(() => warehouseZones.id, { onDelete: "set null" }),
    deviceId: integer("device_id").references(() => rfidDevices.id, { onDelete: "set null" }),
    sessionId: integer("session_id").references(() => rfidScanSessions.id, { onDelete: "set null" }),
    inventoryUnitId: integer("inventory_unit_id").references(() => inventoryUnits.id, { onDelete: "set null" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    rfidTagId: integer("rfid_tag_id").references(() => rfidTags.id, { onDelete: "set null" }),
    exceptionType: varchar("exception_type", { length: 50 }).notNull(),
    severity: rfidExceptionSeverityEnum("severity").default("medium").notNull(),
    status: rfidExceptionStatusEnum("status").default("open").notNull(),
    documentType: varchar("document_type", { length: 50 }),
    documentId: integer("document_id"),
    referenceNumber: varchar("reference_number", { length: 100 }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    resolvedBy: text("resolved_by").references(() => user.id),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rfidTagWriteSessions = pgTable("rfid_tag_write_sessions", {
    id: serial("id").primaryKey(),
    deviceId: integer("device_id").references(() => rfidDevices.id, { onDelete: "set null" }),
    warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    zoneId: integer("zone_id").references(() => warehouseZones.id, { onDelete: "set null" }),
    rfidTagId: integer("rfid_tag_id").references(() => rfidTags.id, { onDelete: "set null" }),
    inventoryUnitId: integer("inventory_unit_id").references(() => inventoryUnits.id, { onDelete: "set null" }),
    operationType: rfidWriteOperationEnum("operation_type").notNull(),
    status: rfidSessionStatusEnum("status").default("open").notNull(),
    materialNumber: varchar("material_number", { length: 100 }),
    serialNumber: varchar("serial_number", { length: 150 }),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    requestedBy: text("requested_by").references(() => user.id),
    executedAt: timestamp("executed_at"),
    verifiedAt: timestamp("verified_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const warehouseRfidSettingsRelations = relations(warehouseRfidSettings, ({ one }) => ({
    warehouse: one(warehouses, {
        fields: [warehouseRfidSettings.warehouseId],
        references: [warehouses.id],
    }),
}));

export const warehouseTrackingPoliciesRelations = relations(warehouseTrackingPolicies, ({ one }) => ({
    warehouse: one(warehouses, {
        fields: [warehouseTrackingPolicies.warehouseId],
        references: [warehouses.id],
    }),
    product: one(products, {
        fields: [warehouseTrackingPolicies.productId],
        references: [products.id],
    }),
}));

export const warehouseZonesRelations = relations(warehouseZones, ({ one, many }) => ({
    warehouse: one(warehouses, {
        fields: [warehouseZones.warehouseId],
        references: [warehouses.id],
    }),
    devices: many(rfidDevices),
    inventoryUnits: many(inventoryUnits),
    scanSessions: many(rfidScanSessions),
    scanEvents: many(rfidScanEvents),
    exceptions: many(rfidExceptions),
}));

export const rfidDevicesRelations = relations(rfidDevices, ({ one, many }) => ({
    warehouse: one(warehouses, {
        fields: [rfidDevices.warehouseId],
        references: [warehouses.id],
    }),
    zone: one(warehouseZones, {
        fields: [rfidDevices.zoneId],
        references: [warehouseZones.id],
    }),
    scanSessions: many(rfidScanSessions),
    exceptions: many(rfidExceptions),
    tagWriteSessions: many(rfidTagWriteSessions),
}));

export const rfidTagsRelations = relations(rfidTags, ({ one, many }) => ({
    lastSeenWarehouse: one(warehouses, {
        fields: [rfidTags.lastSeenWarehouseId],
        references: [warehouses.id],
    }),
    currentInventoryUnits: many(inventoryUnits),
    bindings: many(rfidTagBindings),
    unitEvents: many(inventoryUnitEvents),
    scanEvents: many(rfidScanEvents),
    exceptions: many(rfidExceptions),
    writeSessions: many(rfidTagWriteSessions),
}));

export const inventoryUnitsRelations = relations(inventoryUnits, ({ one, many }) => ({
    product: one(products, {
        fields: [inventoryUnits.productId],
        references: [products.id],
    }),
    warehouse: one(warehouses, {
        fields: [inventoryUnits.warehouseId],
        references: [warehouses.id],
    }),
    zone: one(warehouseZones, {
        fields: [inventoryUnits.zoneId],
        references: [warehouseZones.id],
    }),
    currentTag: one(rfidTags, {
        fields: [inventoryUnits.currentTagId],
        references: [rfidTags.id],
    }),
    bindings: many(rfidTagBindings),
    events: many(inventoryUnitEvents),
    scanEvents: many(rfidScanEvents),
    exceptions: many(rfidExceptions),
    writeSessions: many(rfidTagWriteSessions),
}));

export const rfidTagBindingsRelations = relations(rfidTagBindings, ({ one }) => ({
    rfidTag: one(rfidTags, {
        fields: [rfidTagBindings.rfidTagId],
        references: [rfidTags.id],
    }),
    inventoryUnit: one(inventoryUnits, {
        fields: [rfidTagBindings.inventoryUnitId],
        references: [inventoryUnits.id],
    }),
    boundByUser: one(user, {
        fields: [rfidTagBindings.boundBy],
        references: [user.id],
        relationName: "rfidTagBindingBoundBy",
    }),
    unboundByUser: one(user, {
        fields: [rfidTagBindings.unboundBy],
        references: [user.id],
        relationName: "rfidTagBindingUnboundBy",
    }),
}));

export const inventoryUnitEventsRelations = relations(inventoryUnitEvents, ({ one }) => ({
    inventoryUnit: one(inventoryUnits, {
        fields: [inventoryUnitEvents.inventoryUnitId],
        references: [inventoryUnits.id],
    }),
    product: one(products, {
        fields: [inventoryUnitEvents.productId],
        references: [products.id],
    }),
    warehouse: one(warehouses, {
        fields: [inventoryUnitEvents.warehouseId],
        references: [warehouses.id],
    }),
    zone: one(warehouseZones, {
        fields: [inventoryUnitEvents.zoneId],
        references: [warehouseZones.id],
    }),
    rfidTag: one(rfidTags, {
        fields: [inventoryUnitEvents.rfidTagId],
        references: [rfidTags.id],
    }),
    createdByUser: one(user, {
        fields: [inventoryUnitEvents.createdBy],
        references: [user.id],
    }),
}));

export const rfidScanSessionsRelations = relations(rfidScanSessions, ({ one, many }) => ({
    warehouse: one(warehouses, {
        fields: [rfidScanSessions.warehouseId],
        references: [warehouses.id],
    }),
    zone: one(warehouseZones, {
        fields: [rfidScanSessions.zoneId],
        references: [warehouseZones.id],
    }),
    device: one(rfidDevices, {
        fields: [rfidScanSessions.deviceId],
        references: [rfidDevices.id],
    }),
    startedByUser: one(user, {
        fields: [rfidScanSessions.startedBy],
        references: [user.id],
    }),
    events: many(rfidScanEvents),
    exceptions: many(rfidExceptions),
}));

export const rfidScanEventsRelations = relations(rfidScanEvents, ({ one }) => ({
    session: one(rfidScanSessions, {
        fields: [rfidScanEvents.sessionId],
        references: [rfidScanSessions.id],
    }),
    rfidTag: one(rfidTags, {
        fields: [rfidScanEvents.rfidTagId],
        references: [rfidTags.id],
    }),
    inventoryUnit: one(inventoryUnits, {
        fields: [rfidScanEvents.inventoryUnitId],
        references: [inventoryUnits.id],
    }),
    product: one(products, {
        fields: [rfidScanEvents.productId],
        references: [products.id],
    }),
    warehouse: one(warehouses, {
        fields: [rfidScanEvents.warehouseId],
        references: [warehouses.id],
    }),
    zone: one(warehouseZones, {
        fields: [rfidScanEvents.zoneId],
        references: [warehouseZones.id],
    }),
}));

export const rfidExceptionsRelations = relations(rfidExceptions, ({ one }) => ({
    warehouse: one(warehouses, {
        fields: [rfidExceptions.warehouseId],
        references: [warehouses.id],
    }),
    zone: one(warehouseZones, {
        fields: [rfidExceptions.zoneId],
        references: [warehouseZones.id],
    }),
    device: one(rfidDevices, {
        fields: [rfidExceptions.deviceId],
        references: [rfidDevices.id],
    }),
    session: one(rfidScanSessions, {
        fields: [rfidExceptions.sessionId],
        references: [rfidScanSessions.id],
    }),
    inventoryUnit: one(inventoryUnits, {
        fields: [rfidExceptions.inventoryUnitId],
        references: [inventoryUnits.id],
    }),
    product: one(products, {
        fields: [rfidExceptions.productId],
        references: [products.id],
    }),
    rfidTag: one(rfidTags, {
        fields: [rfidExceptions.rfidTagId],
        references: [rfidTags.id],
    }),
    resolvedByUser: one(user, {
        fields: [rfidExceptions.resolvedBy],
        references: [user.id],
    }),
}));

export const rfidTagWriteSessionsRelations = relations(rfidTagWriteSessions, ({ one }) => ({
    device: one(rfidDevices, {
        fields: [rfidTagWriteSessions.deviceId],
        references: [rfidDevices.id],
    }),
    warehouse: one(warehouses, {
        fields: [rfidTagWriteSessions.warehouseId],
        references: [warehouses.id],
    }),
    zone: one(warehouseZones, {
        fields: [rfidTagWriteSessions.zoneId],
        references: [warehouseZones.id],
    }),
    rfidTag: one(rfidTags, {
        fields: [rfidTagWriteSessions.rfidTagId],
        references: [rfidTags.id],
    }),
    inventoryUnit: one(inventoryUnits, {
        fields: [rfidTagWriteSessions.inventoryUnitId],
        references: [inventoryUnits.id],
    }),
    requestedByUser: one(user, {
        fields: [rfidTagWriteSessions.requestedBy],
        references: [user.id],
    }),
}));
