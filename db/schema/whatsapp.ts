import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { user } from "./auth"

export const whatsappRegisteredNumbers = pgTable("whatsapp_registered_numbers", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    phoneNumber: text("phone_number").notNull().unique(),
    contactName: text("contact_name").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    role: text("role").notNull().default("sales"), // "admin" | "management" | "sales" | "inventory" | "technician" | "external"
    canAccessRevenue: boolean("can_access_revenue").notNull().default(false),
    canAccessStock: boolean("can_access_stock").notNull().default(true),
    canAccessQuotation: boolean("can_access_quotation").notNull().default(false),
    canReceiveBroadcast: boolean("can_receive_broadcast").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
    index("whatsapp_reg_phone_idx").on(table.phoneNumber),
    index("whatsapp_reg_role_idx").on(table.role),
    index("whatsapp_reg_user_idx").on(table.userId),
])

export const whatsappConversations = pgTable("whatsapp_conversations", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    phoneNumber: text("phone_number").notNull().unique(),
    context: jsonb("context").$type<Record<string, any>>().default({}),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
    index("whatsapp_conv_phone_idx").on(table.phoneNumber),
    index("whatsapp_conv_last_msg_idx").on(table.lastMessageAt),
])

export const whatsappMessages = pgTable("whatsapp_messages", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id").references(() => whatsappConversations.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    direction: text("direction").notNull(), // "inbound" | "outbound"
    messageType: text("message_type").notNull().default("text"), // "text" | "document" | "image"
    content: text("content").notNull(),
    mediaUrl: text("media_url"),
    toolCalls: jsonb("tool_calls").$type<any[]>().default([]),
    status: text("status").notNull().default("sent"), // "pending" | "sent" | "delivered" | "failed"
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
    index("whatsapp_msg_conv_idx").on(table.conversationId),
    index("whatsapp_msg_phone_idx").on(table.phoneNumber),
    index("whatsapp_msg_created_idx").on(table.createdAt),
])

export const whatsappNotificationLogs = pgTable("whatsapp_notification_logs", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    eventType: text("event_type").notNull(), // "quotation_approval" | "stock_minimum_alert" | "delivery_status" | "broadcast" | "system"
    recipientNumber: text("recipient_number").notNull(),
    recipientName: text("recipient_name"),
    messageContent: text("message_content").notNull(),
    referenceId: text("reference_id"),
    status: text("status").notNull().default("sent"), // "sent" | "failed"
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
    index("whatsapp_notif_type_idx").on(table.eventType),
    index("whatsapp_notif_phone_idx").on(table.recipientNumber),
    index("whatsapp_notif_created_idx").on(table.createdAt),
])
