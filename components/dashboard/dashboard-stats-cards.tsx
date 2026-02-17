import { Package, Users, FileText, Truck } from "lucide-react"
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { DashboardStats } from "@/app/actions/dashboard"

export function DashboardStatsCards({ stats }: { stats: DashboardStats }) {
    const cards = [
        {
            title: "Total Products",
            value: stats.totalProducts.toLocaleString(),
            description: `${stats.categoryDistribution.length} categories`,
            icon: Package,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
        },
        {
            title: "Total Customers",
            value: stats.totalCustomers.toLocaleString(),
            description: "Registered customers",
            icon: Users,
            color: "text-emerald-500",
            bgColor: "bg-emerald-500/10",
        },
        {
            title: "Quotations",
            value: stats.totalQuotations.toLocaleString(),
            description: `${stats.pendingQuotations} pending · ${stats.approvedQuotations} approved`,
            icon: FileText,
            color: "text-amber-500",
            bgColor: "bg-amber-500/10",
        },
        {
            title: "Pending Deliveries",
            value: stats.pendingDeliveries.toLocaleString(),
            description: stats.pendingDeliveries > 0
                ? "Requires attention"
                : "All caught up",
            icon: Truck,
            color: stats.pendingDeliveries > 0 ? "text-rose-500" : "text-emerald-500",
            bgColor: stats.pendingDeliveries > 0 ? "bg-rose-500/10" : "bg-emerald-500/10",
        },
    ]

    return (
        <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
            {cards.map((card) => (
                <Card key={card.title} className="relative overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardDescription className="text-sm font-medium">
                            {card.title}
                        </CardDescription>
                        <div className={`rounded-lg p-2 ${card.bgColor}`}>
                            <card.icon className={`h-4 w-4 ${card.color}`} />
                        </div>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1">
                        <CardTitle className="text-2xl font-bold tabular-nums">
                            {card.value}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            {card.description}
                        </p>
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}
