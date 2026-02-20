import { getWarehouseLogisticsReport } from "@/app/actions/reports"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportKPIGrid, ExportButton } from "@/components/reports/report-components"
import { ReportBarChart, ReportPieChart, GaugeChart, SalesTrendChart } from "@/components/reports/report-charts"
import { Warehouse, Truck, MapPin, DollarSign, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function WarehouseLogisticsReportPage() {
    const data = await getWarehouseLogisticsReport()

    const totalWarehouses = data.warehouseCapacity.length
    const activeVehicles = data.fleetUtilization.filter(f => f.totalTrips > 0).length

    const totalDeliveries = data.deliveryPerformance.reduce((sum, d) => sum + d.totalDeliveries, 0)
    const onTimeRate = totalDeliveries > 0
        ? (data.deliveryPerformance.reduce((sum, d) => sum + d.completedDeliveries, 0) / totalDeliveries) * 100
        : 0

    const totalShippingCost = data.shippingCostAnalysis.reduce((sum, s) => sum + s.totalShippingCost, 0)

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        {
            title: "Total Facilities",
            value: totalWarehouses.toString(),
            icon: "warehouse",
            variant: "default",
        },
        {
            title: "Active Fleet Vehicles",
            value: activeVehicles.toString(),
            icon: "truck",
            variant: "success",
        },
        {
            title: "Delivery Success Rate",
            value: `${onTimeRate.toFixed(1)}%`,
            icon: "activity",
            variant: onTimeRate >= 90 ? "success" : onTimeRate >= 80 ? "warning" : "danger",
        },
        {
            title: "Total Shipping Costs",
            value: formatCurrency(totalShippingCost),
            icon: "dollar",
            variant: "default",
        },
    ]

    const costTrendData = data.shippingCostAnalysis.map(s => ({
        date: s.month + "-01",
        sales: s.totalShippingCost // Reusing sales trend chart which uses "sales" var
    }))

    const transferFlowData = data.stockTransferFlow.map(t => ({
        name: `${t.fromWarehouse} \u2192 ${t.toWarehouse}`,
        value: t.totalQuantity
    }))

    const fleetData = data.fleetUtilization.map(f => ({
        name: f.vehicleNumber || "Unknown",
        value: f.utilizationRate,
        secondary: f.totalTrips
    }))

    const deliveryDistData = data.deliveryPerformance.map(d => ({
        name: d.month,
        value: d.totalDeliveries
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
                        <h1 className="text-2xl font-bold tracking-tight">Warehouse & Logistics Report</h1>
                        <p className="text-muted-foreground">
                            Facility capacity, fleet performance, and shipping costs
                        </p>
                    </div>
                </div>

                {/* KPI Cards */}
                <ReportKPIGrid kpis={kpis} />

                {/* Warehouse Capacity Gauges */}
                <div className="px-4 lg:px-6 mb-2">
                    <h2 className="text-lg font-semibold tracking-tight mb-4">Warehouse Capacity Utilization</h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {data.warehouseCapacity.slice(0, 4).map((w, i) => (
                            <GaugeChart
                                key={i}
                                value={w.capacityUsed}
                                max={w.capacityTotal}
                                title={w.warehouseName}
                                description="Current Utilization"
                                label={`${w.utilizationRate.toFixed(1)}% Used`}
                            />
                        ))}
                    </div>
                </div>

                {/* Logistics Charts Row 1 */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <ReportBarChart
                        data={transferFlowData}
                        title="Stock Transfer Flow"
                        description="Quantity transferred between facilities"
                        height={350}
                        colors={["hsl(199, 89%, 48%)"]}
                    />
                    <ReportPieChart
                        data={deliveryDistData}
                        title="Delivery Status Distribution"
                        description="Current state of all deliveries"
                        height={350}
                        variant="donut"
                    />
                </div>

                {/* Logistics Charts Row 2 */}
                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6 mb-6">
                    <div className="lg:col-span-2">
                        <SalesTrendChart
                            data={costTrendData}
                            title="Shipping Cost Analysis"
                            description="Monthly shipping cost trend"
                            height={350}
                        />
                    </div>
                    <ReportBarChart
                        data={fleetData}
                        title="Fleet Utilization (%)"
                        description="Vehicle operating efficiency"
                        height={350}
                        colors={["hsl(217, 91%, 60%)"]}
                    />
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
