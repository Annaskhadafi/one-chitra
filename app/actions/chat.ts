"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { and, desc, eq, gt, ilike, inArray, lt, ne, or, sql } from "drizzle-orm"

import { db } from "@/db"
import { auth } from "@/lib/auth"
import { generateHelpDeskReply } from "@/app/actions/helpdesk-ai"
import { HELP_DESK_CONFIG } from "@/lib/helpdesk-config"
import { ensureChatSchema } from "@/lib/chat-schema"
import { sendLoggedNotificationMessage } from "@/lib/email"
import { sendPushNotificationToUsers } from "@/lib/push-notifications"
import { chatMessages, chatRoomMembers, chatRooms, deliveries, quotations, salesOrders, user as userTable, type ChatAttachmentRecord } from "@/db/schema"

type MentionPayload = {
    type: string
    id: string
    label: string
}

export type ChatAttachment = ChatAttachmentRecord

export type ChatRoomMemberMeta = {
    userId: string
    name: string
    email: string
    image: string | null
    lastReadAt: string | null
    lastSeenAt: string | null
    isTyping: boolean
}

export type ChatRoomWithMeta = {
    id: number
    name: string | null
    type: string
    members: ChatRoomMemberMeta[]
    lastMessage: { content: string; senderName: string; createdAt: string } | null
    unreadCount: number
    isMuted: boolean
    isArchived: boolean
    isPinned: boolean
    updatedAt: string
}

export type ChatMessage = {
    id: number
    roomId: number
    senderId: string
    senderName: string
    senderImage: string | null
    content: string
    attachments: ChatAttachment[]
    mentionType: string | null
    mentionId: string | null
    mentionLabel: string | null
    createdAt: string
    replyTo: {
        id: number
        content: string
        senderName: string
    } | null
    readBy: { userId: string; name: string }[]
}

export type ChatRoomSnapshot = {
    messages: ChatMessage[]
    hasMore: boolean
    typingMembers: { userId: string; name: string }[]
    memberPresence: { userId: string; name: string; lastSeenAt: string | null; isOnline: boolean }[]
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

async function getSessionUser() {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    return session.user
}

async function getCurrentUserId() {
    return (await getSessionUser()).id
}

async function getCurrentUser() {
    const sessionUser = await getSessionUser()
    const currentUser = await db.query.user.findFirst({
        where: eq(userTable.id, sessionUser.id),
    })

    if (!currentUser) {
        throw new Error("User not found")
    }

    return currentUser
}

async function assertMembership(roomId: number, userId: string) {
    await ensureChatSchema()

    const membership = await db.query.chatRoomMembers.findFirst({
        where: and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, userId)),
    })

    if (!membership) {
        throw new Error("Not a member of this room")
    }

    return membership
}

async function touchMembership(roomId: number, userId: string, markRead = false) {
    const now = new Date()

    await db
        .update(chatRoomMembers)
        .set({
            lastSeenAt: now,
            typingAt: null,
            ...(markRead
                ? {
                    lastReadAt: now,
                    lastUnreadReminderAt: null,
                    unreadReminderCount: 0,
                }
                : {}),
        })
        .where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, userId)))
}

async function getMemberRows(roomId: number) {
    return db
        .select({
            userId: chatRoomMembers.userId,
            name: userTable.name,
            email: userTable.email,
            image: userTable.image,
            lastReadAt: chatRoomMembers.lastReadAt,
            lastSeenAt: chatRoomMembers.lastSeenAt,
            isMuted: chatRoomMembers.isMuted,
            isArchived: chatRoomMembers.isArchived,
            isPinned: chatRoomMembers.isPinned,
            typingAt: chatRoomMembers.typingAt,
        })
        .from(chatRoomMembers)
        .innerJoin(userTable, eq(chatRoomMembers.userId, userTable.id))
        .where(eq(chatRoomMembers.roomId, roomId))
}

