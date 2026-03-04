"use client"

import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts"

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
            ma_wis: TargetData
            ma_fq: TargetData
            ma_bur: TargetData
            ma_ag: TargetData
            ma_mic: TargetData
        }
        materials: Array<{ desc: string; revenue: number; qty: number }>
        revTypes: Array<{ type: string; total: number }>
        matGroups: Array<{ desc: string; revenue: number }>
        ytdChart: Array<{ name: string; revenue: number }>
    }
    selectedPeriod: string
}

const fmt = (v: number, compact = false) => {
    if (compact && v >= 1_000_000) return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v / 1_000_000) + "M"
    if (compact && v >= 1_000) return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v / 1_000) + "K"
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

const pct = (r: number, f: number) => f > 0 ? Math.min((r / f) * 100, 999) : 0
const pctStr = (r: number, f: number) => pct(r, f).toFixed(1) + "%"
const pctColor = (p: number) => p >= 100 ? "text-green-600" : p >= 80 ? "text-blue-600" : p >= 50 ? "text-amber-500" : "text-red-500"
const strokeColor = (p: number) => p >= 100 ? "stroke-green-500" : p >= 80 ? "stroke-blue-500" : p >= 50 ? "stroke-amber-400" : "stroke-red-400"

const PIE_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#14b8a6']

