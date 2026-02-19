import { getInventoryReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPICard, ReportKPIGrid, LowStockAlertRow, ProgressBar } from "@/components/reports/report-components"
import { SalesTrendChart, ReportBarChart, ReportPieChart, StackedBarChart, StockMovementChart } from "@/components/reports/report-charts"
import { Package, AlertTriangle, TrendingUp, DollarSign, Warehouse, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function InventoryReportPage() {
    const data = await getInventoryReport()

    const kpis = [
        {
            title: "Total Products",
            value: data.stockOverview.reduce((sum, w) => sum + w.totalProducts, 0),
            change: 5.2,
            changeLabel: "vs last month",
            icon: Package,
            variant: "default" as const,
        },
        {
            title: "Total Stock Value",
            value: formatCurrency(data.stockOverview.reduce((sum, w) => sum + w.totalValue, 0)),
            change: 3.8,
            changeLabel: "vs last month",
            icon: DollarSign,
            variant: "success" as const,
        },
        {
            title: "Low Stock Items",
            value: data.lowStockAlerts.length,
            change: -12.5,
            changeLabel: "vs last week",
            icon: AlertTriangle,
            variant: data.lowStockAlerts.length > 10 ? "danger" : "warning" as const,
        },
        {
            title: "Warehouses",
            value: data.stockOverview.length,
            icon: Warehouse,
            variant: "default" as const,
        },
    ]

    const stockMovementData = data.stockMovement.slice(-14).map(d => ({
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        stockIn: d.stockIn,
        stockOut: d.stockOut,
    }))

    const inventoryValueData = data.inventoryValueTrend.map(d => ({
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: d.totalValue,
    }))

    const warehouseDistribution = data.stockOverview.map(w => ({
        name: w.warehouseName,
        value: w.totalStock,
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

                <div className="px-4 lg:px-6">
                    <h1 className="text-2xl font-bold tracking-tight">Inventory Report</h1>
                    <p className="text-muted-foreground">
                        Stock levels, movements, and inventory alerts
                    </p>
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <SalesTrendChart
                        data={inventoryValueData.map(d => ({ date: d.date, sales: d.value }))}
                        title="Inventory Value Trend"
                        description="Inventory valuation over the last 12 months"
                        height={300}
                    />
                    <ReportPieChart
                        data={warehouseDistribution}
                        title="Stock Distribution by Warehouse"
                        description="Current stock allocation across warehouses"
                        height={300}
                        variant="donut"
                    />
                </div>

                {/* Stock Movement Chart */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Stock Movement</CardTitle>
                            <CardDescription>
                                Daily stock inflow and outflow (last 14 days)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {stockMovementData.length === 0 ? (
                                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                    No stock movement data available
                                </div>
                            ) : (
                                <div className="h-[300px]">
                                    <StockMovementChart data={stockMovementData} />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Low Stock Alerts Table */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Low Stock Alerts</CardTitle>
                                    <CardDescription>
                                        Products requiring immediate restocking ({data.lowStockAlerts.length} items)
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {data.lowStockAlerts.length === 0 ? (
                                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>All products are well-stocked!</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                <th className="text-left py-3 px-4 font-medium">Product</th>
                                                <th className="text-left py-3 px-4 font-medium">Warehouse</th>
                                                <th className="text-right py-3 px-4 font-medium">Current</th>
                                                <th className="text-right py-3 px-4 font-medium">Min</th>
                                                <th className="text-center py-3 px-4 font-medium">Status</th>
                                                <th className="text-right py-3 px-4 font-medium">Ratio</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.lowStockAlerts.slice(0, 20).map((alert) => (
                                                <LowStockAlertRow
                                                    key={alert.id}
                                                    productName={alert.productName}
                                                    materialNumber={alert.materialNumber}
                                                    warehouseName={alert.warehouseName}
                                                    currentStock={alert.currentStock}
                                                    minStock={alert.minStock}
                                                    stockRatio={alert.stockRatio}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Warehouse Overview */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
                    {data.stockOverview.slice(0, 3).map((warehouse) => (
                        <Card key={warehouse.warehouseName}>
                            <CardHeader>
                                <CardTitle className="text-base">{warehouse.warehouseName}</CardTitle>
                                <CardDescription>{warehouse.warehouseType}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Products</p>
                                        <p className="text-lg font-semibold">{warehouse.totalProducts}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Total Stock</p>
                                        <p className="text-lg font-semibold">{warehouse.totalStock.toLocaleString()}</p>
                                    </div>
                                </div>
                                <ProgressBar
                                    value={warehouse.lowStockCount}
                                    max={warehouse.totalProducts}
                                    label="Low Stock Items"
                                    showValue={true}
                                />
                                <div className="pt-2 border-t">
                                    <p className="text-xs text-muted-foreground">Inventory Value</p>
                                    <p className="text-lg font-semibold">{formatCurrency(warehouse.totalValue)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Dead Stock Section */}
                {data.deadStock.length > 0 && (
                    <div className="px-4 lg:px-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Dead Stock Analysis</CardTitle>
                                <CardDescription>
                                    Products with no movement in 90+ days ({data.deadStock.length} items)
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {data.deadStock.slice(0, 10).map((item, index) => {
                                        const days = item.lastMovement
                                            ? Math.floor((Date.now() - item.lastMovement.getTime()) / (1000 * 60 * 60 * 24))
                                            : 0
                                        return (
                                            <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${days > 180 ? "bg-rose-500" : days > 120 ? "bg-orange-500" : "bg-amber-500"}`} />
                                                    <div>
                                                        <p className="font-medium text-sm">{item.productName}</p>
                                                        <p className="text-xs text-muted-foreground">{item.materialNumber} · {item.category}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-medium">{item.totalStock.toLocaleString()} units</p>
                                                    <p className="text-xs text-muted-foreground">{formatCurrency(item.valuationValue)}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
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
