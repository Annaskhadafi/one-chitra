import { getInventoryReport } from "@/app/actions/reports"
import { ReportEmptyState, ReportKPIGrid } from "@/components/reports/report-components"
import { HeatmapChart, SalesTrendChart, StackedBarChart, StockMovementChart } from "@/components/reports/report-charts"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, AlertTriangle, ArrowLeft, ArrowRightLeft, Package, TrendingDown } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { CreatePoEmailButton } from "./_components/create-po-email-button"

const LIGHT_CARD = "border-slate-200 bg-white text-slate-950 shadow-sm"

export default async function InventoryReportPage() {
    const data = await getInventoryReport()

    const totalProducts = data.stockOverview.reduce((sum, warehouse) => sum + warehouse.totalProducts, 0)
    const totalStockValue = data.stockOverview.reduce((sum, warehouse) => sum + warehouse.totalValue, 0)
    const deadStockCapital = data.deadStock.reduce((sum, item) => sum + item.valuationValue, 0)
    const criticalRestockCapital = data.lowStockAlerts.reduce((sum, item) => sum + item.recommendedRestockValue, 0)
    const urgentStockouts = data.lowStockAlerts.filter((item) => item.currentStock === 0 || (item.daysToStockout !== null && item.daysToStockout <= 7)).length
    const noRunRateItems = data.lowStockAlerts.filter((item) => item.daysToStockout === null).length

    const kpis = [
        { title: "Total Products", value: totalProducts, icon: "package" as const, variant: "default" as const },
        { title: "Total Stock Value", value: formatCurrency(totalStockValue), icon: "dollar" as const, variant: "success" as const },
        { title: "Critical Stock Exposure", value: urgentStockouts, icon: "alert" as const, variant: urgentStockouts > 0 ? ("danger" as const) : ("success" as const) },
        { title: "Warehouses in Scope", value: data.stockOverview.length, icon: "warehouse" as const, variant: "default" as const },
        { title: "Dead / Slow Stock Capital", value: formatCurrency(deadStockCapital), icon: "activity" as const, variant: deadStockCapital > criticalRestockCapital ? ("warning" as const) : ("default" as const) },
        { title: "Capital Required to Restock", value: formatCurrency(criticalRestockCapital), icon: "dollar" as const, variant: criticalRestockCapital > 0 ? ("danger" as const) : ("success" as const) },
    ]

    const inventoryValueData = data.inventoryValueTrend.map((point) => ({
        date: new Date(point.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        sales: point.totalValue,
    }))

    const stockMovementData = data.stockMovement.slice(-21).map((point) => ({
        date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        stockIn: point.stockIn,
        stockOut: point.stockOut,
    }))

    const warehouseDistribution = data.stockOverview
        .map((warehouse) => ({
            name: warehouse.warehouseName,
            stock: Math.max(0, warehouse.totalProducts - warehouse.lowStockCount - warehouse.outOfStockCount),
            lowStock: warehouse.lowStockCount,
            outOfStock: warehouse.outOfStockCount,
            attentionScore:
                warehouse.outOfStockCount * 10 +
                warehouse.lowStockCount * 4 +
                ((warehouse.lowStockCount + warehouse.outOfStockCount) / Math.max(warehouse.totalProducts, 1)) * 100,
            inventoryAtRisk:
                warehouse.totalValue *
                Math.min(1, (warehouse.lowStockCount + warehouse.outOfStockCount) / Math.max(warehouse.totalProducts, 1)),
        }))
        .sort((a, b) => b.attentionScore - a.attentionScore)

    const topWarehouseAttention = warehouseDistribution.slice(0, 5)
    const maxAttentionScore = Math.max(...topWarehouseAttention.map((item) => item.attentionScore), 1)
    const maxCapitalImpact = Math.max(deadStockCapital, criticalRestockCapital, 1)

    return (
        <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="px-4 lg:px-6 flex items-center gap-4">
                    <Link href="/dashboard/reports" className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Reports
                    </Link>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:px-6">
                    <Card className="border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 shadow-sm">
                        <CardHeader className="gap-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">Stock Risk Control</Badge>
                                <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Predictive Replenishment</Badge>
                                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">70+ Warehouse Ready</Badge>
                            </div>
                            <div className="space-y-2">
                                <CardTitle className="text-2xl tracking-tight">Inventory Control Intelligence</CardTitle>
                                <CardDescription className="max-w-3xl text-sm text-slate-600">
                                    Cockpit manajemen untuk membaca risiko stockout, modal yang tertahan di stok lambat bergerak, dan prioritas intervensi lintas gudang.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-3">
                            <SummarySignal label="Immediate Risk" value={String(urgentStockouts)} text="SKU berisiko habis dalam 7 hari." tone="rose" />
                            <SummarySignal label="Capital Trade-off" value={formatCurrency(deadStockCapital - criticalRestockCapital)} text="Selisih modal pasif vs restock kritis." tone="amber" />
                            <SummarySignal label="Coverage Gap" value={String(noRunRateItems)} text="SKU low stock tanpa run-rate kuat." tone="emerald" />
                        </CardContent>
                    </Card>

                    <Card className={LIGHT_CARD}>
                        <CardHeader>
                            <CardTitle>Management Priorities</CardTitle>
                            <CardDescription>Agenda yang paling layak diangkat ke inventory, procurement, dan warehouse.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <PriorityCallout
                                icon={<AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" />}
                                title="Amankan SKU dengan coverage di bawah 7 hari"
                                text="Prioritaskan transfer antargudang dan pembukaan restock untuk menahan penurunan service level."
                                tone="rose"
                            />
                            <PriorityCallout
                                icon={<TrendingDown className="mt-0.5 h-5 w-5 text-amber-600" />}
                                title="Lepaskan modal dari dead / slow-moving stock"
                                text="Nilai stok pasif saat ini dapat dipakai untuk menutup kebutuhan restock kritis tanpa menambah tekanan cashflow."
                                tone="amber"
                            />
                            <PriorityCallout
                                icon={<Activity className="mt-0.5 h-5 w-5 text-emerald-600" />}
                                title="Perkuat kualitas histori movement"
                                text="Forecast akan makin kredibel jika issue, transfer, dan outbound terekam lebih konsisten."
                                tone="emerald"
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="px-4 lg:px-6">
                    <ReportKPIGrid kpis={kpis} />
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    {inventoryValueData.length >= 2 ? (
                        <SalesTrendChart
                            data={inventoryValueData}
                            title="Inventory value trend shows where working capital is building up"
                            description="Pantau kenaikan modal kerja untuk membedakan penambahan stok sehat dari penumpukan yang tidak produktif."
                            height={320}
                        />
                    ) : (
                        <ReportEmptyState
                            title="Belum cukup histori untuk membaca arah inventory value"
                            description="Minimal dibutuhkan lebih dari satu titik periode agar tren modal kerja terlihat bermakna."
                            icon="chart"
                        />
                    )}

                    {warehouseDistribution.length > 0 ? (
                        <StackedBarChart
                            data={warehouseDistribution.slice(0, 10)}
                            title="Warehouse risk mix highlights where service pressure is concentrated"
                            description="Hijau sehat, kuning warning, merah kritis. Warna dipaksa semantik agar mudah dibaca oleh manajemen."
                            height={320}
                        />
                    ) : (
                        <ReportEmptyState
                            title="Belum ada distribusi stok per gudang"
                            description="Widget ini akan aktif ketika data stock level per gudang tersedia."
                            icon="warehouse"
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.9fr)] lg:px-6">
                    {stockMovementData.length >= 2 ? (
                        <StockMovementChart
                            data={stockMovementData}
                            title="Stock movement command view"
                            description="Baca keseimbangan inbound dan outbound harian untuk mendeteksi tekanan suplai lebih dini."
                            height={320}
                        />
                    ) : (
                        <ReportEmptyState
                            title="Riwayat movement belum cukup untuk command view"
                            description="Grafik akan aktif saat histori inbound dan outbound sudah cukup stabil untuk dibaca."
                            icon="activity"
                        />
                    )}

                    <Card className={LIGHT_CARD}>
                        <CardHeader>
                            <CardTitle>Financial impact</CardTitle>
                            <CardDescription>Perbandingan modal yang tertahan versus modal yang dibutuhkan untuk menjaga service level.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <CapitalBar label="Capital tied in dead / slow-moving stock" value={deadStockCapital} max={maxCapitalImpact} tone="rose" />
                            <CapitalBar label="Capital required for critical restock" value={criticalRestockCapital} max={maxCapitalImpact} tone="amber" />
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-slate-600">
                                {deadStockCapital >= criticalRestockCapital
                                    ? "Modal yang tertahan di stok lambat bergerak lebih besar daripada kebutuhan restock kritis. Ini membuka ruang redistribusi, disposal, atau remarketing yang lebih agresif."
                                    : "Kebutuhan restock kritis masih lebih besar daripada modal pasif yang tersedia. Prioritasnya mempercepat sourcing dan alokasi stok antargudang."}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="px-4 lg:px-6">
                    <Card className={LIGHT_CARD}>
                        <CardHeader>
                            <CardTitle>Critical replenishment watchlist</CardTitle>
                            <CardDescription>Sudah ditingkatkan dengan prediksi stockout, run-rate harian, dan tombol aksi cepat.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {data.lowStockAlerts.length === 0 ? (
                                <div className="flex h-[220px] items-center justify-center text-slate-500">
                                    <div className="text-center">
                                        <Package className="mx-auto mb-3 h-12 w-12 opacity-50" />
                                        <p className="font-medium text-slate-900">Tidak ada low stock kritis saat ini</p>
                                        <p className="mt-1 text-sm text-slate-500">Dashboard akan menampilkan item prioritas saat tekanan stok muncul.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1120px]">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50 text-sm">
                                                <th className="px-4 py-3 text-left font-medium text-slate-600">Product</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-600">Warehouse</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600">Current</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600">Min</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600">Avg Usage / Day</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600">Days to Stockout</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600">Restock Capital</th>
                                                <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.lowStockAlerts.slice(0, 20).map((alert) => {
                                                const status = getStockStatus(alert.stockRatio, alert.daysToStockout, alert.currentStock)

                                                return (
                                                    <tr key={alert.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-start gap-3">
                                                                <div className={`mt-1 h-2.5 w-2.5 rounded-full ${status.dot}`} />
                                                                <div>
                                                                    <p className="font-medium text-slate-950">{alert.productName}</p>
                                                                    <p className="text-xs text-slate-500">{alert.materialNumber}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-sm text-slate-700">{alert.warehouseName}</td>
                                                        <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-900">{alert.currentStock.toLocaleString()}</td>
                                                        <td className="px-4 py-4 text-right tabular-nums text-slate-600">{alert.minStock.toLocaleString()}</td>
                                                        <td className="px-4 py-4 text-right tabular-nums text-slate-600">{alert.avgDailyUsage > 0 ? alert.avgDailyUsage.toFixed(1) : "No signal"}</td>
                                                        <td className="px-4 py-4 text-right tabular-nums text-slate-900">{formatDaysToStockout(alert.daysToStockout)}</td>
                                                        <td className="px-4 py-4 text-right font-medium tabular-nums text-slate-900">{formatCurrency(alert.recommendedRestockValue)}</td>
                                                        <td className="px-4 py-4 text-center">
                                                            <Badge className={status.badgeClass}>{status.label}</Badge>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Link href="/dashboard/stock-transfers" className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                                                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                                                    Transfer Stock
                                                                </Link>
                                                                <CreatePoEmailButton stockLevelId={alert.id} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] lg:px-6">
                    <Card className={LIGHT_CARD}>
                        <CardHeader>
                            <CardTitle>Top 5 warehouses needing attention</CardTitle>
                            <CardDescription>Scalable widget untuk operasi dengan jaringan gudang yang besar.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {topWarehouseAttention.length === 0 ? (
                                <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">Belum ada sinyal warehouse-level.</div>
                            ) : (
                                topWarehouseAttention.map((warehouse, index) => (
                                    <div key={warehouse.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{index + 1}</span>
                                                    <p className="font-medium text-slate-950">{warehouse.name}</p>
                                                </div>
                                                <p className="mt-1 text-sm text-slate-600">{warehouse.lowStock.toLocaleString()} low stock, {warehouse.outOfStock.toLocaleString()} out of stock</p>
                                            </div>
                                            <p className="text-right text-sm font-medium text-slate-700">
                                                {formatCurrency(warehouse.inventoryAtRisk)}
                                                <span className="mt-1 block text-xs font-normal text-slate-500">inventory at risk</span>
                                            </p>
                                        </div>
                                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                                            <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.max(14, (warehouse.attentionScore / maxAttentionScore) * 100)}%` }} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {data.deadStock.length > 0 ? (
                        <HeatmapChart
                            data={data.deadStock.map((item) => ({
                                category: item.category || "Uncategorized",
                                name: item.productName,
                                value: item.valuationValue,
                                days: item.lastMovement ? Math.floor((Date.now() - item.lastMovement.getTime()) / (1000 * 60 * 60 * 24)) : 0,
                            }))}
                            title="Dead / slow-moving stock concentration"
                            description={`Item pasif yang saat ini menahan modal sebesar ${formatCurrency(deadStockCapital)}.`}
                        />
                    ) : (
                        <ReportEmptyState
                            title="Belum ada sinyal dead / slow-moving stock"
                            description="Ketika ada item stagnan lebih dari 90 hari, area ini akan menampilkannya sebagai sumber pembebasan modal."
                            icon="packageOpen"
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

function SummarySignal({ label, value, text, tone }: { label: string; value: string; text: string; tone: "rose" | "amber" | "emerald" }) {
    const toneClass = {
        rose: "border-rose-200 bg-rose-50/80 text-rose-600",
        amber: "border-amber-200 bg-amber-50/80 text-amber-600",
        emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-600",
    }[tone]

    return (
        <div className={`rounded-2xl border p-4 ${toneClass}`}>
            <p className="text-xs font-medium uppercase tracking-[0.18em]">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
        </div>
    )
}

function PriorityCallout({ icon, title, text, tone }: { icon: ReactNode; title: string; text: string; tone: "rose" | "amber" | "emerald" }) {
    const toneClass = {
        rose: "border-rose-200 bg-rose-50",
        amber: "border-amber-200 bg-amber-50",
        emerald: "border-emerald-200 bg-emerald-50",
    }[tone]

    return (
        <div className={`rounded-2xl border p-4 ${toneClass}`}>
            <div className="flex items-start gap-3">
                {icon}
                <div>
                    <p className="font-medium text-slate-950">{title}</p>
                    <p className="mt-1 text-sm text-slate-600">{text}</p>
                </div>
            </div>
        </div>
    )
}

function CapitalBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "rose" | "amber" }) {
    const barClass = tone === "rose" ? "bg-rose-500" : "bg-amber-500"
    const textClass = tone === "rose" ? "text-rose-700" : "text-amber-700"
    const surface = tone === "rose" ? "bg-rose-50" : "bg-amber-50"

    return (
        <div className={`rounded-2xl border border-slate-200 p-4 ${surface}`}>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-slate-700">{label}</p>
                    <p className={`mt-1 text-2xl font-semibold ${textClass}`}>{formatCurrency(value)}</p>
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{((value / max) * 100).toFixed(0)}% of max</p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(10, (value / max) * 100)}%` }} />
            </div>
        </div>
    )
}

function getStockStatus(stockRatio: number, daysToStockout: number | null, currentStock: number) {
    if (currentStock === 0) return { label: "Out of Stock", badgeClass: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50", dot: "bg-rose-500" }
    if (daysToStockout !== null && daysToStockout <= 7) return { label: "Critical", badgeClass: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50", dot: "bg-rose-500" }
    if (stockRatio < 1 || (daysToStockout !== null && daysToStockout <= 21)) return { label: "Warning", badgeClass: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50", dot: "bg-amber-500" }
    return { label: "Monitor", badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50", dot: "bg-emerald-500" }
}

function formatDaysToStockout(value: number | null) {
    if (value === null) return "No signal"
    if (value < 1) return "< 1 day"
    if (value < 30) return `${value.toFixed(1)} days`
    return `${Math.round(value)} days`
}

function formatCurrency(val: number): string {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)} Miliar`
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)} Juta`
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`
    return `Rp ${val.toLocaleString()}`
}
