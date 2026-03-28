"use client"

import type { SalesReportData } from "@/app/dashboard/reports/types"
import { ReportEmptyState, ReportKPIGrid } from "@/components/reports/report-components"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Area, AreaChart, Bar, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowRight, Cog, Package, ShieldAlert, Truck, Wrench } from "lucide-react"
import Link from "next/link"

const CARD = "border-slate-200 bg-white text-slate-950 shadow-sm"
const GRID = "#e2e8f0"
const TICK = "#64748b"
const TOOLTIP = { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#0f172a" }

export function SalesReportClient({ data }: { data: SalesReportData }) {
    const totalSales = data.salesTrend.reduce((sum, d) => sum + d.sales, 0)
    const totalOrders = data.salesTrend.reduce((sum, d) => sum + d.orders, 0)
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
    const recentSales = data.salesTrend.slice(-7).reduce((sum, d) => sum + d.sales, 0)
    const previousSales = data.salesTrend.slice(-14, -7).reduce((sum, d) => sum + d.sales, 0)
    const growthRate = previousSales > 0 ? ((recentSales - previousSales) / previousSales) * 100 : 0
    const momentum = buildRevenueMomentum(data)
    const mix = buildCategoryMix(data)
    const yoy = data.monthlyComparison.slice(-6).map((r, i, arr) => ({
        period: new Date(`${r.month}-01`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        current: r.currentYear,
        previous: r.previousYear,
        forecast: i === arr.length - 1 ? data.forecastNextMonth : null,
        target: data.salesTarget.target,
    }))

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        { title: "Total Revenue", value: formatCurrency(totalSales), change: growthRate, changeLabel: "vs previous period", icon: "dollar", variant: "success" },
        { title: "Gross Profit Margin", value: `${data.grossProfitMargin.toFixed(1)}%`, icon: "target", variant: data.grossProfitMargin >= 22 ? "success" : data.grossProfitMargin >= 12 ? "warning" : "danger" },
        { title: "Total Orders", value: totalOrders.toLocaleString(), icon: "sales", variant: "default" },
        { title: "Avg Order Value", value: formatCurrency(avgOrderValue), icon: "trendingUp", variant: "default" },
        { title: "Monthly Target", value: `${data.salesTarget.percentage.toFixed(1)}%`, icon: "target", variant: data.salesTarget.percentage >= 90 ? "success" : data.salesTarget.percentage >= 70 ? "warning" : "danger" },
        { title: "Next Month Forecast", value: formatCurrency(data.forecastNextMonth), icon: "chart", variant: "default" },
    ]

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:px-6">
                <Card className="border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 shadow-sm">
                    <CardHeader className="gap-4">
                        <div className="flex flex-wrap gap-2">
                            <Badge className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">Forecast Active</Badge>
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">Top 5 Accounts {data.concentrationTop5.toFixed(1)}%</Badge>
                            <Badge className={`${data.grossProfitMargin >= 15 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"} hover:bg-inherit`}>Margin {data.grossProfitMargin >= 15 ? "Stable" : "Under Watch"}</Badge>
                        </div>
                        <div>
                            <CardTitle className="text-2xl tracking-tight">Sales Intelligence Report</CardTitle>
                            <CardDescription className="max-w-3xl text-sm text-slate-600">Cockpit komersial untuk membaca kualitas revenue, konsentrasi account, dan proyeksi bulan berikutnya.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-3">
                        <MiniTile label="Growth signal" value={`${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`} text="Perubahan run-rate 7 hari terakhir." tone={growthRate >= 0 ? "emerald" : "rose"} />
                        <MiniTile label="Target gap" value={formatCurrency(Math.abs(data.salesTarget.remaining))} text={data.salesTarget.remaining <= 0 ? "Sudah melampaui target." : "Revenue tambahan untuk menutup target."} tone={data.salesTarget.remaining <= 0 ? "emerald" : "amber"} />
                        <MiniTile label="Forecast confidence" value={data.salesTrend.length >= 14 ? "Medium" : "Low"} text="Dashed line memakai trend 3 periode terakhir." tone="sky" />
                    </CardContent>
                </Card>
                <Card className={CARD}>
                    <CardHeader>
                        <CardTitle>Management Reading</CardTitle>
                        <CardDescription>Tiga sinyal yang paling layak dibawa ke forum sales leadership.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Callout title="Revenue concentration" text={`Top 5 accounts menyumbang ${data.concentrationTop5.toFixed(1)}% dari revenue.`} tone={data.concentrationTop5 > 55 ? "rose" : "emerald"} />
                        <Callout title="Margin quality" text={`Estimated gross margin berada di ${data.grossProfitMargin.toFixed(1)}%.`} tone={data.grossProfitMargin >= 15 ? "emerald" : "amber"} />
                        <Callout title="Forward view" text={`Forecast bulan depan berada di ${formatCurrency(data.forecastNextMonth)}.`} tone={data.forecastNextMonth >= data.salesTarget.target ? "emerald" : "amber"} />
                    </CardContent>
                </Card>
            </div>

            <div className="px-4 lg:px-6"><ReportKPIGrid kpis={kpis} /></div>

            <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:px-6">
                <Card className={CARD}>
                    <CardHeader><CardTitle>Revenue momentum</CardTitle><CardDescription>Actual revenue dengan dashed forecast line untuk membaca arah penjualan.</CardDescription></CardHeader>
                    <CardContent>{momentum.length < 2 ? <ReportEmptyState title="Belum cukup histori revenue untuk forecast" description="Minimal 2 periode valid diperlukan." icon="chart" /> : <RevenueMomentumChart data={momentum} />}</CardContent>
                </Card>
                <Card className={CARD}>
                    <CardHeader><CardTitle>Target attainment</CardTitle><CardDescription>Ringkas untuk melihat actual, target, dan gap.</CardDescription></CardHeader>
                    <CardContent className="space-y-5">
                        <div className="flex justify-center"><Gauge value={data.salesTarget.percentage} /></div>
                        <MetricRow label="Actual" value={formatCurrency(data.salesTarget.actual)} />
                        <MetricRow label="Target" value={formatCurrency(data.salesTarget.target)} />
                        <MetricRow label="Gap" value={formatCurrency(Math.abs(data.salesTarget.remaining))} className={data.salesTarget.remaining <= 0 ? "text-emerald-600" : "text-rose-600"} />
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                <Card className={CARD}>
                    <CardHeader><CardTitle>Revenue concentration shows top-account dependency</CardTitle><CardDescription>Account paling dominan terhadap omzet.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {data.salesByCustomer.slice(0, 10).map((a, i) => <ProgressList key={a.customerId} rank={i + 1} label={a.customerName} right={`${a.revenueShare.toFixed(1)}%`} value={a.revenueShare} tone="sky" />)}
                    </CardContent>
                </Card>
                <Card className={CARD}>
                    <CardHeader><CardTitle>Category revenue mix</CardTitle><CardDescription>Horizontal bars dipakai agar tidak ada label donut yang bertabrakan.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        {mix.map((m, i) => <ProgressList key={m.name} rank={i + 1} label={m.name} right={`${formatCurrency(m.value)} · ${m.share.toFixed(1)}%`} value={m.share} tone={i < 3 ? "emerald" : "slate"} />)}
                    </CardContent>
                </Card>
            </div>

            <div className="px-4 lg:px-6">
                <Card className={CARD}>
                    <CardHeader><CardTitle>YoY performance with forward-looking overlay</CardTitle><CardDescription>Current year, prior year, target, dan forecast dalam satu pandangan.</CardDescription></CardHeader>
                    <CardContent>{yoy.length < 2 ? <ReportEmptyState title="Belum cukup histori YoY" description="Perbandingan membutuhkan minimal dua periode bulanan." icon="chart" /> : <YoyChart data={yoy} />}</CardContent>
                </Card>
            </div>

            <div className="px-4 lg:px-6">
                <Card className={CARD}>
                    <CardHeader><CardTitle>Top 20 revenue accounts</CardTitle><CardDescription>Baris tabel dibuat hoverable untuk mengisyaratkan drill-down ke histori pembelian account.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1180px]">
                                <thead><tr className="border-b border-slate-200 bg-slate-50 text-sm"><th className="px-4 py-3 text-left font-medium text-slate-600">Rank</th><th className="px-4 py-3 text-left font-medium text-slate-600">Account</th><th className="px-4 py-3 text-right font-medium text-slate-600">Revenue</th><th className="px-4 py-3 text-right font-medium text-slate-600">Avg Order</th><th className="px-4 py-3 text-right font-medium text-slate-600">Orders</th><th className="px-4 py-3 text-right font-medium text-slate-600">Last Order</th><th className="px-4 py-3 text-right font-medium text-slate-600">30D vs Hist Avg</th><th className="px-4 py-3 text-center font-medium text-slate-600">Health</th><th className="px-4 py-3 text-center font-medium text-slate-600">Churn Risk</th><th className="px-4 py-3 text-right font-medium text-slate-600"></th></tr></thead>
                                <tbody>
                                    {data.salesByCustomer.map((c, i) => {
                                        const ratio = c.historicalAverageSales > 0 ? ((c.recentSales / 2) / c.historicalAverageSales) * 100 : 100
                                        return <tr key={c.customerId} className="group cursor-pointer border-b border-slate-100 transition-all hover:bg-sky-50/70 hover:shadow-sm">
                                            <td className="px-4 py-4"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">{i + 1}</div></td>
                                            <td className="px-4 py-4"><div className="flex items-start gap-3"><div className={`mt-1 h-2.5 w-2.5 rounded-full ${toneDot(c.accountHealth)}`} /><div><p className="font-medium text-slate-950">{c.customerName}</p><p className="text-xs text-slate-500">{c.customerCode}</p></div></div></td>
                                            <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">{formatCurrency(c.totalSales)}</td>
                                            <td className="px-4 py-4 text-right tabular-nums text-slate-600">{formatCurrency(c.averageOrderValue)}</td>
                                            <td className="px-4 py-4 text-right tabular-nums text-slate-600">{c.orderCount.toLocaleString()}</td>
                                            <td className="px-4 py-4 text-right text-sm text-slate-600">{c.lastOrderDate ? c.lastOrderDate.toLocaleDateString("id-ID") : "No order"}</td>
                                            <td className={`px-4 py-4 text-right font-medium tabular-nums ${ratio >= 90 ? "text-emerald-600" : ratio >= 60 ? "text-amber-600" : "text-rose-600"}`}>{ratio.toFixed(0)}%</td>
                                            <td className="px-4 py-4 text-center"><Status tone={healthTone(c.accountHealth)} label={c.accountHealth} /></td>
                                            <td className="px-4 py-4 text-center"><Status tone={riskTone(c.churnRisk)} label={c.churnRisk} /></td>
                                            <td className="px-4 py-4 text-right"><Link href={`/dashboard/reports/customers/360?customer=${encodeURIComponent(c.customerCode || String(c.customerId))}`} className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 opacity-0 transition-opacity group-hover:opacity-100">Drill down<ArrowRight className="h-4 w-4" /></Link></td>
                                        </tr>
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="px-4 pb-6 lg:px-6">
                <Card className={CARD}>
                    <CardHeader><CardTitle>Top revenue-driving products</CardTitle><CardDescription>Produk dibuat lebih mudah discan dengan category icon dan emphasis pada revenue.</CardDescription></CardHeader>
                    <CardContent><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{data.salesByProduct.slice(0, 12).map((p, i) => <ProductCard key={p.productId} index={i + 1} product={p} />)}</div></CardContent>
                </Card>
            </div>
        </div>
    )
}

function RevenueMomentumChart({ data }: { data: { label: string; actual: number; forecast: number | null }[] }) {
    return <div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}><defs><linearGradient id="salesMomentumGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={formatCompactCurrency} tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} formatter={(v: number, n: string) => [formatCurrency(v), n === "actual" ? "Actual Revenue" : "Forecast"]} /><Area type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2.5} fill="url(#salesMomentumGradient)" /><Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="7 6" dot={{ r: 3, fill: "#f59e0b" }} connectNulls /></AreaChart></ResponsiveContainer></div>
}

function YoyChart({ data }: { data: { period: string; current: number; previous: number; forecast: number | null; target: number }[] }) {
    return <div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}><CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={formatCompactCurrency} tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} formatter={(v: number) => formatCurrency(v)} /><Bar dataKey="current" fill="#38bdf8" radius={[6, 6, 0, 0]} name="Current Year" /><Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3, fill: "#94a3b8" }} name="Previous Year" /><Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="7 6" dot={{ r: 3, fill: "#f59e0b" }} connectNulls name="Forecast" /><Line type="monotone" dataKey="target" stroke="#10b981" strokeWidth={2} strokeDasharray="3 5" dot={false} name="Target" /></ComposedChart></ResponsiveContainer></div>
}

