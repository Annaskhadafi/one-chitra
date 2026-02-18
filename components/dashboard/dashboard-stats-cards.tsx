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
            gradient: "from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-indigo-500/20 dark:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/20",
            iconBg: "bg-blue-500/10",
            iconColor: "text-blue-600 dark:text-blue-400",
            textColor: "text-blue-900 dark:text-blue-100",
        },
        {
            title: "Total Customers",
            value: stats.totalCustomers.toLocaleString(),
            description: "Registered customers",
            icon: Users,
            gradient: "from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20 dark:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20",
            iconBg: "bg-emerald-500/10",
            iconColor: "text-emerald-600 dark:text-emerald-400",
            textColor: "text-emerald-900 dark:text-emerald-100",
        },
        {
            title: "Quotations",
            value: stats.totalQuotations.toLocaleString(),
            description: `${stats.pendingQuotations} pending · ${stats.approvedQuotations} approved`,
            icon: FileText,
            gradient: "from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20 dark:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/20",
            iconBg: "bg-amber-500/10",
            iconColor: "text-amber-600 dark:text-amber-400",
            textColor: "text-amber-900 dark:text-amber-100",
        },
        {
            title: "Pending Deliveries",
            value: stats.pendingDeliveries.toLocaleString(),
            description: stats.pendingDeliveries > 0
                ? "Requires attention"
                : "All caught up",
            icon: Truck,
            gradient: stats.pendingDeliveries > 0
                ? "from-rose-500/10 via-rose-400/5 to-pink-500/10 border-rose-200/50 dark:from-rose-500/20 dark:via-rose-400/10 dark:to-pink-500/20 dark:border-rose-500/30 hover:shadow-lg hover:shadow-rose-500/20"
                : "from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20 dark:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/20",
            iconBg: stats.pendingDeliveries > 0 ? "bg-rose-500/10" : "bg-emerald-500/10",
            iconColor: stats.pendingDeliveries > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
            textColor: stats.pendingDeliveries > 0 ? "text-rose-900 dark:text-rose-100" : "text-emerald-900 dark:text-emerald-100",
        },
    ]

    return (
        <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4">
            {cards.map((card) => (
                <Card key={card.title} className={`relative overflow-hidden bg-gradient-to-br ${card.gradient} transition-all duration-300`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardDescription className={`text-sm font-medium ${card.textColor}`}>
                            {card.title}
                        </CardDescription>
                        <div className={`rounded-lg p-2 ${card.iconBg}`}>
                            <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                        </div>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1">
                        <CardTitle className={`text-2xl font-bold tabular-nums ${card.textColor}`}>
                            {card.value}
                        </CardTitle>
                        <p className={`text-xs ${card.textColor} opacity-70`}>
                            {card.description}
                        </p>
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}
