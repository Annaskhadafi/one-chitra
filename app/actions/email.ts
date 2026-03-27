"use server"

import { db } from "@/db"
import { smtpSettings, emailTemplates, emailLogs, emailNotificationRules, emailNotificationRuleLogs } from "@/db/schema/email"
import { and, desc, eq, ilike, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { sendEmail, createTransporter } from "@/lib/email"
import type { SmtpConfig } from "@/lib/email"
import { ensureSystemEmailTemplates } from "@/lib/email-template-registry"
import { ensureEmailManagementSchema } from "@/lib/email-schema"
import { user } from "@/db/schema"
import { isRevenueReportTemplateManagedByAutomation, normalizeRecipientRoleNames } from "@/lib/revenue-report-config"

function sanitizeTemplateRecipientSettings<T extends {
    code?: string | null
    recipientRoles?: string[]
    recipientUserIds?: string[]
    ccEmails?: string[]
    deliveryChannels?: Array<"email" | "push">
}>(data: T): T {
    const normalizedChannels = Array.isArray(data.deliveryChannels)
        ? Array.from(new Set(data.deliveryChannels.filter((entry): entry is "email" | "push" => entry === "email" || entry === "push")))
        : undefined

    if (!isRevenueReportTemplateManagedByAutomation(data.code)) {
        return {
            ...data,
            recipientRoles: data.recipientRoles ? normalizeRecipientRoleNames(data.recipientRoles) : data.recipientRoles,
            deliveryChannels: normalizedChannels && normalizedChannels.length > 0 ? normalizedChannels : ["email"],
        }
    }

    return {
        ...data,
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        deliveryChannels: normalizedChannels && normalizedChannels.length > 0 ? normalizedChannels : ["email", "push"],
    }
}

// ─── SMTP ─────────────────────────────────────────────────────────────────────

export async function getSmtpSettings() {
    await ensureEmailManagementSchema()
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
        await ensureEmailManagementSchema()
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
        await ensureEmailManagementSchema()
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
    await ensureEmailManagementSchema()
    await ensureSystemEmailTemplates()
    return await db
        .select()
        .from(emailTemplates)
        .orderBy(emailTemplates.createdAt)
}

export async function getEmailTemplate(id: string) {
    await ensureEmailManagementSchema()
    const rows = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.id, id))
        .limit(1)
    return rows[0] ?? null
}

export async function createEmailTemplate(data: {
    name: string
    code?: string | null
    type: "magic_link" | "notification" | "welcome" | "password_reset" | "order_confirmation" | "delivery_update" | "custom"
    subject: string
    htmlContent: string
    textContent?: string
    variables?: string[]
    recipientRoles?: string[]
    recipientUserIds?: string[]
    ccEmails?: string[]
    deliveryChannels?: Array<"email" | "push">
    isActive: boolean
}) {
    try {
        await ensureEmailManagementSchema()
        const sanitizedData = sanitizeTemplateRecipientSettings(data)
        const [created] = await db
            .insert(emailTemplates)
            .values(sanitizedData)
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
        code?: string | null
        type?: "magic_link" | "notification" | "welcome" | "password_reset" | "order_confirmation" | "delivery_update" | "custom"
        subject?: string
        htmlContent?: string
        textContent?: string
        variables?: string[]
        recipientRoles?: string[]
        recipientUserIds?: string[]
        ccEmails?: string[]
        deliveryChannels?: Array<"email" | "push">
        isActive?: boolean
    }
) {
    try {
        await ensureEmailManagementSchema()
        const current = await db
            .select({ code: emailTemplates.code })
            .from(emailTemplates)
            .where(eq(emailTemplates.id, id))
            .limit(1)

        const sanitizedData = sanitizeTemplateRecipientSettings({
            ...data,
            code: data.code ?? current[0]?.code ?? null,
        })
        await db
            .update(emailTemplates)
            .set({ ...sanitizedData, updatedAt: new Date() })
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
        await ensureEmailManagementSchema()
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
        await ensureEmailManagementSchema()
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
    await ensureEmailManagementSchema()
    return await db
        .select()
        .from(emailLogs)
        .orderBy(desc(emailLogs.createdAt))
        .limit(limit)
}

export async function clearEmailLogs() {
    try {
        await ensureEmailManagementSchema()
        const deletedRows = await db
            .delete(emailLogs)
            .returning({ id: emailLogs.id })

        revalidatePath("/dashboard/settings/email")
        return {
            success: true,
            deletedCount: deletedRows.length,
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to clear email logs",
            deletedCount: 0,
        }
    }
}

// ─── EMAIL NOTIFICATION RULES ────────────────────────────────────────────────

export async function getEmailNotificationRules() {
    await ensureEmailManagementSchema()
    return await db
        .select()
        .from(emailNotificationRules)
        .orderBy(emailNotificationRules.createdAt)
}

export async function createEmailNotificationRule(data: {
    name: string
    formKey: string
    combinator: "AND" | "OR"
    conditions: Array<{
        id: string
        fieldKey: string
        operator: string
        value?: string | null
        dataType?: "string" | "number" | "date" | "boolean" | "array"
    }>
    toEmails?: string[]
    ccEmails?: string[]
    options?: {
        priority?: "low" | "normal" | "high" | "urgent"
        scheduleType?: "immediate" | "daily" | "weekly" | "custom_cron"
        scheduleValue?: string | null
        includeAttachments?: boolean
        attachmentMode?: "none" | "all" | "filtered"
        allowedFileTypes?: string[]
        maxAttachmentMb?: number
        replyTo?: string | null
        subjectPrefix?: string | null
    }
    templateId: string
    isActive: boolean
}) {
    try {
        await ensureEmailManagementSchema()
        const [created] = await db
            .insert(emailNotificationRules)
            .values({
                name: data.name,
                formKey: data.formKey,
                combinator: data.combinator,
                conditions: data.conditions,
                toEmails: data.toEmails ?? [],
                ccEmails: data.ccEmails ?? [],
                options: data.options ?? {},
                templateId: data.templateId,
                isActive: data.isActive,
            })
            .returning()

        revalidatePath("/dashboard/settings/email")
        return { success: true, rule: created }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create notification rule",
        }
    }
}

