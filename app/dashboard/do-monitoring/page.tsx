import { getDoMonitoringDeliveries } from "@/app/actions/delivery"
import { DoMonitoringTable, type DeliveryWithRelations } from "./_components/do-monitoring-table"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"
import { Providers } from "@/components/providers"

export default async function DoMonitoringPage() {
    const deliveriesData = await getDoMonitoringDeliveries()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <AutoCloseSidebar />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">DO Monitoring</h1>
                    <p className="text-muted-foreground">
                        Monitor returned Delivery Orders and invoice details.
                    </p>
                </div>
            </div>

            <div className="flex-1">
                <Providers>
                    <DoMonitoringTable data={deliveriesData as DeliveryWithRelations[]} />
                </Providers>
            </div>
        </div>
    )
}
