import { pgTable, serial, varchar, text, timestamp, integer, pgEnum, unique, index, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

export const contactCategoryEnum = pgEnum("contact_category", ["internal", "customer"]);

export const emailGroups = pgTable("email_groups", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailContacts = pgTable("email_contacts", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    companyName: varchar("company_name", { length: 255 }),
    position: varchar("position", { length: 255 }),
    category: contactCategoryEnum("category").default("customer").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailGroupMembers = pgTable("email_group_members", {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull().references(() => emailGroups.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").notNull().references(() => emailContacts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
    unique("group_contact_unique").on(t.groupId, t.contactId),
]);

export const emailGroupsRelations = relations(emailGroups, ({ one, many }) => ({
    creator: one(user, {
        fields: [emailGroups.createdBy],
        references: [user.id],
    }),
    members: many(emailGroupMembers),
}));

export const emailContactsRelations = relations(emailContacts, ({ many }) => ({
    groups: many(emailGroupMembers),
}));

export const emailGroupMembersRelations = relations(emailGroupMembers, ({ one }) => ({
    group: one(emailGroups, {
        fields: [emailGroupMembers.groupId],
        references: [emailGroups.id],
    }),
    contact: one(emailContacts, {
        fields: [emailGroupMembers.contactId],
        references: [emailContacts.id],
    }),
}));
