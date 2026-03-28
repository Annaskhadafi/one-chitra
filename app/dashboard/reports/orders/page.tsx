import { getOrderFulfillmentReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPIGrid, ExportButton } from "@/components/reports/report-components"
import { ReportBarChart, ReportPieChart, GaugeChart } from "@/components/reports/report-charts"
import { PackageCheck, ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export default async function OrderFulfillmentReportPage() {
    const data = await getOrderFulfillmentReport()

    const totalOrdersAll = data.orderTrend.reduce((sum: number, m) => sum + m.totalOrders, 0)
    const completedOrdersAll = data.orderTrend.reduce((sum: number, m) => sum + m.completedOrders, 0)
    const overallCompletionRate = totalOrdersAll > 0 ? (completedOrdersAll / totalOrdersAll) * 100 : 0

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        {
            title: "Overall Completion Rate",
            value: `${overallCompletionRate.toFixed(1)}%`,
            icon: "check" as const,
            variant: overallCompletionRate >= 90 ? "success" : "warning",
        },
        {
            title: "Average Fulfillment Time",
            value: `${data.fulfillmentTime.averageDays.toFixed(1)} Days`,
            icon: "clock" as const,
            variant: "default",
        },
        {
            title: "On-Time Delivery Rate",
            value: `${data.onTimeDelivery.onTimeRate.toFixed(1)}%`,
            icon: "packageCheck" as const,
            variant: data.onTimeDelivery.onTimeRate >= 95 ? "success" : data.onTimeDelivery.onTimeRate >= 80 ? "warning" : "danger",
        },
        {
            title: "Items on Backorder",
            value: data.backorderAnalysis.reduce((sum: number, b) => sum + b.totalBackorderQuantity, 0).toLocaleString(),
            icon: "alertOctagon" as const,
            variant: data.backorderAnalysis.length > 0 ? "danger" : "success",
        },
    ]

    const statusData = data.orderStatusDistribution.map(s => ({
        name: s.status,
        value: s.count,
    }))

    const trendData = data.orderTrend.map(t => ({
        name: new Date(t.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: t.totalOrders,
        secondary: t.completedOrders,
    }))

    const fulfillmentTimeByMonthData = data.fulfillmentTime.byMonth.map(f => ({
        name: new Date(f.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: Number(f.averageDays.toFixed(1)),
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
                    <Card className="border-slate-200 bg-gradient-to-br from-white via-slate-50 to-amber-50 shadow-sm">
                        <CardHeader className="gap-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">Execution Focus</Badge>
                                <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Backorder Pressure</Badge>
                                <Badge className={`${overallCompletionRate >= 90 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"} hover:bg-inherit`}>
                                    Completion {overallCompletionRate >= 90 ? "Healthy" : "Under Watch"}
                                </Badge>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Order Fulfillment Intelligence</h1>
                                <p className="text-slate-600">
                                    Visibilitas manajemen atas backlog order, kualitas eksekusi pengiriman, dan sumber tekanan service level.
                                </p>
                            </div>
                        </CardHeader>
                    </Card>
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Charts Row 1 */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <ReportPieChart
                        data={statusData}
                        title="Order Status Mix"
                        description="Komposisi status order untuk membaca beban kerja dan risiko eksekusi saat ini."
                        height={350}
                        variant="donut"
                    />
                    <GaugeChart
                        value={data.onTimeDelivery.onTimeDeliveries}
                        max={data.onTimeDelivery.totalDeliveries}
                        title="On-Time Delivery Discipline"
                        description={`Dibaca dari ${data.onTimeDelivery.totalDeliveries} delivery sebagai baseline layanan`}
                        label={`${data.onTimeDelivery.onTimeRate.toFixed(1)}% On-Time`}
                    />
                </div>

                {/* Trend & Fulfillment Time */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <ReportBarChart
                        data={trendData}
                        title="Order Throughput Trend"
                        description="Order masuk versus order selesai untuk membaca stabilitas throughput operasional."
                        height={350}
                        colors={["hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)"]}
                        showLegend
                    />
                    <ReportBarChart
                        data={fulfillmentTimeByMonthData}
                        title="Fulfillment Cycle Time"
                        description="Hari yang dibutuhkan dari order ke delivery sebagai indikator kecepatan eksekusi."
                        height={350}
                        colors={["hsl(340, 82%, 52%)"]}
                    />
                </div>

                {/* Backorder Analysis Table */}
                <div className="px-4 lg:px-6 mb-6">
                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Backorder Pressure Analysis</CardTitle>
                                    <CardDescription>Produk yang saat ini menahan pemenuhan order dan berpotensi mengganggu layanan</CardDescription>
                                </div>
                                <ExportButton data={data.backorderAnalysis} filename="backorders" format="csv" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {data.backorderAnalysis.length === 0 ? (
                                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <PackageCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>Tidak ada backorder aktif. Kualitas pemenuhan order saat ini sangat sehat.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b bg-muted/50">
                                                <th className="text-left py-3 px-4 font-medium">Product</th>
                                                <th className="text-left py-3 px-4 font-medium">Material Code</th>
                                                <th className="text-right py-3 px-4 font-medium">Affected Orders</th>
                                                <th className="text-right py-3 px-4 font-medium">Total Quantity Pending</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.backorderAnalysis.map((item) => (
                                                <tr key={item.productId} className="border-b hover:bg-muted/30">
                                                    <td className="py-3 px-4 font-medium">{item.productName}</td>
                                                    <td className="py-3 px-4 text-muted-foreground">{item.materialNumber}</td>
                                                    <td className="py-3 px-4 text-right tabular-nums">{item.backorderCount}</td>
                                                    <td className="py-3 px-4 text-right tabular-nums font-bold text-rose-600">
                                                        {item.totalBackorderQuantity.toLocaleString()}
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
            </div>
        </div>
    )
}
