import { getLogisticsCosts } from "@/app/actions/delivery"
import { LogisticsCostTable } from "./_components/logistics-cost-table"
import { Truck } from "lucide-react"
import { PageHeader } from "@/components/page-header"

export default async function LogisticsCostsPage() {
    const data = await getLogisticsCosts()

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <PageHeader
                title="Logistics Cost Log"
                subtitle="Centralized log for all delivery and shipping related expenses."
                icon={Truck}
            />

            <div className="space-y-4">
                <LogisticsCostTable data={data} />
            </div>
        </div>
    )
}