function Gauge({ value }: { value: number }) {
    const color = value >= 90 ? "#10b981" : value >= 70 ? "#f59e0b" : "#e11d48"
    return <div className="relative h-44 w-44"><svg viewBox="0 0 200 200" className="-rotate-90"><circle cx="100" cy="100" r="72" fill="none" stroke="#e2e8f0" strokeWidth="18" /><circle cx="100" cy="100" r="72" fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" strokeDasharray={`${Math.min(value, 100) * 4.52} 999`} /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><p className="text-3xl font-semibold text-slate-950">{value.toFixed(1)}%</p><p className="text-xs uppercase tracking-[0.18em] text-slate-500">attained</p></div></div>
}

function ProductCard({ index, product }: { index: number; product: SalesReportData["salesByProduct"][number] }) {
    return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">{index}</div><div><p className="font-medium text-slate-950">{product.productName}</p><p className="text-xs text-slate-500">{product.materialNumber}</p></div></div><div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">{iconForCategory(product.category)}{product.category}</div></div><div className="mt-4 grid grid-cols-2 gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Quantity</p><p className="mt-1 text-lg font-semibold text-slate-950">{product.quantitySold.toLocaleString()}</p></div><div className="text-right"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Revenue</p><p className="mt-1 text-lg font-semibold text-emerald-600">{formatCurrency(product.totalRevenue)}</p></div></div></div>
}

