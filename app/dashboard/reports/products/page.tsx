import { getProductPerformanceReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPIGrid, ExportButton } from "@/components/reports/report-components"
import { ReportBarChart, ReportScatterChart, ReportTreemapChart } from "@/components/reports/report-charts"
import { PackageOpen, TrendingUp, DollarSign, AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function ProductPerformanceReportPage() {
    const data = await getProductPerformanceReport()

    const totalSold = data.bestSellingProducts.reduce((sum: number, p) => sum + p.quantitySold, 0)
    const totalRev = data.bestSellingProducts.reduce((sum: number, p) => sum + p.totalRevenue, 0)

    // Calculate total profit from performance data (totalRevenue * profitMargin / 100)
    const totalProfit = data.bestSellingProducts.reduce((sum: number, p) => sum + (p.profitMargin ? (p.profitMargin / 100) * p.totalRevenue : 0), 0)
    const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        {
            title: "Total Units Sold",
            value: totalSold.toLocaleString(),
            icon: "packageOpen",
            variant: "default",
        },
        {
            title: "Total Product Revenue",
            value: formatCurrency(totalRev),
            icon: "dollar",
            variant: "success",
        },
        {
            title: "Estimated Profit Margin",
            value: `${avgMargin.toFixed(1)}%`,
            icon: "trendingUp",
            variant: avgMargin >= 20 ? "success" : avgMargin >= 10 ? "warning" : "danger",
        },
        {
            title: "Low Performing Products",
            value: data.worstSellingProducts.length.toString(),
            icon: "alertCircle",
            variant: data.worstSellingProducts.length > 5 ? "danger" : "warning",
        },
    ]

    const scatterData = data.bestSellingProducts.map((p) => ({
        name: p.productName || "Unknown",
        revenue: Number(p.totalRevenue) || 0,
        margin: Number(p.profitMargin || 0),
        sold: Number(p.quantitySold) || 0
    }))

    const treemapData = data.categoryPerformance.map((c) => ({
        name: (c.category as string) || "Unknown",
        size: Number(c.totalRevenue) || 0
    }))

    const topProductsBarData = data.bestSellingProducts.slice(0, 10).map((p) => ({
        name: (p.productName as string)?.substring(0, 20) + "..." || "Unknown",
        value: Number(p.totalRevenue) || 0,
    }))

    return (
        <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {/* Header */}
                <div className="px-4 lg:px-6 flex items-center gap-4">
                    <Link href="/dashboard/reports" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Reports
                    </Link>
                </div>

                <div className="px-4 lg:px-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Product Performance Report</h1>
                        <p className="text-muted-foreground">
                            Analyze sales, profitability, and category performance
                        </p>
                    </div>
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <ReportTreemapChart
                        data={treemapData}
                        title="Category Performance"
                        description="Revenue distribution by product category"
                        height={350}
                    />
                    <ReportScatterChart
                        data={scatterData}
                        title="Product Profitability Analysis"
                        description="Revenue vs. Profit Margin comparison"
                        height={350}
                        xAxisKey="revenue"
                        yAxisKey="margin"
                        zAxisKey="sold"
                        nameKey="name"
                    />
                </div>

                {/* Charts Row 2 */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:px-6">
                    <ReportBarChart
                        data={topProductsBarData}
                        title="Top 10 Products by Revenue"
                        description="Highest generating products"
                        height={350}
                        colors={["hsl(142, 71%, 45%)"]}
                    />
                </div>

                {/* Low Performers Table */}
                <div className="px-4 lg:px-6 mb-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Low Performing Products</CardTitle>
                                    <CardDescription>Items with high stock and low recent sales movement</CardDescription>
                                </div>
                                <ExportButton data={data.worstSellingProducts} filename="low-performers" format="csv" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left py-3 px-4 font-medium text-xs">Product</th>
                                            <th className="text-left py-3 px-4 font-medium text-xs">Category</th>
                                            <th className="text-right py-3 px-4 font-medium text-xs">Current Stock</th>
                                            <th className="text-right py-3 px-4 font-medium text-xs">Total Quantity Sold</th>
                                            <th className="text-right py-3 px-4 font-medium text-xs">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.worstSellingProducts.map((prod, i: number) => (
                                            <tr key={i} className="border-b hover:bg-muted/30">
                                                <td className="py-3 px-4 text-sm font-medium">{prod.productName as string || "Unknown"}</td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground">{prod.category as string || "Unknown"}</td>
                                                <td className="py-3 px-4 text-sm text-right tabular-nums">{Number(prod.stockLevel || 0).toLocaleString()}</td>
                                                <td className="py-3 px-4 text-sm text-right tabular-nums">{Number(prod.quantitySold || 0).toLocaleString()}</td>
                                                <td className="py-3 px-4 text-sm text-right tabular-nums font-medium text-rose-600">{formatCurrency(Number(prod.totalRevenue || 0))}</td>
                                            </tr>
                                        ))}
                                        {data.worstSellingProducts.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                                                    No low performing products found.
                                                </td>
                                            </tr>
                                        )}
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
