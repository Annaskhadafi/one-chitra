"use server"

import { db } from "@/db"
import { marketingCampaigns, campaignRecipients, customers, emailGroups, emailContacts, emailGroupMembers, user, emailTemplates } from "@/db/schema"
import { eq, desc, isNotNull, like, and, sql, count, or, lte, inArray } from "drizzle-orm"
import { getAuthenticatedSession } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { readManagedUpload } from "@/lib/upload-storage"
import { z } from "zod"
import { getSegmentEmailRecipients } from "./customer-segmentation"

const campaignSchema = z.object({
    name: z.string().min(3),
    subject: z.string().min(3),
    content: z.string().min(10),
    description: z.string().optional(),
    segmentCriteria: z.string().optional(), // Keep for backward compatibility
    targetConfig: z.string().optional(), // New complex target config
    ccEmails: z.string().optional(), // New CC config
    attachments: z.string().optional(), // New attachments [{name, url}]
    scheduledAt: z.string().optional(), // ISO string
})

async function resolveCampaignAttachments(attachmentsJson: string | null) {
    if (!attachmentsJson) return [] as Array<{
        filename: string
        content: Buffer
        contentType?: string
    }>

    let attachments: Array<{ name?: string; url?: string }> = []

    try {
        attachments = JSON.parse(attachmentsJson)
    } catch {
        return []
    }

    const resolvedAttachments = await Promise.all(
        attachments.map(async (attachment) => {
            if (!attachment?.url) return null

            const storedFile = await readManagedUpload(attachment.url)
            if (!storedFile) {
                console.warn("[MarketingCampaign] Attachment not found in managed storage:", attachment.url)
                return null
            }

            return {
                filename: attachment.name || storedFile.filename,
                content: storedFile.buffer,
                contentType: storedFile.contentType,
            }
        })
    )

    return resolvedAttachments.filter((attachment): attachment is NonNullable<typeof attachment> => Boolean(attachment))
}

// ─── READ ────────────────────────────────────────────────────────────────────

export async function getCampaigns() {
    await getAuthenticatedSession("marketing", "view");
    return await db.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.createdAt));
}

export async function getCampaign(id: number) {
    await getAuthenticatedSession("marketing", "view");
    const res = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, id));
    return res[0];
}

export async function getCampaignStats() {
    await getAuthenticatedSession("marketing", "view");

    const stats = await db.select({
        total: count(),
        sent: sql<number>`COUNT(*) FILTER (WHERE ${marketingCampaigns.status} = 'sent')`,
        draft: sql<number>`COUNT(*) FILTER (WHERE ${marketingCampaigns.status} = 'draft')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${marketingCampaigns.status} = 'failed')`,
        totalRecipientsSent: sql<number>`COALESCE(SUM(${marketingCampaigns.totalRecipients}) FILTER (WHERE ${marketingCampaigns.status} = 'sent'), 0)`,
    }).from(marketingCampaigns);

    return stats[0] ?? { total: 0, sent: 0, draft: 0, failed: 0, totalRecipientsSent: 0 };
}

export async function getCampaignRecipients(campaignId: number, page = 1, pageSize = 50) {
    await getAuthenticatedSession("marketing", "view");
    const offset = (page - 1) * pageSize;
    const rows = await db.select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaignId))
        .orderBy(desc(campaignRecipients.sentAt))
        .limit(pageSize)
        .offset(offset);
    const totalRows = await db.select({ count: count() })
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaignId));
    return { rows, total: totalRows[0]?.count ?? 0 };
}

// ─── PREVIEW RECIPIENTS ──────────────────────────────────────────────────────

export async function previewRecipients(segmentCriteriaJson: string): Promise<{
    count: number;
    sample: string[];
}> {
    await getAuthenticatedSession("marketing", "view");

    try {
        const criteria = JSON.parse(segmentCriteriaJson || '{"type":"all"}');
        const baseCondition = isNotNull(customers.email);

        let query;
        let countQuery;

        if (criteria.type === "custom") {
            const emails = Array.isArray(criteria.emails) ? criteria.emails : [];
            return {
                count: emails.length,
                sample: emails.slice(0, 5),
            };
        } else if (criteria.type === "all") {
            query = db.select({ name: customers.name, email: customers.email })
                .from(customers)
                .where(baseCondition)
                .limit(5);
            countQuery = await db.select({ count: count() }).from(customers).where(baseCondition);
        } else if (criteria.type === "city") {
            query = db.select({ name: customers.name, email: customers.email })
                .from(customers)
                .where(and(baseCondition, like(customers.address1, `%${criteria.city}%`)))
                .limit(5);
            countQuery = await db.select({ count: count() })
                .from(customers)
                .where(and(baseCondition, like(customers.address1, `%${criteria.city}%`)));
        } else {
            // For RFM-based segments, currently fallback to all-email query 
            // since we don't have RFM joined at DB level yet.
            query = db.select({ name: customers.name, email: customers.email })
                .from(customers)
                .where(baseCondition)
                .limit(5);
            countQuery = await db.select({ count: count() }).from(customers).where(baseCondition);
        }

        const sample = await query;
        const total = countQuery[0]?.count ?? 0;

        return {
            count: Number(total),
            sample: sample.map(c => c.name).filter(Boolean) as string[],
        };
    } catch {
        return { count: 0, sample: [] };
    }
}

