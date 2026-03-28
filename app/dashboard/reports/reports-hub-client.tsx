"use client"

import { type ComponentType, useMemo, useState } from "react"
import Link from "next/link"
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/formatters"
import {
    ArrowRight,
    BarChart3,
    BrainCircuit,
    CircleAlert,
    FileCheck2,
    Package,
    ShoppingCart,
    Target,
    TrendingUp,
    Truck,
    Users,
    Warehouse,
} from "lucide-react"

type ReportCard = {
    title: string
    description: string
    focus: string
    href: string
    icon: ComponentType<{ className?: string }>
    color: string
    iconColor: string
    priority: "Immediate" | "Strategic" | "Watchlist"
}

type Props = {
    metrics: {
        totalRevenue: number
        totalCustomers: number
        totalSalesOrders: number
        lowStockItems: number
        totalProducts: number
        pendingDeliveries: number
        pendingQuotations: number
        approvalRate: number
        quotationPipeline: number
        salesMomentum: number
        stockRisk: number
        deliveryPressure: number
        topCategoryShare: number
        topCategoryName: string | null
        latestSales: number
        averageSales: number
        revenueScore: number
        serviceScore: number
        inventoryScore: number
        commercialScore: number
    }
    salesSeries: { month: string; value: number }[]
    categorySeries: { category: string | null; count: number }[]
    recentOrders: { id: number; invoiceNumber: string | null; customerName: string; salesDate: string; status: string; totalValue: number }[]
    stockAlerts: { productName: string; materialNumber: string; warehouseName: string; currentStock: number; minStock: number }[]
}

const reportCards: ReportCard[] = [
    { title: "Inventory Control", description: "Kontrol stok kritis, movement, dan alert yang paling berpengaruh ke service level.", focus: "Prioritas SKU rawan stockout dan sinyal replenishment.", icon: Package, href: "/dashboard/reports/inventory", color: "from-sky-500/15 via-white to-blue-500/10 border-sky-200/70", iconColor: "text-sky-700", priority: "Immediate" },
    { title: "Sales Intelligence", description: "Membaca momentum revenue, kualitas order, dan arah pertumbuhan secara lebih tajam.", focus: "Baseline growth, trend deviation, dan peluang forecast.", icon: TrendingUp, href: "/dashboard/reports/sales", color: "from-emerald-500/15 via-white to-teal-500/10 border-emerald-200/70", iconColor: "text-emerald-700", priority: "Strategic" },
    { title: "Customer Intelligence", description: "Segmentasi pelanggan, konsentrasi penjualan, dan sinyal perilaku order.", focus: "Pembacaan pelanggan tumbuh, stagnan, atau berisiko turun.", icon: Users, href: "/dashboard/reports/customers", color: "from-violet-500/15 via-white to-fuchsia-500/10 border-violet-200/70", iconColor: "text-violet-700", priority: "Strategic" },
    { title: "Order Fulfillment", description: "Tekanan backlog, kecepatan pemenuhan, dan risiko keterlambatan pengiriman.", focus: "Deteksi order yang perlu intervensi tercepat.", icon: Truck, href: "/dashboard/reports/orders", color: "from-amber-500/15 via-white to-orange-500/10 border-amber-200/70", iconColor: "text-amber-700", priority: "Immediate" },
    { title: "Product Performance", description: "Pantau champion SKU, konsentrasi kategori, dan peluang monetisasi portofolio.", focus: "Pareto mix dan growth pocket per kategori.", icon: ShoppingCart, href: "/dashboard/reports/products", color: "from-rose-500/15 via-white to-pink-500/10 border-rose-200/70", iconColor: "text-rose-700", priority: "Strategic" },
    { title: "Warehouse & Logistics", description: "Kapasitas gudang, kesiapan distribusi, dan bottleneck logistik yang perlu dibuka.", focus: "Visibility throughput dan tekanan operasional.", icon: Warehouse, href: "/dashboard/reports/warehouse", color: "from-cyan-500/15 via-white to-sky-500/10 border-cyan-200/70", iconColor: "text-cyan-700", priority: "Immediate" },
    { title: "Approval Performance", description: "Memahami SLA approval, beban kerja, dan friction proses yang menahan eksekusi.", focus: "Aging approval dan peluang simplifikasi digital.", icon: FileCheck2, href: "/dashboard/reports/approvals", color: "from-slate-500/15 via-white to-zinc-500/10 border-slate-200/70", iconColor: "text-slate-700", priority: "Watchlist" },
    { title: "SCM Monthly Intelligence", description: "Hub ringkasan bulanan untuk menilai stabilitas dan disiplin supply chain.", focus: "Narasi eksekutif untuk transformasi digital SCM.", icon: BarChart3, href: "/dashboard/reports/scm", color: "from-indigo-500/15 via-white to-blue-500/10 border-indigo-200/70", iconColor: "text-indigo-700", priority: "Strategic" },
]

