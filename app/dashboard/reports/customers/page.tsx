import { getCustomerReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPICard, ReportKPIGrid, ExportButton } from "@/components/reports/report-components"
import { ReportBarChart, ReportPieChart, FunnelChart } from "@/components/reports/report-charts"
import { Users, TrendingUp, RefreshCw, Star, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function CustomerReportPage() {
    const data = await getCustomerReport()

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        {
            title: "Total Customers",
            value: data.repeatPurchaseRate.totalCustomers.toLocaleString(),
            icon: "users" as const,
            variant: "default" as const,
        },
        {
            title: "New Customers (This Month)",
            value: data.customerGrowth[data.customerGrowth.length - 1]?.newCustomers || 0,
            change: data.customerGrowth.length > 1
                ? (() => {
                    const current = data.customerGrowth[data.customerGrowth.length - 1].newCustomers
                    const prev = data.customerGrowth[data.customerGrowth.length - 2].newCustomers
                    return prev > 0 ? ((current - prev) / prev) * 100 : 0
                })()
                : 0,
            changeLabel: "vs prev month",
            icon: "trendingUp" as const,
            variant: "success" as const,
        },
        {
            title: "Repeat Purchase Rate",
            value: `${data.repeatPurchaseRate.repeatRate.toFixed(1)}%`,
            icon: "repeat" as const,
            variant: data.repeatPurchaseRate.repeatRate > 20 ? "success" : "warning",
        },
        {
            title: "Average Orders per Customer",
            value: data.repeatPurchaseRate.averageOrdersPerCustomer.toFixed(1),
            icon: "star" as const,
            variant: "default" as const,
        },
    ]

    const segmentationData = data.customerSegmentation.map(s => ({
        name: s.segment,
        value: s.count,
    }))

    const topCustomersChartData = data.topCustomers.slice(0, 10).map(c => ({
        name: c.customerName,
        value: c.totalRevenue,
    }))

    const growthData = data.customerGrowth.map(g => ({
        name: new Date(g.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: g.newCustomers,
        secondary: g.cumulativeCustomers,
    }))

    const funnelData = [
        { stage: "Total Customers", value: data.repeatPurchaseRate.totalCustomers },
        { stage: "1+ Orders", value: data.repeatPurchaseRate.totalCustomers }, // Assuming all have 1+ order based on report
        { stage: "Repeat Customers", value: data.repeatPurchaseRate.repeatCustomers },
    ]

    return (
        <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {/* Header with Back Button */}
                <div className="px-4 lg:px-6 flex items-center gap-4">
                    <Link href="/dashboard/reports" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Reports
                    </Link>
                </div>

                <div className="px-4 lg:px-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Customer Report</h1>
                        <p className="text-muted-foreground">
                            Customer segmentation, retention, and growth
                        </p>
                    </div>
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <ReportPieChart
                        data={segmentationData}
                        title="Customer Segmentation"
                        description="Distribution based on lifetime value"
                        height={350}
                        variant="pie"
                    />
                    <FunnelChart
                        data={funnelData}
                        title="Repeat Purchase Funnel"
                        description="Conversion from first-time to repeat customers"
                    />
                </div>

                {/* Customer Growth & Top Customers Bar */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <ReportBarChart
                        data={growthData}
                        title="Customer Growth"
                        description="New customers per month vs cumulative"
                        height={350}
                        colors={["hsl(199, 89%, 48%)", "hsl(217, 91%, 60%)"]}
                    />
                    <ReportBarChart
                        data={topCustomersChartData}
                        title="Top Customers by Revenue"
                        description="Top 10 customers based on lifetime revenue"
                        height={350}
                    />
                </div>

                {/* Top Customers Leaderboard Table */}
                <div className="px-4 lg:px-6 mb-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Top Customers Leaderboard</CardTitle>
                                    <CardDescription>Highest value customers sorted by total revenue</CardDescription>
                                </div>
                                <ExportButton data={data.topCustomers} filename="top-customers" format="csv" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left py-3 px-4 font-medium">Rank</th>
                                            <th className="text-left py-3 px-4 font-medium">Customer</th>
                                            <th className="text-left py-3 px-4 font-medium">Code</th>
                                            <th className="text-right py-3 px-4 font-medium">Total Orders</th>
                                            <th className="text-right py-3 px-4 font-medium">Avg Order Value</th>
                                            <th className="text-right py-3 px-4 font-medium">Total Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.topCustomers.slice(0, 15).map((customer, i) => (
                                            <tr key={customer.customerId} className="border-b hover:bg-muted/30">
                                                <td className="py-3 px-4">
                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-primary/10 text-primary"}`}>
                                                        {i + 1}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-medium">{customer.customerName}</td>
                                                <td className="py-3 px-4 text-muted-foreground">{customer.customerCode}</td>
                                                <td className="py-3 px-4 text-right tabular-nums">{customer.totalOrders}</td>
                                                <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(customer.averageOrderValue)}</td>
                                                <td className="py-3 px-4 text-right tabular-nums font-bold text-emerald-600">
                                                    {formatCurrency(customer.totalRevenue)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function formatCurrency(val: number): string {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}B`
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`
    return `Rp ${val.toLocaleString()}`
}
