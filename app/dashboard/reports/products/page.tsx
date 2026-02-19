import { getProductPerformanceReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPICard, ReportKPIGrid, ExportButton, ProgressBar } from "@/components/reports/report-components"
import { ReportPieChart, ReportBarChart } from "@/components/reports/report-charts"
import { ShoppingCart, TrendingUp, TrendingDown, Package, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function ProductPerformanceReportPage() {
    const data = getProductPerformanceReport()

    const totalRevenue = data.categoryPerformance.reduce((sum, c) => sum + c.totalRevenue, 0)
    const totalProducts = data.bestSellingProducts.length + data.worstSellingProducts.length

    const kpis = [
        {
            title: "Total Products",
            value: totalProducts.toLocaleString(),
            change: 5.2,
            changeLabel: "vs last month",
            icon: Package,
            variant: "default" as const,
        },
        {
            title: "Total Revenue",
            value: formatCurrency(totalRevenue),
            change: 8.5,
            changeLabel: "vs last month",
            icon: TrendingUp,
            variant: "success" as const,
        },
        {
            title: "Best Sellers",
            value: data.bestSellingProducts.length.toLocaleString(),
            icon: ShoppingCart,
            variant: "success" as const,
        },
        {
            title: "Slow Movers",
            value: data.worstSellingProducts.length.toLocaleString(),
            icon: TrendingDown,
            variant: "warning" as const,
        },
    ]

    const categoryData = data.categoryPerformance.map(c => ({
        name: c.category,
        value: c.totalRevenue,
    }))

    const bestSellingData = data.bestSellingProducts.slice(0, 12).map(p => ({
        name: p.productName.length > 20 ? p.productName.substring(0, 20) + "..." : p.productName,
        value: p.totalRevenue,
    }))

    const abcData = data.abcAnalysis.map(a => ({
        name: `Class ${a.class}`,
        value: a.productCount,
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
                        <h1 className="text-2xl font-bold tracking-tight">Product Performance Report</h1>
                        <p className="text-muted-foreground">
                            Best sellers, slow movers, and product analytics
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <ExportButton data={data.bestSellingProducts} filename="best-selling-products" format="csv" />
                        <ExportButton data={data.worstSellingProducts} filename="worst-selling-products" format="csv" />
                    </div>
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Category Performance & ABC Analysis */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
                    <div className="lg:col-span-2">
                        <ReportBarChart
                            data={categoryData}
                            title="Category Performance"
                            description="Revenue by product category"
                            height={350}
                            colors={["hsl(217, 91%, 60%)"]}
                        />
                    </div>
                    <div>
                        <ReportPieChart
                            data={abcData}
                            title="ABC Analysis"
                            description="Product classification by value"
                            height={350}
                            variant="donut"
                        />
                    </div>
                </div>

                {/* Best Selling Products */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                                        Best Selling Products
                                    </CardTitle>
                                    <CardDescription>
                                        Top performers by revenue
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.bestSellingProducts.slice(0, 15).map((product, index) => (
                                    <div
                                        key={product.productId}
                                        className="p-4 rounded-lg border bg-card hover:shadow-lg hover:border-emerald-500/50 transition-all group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 text-emerald-600 font-bold text-sm border border-emerald-500/30">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm line-clamp-1 group-hover:text-emerald-600 transition-colors">
                                                        {product.productName}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">{product.materialNumber}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">Category</span>
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
                                                    {product.category}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">Quantity Sold</span>
                                                <span className="text-sm font-semibold tabular-nums">
                                                    {product.quantitySold.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground">Revenue</span>
                                                <span className="text-sm font-bold text-emerald-600 tabular-nums">
                                                    {formatCurrency(product.totalRevenue)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Worst Selling Products */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingDown className="h-5 w-5 text-amber-600" />
                                        Slow Moving Products
                                    </CardTitle>
                                    <CardDescription>
                                        Products requiring attention ({data.worstSellingProducts.length} items)
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
                                            <th className="text-left py-3 px-4 font-medium">Product</th>
                                            <th className="text-left py-3 px-4 font-medium">Material</th>
                                            <th className="text-left py-3 px-4 font-medium">Category</th>
                                            <th className="text-right py-3 px-4 font-medium">Qty Sold</th>
                                            <th className="text-right py-3 px-4 font-medium">Revenue</th>
                                            <th className="text-right py-3 px-4 font-medium">Stock Level</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.worstSellingProducts.slice(0, 20).map((product, index) => (
                                            <tr key={product.productId} className="border-b hover:bg-muted/30">
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 font-semibold text-sm">
                                                        {index + 1}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-medium max-w-[200px] truncate">
                                                    {product.productName}
                                                </td>
                                                <td className="py-3 px-4 text-muted-foreground text-sm">
                                                    {product.materialNumber}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted">
                                                        {product.category}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                                                    {product.quantitySold.toLocaleString()}
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                                                    {formatCurrency(product.totalRevenue)}
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                        product.stockLevel > 100 
                                                            ? "bg-rose-500/10 text-rose-600" 
                                                            : "bg-amber-500/10 text-amber-600"
                                                    }`}>
                                                        {product.stockLevel.toLocaleString()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Category Details */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Category Performance Details</CardTitle>
                            <CardDescription>
                                Comprehensive breakdown by product category
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.categoryPerformance.map((category) => (
                                    <div key={category.category} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-semibold">{category.category}</h3>
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                category.growthRate >= 0 
                                                    ? "bg-emerald-500/10 text-emerald-600" 
                                                    : "bg-rose-500/10 text-rose-600"
                                            }`}>
                                                {category.growthRate >= 0 ? "+" : ""}{category.growthRate.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Revenue</span>
                                                <span className="font-medium tabular-nums">
                                                    {formatCurrency(category.totalRevenue)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Quantity</span>
                                                <span className="font-medium tabular-nums">
                                                    {category.totalQuantity.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Products</span>
                                                <span className="font-medium tabular-nums">
                                                    {category.productCount}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Avg Price</span>
                                                <span className="font-medium tabular-nums">
                                                    {formatCurrency(category.averagePrice)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ABC Analysis Details */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>ABC Analysis Breakdown</CardTitle>
                            <CardDescription>
                                Product classification based on revenue contribution
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {data.abcAnalysis.map((item) => (
                                    <div
                                        key={item.class}
                                        className={`p-6 rounded-lg border-2 ${
                                            item.class === "A"
                                                ? "border-emerald-500/50 bg-emerald-500/5"
                                                : item.class === "B"
                                                ? "border-amber-500/50 bg-amber-500/5"
                                                : "border-blue-500/50 bg-blue-500/5"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                                                item.class === "A"
                                                    ? "bg-emerald-500 text-white"
                                                    : item.class === "B"
                                                    ? "bg-amber-500 text-white"
                                                    : "bg-blue-500 text-white"
                                            }`}>
                                                {item.class}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg">Class {item.class}</h3>
                                                <p className="text-sm text-muted-foreground">{item.description}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-muted-foreground">Products</span>
                                                <span className="text-xl font-bold tabular-nums">
                                                    {item.productCount.toLocaleString()}
                                                </span>
                                            </div>
                                            <ProgressBar
                                                value={item.productCount}
                                                max={data.abcAnalysis.reduce((sum, a) => sum + a.productCount, 0)}
                                                showValue={false}
                                            />
                                            <div className="flex justify-between items-center pt-2 border-t">
                                                <span className="text-sm text-muted-foreground">Revenue Share</span>
                                                <span className="text-lg font-bold text-emerald-600 tabular-nums">
                                                    {item.revenuePercentage.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                Total: {formatCurrency(item.totalRevenue)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Product Profitability */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Product Profitability Analysis</CardTitle>
                            <CardDescription>
                                Top products by profit margin
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left py-3 px-4 font-medium">Product</th>
                                            <th className="text-left py-3 px-4 font-medium">Category</th>
                                            <th className="text-right py-3 px-4 font-medium">Revenue</th>
                                            <th className="text-right py-3 px-4 font-medium">Est. Cost</th>
                                            <th className="text-right py-3 px-4 font-medium">Profit</th>
                                            <th className="text-right py-3 px-4 font-medium">Margin</th>
                                            <th className="text-right py-3 px-4 font-medium">Volume</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.productProfitability.slice(0, 15).map((product) => (
                                            <tr key={product.productId} className="border-b hover:bg-muted/30">
                                                <td className="py-3 px-4 font-medium">{product.productName}</td>
                                                <td className="py-3 px-4 text-muted-foreground">{product.category}</td>
                                                <td className="py-3 px-4 text-right tabular-nums font-medium">
                                                    {formatCurrency(product.totalRevenue)}
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                                                    {formatCurrency(product.totalCost)}
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-600">
                                                    {formatCurrency(product.profit)}
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                        product.margin >= 30
                                                            ? "bg-emerald-500/10 text-emerald-600"
                                                            : product.margin >= 15
                                                            ? "bg-amber-500/10 text-amber-600"
                                                            : "bg-rose-500/10 text-rose-600"
                                                    }`}>
                                                        {product.margin.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                                                    {product.volume.toLocaleString()}
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