function clamp(value: number, min = 0, max = 100) {
    return Math.min(Math.max(value, min), max)
}

export function ReportsHubClient({ metrics, salesSeries, categorySeries, recentOrders, stockAlerts }: Props) {
    const [weights, setWeights] = useState({
        revenue: 35,
        inventory: 25,
        service: 20,
        commercial: 20,
    })

    const totalWeight = weights.revenue + weights.inventory + weights.service + weights.commercial

    const transformationScore = useMemo(() => {
        const normalized = {
            revenue: weights.revenue / totalWeight,
            inventory: weights.inventory / totalWeight,
            service: weights.service / totalWeight,
            commercial: weights.commercial / totalWeight,
        }

        return Math.round(
            metrics.revenueScore * normalized.revenue +
            metrics.inventoryScore * normalized.inventory +
            metrics.serviceScore * normalized.service +
            metrics.commercialScore * normalized.commercial
        )
    }, [metrics, totalWeight, weights])

    const radarData = [
        { metric: "Revenue", score: Math.round(metrics.revenueScore), full: 100 },
        { metric: "Inventory", score: Math.round(metrics.inventoryScore), full: 100 },
        { metric: "Service", score: Math.round(metrics.serviceScore), full: 100 },
        { metric: "Commercial", score: Math.round(metrics.commercialScore), full: 100 },
    ]

    const trendData = salesSeries.map((item) => ({
        month: new Date(`${item.month}-01`).toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
        sales: item.value,
        baseline: metrics.averageSales,
    }))

    const categoryData = categorySeries.slice(0, 6).map((item) => ({
        category: item.category || "Unknown",
        count: item.count,
    }))

    const prioritySignals = [
        {
            title: "Revenue momentum",
            display: metrics.salesMomentum >= 0 ? `+${formatPercentage(metrics.salesMomentum)}` : formatPercentage(metrics.salesMomentum),
            note: metrics.salesMomentum >= 0 ? "Pertumbuhan masih berada di atas baseline periodik." : "Pertumbuhan mulai melandai dan perlu validasi cepat pada order mix.",
        },
        {
            title: "Inventory exposure",
            display: formatPercentage(metrics.stockRisk),
            note: "Paparan stok kritis yang dapat mengganggu availability dan lost sales.",
        },
        {
            title: "Fulfillment pressure",
            display: formatPercentage(metrics.deliveryPressure),
            note: "Tekanan backlog pada pengiriman dan potensi erosi service level.",
        },
    ]

    const focusAreas = [
        { title: "Percepat respon pada SKU kritis", detail: `${metrics.lowStockItems} item low stock perlu prioritas replenishment dan sinkronisasi dengan demand penjualan.`, href: "/dashboard/reports/inventory" },
        { title: "Jaga backlog agar tidak menggerus service level", detail: `${metrics.pendingDeliveries} delivery pending memberi sinyal tekanan throughput distribusi.`, href: "/dashboard/reports/orders" },
        { title: "Naikkan kualitas pipeline komersial", detail: `${metrics.pendingQuotations} quotation masih pending, area bagus untuk automasi dan SLA approval.`, href: "/dashboard/reports/approvals" },
    ]

    return (
        <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-6 py-4 md:py-6">
                <div className="px-4 lg:px-6">
                    <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_24%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] p-6 shadow-sm lg:p-8">
                        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
                            <div className="space-y-5">
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">Executive Report Hub</Badge>
                                    <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">Distributor Digital Transformation</Badge>
                                </div>
                                <div className="space-y-3">
                                    <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                                        Pusat insight untuk membaca performa distribusi, risiko operasional, dan peluang transformasi digital secara lebih tajam.
                                    </h1>
                                    <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                                        Hub ini sekarang bertindak sebagai command center manajemen. Fokusnya bukan hanya angka, tetapi kualitas momentum bisnis, tekanan operasional, dan kesiapan perusahaan untuk naik ke analitik yang lebih prediktif.
                                    </p>
                                </div>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <Card className="border-white/70 bg-white/90 shadow-sm"><CardContent className="flex items-start gap-3 p-4"><div className="rounded-2xl bg-sky-100 p-2.5"><BrainCircuit className="h-5 w-5 text-sky-700" /></div><div><p className="text-sm font-semibold text-slate-900">AI-ready narrative</p><p className="mt-1 text-xs leading-5 text-slate-600">Insight dibingkai untuk mendukung keputusan manajemen dan prioritas intervensi.</p></div></CardContent></Card>
                                    <Card className="border-white/70 bg-white/90 shadow-sm"><CardContent className="flex items-start gap-3 p-4"><div className="rounded-2xl bg-emerald-100 p-2.5"><Target className="h-5 w-5 text-emerald-700" /></div><div><p className="text-sm font-semibold text-slate-900">Configurable scoring</p><p className="mt-1 text-xs leading-5 text-slate-600">Bobot skor bisa disesuaikan menurut prioritas revenue, service, inventory, dan commercial.</p></div></CardContent></Card>
                                    <Card className="border-white/70 bg-white/90 shadow-sm"><CardContent className="flex items-start gap-3 p-4"><div className="rounded-2xl bg-amber-100 p-2.5"><CircleAlert className="h-5 w-5 text-amber-700" /></div><div><p className="text-sm font-semibold text-slate-900">Early warning</p><p className="mt-1 text-xs leading-5 text-slate-600">Sinyal risiko ditampilkan lebih awal agar koreksi operasional lebih cepat.</p></div></CardContent></Card>
                                </div>
                            </div>

                            <Card className="border-slate-200/80 bg-white/95 shadow-sm">
                                <CardHeader>
                                    <CardDescription className="text-slate-600">AI Transformation Score</CardDescription>
                                    <CardTitle className="text-5xl font-semibold tracking-tight text-slate-950">{transformationScore}</CardTitle>
                                    <p className="text-sm leading-6 text-slate-600">
                                        Skor komposit yang dibentuk dari empat mesin utama distribusi: revenue quality, inventory discipline, service execution, dan commercial effectiveness.
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3"><p className="text-xs text-sky-700">Revenue</p><p className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(metrics.revenueScore)}</p></div>
                                        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3"><p className="text-xs text-amber-700">Inventory</p><p className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(metrics.inventoryScore)}</p></div>
                                        <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-3"><p className="text-xs text-cyan-700">Service</p><p className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(metrics.serviceScore)}</p></div>
                                        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3"><p className="text-xs text-violet-700">Commercial</p><p className="mt-2 text-2xl font-semibold text-slate-950">{Math.round(metrics.commercialScore)}</p></div>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Management reading</p>
                                        <p className="mt-2 text-sm leading-6 text-slate-700">
                                            {transformationScore >= 75 ? "Perusahaan sudah punya fondasi yang cukup kuat untuk masuk ke use case AI yang lebih prediktif dan preskriptif." : transformationScore >= 55 ? "Kondisi transformasi sudah bergerak positif, tetapi masih membutuhkan penguatan pada bottleneck prioritas." : "Fokus transformasi sebaiknya dimulai dari visibility proses, penurunan backlog, dan disiplin data operasional."}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </section>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
                    <Card><CardHeader className="pb-2"><CardDescription>Revenue period overview</CardDescription><CardTitle className="text-3xl">{formatCurrency(metrics.totalRevenue)}</CardTitle></CardHeader><CardContent><div className="flex items-center gap-2 text-sm"><Badge variant={metrics.salesMomentum >= 0 ? "success" : "warning"} className="rounded-full">{metrics.salesMomentum >= 0 ? `+${formatPercentage(metrics.salesMomentum)}` : formatPercentage(metrics.salesMomentum)}</Badge><span className="text-slate-600">vs bulan sebelumnya</span></div></CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardDescription>Customer base</CardDescription><CardTitle className="text-3xl">{formatNumber(metrics.totalCustomers)}</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-700">{formatNumber(metrics.totalSalesOrders)} sales order aktif pada periode ini.</p></CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardDescription>Inventory risk</CardDescription><CardTitle className="text-3xl">{formatPercentage(metrics.stockRisk)}</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-700">{metrics.lowStockItems} item berada di bawah batas minimum.</p></CardContent></Card>
                    <Card><CardHeader className="pb-2"><CardDescription>Commercial conversion</CardDescription><CardTitle className="text-3xl">{formatPercentage(metrics.approvalRate)}</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-700">{metrics.pendingQuotations} quotation masih tertahan dalam pipeline.</p></CardContent></Card>
                </div>

                <div className="px-4 lg:px-6">
                    <Tabs defaultValue="overview" className="gap-4">
                        <TabsList className="bg-slate-100">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="scoring">AI Score Studio</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overview">
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                                <Card className="border-slate-200/80 bg-white">
                                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <CardTitle className="text-xl">Interactive business signal overview</CardTitle>
                                            <CardDescription>Trend, baseline, dan konsentrasi kategori untuk membaca arah bisnis secara cepat.</CardDescription>
                                        </div>
                                        <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Recharts interactive</Badge>
                                    </CardHeader>
                                    <CardContent className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                                        <div className="space-y-4">
                                            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                                                <div className="mb-3 flex items-center justify-between">
                                                    <div><p className="text-sm text-slate-500">Sales trajectory</p><p className="mt-1 text-2xl font-semibold text-slate-950">{formatCurrency(metrics.latestSales)}</p></div>
                                                    <TrendingUp className="h-5 w-5 text-sky-600" />
                                                </div>
                                                <div className="h-[260px]">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                            <defs>
                                                                <linearGradient id="hubSalesFill" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                                                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid stroke="#e2e8f0" vertical={false} />
                                                            <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                                                            <YAxis tickFormatter={(value) => formatNumber(value)} tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                                                            <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name === "sales" ? "Revenue" : "Baseline"]} contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16 }} />
                                                            <Legend />
                                                            <Area type="monotone" dataKey="sales" name="Revenue" stroke="#0ea5e9" fill="url(#hubSalesFill)" strokeWidth={3} />
                                                            <Area type="monotone" dataKey="baseline" name="Baseline" stroke="#10b981" fillOpacity={0} strokeDasharray="6 4" strokeWidth={2} />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-3">
                                                {prioritySignals.map((signal) => (
                                                    <div key={signal.title} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                                                        <p className="text-sm font-semibold text-slate-900">{signal.title}</p>
                                                        <p className="mt-3 text-2xl font-semibold text-slate-950">{signal.display}</p>
                                                        <p className="mt-2 text-xs leading-5 text-slate-600">{signal.note}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Portfolio concentration</p>
                                                <p className="mt-2 text-3xl font-semibold text-slate-950">{formatPercentage(metrics.topCategoryShare)}</p>
                                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                                    {metrics.topCategoryName ? `${metrics.topCategoryName} menjadi kategori dominan. Ini membantu fokus komersial, namun tetap perlu dijaga agar risiko konsentrasi tidak terlalu tinggi.` : "Belum ada data kategori yang cukup untuk membaca konsentrasi portofolio."}
                                                </p>
                                                <div className="mt-4 h-[220px]">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={categoryData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                                            <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                                                            <XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={false} />
                                                            <YAxis type="category" dataKey="category" tick={{ fill: "#475569", fontSize: 12 }} tickLine={false} axisLine={false} width={90} />
                                                            <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16 }} />
                                                            <Bar dataKey="count" radius={[0, 10, 10, 0]}>
                                                                {categoryData.map((_, index) => (
                                                                    <Cell key={index} fill={["#38bdf8", "#34d399", "#f59e0b", "#a78bfa", "#fb7185", "#22c55e"][index % 6]} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-200/80 bg-white">
                                    <CardHeader>
                                        <CardTitle className="text-xl">Management priorities</CardTitle>
                                        <CardDescription>Tiga fokus yang paling layak mendapat aksi cepat dan dukungan digitalisasi.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {focusAreas.map((area) => (
                                            <Link key={area.title} href={area.href} className="block rounded-[22px] border border-slate-200 bg-slate-50 p-4 transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm">
                                                <p className="font-semibold text-slate-900">{area.title}</p>
                                                <p className="mt-2 text-sm leading-6 text-slate-600">{area.detail}</p>
                                            </Link>
                                        ))}
                                        <div className="rounded-[22px] border border-dashed border-sky-200 bg-sky-50 p-4">
                                            <p className="text-sm font-semibold text-sky-900">Arah next-level AI / ML</p>
                                            <p className="mt-2 text-sm leading-6 text-sky-800">Demand forecasting, stockout prediction, churn signal pelanggan, dan anomaly detection untuk bottleneck service adalah evolusi logis berikutnya.</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                        <TabsContent value="scoring">
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                                <Card className="border-slate-200/80 bg-white">
                                    <CardHeader>
                                        <CardTitle>AI Score Weight Studio</CardTitle>
                                        <CardDescription>Atur bobot penilaian agar selaras dengan agenda manajemen saat ini.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-5">
                                        {[
                                            { key: "revenue", label: "Revenue quality", color: "bg-sky-500" },
                                            { key: "inventory", label: "Inventory discipline", color: "bg-amber-500" },
                                            { key: "service", label: "Service execution", color: "bg-cyan-500" },
                                            { key: "commercial", label: "Commercial effectiveness", color: "bg-violet-500" },
                                        ].map((item) => (
                                            <div key={item.key} className="space-y-2">
                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${item.color}`} /><span className="text-slate-700">{item.label}</span></div>
                                                    <span className="font-semibold text-slate-950">{weights[item.key as keyof typeof weights]}</span>
                                                </div>
                                                <Slider
                                                    value={[weights[item.key as keyof typeof weights]]}
                                                    min={5}
                                                    max={60}
                                                    step={1}
                                                    onValueChange={(value) => setWeights((prev) => ({ ...prev, [item.key]: value[0] ?? prev[item.key as keyof typeof weights] }))}
                                                />
                                            </div>
                                        ))}
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-sm font-semibold text-slate-900">Normalized score</p>
                                            <p className="mt-2 text-4xl font-semibold text-slate-950">{transformationScore}</p>
                                            <p className="mt-2 text-sm leading-6 text-slate-600">Skor menyesuaikan secara dinamis berdasarkan bobot yang kamu anggap paling strategis untuk perusahaan saat ini.</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-200/80 bg-white">
                                    <CardHeader>
                                        <CardTitle>Score credibility view</CardTitle>
                                        <CardDescription>Radar ini membantu menjelaskan mengapa skor total bergerak ke atas atau ke bawah.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                                        <div className="h-[320px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RadarChart data={radarData}>
                                                    <PolarGrid stroke="#dbeafe" />
                                                    <PolarAngleAxis dataKey="metric" tick={{ fill: "#475569", fontSize: 12 }} />
                                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                                                    <Radar dataKey="score" stroke="#2563eb" fill="#60a5fa" fillOpacity={0.35} />
                                                    <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16 }} />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="space-y-3">
                                            {radarData.map((item) => (
                                                <div key={item.metric} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <p className="font-semibold text-slate-900">{item.metric}</p>
                                                        <p className="text-lg font-semibold text-slate-950">{item.score}</p>
                                                    </div>
                                                    <div className="h-2 overflow-hidden rounded-full bg-white">
                                                        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500" style={{ width: `${item.score}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="px-4 lg:px-6">
                    <div className="mb-4">
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Strategic report lanes</h2>
                        <p className="text-sm leading-6 text-slate-600">Setiap report diposisikan sebagai jalur keputusan untuk manajemen, operasional, dan agenda transformasi digital.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {reportCards.map((report) => {
                            const Icon = report.icon
                            return (
                                <Link key={report.title} href={report.href} className="group block h-full">
                                    <Card className={`h-full border bg-gradient-to-br ${report.color} transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}>
                                        <CardHeader className="space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="rounded-[22px] bg-white/90 p-3 shadow-sm"><Icon className={`h-6 w-6 ${report.iconColor}`} /></div>
                                                <Badge variant={report.priority === "Immediate" ? "destructive" : report.priority === "Strategic" ? "success" : "outline"} className="rounded-full">{report.priority}</Badge>
                                            </div>
                                            <div className="space-y-2">
                                                <CardTitle className="text-xl text-slate-950">{report.title}</CardTitle>
                                                <CardDescription className="text-sm leading-6 text-slate-600">{report.description}</CardDescription>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="rounded-[20px] border border-white/80 bg-white/80 p-4">
                                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Management focus</p>
                                                <p className="mt-2 text-sm leading-6 text-slate-800">{report.focus}</p>
                                            </div>
                                            <div className={`flex items-center gap-2 text-sm font-semibold ${report.iconColor}`}>Open report lane<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
                    <Card className="border-slate-200/80 bg-white">
                        <CardHeader><CardTitle>Recent business activity</CardTitle><CardDescription>Snapshot transaksi terbaru untuk membaca ritme demand aktual.</CardDescription></CardHeader>
                        <CardContent>
                            {recentOrders.length === 0 ? (
                                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Belum ada order terbaru pada periode ini.</div>
                            ) : (
                                <div className="space-y-3">
                                    {recentOrders.map((order) => (
                                        <div key={order.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div><p className="font-semibold text-slate-900">{order.invoiceNumber || `Sales Order #${order.id}`}</p><p className="mt-1 text-sm text-slate-600">{order.customerName}</p></div>
                                                <div className="text-left sm:text-right"><p className="font-semibold text-slate-950">{formatCurrency(order.totalValue)}</p><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(order.salesDate))}</p></div>
                                            </div>
                                            <div className="mt-3"><Badge variant="outline" className="rounded-full bg-white text-slate-700">{order.status}</Badge></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200/80 bg-white">
                        <CardHeader><CardTitle>Critical stock watchlist</CardTitle><CardDescription>Item yang paling berpotensi mengganggu distribusi dan service reliability.</CardDescription></CardHeader>
                        <CardContent>
                            {stockAlerts.length === 0 ? (
                                <div className="rounded-[22px] border border-dashed border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">Tidak ada alert stok kritis pada periode ini. Kondisi ini bagus untuk menjaga service level tetap stabil.</div>
                            ) : (
                                <div className="space-y-3">
                                    {stockAlerts.slice(0, 5).map((item) => {
                                        const ratio = item.minStock > 0 ? item.currentStock / item.minStock : 0
                                        return (
                                            <div key={`${item.materialNumber}-${item.warehouseName}`} className="rounded-[20px] border border-rose-100 bg-rose-50 p-4">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div><p className="font-semibold text-slate-900">{item.productName}</p><p className="mt-1 text-xs text-slate-600">{item.materialNumber} • {item.warehouseName}</p></div>
                                                    <Badge variant={ratio <= 0.5 ? "destructive" : "warning"} className="w-fit rounded-full">{ratio === 0 ? "Out of stock" : ratio <= 0.5 ? "Critical" : "Low stock"}</Badge>
                                                </div>
                                                <div className="mt-4"><div className="mb-1 flex items-center justify-between text-xs text-slate-600"><span>Current {formatNumber(item.currentStock)}</span><span>Min {formatNumber(item.minStock)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${ratio <= 0.5 ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${clamp(ratio * 100)}%` }} /></div></div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
