import { getSalesReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPICard, ReportKPIGrid, ExportButton } from "@/components/reports/report-components"
import { SalesTrendChart, ReportBarChart, ReportPieChart, LineComparisonChart, GaugeChart } from "@/components/reports/report-charts"
import { TrendingUp, DollarSign, Users, Target, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function SalesReportPage() {
    const data = await getSalesReport()

    const totalSales = data.salesTrend.reduce((sum: number, d) => sum + d.sales, 0)
    const totalOrders = data.salesTrend.reduce((sum: number, d) => sum + d.orders, 0)
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0

    // Calculate growth from sales trend
    const recentSales = data.salesTrend.slice(-7).reduce((sum: number, d) => sum + d.sales, 0)
    const previousSales = data.salesTrend.slice(-14, -7).reduce((sum: number, d) => sum + d.sales, 0)
    const growthRate = previousSales > 0 ? ((recentSales - previousSales) / previousSales) * 100 : 0

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        {
            title: "Total Revenue",
            value: formatCurrency(totalSales),
            change: growthRate,
            changeLabel: "vs previous period",
            icon: "dollar",
            variant: "success" as const,
        },
        {
            title: "Total Orders",
            value: totalOrders.toLocaleString(),
            change: 8.5,
            changeLabel: "vs previous period",
            icon: "users",
            variant: "default",
        },
        {
            title: "Avg Order Value",
            value: formatCurrency(avgOrderValue),
            change: 3.2,
            changeLabel: "vs previous period",
            icon: "trendingUp",
            variant: "default",
        },
        {
            title: "Monthly Target",
            value: `${data.salesTarget.percentage.toFixed(1)}%`,
            icon: "target",
            variant: data.salesTarget.percentage >= 80 ? "success" : data.salesTarget.percentage >= 50 ? "warning" : "danger",
        },
    ]

    const salesTrendData = data.salesTrend.slice(-30).map(d => ({
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        sales: d.sales,
        orders: d.orders,
    }))

    const salesByCustomerData = data.salesByCustomer.slice(0, 15).map(c => ({
        name: c.customerName.length > 20 ? c.customerName.substring(0, 20) + "..." : c.customerName,
        value: c.totalSales,
    }))

    const salesByCategoryData = data.salesByCategory.map(c => ({
        name: c.category,
        value: c.totalSales,
    }))

    const monthlyComparisonData = data.monthlyComparison.slice(-6).map(m => ({
        name: new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        current: m.currentYear,
        previous: m.previousYear,
    }))

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
                        <h1 className="text-2xl font-bold tracking-tight">Sales Report</h1>
                        <p className="text-muted-foreground">
                            Sales performance, trends, and analysis
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <ExportButton data={data.salesByCustomer} filename="sales-by-customer" format="csv" />
                        <ExportButton data={data.salesByCategory} filename="sales-by-category" format="csv" />
                    </div>
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Sales Trend & Target */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
                    <div className="lg:col-span-2">
                        <SalesTrendChart
                            data={salesTrendData.map(d => ({ date: d.date, sales: d.sales }))}
                            title="Sales Trend (Last 30 Days)"
                            description="Daily sales performance"
                            height={300}
                        />
                    </div>
                    <div>
                        <GaugeChart
                            value={data.salesTarget.actual}
                            max={data.salesTarget.target}
                            title="Monthly Sales Target"
                            description={`Target: ${formatCurrency(data.salesTarget.target)}`}
                            label={`${formatCurrency(data.salesTarget.actual)} achieved`}
                        />
                    </div>
                </div>

                {/* Sales by Customer & Category */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <ReportBarChart
                        data={salesByCustomerData}
                        title="Top Customers by Revenue"
                        description="Leading customers based on total sales"
                        height={350}
                        colors={["hsl(217, 91%, 60%)"]}
                    />
                    <ReportPieChart
                        data={salesByCategoryData}
                        title="Sales by Product Category"
                        description="Revenue distribution across categories"
                        height={350}
                        variant="donut"
                    />
                </div>

                {/* Monthly Comparison */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Monthly Comparison (YoY)</CardTitle>
                            <CardDescription>
                                Current year vs Previous year performance
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {monthlyComparisonData.length === 0 ? (
                                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                    No comparison data available
                                </div>
                            ) : (
                                <div className="h-[300px]">
                                    <LineComparisonChart
                                        data={monthlyComparisonData}
                                        title=""
                                        description=""
                                        height={300}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Top Customers Table */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Top 20 Customers</CardTitle>
                            <CardDescription>
                                Ranked by total revenue
                            </CardDescription>
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
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.salesByCustomer.slice(0, 20).map((customer, index) => (
                                            <tr key={customer.customerId} className="border-b hover:bg-muted/30">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                                        {index + 1}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-medium">{customer.customerName}</td>
                                                <td className="py-3 px-4 text-muted-foreground">{customer.customerCode}</td>
                                                <td className="py-3 px-4 text-right tabular-nums">{customer.orderCount.toLocaleString()}</td>
                                                <td className="py-3 px-4 text-right tabular-nums font-medium">
                                                    {formatCurrency(customer.totalSales)}
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                                                    {formatCurrency(customer.averageOrderValue)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sales by Product */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Top Selling Products</CardTitle>
                            <CardDescription>
                                Products ranked by revenue
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.salesByProduct.slice(0, 12).map((product, index) => (
                                    <div key={product.productId} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold text-sm">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm line-clamp-1">{product.productName}</p>
                                                    <p className="text-xs text-muted-foreground">{product.materialNumber}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Quantity Sold</p>
                                                <p className="text-lg font-semibold">{product.quantitySold.toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Revenue</p>
                                                <p className="text-sm font-medium text-emerald-600">{formatCurrency(product.totalRevenue)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
