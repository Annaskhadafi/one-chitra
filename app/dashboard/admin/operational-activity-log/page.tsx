import { getOperationalActivityLogs } from "@/app/actions/security"
import { OperationalActivityLogTable } from "./_components/operational-activity-log-table"

interface SearchParams {
    page?: string
    action?: string
    userId?: string
}

export default async function OperationalActivityLogPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>
}) {
    const params = await searchParams
    const page = Number.parseInt(params.page ?? "1", 10)
    const action = params.action ?? ""
    const userId = params.userId ?? ""

    const result = await getOperationalActivityLogs({
        page: Number.isFinite(page) ? page : 1,
        pageSize: 50,
        action: action || undefined,
        userId: userId || undefined,
    })

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Operational Activity Log</h1>
                <p className="text-muted-foreground">
                    Unified activity log for Sales Order, Delivery / DO, and DO Monitoring operations.
                </p>
            </div>
            <OperationalActivityLogTable
                logs={result.logs}
                total={result.total}
                page={result.page}
                totalPages={result.totalPages}
                currentAction={action}
                currentUserId={userId}
            />
        </div>
    )
}
