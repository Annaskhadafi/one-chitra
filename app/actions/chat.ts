"use server"

import { db } from "@/db"
import { chatRooms, chatRoomMembers, chatMessages } from "@/db/schema"
import { quotations, salesOrders, salesOrderItems, deliveries, customers } from "@/db/schema"
import { user as userTable } from "@/db/schema"
import { eq, and, desc, sql, gt, ne } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { ensureChatSchema } from "@/lib/chat-schema"

async function getCurrentUserId() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) throw new Error("Unauthorized")
    return session.user.id
}

export type ChatRoomWithMeta = {
    id: number
    name: string | null
    type: string
    members: { userId: string; name: string; email: string; image: string | null }[]
    lastMessage: { content: string; senderName: string; createdAt: string } | null
    unreadCount: number
}

export type ChatMessage = {
    id: number
    roomId: number
    senderId: string
    senderName: string
    senderImage: string | null
    content: string
    mentionType: string | null
    mentionId: string | null
    mentionLabel: string | null
    createdAt: string
}

export type UnreadChatReminder = {
    membershipId: number
    roomId: number
    roomName: string
    recipientUserId: string
    recipientName: string
    recipientEmail: string
    unreadCount: number
    latestUnreadAt: string
    latestSenderName: string
    latestMessagePreview: string
    reminderCount: number
}

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) throw new Error("Unauthorized")

    const currentUser = await db.query.user.findFirst({
        where: eq(userTable.id, session.user.id),
    })

    if (!currentUser) throw new Error("User not found")
    return currentUser
}

// Get all users for chat (to start conversations with)
export async function getChatUsers() {
    const users = await db.select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        image: userTable.image,
    }).from(userTable)
    return users
}

// Get or create a DM room between two users
export async function getOrCreateDmRoom(otherUserId: string): Promise<{ roomId: number }> {
    const currentUserId = await getCurrentUserId()
    if (currentUserId === otherUserId) throw new Error("Cannot create DM with yourself")

    // Check if DM room already exists
    const existingRooms = await db
        .select({ roomId: chatRoomMembers.roomId })
        .from(chatRoomMembers)
        .where(eq(chatRoomMembers.userId, currentUserId))

    for (const { roomId } of existingRooms) {
        const room = await db.query.chatRooms.findFirst({
            where: and(eq(chatRooms.id, roomId), eq(chatRooms.type, "dm")),
        })
        if (!room) continue

        const members = await db.select().from(chatRoomMembers).where(eq(chatRoomMembers.roomId, roomId))
        const hasOther = members.some((m) => m.userId === otherUserId)
        if (hasOther && members.length === 2) {
            return { roomId }
        }
    }

    // Create new DM room
    const [newRoom] = await db.insert(chatRooms).values({
        type: "dm",
        createdBy: currentUserId,
    }).returning({ id: chatRooms.id })

    await db.insert(chatRoomMembers).values([
        { roomId: newRoom.id, userId: currentUserId },
        { roomId: newRoom.id, userId: otherUserId },
    ])

    return { roomId: newRoom.id }
}

// Create a group room
export async function createGroupRoom(name: string, memberIds: string[]): Promise<{ roomId: number }> {
    const currentUserId = await getCurrentUserId()

    const [newRoom] = await db.insert(chatRooms).values({
        name,
        type: "group",
        createdBy: currentUserId,
    }).returning({ id: chatRooms.id })

    const allMembers = Array.from(new Set([currentUserId, ...memberIds]))
    await db.insert(chatRoomMembers).values(
        allMembers.map((userId) => ({ roomId: newRoom.id, userId }))
    )

    return { roomId: newRoom.id }
}

