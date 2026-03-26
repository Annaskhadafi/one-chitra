import { pgTable, serial, integer, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

// Chat Rooms (supports both DM and Group)
export const chatRooms = pgTable("chat_rooms", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }), // null for DM, required for group
    type: varchar("type", { length: 10 }).default("dm").notNull(), // 'dm' | 'group'
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
});

// Chat Messages
export const chatMessages = pgTable("chat_messages", {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").references(() => chatRooms.id, { onDelete: "cascade" }).notNull(),
    senderId: varchar("sender_id").references(() => user.id).notNull(),
    content: text("content").notNull(),
    // Document mention support
    mentionType: varchar("mention_type", { length: 20 }), // 'quotation' | 'sales-order' | 'delivery' | null
    mentionId: varchar("mention_id", { length: 100 }), // ID atau nomor dokumen
    mentionLabel: varchar("mention_label", { length: 255 }), // Label yang ditampilkan
    isSystemMessage: boolean("is_system_message").default(false),
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
