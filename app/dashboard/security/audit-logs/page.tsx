import { getAuditLogs } from "@/app/actions/security"
import { AuditLogTable } from "./_components/audit-log-table"

interface SearchParams {
    page?: string
    action?: string
    userId?: string
    description?: string
}

export default async function AuditLogsPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>
}) {
    const params = await searchParams
    const page = parseInt(params.page ?? "1", 10)
    const action = params.action ?? ""
    const userId = params.userId ?? ""
    const description = params.description ?? ""

    const result = await getAuditLogs({ page, pageSize: 50, action: action || undefined, userId: userId || undefined, description: description || undefined })

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
                <p className="text-muted-foreground">
                    Track all security and system events across the application.
                </p>
            </div>
            <AuditLogTable
                logs={result.logs}
                total={result.total}
                page={result.page}
                totalPages={result.totalPages}
                pageSize={result.pageSize}
                currentAction={action}
                currentUserId={userId}
                currentDescription={description}
            />
        </div>
    )
}
