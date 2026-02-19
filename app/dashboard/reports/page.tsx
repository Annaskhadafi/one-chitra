import { getDashboardStats } from "@/app/actions/dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, TrendingUp, Users, Truck, ShoppingCart, Warehouse, ArrowRight } from "lucide-react"
import Link from "next/link"

const reportCards = [
    {
        title: "Inventory Report",
        description: "Stock levels, movements, and alerts",
        icon: Package,
        href: "/dashboard/reports/inventory",
        color: "from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50 dark:from-blue-500/20 dark:via-blue-400/10 dark:to-indigo-500/20",
        iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
        title: "Sales Report",
        description: "Sales trends, analysis, and forecasts",
        icon: TrendingUp,
        href: "/dashboard/reports/sales",
        color: "from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-teal-500/20",
        iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
        title: "Customer Report",
        description: "Customer segmentation and behavior",
        icon: Users,
        href: "/dashboard/reports/customers",
        color: "from-violet-500/10 via-violet-400/5 to-purple-500/10 border-violet-200/50 dark:from-violet-500/20 dark:via-violet-400/10 dark:to-purple-500/20",
        iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
        title: "Order Fulfillment",
        description: "Order status and delivery performance",
        icon: Truck,
        href: "/dashboard/reports/orders",
        color: "from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 dark:from-amber-500/20 dark:via-amber-400/10 dark:to-orange-500/20",
        iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
        title: "Product Performance",
        description: "Best sellers and product analytics",
        icon: ShoppingCart,
        href: "/dashboard/reports/products",
        color: "from-rose-500/10 via-rose-400/5 to-pink-500/10 border-rose-200/50 dark:from-rose-500/20 dark:via-rose-400/10 dark:to-pink-500/20",
        iconColor: "text-rose-600 dark:text-rose-400",
    },
    {
        title: "Warehouse & Logistics",
        description: "Warehouse capacity and shipping",
        icon: Warehouse,
        href: "/dashboard/reports/warehouse",
        color: "from-cyan-500/10 via-cyan-400/5 to-sky-500/10 border-cyan-200/50 dark:from-cyan-500/20 dark:via-cyan-400/10 dark:to-sky-500/20",
        iconColor: "text-cyan-600 dark:text-cyan-400",
    },
]

export default async function ReportsHubPage() {
    const dashboardStats = await getDashboardStats()
    const latestSales = dashboardStats.monthlySales.length > 0
        ? dashboardStats.monthlySales[dashboardStats.monthlySales.length - 1].value
        : 0

    const quickStats = [
        {
            label: "Low Stock Items",
            value: dashboardStats.lowStockItems,
            trend: dashboardStats.lowStockItems > 10 ? "high" : "normal",
        },
        {
            label: "Monthly Sales",
            value: `Rp ${(latestSales / 1_000_000).toFixed(1)}M`,
            trend: "normal",
        },
        {
            label: "Total Customers",
            value: dashboardStats.totalCustomers,
            trend: "normal",
        },
        {
            label: "Pending Deliveries",
            value: dashboardStats.pendingDeliveries,
            trend: dashboardStats.pendingDeliveries > 5 ? "warning" : "good",
        },
    ]

    return (
        <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {/* Header */}
                <div className="px-4 lg:px-6">
                    <h1 className="text-2xl font-bold tracking-tight">Reports Hub</h1>
                    <p className="text-muted-foreground">
                        Comprehensive analytics and insights for your business
                    </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
                    {quickStats.map((stat) => (
                        <Card key={stat.label}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stat.value}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Report Cards */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 xl:grid-cols-3 lg:px-6">
                    {reportCards.map((report) => {
                        const Icon = report.icon
                        return (
                            <Link key={report.title} href={report.href}>
                                <Card className={`h-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-gradient-to-br ${report.color} border-2`}>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div className={`rounded-lg p-3 bg-white/80 dark:bg-slate-800/80 shadow-sm`}>
                                                <Icon className={`h-6 w-6 ${report.iconColor}`} />
                                            </div>
                                            <ArrowRight className={`h-5 w-5 ${report.iconColor} opacity-0 group-hover:opacity-100 transition-opacity`} />
                                        </div>
                                        <CardTitle className="mt-4">{report.title}</CardTitle>
                                        <CardDescription>{report.description}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className={`text-sm ${report.iconColor} font-medium`}>
                                            View Report →
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
