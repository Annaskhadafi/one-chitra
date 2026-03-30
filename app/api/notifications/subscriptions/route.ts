import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import {
    getPushPublicKey,
    isPushConfigured,
    removePushSubscription,
    upsertPushSubscription,
} from "@/lib/push-notifications"

type PushSubscriptionBody = {
    endpoint?: string
    keys?: {
        p256dh?: string
        auth?: string
    }
}

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({
        configured: isPushConfigured(),
        publicKey: getPushPublicKey(),
    })
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as PushSubscriptionBody | null
    const endpoint = body?.endpoint?.trim()
    const p256dh = body?.keys?.p256dh?.trim()
    const authKey = body?.keys?.auth?.trim()

    if (!endpoint || !p256dh || !authKey) {
        return NextResponse.json({ error: "Push subscription is incomplete" }, { status: 400 })
    }

    await upsertPushSubscription({
        userId: session.user.id,
        endpoint,
        p256dh,
        auth: authKey,
        userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as Pick<PushSubscriptionBody, "endpoint"> | null
    const endpoint = body?.endpoint?.trim()

    if (!endpoint) {
        return NextResponse.json({ error: "endpoint is required" }, { status: 400 })
    }

    await removePushSubscription(endpoint, session.user.id)

    return NextResponse.json({ success: true })
}
