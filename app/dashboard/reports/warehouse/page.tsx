import { getWarehouseLogisticsReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPICard, ReportKPIGrid, ExportButton, ProgressBar } from "@/components/reports/report-components"
import { ReportPieChart, ReportBarChart, GaugeChart, DeliveryPerformanceChart, ShippingCostChart } from "@/components/reports/report-charts"
import { Warehouse, Truck, Package, DollarSign, ArrowLeft, TrendingUp } from "lucide-react"
import Link from "next/link"

export default async function WarehouseLogisticsReportPage() {
    const data = await getWarehouseLogisticsReport()

    const totalCapacity = data.warehouseCapacity.reduce((sum, w) => sum + w.capacityTotal, 0)
    const totalUsed = data.warehouseCapacity.reduce((sum, w) => sum + w.capacityUsed, 0)
    const overallUtilization = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0

    const kpis = [
        {
            title: "Total Warehouses",
            value: data.warehouseCapacity.length.toLocaleString(),
            change: 0,
            changeLabel: "stable",
            icon: Warehouse,
            variant: "default" as const,
        },
        {
            title: "Total Stock",
            value: data.warehouseCapacity.reduce((sum, w) => sum + w.totalStock, 0).toLocaleString(),
            change: 5.2,
            changeLabel: "vs last month",
            icon: Package,
            variant: "success" as const,
        },
        {
            title: "Capacity Used",
            value: `${overallUtilization.toFixed(1)}%`,
            change: overallUtilization - 70,
            changeLabel: "avg utilization",
            icon: TrendingUp,
            variant: overallUtilization > 80 ? "warning" : overallUtilization > 50 ? "success" : "default" as const,
        },
        {
            title: "Total Fleet Trips",
            value: data.fleetUtilization.reduce((sum, f) => sum + f.totalTrips, 0).toLocaleString(),
            icon: Truck,
            variant: "default" as const,
        },
    ]

    const warehouseDistribution = data.warehouseCapacity.map(w => ({
        name: w.warehouseName,
        value: w.totalStock,
    }))

    const deliveryPerformanceData = data.deliveryPerformance.map(d => ({
        name: new Date(d.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        deliveries: d.totalDeliveries,
        onTimeRate: d.onTimeRate,
    }))

    const shippingCostData = data.shippingCostAnalysis.map(s => ({
        name: new Date(s.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        cost: s.totalShippingCost,
    }))

    const fleetData = data.fleetUtilization.slice(0, 10).map(f => ({
        name: f.vehicleNumber.length > 15 ? f.vehicleNumber.substring(0, 15) + "..." : f.vehicleNumber,
        value: f.totalTrips,
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
                        <h1 className="text-2xl font-bold tracking-tight">Warehouse & Logistics Report</h1>
                        <p className="text-muted-foreground">
                            Warehouse capacity, fleet utilization, and shipping performance
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <ExportButton data={data.warehouseCapacity} filename="warehouse-capacity" format="csv" />
                        <ExportButton data={data.fleetUtilization} filename="fleet-utilization" format="csv" />
                    </div>
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Overall Utilization & Warehouse Distribution */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Warehouse Capacity Overview</CardTitle>
                                <CardDescription>
                                    Capacity utilization across all warehouses
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {data.warehouseCapacity.map((warehouse) => (
                                        <div key={warehouse.warehouseId} className="p-4 rounded-lg border bg-card">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-sm">{warehouse.warehouseName}</p>
                                                    <p className="text-xs text-muted-foreground">{warehouse.warehouseType}</p>
                                                </div>
                                                <Warehouse className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">Products</span>
                                                    <span className="font-medium">{warehouse.totalProducts}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">Total Stock</span>
                                                    <span className="font-medium">{warehouse.totalStock.toLocaleString()}</span>
                                                </div>
                                                <ProgressBar
                                                    value={warehouse.capacityUsed}
                                                    max={warehouse.capacityTotal}
                                                    label="Capacity"
                                                    showValue={true}
                                                    variant={warehouse.utilizationRate > 80 ? "warning" : "success"}
                                                />
                                                <div className="pt-2 border-t">
                                                    <p className="text-xs text-muted-foreground">Value</p>
                                                    <p className="text-sm font-semibold">{formatCurrency(warehouse.capacityUsed)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div>
                        <GaugeChart
                            value={totalUsed}
                            max={totalCapacity}
                            title="Overall Capacity Utilization"
                            description={`${formatCurrency(totalUsed)} of ${formatCurrency(totalCapacity)}`}
                            label={`${overallUtilization.toFixed(1)}% utilized`}
                        />
                    </div>
                </div>

                {/* Stock Distribution & Fleet Utilization */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <ReportPieChart
                        data={warehouseDistribution}
                        title="Stock Distribution by Warehouse"
                        description="Current stock allocation"
                        height={350}
                        variant="donut"
                    />
                    <Card>
                        <CardHeader>
                            <CardTitle>Top 10 Fleet Vehicles</CardTitle>
                            <CardDescription>
                                Vehicles by number of trips completed
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {fleetData.length === 0 ? (
                                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                    No fleet data available
                                </div>
                            ) : (
                                <div className="h-[350px]">
                                    <ReportBarChart
                                        data={fleetData}
                                        title=""
                                        description=""
                                        height={350}
                                        colors={["hsl(217, 91%, 60%)"]}
                                        showLegend={false}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Delivery Performance Trend */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Delivery Performance Trend</CardTitle>
                            <CardDescription>
                                Monthly delivery volume and on-time rate
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {deliveryPerformanceData.length === 0 ? (
                                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                    No delivery performance data available
                                </div>
                            ) : (
                                <div className="h-[300px]">
                                    <DeliveryPerformanceChart data={deliveryPerformanceData} />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Shipping Cost Analysis */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Shipping Cost Analysis</CardTitle>
                            <CardDescription>
                                Monthly shipping costs trend
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {shippingCostData.length === 0 ? (
                                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                    No shipping cost data available
                                </div>
                            ) : (
                                <div className="h-[300px]">
                                    <ShippingCostChart data={shippingCostData} />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Fleet Utilization Table */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fleet Utilization Details</CardTitle>
                            <CardDescription>
                                Vehicle performance and operating costs
                                {data.fleetUtilization.length > 0 && ` (${data.fleetUtilization.length} vehicles)`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {data.fleetUtilization.length === 0 ? (
                                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>No fleet data available</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                <th className="text-left py-3 px-4 font-medium">Vehicle Number</th>
                                                <th className="text-left py-3 px-4 font-medium">Type</th>
                                                <th className="text-right py-3 px-4 font-medium">Total Trips</th>
                                                <th className="text-right py-3 px-4 font-medium">Total Cost</th>
                                                <th className="text-right py-3 px-4 font-medium">Avg Cost/Trip</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.fleetUtilization.slice(0, 20).map((vehicle) => (
                                                <tr key={vehicle.vehicleNumber} className="border-b hover:bg-muted/30">
                                                    <td className="py-3 px-4 font-medium">{vehicle.vehicleNumber}</td>
                                                    <td className="py-3 px-4">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                            {vehicle.vehicleType || "N/A"}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right tabular-nums">{vehicle.totalTrips.toLocaleString()}</td>
                                                    <td className="py-3 px-4 text-right tabular-nums font-medium">
                                                        {formatCurrency(vehicle.totalCost)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                                                        {vehicle.totalTrips > 0 ? formatCurrency(vehicle.totalCost / vehicle.totalTrips) : "N/A"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Delivery Performance Stats */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-4 lg:px-6">
                    {data.deliveryPerformance.slice(-4).map((month, index) => (
                        <Card key={month.month}>
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs">
                                    {new Date(month.month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-2xl font-bold">{month.totalDeliveries}</p>
                                        <p className="text-xs text-muted-foreground">deliveries</p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-semibold ${month.onTimeRate >= 80 ? "text-emerald-600" : month.onTimeRate >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                                            {month.onTimeRate.toFixed(1)}%
                                        </p>
                                        <p className="text-xs text-muted-foreground">on-time</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Stock Transfer Flow */}
                {data.stockTransferFlow.length > 0 && (
                    <div className="px-4 lg:px-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <CardTitle>Stock Transfer Flow</CardTitle>
                                        <CardDescription>
                                            Inter-warehouse stock transfers
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {data.stockTransferFlow.slice(0, 10).map((transfer, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                    <span className="text-sm font-medium">{transfer.fromWarehouse}</span>
                                                </div>
                                                <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    <polyline points="12 5 19 12 12 19"></polyline>
                                                </svg>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    <span className="text-sm font-medium">{transfer.toWarehouse}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium">{transfer.transferCount} transfers</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {transfer.totalQuantity.toLocaleString()} units · {formatCurrency(transfer.totalValue)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
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