// ─── CREATE / UPDATE / DELETE ─────────────────────────────────────────────────

export async function createCampaign(data: z.infer<typeof campaignSchema>) {
    try {
        const session = await getAuthenticatedSession("marketing", "create");

        await db.insert(marketingCampaigns).values({
            name: data.name,
            subject: data.subject,
            content: data.content,
            description: data.description || null,
            segmentCriteria: data.segmentCriteria || null,
            targetConfig: data.targetConfig || null,
            attachments: data.attachments || null,
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
            createdBy: session.user.id,
            status: "draft",
        });

        revalidatePath("/dashboard/marketing/campaigns");
        return { success: true };
    } catch (error) {
        console.error("Create campaign error:", error)
        return { success: false, error: "Failed to create campaign" };
    }
}

export async function updateCampaign(id: number, data: z.infer<typeof campaignSchema>) {
    try {
        await getAuthenticatedSession("marketing", "edit");

        const current = await db.select({
            id: marketingCampaigns.id,
            status: marketingCampaigns.status,
        }).from(marketingCampaigns).where(eq(marketingCampaigns.id, id)).then((rows) => rows[0] ?? null)

        if (!current) {
            return { success: false, error: "Campaign tidak ditemukan" };
        }

        if (current.status === "processing") {
            return { success: false, error: "Campaign sedang diproses dan belum bisa diedit" };
        }

        const shouldResetForResend = current.status === "sent"

        if (shouldResetForResend) {
            await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, id))
        }

        await db.update(marketingCampaigns)
            .set({
                name: data.name,
                subject: data.subject,
                content: data.content,
                description: data.description || null,
                segmentCriteria: data.segmentCriteria || null,
                targetConfig: data.targetConfig || null,
                attachments: data.attachments || null,
                scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
                status: shouldResetForResend ? "draft" : current.status,
                sentAt: shouldResetForResend ? null : undefined,
                totalRecipients: shouldResetForResend ? 0 : undefined,
                successCount: shouldResetForResend ? 0 : undefined,
                failureCount: shouldResetForResend ? 0 : undefined,
                updatedAt: new Date(),
            })
            .where(eq(marketingCampaigns.id, id));

        revalidatePath("/dashboard/marketing/campaigns");
        return {
            success: true,
            resetForResend: shouldResetForResend,
        };
    } catch (error) {
        return { success: false, error: "Failed to update campaign" };
    }
}

export async function deleteCampaign(id: number) {
    try {
        await getAuthenticatedSession("marketing", "delete");
        await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id));
        revalidatePath("/dashboard/marketing/campaigns");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete campaign" };
    }
}

export async function duplicateCampaign(id: number) {
    try {
        const session = await getAuthenticatedSession("marketing", "create");
        const original = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, id)).then(r => r[0]);
        if (!original) return { success: false, error: "Campaign not found" };

        await db.insert(marketingCampaigns).values({
            name: `${original.name} (copy)`,
            subject: original.subject,
            content: original.content,
            description: original.description,
            segmentCriteria: original.segmentCriteria,
            targetConfig: original.targetConfig,
            attachments: original.attachments,
            status: "draft",
            createdBy: session.user.id,
        });

        revalidatePath("/dashboard/marketing/campaigns");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to duplicate campaign" };
    }
}

export async function updateCampaignStatus(id: number, status: string) {
    try {
        await getAuthenticatedSession("marketing", "edit");
        await db.update(marketingCampaigns)
            .set({ status, updatedAt: new Date() })
            .where(eq(marketingCampaigns.id, id));
        revalidatePath("/dashboard/marketing/campaigns");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update status" };
    }
}

// ─── RECIPIENT RESOLVER ─────────────────────────────────────────────────────

