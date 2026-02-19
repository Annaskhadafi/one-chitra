import { getCustomerReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPICard, ReportKPIGrid, ExportButton, ProgressBar } from "@/components/reports/report-components"
import { ReportPieChart, ReportBarChart, FunnelChart, CustomerGrowthChart } from "@/components/reports/report-charts"
import { Users, UserPlus, TrendingUp, UserCheck, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function CustomerReportPage() {
    const data = await getCustomerReport()

    const activeCustomers = data.customerActivity.find(a => a.status === "Active")?.count ?? 0
    const totalCustomers = data.repeatPurchaseRate.totalCustomers

    const kpis = [
        {
            title: "Total Customers",
            value: totalCustomers.toLocaleString(),
            change: 5.2,
            changeLabel: "vs last month",
            icon: Users,
            variant: "default" as const,
        },
        {
            title: "Active Customers",
            value: activeCustomers.toLocaleString(),
            change: (activeCustomers / totalCustomers) * 100,
            changeLabel: "of total",
            icon: UserCheck,
            variant: "success" as const,
        },
        {
            title: "Repeat Rate",
            value: `${data.repeatPurchaseRate.repeatRate.toFixed(1)}%`,
            change: data.repeatPurchaseRate.repeatRate > 50 ? 10 : -5,
            changeLabel: data.repeatPurchaseRate.repeatRate > 50 ? "healthy" : "needs improvement",
            icon: TrendingUp,
            variant: data.repeatPurchaseRate.repeatRate > 50 ? "success" : "warning" as const,
        },
        {
            title: "Avg Orders/Customer",
            value: data.repeatPurchaseRate.averageOrdersPerCustomer.toFixed(1),
            icon: Users,
            variant: "default" as const,
        },
    ]

    const segmentationData = data.customerSegmentation.map(s => ({
        name: s.segment,
        value: s.count,
    }))

    const topCustomersData = data.topCustomers.slice(0, 12).map(c => ({
        name: c.customerName.length > 20 ? c.customerName.substring(0, 20) + "..." : c.customerName,
        value: c.totalRevenue,
    }))

    const growthData = data.customerGrowth.map(g => ({
        name: new Date(g.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: g.newCustomers,
    }))

    const activityData = data.customerActivity.map(a => ({
        name: a.status,
        value: a.count,
    }))

    const funnelData = [
        { stage: "Total Customers", value: totalCustomers, color: "hsl(217, 91%, 60%)" },
        { stage: "Active (30 days)", value: activeCustomers, color: "hsl(160, 84%, 39%)" },
        { stage: "Repeat Customers", value: data.repeatPurchaseRate.repeatCustomers, color: "hsl(199, 89%, 48%)" },
        { stage: "VIP Customers", value: data.customerSegmentation.find(s => s.segment === "VIP")?.count ?? 0, color: "hsl(271, 76%, 53%)" },
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
                            Customer segmentation, behavior, and growth analytics
                        </p>
                    </div>
                    <ExportButton data={data.topCustomers} filename="top-customers" format="csv" />
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Customer Segmentation & Activity */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Customer Growth Trend</CardTitle>
                                <CardDescription>
                                    New customer acquisition over the last 12 months
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {growthData.length === 0 ? (
                                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                        No growth data available
                                    </div>
                                ) : (
                                    <div className="h-[300px]">
                                        <CustomerGrowthChart data={data.customerGrowth} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <div>
                        <ReportPieChart
                            data={segmentationData}
                            title="Customer Segmentation"
                            description="Distribution by revenue tier"
                            height={300}
                            variant="donut"
                        />
                    </div>
                </div>

                {/* Activity & Funnel */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <ReportPieChart
                        data={activityData}
                        title="Customer Activity Status"
                        description="Based on last order date"
                        height={300}
                        variant="pie"
                    />
                    <FunnelChart
                        data={funnelData}
                        title="Customer Journey Funnel"
                        description="From total to VIP customers"
                    />
                </div>

                {/* Top Customers Table */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Top 20 Customers</CardTitle>
                                    <CardDescription>
                                        Ranked by total revenue generated
                                    </CardDescription>
                                </div>
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
                                            <th className="text-right py-3 px-4 font-medium">Orders</th>
                                            <th className="text-right py-3 px-4 font-medium">Total Revenue</th>
                                            <th className="text-right py-3 px-4 font-medium">Avg Order</th>
                                            <th className="text-right py-3 px-4 font-medium">Last Order</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.topCustomers.slice(0, 20).map((customer, index) => (
                                            <tr key={customer.customerId} className="border-b hover:bg-muted/30">
                                                <td className="py-3 px-4">
                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${
                                                        index < 3
                                                            ? "bg-amber-500/10 text-amber-600"
                                                            : "bg-primary/10 text-primary"
                                                    }`}>
                                                        {index < 3 ? "👑" : index + 1}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-medium">{customer.customerName}</td>
                                                <td className="py-3 px-4 text-muted-foreground">{customer.customerCode}</td>
                                                <td className="py-3 px-4 text-right tabular-nums">{customer.totalOrders.toLocaleString()}</td>
                                                <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-600">
                                                    {formatCurrency(customer.totalRevenue)}
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                                                    {formatCurrency(customer.averageOrderValue)}
                                                </td>
                                                <td className="py-3 px-4 text-right text-sm text-muted-foreground">
                                                    {customer.lastOrderDate
                                                        ? new Date(customer.lastOrderDate).toLocaleDateString("en-US", {
                                                              month: "short",
                                                              day: "numeric",
                                                              year: "numeric"
                                                          })
                                                        : "N/A"
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Segment Details */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
                    {data.customerSegmentation.map((segment) => (
                        <Card key={segment.segment}>
                            <CardHeader>
                                <CardTitle className="text-base">{segment.segment} Customers</CardTitle>
                                <CardDescription>
                                    {segment.percentage.toFixed(1)}% of total
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-3xl font-bold">{segment.count.toLocaleString()}</p>
                                    <p className="text-sm text-muted-foreground">customers</p>
                                </div>
                                <ProgressBar
                                    value={segment.count}
                                    max={data.customerSegmentation.reduce((sum, s) => sum + s.count, 0)}
                                    showValue={false}
                                />
                                <div className="pt-2 border-t">
                                    <p className="text-xs text-muted-foreground">Total Revenue</p>
                                    <p className="text-lg font-semibold text-emerald-600">
                                        {formatCurrency(segment.totalRevenue)}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Repeat Purchase Analysis */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Repeat Purchase Analysis</CardTitle>
                            <CardDescription>
                                Customer loyalty and retention metrics
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="text-center p-4 rounded-lg bg-muted/30">
                                    <p className="text-3xl font-bold text-primary">
                                        {data.repeatPurchaseRate.repeatCustomers.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">Repeat Customers</p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-muted/30">
                                    <p className="text-3xl font-bold text-muted-foreground">
                                        {data.repeatPurchaseRate.oneTimeCustomers.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">One-Time Customers</p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-muted/30">
                                    <p className="text-3xl font-bold text-emerald-600">
                                        {data.repeatPurchaseRate.repeatRate.toFixed(1)}%
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">Repeat Rate</p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-muted/30">
                                    <p className="text-3xl font-bold text-amber-600">
                                        {data.repeatPurchaseRate.averageOrdersPerCustomer.toFixed(2)}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">Avg Orders/Customer</p>
                                </div>
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