function normalizeAttachments(value: unknown): ChatAttachment[] {
    if (!Array.isArray(value)) return []

    return value
        .map((entry) => {
            if (!entry || typeof entry !== "object") return null
            const attachment = entry as Record<string, unknown>
            const kind = typeof attachment.kind === "string" ? attachment.kind : null
            const name = typeof attachment.name === "string" ? attachment.name.trim() : ""

            if (!kind || !["image", "gif", "file", "sticker"].includes(kind) || !name) {
                return null
            }

            return {
                kind: kind as ChatAttachment["kind"],
                name,
                url: typeof attachment.url === "string" ? attachment.url : null,
                contentType: typeof attachment.contentType === "string" ? attachment.contentType : null,
                size: typeof attachment.size === "number" && Number.isFinite(attachment.size) ? attachment.size : null,
                sticker: typeof attachment.sticker === "string" ? attachment.sticker : null,
            } satisfies ChatAttachment
        })
        .filter((attachment): attachment is ChatAttachment => Boolean(attachment))
        .slice(0, 8)
}

async function enrichMessages(
    roomId: number,
    rawMessages: {
        id: number
        roomId: number
        senderId: string
        senderName: string
        senderImage: string | null
        content: string
        attachments: unknown
        mentionType: string | null
        mentionId: string | null
        mentionLabel: string | null
        createdAt: Date
        replyToMessageId: number | null
    }[]
): Promise<ChatMessage[]> {
    const memberRows = await getMemberRows(roomId)
    const replyIds = Array.from(new Set(rawMessages.map((message) => message.replyToMessageId).filter((value): value is number => Number.isInteger(value))))

    const replyMap = new Map<number, { id: number; content: string; senderName: string }>()
    if (replyIds.length > 0) {
        const replies = await db
            .select({
                id: chatMessages.id,
                content: chatMessages.content,
                senderName: userTable.name,
            })
            .from(chatMessages)
            .innerJoin(userTable, eq(chatMessages.senderId, userTable.id))
            .where(inArray(chatMessages.id, replyIds))

        for (const reply of replies) {
            replyMap.set(reply.id, reply)
        }
    }

    return rawMessages.map((message) => ({
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderImage: message.senderImage,
        content: message.content,
        attachments: normalizeAttachments(message.attachments),
        mentionType: message.mentionType,
        mentionId: message.mentionId,
        mentionLabel: message.mentionLabel,
        createdAt: message.createdAt.toISOString(),
        replyTo: message.replyToMessageId ? replyMap.get(message.replyToMessageId) ?? null : null,
        readBy: memberRows
            .filter((member) => member.lastReadAt && member.lastReadAt >= message.createdAt)
            .map((member) => ({
                userId: member.userId,
                name: member.name,
            })),
    }))
}

async function getRoomSnapshotInternal(
    roomId: number,
    userId: string,
    options?: { limit?: number; before?: string }
): Promise<ChatRoomSnapshot> {
    const limit = Math.max(10, Math.min(options?.limit ?? 30, 100))
    await assertMembership(roomId, userId)
    await touchMembership(roomId, userId, true)

    const conditions = [eq(chatMessages.roomId, roomId)]
    if (options?.before) {
        const beforeDate = new Date(options.before)
        if (!Number.isNaN(beforeDate.getTime())) {
            conditions.push(lt(chatMessages.createdAt, beforeDate))
        }
    }

    const rows = await db
        .select({
            id: chatMessages.id,
            roomId: chatMessages.roomId,
            senderId: chatMessages.senderId,
            senderName: userTable.name,
            senderImage: userTable.image,
            content: chatMessages.content,
            attachments: chatMessages.attachments,
            mentionType: chatMessages.mentionType,
            mentionId: chatMessages.mentionId,
            mentionLabel: chatMessages.mentionLabel,
            createdAt: chatMessages.createdAt,
            replyToMessageId: chatMessages.replyToMessageId,
        })
        .from(chatMessages)
        .innerJoin(userTable, eq(chatMessages.senderId, userTable.id))
        .where(and(...conditions))
        .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
        .limit(limit + 1)

    const hasMore = rows.length > limit
    const pagedRows = hasMore ? rows.slice(0, limit) : rows
    const messages = await enrichMessages(roomId, [...pagedRows].reverse())
    const memberRows = await getMemberRows(roomId)
    const now = Date.now()

    return {
        messages,
        hasMore,
        typingMembers: memberRows
            .filter((member) => member.userId !== userId && member.typingAt && now - member.typingAt.getTime() <= 10_000)
            .map((member) => ({
                userId: member.userId,
                name: member.name,
            })),
        memberPresence: memberRows.map((member) => ({
            userId: member.userId,
            name: member.name,
            lastSeenAt: member.lastSeenAt ? member.lastSeenAt.toISOString() : null,
            isOnline: !!member.lastSeenAt && now - member.lastSeenAt.getTime() <= 120_000,
        })),
    }
}

