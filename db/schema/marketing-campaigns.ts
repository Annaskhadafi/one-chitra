import { pgTable, serial, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

export const marketingCampaigns = pgTable("marketing_campaigns", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    content: text("content").notNull(), // HTML content
    description: text("description"), // Internal notes
    segmentCriteria: text("segment_criteria"), // JSON string for criteria
    ccEmails: text("cc_emails"), // JSON configuration for CC recipients
    channelType: varchar("channel_type", { length: 50 }).default("email").notNull(),
    attachments: text("attachments"), // JSON array string of {name, url}
    targetConfig: text("target_config"), // JSON configuration for recipients
    scheduledAt: timestamp("scheduled_at"),
    sentAt: timestamp("sent_at"), // When campaign was actually sent
    status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, scheduled, processing, sent, failed
    totalRecipients: integer("total_recipients").default(0),
    successCount: integer("success_count").default(0),
    failureCount: integer("failure_count").default(0),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaignRecipients = pgTable("campaign_recipients", {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").notNull().references(() => marketingCampaigns.id, { onDelete: "cascade" }),
    customerName: varchar("customer_name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("sent"), // sent | failed
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const marketingCampaignsRelations = relations(marketingCampaigns, ({ one, many }) => ({
    creator: one(user, {
        fields: [marketingCampaigns.createdBy],
        references: [user.id],
    }),
    recipients: many(campaignRecipients),
}));

export const campaignRecipientsRelations = relations(campaignRecipients, ({ one }) => ({
    campaign: one(marketingCampaigns, {
        fields: [campaignRecipients.campaignId],
        references: [marketingCampaigns.id],
    }),
}));
