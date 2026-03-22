import { getLogisticsCosts } from "@/app/actions/delivery"
import { getLatestSettlementByDeliveryIds } from "@/app/actions/cost-settlement"
import { LogisticsCostTable } from "./_components/logistics-cost-table"
import { Truck } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"

export default async function LogisticsCostsPage() {
    const data = await getLogisticsCosts()
    const settlementLookup = await getLatestSettlementByDeliveryIds(data.map((item) => item.id))
    const enrichedData = data.map((item) => {
        const settlement = settlementLookup[item.id]
        return {
            ...item,
            settlementId: settlement?.settlementId ?? null,
            settlementNumber: settlement?.settlementNumber ?? null,
            settlementStatus: settlement?.status ?? null,
        }
    })

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <AutoCloseSidebar />
            <PageHeader
                title="Logistics Cost Log"
                subtitle="Centralized log for all delivery and shipping related expenses."
                icon={Truck}
            />

            <div className="space-y-4">
                <LogisticsCostTable data={enrichedData} />
            </div>
        </div>
    )
}