function MiniTile({ label, value, text, tone }: { label: string; value: string; text: string; tone: "emerald" | "amber" | "rose" | "sky" }) {
    const map = { emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-600", amber: "border-amber-200 bg-amber-50/80 text-amber-600", rose: "border-rose-200 bg-rose-50/80 text-rose-600", sky: "border-sky-200 bg-sky-50/80 text-sky-600" }[tone]
    return <div className={`rounded-2xl border p-4 ${map}`}><p className="text-xs font-medium uppercase tracking-[0.18em]">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-600">{text}</p></div>
}

function Callout({ title, text, tone }: { title: string; text: string; tone: "emerald" | "amber" | "rose" }) {
    const cls = tone === "emerald" ? "border-emerald-200 bg-emerald-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"
    return <div className={`rounded-2xl border p-4 ${cls}`}><p className="font-medium text-slate-950">{title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div>
}

function MetricRow({ label, value, className }: { label: string; value: string; className?: string }) {
    return <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0"><span className="text-slate-500">{label}</span><span className={`font-medium text-slate-950 ${className ?? ""}`}>{value}</span></div>
}

function ProgressList({ rank, label, right, value, tone }: { rank: number; label: string; right: string; value: number; tone: "sky" | "emerald" | "slate" }) {
    const bar = tone === "sky" ? "bg-sky-500" : tone === "emerald" ? "bg-emerald-500" : "bg-slate-400"
    return <div><div className="mb-1 flex items-center justify-between gap-3 text-sm"><div className="flex items-center gap-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">{rank}</span><span className="font-medium text-slate-900">{label}</span></div><span className="tabular-nums text-slate-600">{right}</span></div><div className="h-3 rounded-full bg-slate-100"><div className={`h-3 rounded-full ${bar}`} style={{ width: `${Math.max(8, value)}%` }} /></div></div>
}

function Status({ tone, label }: { tone: "emerald" | "amber" | "rose"; label: string }) {
    const cls = tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-rose-200 bg-rose-50 text-rose-700"
    return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>
}

function buildRevenueMomentum(data: SalesReportData) {
    const rows = data.salesTrend.slice(-12).map((r) => ({ label: new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), actual: r.sales, forecast: null as number | null }))
    if (rows.length > 0) rows.push({ label: "Next Month", actual: 0, forecast: data.forecastNextMonth })
    return rows
}

function buildCategoryMix(data: SalesReportData) {
    const sorted = [...data.salesByCategory].sort((a, b) => b.totalSales - a.totalSales)
    const top = sorted.slice(0, 5).map((i) => ({ name: i.category, value: i.totalSales, share: i.percentage }))
    const rest = sorted.slice(5)
    if (rest.length > 0) top.push({ name: "Others", value: rest.reduce((s, i) => s + i.totalSales, 0), share: rest.reduce((s, i) => s + i.percentage, 0) })
    return top
}

function healthTone(label: string) { return label === "Healthy" ? "emerald" : label === "Watch" ? "amber" : "rose" }
function riskTone(label: string) { return label === "Low" ? "emerald" : label === "Medium" ? "amber" : "rose" }
function toneDot(label: string) { return label === "Healthy" ? "bg-emerald-500" : label === "Watch" ? "bg-amber-500" : "bg-rose-500" }

function iconForCategory(category: string) {
    const c = category.toLowerCase()
    if (c.includes("tyre") || c.includes("tire")) return <Truck className="h-3.5 w-3.5" />
    if (c.includes("part")) return <Cog className="h-3.5 w-3.5" />
    if (c.includes("service")) return <Wrench className="h-3.5 w-3.5" />
    if (c.includes("tube") || c.includes("flap")) return <ShieldAlert className="h-3.5 w-3.5" />
    return <Package className="h-3.5 w-3.5" />
}

function formatCurrency(val: number) { if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)} Miliar`; if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)} Juta`; if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`; return `Rp ${val.toLocaleString("id-ID")}` }
function formatCompactCurrency(val: number) { if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} Miliar`; if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)} Juta`; if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`; return `${val}` }