export async function getChatUsers() {
    await ensureChatSchema()

    return db
        .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            image: userTable.image,
        })
        .from(userTable)
        .then((users) => users.filter((user) => user.id !== HELP_DESK_CONFIG.botId))
}

export async function getOrCreateDmRoom(otherUserId: string): Promise<{ roomId: number }> {
    await ensureChatSchema()

    const currentUserId = await getCurrentUserId()
    if (currentUserId === otherUserId) {
        throw new Error("Cannot create DM with yourself")
    }

    const existingRooms = await db
        .select({ roomId: chatRoomMembers.roomId })
        .from(chatRoomMembers)
        .where(eq(chatRoomMembers.userId, currentUserId))

    for (const { roomId } of existingRooms) {
        const room = await db.query.chatRooms.findFirst({
            where: and(eq(chatRooms.id, roomId), eq(chatRooms.type, "dm")),
        })
        if (!room) {
            continue
        }

        const members = await db
            .select({ userId: chatRoomMembers.userId })
            .from(chatRoomMembers)
            .where(eq(chatRoomMembers.roomId, roomId))

        if (members.length === 2 && members.some((member) => member.userId === otherUserId)) {
            return { roomId }
        }
    }

    const [newRoom] = await db
        .insert(chatRooms)
        .values({
            type: "dm",
            createdBy: currentUserId,
        })
        .returning({ id: chatRooms.id })

    await db.insert(chatRoomMembers).values([
        { roomId: newRoom.id, userId: currentUserId, lastSeenAt: new Date() },
        { roomId: newRoom.id, userId: otherUserId },
    ])

    revalidatePath("/dashboard")
    return { roomId: newRoom.id }
}

export async function createGroupRoom(name: string, memberIds: string[]): Promise<{ roomId: number }> {
    await ensureChatSchema()

    const currentUserId = await getCurrentUserId()
    const trimmedName = name.trim()
    const normalizedMemberIds = Array.from(
        new Set(
            memberIds
                .map((memberId) => memberId.trim())
                .filter((memberId) => memberId && memberId !== currentUserId && memberId !== HELP_DESK_CONFIG.botId)
        )
    )

    if (!trimmedName) {
        throw new Error("Nama group wajib diisi")
    }

    if (normalizedMemberIds.length < 2) {
        throw new Error("Pilih minimal 2 anggota untuk membuat group")
    }

    const validMembers = await db
        .select({ id: userTable.id })
        .from(userTable)
        .where(inArray(userTable.id, normalizedMemberIds))

    if (validMembers.length !== normalizedMemberIds.length) {
        throw new Error("Sebagian anggota group tidak ditemukan")
    }

    const allMembers = Array.from(new Set([currentUserId, ...normalizedMemberIds]))

    const [newRoom] = await db
        .insert(chatRooms)
        .values({
            name: trimmedName,
            type: "group",
            createdBy: currentUserId,
        })
        .returning({ id: chatRooms.id })

    await db.insert(chatRoomMembers).values(
        allMembers.map((userId) => ({
            roomId: newRoom.id,
            userId,
            lastSeenAt: userId === currentUserId ? new Date() : null,
        }))
    )

    revalidatePath("/dashboard")
    return { roomId: newRoom.id }
}

