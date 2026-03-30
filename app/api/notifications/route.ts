import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"

import { extractActionUrlFromContent } from "@/lib/push-notifications"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

async function loadNotificationDeps() {
    const [{ auth }, { db }, { emailLogs, userNotificationReads }] = await Promise.all([
        import("@/lib/auth"),
        import("@/db"),
        import("@/db/schema"),
    ])

    return { auth, db, emailLogs, userNotificationReads }
}

export async function GET(request: NextRequest) {
    try {
        const { auth, db, emailLogs, userNotificationReads } = await loadNotificationDeps()
        const session = await auth.api.getSession({ headers: await headers() })
        if (!session?.user?.id || !session.user.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const parsedLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT)
        const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT

        const userEmail = session.user.email.trim().toLowerCase()
        const recipientMatch = or(
            ilike(emailLogs.toEmail, `%${userEmail}%`),
            ilike(emailLogs.ccEmail, `%${userEmail}%`),
        )

        const items = await db
            .select({
                id: emailLogs.id,
                templateCode: emailLogs.templateCode,
                templateName: emailLogs.templateName,
                subject: emailLogs.subject,
                textContent: emailLogs.textContent,
                htmlContent: emailLogs.htmlContent,
                status: emailLogs.status,
                createdAt: emailLogs.createdAt,
                sentAt: emailLogs.sentAt,
                readAt: userNotificationReads.readAt,
            })
            .from(emailLogs)
            .leftJoin(
                userNotificationReads,
                and(
                    eq(userNotificationReads.emailLogId, emailLogs.id),
                    eq(userNotificationReads.userId, session.user.id),
                ),
            )
            .where(
                and(
                    recipientMatch,
                    eq(emailLogs.status, "sent"),
                    eq(emailLogs.deliveryChannel, "push"),
                ),
            )
            .orderBy(desc(emailLogs.createdAt))
            .limit(limit)

        const unreadCountResult = await db
            .select({
                count: sql<number>`count(*)::int`,
            })
            .from(emailLogs)
            .leftJoin(
                userNotificationReads,
                and(
                    eq(userNotificationReads.emailLogId, emailLogs.id),
                    eq(userNotificationReads.userId, session.user.id),
                ),
            )
            .where(
                and(
                    recipientMatch,
                    eq(emailLogs.status, "sent"),
                    eq(emailLogs.deliveryChannel, "push"),
                    isNull(userNotificationReads.id),
                ),
            )

        const notifications = items.map((item) => ({
            id: item.id,
            title: item.subject,
            templateCode: item.templateCode,
            templateName: item.templateName,
            createdAt: item.createdAt.toISOString(),
            sentAt: item.sentAt?.toISOString() ?? null,
            isRead: Boolean(item.readAt),
            actionUrl: extractActionUrlFromContent(item.htmlContent, item.textContent),
        }))

        return NextResponse.json({
            notifications,
            unreadCount: unreadCountResult[0]?.count ?? 0,
        })
    } catch (error) {
        console.error("Notifications GET failed", error)
        return NextResponse.json({
            notifications: [],
            unreadCount: 0,
            degraded: true,
        }, { status: 200 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { auth, db, emailLogs, userNotificationReads } = await loadNotificationDeps()
        const session = await auth.api.getSession({ headers: await headers() })
        if (!session?.user?.id || !session.user.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json().catch(() => null) as { notificationId?: string; markAll?: boolean } | null
        if (!body) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
        }

        const userEmail = session.user.email.trim().toLowerCase()
        const recipientMatch = or(
            ilike(emailLogs.toEmail, `%${userEmail}%`),
            ilike(emailLogs.ccEmail, `%${userEmail}%`),
        )

        if (body.markAll) {
            const unreadRows = await db
                .select({ id: emailLogs.id })
                .from(emailLogs)
                .leftJoin(
                    userNotificationReads,
                    and(
                        eq(userNotificationReads.emailLogId, emailLogs.id),
                        eq(userNotificationReads.userId, session.user.id),
                    ),
                )
                .where(
                    and(
                        recipientMatch,
                        eq(emailLogs.status, "sent"),
                        eq(emailLogs.deliveryChannel, "push"),
                        isNull(userNotificationReads.id),
                    ),
                )
                .limit(200)

            if (unreadRows.length > 0) {
                await db
                    .insert(userNotificationReads)
                    .values(unreadRows.map((row) => ({
                        userId: session.user.id,
                        emailLogId: row.id,
                        readAt: new Date(),
                    })))
                    .onConflictDoNothing()
            }

            return NextResponse.json({ success: true, marked: unreadRows.length })
        }

        if (!body.notificationId) {
            return NextResponse.json({ error: "notificationId is required" }, { status: 400 })
        }

        const log = await db
            .select({ id: emailLogs.id })
            .from(emailLogs)
            .where(
                and(
                    eq(emailLogs.id, body.notificationId),
                    recipientMatch,
                    eq(emailLogs.deliveryChannel, "push"),
                ),
            )
            .limit(1)

        if (!log.length) {
            return NextResponse.json({ error: "Notification not found" }, { status: 404 })
        }

        await db
            .insert(userNotificationReads)
            .values({
                userId: session.user.id,
                emailLogId: body.notificationId,
                readAt: new Date(),
            })
            .onConflictDoNothing()

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Notifications POST failed", error)
        return NextResponse.json({ error: "Notification service unavailable" }, { status: 200 })
    }
}