// Send a message
export async function sendMessage(
    roomId: number,
    content: string,
    mention?: { type: string; id: string; label: string }
) {
    const currentUserId = await getCurrentUserId()

    // Verify membership
    const membership = await db.query.chatRoomMembers.findFirst({
        where: and(
            eq(chatRoomMembers.roomId, roomId),
            eq(chatRoomMembers.userId, currentUserId)
        ),
    })
    if (!membership) throw new Error("Not a member of this room")

    await db.insert(chatMessages).values({
        roomId,
        senderId: currentUserId,
        content,
        mentionType: mention?.type ?? null,
        mentionId: mention?.id ?? null,
        mentionLabel: mention?.label ?? null,
    })

    // Update room updatedAt
    await db.update(chatRooms).set({ updatedAt: new Date() }).where(eq(chatRooms.id, roomId))

    revalidatePath("/dashboard")
    return { success: true }
}

// Delete chat room for current user.
// If the room has no members left, delete the room (messages cascade).
export async function deleteChatRoom(roomId: number) {
    const currentUserId = await getCurrentUserId()

    const membership = await db.query.chatRoomMembers.findFirst({
        where: and(
            eq(chatRoomMembers.roomId, roomId),
            eq(chatRoomMembers.userId, currentUserId),
        ),
    })

    if (!membership) throw new Error("Not a member of this room")

    await db
        .delete(chatRoomMembers)
        .where(
            and(
                eq(chatRoomMembers.roomId, roomId),
                eq(chatRoomMembers.userId, currentUserId),
            ),
        )

    const [memberCountRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatRoomMembers)
        .where(eq(chatRoomMembers.roomId, roomId))

    if (Number(memberCountRow?.count ?? 0) === 0) {
        await db.delete(chatRooms).where(eq(chatRooms.id, roomId))
    }

    revalidatePath("/dashboard")
    return { success: true }
}

// Get messages for a room
export async function getRoomMessages(roomId: number, limit = 50): Promise<ChatMessage[]> {
    await ensureChatSchema()
    const currentUserId = await getCurrentUserId()

    const membership = await db.query.chatRoomMembers.findFirst({
        where: and(
            eq(chatRoomMembers.roomId, roomId),
            eq(chatRoomMembers.userId, currentUserId)
        ),
    })
    if (!membership) throw new Error("Not a member of this room")

    const msgs = await db
        .select({
            id: chatMessages.id,
            roomId: chatMessages.roomId,
            senderId: chatMessages.senderId,
            senderName: userTable.name,
            senderImage: userTable.image,
            content: chatMessages.content,
            mentionType: chatMessages.mentionType,
            mentionId: chatMessages.mentionId,
            mentionLabel: chatMessages.mentionLabel,
            createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .innerJoin(userTable, eq(chatMessages.senderId, userTable.id))
        .where(eq(chatMessages.roomId, roomId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit)

    // Mark as read
    await db.update(chatRoomMembers)
        .set({ lastReadAt: new Date(), lastUnreadReminderAt: null, unreadReminderCount: 0 })
        .where(and(
            eq(chatRoomMembers.roomId, roomId),
            eq(chatRoomMembers.userId, currentUserId)
        ))

    return msgs.reverse().map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
    }))
}

