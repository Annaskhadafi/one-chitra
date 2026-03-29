"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { AlertTriangle, Boxes, CalendarRange, CircleAlert, Download, PackageSearch, RefreshCcw, Search, ShieldCheck, Tags, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { getProcurementNextAnalytics, type ProcurementNextItem } from "@/app/actions/procurement-next"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ProgressLoading } from "@/components/ui/progress-loading"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type ProcurementAnalyticsData = Awaited<ReturnType<typeof getProcurementNextAnalytics>>["data"]

const FORECAST_ALGORITHM_OPTIONS = [
    { value: "auto_arima", label: "Auto ARIMA" },
    { value: "seasonal", label: "Seasonal" },
    { value: "moving_average", label: "Moving average" },
    { value: "trend", label: "Trend" },
] as const

const GRANULARITY_OPTIONS = [
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
] as const

const priorityBadgeClass: Record<ProcurementNextItem["priority"], string> = {
    urgent: "bg-red-100 text-red-700 border-red-200",
    soon: "bg-amber-100 text-amber-700 border-amber-200",
    watch: "bg-sky-100 text-sky-700 border-sky-200",
    healthy: "bg-emerald-100 text-emerald-700 border-emerald-200",
}

function formatNumber(value: number, maximumFractionDigits = 0) {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
        return "0"
    }
    const fixed = maximumFractionDigits > 0 ? value.toFixed(maximumFractionDigits) : Math.round(value).toString()
    const [whole, fraction] = fixed.split(".")
    const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    return fraction ? `${groupedWhole}.${fraction}` : groupedWhole
}

function formatCompactCurrency(value: number) {
    const absolute = Math.abs(value)
    const sign = value < 0 ? "-" : ""

    if (absolute >= 1_000_000_000) {
        return `${sign}Rp ${formatNumber(absolute / 1_000_000_000, 1)}B`
    }
    if (absolute >= 1_000_000) {
        return `${sign}Rp ${formatNumber(absolute / 1_000_000, 1)}M`
    }
    if (absolute >= 1_000) {
        return `${sign}Rp ${formatNumber(absolute / 1_000, 1)}K`
    }

    return `${sign}Rp ${formatNumber(absolute, 0)}`
}

function formatDaysCover(value: number | null) {
    if (value === null) return "No demand signal"
    if (value < 1) return "< 1 day"
    if (value < 30) return `${value.toFixed(1)} days`
    return `${Math.round(value)} days`
}

function PriorityBadge({ priority }: { priority: ProcurementNextItem["priority"] }) {
    return (
        <Badge variant="outline" className={priorityBadgeClass[priority]}>
            {priority}
        </Badge>
    )
}

