"use client"

import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, LabelList } from "recharts"

interface TargetData { revenue: number; forecast: number }

interface RevenueClientProps {
    initialData: {
        period: string
        isYearlyView: boolean
        targets: {
            consolidate: TargetData
            primeProduct: TargetData
            service: TargetData
            pa: TargetData
            paService: TargetData
            ck: TargetData
            sis: TargetData
            ma_oc: TargetData
            ma_ws: TargetData
            ma_fq: TargetData
            ma_br: TargetData
            ma_ag: TargetData
            ma_mc: TargetData
        }
        materials: Array<{ desc: string; revenue: number; qty: number }>
        revTypes: Array<{ type: string; total: number }>
        matGroups: Array<{ desc: string; revenue: number }>
        ytdChart: Array<{ name: string; revenue: number; forecast: number }>
    }
    selectedPeriod: string
    inventoryData?: { jasum: number; kalEi: number; singapore: number; total: number } | null
    isExporting?: boolean
}

const fmt = (v: number) => {
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

const pct = (r: number, f: number) => f > 0 ? Math.min((r / f) * 100, 999) : 0
const pctColor = (p: number) => p >= 100 ? "text-green-600" : p >= 80 ? "text-blue-600" : p >= 50 ? "text-amber-500" : "text-red-500"

const PIE_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#14b8a6']

const renderAchievementLabel = (props: {
    x?: number | string
    y?: number | string
    width?: number | string
    value?: number | string
    payload?: { revenue?: number; forecast?: number }
}) => {
    const { x = 0, y = 0, width = 0, payload } = props
    const safeX = typeof x === "number" ? x : Number(x) || 0
    const safeY = typeof y === "number" ? y : Number(y) || 0
    const safeWidth = typeof width === "number" ? width : Number(width) || 0
    const revenue = Number(payload?.revenue ?? 0)
    const forecast = Number(payload?.forecast ?? 0)
    if (!forecast || !Number.isFinite(forecast)) return null

    const achievement = pct(revenue, forecast)

    return (
        <text
            x={safeX + safeWidth / 2}
            y={safeY - 18}
            textAnchor="middle"
            fill="#64748b"
            fillOpacity="0.5"
            fontSize={10}
            fontWeight={600}
        >
            {achievement.toFixed(1)}%
        </text>
    )
}

// Mini horizontal gauge bar
function MiniGauge({
    label,
    data,
    colorClass = "bg-indigo-500",
    textClass = "text-indigo-600",
    showProgress = true,
    showPercentage = true,
    emphasizeRevenue = false,
    isExporting = false,
}: {
    label: string
    data: TargetData
    colorClass?: string
    textClass?: string
    showProgress?: boolean
    showPercentage?: boolean
    emphasizeRevenue?: boolean
    isExporting?: boolean
}) {
    const p = pct(data.revenue, data.forecast)
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-foreground truncate max-w-[140px]" title={label}>{label}</span>
                {showPercentage ? <span className={`font-black ${textClass}`}>{p.toFixed(1)}%</span> : null}
            </div>
            {showProgress ? (
                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${Math.min(p, 100)}%` }} />
                </div>
            ) : null}
            <div className={`flex justify-between items-end ${isExporting ? "text-[8px]" : "text-[10px]"} text-muted-foreground font-medium`}>
                <span className={emphasizeRevenue ? (isExporting ? "text-[8px]" : "text-[10px]") : ""}>F: {fmt(data.forecast)}</span>
                <span className={emphasizeRevenue ? (isExporting ? "text-sm font-black text-primary leading-none" : "text-xl font-black text-primary leading-none") : ""}>R: {fmt(data.revenue)}</span>
            </div>
        </div>
    )
}

// Compact percentage badge card
function SalesmanCard({ label, data, isExporting = false }: { label: string; data: TargetData; isExporting?: boolean }) {
    const p = pct(data.revenue, data.forecast)
    const getTheme = (val: number) => {
        if (val >= 100) return { bg: 'text-emerald-500', stroke: '#10b981', lightBg: 'bg-emerald-50 dark:bg-emerald-950/30' }
        if (val >= 80) return { bg: 'text-blue-500', stroke: '#3b82f6', lightBg: 'bg-blue-50 dark:bg-blue-950/30' }
        if (val >= 50) return { bg: 'text-amber-500', stroke: '#f59e0b', lightBg: 'bg-amber-50 dark:bg-amber-950/30' }
        return { bg: 'text-red-500', stroke: '#ef4444', lightBg: 'bg-red-50 dark:bg-red-950/30' }
    }
    const theme = getTheme(p)

    const radius = 36; const circ = Math.PI * radius
    const dashOffset = circ - (Math.min(p, 100) / 100) * circ

    return (
        <div className="bg-card border rounded-xl p-3.5 flex flex-col hover:border-primary/50 transition-colors shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2 z-10 w-full relative">
                <div className="text-xs font-black text-muted-foreground uppercase tracking-tight w-full">{label}</div>
            </div>

            <div className="relative w-full h-[54px] flex justify-center items-center mb-2 z-10">
                <div className="relative w-[100px] h-[54px]">
                    <svg viewBox="0 0 84 46" className="w-full h-full drop-shadow-sm">
                        <path
                            d="M 6,40 A 36,36 0 0,1 78,40"
                            fill="none"
                            className={isExporting ? "" : "stroke-muted/30"}
                            stroke={isExporting ? "#9ca3af" : undefined}
                            strokeWidth="10"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 6,40 A 36,36 0 0,1 78,40"
                            fill="none"
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={circ}
                            strokeDashoffset={dashOffset}
                            stroke={theme.stroke}
                            className="transition-all duration-1000"
                        />
                    </svg>
                    <div className={`absolute bottom-0 left-0 w-full text-center text-lg font-black ${theme.bg}`}>
                        {p.toFixed(0)}%
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-end gap-1 mt-auto z-10 w-full pt-1 border-t border-muted/20">
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[7px] font-bold text-muted-foreground uppercase leading-none mb-0.5">Forecast</span>
                    <span className={`${isExporting ? "text-[8px]" : "text-[9px]"} font-extrabold tracking-tighter leading-none`}>{fmt(data.forecast)}</span>
                </div>
                <div className="flex flex-col text-right min-w-0 flex-1">
                    <span className="text-[7px] font-bold text-primary/70 uppercase leading-none mb-0.5">Revenue</span>
                    <span className={`${isExporting ? "text-[8px]" : "text-[10px]"} font-black text-primary tracking-tighter leading-none`}>{fmt(data.revenue)}</span>
                </div>
            </div>

        </div>
    )
}

// Customer details (CK/SIS)
function CustomerGauge({ label, data, colorClass = "bg-gray-500", textClass = "text-gray-700 dark:text-gray-300", strokeColor = "#6b7280", isExporting = false }: { label: string; data: TargetData; colorClass?: string; textClass?: string; strokeColor?: string; isExporting?: boolean }) {
    const p = pct(data.revenue, data.forecast)
    const radius = 56; const circ = Math.PI * radius
    const dashOffset = circ - (Math.min(p, 100) / 100) * circ

    return (
        <div className={`bg-card border rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all`}>
            {/* Top color bar */}
            <div className={`absolute top-0 left-0 w-full h-1 ${colorClass} opacity-80 z-10`} />

            <div className="flex justify-between items-start mb-2 mt-1 z-10 w-full relative">
                <div className="flex flex-col">
                    <div className="text-xs font-black text-muted-foreground uppercase tracking-wider">{label}</div>
                    <div className={`${isExporting ? "text-lg" : "text-2xl"} font-black mt-1 tracking-tighter leading-none`}>{fmt(data.forecast)}</div>
                    <div className="text-[10px] uppercase text-muted-foreground font-bold mt-1">Forecast</div>
                </div>
            </div>

            <div className="relative w-full h-[80px] flex justify-center items-center my-3 z-10">
                <div className="relative w-[150px] h-[80px]">
                    <svg viewBox="0 0 128 72" className="w-full h-full drop-shadow-md">
                        <path
                            d="M 8,64 A 56,56 0 0,1 120,64"
                            fill="none"
                            className={isExporting ? "" : "stroke-muted/30"}
                            stroke={isExporting ? "#9ca3af" : undefined}
                            strokeWidth="12"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 8,64 A 56,56 0 0,1 120,64"
                            fill="none"
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={circ}
                            strokeDashoffset={dashOffset}
                            stroke={strokeColor}
                            className="transition-all duration-1000"
                        />
                    </svg>
                    <div className={`absolute bottom-0 left-0 w-full text-center text-3xl font-black ${textClass}`}>
                        {p.toFixed(1)}%
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-end z-10">
                <div className={`${isExporting ? "text-lg" : "text-xl"} font-black text-primary tracking-tighter leading-none`}>{fmt(data.revenue)}</div>
                <div className="text-[10px] uppercase text-primary/70 font-bold mt-1">Revenue</div>
            </div>
        </div>
    )
}

// Big category card (Service / PA / PA+Service / Prime Product)
function CategoryCard({ label, data, colorClass = "bg-blue-500", textClass = "text-blue-700 dark:text-blue-400", lightBg = "bg-blue-50/50 dark:bg-blue-950/20", hideStats = false, largeRevenue = false }: {
    label: string; data: TargetData; colorClass?: string; textClass?: string; lightBg?: string; hideStats?: boolean; largeRevenue?: boolean
}) {
    const p = pct(data.revenue, data.forecast)
    return (
        <div className={`rounded-xl border ${lightBg} p-5 flex flex-col gap-3 shadow-sm relative overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${colorClass}`} />

            <div className="flex justify-between items-start">
                <div className="text-[11px] font-black uppercase text-muted-foreground tracking-wider line-clamp-2 max-w-[65%] pl-2">{label}</div>
                {!hideStats && <div className={`text-3xl font-black ${textClass} drop-shadow-sm`}>{p.toFixed(1)}%</div>}
            </div>

            <div className="flex justify-between items-end mt-4 pl-2">
                {!hideStats && (
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">Forecast</span>
                        <span className={`${largeRevenue ? 'text-lg' : 'text-base'} font-black tracking-tight`}>{fmt(data.forecast)}</span>
                    </div>
                )}
                <div className={`flex flex-col ${hideStats ? 'w-full' : 'text-right'}`}>
                    <span className="text-[10px] text-primary/70 font-bold uppercase">Revenue</span>
                    <span className={`${largeRevenue ? 'text-xl' : 'text-lg'} font-black text-primary tracking-tighter`}>{fmt(data.revenue)}</span>
                </div>
            </div>

            {!hideStats && (
                <div className="h-1.5 bg-black/5 dark:bg-white/10 rounded-full w-[calc(100%-8px)] ml-2 overflow-hidden mt-3">
                    <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${Math.min(p, 100)}%` }} />
                </div>
            )}
        </div>
    )
}

