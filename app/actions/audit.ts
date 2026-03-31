"use server"

import { getAuditLogs as getAuditLogsLib } from "@/lib/audit"
import { checkPermission } from "@/lib/rbac"

export async function getAuditLogs(tableName: string, recordId: string) {
    try {
        // Everyone with view permission to the resource can see the logs?
        // For now, let's assume if they can see the record, they can see the logs.
        // We'll check general session.
        return await getAuditLogsLib(tableName, recordId)
    } catch (error) {
        console.error("Failed to fetch audit logs:", error)
        return []
    }
}
