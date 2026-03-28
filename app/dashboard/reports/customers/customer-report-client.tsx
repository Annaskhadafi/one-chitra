"use client"

import type { CustomerReportData } from "@/app/dashboard/reports/types"
import { ReportEmptyState, ReportKPIGrid } from "@/components/reports/report-components"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CartesianGrid, Bar, BarChart, Cell, Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie } from "recharts"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

const CARD = "border-slate-200 bg-white text-slate-950 shadow-sm"
const GRID = "#e2e8f0"
const TICK = "#64748b"
const TOOLTIP = { backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#0f172a" }

export function CustomerReportClient({ data }: { data: CustomerReportData }) {
    const latestGrowth = data.customerGrowth[data.customerGrowth.length - 1]?.newCustomers ?? 0
    const previousGrowth = data.customerGrowth[data.customerGrowth.length - 2]?.newCustomers ?? 0
    const growthChange = previousGrowth > 0 ? ((latestGrowth - previousGrowth) / previousGrowth) * 100 : 0
    const growthSeries = data.customerGrowth.map((g) => ({ label: new Date(`${g.month}-01`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }), newCustomers: g.newCustomers, cumulative: g.cumulativeCustomers }))
    const topPool = data.topCustomers.slice(0, 10).map((c) => ({ name: c.customerName, value: c.totalRevenue }))
    const segmentation = data.customerSegmentation.map((s) => ({ name: s.segment, value: s.count }))
    const neverOrdered = data.customerActivity.find((x) => x.status === "Never Ordered")?.count ?? 0
    const funnel = [
        { stage: "All Customers", value: data.repeatPurchaseRate.totalCustomers, fill: "#38bdf8" },
        { stage: "1st Purchase", value: Math.max(0, data.repeatPurchaseRate.totalCustomers - neverOrdered), fill: "#60a5fa" },
        { stage: "Repeat Buyers", value: data.repeatPurchaseRate.repeatCustomers, fill: "#34d399" },
        { stage: "VIP Repeat", value: data.topCustomers.filter((c) => c.segment === "VIP" && c.totalOrders > 1).length, fill: "#10b981" },
    ]

    const kpis: React.ComponentProps<typeof ReportKPIGrid>["kpis"] = [
        { title: "Total Customers", value: data.repeatPurchaseRate.totalCustomers.toLocaleString(), icon: "users", variant: "default" },
        { title: "New Customers", value: latestGrowth, change: growthChange, changeLabel: "vs prev month", icon: "userPlus", variant: "success" },
        { title: "Repeat Purchase Rate", value: `${data.repeatPurchaseRate.repeatRate.toFixed(1)}%`, icon: "repeat", variant: data.repeatPurchaseRate.repeatRate >= 35 ? "success" : "warning" },
        { title: "Avg Orders / Customer", value: data.repeatPurchaseRate.averageOrdersPerCustomer.toFixed(1), icon: "star", variant: "default" },
        { title: "Account Health Score", value: `${data.accountHealthScore.toFixed(0)}/100`, icon: "activity", variant: data.accountHealthScore >= 75 ? "success" : data.accountHealthScore >= 50 ? "warning" : "danger" },
        { title: "Estimated CLV", value: formatCurrency(data.estimatedClv), icon: "dollar", variant: "default" },
    ]

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:px-6">
                <Card className="border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 shadow-sm">
                    <CardHeader className="gap-4">
                        <div className="flex flex-wrap gap-2">
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Retention Focus</Badge>
                            <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">VIP Risk {data.topCustomers.filter((c) => c.segment === "VIP" && c.churnRisk !== "Low").length}</Badge>
                            <Badge className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">CLV Enabled</Badge>
                        </div>
                        <div>
                            <CardTitle className="text-2xl tracking-tight">Customer Intelligence Report</CardTitle>
                            <CardDescription className="max-w-3xl text-sm text-slate-600">Dashboard retensi B2B untuk membaca kesehatan account, risiko churn, dan nilai jangka panjang pelanggan.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-3">
                        <MiniTile label="Retention signal" value={`${data.repeatPurchaseRate.repeatRate.toFixed(1)}%`} text="Persentase customer yang kembali membeli." tone={data.repeatPurchaseRate.repeatRate >= 35 ? "emerald" : "amber"} />
                        <MiniTile label="At-risk accounts" value={String(data.topCustomers.filter((c) => c.churnRisk === "High").length)} text="Akun utama yang perlu proaktif dihubungi." tone={data.topCustomers.some((c) => c.churnRisk === "High") ? "rose" : "emerald"} />
                        <MiniTile label="Portfolio CLV" value={formatCurrency(data.estimatedClv)} text="Estimasi nilai lifetime dari top-value accounts." tone="sky" />
                    </CardContent>
                </Card>
                <Card className={CARD}>
                    <CardHeader><CardTitle>Management Reading</CardTitle><CardDescription>Tiga fokus utama untuk sales retention dan account coverage.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        <Callout title="Recency risk" text="Days since last order menjadi trigger tercepat untuk proactive sales call." tone="amber" />
                        <Callout title="Retention quality" text={`${data.repeatPurchaseRate.repeatCustomers.toLocaleString()} customer sudah masuk kategori repeat.`} tone={data.repeatPurchaseRate.repeatRate >= 35 ? "emerald" : "amber"} />
                        <Callout title="VIP protection" text={`${data.topCustomers.filter((c) => c.segment === "VIP").length} akun VIP perlu dipantau dengan Customer 360.`} tone="sky" />
                    </CardContent>
                </Card>
            </div>

            <div className="px-4 lg:px-6"><ReportKPIGrid kpis={kpis} /></div>

            <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                <Card className={CARD}>
                    <CardHeader><CardTitle>Customer value segmentation</CardTitle><CardDescription>Segmentasi dipertahankan sederhana agar distribusi VIP, Regular, dan Small mudah dibaca.</CardDescription></CardHeader>
                    <CardContent><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={segmentation} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={3}>{segmentation.map((_, i) => <Cell key={i} fill={["#38bdf8", "#34d399", "#f59e0b"][i % 3]} />)}</Pie><Tooltip contentStyle={TOOLTIP} formatter={(v: number) => `${v.toLocaleString()} customers`} /></PieChart></ResponsiveContainer></div></CardContent>
                </Card>
                <Card className={CARD}>
                    <CardHeader><CardTitle>Repeat purchase funnel</CardTitle><CardDescription>Funnel kini menonjolkan penurunan dari first-time buyer ke repeat dan VIP repeat.</CardDescription></CardHeader>
                    <CardContent><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><FunnelChart><Tooltip contentStyle={TOOLTIP} /><Funnel dataKey="value" data={funnel} isAnimationActive><LabelList position="right" dataKey="stage" fill="#334155" stroke="none" /></Funnel></FunnelChart></ResponsiveContainer></div></CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                <Card className={CARD}>
                    <CardHeader><CardTitle>Customer acquisition momentum</CardTitle><CardDescription>Bar chart besar diganti menjadi time-series supaya pertumbuhan MoM lebih jelas dibaca.</CardDescription></CardHeader>
                    <CardContent>{growthSeries.length < 2 ? <ReportEmptyState title="Belum cukup histori akuisisi" description="Minimal 2 bulan histori diperlukan untuk membaca momentum pelanggan baru." icon="chart" /> : <div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={growthSeries}><CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TOOLTIP} /><Bar dataKey="newCustomers" fill="#38bdf8" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>}</CardContent>
                </Card>
                <Card className={CARD}>
                    <CardHeader><CardTitle>Top customer value pool</CardTitle><CardDescription>Top customer value pool dipakai untuk melihat siapa yang paling menentukan kualitas revenue jangka panjang.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">{topPool.map((c, i) => <ProgressList key={`${c.name}-${i}`} label={c.name} right={formatCurrency(c.value)} value={Math.max(8, (c.value / Math.max(...topPool.map((x) => x.value), 1)) * 100)} />)}</CardContent>
                </Card>
            </div>

            <div className="px-4 pb-6 lg:px-6">
                <Card className={CARD}>
                    <CardHeader><CardTitle>Executive customer leaderboard</CardTitle><CardDescription>Baris dibuat hoverable untuk mengisyaratkan drill-down ke Customer 360 Profile.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1180px]">
                                <thead><tr className="border-b border-slate-200 bg-slate-50 text-sm"><th className="px-4 py-3 text-left font-medium text-slate-600">Rank</th><th className="px-4 py-3 text-left font-medium text-slate-600">Customer</th><th className="px-4 py-3 text-right font-medium text-slate-600">Days Since Last Order</th><th className="px-4 py-3 text-center font-medium text-slate-600">Health</th><th className="px-4 py-3 text-center font-medium text-slate-600">Churn Risk</th><th className="px-4 py-3 text-right font-medium text-slate-600">Total Orders</th><th className="px-4 py-3 text-right font-medium text-slate-600">Avg Order</th><th className="px-4 py-3 text-right font-medium text-slate-600">Total Revenue</th><th className="px-4 py-3 text-right font-medium text-slate-600">CLV</th><th className="px-4 py-3 text-right font-medium text-slate-600"></th></tr></thead>
                                <tbody>
                                    {data.topCustomers.slice(0, 15).map((c, i) => <tr key={c.customerId} className="group cursor-pointer border-b border-slate-100 transition-all hover:bg-emerald-50/60 hover:shadow-sm">
                                        <td className="px-4 py-4"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">{i + 1}</div></td>
                                        <td className="px-4 py-4"><div className="flex items-start gap-3"><div className={`mt-1 h-2.5 w-2.5 rounded-full ${dot(c.accountHealth)}`} /><div><p className="font-medium text-slate-950">{c.customerName}</p><p className="text-xs text-slate-500">{c.customerCode}{c.segment === "VIP" ? " · VIP" : ""}</p></div></div></td>
                                        <td className={`px-4 py-4 text-right font-medium ${daysTone(c.daysSinceLastOrder)}`}>{c.daysSinceLastOrder === null ? "No order" : `${c.daysSinceLastOrder} days`}</td>
                                        <td className="px-4 py-4 text-center"><Status tone={healthTone(c.accountHealth)} label={c.accountHealth} /></td>
                                        <td className="px-4 py-4 text-center"><Status tone={riskTone(c.churnRisk)} label={c.churnRisk} /></td>
                                        <td className="px-4 py-4 text-right tabular-nums text-slate-600">{c.totalOrders.toLocaleString()}</td>
                                        <td className="px-4 py-4 text-right tabular-nums text-slate-600">{formatCurrency(c.averageOrderValue)}</td>
                                        <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-950">{formatCurrency(c.totalRevenue)}</td>
                                        <td className="px-4 py-4 text-right tabular-nums text-sky-700">{c.segment === "VIP" ? formatCurrency(c.estimatedClv) : "-"}</td>
                                        <td className="px-4 py-4 text-right"><Link href={`/dashboard/reports/customers/360?customer=${encodeURIComponent(c.customerCode || String(c.customerId))}`} className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100">Customer 360<ArrowRight className="h-4 w-4" /></Link></td>
                                    </tr>)}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function MiniTile({ label, value, text, tone }: { label: string; value: string; text: string; tone: "emerald" | "amber" | "rose" | "sky" }) {
    const map = { emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-600", amber: "border-amber-200 bg-amber-50/80 text-amber-600", rose: "border-rose-200 bg-rose-50/80 text-rose-600", sky: "border-sky-200 bg-sky-50/80 text-sky-600" }[tone]
    return <div className={`rounded-2xl border p-4 ${map}`}><p className="text-xs font-medium uppercase tracking-[0.18em]">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-600">{text}</p></div>
}

function Callout({ title, text, tone }: { title: string; text: string; tone: "emerald" | "amber" | "sky" }) {
    const cls = tone === "emerald" ? "border-emerald-200 bg-emerald-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50"
    return <div className={`rounded-2xl border p-4 ${cls}`}><p className="font-medium text-slate-950">{title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div>
}

function ProgressList({ label, right, value }: { label: string; right: string; value: number }) {
    return <div><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-900">{label}</span><span className="tabular-nums text-slate-600">{right}</span></div><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-sky-500" style={{ width: `${value}%` }} /></div></div>
}

function Status({ tone, label }: { tone: "emerald" | "amber" | "rose"; label: string }) {
    const cls = tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-rose-200 bg-rose-50 text-rose-700"
    return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>
}

function healthTone(label: string) { return label === "Healthy" ? "emerald" : label === "Watch" ? "amber" : "rose" }
function riskTone(label: string) { return label === "Low" ? "emerald" : label === "Medium" ? "amber" : "rose" }
function dot(label: string) { return label === "Healthy" ? "bg-emerald-500" : label === "Watch" ? "bg-amber-500" : "bg-rose-500" }
function daysTone(days: number | null) { if (days === null) return "text-rose-600"; if (days <= 30) return "text-emerald-600"; if (days <= 90) return "text-amber-600"; return "text-rose-600" }
function formatCurrency(val: number) { if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)} Miliar`; if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)} Juta`; if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`; return `Rp ${val.toLocaleString("id-ID")}` }
