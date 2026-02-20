import { getDeliveries } from "@/app/actions/delivery"
import { DoMonitoringTable } from "./_components/do-monitoring-table"
import { Truck, Clock, CheckCircle } from "lucide-react"
import { ScoreCard } from "@/components/score-card"

export default async function DoMonitoringPage() {
    const deliveriesData = await getDeliveries()

    const pendingCount = deliveriesData.filter(d => d.doStatus === 'Pending' || !d.doStatus).length
    const returnedCount = deliveriesData.filter(d => d.doStatus === 'Returned').length

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">DO Monitoring</h1>
                    <p className="text-muted-foreground">
                        Monitor returned Delivery Orders and invoice details.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard
                    title="Total Deliveries"
                    value={deliveriesData.length}
                    icon={Truck}
                    description="All deliveries"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50"
                    iconColor="text-blue-600 dark:text-blue-400"
                    textColor="text-blue-900 dark:text-blue-100"
                />
                <ScoreCard
                    title="Pending Return"
                    value={pendingCount}
                    icon={Clock}
                    description="Waiting for DO to return"
                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50"
                    iconColor="text-amber-600 dark:text-amber-400"
                    textColor="text-amber-900 dark:text-amber-100"
                />
                <ScoreCard
                    title="DO Returned"
                    value={returnedCount}
                    icon={CheckCircle}
                    description="DO received back"
                    gradient="from-green-500/10 via-green-400/5 to-emerald-500/10 border-green-200/50"
                    iconColor="text-green-600 dark:text-green-400"
                    textColor="text-green-900 dark:text-green-100"
                />
            </div>

            <div className="flex-1">
                <DoMonitoringTable data={deliveriesData as any} />
            </div>
        </div>
    )
}
