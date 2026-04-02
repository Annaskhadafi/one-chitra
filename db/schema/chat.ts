import { pgTable, serial, integer, varchar, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { user } from "./auth";

export type ChatAttachmentRecord = {
    kind: "image" | "gif" | "file" | "sticker" | "voice"
    name: string
    url?: string | null
    contentType?: string | null
    size?: number | null
    sticker?: string | null
    durationSeconds?: number | null
}

export type ChatReactionRecord = {
    emoji: string
    userIds: string[]
}

export type ChatSavedStickerRecord = {
    id: number
    userId: string
    name: string
    url: string
    contentType?: string | null
    size?: number | null
    createdAt: Date
}

// Chat Rooms (supports both DM and Group)
export const chatRooms = pgTable("chat_rooms", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }), // null for DM, required for group
    type: varchar("type", { length: 20 }).default("dm").notNull(), // 'dm' | 'group' | 'ai-helpdesk'
    createdBy: varchar("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Chat Room Members
export const chatRoomMembers = pgTable("chat_room_members", {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").references(() => chatRooms.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    lastReadAt: timestamp("last_read_at"), // untuk unread tracking
    lastSeenAt: timestamp("last_seen_at"),
    typingAt: timestamp("typing_at"),
    lastUnreadReminderAt: timestamp("last_unread_reminder_at"),
    unreadReminderCount: integer("unread_reminder_count").default(0).notNull(),
    isMuted: boolean("is_muted").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
});

// Chat Messages
export const chatMessages = pgTable("chat_messages", {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").references(() => chatRooms.id, { onDelete: "cascade" }).notNull(),
    senderId: varchar("sender_id").references(() => user.id).notNull(),
    content: text("content").notNull(),
    attachments: jsonb("attachments").$type<ChatAttachmentRecord[]>().default(sql`'[]'::jsonb`).notNull(),
    reactions: jsonb("reactions").$type<ChatReactionRecord[]>().default(sql`'[]'::jsonb`).notNull(),
    mentionedUserIds: jsonb("mentioned_user_ids").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    replyToMessageId: integer("reply_to_message_id"),
    // Document mention support
    mentionType: varchar("mention_type", { length: 20 }), // 'quotation' | 'sales-order' | 'delivery' | null
    mentionId: varchar("mention_id", { length: 100 }), // ID atau nomor dokumen
    mentionLabel: varchar("mention_label", { length: 255 }), // Label yang ditampilkan
    isSystemMessage: boolean("is_system_message").default(false),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
    editedAt: timestamp("edited_at"),
    pinnedAt: timestamp("pinned_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatUserStickers = pgTable("chat_user_stickers", {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    url: text("url").notNull(),
    contentType: varchar("content_type", { length: 120 }),
    size: integer("size"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const chatRoomsRelations = relations(chatRooms, ({ one, many }) => ({
    createdByUser: one(user, {
        fields: [chatRooms.createdBy],
        references: [user.id],
    }),
    members: many(chatRoomMembers),
    messages: many(chatMessages),
}));

export const chatRoomMembersRelations = relations(chatRoomMembers, ({ one }) => ({
    room: one(chatRooms, {
        fields: [chatRoomMembers.roomId],
        references: [chatRooms.id],
    }),
    user: one(user, {
        fields: [chatRoomMembers.userId],
        references: [user.id],
    }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
    room: one(chatRooms, {
        fields: [chatMessages.roomId],
        references: [chatRooms.id],
    }),
    sender: one(user, {
        fields: [chatMessages.senderId],
        references: [user.id],
    }),
}));

export const chatUserStickersRelations = relations(chatUserStickers, ({ one }) => ({
    user: one(user, {
        fields: [chatUserStickers.userId],
        references: [user.id],
    }),
}));
