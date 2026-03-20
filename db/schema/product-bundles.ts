import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { products } from "./products";

export const productBundleItems = pgTable("product_bundle_items", {
    id: serial("id").primaryKey(),
    parentProductId: integer("parent_product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
    childProductId: integer("child_product_id").references(() => products.id).notNull(),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productBundleItemsRelations = relations(productBundleItems, ({ one }) => ({
    parentProduct: one(products, {
        fields: [productBundleItems.parentProductId],
        references: [products.id],
        relationName: "bundleParent"
    }),
    childProduct: one(products, {
        fields: [productBundleItems.childProductId],
        references: [products.id],
        relationName: "bundleChild"
    }),
}));

export const productsBundlesRelations = relations(products, ({ many }) => ({
    bundleItems: many(productBundleItems, { relationName: "bundleParent" }),
    partOfBundles: many(productBundleItems, { relationName: "bundleChild" }),
}));
