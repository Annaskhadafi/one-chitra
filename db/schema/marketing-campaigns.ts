import { pgTable, serial, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

export const marketingCampaigns = pgTable("marketing_campaigns", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    content: text("content").notNull(), // HTML content
    segmentCriteria: text("segment_criteria"), // JSON string for criteria
    scheduledAt: timestamp("scheduled_at"),
    status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, scheduled, processing, sent, failed
    totalRecipients: integer("total_recipients").default(0),
    successCount: integer("success_count").default(0),
    failureCount: integer("failure_count").default(0),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const marketingCampaignsRelations = relations(marketingCampaigns, ({ one }) => ({
    creator: one(user, {
        fields: [marketingCampaigns.createdBy],
        references: [user.id],
    }),
}));
