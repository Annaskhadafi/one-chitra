import "server-only"
import nodemailer from "nodemailer"
import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { smtpSettings, emailLogs, emailTemplates } from "@/db/schema/email"
import {
    ensureSystemEmailTemplates,
    getDefaultDeliveryChannelsForTemplate,
    getSystemEmailTemplateDefinition,
    SYSTEM_EMAIL_TEMPLATE_CODES,
    type NotificationDeliveryChannel,
    type SystemEmailTemplateCode,
} from "@/lib/email-template-registry"
import { ensureEmailManagementSchema } from "@/lib/email-schema"
import { toCanonicalAppUrl } from "@/lib/app-url"
import { isRevenueReportTemplateManagedByAutomation } from "@/lib/revenue-report-config"

export type SmtpConfig = {
    host: string
    port: number
    secure: boolean
    username: string
    password: string
    fromEmail: string
    fromName: string
}

export type TemplateType =
    "magic_link" |
    "notification" |
    "welcome" |
    "password_reset" |
    "order_confirmation" |
    "delivery_update" |
    "custom"

export type EmailOptions = {
    to: string | string[]
    cc?: string | string[]
    subject: string
    html?: string
    text?: string
    replyTo?: string
    attachments?: Array<{
        filename: string
        content: Buffer | string
        contentType?: string
    }>
    logMeta?: {
        templateId?: string | null
        templateCode?: string | null
        templateName?: string | null
    }
}

export type TemplateData = Record<string, string | number | boolean | null | undefined>

type SendEmailResult = {
    success: boolean
    messageId?: string
    error?: string
}

type DispatchTemplateResult = {
    success: boolean
    channels: NotificationDeliveryChannel[]
    email?: SendEmailResult
    pushLogged: boolean
    error?: string
}

function normalizeEmailList(value?: string | string[] | null) {
    if (!value) return [] as string[]

    const entries = Array.isArray(value) ? value : value.split(",")
    return Array.from(
        new Set(
            entries
                .map((entry) => entry.trim())
                .filter(Boolean),
        ),
    )
}

function serializeEmailList(value?: string | string[] | null) {
    const normalized = normalizeEmailList(value)
    return normalized.length > 0 ? normalized.join(", ") : null
}

function normalizeDeliveryChannels(value?: unknown, fallback: NotificationDeliveryChannel[] = ["email"]) {
    const input = Array.isArray(value) ? value : []
    const valid = Array.from(
        new Set(
            input.filter(
                (entry): entry is NotificationDeliveryChannel => entry === "email" || entry === "push",
            ),
        ),
    )

    return valid.length > 0 ? valid : fallback
}

export async function resolveUserEmailsFromRolesAndIds(roleNames: string[], userIds: string[]) {
    const normalizedRoles = new Set(roleNames.map((entry) => entry.trim().toLowerCase()).filter(Boolean))
    const normalizedUserIds = new Set(userIds.map((entry) => entry.trim()).filter(Boolean))
    const includeAllUsers = normalizedRoles.has("all")

    if (normalizedRoles.size === 0 && normalizedUserIds.size === 0) {
        return [] as string[]
    }

    const users = await db.query.user.findMany({
        columns: {
            id: true,
            email: true,
            role: true,
        },
    })

    return Array.from(new Set(
        users
            .filter((entry) => {
                const role = (entry.role ?? "").trim().toLowerCase()
                return includeAllUsers || normalizedUserIds.has(entry.id) || normalizedRoles.has(role)
            })
            .map((entry) => entry.email?.trim() ?? "")
            .filter(Boolean),
    ))
}

async function writeEmailLog(params: {
    to?: string | string[] | null
    cc?: string | string[] | null
    fromEmail?: string | null
    subject: string
    html?: string | null
    text?: string | null
    status: "sent" | "failed" | "pending"
    errorMessage?: string | null
    sentAt?: Date | null
    templateId?: string | null
    templateCode?: string | null
    templateName?: string | null
    deliveryChannel?: NotificationDeliveryChannel
}) {
    try {
        await ensureEmailManagementSchema()

        await db.insert(emailLogs).values({
            templateId: params.templateId ?? null,
            templateCode: params.templateCode ?? null,
            templateName: params.templateName ?? null,
            toEmail: serializeEmailList(params.to) ?? "-",
            ccEmail: serializeEmailList(params.cc),
            fromEmail: params.fromEmail ?? null,
            deliveryChannel: params.deliveryChannel ?? "email",
            subject: params.subject,
            htmlContent: params.html ?? null,
            textContent: params.text ?? null,
            status: params.status,
            errorMessage: params.errorMessage ?? null,
            sentAt: params.sentAt ?? null,
        })
    } catch (error) {
        console.error("[EMAIL] Failed to write email log:", error)
    }
}

