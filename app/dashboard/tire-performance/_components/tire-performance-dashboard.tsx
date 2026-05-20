"use client"

import * as React from "react"
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    Radar,
    LabelList,
} from "recharts"
import {
    Award,
    BarChart3,
    Clock,
    Flame,
    Gauge,
    ShieldCheck,
    Target,
    Trophy,
    Zap,
} from "lucide-react"

import {
    buildManufactureNormalizationMap,
    normalizeManufacture,
    type TirePerformanceRow,
    type TirePerformanceType,
} from "@/lib/tire-performance"

// ─── Constants ────────────────────────────────────────────────────────────────

const MICHELIN_YELLOW = "#F5A700"
const MICHELIN_DARK = "#CC8800"

const BRAND_COLORS: Record<string, string> = {
    michelin: "#F5A700",
    bridgestone: "#E63946",
    goodyear: "#2DC653",
    continental: "#457B9D",
    dunlop: "#9B5DE5",
    yokohama: "#FF6B35",
    toyo: "#00B4D8",
    hankook: "#F15BB5",
}

const FALLBACK_COLORS = [
    "#6B7280", "#A78BFA", "#34D399", "#F87171", "#60A5FA",
    "#FBBF24", "#A3E635", "#FB923C", "#E879F9", "#22D3EE",
]

function getBrandColor(name: string, index: number): string {
    const key = name.toLowerCase().replace(/[^a-z]/g, "")
    for (const [brand, color] of Object.entries(BRAND_COLORS)) {
        if (key.includes(brand)) return color
    }
    return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(str: string, n = 22) {
    return str.length > n ? `${str.slice(0, n)}…` : str
}

function fmtHours(v: number) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v)
}

function fmtNum(v: number) {
    return new Intl.NumberFormat("en-US").format(v)
}

function isMichelin(name: string) {
    return name.toLowerCase().includes("michelin")
}

// ─── Data Computation Hooks ──────────────────────────────────────────────────

/**
 * Build a Fuse.js-based normalization map for all manufacture names in `rows`.
 * Returns a stable Map<rawName, canonicalName> memoized on `rows`.
 */
function useManufactureNormMap(rows: TirePerformanceRow[]) {
    return React.useMemo(() => buildManufactureNormalizationMap(rows), [rows])
}

function useManufactureStats(rows: TirePerformanceRow[], normMap: Map<string, string>) {
    return React.useMemo(() => {
        const map = new Map<string, { wh: number; rc: number }>()
        rows.forEach((r) => {
            const key = normalizeManufacture(r.manufacture, normMap)
            const cur = map.get(key) ?? { wh: 0, rc: 0 }
            const h = Number(r.avgHours) || 0
            const c = Number(r.recordCount) || 0
            cur.wh += h * c
            cur.rc += c
            map.set(key, cur)
        })
        return Array.from(map.entries())
            .map(([name, d]) => ({
                name,
                avgHours: d.rc > 0 ? Math.round(d.wh / d.rc) : 0,
                totalTires: d.rc,
                isMich: isMichelin(name),
            }))
            .sort((a, b) => b.avgHours - a.avgHours)
    }, [rows, normMap])
}

function useSpecStats(rows: TirePerformanceRow[], normMap: Map<string, string>) {
    return React.useMemo(() => {
        const map = new Map<string, { wh: number; rc: number; manufactures: Set<string> }>()
        rows.forEach((r) => {
            const key = r.specification || "-"
            const cur = map.get(key) ?? { wh: 0, rc: 0, manufactures: new Set() }
            const h = Number(r.avgHours) || 0
            const c = Number(r.recordCount) || 0
            cur.wh += h * c
            cur.rc += c
            cur.manufactures.add(normalizeManufacture(r.manufacture, normMap))
            map.set(key, cur)
        })
        return Array.from(map.entries())
            .map(([spec, d]) => {
                const manufactures = Array.from(d.manufactures)
                return {
                    spec,
                    specShort: truncate(spec, 22),
                    avgHours: d.rc > 0 ? Math.round(d.wh / d.rc) : 0,
                    totalTires: d.rc,
                    isMich: manufactures.some(isMichelin),
                    primaryManufacture: manufactures[0] ?? "Unknown",
                }
            })
            .sort((a, b) => b.avgHours - a.avgHours)
    }, [rows, normMap])
}

