"use server"

import { db } from "@/db"
import { marketingCampaigns, customers } from "@/db/schema"
import { eq, desc, isNotNull, like, and } from "drizzle-orm"
import { getAuthenticatedSession } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { z } from "zod"

const campaignSchema = z.object({
    name: z.string().min(3),
    subject: z.string().min(3),
    content: z.string().min(10),
    segmentCriteria: z.string().optional(), // "all" or "city:Jakarta" etc.
    scheduledAt: z.string().optional(), // ISO string
})

export async function getCampaigns() {
    await getAuthenticatedSession("marketing", "view");
    return await db.select().from(marketingCampaigns).orderBy(desc(marketingCampaigns.createdAt));
}

export async function getCampaign(id: number) {
    await getAuthenticatedSession("marketing", "view");
    const res = await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.id, id));
    return res[0];
}

export async function createCampaign(data: z.infer<typeof campaignSchema>) {
    try {
        const session = await getAuthenticatedSession("marketing", "create");

        await db.insert(marketingCampaigns).values({
            name: data.name,
            subject: data.subject,
            content: data.content,
            segmentCriteria: data.segmentCriteria || "all",
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
            createdBy: session.user.id,
            status: "draft",
        });

        revalidatePath("/dashboard/marketing/campaigns");
        return { success: true };
    } catch (error) {
        console.error("Create campaign error:", error);
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
                segmentCriteria: data.segmentCriteria,
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

export async function sendCampaignNow(id: number) {
    try {
        await getAuthenticatedSession("marketing", "edit");

        const campaign = await getCampaign(id);
        if (!campaign) return { success: false, error: "Campaign not found" };
        if (campaign.status === 'sent' || campaign.status === 'processing') {
            return { success: false, error: "Campaign already sent or processing" };
        }

        // 1. Mark as processing
        await db.update(marketingCampaigns)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(marketingCampaigns.id, id));

        // 2. Fetch recipients based on segment
        let recipientsQuery = db.select().from(customers).where(isNotNull(customers.email));

        if (campaign.segmentCriteria && campaign.segmentCriteria !== "all") {
            if (campaign.segmentCriteria.startsWith("city:")) {
                const city = campaign.segmentCriteria.split(":")[1];
                recipientsQuery = db.select().from(customers).where(
                    and(
                        isNotNull(customers.email),
                        like(customers.address1, `%${city}%`)
                    )
                );
            }
        }

        const recipients = await recipientsQuery;
        const recipientList = recipients.map(c => ({ email: c.email!, name: c.name }));

        if (recipientList.length === 0) {
            await db.update(marketingCampaigns)
                .set({ status: 'failed', failureCount: 0, successCount: 0, updatedAt: new Date() })
                .where(eq(marketingCampaigns.id, id));
            return { success: false, error: "No recipients found for this segment" };
        }

        // 3. Send Emails (Batch processing simulation)
        // In production, this should be a background job (BullMQ/Redis)
        let success = 0;
        let failed = 0;

        // Send sequentially to avoid rate limits in this simple implementation
        for (const recipient of recipientList) {
            try {
                const result = await sendEmail({
                    to: recipient.email,
                    subject: campaign.subject,
                    html: campaign.content.replace("{{name}}", recipient.name),
                });

                if (result.success) success++;
                else failed++;
            } catch (e) {
                failed++;
            }
        }

        // 4. Update Campaign Status
        await db.update(marketingCampaigns)
            .set({
                status: 'sent',
                totalRecipients: recipientList.length,
                successCount: success,
                failureCount: failed,
                updatedAt: new Date()
            })
            .where(eq(marketingCampaigns.id, id));

        revalidatePath("/dashboard/marketing/campaigns");
        return { success: true, sent: success, failed };

    } catch (error) {
        console.error("Send campaign error:", error);
        return { success: false, error: "Failed to send campaign" };
    }
}