export async function updateGroupRoom(roomId: number, payload: { name?: string; memberIdsToAdd?: string[] }) {
    await ensureChatSchema()

    const currentUserId = await getCurrentUserId()
    const room = await db.query.chatRooms.findFirst({
        where: eq(chatRooms.id, roomId),
    })

    if (!room) {
        throw new Error("Room not found")
    }

    await assertMembership(roomId, currentUserId)

    if (room.type !== "group") {
        throw new Error("Only group rooms can be updated")
    }

    if (payload.name?.trim()) {
        await db
            .update(chatRooms)
            .set({
                name: payload.name.trim(),
                updatedAt: new Date(),
            })
            .where(eq(chatRooms.id, roomId))
    }

    const memberIdsToAdd = Array.from(new Set(payload.memberIdsToAdd?.filter(Boolean) ?? []))
    if (memberIdsToAdd.length > 0) {
        const existingMembers = await db
            .select({ userId: chatRoomMembers.userId })
            .from(chatRoomMembers)
            .where(eq(chatRoomMembers.roomId, roomId))

        const existingUserIds = new Set(existingMembers.map((member) => member.userId))
        const rowsToInsert = memberIdsToAdd
            .filter((userId) => !existingUserIds.has(userId))
            .map((userId) => ({
                roomId,
                userId,
            }))

        if (rowsToInsert.length > 0) {
            await db.insert(chatRoomMembers).values(rowsToInsert)
        }
    }

    revalidatePath("/dashboard")
    return { success: true }
}

export async function updateRoomPreferences(
    roomId: number,
    updates: Partial<Pick<ChatRoomWithMeta, "isMuted" | "isArchived" | "isPinned">>
) {
    const currentUserId = await getCurrentUserId()
    await assertMembership(roomId, currentUserId)

    await db
        .update(chatRoomMembers)
        .set({
            ...(typeof updates.isMuted === "boolean" ? { isMuted: updates.isMuted } : {}),
            ...(typeof updates.isArchived === "boolean" ? { isArchived: updates.isArchived } : {}),
            ...(typeof updates.isPinned === "boolean" ? { isPinned: updates.isPinned } : {}),
        })
        .where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, currentUserId)))

    revalidatePath("/dashboard")
    return { success: true }
}

export async function updateTypingStatus(roomId: number, isTyping: boolean) {
    const currentUserId = await getCurrentUserId()
    await assertMembership(roomId, currentUserId)

    await db
        .update(chatRoomMembers)
        .set({
            typingAt: isTyping ? new Date() : null,
            lastSeenAt: new Date(),
        })
        .where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, currentUserId)))

    return { success: true }
}

