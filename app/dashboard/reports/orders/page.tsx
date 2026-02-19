import { getOrderFulfillmentReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPICard, ReportKPIGrid, ExportButton, ProgressBar } from "@/components/reports/report-components"
import { ReportPieChart, ReportBarChart, GaugeChart, OrderTrendChart, FulfillmentTimeChart, OnTimeDeliveryChart, OrderCompletionChart } from "@/components/reports/report-charts"
import { Truck, Clock, CheckCircle, AlertTriangle, ArrowLeft, Package } from "lucide-react"
import Link from "next/link"

export default async function OrderFulfillmentReportPage() {
    const data = await getOrderFulfillmentReport()

    const kpis = [
        {
            title: "Total Orders",
            value: data.orderStatusDistribution.reduce((sum, s) => sum + s.count, 0).toLocaleString(),
            change: 5.2,
            changeLabel: "vs last month",
            icon: Package,
            variant: "default" as const,
        },
        {
            title: "Avg Fulfillment Time",
            value: `${data.fulfillmentTime.averageDays.toFixed(1)} days`,
            change: data.fulfillmentTime.averageDays < 3 ? 10 : -5,
            changeLabel: data.fulfillmentTime.averageDays < 3 ? "excellent" : "needs improvement",
            icon: Clock,
            variant: data.fulfillmentTime.averageDays < 3 ? "success" : "warning" as const,
        },
        {
            title: "On-Time Delivery",
            value: `${data.onTimeDelivery.onTimeRate.toFixed(1)}%`,
            change: data.onTimeDelivery.onTimeRate - 80,
            changeLabel: "vs 80% target",
            icon: CheckCircle,
            variant: data.onTimeDelivery.onTimeRate >= 80 ? "success" : data.onTimeDelivery.onTimeRate >= 60 ? "warning" : "danger" as const,
        },
        {
            title: "Backorders",
            value: data.backorderAnalysis.reduce((sum, b) => sum + b.backorderCount, 0).toLocaleString(),
            icon: AlertTriangle,
            variant: data.backorderAnalysis.length > 5 ? "danger" : "warning" as const,
        },
    ]

    const orderStatusData = data.orderStatusDistribution.map(s => ({
        name: s.status.charAt(0).toUpperCase() + s.slice(1),
        value: s.count,
    }))

    const orderTrendData = data.orderTrend.map(o => ({
        name: new Date(o.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        total: o.totalOrders,
        completed: o.completedOrders,
    }))

    const fulfillmentByMonthData = data.fulfillmentTime.byMonth.map(m => ({
        name: new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        days: m.averageDays,
    }))

    const onTimeByMonthData = data.onTimeDelivery.byMonth.map(m => ({
        name: new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        rate: m.onTimeRate,
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
                        <h1 className="text-2xl font-bold tracking-tight">Order Fulfillment Report</h1>
                        <p className="text-muted-foreground">
                            Order status, delivery performance, and fulfillment metrics
                        </p>
                    </div>
                    <ExportButton data={data.orderStatusDistribution} filename="order-status" format="csv" />
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Order Status & On-Time Rate */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Order Trend (Last 12 Months)</CardTitle>
                                <CardDescription>Total orders over time</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {orderTrendData.length === 0 ? (
                                    <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                        No order data available
                                    </div>
                                ) : (
                                    <div className="h-[300px]">
                                        <OrderTrendChart data={orderTrendData} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <div>
                        <GaugeChart
                            value={data.onTimeDelivery.onTimeDeliveries}
                            max={data.onTimeDelivery.totalDeliveries}
                            title="On-Time Delivery Rate"
                            description={`${data.onTimeDelivery.onTimeDeliveries} of ${data.onTimeDelivery.totalDeliveries} deliveries`}
                            label={`${data.onTimeDelivery.onTimeRate.toFixed(1)}% on-time`}
                        />
                    </div>
                </div>

                {/* Order Status Distribution & Fulfillment Time */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <ReportBarChart
                        data={orderStatusData}
                        title="Order Status Distribution"
                        description="Orders by current status"
                        height={350}
                        colors={["hsl(217, 91%, 60%)"]}
                    />
                    <Card>
                        <CardHeader>
                            <CardTitle>Fulfillment Time Trend</CardTitle>
                            <CardDescription>
                                Average days to fulfill orders (by month)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {fulfillmentByMonthData.length === 0 ? (
                                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                    No fulfillment data available
                                </div>
                            ) : (
                                <div className="h-[300px]">
                                    <FulfillmentTimeChart data={fulfillmentByMonthData} />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* On-Time Delivery Performance */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>On-Time Delivery Performance</CardTitle>
                            <CardDescription>
                                Monthly on-time delivery rate
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {onTimeByMonthData.length === 0 ? (
                                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                    No delivery data available
                                </div>
                            ) : (
                                <div className="h-[300px]">
                                    <OnTimeDeliveryChart data={onTimeByMonthData} />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Order Completion Trend */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Completion Analysis</CardTitle>
                            <CardDescription>
                                Completed vs Cancelled orders over time
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {orderTrendData.length === 0 ? (
                                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                                    No order data available
                                </div>
                            ) : (
                                <div className="h-[300px]">
                                    <OrderCompletionChart data={orderTrendData} />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Backorders Table */}
                <div className="px-4 lg:px-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Backorder Analysis</CardTitle>
                            <CardDescription>
                                Products with pending orders exceeding stock
                                {data.backorderAnalysis.length > 0 && ` (${data.backorderAnalysis.length} products)`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {data.backorderAnalysis.length === 0 ? (
                                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50 text-emerald-600" />
                                        <p>No backorders pending!</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                <th className="text-left py-3 px-4 font-medium">Product</th>
                                                <th className="text-left py-3 px-4 font-medium">Material Number</th>
                                                <th className="text-right py-3 px-4 font-medium">Backorders</th>
                                                <th className="text-right py-3 px-4 font-medium">Quantity</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.backorderAnalysis.slice(0, 20).map((item) => (
                                                <tr key={item.productId} className="border-b hover:bg-muted/30">
                                                    <td className="py-3 px-4 font-medium">{item.productName}</td>
                                                    <td className="py-3 px-4 text-muted-foreground">{item.materialNumber}</td>
                                                    <td className="py-3 px-4 text-right tabular-nums">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-600">
                                                            {item.backorderCount.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right tabular-nums">{item.totalBackorderQuantity.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Fulfillment Time Stats */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-4 lg:px-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Average Fulfillment</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{data.fulfillmentTime.averageDays.toFixed(1)}</p>
                            <p className="text-sm text-muted-foreground">days</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Median Fulfillment</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold">{data.fulfillmentTime.medianDays.toFixed(1)}</p>
                            <p className="text-sm text-muted-foreground">days</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Fastest</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-emerald-600">{data.fulfillmentTime.minDays.toFixed(1)}</p>
                            <p className="text-sm text-muted-foreground">days</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Slowest</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-amber-600">{data.fulfillmentTime.maxDays.toFixed(1)}</p>
                            <p className="text-sm text-muted-foreground">days</p>
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
