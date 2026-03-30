import "server-only"

import webpush from "web-push"
import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/db"
import { pushSubscriptions, user } from "@/db/schema"

type PushPayload = {
    title: string
    body: string
    url: string
    tag?: string
    notificationId?: string
}

let vapidConfigured = false

function getVapidConfig() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
    const subject = process.env.VAPID_SUBJECT?.trim() ?? "mailto:admin@onechitra.local"

    if (!publicKey || !privateKey) {
        return null
    }

    return { publicKey, privateKey, subject }
}

export function getPushPublicKey() {
    return getVapidConfig()?.publicKey ?? null
}

export function isPushConfigured() {
    return Boolean(getVapidConfig())
}

function configureWebPush() {
    if (vapidConfigured) {
        return true
    }

    const config = getVapidConfig()
    if (!config) {
        return false
    }

    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
    vapidConfigured = true
    return true
}

export function extractActionUrlFromContent(htmlContent?: string | null, textContent?: string | null) {
    const combined = `${htmlContent ?? ""}\n${textContent ?? ""}`
    const match = combined.match(/https?:\/\/[^\s"'<>]+/i)
    return match?.[0] ?? "/dashboard"
}

export function extractPushBody(textContent?: string | null, htmlContent?: string | null) {
    const source = textContent ?? htmlContent ?? ""
    const plainText = source
        .replace(/<[^>]+>/g, " ")
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/\s+/g, " ")
        .trim()

    if (!plainText) {
        return "Ada notifikasi baru dari One Chitra."
    }

    return plainText.length > 160 ? `${plainText.slice(0, 157)}...` : plainText
}

export async function upsertPushSubscription(args: {
    userId: string
    endpoint: string
    p256dh: string
    auth: string
    userAgent?: string | null
}) {
    await db
        .insert(pushSubscriptions)
        .values({
            userId: args.userId,
            endpoint: args.endpoint,
            p256dh: args.p256dh,
            auth: args.auth,
            userAgent: args.userAgent ?? null,
            updatedAt: new Date(),
            lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
            target: pushSubscriptions.endpoint,
            set: {
                userId: args.userId,
                p256dh: args.p256dh,
                auth: args.auth,
                userAgent: args.userAgent ?? null,
                updatedAt: new Date(),
                lastSeenAt: new Date(),
            },
        })
}

export async function removePushSubscription(endpoint: string, userId?: string) {
    await db.delete(pushSubscriptions).where(
        userId
            ? and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId))
            : eq(pushSubscriptions.endpoint, endpoint),
    )
}

export async function findRecipientUserIdsByEmails(emails: string[]) {
    const normalizedEmails = Array.from(new Set(emails.map((entry) => entry.trim().toLowerCase()).filter(Boolean)))
    if (normalizedEmails.length === 0) {
        return [] as string[]
    }

    const rows = await db
        .select({ id: user.id, email: user.email })
        .from(user)

    return rows
        .filter((entry) => normalizedEmails.includes(entry.email?.trim().toLowerCase() ?? ""))
        .map((entry) => entry.id)
}

export async function sendPushNotificationToUsers(args: {
    userIds: string[]
    payload: PushPayload
}) {
    if (!configureWebPush()) {
        return { sent: 0, skipped: true as const, reason: "VAPID keys are not configured" }
    }

    const normalizedUserIds = Array.from(new Set(args.userIds.map((entry) => entry.trim()).filter(Boolean)))
    if (normalizedUserIds.length === 0) {
        return { sent: 0, skipped: true as const, reason: "No recipient user IDs found" }
    }

    const subscriptions = await db
        .select({
            endpoint: pushSubscriptions.endpoint,
            p256dh: pushSubscriptions.p256dh,
            auth: pushSubscriptions.auth,
        })
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, normalizedUserIds))

    if (subscriptions.length === 0) {
        return { sent: 0, skipped: true as const, reason: "No active push subscriptions" }
    }

    let sent = 0
    const payload = JSON.stringify(args.payload)

    for (const subscription of subscriptions) {
        try {
            await webpush.sendNotification({
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth,
                },
            }, payload)
            sent += 1
        } catch (error) {
            const statusCode = typeof error === "object" && error !== null && "statusCode" in error
                ? Number((error as { statusCode?: unknown }).statusCode)
                : null

            if (statusCode === 404 || statusCode === 410) {
                await removePushSubscription(subscription.endpoint)
            }

            console.error("[PUSH] Failed to send notification:", error)
        }
    }

    return { sent, skipped: false as const }
}
