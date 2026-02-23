import { Suspense } from "react"
import { getActiveSessions } from "@/app/actions/security"
import { SessionsTable } from "./_components/sessions-table"

export default async function SessionsPage() {
    const sessions = await getActiveSessions()

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Active Sessions</h1>
                <p className="text-muted-foreground">
                    View and revoke active user sessions. Admins can see all sessions.
                </p>
            </div>
            <Suspense fallback={<div className="text-muted-foreground text-sm">Loading sessions…</div>}>
                <SessionsTable sessions={sessions} />
            </Suspense>
        </div>
    )
}
