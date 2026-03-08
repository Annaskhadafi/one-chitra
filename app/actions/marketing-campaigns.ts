"use server"

import { db } from "@/db"
import { marketingCampaigns, campaignRecipients, customers } from "@/db/schema"
import { eq, desc, isNotNull, like, and, sql, count, or, lte } from "drizzle-orm"
import { getAuthenticatedSession } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { z } from "zod"

const campaignSchema = z.object({
    name: z.string().min(3),
    subject: z.string().min(3),
    content: z.string().min(10),
    description: z.string().optional(),
    segmentCriteria: z.string().optional(), // JSON string e.g. {"type":"all"} or {"type":"rfm_segment","segment":"Champions"}
    ccEmails: z.string().optional(), // JSON array string e.g. ["a@b.com","c@d.com"]
    scheduledAt: z.string().optional(), // ISO string
})

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
            segmentCriteria: data.segmentCriteria || '{"type":"all"}',
            ccEmails: data.ccEmails || null,
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

        await db.update(marketingCampaigns)
            .set({
                name: data.name,
                subject: data.subject,
                content: data.content,
                description: data.description || null,
                segmentCriteria: data.segmentCriteria,
                ccEmails: data.ccEmails || null,
                scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
                updatedAt: new Date(),
            })
            .where(eq(marketingCampaigns.id, id));

        revalidatePath("/dashboard/marketing/campaigns");
        return { success: true };
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
        const original = await getCampaign(id);
        if (!original) return { success: false, error: "Campaign not found" };

        await db.insert(marketingCampaigns).values({
            name: `${original.name} (copy)`,
            subject: original.subject,
            content: original.content,
            description: original.description,
            segmentCriteria: original.segmentCriteria,
            ccEmails: original.ccEmails,
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

// ─── SEND CAMPAIGN ───────────────────────────────────────────────────────────

export async function sendCampaignNow(id: number) {
    try {
        await getAuthenticatedSession("marketing", "edit");

        const campaign = await getCampaign(id);
        if (!campaign) return { success: false, error: "Campaign not found" };
        if (campaign.status === 'sent' || campaign.status === 'processing') {
            return { success: false, error: "Campaign already sent or processing" };
        }

        // Mark as processing
        await db.update(marketingCampaigns)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(marketingCampaigns.id, id));

        // Parse segment criteria
        let criteria: Record<string, string> = { type: "all" };
        try {
            criteria = JSON.parse(campaign.segmentCriteria || '{"type":"all"}');
        } catch { /* use default */ }

        // Parse CC emails
        let ccList: string[] = [];
        try {
            ccList = JSON.parse(campaign.ccEmails || '[]');
        } catch { /* no CC */ }

        // Build recipients query
        const baseCondition = isNotNull(customers.email);
        let recipientList: { email: string, name: string }[] = [];

        if (criteria.type === "custom") {
            const emails = Array.isArray(criteria.emails) ? criteria.emails : [];
            recipientList = emails.map((e: string) => ({ email: e, name: "Pelanggan" }));
        } else {
            let recipientsData;
            if (criteria.type === "city") {
                recipientsData = await db.select()
                    .from(customers)
                    .where(and(baseCondition, like(customers.address1, `%${criteria.city}%`)));
            } else {
                recipientsData = await db.select()
                    .from(customers)
                    .where(baseCondition);
            }
            recipientList = recipientsData.map(c => ({ email: c.email!, name: c.name || "Pelanggan" }));
        }

        if (recipientList.length === 0) {
            await db.update(marketingCampaigns)
                .set({ status: 'failed', updatedAt: new Date() })
                .where(eq(marketingCampaigns.id, id));
            return { success: false, error: criteria.type === "custom" ? "Custom email kosong." : "Data email pelanggan (kolom email di database) masih kosong untuk segmen ini!" };
        }

        let successCount = 0;
        let failedCount = 0;
        const recipientLogs: typeof campaignRecipients.$inferInsert[] = [];

        // Send to each recipient
        for (const recipient of recipientList) {
            try {
                const result = await sendEmail({
                    to: recipient.email,
                    subject: campaign.subject,
                    html: campaign.content.replace(/{{name}}/g, recipient.name),
                    ...(ccList.length > 0 ? { cc: ccList.join(", ") } as any : {}),
                });

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
        await db.update(marketingCampaigns)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(marketingCampaigns.id, id));
        return { success: false, error: "Failed to send campaign" };
    }
}