export async function sendMessage(
    roomId: number,
    content: string,
    mention?: MentionPayload,
    replyToMessageId?: number | null,
    mentionedUserIds?: string[],
    attachments?: ChatAttachment[]
) {
    const currentUser = await getCurrentUser()
    const currentUserId = currentUser.id
    await assertMembership(roomId, currentUserId)
    const room = await db.query.chatRooms.findFirst({ where: eq(chatRooms.id, roomId) })

    if (!room) {
        throw new Error("Room not found")
    }

    const cleanContent = content.trim()
    const normalizedAttachments = normalizeAttachments(attachments)
    if (!cleanContent && !mention && normalizedAttachments.length === 0) {
        throw new Error("Message cannot be empty")
    }

    if (replyToMessageId) {
        const replyTarget = await db.query.chatMessages.findFirst({
            where: and(eq(chatMessages.id, replyToMessageId), eq(chatMessages.roomId, roomId)),
        })

        if (!replyTarget) {
            throw new Error("Reply target not found")
        }
    }

    const normalizedMentionedUserIds = Array.from(
        new Set((mentionedUserIds ?? []).map((userId) => userId.trim()).filter((userId) => userId && userId !== currentUserId))
    )

    const roomMembers = await getMemberRows(roomId)
    const roomMemberById = new Map(roomMembers.map((member) => [member.userId, member]))
    const mentionedRecipients = normalizedMentionedUserIds
        .map((userId) => roomMemberById.get(userId))
        .filter((member): member is Awaited<ReturnType<typeof getMemberRows>>[number] => Boolean(member?.email))
    const pushRecipientIds = roomMembers
        .filter((member) => member.userId !== currentUserId && !member.isMuted)
        .map((member) => member.userId)

    await db.insert(chatMessages).values({
        roomId,
        senderId: currentUserId,
        content:
            cleanContent ||
            (normalizedAttachments.length > 0
                ? normalizedAttachments[0]?.kind === "sticker"
                    ? `[Stiker: ${normalizedAttachments[0]?.name}]`
                    : normalizedAttachments.length === 1
                        ? `[Lampiran: ${normalizedAttachments[0]?.name}]`
                        : `[${normalizedAttachments.length} lampiran]`
                : `[Referensi: ${mention?.label ?? "Dokumen"}]`),
        attachments: normalizedAttachments,
        mentionType: mention?.type ?? null,
        mentionId: mention?.id ?? null,
        mentionLabel: mention?.label ?? null,
        replyToMessageId: replyToMessageId ?? null,
    })

    await db
        .update(chatRooms)
        .set({ updatedAt: new Date() })
        .where(eq(chatRooms.id, roomId))

    const roomLabel =
        room.type === "dm"
            ? currentUser.name || "Chat"
            : room.name?.trim() || "Group Chat"
    const pushBody =
        cleanContent ||
        mention?.label ||
        normalizedAttachments[0]?.name ||
        "Ada pesan baru di chat workspace"

    await sendPushNotificationToUsers({
        userIds: pushRecipientIds,
        payload: {
            title: roomLabel,
            body: pushBody.length > 140 ? `${pushBody.slice(0, 137)}...` : pushBody,
            url: "/dashboard",
            tag: `chat-room-${roomId}`,
            notificationId: `chat-room-${roomId}-${Date.now()}`,
        },
    }).catch((error) => {
        console.error("Failed to send chat push notification", error)
    })

    if (room.type === "group" && mentionedRecipients.length > 0) {
        const messagePreview =
            cleanContent ||
            mention?.label ||
            normalizedAttachments[0]?.name ||
            "Anda mendapat mention baru di chat"
        const safePreview = messagePreview.length > 140 ? `${messagePreview.slice(0, 137)}...` : messagePreview

        await sendLoggedNotificationMessage({
            to: mentionedRecipients.map((member) => member.email),
            subject: `${currentUser.name} mention Anda di ${roomLabel}`,
            text: `${currentUser.name} menandai Anda di group ${roomLabel}: ${safePreview}`,
            html: `<p><strong>${currentUser.name}</strong> menandai Anda di group <strong>${roomLabel}</strong>.</p><p>${safePreview}</p>`,
            actionUrl: "/dashboard",
            channels: ["push"],
            logMeta: {
                templateCode: "chat-mention",
                templateName: "Chat Mention Notification",
            },
        }).catch((error) => {
            console.error("Failed to send chat mention notification", error)
        })
    }

    if (room.type === "ai-helpdesk" && cleanContent) {
        let aiReply = "Maaf, Chitra Jenius sedang belum bisa merespons. Silakan coba lagi sebentar lagi."

        try {
            aiReply = await generateHelpDeskReply(cleanContent)
        } catch (error) {
            console.error("generateHelpDeskReply failed", error)
        }

        await db.insert(chatMessages).values({
            roomId,
            senderId: HELP_DESK_CONFIG.botId,
            content: aiReply,
            isSystemMessage: true,
        })
    }

    await db
        .update(chatRoomMembers)
        .set({
            typingAt: null,
            lastReadAt: new Date(),
            lastSeenAt: new Date(),
            lastUnreadReminderAt: null,
            unreadReminderCount: 0,
        })
        .where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, currentUserId)))

    revalidatePath("/dashboard")
    return { success: true }
}

export async function deleteChatRoom(roomId: number) {
    const currentUserId = await getCurrentUserId()
    await assertMembership(roomId, currentUserId)

    const room = await db.query.chatRooms.findFirst({ where: eq(chatRooms.id, roomId) })
    if (room?.type === "ai-helpdesk") {
        throw new Error("Chat Chitra Jenius tidak dapat dihapus")
    }

    await db
        .delete(chatRoomMembers)
        .where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, currentUserId)))

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

export async function getRoomMessages(
    roomId: number,
    options?: { limit?: number; before?: string }
): Promise<ChatRoomSnapshot> {
    const currentUserId = await getCurrentUserId()
    return getRoomSnapshotInternal(roomId, currentUserId, options)
}