export function ProcurementNextClient() {
    const [mounted, setMounted] = useState(false)
    const [horizonMonths, setHorizonMonths] = useState("6")
    const [chartGranularity, setChartGranularity] = useState("monthly")
    const [forecastingAlgorithm, setForecastingAlgorithm] = useState("auto_arima")
    const [category, setCategory] = useState("all")
    const [priority, setPriority] = useState("all")
    const [search, setSearch] = useState("")
    const [isPending, startTransition] = useTransition()
    const [data, setData] = useState<ProcurementAnalyticsData | undefined>()
    const [error, setError] = useState<string | null>(null)

    const loadData = useCallback((
        nextHorizonMonths: string,
        nextChartGranularity: string,
        nextForecastingAlgorithm: string
    ) => {
        startTransition(async () => {
            setError(null)
            const result = await getProcurementNextAnalytics({
                horizonMonths: Number(nextHorizonMonths),
                chartGranularity: nextChartGranularity as "weekly" | "monthly" | "quarterly" | "yearly",
                forecastingAlgorithm: nextForecastingAlgorithm as "auto_arima" | "seasonal" | "moving_average" | "trend",
            })

            if (result.success && result.data) {
                setData(result.data)
                return
            }

            setError(result.error || "Gagal memuat data Procurement Next")
        })
    }, [])

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        loadData("6", "monthly", "auto_arima")
    }, [loadData])

    const categoryOptions = useMemo(() => {
        return Array.from(new Set((data?.items ?? []).map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b))
    }, [data?.items])

    const filteredItems = useMemo(() => {
        const keyword = search.trim().toLowerCase()
        return (data?.items ?? []).filter((item) => {
            const matchesCategory = category === "all" || item.category === category
            const matchesPriority = priority === "all" || item.priority === priority
            if (!matchesCategory) return false
            if (!matchesPriority) return false
            if (!keyword) return true

            return [
                item.materialNumber,
                item.description,
                item.category,
            ]
                .join(" ")
                .toLowerCase()
                .includes(keyword)
        })
    }, [category, data?.items, priority, search])

    const handleExport = useCallback(() => {
        if (filteredItems.length === 0) return

        const headers = [
            "Priority",
            "Material Number",
            "Description",
            "Category",
            "Current Stock",
            "Min Stock",
            "Sold 60D",
            "Monthly Avg",
            "Days Cover 60D",
            "Recommended Qty",
            "Last Sale",
        ]

        const rows = filteredItems.map((item) => [
            item.priority,
            item.materialNumber,
            item.description,
            item.category,
            String(item.currentStock),
            String(item.minStock),
            String(item.sold60d),
            String(item.monthlyAvg),
            item.daysCover60d === null ? "No demand signal" : String(item.daysCover60d),
            String(item.recommendedQty),
            item.lastSaleDate ?? "",
        ])

        const csv = [headers, ...rows]
            .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
            .join("\n")

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `procurement-next-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }, [filteredItems])

    if (!mounted || (!data && isPending)) {
        return (
            <div className="flex min-h-[360px] items-center justify-center rounded-xl border bg-card/60">
                <ProgressLoading message="Menyiapkan procurement analytics..." />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Alert className="border-sky-200 bg-sky-50 text-sky-900">
                <CircleAlert className="h-4 w-4" />
                <AlertTitle>Procurement workspace untuk analitik</AlertTitle>
                <AlertDescription>
                    Rekomendasi di halaman ini disusun dari stok lokal dan histori penjualan. Purchase Order tetap dibuat di SAP, jadi output kita fokus ke prioritas item dan insight replenishment.
                </AlertDescription>
            </Alert>

            <Card className="overflow-hidden border border-sky-200/70 bg-gradient-to-br from-sky-50 via-cyan-50 to-emerald-50 text-slate-900 shadow-[0_18px_50px_rgba(14,165,233,0.12)]">
                <CardContent className="grid gap-6 p-6 md:grid-cols-[1.5fr_1fr]">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-gradient-to-r from-emerald-100 via-cyan-100 to-lime-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-700 shadow-[0_0_20px_rgba(16,185,129,0.10)]">
                            <PackageSearch className="h-3.5 w-3.5" />
                            Procurement cockpit
                        </div>
                        <h2 className="max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">
                            Monitor item yang perlu aksi lebih cepat sebelum stockout terjadi.
                        </h2>
                        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
                            Dashboard ini menggabungkan status stok saat ini, demand historis, dan estimasi kebutuhan replenishment agar tim procurement bisa fokus ke item paling berdampak.
                        </p>
                        <div className="flex flex-wrap gap-3 pt-3">
                            <div className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                                Stockout risk visibility
                            </div>
                            <div className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                                Demand-driven replenishment
                            </div>
                            <div className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                                Analytics only, no SAP PO creation
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-100 via-white to-rose-50 p-4 shadow-[0_10px_30px_rgba(244,63,94,0.08)]">
                            <div className="text-xs uppercase tracking-[0.2em] text-rose-700">Urgent items</div>
                            <div className="mt-2 text-3xl font-bold">{data?.summary.urgentItems ?? 0}</div>
                            <div className="mt-1 text-xs text-rose-700">Perlu perhatian segera</div>
                        </div>
                        <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-100 via-white to-sky-50 p-4 shadow-[0_10px_30px_rgba(34,211,238,0.08)]">
                            <div className="text-xs uppercase tracking-[0.2em] text-cyan-700">Recommended qty</div>
                            <div className="mt-2 text-3xl font-bold">{formatNumber(data?.summary.totalRecommendedQty ?? 0)}</div>
                            <div className="mt-1 text-xs text-cyan-700">Unit estimasi replenishment</div>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-100 via-white to-orange-50 p-4 shadow-[0_10px_30px_rgba(251,191,36,0.08)]">
                            <div className="text-xs uppercase tracking-[0.2em] text-amber-700">Stock value</div>
                            <div className="mt-2 text-3xl font-bold">{formatCompactCurrency(data?.summary.totalStockValue ?? 0)}</div>
                            <div className="mt-1 text-xs text-amber-700">Valuasi stok lokal</div>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-100 via-white to-lime-50 p-4 shadow-[0_10px_30px_rgba(52,211,153,0.08)]">
                            <div className="text-xs uppercase tracking-[0.2em] text-emerald-700">Average cover</div>
                            <div className="mt-2 text-3xl font-bold">
                                {data?.summary.averageDaysCover60d !== null && data?.summary.averageDaysCover60d !== undefined
                                    ? `${data.summary.averageDaysCover60d}d`
                                    : "-"}
                            </div>
                            <div className="mt-1 text-xs text-emerald-700">Rata-rata hari perlindungan stok 60D</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-4">
                    <CardTitle>Filter analysis</CardTitle>
                    <CardDescription>
                        Pilih kategori, priority, dan horizon histori untuk menyesuaikan insight procurement.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="grid flex-1 gap-3 md:grid-cols-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                                History window
                            </div>
                            <Select
                                value={horizonMonths}
                                onValueChange={(value) => {
                                    setHorizonMonths(value)
                                    loadData(value, chartGranularity, forecastingAlgorithm)
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="3">3 months</SelectItem>
                                    <SelectItem value="6">6 months</SelectItem>
                                    <SelectItem value="9">9 months</SelectItem>
                                    <SelectItem value="12">12 months</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Tags className="h-4 w-4 text-muted-foreground" />
                                Category
                            </div>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Semua kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua kategori</SelectItem>
                                    {categoryOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                                Priority
                            </div>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Semua priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua priority</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                    <SelectItem value="soon">Soon</SelectItem>
                                    <SelectItem value="watch">Watch</SelectItem>
                                    <SelectItem value="healthy">Healthy</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                Search item
                            </div>
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Material, deskripsi, kategori..."
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExport} disabled={filteredItems.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => loadData(horizonMonths, chartGranularity, forecastingAlgorithm)}
                            disabled={isPending}
                        >
                            <RefreshCcw className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error ? (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Data procurement belum bisa dimuat</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total SKU monitored</CardDescription>
                        <CardTitle className="text-3xl">{data?.summary.totalItems ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Semua item stok yang masuk workspace procurement.
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Soon to reorder</CardDescription>
                        <CardTitle className="text-3xl text-amber-600">{data?.summary.soonItems ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Item mendekati minimum stock atau cover &lt;= 30 hari.
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Healthy coverage</CardDescription>
                        <CardTitle className="text-3xl text-emerald-600">{data?.summary.healthyItems ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Item yang stoknya masih relatif aman.
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                            Demand forecast
                        </CardTitle>
                        <CardDescription>
                            Grafik dinamis berbasis histori order untuk membaca actual sales, forecast sales, projected stock, dan predicted lost sales.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2 xl:grid-cols-[220px_260px_1fr]">
                            <div className="space-y-2">
                                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                    Granularity
                                </div>
                                <Select
                                    value={chartGranularity}
                                    onValueChange={(value) => {
                                        setChartGranularity(value)
                                        loadData(horizonMonths, value, forecastingAlgorithm)
                                    }}
                                >
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GRANULARITY_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                                    Forecast algorithm
                                </div>
                                <Select
                                    value={forecastingAlgorithm}
                                    onValueChange={(value) => {
                                        setForecastingAlgorithm(value)
                                        loadData(horizonMonths, chartGranularity, value)
                                    }}
                                >
                                    <SelectTrigger className="w-full bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FORECAST_ALGORITHM_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="rounded-xl border border-cyan-200 bg-white px-4 py-3">
                                <div className="text-xs uppercase tracking-[0.18em] text-cyan-700">Forecast note</div>
                                <div className="mt-1 text-sm text-slate-600">
                                    {data?.summary.forecastFallbackReason ?? "Semua angka forecast di chart ini dibaca sebagai qty unit, bukan nilai Rupiah atau Dollar. Auto ARIMA akan mencoba model terbaik dari histori yang tersedia, lalu fallback ke metode lebih aman bila hasilnya tidak stabil."}
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
                                <div className="text-xs uppercase tracking-[0.18em] text-sky-700">Algorithm</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                    {data?.summary.effectiveForecastAlgorithm === "fallback_moving_average"
                                        ? "Fallback Moving Average"
                                        : FORECAST_ALGORITHM_OPTIONS.find((option) => option.value === data?.summary.effectiveForecastAlgorithm)?.label
                                            ?? FORECAST_ALGORITHM_OPTIONS.find((option) => option.value === forecastingAlgorithm)?.label}
                                </div>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                                <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">Forecast Demand Qty</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                    {formatNumber(data?.summary.totalForecastQty ?? 0, 1)}
                                </div>
                                <div className="mt-1 text-xs text-emerald-700">Total unit prediksi demand periode berikutnya</div>
                            </div>
                            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3">
                                <div className="text-xs uppercase tracking-[0.18em] text-rose-700">Potential Lost Qty</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">
                                    {formatNumber(data?.summary.totalPredictedLostSales ?? 0, 1)}
                                </div>
                                <div className="mt-1 text-xs text-rose-700">Estimasi unit demand yang tidak tertutup stok</div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Past Sales Qty</Badge>
                            <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700">Forecast Sales Qty</Badge>
                            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">Projected Stock</Badge>
                            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">Predicted Lost Qty</Badge>
                        </div>
                        <div className="h-[360px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data?.charts.forecastTrend ?? []} margin={{ left: 8, right: 8 }}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                                    <YAxis yAxisId="sales" tickLine={false} axisLine={false} width={56} />
                                    <YAxis yAxisId="stock" orientation="right" tickLine={false} axisLine={false} width={64} />
                                    <Tooltip
                                        formatter={(value: number | null, name: string) => {
                                            if (value === null || value === undefined) return ["-", name]
                                            return [formatNumber(value, 1), name]
                                        }}
                                    />
                                    <Bar yAxisId="sales" dataKey="actualSales" fill="#10b981" radius={[6, 6, 0, 0]} name="Past Sales Qty" />
                                    <Bar yAxisId="sales" dataKey="predictedLostSales" fill="#fb7185" radius={[6, 6, 0, 0]} name="Pred. Lost Qty" />
                                    <Line
                                        yAxisId="stock"
                                        type="monotone"
                                        dataKey="projectedStock"
                                        stroke="#8b5cf6"
                                        strokeWidth={2}
                                        dot={false}
                                        name="Pred. Stock"
                                    />
                                    <Line
                                        yAxisId="sales"
                                        type="monotone"
                                        dataKey="forecastSales"
                                        stroke="#06b6d4"
                                        strokeWidth={3}
                                        dot={{ r: 3, fill: "#06b6d4" }}
                                        activeDot={{ r: 5 }}
                                        name="Pred. Sales Qty"
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-sky-600" />
                            Urgency mix
                        </CardTitle>
                        <CardDescription>Komposisi item berdasarkan level prioritas replenishment.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="h-[240px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data?.charts.urgencyBreakdown ?? []}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={70}
                                        outerRadius={100}
                                        paddingAngle={4}
                                    >
                                        {(data?.charts.urgencyBreakdown ?? []).map((entry) => (
                                            <Cell key={entry.name} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid gap-2">
                            {(data?.charts.urgencyBreakdown ?? []).map((entry) => (
                                <div key={entry.name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                                        {entry.name}
                                    </div>
                                    <span className="font-semibold">{entry.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Boxes className="h-5 w-5 text-amber-600" />
                            Top replenishment candidates
                        </CardTitle>
                        <CardDescription>Item dengan saran quantity tertinggi untuk dipantau procurement.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.charts.topRecommendations ?? []} layout="vertical" margin={{ left: 12, right: 12 }}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                <XAxis type="number" tickLine={false} axisLine={false} />
                                <YAxis
                                    type="category"
                                    dataKey="label"
                                    tickLine={false}
                                    axisLine={false}
                                    width={320}
                                />
                                <Tooltip
                                    formatter={(value: number, _name, payload) => [
                                        `${formatNumber(value)} qty`,
                                        `${payload?.payload?.name ?? "Product"}`,
                                    ]}
                                />
                                <Bar dataKey="qty" fill="#f59e0b" radius={[0, 8, 8, 0]} name="Recommended qty" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            Risk by category
                        </CardTitle>
                        <CardDescription>Kategori dengan tekanan urgent dan soon paling tinggi.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.charts.categoryRisk ?? []}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="category" tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={54} />
                                <YAxis tickLine={false} axisLine={false} />
                                <Tooltip />
                                <Bar dataKey="urgent" stackId="risk" fill="#dc2626" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="soon" stackId="risk" fill="#f59e0b" />
                                <Bar dataKey="watch" stackId="risk" fill="#0ea5e9" />
                                <Bar dataKey="healthy" stackId="risk" fill="#16a34a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Prioritized item list</CardTitle>
                    <CardDescription>
                        Urutan item disusun dari prioritas tertinggi, lalu estimated replenishment quantity.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border">
                        <div className="max-h-[620px] overflow-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background">
                                    <TableRow>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Material</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Current</TableHead>
                                        <TableHead className="text-right">Min</TableHead>
                                        <TableHead className="text-right">Sold 60D</TableHead>
                                        <TableHead className="text-right">Monthly Avg</TableHead>
                                        <TableHead>Days Cover</TableHead>
                                        <TableHead className="text-right">Recommended Qty</TableHead>
                                        <TableHead>Last Sale</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                                                Tidak ada item yang cocok dengan filter saat ini.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredItems.map((item) => (
                                            <TableRow key={`${item.stockLevelId}-${item.materialNumber}`}>
                                                <TableCell><PriorityBadge priority={item.priority} /></TableCell>
                                                <TableCell className="font-semibold">{item.materialNumber}</TableCell>
                                                <TableCell>
                                                    <div className="max-w-[280px] truncate" title={item.description}>
                                                        {item.description}
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">{item.category}</div>
                                                </TableCell>
                                                <TableCell className="text-right">{formatNumber(item.currentStock)}</TableCell>
                                                <TableCell className="text-right">{formatNumber(item.minStock)}</TableCell>
                                                <TableCell className="text-right">{formatNumber(item.sold60d)}</TableCell>
                                                <TableCell className="text-right">{formatNumber(item.monthlyAvg, 1)}</TableCell>
                                                <TableCell>{formatDaysCover(item.daysCover60d)}</TableCell>
                                                <TableCell className="text-right font-semibold">{formatNumber(item.recommendedQty)}</TableCell>
                                                <TableCell>{item.lastSaleDate ?? "-"}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle>How the recommendation is calculated</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                    <div className="rounded-xl border bg-muted/30 p-4">
                        <div className="font-medium text-foreground">Demand signal</div>
                        <p className="mt-2">Menggunakan histori order pada window yang dipilih untuk membaca qty unit terjual per material. Bukan nilai Rupiah atau Dollar.</p>
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-4">
                        <div className="font-medium text-foreground">Coverage logic</div>
                        <p className="mt-2">Days Cover dihitung dari Current Stock dibagi rata-rata demand 60 hari terakhir, jadi default pembacaannya sekarang lebih stabil untuk procurement planning.</p>
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-4">
                        <div className="font-medium text-foreground">Recommended qty</div>
                        <p className="mt-2">Saran replenishment memakai target tertinggi antara minimum stock dan proyeksi 60 hari demand. Ini insight analitik, bukan draft PO.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
