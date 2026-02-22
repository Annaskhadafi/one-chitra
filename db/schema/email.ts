import { pgTable, varchar, text, timestamp, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";

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
    type: emailTemplateTypeEnum("type").notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    htmlContent: text("html_content").notNull(),
    textContent: text("text_content"),
    variables: jsonb("variables").$type<string[]>().default([]),
    recipientRoles: jsonb("recipient_roles").$type<string[]>().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailLogs = pgTable("email_logs", {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    templateId: varchar("template_id", { length: 36 }),
    toEmail: varchar("to_email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
