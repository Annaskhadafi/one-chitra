import { NextResponse } from "next/server"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"

import { getSmtpSettings } from "@/app/actions/email"
import { getUnreadChatReminders, markUnreadChatReminderSent } from "@/app/actions/chat"
import { ensureChatSchema } from "@/lib/chat-schema"
import { sendSystemTemplatedEmailByCode } from "@/lib/email"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const authHeader = request.headers.get("authorization")
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    const smtpRow = await getSmtpSettings()
    if (!smtpRow || !smtpRow.isActive) {
        return NextResponse.json({ message: "SMTP not configured or inactive. Skipping." })
    }

    await ensureChatSchema()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "")
    const actionUrl = baseUrl ? `${baseUrl}/dashboard` : "/dashboard"
    const reminders = await getUnreadChatReminders(60)
    const results: string[] = []

    for (const reminder of reminders) {
        try {
            const sendResult = await sendSystemTemplatedEmailByCode({
                code: SYSTEM_EMAIL_TEMPLATE_CODES.chatUnreadReminder,
                to: reminder.recipientEmail,
                data: {
                    recipientName: reminder.recipientName,
                    roomName: reminder.roomName,
                    unreadCount: String(reminder.unreadCount),
                    latestSenderName: reminder.latestSenderName,
                    latestUnreadAt: format(new Date(reminder.latestUnreadAt), "EEEE, dd MMMM yyyy HH:mm", { locale: localeId }),
                    latestMessagePreview: reminder.latestMessagePreview || "-",
                    actionUrl,
                    appName: "One Chitra",
                },
            })

            if (sendResult.success) {
                await markUnreadChatReminderSent(reminder.membershipId)
                results.push(`OK room=${reminder.roomId} user=${reminder.recipientEmail}`)
            } else {
                results.push(`FAILED room=${reminder.roomId} user=${reminder.recipientEmail} reason=${sendResult.error ?? "unknown"}`)
            }
        } catch (error) {
            results.push(`FAILED room=${reminder.roomId} user=${reminder.recipientEmail} reason=${error instanceof Error ? error.message : String(error)}`)
        }
    }

    return NextResponse.json({
        processed: reminders.length,
        results,
        timestamp: new Date().toISOString(),
    })
}
