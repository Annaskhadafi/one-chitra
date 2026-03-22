import { pgTable, serial, integer, text, varchar, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { warehouses } from "./warehouses";
import { products } from "./products";
import { user } from "./auth";

export const stockOpnameStatusEnum = pgEnum("stock_opname_status", ["open", "closed", "cancelled"]);

export const stockOpnameSessions = pgTable("stock_opname_sessions", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    warehouseId: integer("warehouse_id").references(() => warehouses.id).notNull(),
    status: stockOpnameStatusEnum("status").default("open").notNull(),
    sourceType: varchar("source_type", { length: 20 }).default("sap").notNull(), // sap | actual
    notes: text("notes"),
    selectedCategories: jsonb("selected_categories").$type<string[]>().default([]).notNull(),
    notifyRoles: jsonb("notify_roles").$type<string[]>().default([]).notNull(),
    notifyUserIds: jsonb("notify_user_ids").$type<string[]>().default([]).notNull(),
    
    // Pre-count documentation fields
    opnameDate: timestamp("opname_date").notNull(),
    opnameTime: varchar("opname_time", { length: 10 }).notNull(), // HH:MM format
    location: varchar("location", { length: 200 }).notNull(),
    
    // Document fields for audit documentation
    documentUrl: varchar("document_url", { length: 500 }),
    documentTitle: varchar("document_title", { length: 200 }),
    documentFileName: varchar("document_file_name", { length: 200 }),
    documentFileType: varchar("document_file_type", { length: 100 }),
    documentFileSize: integer("document_file_size"),
    documentUploadedAt: timestamp("document_uploaded_at"),
    documentUploadedBy: text("document_uploaded_by").references(() => user.id),
    
    createdById: text("created_by_id").references(() => user.id),
    closedById: text("closed_by_id").references(() => user.id),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stockOpnameItems = pgTable("stock_opname_items", {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").references(() => stockOpnameSessions.id).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    systemQty: integer("system_qty").default(0).notNull(),   // qty from stockLevels at time of count
    countedQty: integer("counted_qty"),                      // qty physically counted (null = not yet counted)
    variance: integer("variance"),                           // countedQty - systemQty
    notes: text("notes"),
    countedById: text("counted_by_id").references(() => user.id),
    countedAt: timestamp("counted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stockOpnameSignatures = pgTable("stock_opname_signatures", {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")/*.references(() => stockOpnameSessions.id, { onDelete: "cascade" })*/.notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    position: varchar("position", { length: 200 }).notNull(),
    order: integer("order").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockOpnameSessionsRelations = relations(stockOpnameSessions, ({ one, many }) => ({
    warehouse: one(warehouses, {
        fields: [stockOpnameSessions.warehouseId],
        references: [warehouses.id],
    }),
    createdBy: one(user, {
        fields: [stockOpnameSessions.createdById],
        references: [user.id],
        relationName: "opnameCreatedBy",
    }),
    closedBy: one(user, {
        fields: [stockOpnameSessions.closedById],
        references: [user.id],
        relationName: "opnameClosedBy",
    }),
    items: many(stockOpnameItems),
    signatures: many(stockOpnameSignatures),
}));

export const stockOpnameItemsRelations = relations(stockOpnameItems, ({ one }) => ({
    session: one(stockOpnameSessions, {
        fields: [stockOpnameItems.sessionId],
        references: [stockOpnameSessions.id],
    }),
    product: one(products, {
        fields: [stockOpnameItems.productId],
        references: [products.id],
    }),
    countedBy: one(user, {
        fields: [stockOpnameItems.countedById],
        references: [user.id],
        relationName: "opnameCountedBy",
    }),
}));

export const stockOpnameSignaturesRelations = relations(stockOpnameSignatures, ({ one }) => ({
    session: one(stockOpnameSessions, {
        fields: [stockOpnameSignatures.sessionId],
        references: [stockOpnameSessions.id],
    }),
}));
