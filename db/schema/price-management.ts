import { pgTable, serial, integer, varchar, text, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customers";
import { products } from "./products";
import { user } from "./auth";

export const priceListTypeEnum = pgEnum("price_list_type", ["tier", "customer", "promotional"]);

// ── Master price list (per tier / per customer / promotional) ──
export const priceLists = pgTable("price_lists", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    type: priceListTypeEnum("type").default("tier").notNull(),
    customerId: integer("customer_id").references(() => customers.id),  // null = applies to tier/promo
    currency: varchar("currency", { length: 10 }).default("IDR").notNull(),
    validFrom: timestamp("valid_from").defaultNow().notNull(),
    validUntil: timestamp("valid_until"),  // null = permanent
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Items within a price list (one row per product per qty tier) ──
export const priceListItems = pgTable("price_list_items", {
    id: serial("id").primaryKey(),
    priceListId: integer("price_list_id").references(() => priceLists.id, { onDelete: "cascade" }).notNull(),
    productId: integer("product_id").references(() => products.id).notNull(),
    unitPrice: numeric("unit_price", { precision: 16, scale: 2 }).default("0").notNull(),
    minQty: integer("min_qty").default(1).notNull(),          // volume tier: from this qty
    maxQty: integer("max_qty"),                                // null = no upper bound
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).default("0").notNull(), // extra % discount on unitPrice
    marginFloor: numeric("margin_floor", { precision: 5, scale: 2 }).default("0").notNull(), // minimum acceptable margin %
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Audit trail of price changes ──
export const priceHistory = pgTable("price_history", {
    id: serial("id").primaryKey(),
    priceListItemId: integer("price_list_item_id").references(() => priceListItems.id, { onDelete: "cascade" }).notNull(),
    fieldChanged: varchar("field_changed", { length: 50 }).notNull(), // 'unit_price', 'discount_pct', 'margin_floor', etc.
    oldValue: text("old_value"),
    newValue: text("new_value"),
    reason: text("reason"),
    changedById: text("changed_by_id").references(() => user.id),
    changedAt: timestamp("changed_at").defaultNow().notNull(),
});

// ── Relations ────────────────────────────────────────────────────────────────

export const priceListsRelations = relations(priceLists, ({ one, many }) => ({
    customer: one(customers, {
        fields: [priceLists.customerId],
        references: [customers.id],
    }),
    createdBy: one(user, {
        fields: [priceLists.createdById],
        references: [user.id],
    }),
    items: many(priceListItems),
}));

export const priceListItemsRelations = relations(priceListItems, ({ one, many }) => ({
    priceList: one(priceLists, {
        fields: [priceListItems.priceListId],
        references: [priceLists.id],
    }),
    product: one(products, {
        fields: [priceListItems.productId],
        references: [products.id],
    }),
    history: many(priceHistory),
}));

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
    priceListItem: one(priceListItems, {
        fields: [priceHistory.priceListItemId],
        references: [priceListItems.id],
    }),
    changedBy: one(user, {
        fields: [priceHistory.changedById],
        references: [user.id],
    }),
}));