function useSpecByManufacture(rows: TirePerformanceRow[], normMap: Map<string, string>) {
    return React.useMemo(() => {
        // Use normalized manufacture names throughout
        const manufactures = Array.from(
            new Set(rows.map((r) => normalizeManufacture(r.manufacture, normMap)))
        )
        const specs = Array.from(new Set(rows.map((r) => r.specification || "-"))).slice(0, 12)

        const dataMap = new Map<string, Record<string, number>>()
        specs.forEach((s) => dataMap.set(s, {}))

        rows.forEach((r) => {
            const spec = r.specification || "-"
            if (!specs.includes(spec)) return
            const manuf = normalizeManufacture(r.manufacture, normMap)
            const sData = dataMap.get(spec)!
            const h = Number(r.avgHours) || 0
            const c = Number(r.recordCount) || 0
            sData[`${manuf}_wh`] = (sData[`${manuf}_wh`] ?? 0) + h * c
            sData[`${manuf}_rc`] = (sData[`${manuf}_rc`] ?? 0) + c
        })

        const data = specs.map((spec) => {
            const sData = dataMap.get(spec)!
            const entry: Record<string, string | number> = { spec: truncate(spec, 20) }
            manufactures.forEach((m) => {
                const rc = (sData[`${m}_rc`] ?? 0) as number
                const wh = (sData[`${m}_wh`] ?? 0) as number
                entry[m] = rc > 0 ? Math.round(wh / rc) : 0
            })
            return entry
        })

        return { data, manufactures }
    }, [rows, normMap])
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface KpiCardProps {
    icon: React.ElementType
    label: string
    value: string | number
    sub?: string
    color?: string
    highlight?: boolean
    badge?: string
}

function KpiCard({ icon: Icon, label, value, sub, color = "#0070C0", highlight, badge }: KpiCardProps) {
    return (
        <div
            className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            style={highlight ? { borderColor: MICHELIN_YELLOW, borderWidth: 2 } : {}}
        >
            {highlight && (
                <div
                    className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                    style={{ background: `linear-gradient(90deg, ${MICHELIN_YELLOW}, ${MICHELIN_DARK})` }}
                />
            )}
            {badge && (
                <div
                    className="absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: `${MICHELIN_YELLOW}20`, color: MICHELIN_DARK }}
                >
                    {badge}
                </div>
            )}
            <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `${color}18` }}
            >
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-black tracking-tight" style={{ color }}>
                {value}
            </p>
            {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
    )
}

function ChartCard({
    title,
    subtitle,
    children,
    className,
}: {
    title: string
    subtitle?: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={`rounded-2xl border bg-white p-5 shadow-sm ${className ?? ""}`}>
            <div className="mb-1">
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="mt-4">{children}</div>
        </div>
    )
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function HoursTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean
    payload?: { name: string; value: number; fill: string; color: string }[]
    label?: string
}) {
    if (!active || !payload?.length) return null
    const filtered = payload.filter((p) => p.value > 0)
    if (!filtered.length) return null
    return (
        <div className="rounded-xl border bg-white px-3.5 py-2.5 shadow-xl text-xs min-w-[160px]">
            {label && <p className="mb-2 font-bold text-foreground border-b pb-1.5">{label}</p>}
            {filtered.map((entry, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                    <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: entry.fill ?? entry.color }} />
                        <span className="text-muted-foreground">{truncate(entry.name, 16)}</span>
                    </div>
                    <span className="font-bold text-foreground">{fmtHours(entry.value)} h</span>
                </div>
            ))}
        </div>
    )
}

function PieLabelLine({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number
}) {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    )
}

// ─── Running Dashboard ────────────────────────────────────────────────────────

