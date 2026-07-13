import { getAuthenticatedSession } from "@/lib/rbac"
import { getPnlMonitoringBootstrap } from "@/app/actions/pnl-monitoring"
import { PnlMonitoringClient } from "./_components/pnl-monitoring-client"

export const metadata = {
    title: "P&L Monitoring",
}

export default async function PnlMonitoringPage() {
    await getAuthenticatedSession("marketing", "view")
    const bootstrap = await getPnlMonitoringBootstrap()

    return (
        <PnlMonitoringClient
            initialData={bootstrap.initialData}
            availableYears={bootstrap.availableYears}
            initialYear={bootstrap.initialYear}
        />
    )
}
