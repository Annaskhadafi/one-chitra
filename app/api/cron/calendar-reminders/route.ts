import { NextResponse } from "next/server"
import { getPendingEmailReminders, markReminderSent, getCustomersWithTomorrowBirthday } from "@/app/actions/calendar-events"
import { getSmtpSettings } from "@/app/actions/email"
import { sendEmail } from "@/lib/email"
import type { SmtpConfig } from "@/lib/email"
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

    const smtp: SmtpConfig = {
        host: smtpRow.host,
        port: Number(smtpRow.port),
        secure: smtpRow.secure,
        username: smtpRow.username,
        password: smtpRow.password,
        fromEmail: smtpRow.fromEmail,
        fromName: smtpRow.fromName,
    }

    const results: string[] = []

    // ── 1. Send calendar event reminders ─────────────────────────────────────
    const pendingReminders = await getPendingEmailReminders()

    for (const ev of pendingReminders) {
        if (!ev.emailReminderTo) continue
        try {
            await sendEmail(
                {
                    to: ev.emailReminderTo,
                    subject: `🔔 Reminder: ${ev.title}`,
                    html: buildReminderHtml(ev.title, ev.startDate, ev.description),
                },
                smtp
            )
            await markReminderSent(ev.id)
            results.push(`✅ Reminder sent for event #${ev.id}: ${ev.title}`)
        } catch (err) {
            results.push(`❌ Failed for event #${ev.id}: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    // ── 2. Send birthday greetings for tomorrow's customers ───────────────────
    const birthdayCustomers = await getCustomersWithTomorrowBirthday()

    for (const c of birthdayCustomers) {
        if (!c.email) continue
        try {
            await sendEmail(
                {
                    to: c.email,
                    subject: `🎂 Selamat Ulang Tahun, ${c.name}!`,
                    html: buildBirthdayHtml(c.name),
                },
                smtp
            )
            results.push(`✅ Birthday email sent to ${c.name} (${c.email})`)
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

// ─── HTML templates ──────────────────────────────────────────────────────────

function buildReminderHtml(title: string, startDate: Date, description?: string | null): string {
    const dateStr = format(startDate, "EEEE, dd MMMM yyyy HH:mm", { locale: localeId })
    return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
      <h2 style="color:#111827;margin-bottom:4px;">🔔 Pengingat Event</h2>
      <h3 style="color:#1d4ed8;margin-top:0;">${title}</h3>
      <p style="color:#6b7280;">📅 ${dateStr}</p>
      ${description ? `<p style="color:#374151;">${description}</p>` : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;">Email ini dikirim otomatis oleh sistem One Chitra.</p>
    </div>
  `
}

function buildBirthdayHtml(name: string): string {
    return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fdf2f8;border-radius:8px;text-align:center;">
      <h1 style="font-size:48px;margin:0;">🎂</h1>
      <h2 style="color:#be185d;">Selamat Ulang Tahun!</h2>
      <p style="color:#374151;font-size:18px;">Halo <strong>${name}</strong>,</p>
      <p style="color:#6b7280;">
        Semoga ulang tahun Anda penuh kebahagiaan, kesehatan, dan kesuksesan.
        Terima kasih telah menjadi pelanggan setia kami! 🎉
      </p>
      <p style="color:#be185d;font-weight:600;margin-top:24px;">Salam hangat,<br/>Tim One Chitra</p>
      <hr style="border:none;border-top:1px solid #fbcfe8;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;">Email ini dikirim otomatis oleh sistem One Chitra.</p>
    </div>
  `
}