async function writePushNotificationLog(params: {
    to?: string | string[] | null
    cc?: string | string[] | null
    subject: string
    html?: string | null
    text?: string | null
    templateId?: string | null
    templateCode?: string | null
    templateName?: string | null
}) {
    await writeEmailLog({
        ...params,
        status: "sent",
        sentAt: new Date(),
        deliveryChannel: "push",
    })
}

async function dispatchTemplateMessage(args: {
    to: string[]
    cc: string[]
    subject: string
    html?: string
    text?: string
    replyTo?: string
    attachments?: Array<{
        filename: string
        content: Buffer | string
        contentType?: string
    }>
    channels: NotificationDeliveryChannel[]
    logMeta?: EmailOptions["logMeta"]
}): Promise<DispatchTemplateResult> {
    const channels = normalizeDeliveryChannels(args.channels)

    if (args.to.length === 0) {
        const error = "No recipient email provided"
        for (const channel of channels) {
            await writeEmailLog({
                to: args.to,
                cc: args.cc,
                subject: args.subject,
                html: args.html ?? null,
                text: args.text ?? null,
                status: "failed",
                errorMessage: error,
                templateId: args.logMeta?.templateId ?? null,
                templateCode: args.logMeta?.templateCode ?? null,
                templateName: args.logMeta?.templateName ?? null,
                deliveryChannel: channel,
            })
        }

        return {
            success: false,
            channels,
            pushLogged: false,
            error,
        }
    }

    let emailResult: SendEmailResult | undefined
    if (channels.includes("email")) {
        emailResult = await sendEmail({
            to: args.to,
            cc: args.cc,
            subject: args.subject,
            html: args.html,
            text: args.text,
            replyTo: args.replyTo,
            attachments: args.attachments,
            logMeta: args.logMeta,
        })
    }

    let pushLogged = false
    if (channels.includes("push")) {
        await writePushNotificationLog({
            to: args.to,
            cc: args.cc,
            subject: args.subject,
            html: args.html ?? null,
            text: args.text ?? null,
            templateId: args.logMeta?.templateId ?? null,
            templateCode: args.logMeta?.templateCode ?? null,
            templateName: args.logMeta?.templateName ?? null,
        })
        pushLogged = true
    }

    const success = channels.includes("email")
        ? Boolean(emailResult?.success) || pushLogged
        : pushLogged

    return {
        success,
        channels,
        email: emailResult,
        pushLogged,
        error: emailResult?.success === false ? emailResult.error : undefined,
    }
}

export async function getActiveSmtpConfig(): Promise<SmtpConfig | null> {
    await ensureEmailManagementSchema()

    const settings = await db
        .select()
        .from(smtpSettings)
        .where(eq(smtpSettings.isActive, true))
        .limit(1)

    if (settings.length === 0) return null

    const current = settings[0]
    return {
        host: current.host,
        port: parseInt(current.port),
        secure: current.secure,
        username: current.username,
        password: current.password,
        fromEmail: current.fromEmail,
        fromName: current.fromName,
    }
}

export function createTransporter(config: SmtpConfig) {
    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.username,
            pass: config.password,
        },
    })
}

export function replaceTemplateVariables(template: string, data: TemplateData) {
    let result = template
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, "g")
        result = result.replace(regex, String(value ?? ""))
    }
    return result
}

export async function getEmailTemplate(type: TemplateType) {
    await ensureEmailManagementSchema()

    const templates = await db
        .select()
        .from(emailTemplates)
        .where(and(
            eq(emailTemplates.type, type),
            eq(emailTemplates.isActive, true),
        ))
        .limit(1)

    return templates[0] || null
}

function normalizeSystemTemplateData(data: TemplateData) {
    return Object.fromEntries(
        Object.entries(data).map(([key, value]) => {
            if (typeof value !== "string") {
                return [key, value]
            }

            const isUrlLikeKey =
                key.toLowerCase().endsWith("url") ||
                key.toLowerCase().endsWith("link")

            if (!isUrlLikeKey) {
                return [key, value]
            }

            return [key, toCanonicalAppUrl(value)]
        }),
    ) as TemplateData
}

