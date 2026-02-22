"use server"

import { db } from "@/db"
import { smtpSettings, emailTemplates, emailLogs } from "@/db/schema/email"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { sendEmail, createTransporter } from "@/lib/email"
import type { SmtpConfig } from "@/lib/email"

// ─── SMTP ─────────────────────────────────────────────────────────────────────

export async function getSmtpSettings() {
    const rows = await db.select().from(smtpSettings).limit(1)
    return rows[0] ?? null
}

export async function saveSmtpSettings(data: {
    host: string
    port: string
    secure: boolean
    username: string
    password: string
    fromEmail: string
    fromName: string
    isActive: boolean
}) {
    try {
        const existing = await db.select().from(smtpSettings).limit(1)

        if (existing.length > 0) {
            await db
                .update(smtpSettings)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(smtpSettings.id, existing[0].id))
        } else {
            await db.insert(smtpSettings).values(data)
        }

        revalidatePath("/dashboard/settings/email")
        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to save SMTP settings",
        }
    }
}

export async function testSmtpConnection(data: {
    host: string
    port: string
    secure: boolean
    username: string
    password: string
    fromEmail: string
    fromName: string
    testTo: string
}) {
    try {
        const config: SmtpConfig = {
            host: data.host,
            port: parseInt(data.port),
            secure: data.secure,
            username: data.username,
            password: data.password,
            fromEmail: data.fromEmail,
            fromName: data.fromName,
        }

        const transporter = createTransporter(config)
        await transporter.verify()

        const result = await sendEmail(
            {
                to: data.testTo,
                subject: "✅ Test Email – One Chitra SMTP Configuration",
                html: `
                    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
                        <h2 style="color:#111827;margin-bottom:8px;">SMTP Test Successful 🎉</h2>
                        <p style="color:#6b7280;">Your SMTP configuration is working correctly.</p>
                        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
                        <p style="font-size:12px;color:#9ca3af;">Sent from One Chitra · ${new Date().toLocaleString()}</p>
                    </div>
                `,
            },
            config
        )

        return result
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Connection test failed",
        }
    }
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

export async function getEmailTemplates() {
    return await db
        .select()
        .from(emailTemplates)
        .orderBy(emailTemplates.createdAt)
}

export async function getEmailTemplate(id: string) {
    const rows = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.id, id))
        .limit(1)
    return rows[0] ?? null
}

export async function createEmailTemplate(data: {
    name: string
    type: "magic_link" | "notification" | "welcome" | "password_reset" | "order_confirmation" | "delivery_update" | "custom"
    subject: string
    htmlContent: string
    textContent?: string
    variables?: string[]
    recipientRoles?: string[]
    isActive: boolean
}) {
    try {
        const [created] = await db
            .insert(emailTemplates)
            .values(data)
            .returning()

        revalidatePath("/dashboard/settings/email")
        return { success: true, template: created }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create template",
        }
    }
}

export async function updateEmailTemplate(
    id: string,
    data: {
        name?: string
        type?: "magic_link" | "notification" | "welcome" | "password_reset" | "order_confirmation" | "delivery_update" | "custom"
        subject?: string
        htmlContent?: string
        textContent?: string
        variables?: string[]
        recipientRoles?: string[]
        isActive?: boolean
    }
) {
    try {
        await db
            .update(emailTemplates)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(emailTemplates.id, id))

        revalidatePath("/dashboard/settings/email")
        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update template",
        }
    }
}

export async function deleteEmailTemplate(id: string) {
    try {
        await db.delete(emailTemplates).where(eq(emailTemplates.id, id))
        revalidatePath("/dashboard/settings/email")
        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete template",
        }
    }
}

export async function toggleEmailTemplate(id: string, isActive: boolean) {
    try {
        await db
            .update(emailTemplates)
            .set({ isActive, updatedAt: new Date() })
            .where(eq(emailTemplates.id, id))

        revalidatePath("/dashboard/settings/email")
        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to toggle template",
        }
    }
}

// ─── EMAIL LOGS ───────────────────────────────────────────────────────────────

export async function getEmailLogs(limit = 50) {
    return await db
        .select()
        .from(emailLogs)
        .orderBy(emailLogs.createdAt)
        .limit(limit)
}
