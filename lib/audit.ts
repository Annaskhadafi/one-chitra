import { db } from "@/db";
import { auditLogs, user } from "@/db/schema";
import { getAuthenticatedSession } from "./rbac";
import { eq, desc, and } from "drizzle-orm";

export async function recordActivity({
    action,
    tableName,
    recordId,
    description,
}: {
    action: string;
    tableName?: string;
    recordId?: string;
    description?: string;
}) {
    try {
        const session = await getAuthenticatedSession();
        if (!session?.user?.id) return;

        await db.insert(auditLogs).values({
            userId: session.user.id,
            action,
            tableName,
            recordId,
            description,
            createdAt: new Date(),
        });
    } catch (error) {
        console.error("Failed to record activity log:", error);
    }
}

export async function getAuditLogs(tableName: string, recordId: string) {
    return await db.query.auditLogs.findMany({
        where: and(
            eq(auditLogs.tableName, tableName),
            eq(auditLogs.recordId, recordId)
        ),
        with: {
            user: true,
        },
        orderBy: [desc(auditLogs.createdAt)],
    });
}