export async function updateEmailNotificationRule(
    id: string,
    data: Partial<{
        name: string
        formKey: string
        combinator: "AND" | "OR"
        conditions: Array<{
            id: string
            fieldKey: string
            operator: string
            value?: string | null
            dataType?: "string" | "number" | "date" | "boolean" | "array"
        }>
        toEmails: string[]
        ccEmails: string[]
        options: {
            priority?: "low" | "normal" | "high" | "urgent"
            scheduleType?: "immediate" | "daily" | "weekly" | "custom_cron"
            scheduleValue?: string | null
            includeAttachments?: boolean
            attachmentMode?: "none" | "all" | "filtered"
            allowedFileTypes?: string[]
            maxAttachmentMb?: number
            replyTo?: string | null
            subjectPrefix?: string | null
        }
        templateId: string
        isActive: boolean
    }>
) {
    try {
        await ensureEmailManagementSchema()
        await db
            .update(emailNotificationRules)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(emailNotificationRules.id, id))

        revalidatePath("/dashboard/settings/email")
        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update notification rule",
        }
    }
}

export async function deleteEmailNotificationRule(id: string) {
    try {
        await ensureEmailManagementSchema()
        await db.delete(emailNotificationRules).where(eq(emailNotificationRules.id, id))
        revalidatePath("/dashboard/settings/email")
        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete notification rule",
        }
    }
}

export async function toggleEmailNotificationRule(id: string, isActive: boolean) {
    try {
        await ensureEmailManagementSchema()
        await db
            .update(emailNotificationRules)
            .set({ isActive, updatedAt: new Date() })
            .where(eq(emailNotificationRules.id, id))

        revalidatePath("/dashboard/settings/email")
        return { success: true }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to toggle notification rule",
        }
    }
}

export async function getEmailNotificationRuleLogs(ruleId: string, limit = 100) {
    await ensureEmailManagementSchema()
    const safeRuleId = String(ruleId ?? "").trim()
    if (!safeRuleId) return []

    return await db
        .select()
        .from(emailNotificationRuleLogs)
        .where(eq(emailNotificationRuleLogs.ruleId, safeRuleId))
        .orderBy(desc(emailNotificationRuleLogs.createdAt))
        .limit(limit)
}

export async function searchRecipientEmails(query: string) {
    await ensureEmailManagementSchema()
    const safeQuery = String(query ?? "").trim()
    if (safeQuery.length < 3) {
        return [] as Array<{ id: string; email: string; name: string | null; role: string | null }>
    }

    return await db
        .select({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        })
        .from(user)
        .where(and(
            or(
                ilike(user.email, `%${safeQuery}%`),
                ilike(user.name, `%${safeQuery}%`),
            ),
        ))
        .limit(20)
}