export async function searchRoomMessages(roomId: number, query: string, limit = 20) {
    const currentUserId = await getCurrentUserId()
    await assertMembership(roomId, currentUserId)

    const normalizedQuery = query.trim()
    if (!normalizedQuery) {
        return []
    }

    const rows = await db
        .select({
            id: chatMessages.id,
            content: chatMessages.content,
            createdAt: chatMessages.createdAt,
            senderName: userTable.name,
        })
        .from(chatMessages)
        .innerJoin(userTable, eq(chatMessages.senderId, userTable.id))
        .where(
            and(
                eq(chatMessages.roomId, roomId),
                or(
                    ilike(chatMessages.content, `%${normalizedQuery}%`),
                    ilike(chatMessages.mentionLabel, `%${normalizedQuery}%`)
                )
            )
        )
        .orderBy(desc(chatMessages.createdAt))
        .limit(Math.max(1, Math.min(limit, 50)))

    return rows.map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
        senderName: row.senderName,
    }))
}

export async function getUserRooms(options?: { includeArchived?: boolean }): Promise<ChatRoomWithMeta[]> {
    await ensureChatSchema()
    const currentUserId = await getCurrentUserId()

    const myMemberships = await db
        .select({
            roomId: chatRoomMembers.roomId,
            lastReadAt: chatRoomMembers.lastReadAt,
            isMuted: chatRoomMembers.isMuted,
            isArchived: chatRoomMembers.isArchived,
            isPinned: chatRoomMembers.isPinned,
        })
        .from(chatRoomMembers)
        .where(eq(chatRoomMembers.userId, currentUserId))

    const rooms: ChatRoomWithMeta[] = []

    for (const membership of myMemberships) {
        if (!options?.includeArchived && membership.isArchived) {
            continue
        }

        const room = await db.query.chatRooms.findFirst({
            where: eq(chatRooms.id, membership.roomId),
        })
        if (!room) {
            continue
        }

        const memberRows = await getMemberRows(membership.roomId)

        const [lastMsg] = await db
            .select({
                content: chatMessages.content,
                senderName: userTable.name,
                createdAt: chatMessages.createdAt,
            })
            .from(chatMessages)
            .innerJoin(userTable, eq(chatMessages.senderId, userTable.id))
            .where(eq(chatMessages.roomId, membership.roomId))
            .orderBy(desc(chatMessages.createdAt))
            .limit(1)

        const unreadCondition = membership.lastReadAt
            ? and(
                eq(chatMessages.roomId, membership.roomId),
                ne(chatMessages.senderId, currentUserId),
                gt(chatMessages.createdAt, membership.lastReadAt)
            )
            : and(eq(chatMessages.roomId, membership.roomId), ne(chatMessages.senderId, currentUserId))

        const [unreadRow] = await db
            .select({ count: sql<number>`count(*)` })
            .from(chatMessages)
            .where(unreadCondition)

        let displayName = room.name
        if (room.type === "dm") {
            displayName = memberRows.find((member) => member.userId !== currentUserId)?.name ?? "Unknown"
        }

        rooms.push({
            id: room.id,
            name: displayName,
            type: room.type,
            members: memberRows.map((member) => ({
                userId: member.userId,
                name: member.name,
                email: member.email,
                image: member.image ?? null,
                lastReadAt: member.lastReadAt ? member.lastReadAt.toISOString() : null,
                lastSeenAt: member.lastSeenAt ? member.lastSeenAt.toISOString() : null,
                isTyping: !!member.typingAt && Date.now() - member.typingAt.getTime() <= 10_000,
            })),
            lastMessage: lastMsg
                ? {
                    content: lastMsg.content,
                    senderName: lastMsg.senderName,
                    createdAt: lastMsg.createdAt.toISOString(),
                }
                : null,
            unreadCount: Number(unreadRow?.count ?? 0),
            isMuted: membership.isMuted,
            isArchived: membership.isArchived,
            isPinned: membership.isPinned,
            updatedAt: room.updatedAt.toISOString(),
        })
    }

    return rooms.sort((left, right) => {
        if (left.isPinned !== right.isPinned) {
            return left.isPinned ? -1 : 1
        }

        const leftTime = left.lastMessage?.createdAt ?? left.updatedAt
        const rightTime = right.lastMessage?.createdAt ?? right.updatedAt
        return rightTime.localeCompare(leftTime)
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
        if (!membership.recipientEmail || (membership.unreadReminderCount ?? 0) >= 5) {
            continue
        }

        const unreadCondition = membership.lastReadAt
            ? and(
                eq(chatMessages.roomId, membership.roomId),
                ne(chatMessages.senderId, membership.userId),
                gt(chatMessages.createdAt, membership.lastReadAt)
            )
            : and(eq(chatMessages.roomId, membership.roomId), ne(chatMessages.senderId, membership.userId))

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
        ? await db
            .select({
                id: quotations.id,
                number: quotations.quotationNumber,
                subject: quotations.subject,
            })
            .from(quotations)
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
        ? await db
            .select({
                id: salesOrders.id,
                number: salesOrders.invoiceNumber,
                customerPo: salesOrders.customerPo,
                subject: salesOrders.quotationSubject,
            })
            .from(salesOrders)
            .where(
                poFilter
                    ? sql`lower(coalesce(${salesOrders.customerPo}, '')) like ${poFilter}`
                    : sql`coalesce(${salesOrders.customerPo}, '') <> ''`
            )
            .orderBy(desc(salesOrders.createdAt))
            .limit(10)
        : null

    const [quotationResults, soResults, deliveryResults] = await Promise.all([
        db
            .select({
                id: quotations.id,
                number: quotations.quotationNumber,
                subject: quotations.subject,
            })
            .from(quotations)
            .where(sql`lower(${quotations.quotationNumber}) like ${q} or lower(${quotations.subject}) like ${q}`)
            .limit(5),
        db
            .select({
                id: salesOrders.id,
                number: salesOrders.invoiceNumber,
                customerPo: salesOrders.customerPo,
                subject: salesOrders.quotationSubject,
            })
            .from(salesOrders)
            .where(sql`(
                lower(coalesce(${salesOrders.invoiceNumber}, '')) like ${q}
                or lower(coalesce(${salesOrders.customerPo}, '')) like ${q}
                or lower(coalesce(${salesOrders.quotationSubject}, '')) like ${q}
            )`)
            .limit(5),
        db
            .select({
                id: deliveries.id,
                number: deliveries.deliveryNumber,
            })
            .from(deliveries)
            .where(sql`lower(${deliveries.deliveryNumber}) like ${q}`)
            .limit(5),
    ])

    const quotationMap = new Map<string, { type: "quotation"; id: string; label: string; sublabel: string; url: string }>()
    for (const row of salesQuotationResults ?? []) {
        quotationMap.set(String(row.id), {
            type: "quotation",
            id: String(row.id),
            label: row.number || `Quotation #${row.id}`,
            sublabel: row.subject || "",
            url: `/dashboard/quotations/${row.id}`,
        })
    }
    for (const row of quotationResults) {
        quotationMap.set(String(row.id), {
            type: "quotation",
            id: String(row.id),
            label: row.number || `Quotation #${row.id}`,
            sublabel: row.subject || "",
            url: `/dashboard/quotations/${row.id}`,
        })
    }

    const salesOrderMap = new Map<string, { type: "sales-order"; id: string; label: string; sublabel: string; url: string }>()
    for (const row of poShortcutResults ?? []) {
        salesOrderMap.set(String(row.id), {
            type: "sales-order",
            id: String(row.id),
            label: row.customerPo || row.number || `SO #${row.id}`,
            sublabel: row.number || row.subject || "",
            url: `/dashboard/sales-orders?id=${row.id}`,
        })
    }
    for (const row of soResults) {
        salesOrderMap.set(String(row.id), {
            type: "sales-order",
            id: String(row.id),
            label: row.number || row.customerPo || `SO #${row.id}`,
            sublabel: row.subject || row.customerPo || "",
            url: `/dashboard/sales-orders?id=${row.id}`,
        })
    }

    return [
        ...Array.from(quotationMap.values()),
        ...Array.from(salesOrderMap.values()),
        ...deliveryResults.map((row) => ({
            type: "delivery" as const,
            id: String(row.id),
            label: row.number || `DLV #${row.id}`,
            sublabel: "",
            url: `/dashboard/deliveries?id=${row.id}`,
        })),
    ]
}
