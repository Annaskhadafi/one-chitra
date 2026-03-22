"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import {
    Area,
    Brush,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Scatter,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import {
    AlertCircle,
    Check,
    ChevronsUpDown,
    Filter,
    Info,
    Loader2,
    PackageOpen,
    RefreshCcw,
    ShieldAlert,
    Sparkles,
    Target,
    TrendingDown,
    TrendingUp,
    type LucideIcon,
} from "lucide-react"

import { getRevenueMLForecast } from "@/app/actions/revenue-ml"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
    RevenueMLAnomaly,
    RevenueMLConfidence,
    RevenueMLDiagnostics,
    RevenueMLDriver,
    RevenueMLForecastPoint,
    RevenueMLInsightSummary,
    RevenueMLSimulation,
    RevenueMLStockInsight,
    simulateRevenueScenario,
} from "@/lib/revenue-ml-forecast"
import { calculateMovingAverage } from "@/lib/ai-utils"
import { cn } from "@/lib/utils"

type RevenueFilterOption = {
    id: string
    name: string | null
}

interface MLRevenueClientProps {
    initialFilters: {
        categories: RevenueFilterOption[]
        customers: RevenueFilterOption[]
    }
}

const MOVING_AVERAGE_WINDOW = 6

const calculateTrendline = (values: number[]) => {
    if (values.length < 2) {
        return values.map(() => null as number | null)
    }

    const count = values.length
    const sumX = values.reduce((sum, _value, index) => sum + index, 0)
    const sumY = values.reduce((sum, value) => sum + value, 0)
    const sumXY = values.reduce((sum, value, index) => sum + (index * value), 0)
    const sumXX = values.reduce((sum, _value, index) => sum + (index * index), 0)
    const denominator = (count * sumXX) - (sumX * sumX)

    if (denominator === 0) {
        return values.map(() => null as number | null)
    }

    const slope = ((count * sumXY) - (sumX * sumY)) / denominator
    const intercept = (sumY - (slope * sumX)) / count

    return values.map((_value, index) => Math.max(0, intercept + (slope * index)))
}