export async function getEmailTemplateByCode(code: string, includeInactive = false) {
    await ensureEmailManagementSchema()
    await ensureSystemEmailTemplates()

    const templates = await db
        .select()
        .from(emailTemplates)
        .where(includeInactive
            ? eq(emailTemplates.code, code)
            : and(
                eq(emailTemplates.code, code),
                eq(emailTemplates.isActive, true),
            ))
        .limit(1)

    return templates[0] || null
}

export async function sendEmail(
    options: EmailOptions,
    config?: SmtpConfig,
): Promise<SendEmailResult> {
    const to = normalizeEmailList(options.to)
    const cc = normalizeEmailList(options.cc).filter((email) => !to.includes(email))

    let smtpConfig = config ?? null
    let result: SendEmailResult = { success: false, error: "Unknown error" }

    if (to.length === 0) {
        result = { success: false, error: "No recipient email provided" }
        await writeEmailLog({
            to: options.to,
            cc: options.cc,
            subject: options.subject,
            html: options.html ?? null,
            text: options.text ?? null,
            status: "failed",
            errorMessage: result.error,
            templateId: options.logMeta?.templateId ?? null,
            templateCode: options.logMeta?.templateCode ?? null,
            templateName: options.logMeta?.templateName ?? null,
            deliveryChannel: "email",
        })
        return result
    }

    try {
        smtpConfig = smtpConfig ?? await getActiveSmtpConfig()

        if (!smtpConfig) {
            result = { success: false, error: "No active SMTP configuration found" }
        } else {
            const transporter = createTransporter(smtpConfig)

            const info = await transporter.sendMail({
                from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
                to: serializeEmailList(to) ?? undefined,
                cc: cc.length > 0 ? serializeEmailList(cc) ?? undefined : undefined,
                subject: options.subject,
                html: options.html,
                text: options.text,
                replyTo: options.replyTo,
                attachments: options.attachments,
            })

            result = { success: true, messageId: info.messageId }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        result = { success: false, error: errorMessage }
    }

    await writeEmailLog({
        to,
        cc,
        fromEmail: smtpConfig?.fromEmail ?? config?.fromEmail ?? null,
        subject: options.subject,
        html: options.html ?? null,
        text: options.text ?? null,
        status: result.success ? "sent" : "failed",
        errorMessage: result.error ?? null,
        sentAt: result.success ? new Date() : null,
        templateId: options.logMeta?.templateId ?? null,
        templateCode: options.logMeta?.templateCode ?? null,
        templateName: options.logMeta?.templateName ?? null,
        deliveryChannel: "email",
    })

    return result
}

export async function sendTemplatedEmail(
    to: string | string[],
    templateType: TemplateType,
    data: TemplateData,
    customSubject?: string,
    extraOptions?: {
        cc?: string | string[]
    },
) {
    const template = await getEmailTemplate(templateType)

    if (!template) {
        const errorMessage = `Template '${templateType}' not found`
        await writeEmailLog({
            to,
            cc: extraOptions?.cc,
            subject: customSubject ? replaceTemplateVariables(customSubject, data) : errorMessage,
            status: "failed",
            errorMessage,
            deliveryChannel: "email",
        })
        return { success: false, error: errorMessage }
    }

    const subject = customSubject
        ? replaceTemplateVariables(customSubject, data)
        : replaceTemplateVariables(template.subject, data)

    const html = replaceTemplateVariables(template.htmlContent, data)
    const text = template.textContent
        ? replaceTemplateVariables(template.textContent, data)
        : undefined

    const templateRecipients = await resolveUserEmailsFromRolesAndIds(
        (template.recipientRoles as string[] | null) ?? [],
        (template.recipientUserIds as string[] | null) ?? [],
    )
    const templateCc = (template.ccEmails as string[] | null) ?? []

    return dispatchTemplateMessage({
        to: [...normalizeEmailList(to), ...templateRecipients],
        cc: [...templateCc, ...normalizeEmailList(extraOptions?.cc)],
        subject,
        html,
        text,
        channels: normalizeDeliveryChannels(template.deliveryChannels, ["email"]),
        logMeta: {
            templateId: template.id,
            templateCode: template.code ?? null,
            templateName: template.name,
        },
    })
}

export async function sendSystemTemplatedEmailByCode(args: {
    code: SystemEmailTemplateCode
    to?: string | string[]
    cc?: string | string[]
    data: TemplateData
    customSubject?: string
    attachments?: Array<{
        filename: string
        content: Buffer | string
        contentType?: string
    }>
    ignoreTemplateRecipients?: boolean
}) {
    await ensureSystemEmailTemplates()

    const activeTemplate = await getEmailTemplateByCode(args.code, true)
    const starterTemplate = getSystemEmailTemplateDefinition(args.code)

    if (!activeTemplate && !starterTemplate) {
        const errorMessage = `System template '${args.code}' not found`
        await writeEmailLog({
            to: args.to,
            cc: args.cc,
            subject: errorMessage,
            status: "failed",
            errorMessage,
            templateCode: args.code,
            deliveryChannel: "email",
        })
        return { success: false, error: errorMessage }
    }

    if (activeTemplate && activeTemplate.isActive === false) {
        const errorMessage = `Template '${args.code}' is inactive`
        await writeEmailLog({
            to: args.to,
            cc: args.cc,
            subject: activeTemplate.subject,
            status: "failed",
            errorMessage,
            templateId: activeTemplate.id,
            templateCode: activeTemplate.code ?? args.code,
            templateName: activeTemplate.name,
            deliveryChannel: "email",
        })
        return { success: false, error: errorMessage }
    }

    const template = activeTemplate ?? starterTemplate
    const templateType = activeTemplate?.type ?? starterTemplate?.type ?? "notification"
    const normalizedData = normalizeSystemTemplateData(args.data)
    const subjectSource = args.customSubject ?? template.subject
    const htmlSource = template.htmlContent
    const textSource = template.textContent ?? undefined
    const ccEmails = isRevenueReportTemplateManagedByAutomation(args.code)
        ? []
        : ("ccEmails" in template ? (template.ccEmails ?? []) : [])
    const deliveryChannels = "deliveryChannels" in template
        ? normalizeDeliveryChannels(template.deliveryChannels, getDefaultDeliveryChannelsForTemplate({
            code: args.code,
            type: templateType,
        }))
        : getDefaultDeliveryChannelsForTemplate({
            code: args.code,
            type: templateType,
        })
    const templateRecipients = args.ignoreTemplateRecipients ? [] : await resolveUserEmailsFromRolesAndIds(
        ("recipientRoles" in template ? (template.recipientRoles ?? []) : []) as string[],
        ("recipientUserIds" in template ? (template.recipientUserIds ?? []) : []) as string[],
    )

    return dispatchTemplateMessage({
        to: [...normalizeEmailList(args.to), ...templateRecipients],
        cc: [...ccEmails, ...normalizeEmailList(args.cc)],
        subject: replaceTemplateVariables(subjectSource, normalizedData),
        html: replaceTemplateVariables(htmlSource, normalizedData),
        text: textSource ? replaceTemplateVariables(textSource, normalizedData) : undefined,
        channels: deliveryChannels,
        attachments: args.attachments,
        logMeta: {
            templateId: "id" in template ? template.id : null,
            templateCode: "code" in template ? template.code : args.code,
            templateName: template.name,
        },
    })
}

export async function sendMagicLinkEmail(
    email: string,
    magicLink: string,
    userName?: string,
) {
    return sendSystemTemplatedEmailByCode({
        code: SYSTEM_EMAIL_TEMPLATE_CODES.authMagicLink,
        to: email,
        data: {
            magicLink,
            userName: userName || "User",
            appName: "One Chitra",
            expiresIn: "15 minutes",
        },
    })
}

export async function sendPasswordResetEmail(
    email: string,
    resetUrl: string,
    userName?: string,
) {
    return sendSystemTemplatedEmailByCode({
        code: SYSTEM_EMAIL_TEMPLATE_CODES.authPasswordReset,
        to: email,
        data: {
            resetUrl,
            userName: userName || "User",
            appName: "One Chitra",
            expiresIn: "1 hour",
        },
    })
}

export async function sendNotificationEmail(
    to: string | string[],
    title: string,
    message: string,
    actionUrl?: string,
) {
    return sendTemplatedEmail(to, "notification", {
        title,
        message,
        actionUrl: actionUrl || "#",
        appName: "One Chitra",
    })
}

export async function sendLoggedNotificationMessage(args: {
    to: string | string[]
    cc?: string | string[]
    subject: string
    html?: string
    text?: string
    replyTo?: string
    attachments?: Array<{
        filename: string
        content: Buffer | string
        contentType?: string
    }>
    channels?: NotificationDeliveryChannel[]
    logMeta?: EmailOptions["logMeta"]
}) {
    return dispatchTemplateMessage({
        to: normalizeEmailList(args.to),
        cc: normalizeEmailList(args.cc),
        subject: args.subject,
        html: args.html,
        text: args.text,
        replyTo: args.replyTo,
        attachments: args.attachments,
        channels: normalizeDeliveryChannels(args.channels, ["email", "push"]),
        logMeta: args.logMeta,
    })
}