async function resolveEmails(configStr: string | null) {
    if (!configStr) return [];
    try {
        const config = JSON.parse(configStr);
        const results: { email: string; name: string; company: string; position: string }[] = [];
        const seen = new Set<string>();

        const add = (e: string, n: string, c?: string | null, p?: string | null) => {
            if (!e || seen.has(e.toLowerCase())) return;
            seen.add(e.toLowerCase());
            results.push({ 
                email: e.toLowerCase(), 
                name: n || "Recipient", 
                company: c || "No Company", 
                position: p || "No Position" 
            });
        };

        // 1. Manual Emails
        if (config.manual && Array.isArray(config.manual)) {
            config.manual.forEach((e: string) => add(e, "Recipient"));
        }

        // 1b. Segment-based customer recipients from customer segmentation
        if (config.segmentNames && Array.isArray(config.segmentNames) && config.segmentNames.length > 0) {
            const segmentRecipients = await getSegmentEmailRecipients(config.segmentNames);
            if (segmentRecipients.success) {
                segmentRecipients.data.forEach((recipient) =>
                    add(recipient.email, recipient.name, recipient.company, recipient.position)
                );
            }
        }

        // 2. System Users
        if (config.userIds && Array.isArray(config.userIds) && config.userIds.length > 0) {
            const users = await db.select({ email: user.email, name: user.name })
                .from(user)
                .where(inArray(user.id, config.userIds));
            // Users typically don't have company/position in this schema yet, or we'd join roles
            users.forEach(u => add(u.email, u.name));
        }

        // 3. Email Groups
        if (config.groupIds && Array.isArray(config.groupIds) && config.groupIds.length > 0) {
            const groupContacts = await db.select({ 
                email: emailContacts.email, 
                name: emailContacts.name,
                company: emailContacts.companyName,
                position: emailContacts.position
            })
                .from(emailGroupMembers)
                .innerJoin(emailContacts, eq(emailGroupMembers.contactId, emailContacts.id))
                .where(inArray(emailGroupMembers.groupId, config.groupIds));
            groupContacts.forEach(c => add(c.email, c.name, c.company, c.position));
        }

        // 4. Specific Contacts
        if (config.contactIds && Array.isArray(config.contactIds) && config.contactIds.length > 0) {
            const contacts = await db.select({ 
                email: emailContacts.email, 
                name: emailContacts.name,
                company: emailContacts.companyName,
                position: emailContacts.position
            })
                .from(emailContacts)
                .where(inArray(emailContacts.id, config.contactIds));
            contacts.forEach(c => add(c.email, c.name, c.company, c.position));
        }

        return results;
    } catch (e) {
        console.error("Resolve emails error:", e);
        return [];
    }
}

export async function getEmailTemplates() {
    await getAuthenticatedSession("marketing", "view");
    return await db.select().from(emailTemplates).where(eq(emailTemplates.isActive, true));
}

// ─── SEND CAMPAIGN ───────────────────────────────────────────────────────────

export async function sendCampaignNow(id: number) {
    try {
        await getAuthenticatedSession("marketing", "edit");

        const campaign = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, id)).then(r => r[0]);
        if (!campaign) return { success: false, error: "Campaign tidak ditemukan" };
        if (campaign.status === 'sent' || campaign.status === 'processing') {
            return { success: false, error: "Campaign sudah terkirim atau sedang diproses" };
        }

        // Mark as processing
        await db.update(marketingCampaigns)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(marketingCampaigns.id, id));

        // Resolve Recipients & CC
        const recipientList = await resolveEmails(campaign.targetConfig);
        const ccList = await resolveEmails(campaign.ccEmails);

        if (recipientList.length === 0) {
            await db.update(marketingCampaigns).set({ status: 'failed', updatedAt: new Date() }).where(eq(marketingCampaigns.id, id));
            return { success: false, error: "Penerima tidak ditemukan. Pilih setidaknya satu target." };
        }

        const attachments = await resolveCampaignAttachments(campaign.attachments)

        let successCount = 0;
        let failedCount = 0;
        const recipientLogs: any[] = [];

        // Send to each recipient
        for (const recipient of recipientList) {
            try {
                const htmlContent = campaign.content
                    .replace(/{{name}}/g, recipient.name)
                    .replace(/{{company}}/g, recipient.company)
                    .replace(/{{position}}/g, recipient.position);

                const result = await sendEmail({
                    to: recipient.email,
                    subject: campaign.subject,
                    html: htmlContent,
                    cc: ccList.length > 0 ? ccList.map(c => c.email).join(", ") : undefined,
                    attachments,
                })

                recipientLogs.push({
                    campaignId: id,
                    customerName: recipient.name,
                    email: recipient.email,
                    status: result.success ? "sent" : "failed",
                    errorMessage: result.error || null,
                });

                if (result.success) successCount++;
                else failedCount++;
            } catch (e) {
                failedCount++;
                recipientLogs.push({
                    campaignId: id,
                    customerName: recipient.name,
                    email: recipient.email,
                    status: "failed",
                    errorMessage: "Unexpected error",
                });
            }
        }

        // Batch insert recipient logs
        if (recipientLogs.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < recipientLogs.length; i += batchSize) {
                await db.insert(campaignRecipients).values(recipientLogs.slice(i, i + batchSize));
            }
        }

        // Update campaign status
        await db.update(marketingCampaigns)
            .set({
                status: 'sent',
                totalRecipients: recipientList.length,
                successCount,
                failureCount: failedCount,
                sentAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(marketingCampaigns.id, id));

        revalidatePath("/dashboard/marketing/campaigns");
        return { success: true, sent: successCount, failed: failedCount };

    } catch (error) {
        console.error("Send campaign error:", error);
        await db.update(marketingCampaigns).set({ status: 'failed', updatedAt: new Date() }).where(eq(marketingCampaigns.id, id));
        return { success: false, error: "Gagal mengirim campaign" };
    }
}