// Mini horizontal gauge bar
function MiniGauge({ label, data, color = "#6366f1" }: { label: string; data: TargetData; color?: string }) {
    const p = pct(data.revenue, data.forecast)
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-foreground">{label}</span>
                <span className="font-black" style={{ color }}>{p.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(p, 100)}%`, backgroundColor: color }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Rev: {fmt(data.revenue, true)}</span>
                <span>Fc: {fmt(data.forecast, true)}</span>
            </div>
        </div>
    )
}

// Half-donut gauge card (compact style like reference)
function SalesmanCard({ label, data }: { label: string; data: TargetData }) {
    const p = pct(data.revenue, data.forecast)
    const radius = 32; const circ = Math.PI * radius
    const dashOffset = circ - (Math.min(p, 100) / 100) * circ
    return (
        <div className="bg-card border rounded-lg p-3 flex flex-col">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">{label}</div>
            <div className="flex items-center gap-2 mt-1">
                <div className="relative w-[70px] h-[38px] shrink-0">
                    <svg viewBox="0 0 74 40" className="w-full h-full">
                        <path d="M 7,37 A 32,32 0 0,1 67,37" fill="none" className="stroke-muted" strokeWidth="8" strokeLinecap="round" />
                        <path d="M 7,37 A 32,32 0 0,1 67,37" fill="none" className={`${strokeColor(p)} transition-all`} strokeWidth="8" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dashOffset} />
                    </svg>
                    <div className={`absolute bottom-0 left-0 w-full text-center text-xs font-black ${pctColor(p)}`}>{p.toFixed(0)}%</div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-muted-foreground">Forecast</div>
                    <div className="text-xs font-bold truncate">{fmt(data.forecast, true)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Revenue</div>
                    <div className="text-xs font-semibold truncate text-primary">{fmt(data.revenue, true)}</div>
                </div>
            </div>
        </div>
    )
}

// Customer gauge (CK/SIS) - bigger half donut
function CustomerGauge({ label, data, color = "#6366f1", textColor = "text-indigo-600" }: { label: string; data: TargetData; color?: string; textColor?: string }) {
    const p = pct(data.revenue, data.forecast)
    const radius = 48; const circ = Math.PI * radius
    const dashOffset = circ - (Math.min(p, 100) / 100) * circ
    return (
        <div className="bg-card border rounded-xl p-3 flex flex-col items-center">
            <div className="text-right w-full mb-1">
                <div className="text-xs font-bold text-muted-foreground">Forecast {label}</div>
                <div className="text-base font-black">{fmt(data.forecast, true)}</div>
            </div>
            <div className="relative w-[100px] h-[54px]">
                <svg viewBox="0 0 104 58" className="w-full h-full">
                    <path d="M 8,54 A 48,48 0 0,1 96,54" fill="none" className="stroke-muted" strokeWidth="10" strokeLinecap="round" />
                    <path d="M 8,54 A 48,48 0 0,1 96,54" fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dashOffset} stroke={color} className="transition-all" />
                </svg>
                <div className={`absolute bottom-0 left-0 w-full text-center text-lg font-black ${textColor}`}>{p.toFixed(1)}%</div>
            </div>
            <div className="text-right w-full mt-2">
                <div className="text-xs text-muted-foreground">Revenue {label}</div>
                <div className="text-base font-black text-primary">{fmt(data.revenue, true)}</div>
            </div>
        </div>
    )
}

// Big category card (Service / PA / PA+Service) - colored left border + big pct
function CategoryCard({ label, data, borderColor = "border-blue-500", bgColor = "bg-blue-50 dark:bg-blue-950/30", textColor = "text-blue-600" }: {
    label: string; data: TargetData; borderColor?: string; bgColor?: string; textColor?: string
}) {
    const p = pct(data.revenue, data.forecast)
    return (
        <div className={`rounded-xl border-l-4 ${borderColor} ${bgColor} p-4 flex flex-col gap-2`}>
            <div className="flex justify-between items-center">
                <div className={`text-4xl font-black ${textColor}`}>{p.toFixed(2)}%</div>
            </div>
            <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
            <div className="flex gap-4 text-sm">
                <div>
                    <div className="text-[10px] text-muted-foreground">Forecast</div>
                    <div className="font-bold">{fmt(data.forecast, true)}</div>
                </div>
                <div>
                    <div className="text-[10px] text-muted-foreground">Revenue</div>
                    <div className="font-bold text-primary">{fmt(data.revenue, true)}</div>
                </div>
            </div>
            <div className="h-1.5 bg-white/50 dark:bg-black/20 rounded-full">
                <div className={`h-full rounded-full border-l-4 ${borderColor} bg-current transition-all`} style={{ width: `${Math.min(p, 100)}%` }} />
            </div>
        </div>
    )
}

// Big consolidate gauge (center piece)
function ConsolidateGauge({ data }: { data: TargetData }) {
    const p = pct(data.revenue, data.forecast)
    const radius = 80; const circ = Math.PI * radius
    const dashOffset = circ - (Math.min(p, 100) / 100) * circ
    return (
        <div className="bg-card border rounded-xl p-5 flex flex-col items-center gap-2">
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Forecast Consolidate</div>
            <div className="text-2xl font-black">{fmt(data.forecast)}</div>
            <div className="relative w-[200px] h-[110px]">
                <svg viewBox="0 0 200 110" className="w-full h-full">
                    <path d="M 20,100 A 80,80 0 0,1 180,100" fill="none" className="stroke-muted" strokeWidth="16" strokeLinecap="round" />
                    <path d="M 20,100 A 80,80 0 0,1 180,100" fill="none" className={`${strokeColor(p)} transition-all duration-1000`} strokeWidth="16" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dashOffset} />
                </svg>
                <div className={`absolute bottom-0 left-0 w-full text-center text-3xl font-black ${pctColor(p)}`}>{p.toFixed(1)}%</div>
            </div>
            <div className="text-sm text-muted-foreground">Revenue Consolidate</div>
            <div className="text-xl font-black text-primary">{fmt(data.revenue)}</div>
        </div>
    )
}

export function RevenueClient({ initialData, selectedPeriod }: RevenueClientProps) {
    const router = useRouter()
    const { targets, materials, revTypes, matGroups, ytdChart } = initialData

    const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    const ytdFormatted = ytdChart.map(y => {
        const [mm] = y.name.split(".")
        const monthIdx = parseInt(mm, 10) - 1
        return { name: MONTHS_SHORT[monthIdx] ?? y.name, revenue: y.revenue }
    })

    return (
        <div className="space-y-4 pb-8">
            {/* ─── HEADER ──────────────────────────────────────────────────────── */}
            <div className="bg-card border rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">📊</div>
                        <div>
                            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Dashboard Monitoring</div>
                            <h1 className="text-lg font-black text-primary leading-tight">Revenue <span className="text-foreground">vs</span> Forecast</h1>
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
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold">Period:</span>
                    <Select defaultValue={selectedPeriod} onValueChange={v => router.push(`/dashboard/revenue-forecast?period=${v}`)}>
                        <SelectTrigger className="w-[160px] h-8 text-xs border-primary/30 font-bold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2025">Yearly 2025</SelectItem>
                            <SelectItem value="2026">Yearly 2026</SelectItem>
                            <SelectItem value="01.2025">Jan 2025</SelectItem>
                            <SelectItem value="02.2025">Feb 2025</SelectItem>
                            <SelectItem value="01.2026">Jan 2026</SelectItem>
                            <SelectItem value="02.2026">Feb 2026</SelectItem>
                            <SelectItem value="03.2026">Mar 2026</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ─── ROW 1: Consolidate + Salesman + Customer ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Consolidate Gauge */}
                <div className="lg:col-span-3">
                    <ConsolidateGauge data={targets.consolidate} />
                </div>

                {/* Salesman Grid 2x3 */}
                <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <SalesmanCard label="MA OC" data={targets.ma_oc} />
                    <SalesmanCard label="MA WIS" data={targets.ma_wis} />
                    <SalesmanCard label="MA AG" data={targets.ma_ag} />
                    <SalesmanCard label="MA BUR" data={targets.ma_bur} />
                    <SalesmanCard label="MA FQ" data={targets.ma_fq} />
                    <SalesmanCard label="MA MIC" data={targets.ma_mic} />
                </div>

                {/* CK & SIS */}
                <div className="lg:col-span-4 grid grid-cols-2 gap-3">
                    <CustomerGauge label="CK" data={targets.ck} color="#6b7280" textColor="text-gray-600" />
                    <CustomerGauge label="SIS" data={targets.sis} color="#a855f7" textColor="text-purple-600" />
                </div>
            </div>

            {/* ─── ROW 2: Service / PA / PA+Service ────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <CategoryCard
                    label="Forecast Service"
                    data={targets.service}
                    borderColor="border-blue-500"
                    bgColor="bg-blue-50/60 dark:bg-blue-950/20"
                    textColor="text-blue-600"
                />
                <CategoryCard
                    label="Forecast PA"
                    data={targets.pa}
                    borderColor="border-emerald-500"
                    bgColor="bg-emerald-50/60 dark:bg-emerald-950/20"
                    textColor="text-emerald-600"
                />
                <CategoryCard
                    label="Forecast PA & Service"
                    data={targets.paService}
                    borderColor="border-teal-500"
                    bgColor="bg-teal-50/60 dark:bg-teal-950/20"
                    textColor="text-teal-600"
                />
            </div>

            {/* ─── ROW 3: Pie Chart + Inventory placeholder ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* MTD Sunburst Sell Out Material */}
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="text-sm font-bold">MTD Sunburst Sell Out Material</h3>
                        <div className="text-right">
                            <div className="text-[10px] text-muted-foreground">Prime Product</div>
                            <div className="text-sm font-black text-primary">{fmt(targets.primeProduct.revenue)}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={materials.slice(0, 7)} innerRadius={55} outerRadius={90} dataKey="revenue" nameKey="desc" paddingAngle={2} labelLine={false}>
                                        {materials.slice(0, 7).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 11 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Legend */}
                        <div className="w-40 space-y-1.5 pt-2">
                            {materials.slice(0, 7).map((m, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i] }} />
                                    <span className="text-[10px] leading-tight text-muted-foreground truncate">{m.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Prime Product vs Forecast mini panel + mini gauge */}
                <div className="bg-card border rounded-xl p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-bold">Prime Product & Overall Summary</h3>
                    <div className="space-y-4">
                        <MiniGauge label="Prime Product" data={targets.primeProduct} color="#6366f1" />
                        <MiniGauge label="Service" data={targets.service} color="#3b82f6" />
                        <MiniGauge label="PA (Product Accessories)" data={targets.pa} color="#10b981" />
                        <MiniGauge label="PA + Service" data={targets.paService} color="#14b8a6" />
                        <MiniGauge label="CK (Cipta Kridatama)" data={targets.ck} color="#6b7280" />
                        <MiniGauge label="SIS (Saptaindra Sejati)" data={targets.sis} color="#a855f7" />
                    </div>
                </div>
            </div>

            {/* ─── ROW 4: Product Accessories + Rank Material ───────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Product Accessories Table */}
                <div className="bg-card border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/30">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Product Accessories</h3>
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

                    {/* Transaction Type */}
                    <div className="px-4 py-3 border-t border-b bg-muted/30 mt-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Transaction Type</h3>
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

                {/* Rank Material Sell Out */}
                <div className="bg-card border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/30 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rank. Material Sell Out</h3>
                        <span className="text-[10px] text-muted-foreground">1 - {materials.length} / {materials.length}</span>
                    </div>
                    <div className="overflow-auto max-h-[450px] scrollbar-thin scrollbar-thumb-accent">
                        <table className="w-full text-xs">
                            <thead className="bg-primary/5 sticky top-0">
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
                <div className="px-4 py-3 border-b flex items-center gap-2">
                    <div className="w-3 h-6 rounded bg-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Revenue YTD</h3>
                </div>
                <div className="p-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ytdFormatted.length > 0 ? ytdFormatted : [{ name: '-', revenue: 0 }]} margin={{ top: 24, right: 20, left: 40, bottom: 5 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <YAxis hide />
                            <Tooltip
                                formatter={(v: number) => [fmt(v), 'Revenue']}
                                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                                cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                            />
                            <Bar dataKey="revenue" fill="#a5b4fc" radius={[6, 6, 0, 0]}
                                label={{ position: 'top', formatter: (v: number) => fmt(v, true), fontSize: 10, fill: '#64748b' }}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ─── Footer ───────────────────────────────────────────────────────── */}
            <div className="text-center text-[10px] text-muted-foreground border-t pt-3">
                Dashboard Revenue vs Forecast |{" "}
                <a href="/dashboard/forecasts" className="underline hover:text-primary">Kelolaan Forecast</a>
            </div>
        </div>
    )
}
