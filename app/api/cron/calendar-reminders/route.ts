import { NextResponse } from "next/server"
import { getPendingEmailReminders, markReminderSent, getCustomersWithTomorrowBirthday } from "@/app/actions/calendar-events"
import { getSmtpSettings } from "@/app/actions/email"
import { sendSystemTemplatedEmailByCode } from "@/lib/email"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"

/**
 * GET /api/cron/calendar-reminders
 *
 * Run this endpoint on a schedule (e.g., every hour via cron job or Vercel Cron).
 * Secures the route with a CRON_SECRET env var.
 *
 * Cron schedule (example, hourly):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/calendar-reminders
 */
export async function GET(request: Request) {
    // ── Security check ────────────────────────────────────────────────────────
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

    const results: string[] = []
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "")
    const calendarUrl = baseUrl ? `${baseUrl}/dashboard/calendar` : "/dashboard/calendar"

    // ── 1. Send calendar event reminders ─────────────────────────────────────
    const pendingReminders = await getPendingEmailReminders()

    for (const ev of pendingReminders) {
        if (!ev.emailReminderTo) continue
        try {
            const sendResult = await sendSystemTemplatedEmailByCode({
                code: SYSTEM_EMAIL_TEMPLATE_CODES.calendarEventReminder,
                to: ev.emailReminderTo,
                data: {
                    eventTitle: ev.title,
                    eventDate: format(ev.startDate, "EEEE, dd MMMM yyyy HH:mm", { locale: localeId }),
                    eventDescription: ev.description || "-",
                    actionUrl: calendarUrl,
                    appName: "One Chitra",
                },
            })

            if (sendResult.success) {
                await markReminderSent(ev.id)
                results.push(`✅ Reminder sent for event #${ev.id}: ${ev.title}`)
            } else {
                results.push(`❌ Failed for event #${ev.id}: ${sendResult.error || "Template inactive or SMTP issue"}`)
            }
        } catch (err) {
            results.push(`❌ Failed for event #${ev.id}: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    // ── 2. Send birthday greetings for tomorrow's customers ───────────────────
    const birthdayCustomers = await getCustomersWithTomorrowBirthday()

    for (const c of birthdayCustomers) {
        if (!c.email) continue
        try {
            const sendResult = await sendSystemTemplatedEmailByCode({
                code: SYSTEM_EMAIL_TEMPLATE_CODES.customerBirthdayGreeting,
                to: c.email,
                data: {
                    customerName: c.name,
                    appName: "One Chitra",
                },
            })

            if (sendResult.success) {
                results.push(`✅ Birthday email sent to ${c.name} (${c.email})`)
            } else {
                results.push(`❌ Birthday email failed for ${c.name}: ${sendResult.error || "Template inactive or SMTP issue"}`)
            }
        } catch (err) {
            results.push(`❌ Birthday email failed for ${c.name}: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    return NextResponse.json({
        processed: results.length,
        results,
        timestamp: new Date().toISOString(),
    })
}

