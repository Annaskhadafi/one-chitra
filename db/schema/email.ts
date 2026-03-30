import { pgTable, varchar, text, timestamp, boolean, jsonb, pgEnum, index, unique } from "drizzle-orm/pg-core";

export const emailTemplateTypeEnum = pgEnum("email_template_type", [
    "magic_link",
    "notification",
    "welcome",
    "password_reset",
    "order_confirmation",
    "delivery_update",
    "custom"
]);

export const emailRecipientRoleEnum = pgEnum("email_recipient_role", [
    "admin",
    "manager",
    "staff",
    "customer",
    "all"
]);

export const notificationDeliveryChannelEnum = pgEnum("notification_delivery_channel", [
    "email",
    "push",
]);

export const smtpSettings = pgTable("smtp_settings", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    host: varchar("host", { length: 255 }).notNull().default("smtp.gmail.com"),
    port: varchar("port", { length: 10 }).notNull().default("587"),
    secure: boolean("secure").notNull().default(false),
    username: varchar("username", { length: 255 }).notNull(),
    password: varchar("password", { length: 255 }).notNull(),
    fromEmail: varchar("from_email", { length: 255 }).notNull(),
    fromName: varchar("from_name", { length: 255 }).notNull().default("One Chitra"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailTemplates = pgTable("email_templates", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 120 }).unique(),
    type: emailTemplateTypeEnum("type").notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    htmlContent: text("html_content").notNull(),
    textContent: text("text_content"),
    variables: jsonb("variables").$type<string[]>().default([]),
    recipientRoles: jsonb("recipient_roles").$type<string[]>().default([]),
    recipientUserIds: jsonb("recipient_user_ids").$type<string[]>().default([]),
    ccEmails: jsonb("cc_emails").$type<string[]>().default([]),
    deliveryChannels: jsonb("delivery_channels").$type<Array<"email" | "push">>().default(["email"]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailLogs = pgTable("email_logs", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    templateId: varchar("template_id", { length: 36 }),
    templateCode: varchar("template_code", { length: 120 }),
    templateName: varchar("template_name", { length: 255 }),
    toEmail: text("to_email").notNull(),
    ccEmail: text("cc_email"),
    fromEmail: varchar("from_email", { length: 255 }),
    deliveryChannel: varchar("delivery_channel", { length: 20 }).notNull().default("email"),
    subject: varchar("subject", { length: 500 }).notNull(),
    htmlContent: text("html_content"),
    textContent: text("text_content"),
    actionUrl: text("action_url"),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailNotificationRules = pgTable("email_notification_rules", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar("name", { length: 255 }).notNull(),
    formKey: varchar("form_key", { length: 100 }).notNull(),
    combinator: varchar("combinator", { length: 3 }).notNull().default("AND"),
    conditions: jsonb("conditions").$type<Array<{
        id: string
        fieldKey: string
        operator: string
        value?: string | null
        dataType?: "string" | "number" | "date" | "boolean" | "array"
    }>>().default([]),
    toEmails: jsonb("to_emails").$type<string[]>().default([]),
    ccEmails: jsonb("cc_emails").$type<string[]>().default([]),
    options: jsonb("options").$type<{
        priority?: "low" | "normal" | "high" | "urgent"
        scheduleType?: "immediate" | "daily" | "weekly" | "custom_cron"
        scheduleValue?: string | null
        includeAttachments?: boolean
        attachmentMode?: "none" | "all" | "filtered"
        allowedFileTypes?: string[]
        maxAttachmentMb?: number
        replyTo?: string | null
        subjectPrefix?: string | null
    }>().default({}),
    templateId: varchar("template_id", { length: 36 }).notNull().references(() => emailTemplates.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    index("email_notification_rules_form_key_idx").on(t.formKey),
    index("email_notification_rules_active_idx").on(t.isActive),
]);

export const emailNotificationRuleStates = pgTable("email_notification_rule_states", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    ruleId: varchar("rule_id", { length: 36 }).notNull().references(() => emailNotificationRules.id, { onDelete: "cascade" }),
    entityId: varchar("entity_id", { length: 100 }).notNull(),
    lastMatched: boolean("last_matched").notNull().default(false),
    lastEvaluatedAt: timestamp("last_evaluated_at"),
    lastSentAt: timestamp("last_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
    unique("email_notification_rule_states_unique").on(t.ruleId, t.entityId),
    index("email_notification_rule_states_rule_id_idx").on(t.ruleId),
]);

export const emailNotificationRuleLogs = pgTable("email_notification_rule_logs", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    ruleId: varchar("rule_id", { length: 36 }).notNull().references(() => emailNotificationRules.id, { onDelete: "cascade" }),
    formKey: varchar("form_key", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }).notNull(),
    matched: boolean("matched").notNull().default(false),
    sent: boolean("sent").notNull().default(false),
    toEmail: text("to_email"),
    ccEmail: text("cc_email"),
    subject: varchar("subject", { length: 500 }),
    htmlContent: text("html_content"),
    textContent: text("text_content"),
    status: varchar("status", { length: 50 }).notNull().default("skipped"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