// Big consolidate gauge (center piece)
function ConsolidateGauge({ data, isExporting = false }: { data: TargetData, isExporting?: boolean }) {
    const p = pct(data.revenue, data.forecast)
    return (
        <div className="bg-card border-2 border-primary/10 rounded-xl p-6 flex flex-col items-center justify-center h-full shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

            <h2 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-6 relative z-10 text-center">Consolidate Summary</h2>

            <div className="flex flex-col items-center justify-center relative z-10 mb-8 w-full">
                <div className={`text-5xl lg:text-6xl font-black tracking-tighter ${pctColor(p)} drop-shadow-sm flex items-baseline`}>
                    {p.toFixed(1)}<span className="text-3xl font-bold">%</span>
                </div>
                <div className="h-2 w-48 bg-muted/50 mt-5 rounded-full overflow-hidden shadow-inner">
                    <div className={`h-full rounded-full ${p >= 100 ? 'bg-emerald-500' : p >= 80 ? 'bg-blue-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(p, 100)}%` }} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full relative z-10 bg-muted/30 p-4 rounded-xl border border-muted/50">
                <div className="text-center">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Forecast</div>
                    <div className={`${isExporting ? "text-[11px]" : "text-sm"} font-black text-foreground tracking-tighter`}>{fmt(data.forecast)}</div>
                </div>
                <div className="text-center border-l border-border/50">
                    <div className="text-[10px] font-bold text-primary/70 uppercase tracking-wider mb-1">Revenue</div>
                    <div className={`${isExporting ? "text-[12px]" : "text-sm"} font-black text-primary tracking-tighter`}>{fmt(data.revenue)}</div>
                </div>
            </div>
        </div>
    )
}

