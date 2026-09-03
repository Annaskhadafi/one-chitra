import { getNoStockMonitoringData } from "@/app/actions/no-stock-monitoring"
import { NoStockMonitoringClient } from "./_components/no-stock-monitoring-client"

export const dynamic = "force-dynamic"

export default async function NoStockMonitoringPage() {
    const result = await getNoStockMonitoringData()
    return <NoStockMonitoringClient data={result.data} warning={result.warning} />
}
