import { NextRequest, NextResponse } from "next/server"
import { and, eq, gt } from "drizzle-orm"
import { headers } from "next/headers"

import { db } from "@/db"
import { auth } from "@/lib/auth"
import { ensureChatSchema } from "@/lib/chat-schema"
import { chatMessages, chatRoomMembers, user as userTable } from "@/db/schema"

export async function GET(request: NextRequest) {
    await ensureChatSchema()

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const roomId = Number.parseInt(searchParams.get("roomId") ?? "", 10)
    const afterParam = searchParams.get("after")

    if (!roomId || Number.isNaN(roomId)) {
        return NextResponse.json({ error: "Invalid roomId" }, { status: 400 })
    }

    const membership = await db.query.chatRoomMembers.findFirst({
        where: and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, session.user.id)),
    })

    if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const conditions = [eq(chatMessages.roomId, roomId)]
    if (afterParam) {
        const afterDate = new Date(afterParam)
        if (!Number.isNaN(afterDate.getTime())) {
            conditions.push(gt(chatMessages.createdAt, afterDate))
        }
    }

    const now = new Date()
    await db
        .update(chatRoomMembers)
        .set({
            lastSeenAt: now,
            lastReadAt: now,
            typingAt: null,
            lastUnreadReminderAt: null,
            unreadReminderCount: 0,
        })
        .where(and(eq(chatRoomMembers.roomId, roomId), eq(chatRoomMembers.userId, session.user.id)))

    const rows = await db
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
        .where(and(...conditions))
        .orderBy(chatMessages.createdAt, chatMessages.id)

    const roomMembers = await db
        .select({
            userId: chatRoomMembers.userId,
            name: userTable.name,
            lastSeenAt: chatRoomMembers.lastSeenAt,
            typingAt: chatRoomMembers.typingAt,
        })
        .from(chatRoomMembers)
        .innerJoin(userTable, eq(chatRoomMembers.userId, userTable.id))
        .where(eq(chatRoomMembers.roomId, roomId))

    return NextResponse.json({
        messages: rows.map((row) => ({
            ...row,
            createdAt: row.createdAt.toISOString(),
        })),
        typingMembers: roomMembers
            .filter((member) => member.userId !== session.user.id && member.typingAt && now.getTime() - member.typingAt.getTime() <= 10_000)
            .map((member) => ({
                userId: member.userId,
                name: member.name,
            })),
        memberPresence: roomMembers.map((member) => ({
            userId: member.userId,
            name: member.name,
            lastSeenAt: member.lastSeenAt ? member.lastSeenAt.toISOString() : null,
            isOnline: !!member.lastSeenAt && now.getTime() - member.lastSeenAt.getTime() <= 120_000,
        })),
    })
}
