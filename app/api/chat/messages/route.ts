import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { chatMessages } from "@/db/schema"
import { user as userTable } from "@/db/schema"
import { eq, and, gt } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const roomId = parseInt(searchParams.get("roomId") ?? "")
    const afterParam = searchParams.get("after")

    if (!roomId || isNaN(roomId)) {
        return NextResponse.json({ error: "Invalid roomId" }, { status: 400 })
    }

    const conditions = [eq(chatMessages.roomId, roomId)]
    if (afterParam) {
        const afterDate = new Date(afterParam)
        if (!isNaN(afterDate.getTime())) {
            conditions.push(gt(chatMessages.createdAt, afterDate))
        }
    }

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
        .where(and(...conditions))
        .orderBy(chatMessages.createdAt)

    return NextResponse.json({
        messages: msgs.map((m) => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
        }))
    })
}
