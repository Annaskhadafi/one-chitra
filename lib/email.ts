import nodemailer from "nodemailer";
import { db } from "@/db";
import { smtpSettings, emailTemplates, emailLogs } from "@/db/schema/email";
import { eq, and } from "drizzle-orm";

export type SmtpConfig = {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
};

export type EmailOptions = {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
    }>;
};

export type TemplateData = Record<string, string | number | boolean>;

export async function getActiveSmtpConfig(): Promise<SmtpConfig | null> {
    const settings = await db
        .select()
        .from(smtpSettings)
        .where(eq(smtpSettings.isActive, true))
        .limit(1);

    if (settings.length === 0) return null;

    const s = settings[0];
    return {
        host: s.host,
        port: parseInt(s.port),
        secure: s.secure,
        username: s.username,
        password: s.password,
        fromEmail: s.fromEmail,
        fromName: s.fromName,
    };
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
    });
}

export function replaceTemplateVariables(template: string, data: TemplateData): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, "g");
        result = result.replace(regex, String(value));
    }
    return result;
}

export async function getEmailTemplate(
    type: "magic_link" | "notification" | "welcome" | "password_reset" | "order_confirmation" | "delivery_update" | "custom"
): Promise<(typeof emailTemplates.$inferSelect) | null> {
    const templates = await db
        .select()
        .from(emailTemplates)
        .where(and(
            eq(emailTemplates.type, type),
            eq(emailTemplates.isActive, true)
        ))
        .limit(1);

    return templates[0] || null;
}

export async function sendEmail(
    options: EmailOptions,
    config?: SmtpConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const smtpConfig = config || (await getActiveSmtpConfig());

        if (!smtpConfig) {
            return { success: false, error: "No active SMTP configuration found" };
        }

        const transporter = createTransporter(smtpConfig);

        const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;

        const info = await transporter.sendMail({
            from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
            to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            replyTo: options.replyTo,
            attachments: options.attachments,
        });

        return { success: true, messageId: info.messageId };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: errorMessage };
    }
}

export async function sendTemplatedEmail(
    to: string | string[],
    templateType: "magic_link" | "notification" | "welcome" | "password_reset" | "order_confirmation" | "delivery_update" | "custom",
    data: TemplateData,
    customSubject?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
        const template = await getEmailTemplate(templateType);

        if (!template) {
            return { success: false, error: `Template '${templateType}' not found` };
        }

        const subject = customSubject
            ? replaceTemplateVariables(customSubject, data)
            : replaceTemplateVariables(template.subject, data);

        const html = replaceTemplateVariables(template.htmlContent, data);
        const text = template.textContent
            ? replaceTemplateVariables(template.textContent, data)
            : undefined;

        const result = await sendEmail({ to, subject, html, text });

        await db.insert(emailLogs).values({
            templateId: template.id,
            toEmail: Array.isArray(to) ? to.join(", ") : to,
            subject,
            status: result.success ? "sent" : "failed",
            errorMessage: result.error || null,
            sentAt: result.success ? new Date() : null,
        });

        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: errorMessage };
    }
}

export async function sendMagicLinkEmail(
    email: string,
    magicLink: string,
    userName?: string
): Promise<{ success: boolean; error?: string }> {
    const result = await sendTemplatedEmail(email, "magic_link", {
        magicLink,
        userName: userName || "User",
        appName: "One Chitra",
        expiresIn: "15 minutes",
    });

    return result;
}

export async function sendNotificationEmail(
    to: string | string[],
    title: string,
    message: string,
    actionUrl?: string
): Promise<{ success: boolean; error?: string }> {
    const result = await sendTemplatedEmail(to, "notification", {
        title,
        message,
        actionUrl: actionUrl || "#",
        appName: "One Chitra",
    });

    return result;
}