// Get user's rooms with unread counts & last message
export async function getUserRooms(): Promise<ChatRoomWithMeta[]> {
    await ensureChatSchema()
    const currentUserId = await getCurrentUserId()

    const myMemberships = await db
        .select({ roomId: chatRoomMembers.roomId, lastReadAt: chatRoomMembers.lastReadAt })
        .from(chatRoomMembers)
        .where(eq(chatRoomMembers.userId, currentUserId))

    const result: ChatRoomWithMeta[] = []

    for (const { roomId, lastReadAt } of myMemberships) {
        const room = await db.query.chatRooms.findFirst({
            where: eq(chatRooms.id, roomId),
        })
        if (!room) continue

        // Get members detail
        const memberRows = await db
            .select({ userId: chatRoomMembers.userId })
            .from(chatRoomMembers)
            .where(eq(chatRoomMembers.roomId, roomId))

        const memberDetails = await Promise.all(
            memberRows.map(async ({ userId }) => {
                const u = await db.query.user.findFirst({ where: eq(userTable.id, userId) })
                return u ? { userId: u.id, name: u.name, email: u.email, image: u.image ?? null } : null
            })
        )
        const members = memberDetails.filter(Boolean) as ChatRoomWithMeta["members"]

        // Last message
        const [lastMsg] = await db
            .select({
                content: chatMessages.content,
                senderName: userTable.name,
                createdAt: chatMessages.createdAt,
            })
            .from(chatMessages)
            .innerJoin(userTable, eq(chatMessages.senderId, userTable.id))
            .where(eq(chatMessages.roomId, roomId))
            .orderBy(desc(chatMessages.createdAt))
            .limit(1)

        // Unread count
        let unreadCount = 0
        if (lastReadAt) {
            const [row] = await db
                .select({ count: sql<number>`count(*)` })
                .from(chatMessages)
                .where(and(
                    eq(chatMessages.roomId, roomId),
                    ne(chatMessages.senderId, currentUserId),
                    gt(chatMessages.createdAt, lastReadAt)
                ))
            unreadCount = Number(row?.count ?? 0)
        } else {
            const [row] = await db
                .select({ count: sql<number>`count(*)` })
                .from(chatMessages)
                .where(and(
                    eq(chatMessages.roomId, roomId),
                    ne(chatMessages.senderId, currentUserId),
                ))
            unreadCount = Number(row?.count ?? 0)
        }

        // Name for DM: other person's name
        let displayName = room.name
        if (room.type === "dm") {
            const other = members.find((m) => m.userId !== currentUserId)
            displayName = other?.name ?? "Unknown"
        }

        result.push({
            id: room.id,
            name: displayName,
            type: room.type,
            members,
            lastMessage: lastMsg
                ? { content: lastMsg.content, senderName: lastMsg.senderName, createdAt: lastMsg.createdAt.toISOString() }
                : null,
            unreadCount,
        })
    }

    // Sort by last message date
    return result.sort((a, b) => {
        const da = a.lastMessage?.createdAt ?? ""
        const db2 = b.lastMessage?.createdAt ?? ""
        return db2.localeCompare(da)
    })
}

export async function getUnreadChatReminders(overdueMinutes = 60): Promise<UnreadChatReminder[]> {
    await ensureChatSchema()
    const cutoff = new Date(Date.now() - overdueMinutes * 60 * 1000)

    const memberships = await db
        .select({
            membershipId: chatRoomMembers.id,
            roomId: chatRoomMembers.roomId,
            userId: chatRoomMembers.userId,
            lastReadAt: chatRoomMembers.lastReadAt,
            lastUnreadReminderAt: chatRoomMembers.lastUnreadReminderAt,
            unreadReminderCount: chatRoomMembers.unreadReminderCount,
            recipientName: userTable.name,
            recipientEmail: userTable.email,
        })
        .from(chatRoomMembers)
        .innerJoin(userTable, eq(chatRoomMembers.userId, userTable.id))

    const reminders: UnreadChatReminder[] = []

    for (const membership of memberships) {
        if (!membership.recipientEmail) {
            continue
        }

        if ((membership.unreadReminderCount ?? 0) >= 5) {
            continue
        }

        const unreadCondition = membership.lastReadAt
            ? and(
                eq(chatMessages.roomId, membership.roomId),
                ne(chatMessages.senderId, membership.userId),
                gt(chatMessages.createdAt, membership.lastReadAt),
            )
            : and(
                eq(chatMessages.roomId, membership.roomId),
                ne(chatMessages.senderId, membership.userId),
            )

        const unreadMessages = await db
            .select({
                id: chatMessages.id,
                content: chatMessages.content,
                createdAt: chatMessages.createdAt,
                senderName: userTable.name,
            })
            .from(chatMessages)
            .innerJoin(userTable, eq(chatMessages.senderId, userTable.id))
            .where(unreadCondition)
            .orderBy(desc(chatMessages.createdAt))

        if (unreadMessages.length === 0) {
            continue
        }

        const latestUnread = unreadMessages[0]
        if (latestUnread.createdAt > cutoff) {
            continue
        }

        if (membership.lastUnreadReminderAt && membership.lastUnreadReminderAt >= latestUnread.createdAt) {
            continue
        }

        const room = await db.query.chatRooms.findFirst({
            where: eq(chatRooms.id, membership.roomId),
        })

        if (!room) {
            continue
        }

        let roomName = room.name ?? "Chat"
        if (room.type === "dm") {
            const memberRows = await db
                .select({
                    userId: chatRoomMembers.userId,
                    name: userTable.name,
                })
                .from(chatRoomMembers)
                .innerJoin(userTable, eq(chatRoomMembers.userId, userTable.id))
                .where(eq(chatRoomMembers.roomId, membership.roomId))

            roomName = memberRows.find((member) => member.userId !== membership.userId)?.name ?? roomName
        }

        reminders.push({
            membershipId: membership.membershipId,
            roomId: membership.roomId,
            roomName,
            recipientUserId: membership.userId,
            recipientName: membership.recipientName,
            recipientEmail: membership.recipientEmail,
            unreadCount: unreadMessages.length,
            latestUnreadAt: latestUnread.createdAt.toISOString(),
            latestSenderName: latestUnread.senderName,
            latestMessagePreview: latestUnread.content.slice(0, 180),
            reminderCount: membership.unreadReminderCount ?? 0,
        })
    }

    return reminders
}