function RunningDashboard({ rows }: { rows: TirePerformanceRow[] }) {
    const normMap = useManufactureNormMap(rows)
    const manufactureStats = useManufactureStats(rows, normMap)
    const specStats = useSpecStats(rows, normMap)
    const { data: specByManuf, manufactures } = useSpecByManufacture(rows, normMap)

    // KPIs
    const totalTires = rows.reduce((acc, r) => acc + (Number(r.recordCount) || 0), 0)
    const weightedAvg = React.useMemo(() => {
        let wh = 0; let rc = 0
        rows.forEach((r) => { const h = Number(r.avgHours) || 0; const c = Number(r.recordCount) || 0; wh += h * c; rc += c })
        return rc > 0 ? wh / rc : 0
    }, [rows])
    const michelinAvg = React.useMemo(() => {
        let wh = 0; let rc = 0
        rows.filter((r) => isMichelin(normalizeManufacture(r.manufacture, normMap))).forEach((r) => {
            const h = Number(r.avgHours) || 0; const c = Number(r.recordCount) || 0; wh += h * c; rc += c
        })
        return rc > 0 ? wh / rc : 0
    }, [rows, normMap])
    const topSpec = specStats[0]
    const michelinStat = manufactureStats.find((m) => isMichelin(m.name))
    const allOthersAvg = React.useMemo(() => {
        let wh = 0; let rc = 0
        rows.filter((r) => !isMichelin(normalizeManufacture(r.manufacture, normMap))).forEach((r) => {
            const h = Number(r.avgHours) || 0; const c = Number(r.recordCount) || 0; wh += h * c; rc += c
        })
        return rc > 0 ? wh / rc : 0
    }, [rows, normMap])
    const michelinAdvantage = michelinAvg - allOthersAvg
    const totalUniqueSpec = new Set(rows.map((r) => r.specification)).size

    // Donut data
    const donutData = React.useMemo(() =>
        manufactureStats.map((m) => ({ name: m.name, value: m.totalTires })),
        [manufactureStats],
    )

    // Top specs for bar (top 12 by avg hours)
    const topSpecsBar = specStats.slice(0, 12)

    // Radar: manufacture comparison across top specs
    const radarSpecs = specStats.slice(0, 6)
    const radarManuf = manufactures.slice(0, 4)
    const radarData = radarSpecs.map((s) => {
        const entry: Record<string, string | number> = { spec: truncate(s.spec, 14) }
        radarManuf.forEach((m) => {
            const rows2 = rows.filter((r) => r.specification === s.spec && r.manufacture === m)
            let wh = 0; let rc = 0
            rows2.forEach((r) => { wh += (Number(r.avgHours) || 0) * (Number(r.recordCount) || 0); rc += Number(r.recordCount) || 0 })
            entry[m] = rc > 0 ? Math.round(wh / rc) : 0
        })
        return entry
    })

    if (rows.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
                <BarChart3 className="h-12 w-12 opacity-30" />
                <p className="text-sm font-medium">Belum ada data.</p>
                <p className="text-xs">Tambah atau import data Tire Running Performance terlebih dahulu.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div
                className="relative overflow-hidden rounded-2xl p-6"
                style={{ background: "linear-gradient(135deg, #0A0A0A 0%, #1C1C1C 60%, #2A2A2A 100%)" }}
            >
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `radial-gradient(ellipse at 80% 50%, ${MICHELIN_YELLOW}18 0%, transparent 60%)`,
                    }}
                />
                <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <div className="h-1 w-10 rounded-full" style={{ background: MICHELIN_YELLOW }} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: MICHELIN_YELLOW }}>
                                Executive Performance Dashboard
                            </span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight text-white">Tire Running Performance</h2>
                        <p className="mt-1 text-sm text-white/50">Specification & Manufacture Analysis · PT. Chitra Paratama</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-xs text-white/40">Michelin Avg Hours</p>
                            <p className="text-4xl font-black tabular-nums" style={{ color: MICHELIN_YELLOW }}>
                                {fmtHours(michelinAvg)}
                            </p>
                            <p className="text-xs text-white/40">hours / tire</p>
                        </div>
                        <div className="h-14 w-px bg-white/10" />
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: `${MICHELIN_YELLOW}20` }}>
                            <Gauge className="h-8 w-8" style={{ color: MICHELIN_YELLOW }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                    icon={Trophy}
                    label="Michelin Avg. Hours"
                    value={`${fmtHours(michelinAvg)} h`}
                    sub={`${michelinAdvantage >= 0 ? "+" : ""}${fmtHours(michelinAdvantage)} h vs kompetitor`}
                    color={MICHELIN_YELLOW}
                    highlight
                    badge="MICHELIN"
                />
                <KpiCard
                    icon={Gauge}
                    label="Overall Avg. Hours"
                    value={`${fmtHours(weightedAvg)} h`}
                    sub={`${fmtNum(totalTires)} total tires tracked`}
                    color="#0070C0"
                />
                <KpiCard
                    icon={Award}
                    label="Best Specification"
                    value={`${fmtHours(topSpec?.avgHours ?? 0)} h`}
                    sub={topSpec?.specShort ?? "-"}
                    color="#2DC653"
                />
                <KpiCard
                    icon={Target}
                    label="Unique Specifications"
                    value={totalUniqueSpec}
                    sub={`${manufactures.length} manufacture tracked`}
                    color="#9B5DE5"
                />
            </div>

            {/* Main: Avg Hours per Specification (top 12) */}
            <ChartCard
                title="📐 Avg. Hours per Specification"
                subtitle="Top 12 spesifikasi — diurutkan dari performa tertinggi. Warna kuning = Michelin."
            >
                <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={topSpecsBar} layout="vertical" margin={{ left: 10, right: 60, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                        <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: "#9CA3AF" }}
                            tickFormatter={(v) => fmtHours(Number(v))}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            type="category"
                            dataKey="specShort"
                            tick={{ fontSize: 10, fill: "#6B7280" }}
                            width={160}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip content={<HoursTooltip />} />
                        <Bar dataKey="avgHours" name="Avg Hours" radius={[0, 8, 8, 0]} maxBarSize={28}>
                            <LabelList
                                dataKey="avgHours"
                                position="right"
                                style={{ fontSize: 10, fontWeight: "700", fill: "#374151" }}
                                formatter={(v: number) => `${fmtHours(v)} h`}
                            />
                            {topSpecsBar.map((entry, i) => (
                                <Cell
                                    key={i}
                                    fill={entry.isMich ? MICHELIN_YELLOW : getBrandColor(entry.primaryManufacture, i)}
                                    fillOpacity={entry.isMich ? 1 : 0.75}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-semibold" style={{ color: MICHELIN_YELLOW }}>
                        <span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: MICHELIN_YELLOW }} />
                        Michelin
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-5 rounded-sm bg-gray-300" />
                        Other Brand
                    </span>
                </div>
            </ChartCard>

            {/* Row: Manufacture Avg Hours + Donut */}
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <ChartCard
                    title="🏭 Avg. Hours per Manufacture"
                    subtitle="Perbandingan rata-rata jam operasi antar brand ban"
                >
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={manufactureStats} margin={{ left: 0, right: 48, top: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: "#6B7280" }}
                                tickFormatter={(v) => truncate(v, 12)}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                tickFormatter={(v) => fmtHours(Number(v))}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip content={<HoursTooltip />} />
                            <Bar dataKey="avgHours" name="Avg Hours" radius={[8, 8, 0, 0]} maxBarSize={56}>
                                <LabelList
                                    dataKey="avgHours"
                                    position="top"
                                    style={{ fontSize: 10, fontWeight: "700", fill: "#374151" }}
                                    formatter={(v: number) => `${fmtHours(v)}`}
                                />
                                {manufactureStats.map((entry, i) => (
                                    <Cell
                                        key={i}
                                        fill={getBrandColor(entry.name, i)}
                                        fillOpacity={entry.isMich ? 1 : 0.8}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                    title="🥇 Share Tires per Manufacture"
                    subtitle="Distribusi total unit yang di-track"
                >
                    <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                            <Pie
                                data={donutData}
                                cx="50%"
                                cy="45%"
                                innerRadius={52}
                                outerRadius={88}
                                paddingAngle={3}
                                dataKey="value"
                                labelLine={false}
                                label={PieLabelLine}
                            >
                                {donutData.map((entry, i) => (
                                    <Cell
                                        key={i}
                                        fill={getBrandColor(entry.name, i)}
                                        stroke="white"
                                        strokeWidth={2}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number, name: string) => [
                                    `${fmtNum(value)} tires (${((value / totalTires) * 100).toFixed(1)}%)`,
                                    name,
                                ]}
                            />
                            <Legend
                                formatter={(value) => (
                                    <span style={{ fontSize: 10, color: "#6B7280" }}>{truncate(value, 14)}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Spec × Manufacture grouped bar */}
            {manufactures.length > 1 && specByManuf.length > 0 && (
                <ChartCard
                    title="🔬 Avg. Hours: Specification × Manufacture"
                    subtitle="Perbandingan langsung setiap spesifikasi per brand — mana ban terbaik untuk tiap ukuran"
                >
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={specByManuf} margin={{ left: 0, right: 16, top: 4, bottom: 36 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                            <XAxis
                                dataKey="spec"
                                tick={{ fontSize: 9, fill: "#6B7280" }}
                                angle={-30}
                                textAnchor="end"
                                interval={0}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                tickFormatter={(v) => fmtHours(Number(v))}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip content={<HoursTooltip />} />
                            <Legend
                                wrapperStyle={{ fontSize: 11 }}
                                formatter={(value) => (
                                    <span style={{ fontSize: 10, color: "#6B7280" }}>{truncate(value, 14)}</span>
                                )}
                            />
                            {manufactures.map((m, idx) => (
                                <Bar
                                    key={m}
                                    dataKey={m}
                                    name={m}
                                    fill={getBrandColor(m, idx)}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={28}
                                    fillOpacity={isMichelin(m) ? 1 : 0.75}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* Radar (if multiple manufactures & specs) */}
            {radarManuf.length >= 2 && radarSpecs.length >= 3 && (
                <ChartCard
                    title="🕸️ Radar: Michelin vs Kompetitor per Spesifikasi"
                    subtitle="Top 6 spesifikasi — semakin luar = semakin tinggi avg hours"
                >
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                            <PolarGrid stroke="#E5E7EB" />
                            <PolarAngleAxis dataKey="spec" tick={{ fontSize: 10, fill: "#6B7280" }} />
                            {radarManuf.map((m, idx) => (
                                <Radar
                                    key={m}
                                    name={m}
                                    dataKey={m}
                                    stroke={getBrandColor(m, idx)}
                                    fill={getBrandColor(m, idx)}
                                    fillOpacity={isMichelin(m) ? 0.25 : 0.1}
                                    strokeWidth={isMichelin(m) ? 2.5 : 1.5}
                                />
                            ))}
                            <Legend
                                wrapperStyle={{ fontSize: 11 }}
                                formatter={(value) => (
                                    <span style={{ fontSize: 10, color: "#6B7280" }}>{truncate(value, 14)}</span>
                                )}
                            />
                            <Tooltip content={<HoursTooltip />} />
                        </RadarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* Michelin highlight */}
            {michelinStat && (
                <div
                    className="flex flex-col gap-4 rounded-2xl p-5 md:flex-row md:items-center md:justify-between"
                    style={{ background: `linear-gradient(135deg, ${MICHELIN_YELLOW}15, ${MICHELIN_YELLOW}05)`, border: `1.5px solid ${MICHELIN_YELLOW}40` }}
                >
                    <div className="flex items-center gap-4">
                        <div
                            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                            style={{ background: MICHELIN_YELLOW }}
                        >
                            <ShieldCheck className="h-6 w-6 text-black" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: MICHELIN_DARK }}>
                                Michelin Performance Advantage
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Michelin mencatat <strong>{fmtHours(michelinAvg)} jam</strong> avg hours —{" "}
                                {michelinAdvantage > 0
                                    ? <><strong style={{ color: "#16A34A" }}>+{fmtHours(michelinAdvantage)} jam</strong> lebih baik dari rata-rata kompetitor</>
                                    : "setara dengan kompetitor"
                                }
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        <div className="rounded-xl bg-white/70 px-4 py-2.5 text-center shadow-sm">
                            <p className="text-[10px] text-muted-foreground">Avg Hours</p>
                            <p className="text-lg font-black" style={{ color: MICHELIN_YELLOW }}>{fmtHours(michelinAvg)} h</p>
                        </div>
                        <div className="rounded-xl bg-white/70 px-4 py-2.5 text-center shadow-sm">
                            <p className="text-[10px] text-muted-foreground">Total Tires</p>
                            <p className="text-lg font-black text-foreground">{fmtNum(michelinStat.totalTires)}</p>
                        </div>
                        <div className="rounded-xl bg-white/70 px-4 py-2.5 text-center shadow-sm">
                            <p className="text-[10px] text-muted-foreground">vs All Others</p>
                            <p className={`text-lg font-black ${michelinAdvantage >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                {michelinAdvantage >= 0 ? "+" : ""}{fmtHours(michelinAdvantage)} h
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Scrap Dashboard ──────────────────────────────────────────────────────────

function ScrapDashboard({ rows }: { rows: TirePerformanceRow[] }) {
    const normMap = useManufactureNormMap(rows)
    const manufactureStats = useManufactureStats(rows, normMap)
    const specStats = useSpecStats(rows, normMap)
    const { data: specByManuf, manufactures } = useSpecByManufacture(rows, normMap)

    const totalScrapped = rows.reduce((acc, r) => acc + (Number(r.recordCount) || 0), 0)
    const michelinAvg = React.useMemo(() => {
        let wh = 0; let rc = 0
        rows.filter((r) => isMichelin(normalizeManufacture(r.manufacture, normMap))).forEach((r) => {
            const h = Number(r.avgHours) || 0; const c = Number(r.recordCount) || 0; wh += h * c; rc += c
        })
        return rc > 0 ? wh / rc : 0
    }, [rows, normMap])
    const allOthersAvg = React.useMemo(() => {
        let wh = 0; let rc = 0
        rows.filter((r) => !isMichelin(normalizeManufacture(r.manufacture, normMap))).forEach((r) => {
            const h = Number(r.avgHours) || 0; const c = Number(r.recordCount) || 0; wh += h * c; rc += c
        })
        return rc > 0 ? wh / rc : 0
    }, [rows, normMap])
    const michelinStat = manufactureStats.find((m) => isMichelin(m.name))
    const michelinAdvantage = michelinAvg - allOthersAvg
    const topSpec = specStats[0]

    const donutData = React.useMemo(() =>
        manufactureStats.map((m) => ({ name: m.name, value: m.totalTires })),
        [manufactureStats],
    )

    const topSpecsScrap = specStats.slice(0, 12)

    if (rows.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
                <BarChart3 className="h-12 w-12 opacity-30" />
                <p className="text-sm font-medium">Belum ada data.</p>
                <p className="text-xs">Tambah atau import data Tire Scrap terlebih dahulu.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div
                className="relative overflow-hidden rounded-2xl p-6"
                style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F3460 100%)" }}
            >
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: `radial-gradient(ellipse at 80% 50%, ${MICHELIN_YELLOW}15 0%, transparent 60%)` }}
                />
                <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <div className="h-1 w-10 rounded-full" style={{ background: MICHELIN_YELLOW }} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: MICHELIN_YELLOW }}>
                                Scrap & Durability Dashboard
                            </span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight text-white">Tire Scrap Analysis</h2>
                        <p className="mt-1 text-sm text-white/50">Specification & Manufacture · PT. Chitra Paratama</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-xs text-white/40">Michelin Avg Hours Before Scrap</p>
                            <p className="text-4xl font-black tabular-nums" style={{ color: MICHELIN_YELLOW }}>
                                {fmtHours(michelinAvg)}
                            </p>
                            <p className="text-xs text-white/40">hours / tire</p>
                        </div>
                        <div className="h-14 w-px bg-white/10" />
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: `${MICHELIN_YELLOW}20` }}>
                            <Flame className="h-8 w-8" style={{ color: MICHELIN_YELLOW }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                    icon={Trophy}
                    label="Michelin Avg Hours at Scrap"
                    value={`${fmtHours(michelinAvg)} h`}
                    sub={`${michelinAdvantage >= 0 ? "+" : ""}${fmtHours(michelinAdvantage)} h vs kompetitor`}
                    color={MICHELIN_YELLOW}
                    highlight
                    badge="MICHELIN"
                />
                <KpiCard
                    icon={Zap}
                    label="Total Tires Scrapped"
                    value={fmtNum(totalScrapped)}
                    sub="all manufactures"
                    color="#E63946"
                />
                <KpiCard
                    icon={Award}
                    label="Highest Durability Spec"
                    value={`${fmtHours(topSpec?.avgHours ?? 0)} h`}
                    sub={topSpec?.specShort ?? "-"}
                    color="#2DC653"
                />
                <KpiCard
                    icon={Clock}
                    label="All-Brand Avg. Hours"
                    value={`${fmtHours(allOthersAvg > 0 ? (allOthersAvg + michelinAvg) / 2 : michelinAvg)} h`}
                    sub={`${manufactures.length} manufactures`}
                    color="#9B5DE5"
                />
            </div>

            {/* Avg Hours Before Scrap per Specification */}
            <ChartCard
                title="⏱️ Avg. Hours Before Scrap per Specification"
                subtitle="Semakin tinggi = semakin tahan lama sebelum di-scrap. Warna kuning = Michelin."
            >
                <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={topSpecsScrap} layout="vertical" margin={{ left: 10, right: 60, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                        <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: "#9CA3AF" }}
                            tickFormatter={(v) => fmtHours(Number(v))}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            type="category"
                            dataKey="specShort"
                            tick={{ fontSize: 10, fill: "#6B7280" }}
                            width={160}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip content={<HoursTooltip />} />
                        <Bar dataKey="avgHours" name="Avg Hours at Scrap" radius={[0, 8, 8, 0]} maxBarSize={28}>
                            <LabelList
                                dataKey="avgHours"
                                position="right"
                                style={{ fontSize: 10, fontWeight: "700", fill: "#374151" }}
                                formatter={(v: number) => `${fmtHours(v)} h`}
                            />
                            {topSpecsScrap.map((entry, i) => (
                                <Cell
                                    key={i}
                                    fill={entry.isMich ? MICHELIN_YELLOW : getBrandColor(entry.primaryManufacture, i)}
                                    fillOpacity={entry.isMich ? 1 : 0.75}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* Manufacture avg hours + donut */}
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <ChartCard
                    title="🏭 Avg. Hours at Scrap per Manufacture"
                    subtitle="Brand mana yang paling tahan lama sebelum di-scrap?"
                >
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={manufactureStats} margin={{ left: 0, right: 48, top: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: "#6B7280" }}
                                tickFormatter={(v) => truncate(v, 12)}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                tickFormatter={(v) => fmtHours(Number(v))}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip content={<HoursTooltip />} />
                            <Bar dataKey="avgHours" name="Avg Hours at Scrap" radius={[8, 8, 0, 0]} maxBarSize={56}>
                                <LabelList
                                    dataKey="avgHours"
                                    position="top"
                                    style={{ fontSize: 10, fontWeight: "700", fill: "#374151" }}
                                    formatter={(v: number) => `${fmtHours(v)}`}
                                />
                                {manufactureStats.map((entry, i) => (
                                    <Cell
                                        key={i}
                                        fill={getBrandColor(entry.name, i)}
                                        fillOpacity={entry.isMich ? 1 : 0.8}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                    title="🧮 Scrap Count per Manufacture"
                    subtitle="Distribusi unit yang di-scrap"
                >
                    <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                            <Pie
                                data={donutData}
                                cx="50%"
                                cy="45%"
                                innerRadius={52}
                                outerRadius={88}
                                paddingAngle={3}
                                dataKey="value"
                                labelLine={false}
                                label={PieLabelLine}
                            >
                                {donutData.map((entry, i) => (
                                    <Cell
                                        key={i}
                                        fill={getBrandColor(entry.name, i)}
                                        stroke="white"
                                        strokeWidth={2}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number, name: string) => [
                                    `${fmtNum(value)} tires (${totalScrapped ? ((value / totalScrapped) * 100).toFixed(1) : 0}%)`,
                                    name,
                                ]}
                            />
                            <Legend
                                formatter={(value) => (
                                    <span style={{ fontSize: 10, color: "#6B7280" }}>{truncate(value, 14)}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Spec × Manufacture grouped */}
            {manufactures.length > 1 && specByManuf.length > 0 && (
                <ChartCard
                    title="🔬 Avg. Hours at Scrap: Specification × Manufacture"
                    subtitle="Perbandingan langsung durabilitas tiap spesifikasi antar brand"
                >
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={specByManuf} margin={{ left: 0, right: 16, top: 4, bottom: 36 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                            <XAxis
                                dataKey="spec"
                                tick={{ fontSize: 9, fill: "#6B7280" }}
                                angle={-30}
                                textAnchor="end"
                                interval={0}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "#9CA3AF" }}
                                tickFormatter={(v) => fmtHours(Number(v))}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip content={<HoursTooltip />} />
                            <Legend
                                formatter={(value) => (
                                    <span style={{ fontSize: 10, color: "#6B7280" }}>{truncate(value, 14)}</span>
                                )}
                            />
                            {manufactures.map((m, idx) => (
                                <Bar
                                    key={m}
                                    dataKey={m}
                                    name={m}
                                    fill={getBrandColor(m, idx)}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={28}
                                    fillOpacity={isMichelin(m) ? 1 : 0.75}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* Michelin Insight Banner */}
            {michelinStat && (
                <div
                    className="flex flex-col gap-4 rounded-2xl p-5 md:flex-row md:items-center md:justify-between"
                    style={{ background: `linear-gradient(135deg, ${MICHELIN_YELLOW}15, ${MICHELIN_YELLOW}05)`, border: `1.5px solid ${MICHELIN_YELLOW}40` }}
                >
                    <div className="flex items-center gap-4">
                        <div
                            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                            style={{ background: MICHELIN_YELLOW }}
                        >
                            <ShieldCheck className="h-6 w-6 text-black" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: MICHELIN_DARK }}>
                                Michelin Durability Summary
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Michelin di-scrap setelah rata-rata <strong>{fmtHours(michelinAvg)} jam</strong> operasi —{" "}
                                {michelinAdvantage > 0
                                    ? <><strong style={{ color: "#16A34A" }}>+{fmtHours(michelinAdvantage)} jam</strong> lebih lama dari rata-rata kompetitor</>
                                    : "setara dengan kompetitor"
                                }
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl bg-white/70 px-4 py-2.5 text-center shadow-sm">
                            <p className="text-[10px] text-muted-foreground">Michelin Avg</p>
                            <p className="text-lg font-black" style={{ color: MICHELIN_YELLOW }}>{fmtHours(michelinAvg)} h</p>
                        </div>
                        <div className="rounded-xl bg-white/70 px-4 py-2.5 text-center shadow-sm">
                            <p className="text-[10px] text-muted-foreground">Units Tracked</p>
                            <p className="text-lg font-black text-foreground">{fmtNum(michelinStat.totalTires)}</p>
                        </div>
                        <div className="rounded-xl bg-white/70 px-4 py-2.5 text-center shadow-sm">
                            <p className="text-[10px] text-muted-foreground">vs Competition</p>
                            <p className={`text-lg font-black ${michelinAdvantage >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                {michelinAdvantage >= 0 ? "+" : ""}{fmtHours(michelinAdvantage)} h
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function TirePerformanceDashboard({
    rows,
    type,
}: {
    rows: TirePerformanceRow[]
    type: TirePerformanceType
}) {
    return type === "running" ? <RunningDashboard rows={rows} /> : <ScrapDashboard rows={rows} />
}