function InventoryPieChart({ data }: { data: { jasum: number; kalEi: number; singapore: number; total: number } }) {
    if (!data) return null;
    
    const chartData = [
        { name: 'Jakarta - Sumatera', value: data.jasum, fill: '#f59e0b' },      // Orange
        { name: 'KALIMANTAN', value: data.kalEi, fill: '#3b82f6' },              // Blue
        { name: 'Singapore', value: data.singapore, fill: '#10b981' }            // Green
    ];

    return (
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="px-4 py-3 bg-blue-600 flex justify-between items-start">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white">Total Inventory (USD)</h3>
                <div className="text-right">
                    <div className="text-[10px] text-white/70 font-bold uppercase">Total Valuasi</div>
                    <div className="text-sm font-black text-white">${fmt(data.total)}</div>
                </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] relative">
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                                nameKey="name"
                                label={false}
                                isAnimationActive={false}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip 
                                formatter={(value: number) => `$ ${fmt(value)}`}
                                contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    
                    <div className="w-full flex flex-col gap-2 mt-2">
                        {chartData.map((item, i) => (
                            <div key={i} className="flex justify-between items-center text-xs px-2 py-1.5 rounded-md bg-muted/40">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                                    <span className="font-semibold tracking-tight">{item.name}</span>
                                </div>
                                <span className="font-black">${fmt(item.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

import { toast } from "sonner"

export function RevenueClient({ initialData, selectedPeriod, inventoryData, isExporting = false }: RevenueClientProps) {
    const router = useRouter()
    const dashboardRef = useRef<HTMLDivElement>(null)
    const [isExportingJpg, setIsExportingJpg] = useState(false)
    const { targets, materials, revTypes, matGroups, ytdChart } = initialData
    const periodOptions = useMemo(() => {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1
        const selectedYear = selectedPeriod.includes(".")
            ? Number(selectedPeriod.split(".")[1])
            : Number(selectedPeriod)
        const selectedMonth = selectedPeriod.includes(".")
            ? Number(selectedPeriod.split(".")[0])
            : null
        const startYear = 2025
        const maxYear = Math.max(currentYear, Number.isFinite(selectedYear) ? selectedYear : currentYear)
        const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
        const options: Array<{ value: string; label: string }> = []

        for (let year = maxYear; year >= startYear; year -= 1) {
            options.push({
                value: String(year),
                label: `Yearly ${year}`,
            })

            const maxMonthForYear = year < currentYear
                ? 12
                : Math.max(currentMonth, year === selectedYear && selectedMonth ? selectedMonth : 0)

            for (let month = maxMonthForYear; month >= 1; month -= 1) {
                options.push({
                    value: `${String(month).padStart(2, "0")}.${year}`,
                    label: `${monthLabels[month - 1]} ${year}`,
                })
            }
        }

        if (!options.some((option) => option.value === selectedPeriod)) {
            options.unshift({
                value: selectedPeriod,
                label: selectedPeriod.includes(".") ? selectedPeriod : `Yearly ${selectedPeriod}`,
            })
        }

        return options
    }, [selectedPeriod])

    const handlePeriodChange = (value: string) => {
        router.push(`/dashboard/revenue-forecast?period=${encodeURIComponent(value)}`)
        router.refresh()
    }

    const handleExportJPG = async () => {
        if (!dashboardRef.current) return

        try {
            setIsExportingJpg(true)
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

            const { toJpeg } = await import("html-to-image")
            const dataUrl = await toJpeg(dashboardRef.current, {
                backgroundColor: "#ffffff",
                quality: 0.95,
                pixelRatio: 1.5,
                filter: (node) => {
                    const exclusionClasses = ['export-button-hide']
                    return !exclusionClasses.some(className => 
                        (node instanceof HTMLElement) && node.classList.contains(className)
                    )
                }
            })

            const link = document.createElement("a")
            link.download = `revenue-forecast-${selectedPeriod}.jpg`
            link.href = dataUrl
            link.click()
            toast.success("Dashboard exported as JPG.")
        } catch (error) {
            console.error("Export failed:", error)
            toast.error("Export failed.")
        } finally {
            setIsExportingJpg(false)
        }
    }

    const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    const ytdFormatted = ytdChart.map(y => {
        const [mm] = y.name.split(".")
        const monthIdx = parseInt(mm, 10) - 1
        const forecast = 'forecast' in y ? y.forecast : 0
        const revenue = y.revenue
        return {
            name: MONTHS_SHORT[monthIdx] ?? y.name,
            revenue,
            forecast,
            achievementPct: pct(revenue, forecast),
        }
    })

    return (
        <div ref={dashboardRef} className="space-y-4 pb-8 p-4 bg-background">
            {/* ─── HEADER ──────────────────────────────────────────────────────── */}
            <div className="bg-card border rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">📊</div>
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Dashboard Monitoring</div>
                                <div className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
                                    Period: {selectedPeriod}
                                </div>
                            </div>
                            <h1 className="text-lg font-black text-primary leading-tight">Sales Revenue</h1>
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 font-semibold italic">
                        VISION &quot;TO BE THE TRUSTED LEADER IN MINING TIRE SOLUTION&quot;
                    </p>
                    <div className="flex gap-2 mt-1.5">
                        {['Resilience', 'Adaptive', 'Creative', 'Assertive Leader'].map((v, i) => (
                            <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${['bg-green-100 text-green-700', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-gray-900 text-white'][i]}`}>{v}</span>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={isExportingJpg}
                        className="h-8 text-xs font-bold gap-2 border-blue-200 hover:bg-blue-50 text-blue-700 export-button-hide"
                        onClick={handleExportJPG}
                    >
                        <Download className="w-3.5 h-3.5" />
                        {isExportingJpg ? "Exporting..." : "Export JPG"}
                    </Button>
                    <div className="flex items-center gap-2 export-button-hide">
                        <span className="text-xs font-bold">Period:</span>
                        <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                            <SelectTrigger className="w-[160px] h-8 text-xs border-primary/30 font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {periodOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="space-y-4 p-1">

            {/* ─── ROW 1: Consolidate + Salesman + Customer ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-3">
                    <ConsolidateGauge data={targets.consolidate} isExporting={isExporting || isExportingJpg} />
                </div>
                <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <SalesmanCard label="MA OC" data={targets.ma_oc} isExporting={isExporting || isExportingJpg} />
                    <SalesmanCard label="MA WS" data={targets.ma_ws} isExporting={isExporting || isExportingJpg} />
                    <SalesmanCard label="MA AG" data={targets.ma_ag} isExporting={isExporting || isExportingJpg} />
                    <SalesmanCard label="MA BR" data={targets.ma_br} isExporting={isExporting || isExportingJpg} />
                    <SalesmanCard label="MA FQ" data={targets.ma_fq} isExporting={isExporting || isExportingJpg} />
                    <SalesmanCard label="MA MC" data={targets.ma_mc} isExporting={isExporting || isExportingJpg} />
                </div>

                <div className="lg:col-span-4 grid grid-cols-2 gap-3">
                    <CustomerGauge label="CK" data={targets.ck} colorClass="bg-gray-500" textClass="text-gray-700 dark:text-gray-300" strokeColor="#6b7280" isExporting={isExporting || isExportingJpg} />
                    <CustomerGauge label="SIS" data={targets.sis} colorClass="bg-purple-500" textClass="text-purple-700 dark:text-purple-400" strokeColor="#9333ea" isExporting={isExporting || isExportingJpg} />
                </div>

            </div>

            {/* ─── ROW 2: Service / PA / PA+Service ────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <CategoryCard
                    label="Prime Product"
                    data={targets.primeProduct}
                    colorClass="bg-indigo-500"
                    textClass="text-indigo-700 dark:text-indigo-400"
                    lightBg="bg-indigo-50/50 dark:bg-indigo-950/20"
                    hideStats={true}
                    largeRevenue={true}
                />
                <CategoryCard
                    label="Forecast Service"
                    data={targets.service}
                    colorClass="bg-blue-500"
                    textClass="text-blue-700 dark:text-blue-400"
                    lightBg="bg-blue-50/50 dark:bg-blue-950/20"
                />
                <CategoryCard
                    label="Forecast PA"
                    data={targets.pa}
                    colorClass="bg-emerald-500"
                    textClass="text-emerald-700 dark:text-emerald-400"
                    lightBg="bg-emerald-50/50 dark:bg-emerald-950/20"
                />
                <CategoryCard
                    label="Forecast PA & Service"
                    data={targets.paService}
                    colorClass="bg-teal-500"
                    textClass="text-teal-700 dark:text-teal-400"
                    lightBg="bg-teal-50/50 dark:bg-teal-950/20"
                />
            </div>

            {/* ─── ROW 3: Pie Chart + Inventory ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-blue-600 flex justify-between items-start">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">MTD TOP TEN SELL OUT</h3>
                        <div className="text-right">
                            <div className="text-[10px] text-white/70 font-semibold uppercase">Trading Revenue</div>
                            <div className="text-sm font-black text-white">{fmt(targets.primeProduct.revenue)}</div>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="flex justify-center items-center h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={materials.slice(0, 10)} 
                                        innerRadius={70} 
                                        outerRadius={110} 
                                        dataKey="revenue" 
                                        nameKey="desc" 
                                        paddingAngle={2} 
                                        label={({ name }) => (name || "").substring(0, 20)}
                                        labelLine={true}
                                        isAnimationActive={!isExporting}
                                    >
                                        {materials.slice(0, 10).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 11 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {inventoryData && <InventoryPieChart data={inventoryData} />}

                <div className="bg-card border rounded-xl overflow-hidden flex flex-col shadow-sm h-full">
                    <div className="px-4 py-3 bg-blue-600">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">Prime Product & Overall Summary</h3>
                    </div>
                    <div className="p-5 flex flex-col gap-4">
                        <div className="space-y-4">
                            <MiniGauge label="Prime Product" data={targets.primeProduct} colorClass="bg-indigo-500" textClass="text-indigo-600 dark:text-indigo-400" showProgress={false} showPercentage={false} emphasizeRevenue={true} isExporting={isExporting} />
                            <MiniGauge label="Service" data={targets.service} colorClass="bg-blue-500" textClass="text-blue-600 dark:text-blue-400" isExporting={isExporting} />
                            <MiniGauge label="PA (Product Accessories)" data={targets.pa} colorClass="bg-emerald-500" textClass="text-emerald-600 dark:text-emerald-400" isExporting={isExporting} />
                            <MiniGauge label="PA + Service" data={targets.paService} colorClass="bg-teal-500" textClass="text-teal-600 dark:text-teal-400" isExporting={isExporting} />
                            <MiniGauge label="CK (Cipta Kridatama)" data={targets.ck} colorClass="bg-gray-500" textClass="text-gray-600 dark:text-gray-400" isExporting={isExporting} />
                            <MiniGauge label="SIS (Saptaindra Sejati)" data={targets.sis} colorClass="bg-purple-500" textClass="text-purple-600 dark:text-purple-400" isExporting={isExporting} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── ROW 4: Product Accessories + Rank Material ───────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-blue-600">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">Product Accessories</h3>
                    </div>
                    <table className="w-full text-xs">
                        <thead className="bg-muted/20">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Mat Grp1 Desc.</th>
                                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matGroups.length === 0 ? (
                                <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">No data</td></tr>
                            ) : matGroups.map((m, i) => (
                                <tr key={i} className="border-t hover:bg-muted/30">
                                    <td className="px-4 py-2">{i + 1}. {m.desc}</td>
                                    <td className="px-4 py-2 text-right font-semibold">{fmt(m.revenue)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="px-4 py-3 bg-blue-600 mt-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">Transaction Type</h3>
                    </div>
                    <table className="w-full text-xs">
                        <thead className="bg-muted/20">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Rev. Type</th>
                                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {revTypes.length === 0 ? (
                                <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">No data</td></tr>
                            ) : revTypes.map((r, i) => (
                                <tr key={i} className="border-t hover:bg-muted/30">
                                    <td className="px-4 py-2">{i + 1}. {r.type}</td>
                                    <td className="px-4 py-2 text-right font-semibold">{fmt(r.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="bg-card border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-blue-600 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">Rank. Material Sell Out</h3>
                        <span className="text-[10px] text-white/80">1 - {materials.length} / {materials.length}</span>
                    </div>
                    <div className="overflow-auto max-h-[450px] print:max-h-none scrollbar-thin scrollbar-thumb-accent">
                        <table className="w-full text-xs">
                            <thead className="bg-blue-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold text-primary w-6">No.</th>
                                    <th className="px-3 py-2 text-left font-semibold text-primary">Material Description</th>
                                    <th className="px-3 py-2 text-right font-semibold text-primary whitespace-nowrap">Revenue in Loc Curr.</th>
                                    <th className="px-3 py-2 text-right font-semibold text-primary">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {materials.length === 0 ? (
                                    <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No data</td></tr>
                                ) : materials.map((m, i) => (
                                    <tr key={i} className="border-t hover:bg-muted/30">
                                        <td className="px-3 py-2 text-muted-foreground">{i + 1}.</td>
                                        <td className="px-3 py-2 leading-tight max-w-[200px] truncate" title={m.desc}>{m.desc}</td>
                                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{fmt(m.revenue)}</td>
                                        <td className="px-3 py-2 text-right">{m.qty.toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ─── ROW 5: Revenue YTD Bar Chart ─────────────────────────────────── */}
            <div className="bg-card border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-blue-600">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white">Revenue YTD</h3>
                </div>
                <div className="p-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={ytdFormatted.length > 0 ? ytdFormatted : [{ name: '-', revenue: 0, forecast: 0 }]}
                            margin={{ top: 28, right: 20, left: 40, bottom: 5 }}
                            barCategoryGap="28%"
                            barGap={8}
                        >
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                axisLine={false}
                                height={48}
                                tick={(props) => {
                                    const { x = 0, y = 0, payload } = props
                                    const current = ytdFormatted.find((item) => item.name === payload.value)
                                    return (
                                        <g transform={`translate(${x},${y})`}>
                                            <text
                                                x={0}
                                                y={0}
                                                dy={10}
                                                textAnchor="middle"
                                                fill="#475569"
                                                fontSize={11}
                                                fontWeight={700}
                                            >
                                                {payload.value}
                                            </text>
                                            {current ? (
                                                <text
                                                    x={0}
                                                    y={0}
                                                    dy={26}
                                                    textAnchor="middle"
                                                    fill="#64748b"
                                                    fontSize={10}
                                                    fontWeight={800}
                                                    fillOpacity="0.8"
                                                >
                                                    {current.achievementPct.toFixed(1)}%
                                                </text>
                                            ) : null}
                                        </g>
                                    )
                                }}
                            />
                            <YAxis hide />
                            <Tooltip
                                formatter={(v: number, name: string) => [fmt(v), name.charAt(0).toUpperCase() + name.slice(1)]}
                                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                                cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                            />
                            <Legend
                                formatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
                                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                            />
                            <Bar dataKey="forecast" name="Forecast" fill="#fcd34d" radius={[6, 6, 0, 0]}
                                isAnimationActive={!isExporting}
                                label={{ position: 'top', formatter: (v: number) => fmt(v), fontSize: 9, fill: '#64748b' }}
                            />
                            <Bar dataKey="revenue" name="Revenue" fill="#a5b4fc" radius={[6, 6, 0, 0]}
                                isAnimationActive={!isExporting}
                                label={{ position: 'top', formatter: (v: number) => fmt(v), fontSize: 9, fill: '#64748b' }}
                            >
                                <LabelList dataKey="revenue" content={renderAchievementLabel} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            </div>
        </div>
    )
}