export async function markUnreadChatReminderSent(membershipId: number) {
    await ensureChatSchema()
    const membership = await db.query.chatRoomMembers.findFirst({
        where: eq(chatRoomMembers.id, membershipId),
    })

    if (!membership) {
        return
    }
    await db
        .update(chatRoomMembers)
        .set({
            lastUnreadReminderAt: new Date(),
            unreadReminderCount: (membership.unreadReminderCount ?? 0) + 1,
        })
        .where(eq(chatRoomMembers.id, membershipId))
}

// Search documents for "/" mention
export async function searchDocumentsForMention(query: string) {
    const currentUser = await getCurrentUser()
    const normalizedQuery = query.trim().toLowerCase()
    const q = `%${normalizedQuery}%`
    const isSalesRole = currentUser.role.trim().toLowerCase() === "sales"
    const isQuotationShortcut = normalizedQuery.startsWith("quo")
    const quotationFilter = normalizedQuery.length > 3 ? `%${normalizedQuery.slice(3)}%` : null
    const isPoShortcut = normalizedQuery.startsWith("po")
    const poFilter = normalizedQuery.length > 2 ? `%${normalizedQuery.slice(2)}%` : null

    const salesQuotationResults = isSalesRole && isQuotationShortcut
        ? await db.select({
            id: quotations.id,
            number: quotations.quotationNumber,
            subject: quotations.subject,
        }).from(quotations)
            .where(
                quotationFilter
                    ? and(
                        eq(quotations.createdBy, currentUser.id),
                        sql`(
                            lower(coalesce(${quotations.quotationNumber}, '')) like ${quotationFilter}
                            or lower(coalesce(${quotations.subject}, '')) like ${quotationFilter}
                        )`
                    )
                    : eq(quotations.createdBy, currentUser.id)
            )
            .orderBy(desc(quotations.quotationDate))
            .limit(10)
        : null

    const poShortcutResults = isPoShortcut
        ? await db.select({
            id: salesOrders.id,
            number: salesOrders.invoiceNumber,
            customerPo: salesOrders.customerPo,
            subject: salesOrders.quotationSubject,
            customerName: customers.name,
            totalQty: sql<number>`coalesce((select sum(${salesOrderItems.quantity}) from ${salesOrderItems} where ${salesOrderItems.salesOrderId} = ${salesOrders.id}), 0)`,
            totalValue: sql<string>`coalesce((select sum(${salesOrderItems.quantity} * ${salesOrderItems.unitPrice})::text from ${salesOrderItems} where ${salesOrderItems.salesOrderId} = ${salesOrders.id}), '0')`,
        }).from(salesOrders)
            .leftJoin(customers, eq(salesOrders.customerId, customers.id))
            .where(
                poFilter
                    ? sql`lower(coalesce(${salesOrders.customerPo}, '')) like ${poFilter}`
                    : sql`coalesce(${salesOrders.customerPo}, '') <> ''`
            )
            .orderBy(desc(salesOrders.createdAt))
            .limit(10)
        : null

    const [quotationResults, soResults, deliveryResults] = await Promise.all([
        db.select({
            id: quotations.id,
            number: quotations.quotationNumber,
            subject: quotations.subject,
        }).from(quotations)
            .where(sql`lower(${quotations.quotationNumber}) like ${q} or lower(${quotations.subject}) like ${q}`)
            .limit(5),

        db.select({
            id: salesOrders.id,
            number: salesOrders.invoiceNumber,
            customerPo: salesOrders.customerPo,
            subject: salesOrders.quotationSubject,
            customerName: customers.name,
            totalQty: sql<number>`coalesce((select sum(${salesOrderItems.quantity}) from ${salesOrderItems} where ${salesOrderItems.salesOrderId} = ${salesOrders.id}), 0)`,
            totalValue: sql<string>`coalesce((select sum(${salesOrderItems.quantity} * ${salesOrderItems.unitPrice})::text from ${salesOrderItems} where ${salesOrderItems.salesOrderId} = ${salesOrders.id}), '0')`,
        }).from(salesOrders)
            .leftJoin(customers, eq(salesOrders.customerId, customers.id))
            .where(sql`(
                lower(coalesce(${salesOrders.invoiceNumber}, '')) like ${q}
                or lower(coalesce(${salesOrders.customerPo}, '')) like ${q}
                or lower(coalesce(${salesOrders.quotationSubject}, '')) like ${q}
                or lower(coalesce(${customers.name}, '')) like ${q}
            )`)
            .limit(5),

        db.select({
            id: deliveries.id,
            number: deliveries.deliveryNumber,
        }).from(deliveries)
            .where(sql`lower(${deliveries.deliveryNumber}) like ${q}`)
            .limit(5),
    ])

    const quotationMap = new Map<string, {
        type: "quotation"
        id: string
        label: string
        sublabel: string
        url: string
    }>()

    for (const q of salesQuotationResults ?? []) {
        quotationMap.set(String(q.id), {
            type: "quotation",
            id: String(q.id),
            label: q.number || `Quotation #${q.id}`,
            sublabel: q.subject || "",
            url: `/dashboard/quotations/${q.id}`,
        })
    }

    for (const q of quotationResults) {
        quotationMap.set(String(q.id), {
            type: "quotation",
            id: String(q.id),
            label: q.number || `Quotation #${q.id}`,
            sublabel: q.subject || "",
            url: `/dashboard/quotations/${q.id}`,
        })
    }

    const soMap = new Map<string, {
        type: "sales-order"
        id: string
        label: string
        sublabel: string
        details: string
        url: string
    }>()

    for (const s of poShortcutResults ?? []) {
        soMap.set(String(s.id), {
            type: "sales-order",
            id: String(s.id),
            label: s.customerPo || s.number || `SO #${s.id}`,
            sublabel: s.number || s.subject || "",
            details: `${s.customerName || "Customer -"} • Qty ${Number(s.totalQty ?? 0)} • Total ${Number(s.totalValue ?? 0).toLocaleString("id-ID")}`,
            url: `/dashboard/sales-orders?id=${s.id}`,
        })
    }

    for (const s of soResults) {
        soMap.set(String(s.id), {
            type: "sales-order" as const,
            id: String(s.id),
            label: s.number || s.customerPo || `SO #${s.id}`,
            sublabel: s.subject || s.customerPo || "",
            details: `${s.customerName || "Customer -"} • Qty ${Number(s.totalQty ?? 0)} • Total ${Number(s.totalValue ?? 0).toLocaleString("id-ID")}`,
            url: `/dashboard/sales-orders?id=${s.id}`,
        })
    }

    return [
        ...Array.from(quotationMap.values()),
        ...Array.from(soMap.values()),
        ...deliveryResults.map((d) => ({
            type: "delivery" as const,
            id: String(d.id),
            label: d.number || `DLV #${d.id}`,
            sublabel: "",
            url: `/dashboard/deliveries?id=${d.id}`,
        })),
    ]
}