const fmt = (value: number, compact = false) => {
    if (compact && value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
    if (compact && value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

const fmtPercent = (value: number) => `${value.toFixed(1)}%`

const getTrendTone = (direction: RevenueMLDriver["direction"]) => {
    if (direction === "positive") return "text-emerald-600 bg-emerald-500/10"
    if (direction === "negative") return "text-rose-600 bg-rose-500/10"
    return "text-slate-600 bg-slate-500/10"
}

const getConfidenceTone = (confidence: RevenueMLConfidence | null) => {
    if (!confidence) return "text-amber-600 bg-amber-500/10 border-amber-500/20"
    if (confidence.tier === "high") return "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
    if (confidence.tier === "medium") return "text-amber-600 bg-amber-500/10 border-amber-500/20"
    return "text-rose-600 bg-rose-500/10 border-rose-500/20"
}

const getStockTone = (stockInsight: RevenueMLStockInsight | null) => {
    if (!stockInsight) return "text-slate-600 bg-slate-500/10 border-slate-500/20"
    if (stockInsight.alertLevel === "healthy") return "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
    if (stockInsight.alertLevel === "watch") return "text-amber-600 bg-amber-500/10 border-amber-500/20"
    if (stockInsight.alertLevel === "restock") return "text-rose-600 bg-rose-500/10 border-rose-500/20"
    return "text-slate-600 bg-slate-500/10 border-slate-500/20"
}

function SearchableCombobox({
    options,
    value,
    onChange,
    placeholder,
    icon: Icon,
    hydrated,
}: {
    options: RevenueFilterOption[]
    value: string
    onChange: (value: string) => void
    placeholder: string
    icon: LucideIcon
    hydrated: boolean
}) {
    const [open, setOpen] = React.useState(false)
    const selected = options.find((option) => option.id === value)

    if (!hydrated) {
        return (
            <Button
                variant="outline"
                type="button"
                disabled
                className="h-10 w-full justify-between border-2 font-bold hover:bg-muted/50 lg:w-[300px]"
            >
                <div className="flex items-center gap-2 truncate">
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{selected ? selected.name : placeholder}</span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
        )
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="h-10 w-full justify-between border-2 font-bold hover:bg-muted/50 lg:w-[300px]"
                >
                    <div className="flex items-center gap-2 truncate">
                        <Icon className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{selected ? selected.name : placeholder}</span>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Cari ${placeholder}...`} />
                    <CommandList>
                        <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                            <CommandItem
                                value="all"
                                onSelect={() => {
                                    onChange("")
                                    setOpen(false)
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", value === "" ? "opacity-100" : "opacity-0")} />
                                Semuanya
                            </CommandItem>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.id}
                                    value={`${option.id} ${option.name}`}
                                    onSelect={() => {
                                        onChange(option.id)
                                        setOpen(false)
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === option.id ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{option.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export function MLRevenueClient({ initialFilters }: MLRevenueClientProps) {
    const [filters, setFilters] = useState({ customer: "", category: "" })
    const [data, setData] = useState<RevenueMLForecastPoint[]>([])
    const [loading, setLoading] = useState(false)
    const [hydrated, setHydrated] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [metrics, setMetrics] = useState({ accuracy: "0", isReliable: false })
    const [insightSummary, setInsightSummary] = useState<RevenueMLInsightSummary | null>(null)
    const [confidence, setConfidence] = useState<RevenueMLConfidence | null>(null)
    const [drivers, setDrivers] = useState<RevenueMLDriver[]>([])
    const [anomalies, setAnomalies] = useState<RevenueMLAnomaly[]>([])
    const [stockInsight, setStockInsight] = useState<RevenueMLStockInsight | null>(null)
    const [simulation, setSimulation] = useState<RevenueMLSimulation | null>(null)
    const [diagnostics, setDiagnostics] = useState<RevenueMLDiagnostics | null>(null)
    const [stockScenarioPct, setStockScenarioPct] = useState([0])
    const [selectedAnomalyMonth, setSelectedAnomalyMonth] = useState<string | null>(null)

    const fetchForecast = async (nextFilters = filters) => {
        setLoading(true)
        setErrorMsg(null)

        const response = await getRevenueMLForecast(nextFilters)
        if (response.success && "data" in response) {
            const processed: RevenueMLForecastPoint[] = response.data.map((point: RevenueMLForecastPoint) => ({
                ...point,
                revenue: point.revenue !== null && !Number.isNaN(point.revenue) ? Number(point.revenue) : null,
                forecast: point.forecast !== null && !Number.isNaN(point.forecast) ? Number(point.forecast) : null,
                upper: point.upper !== null && !Number.isNaN(point.upper) ? Number(point.upper) : null,
                lower: point.lower !== null && !Number.isNaN(point.lower) ? Number(point.lower) : null,
                anomalyValue: point.anomalyValue !== null && !Number.isNaN(point.anomalyValue) ? Number(point.anomalyValue) : null,
            }))

            setData(processed)
            setMetrics({
                accuracy: response.accuracy || "0",
                isReliable: response.isReliable || false,
            })
            setInsightSummary(response.insightSummary || null)
            setConfidence(response.confidence || null)
            setDrivers(response.drivers || [])
            setAnomalies(response.anomalies || [])
            setStockInsight(response.stockInsight || null)
            setSimulation(response.simulation || null)
            setDiagnostics(response.diagnostics || null)
            setSelectedAnomalyMonth(response.anomalies?.[0]?.month || null)
            setStockScenarioPct([0])
        } else {
            setData([])
            setMetrics({ accuracy: "0", isReliable: false })
            setInsightSummary(null)
            setConfidence(null)
            setDrivers([])
            setAnomalies([])
            setStockInsight(null)
            setSimulation(null)
            setDiagnostics(null)
            setSelectedAnomalyMonth(null)
            setErrorMsg(response.error || "Gagal menghasilkan model ML untuk filter ini.")
        }

        setLoading(false)
    }

    useEffect(() => {
        setHydrated(true)
    }, [])

    useEffect(() => {
        fetchForecast()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleRefresh = () => {
        fetchForecast()
    }

    const stockScenarioValue = stockScenarioPct[0] ?? 0
    const historicalSeries = data
        .filter((point) => point.type === "history")
        .map((point) => point.revenue || 0)
    const historicalMovingAverage = calculateMovingAverage(historicalSeries, MOVING_AVERAGE_WINDOW)
    const historicalTrendline = calculateTrendline(historicalSeries)
    let historicalIndex = 0

    const chartData = data.map((point) => {
        const historyPointIndex = point.type === "history" ? historicalIndex++ : -1
        const movingAverage = historyPointIndex >= 0
            ? historicalMovingAverage[historyPointIndex] ?? null
            : null
        const trendline = historyPointIndex >= 0
            ? historicalTrendline[historyPointIndex] ?? null
            : null

        if (point.type !== "forecast" || point.forecast === null || !simulation) {
            return {
                ...point,
                movingAverage,
                trendline,
                scenarioForecast: null as number | null,
            }
        }

        return {
            ...point,
            movingAverage,
            trendline,
            scenarioForecast: Number(simulateRevenueScenario(point.forecast, simulation, stockScenarioValue).toFixed(0)),
        }
    })

    const historicalTotal = data
        .filter((point) => point.type === "history")
        .reduce((sum, point) => sum + (point.revenue || 0), 0)
    const forecastTotal = data
        .filter((point) => point.type === "forecast")
        .reduce((sum, point) => sum + (point.forecast || 0), 0)
    const scenarioTotal = chartData
        .filter((point) => point.type === "forecast")
        .reduce((sum, point) => sum + (point.scenarioForecast || 0), 0)
    const scenarioDeltaPct = forecastTotal > 0
        ? ((scenarioTotal - forecastTotal) / forecastTotal) * 100
        : 0
    const selectedAnomaly = anomalies.find((item) => item.month === selectedAnomalyMonth) || anomalies[0] || null
    const scenarioActive = stockScenarioValue !== 0 && simulation?.baselineCoverageMonths !== null
    const anomalyCount = anomalies.length
    const driverHeadline = drivers[0]?.insight || "Driver utama forecast akan tampil setelah model selesai dihitung."

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-2xl border-2 border-primary/5 bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                <div className="flex w-full flex-col gap-4 lg:w-auto lg:flex-row lg:items-center">
                    <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-primary">
                        <Filter className="h-4 w-4" />
                        Smart Filters
                    </div>

                    <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
                        <SearchableCombobox
                            options={initialFilters.categories}
                            value={filters.category}
                            onChange={(value) => {
                                const nextFilters = { ...filters, category: value }
                                setFilters(nextFilters)
                                fetchForecast(nextFilters)
                            }}
                            placeholder="Pilih Kategori..."
                            icon={Target}
                            hydrated={hydrated}
                        />
                        <SearchableCombobox
                            options={initialFilters.customers}
                            value={filters.customer}
                            onChange={(value) => {
                                const nextFilters = { ...filters, customer: value }
                                setFilters(nextFilters)
                                fetchForecast(nextFilters)
                            }}
                            placeholder="Pilih Customer..."
                            icon={RefreshCcw}
                            hydrated={hydrated}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                        Hybrid Forecast Engine
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="text-xs font-bold uppercase">
                        <RefreshCcw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} />
                        Recalculate
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Card className="border-2 border-primary/5 bg-gradient-to-br from-card to-muted/20 shadow-md">
                    <CardContent className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Historical Revenue</div>
                            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500"><TrendingUp className="h-4 w-4" /></div>
                        </div>
                        <div className="text-2xl font-black tracking-tighter">{fmt(historicalTotal)}</div>
                        <div className="mt-1 text-[10px] font-bold italic text-muted-foreground">Total historis dari SAP</div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-primary/5 bg-gradient-to-br from-card to-muted/20 shadow-md">
                    <CardContent className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Projected Next 12m</div>
                            <div className="rounded-lg bg-pink-500/10 p-2 text-pink-500"><Sparkles className="h-4 w-4" /></div>
                        </div>
                        <div className="text-2xl font-black tracking-tighter">{fmt(forecastTotal)}</div>
                        <div className="mt-1 text-[10px] font-bold italic text-muted-foreground">Forecast hybrid yang sudah distabilkan</div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-primary/5 bg-gradient-to-br from-card to-muted/20 shadow-md">
                    <CardContent className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Confidence Level</div>
                            <div className={cn("rounded-lg border p-2", getConfidenceTone(confidence))}>
                                {confidence?.tier === "high" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                            </div>
                        </div>
                        <div className="flex items-end gap-2">
                            <div className={cn("text-2xl font-black tracking-tighter", confidence?.tier === "high" ? "text-emerald-600" : confidence?.tier === "medium" ? "text-amber-600" : "text-rose-600")}>
                                {metrics.accuracy}%
                            </div>
                            <div className="pb-1 text-xs font-bold uppercase text-muted-foreground">{confidence?.label || "Pending"}</div>
                        </div>
                        <div className="mt-1 text-[10px] font-bold italic text-muted-foreground">{confidence?.note || "Menunggu model selesai dihitung"}</div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-primary/5 bg-gradient-to-br from-card to-muted/20 shadow-md">
                    <CardContent className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Inventory Signal</div>
                            <div className={cn("rounded-lg border p-2", getStockTone(stockInsight))}>
                                {stockInsight?.alertLevel === "restock" ? <ShieldAlert className="h-4 w-4" /> : <PackageOpen className="h-4 w-4" />}
                            </div>
                        </div>
                        <div className="text-2xl font-black tracking-tighter">{stockInsight?.coverageLabel || "Belum ada"}</div>
                        <div className="mt-1 text-[10px] font-bold italic text-muted-foreground">{stockInsight?.title || "Stock signal akan tampil setelah data dipetakan"}</div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-primary/5 bg-primary text-primary-foreground shadow-md">
                    <CardContent className="p-6">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Top Driver</div>
                            {drivers[0]?.direction === "negative" ? <TrendingDown className="h-4 w-4 opacity-70" /> : <TrendingUp className="h-4 w-4 opacity-70" />}
                        </div>
                        <div className="text-sm font-black leading-snug">{drivers[0]?.label || "Menunggu analisa driver"}</div>
                        <div className="mt-3 text-xs font-bold leading-relaxed opacity-90">{driverHeadline}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <Card className="border-2 border-primary/5 shadow-md xl:col-span-7">
                    <CardHeader className="border-b bg-muted/30">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tighter">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                    Executive Summary
                                </CardTitle>
                                <CardDescription className="mt-1 text-xs font-bold uppercase tracking-tight">
                                    Ringkasan siap baca untuk management
                                </CardDescription>
                            </div>
                            <Badge className={cn("border", getConfidenceTone(confidence))}>
                                {confidence?.label || "Pending"}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-5 p-6">
                        <p className="text-sm font-semibold leading-7 text-slate-700">
                            {insightSummary?.executiveSummary || "Executive summary akan muncul setelah model selesai dihitung."}
                        </p>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-primary">Model Narrative</div>
                                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                                    {insightSummary?.narrative || "Belum ada narasi model."}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Decision Hints</div>
                                <div className="mt-2 space-y-2 text-sm font-semibold text-slate-700">
                                    <div>Trend 3 bulan: {insightSummary ? fmtPercent(insightSummary.recentTrendPct) : "-"}</div>
                                    <div>Volatilitas: {insightSummary ? fmtPercent(insightSummary.volatilityCv) : "-"}</div>
                                    <div>Musiman: {insightSummary ? fmtPercent(insightSummary.seasonalityStrength) : "-"}</div>
                                    <div>Anomali utama: {anomalyCount} bulan penting</div>
                                </div>
                            </div>
                        </div>

                        {diagnostics && (
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                <Badge variant="outline">Validasi {diagnostics.validationMonths} bulan</Badge>
                                <Badge variant="outline">Trend {Math.round(diagnostics.hybridWeights.trendSeasonal * 100)}%</Badge>
                                <Badge variant="outline">Recency {Math.round(diagnostics.hybridWeights.adaptiveRecency * 100)}%</Badge>
                                <Badge variant="outline">Seasonal {Math.round(diagnostics.hybridWeights.seasonalNaive * 100)}%</Badge>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-2 border-primary/5 shadow-md xl:col-span-5">
                    <CardHeader className="border-b bg-muted/30">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tighter">
                                    <PackageOpen className="h-5 w-5 text-primary" />
                                    Stock What-If
                                </CardTitle>
                                <CardDescription className="mt-1 text-xs font-bold uppercase tracking-tight">
                                    Simulasi dampak perubahan stok ke forecast
                                </CardDescription>
                            </div>
                            <Badge className={cn("border", getStockTone(stockInsight))}>
                                {stockInsight?.alertLevel || "unknown"}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-5 p-6">
                        <div className={cn("rounded-2xl border p-4", getStockTone(stockInsight))}>
                            <div className="text-sm font-black">{stockInsight?.title || "Stock insight belum tersedia"}</div>
                            <p className="mt-2 text-sm font-semibold leading-6">
                                {stockInsight?.message || "Stock-based alert akan tampil setelah material berhasil dipetakan ke stok SAP."}
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Stock</div>
                                <div className="mt-2 text-lg font-black tracking-tight">{fmt(stockInsight?.currentStockUnits || 0)}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data Coverage</div>
                                <div className="mt-2 text-lg font-black tracking-tight">{stockInsight ? fmtPercent(stockInsight.stockDataCoveragePct) : "0.0%"}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recommended Action</div>
                                <div className="mt-2 text-sm font-black leading-5 tracking-tight">{stockInsight?.actionLabel || "Belum tersedia"}</div>
                            </div>
                        </div>

                        <div className="space-y-4 rounded-2xl border border-primary/10 bg-primary/5 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-primary">Scenario Slider</div>
                                    <div className="mt-1 text-sm font-semibold text-slate-700">
                                        Ubah stok segment ini {stockScenarioValue > 0 ? `naik ${stockScenarioValue}%` : stockScenarioValue < 0 ? `turun ${Math.abs(stockScenarioValue)}%` : "tetap baseline"}
                                    </div>
                                </div>
                                <div className="rounded-full bg-white px-3 py-1 text-sm font-black text-primary shadow-sm">
                                    {stockScenarioValue > 0 ? "+" : ""}{stockScenarioValue}%
                                </div>
                            </div>
                            <Slider
                                value={stockScenarioPct}
                                onValueChange={setStockScenarioPct}
                                min={-30}
                                max={50}
                                step={5}
                                disabled={!simulation || simulation.baselineCoverageMonths === null}
                            />
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-600">
                                <span>Baseline</span>
                                <span>Recommended: +{simulation?.recommendedStockChangePct || 0}%</span>
                            </div>
                            <div className="rounded-2xl bg-white p-4 shadow-sm">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Revenue Impact</div>
                                <div className="mt-2 flex items-end gap-2">
                                    <div className={cn("text-2xl font-black tracking-tight", scenarioDeltaPct >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                        {scenarioDeltaPct >= 0 ? "+" : ""}{scenarioDeltaPct.toFixed(1)}%
                                    </div>
                                    <div className="pb-1 text-xs font-bold uppercase text-muted-foreground">vs baseline forecast</div>
                                </div>
                                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                                    {scenarioActive
                                        ? `Jika stok diubah ${stockScenarioValue > 0 ? "naik" : "turun"} ${Math.abs(stockScenarioValue)}%, total forecast 12 bulan berubah menjadi ${fmt(scenarioTotal)}.`
                                        : "Gunakan slider untuk melihat dampak kesiapan stok terhadap forecast 12 bulan ke depan."}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="min-h-[680px] overflow-hidden border-2 border-primary/5 shadow-xl">
                <CardHeader className="border-b bg-muted/30 px-4 py-6 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tighter">
                                <Target className="h-6 w-6 text-primary" />
                                Revenue Projection Timeline
                            </CardTitle>
                            <CardDescription className="mt-1 text-xs font-bold uppercase tracking-tight">
                                Histori revenue vs hybrid forecast, confidence range, anomaly, dan skenario stok
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase sm:gap-5">
                            <div className="flex items-center gap-2 text-blue-500">
                                <div className="h-3 w-3 rounded-full bg-blue-500" />
                                <span>Actual Revenue</span>
                            </div>
                            <div className="flex items-center gap-2 text-pink-500">
                                <div className="h-3 w-3 rounded-full border-2 border-dashed border-pink-500 bg-pink-500/20" />
                                <span>Hybrid Forecast</span>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-500">
                                <div className="h-3 w-3 rounded-full border-2 border-emerald-500 bg-emerald-500/20" />
                                <span>What-If</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                                <div className="h-3 w-3 rounded-full border-2 border-dashed border-slate-500 bg-slate-500/10" />
                                <span>{MOVING_AVERAGE_WINDOW}M Moving Avg</span>
                            </div>
                            <div className="flex items-center gap-2 text-teal-700">
                                <div className="h-3 w-3 rounded-full border-2 border-dashed border-teal-700 bg-teal-700/10" />
                                <span>Trendline</span>
                            </div>
                            <div className="flex items-center gap-2 text-amber-500">
                                <div className="h-3 w-3 rounded-full bg-amber-500" />
                                <span>Anomaly</span>
                            </div>
                            {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="bg-card px-6 pt-10">
                    <div className="h-[520px] w-full">
                        {errorMsg ? (
                            <div className="flex h-full flex-col items-center justify-center gap-4 text-amber-500/80">
                                <AlertCircle className="mb-2 h-16 w-16 opacity-40" />
                                <div className="max-w-sm text-center">
                                    <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-amber-600">Info Model ML</h3>
                                    <p className="text-xs font-bold leading-relaxed">{errorMsg}</p>
                                </div>
                            </div>
                        ) : data.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 30, bottom: 60 }}>
                                    <defs>
                                        <linearGradient id="colorRevenueArea" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.14} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(0,0,0,0.06)" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }}
                                        tickFormatter={(value) => {
                                            if (!value || typeof value !== "string") return ""
                                            const [year, month] = value.split("-")
                                            return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1] || month} ${year}`
                                        }}
                                        angle={-45}
                                        textAnchor="end"
                                        interval={Math.ceil(chartData.length / 20)}
                                        stroke="#cbd5e1"
                                        dy={10}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fontWeight: "bold", fill: "#64748b" }}
                                        tickFormatter={(value) => fmt(value, true)}
                                        stroke="#cbd5e1"
                                        dx={-10}
                                    />
                                    <Tooltip
                                        formatter={(value: number, name: string) => {
                                            if (name === "upper" || name === "lower") return null
                                            if (name === "anomalyValue") return [fmt(value), "Anomaly"]
                                            if (name === "scenarioForecast") return [fmt(value), "What-If Forecast"]
                                            if (name === "movingAverage") return [fmt(value), `${MOVING_AVERAGE_WINDOW}M Moving Average`]
                                            if (name === "trendline") return [fmt(value), "Trendline"]
                                            return [fmt(value), name === "revenue" ? "Actual Revenue" : "Hybrid Forecast"]
                                        }}
                                        contentStyle={{
                                            fontSize: 12,
                                            borderRadius: 20,
                                            border: "none",
                                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                                            padding: "16px",
                                            backgroundColor: "rgba(255, 255, 255, 0.96)",
                                            backdropFilter: "blur(8px)",
                                        }}
                                        labelStyle={{ fontWeight: "bold", marginBottom: 8, color: "#1e293b" }}
                                        itemStyle={{ fontWeight: 700 }}
                                    />

                                    <Area name="Confidence Range" type="monotone" dataKey="upper" stroke="none" fill="rgba(236, 72, 153, 0.06)" />
                                    <Area type="monotone" dataKey="lower" stroke="none" fill="#ffffff" />
                                    <Area type="monotone" dataKey="revenue" stroke="none" fill="url(#colorRevenueArea)" />

                                    <Line
                                        name="revenue"
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#6366f1"
                                        strokeWidth={4}
                                        dot={false}
                                        activeDot={{ r: 8, strokeWidth: 0, fill: "#6366f1" }}
                                        connectNulls
                                    />
                                    <Line
                                        name="forecast"
                                        type="monotone"
                                        dataKey="forecast"
                                        stroke="#ec4899"
                                        strokeWidth={4}
                                        dot={{ r: 4, fill: "#ec4899", strokeWidth: 0 }}
                                        activeDot={{ r: 8, strokeWidth: 0, fill: "#ec4899" }}
                                    />
                                    <Line
                                        name="movingAverage"
                                        type="monotone"
                                        dataKey="movingAverage"
                                        stroke="#64748b"
                                        strokeWidth={3}
                                        strokeDasharray="7 5"
                                        dot={false}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: "#64748b" }}
                                        connectNulls
                                    />
                                    <Line
                                        name="trendline"
                                        type="linear"
                                        dataKey="trendline"
                                        stroke="#0f766e"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: "#0f766e" }}
                                        connectNulls
                                    />
                                    {scenarioActive && (
                                        <Line
                                            name="scenarioForecast"
                                            type="monotone"
                                            dataKey="scenarioForecast"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            dot={false}
                                            activeDot={{ r: 7, strokeWidth: 0, fill: "#10b981" }}
                                        />
                                    )}
                                    <Scatter
                                        name="anomalyValue"
                                        dataKey="anomalyValue"
                                        fill="#f59e0b"
                                        onClick={(value: { month?: string | number }) => {
                                            if (value?.month && typeof value.month === "string") {
                                                setSelectedAnomalyMonth(value.month)
                                            }
                                        }}
                                    />
                                    <Brush
                                        dataKey="month"
                                        height={48}
                                        stroke="#6366f1"
                                        fill="rgba(99, 102, 241, 0.03)"
                                        startIndex={chartData.length > 36 ? chartData.length - 36 : 0}
                                        endIndex={chartData.length > 0 ? chartData.length - 1 : 0}
                                        tickFormatter={(value) => value ? value.split("-")[0] : ""}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : loading ? (
                            <div className="flex h-full flex-col items-center justify-center gap-4">
                                <div className="relative">
                                    <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                                    <Target className="absolute left-3 top-3 h-6 w-6 animate-pulse text-primary" />
                                </div>
                                <div className="text-center">
                                    <span className="text-sm font-black uppercase tracking-widest text-primary animate-pulse">Analyzing Patterns...</span>
                                    <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">Decomposing trend, seasonality, stock, and anomalies</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
                                <div className="rounded-full bg-muted/40 p-8">
                                    <TrendingUp className="h-16 w-16 opacity-10" />
                                </div>
                                <div className="text-center">
                                    <span className="text-sm font-black uppercase tracking-widest opacity-40">Ready to Forecast</span>
                                    <p className="mt-1 text-xs font-bold">Gunakan filter untuk memulai kalkulasi prediktif</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        <Badge variant="outline">Klik titik anomaly untuk root cause</Badge>
                        {scenarioActive && <Badge variant="outline">Scenario aktif {stockScenarioValue > 0 ? "+" : ""}{stockScenarioValue}% stok</Badge>}
                        {diagnostics && <Badge variant="outline">History {diagnostics.historyMonths} bulan</Badge>}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <Card className="border-2 border-primary/5 shadow-md xl:col-span-5">
                    <CardHeader className="border-b bg-muted/30">
                        <CardTitle className="text-xl font-black tracking-tighter">Forecast Drivers</CardTitle>
                        <CardDescription className="text-xs font-bold uppercase tracking-tight">
                            Kenapa angka forecast bergerak seperti ini
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-6">
                        {drivers.length > 0 ? (
                            drivers.map((driver) => (
                                <div key={driver.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-black text-slate-900">{driver.label}</div>
                                            <div className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{driver.valueLabel}</div>
                                        </div>
                                        <div className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase", getTrendTone(driver.direction))}>
                                            {driver.direction}
                                        </div>
                                    </div>
                                    <div className="mt-3 h-2 rounded-full bg-slate-200">
                                        <div
                                            className={cn(
                                                "h-2 rounded-full",
                                                driver.direction === "positive"
                                                    ? "bg-emerald-500"
                                                    : driver.direction === "negative"
                                                        ? "bg-rose-500"
                                                        : "bg-slate-400"
                                            )}
                                            style={{ width: `${Math.max(8, Math.min(driver.impactScore, 100))}%` }}
                                        />
                                    </div>
                                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{driver.insight}</p>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm font-semibold text-slate-500">
                                Driver analysis akan tampil setelah model berhasil dihitung.
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-2 border-primary/5 shadow-md xl:col-span-7">
                    <CardHeader className="border-b bg-muted/30">
                        <CardTitle className="text-xl font-black tracking-tighter">Anomaly Explorer</CardTitle>
                        <CardDescription className="text-xs font-bold uppercase tracking-tight">
                            Klik bulan anomali untuk melihat root cause singkat
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 p-6 lg:grid-cols-[280px_1fr]">
                        <div className="space-y-3">
                            {anomalies.length > 0 ? (
                                anomalies.map((anomaly) => (
                                    <button
                                        key={anomaly.month}
                                        type="button"
                                        onClick={() => setSelectedAnomalyMonth(anomaly.month)}
                                        className={cn(
                                            "w-full rounded-2xl border p-4 text-left transition-colors",
                                            selectedAnomaly?.month === anomaly.month
                                                ? "border-primary bg-primary/5"
                                                : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-black text-slate-900">{anomaly.label}</div>
                                            <Badge className={cn("border", anomaly.severity === "high" ? "border-rose-500/20 bg-rose-500/10 text-rose-600" : "border-amber-500/20 bg-amber-500/10 text-amber-600")}>
                                                {anomaly.severity}
                                            </Badge>
                                        </div>
                                        <div className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                            {anomaly.impactPct > 0 ? "+" : ""}{anomaly.impactPct.toFixed(1)}% vs baseline
                                        </div>
                                        <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{anomaly.shortReason}</p>
                                    </button>
                                ))
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm font-semibold text-slate-500">
                                    Tidak ada anomali penting pada segmen ini.
                                </div>
                            )}
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
                            {selectedAnomaly ? (
                                <div className="space-y-5">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Badge className="border-primary/20 bg-primary/10 text-primary">{selectedAnomaly.label}</Badge>
                                        <Badge className={cn("border", selectedAnomaly.impactPct >= 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-rose-500/20 bg-rose-500/10 text-rose-600")}>
                                            {selectedAnomaly.impactPct >= 0 ? "+" : ""}{selectedAnomaly.impactPct.toFixed(1)}% variance
                                        </Badge>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actual Revenue</div>
                                            <div className="mt-2 text-xl font-black tracking-tight">{fmt(selectedAnomaly.actualRevenue)}</div>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Expected Baseline</div>
                                            <div className="mt-2 text-xl font-black tracking-tight">{fmt(selectedAnomaly.expectedRevenue)}</div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-primary/10 bg-primary/5 p-5">
                                        <div className="flex items-center gap-2 text-sm font-black text-primary">
                                            <Info className="h-4 w-4" />
                                            Root Cause Summary
                                        </div>
                                        <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">
                                            {selectedAnomaly.reason}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-center text-slate-500">
                                    <AlertCircle className="h-10 w-10 opacity-40" />
                                    <p className="max-w-md text-sm font-semibold leading-6">
                                        Pilih bulan anomali dari daftar kiri untuk melihat penjelasan singkat dan membedakan apakah penurunan dipicu demand, kalender kerja, atau indikasi tekanan stok.
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
