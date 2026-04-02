"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from "recharts"
import {
    TrendingUp,
    Package,
    ShoppingCart,
    Percent,
    Search,
    Filter,
    FileText,
    History,
    ChevronRight,
    Sparkles,
    AlertCircle,
    ChevronDown
} from "lucide-react"
import { ScoreCard } from "@/components/score-card"
import Link from "next/link"
import { ResponsiveTableWrapper } from "@/components/ui/responsive-table-wrapper"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface QuotationAnalysisClientProps {
    initialData: QuotationAnalysisData | null
}

type QuoteItem = {
    productId: number | null
    quantity: number
    product: {
        id: number
        materialNumber: string
        materialDescription: string | null
        category: string | null
    } | null
}

type QuoteSummaryItem = {
    id: number
    quotationDate: Date | string
    status: string
    salesName: string
    items: QuoteItem[]
}

type LostRecommendation = {
    id: number
    materialNumber: string
    materialDescription: string | null
    brand: string | null
    category: string | null
}

type LostAnalysisItem = {
    quotationNumber: string | null
    quotationId: number
    customerName: string
    salesName: string
    productName: string
    productId: number
    category: string | null
    quantity: number
    unitPrice: string | number | null
    status: string
    date: Date | string
    recommendations: LostRecommendation[]
}

type TopItem = {
    productId: number
    name: string
    count: number
}

type MonthlyTrendItem = {
    month: string
    sent: number
    approved: number
    rate: number
}

export type QuotationAnalysisData = {
    currentUserName?: string | null
    allQuotes?: QuoteSummaryItem[]
    summary?: {
        totalQuotes: number
        totalSent: number
        totalConverted: number
        conversionRate: number
    }
    topItems?: TopItem[]
    lostAnalysis?: LostAnalysisItem[]
    monthlyTrend?: MonthlyTrendItem[]
}

export function QuotationAnalysisClient({ initialData }: QuotationAnalysisClientProps) {
    const [data] = useState(initialData)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedSalesNames, setSelectedSalesNames] = useState<string[]>(() => {
        const currentUserName = initialData?.currentUserName
        return currentUserName ? [currentUserName] : []
    })

    const salesNameOptions = useMemo<string[]>(() => {
        const salesNames: string[] = []

        for (const quote of data?.allQuotes ?? []) {
            if (typeof quote.salesName === "string" && quote.salesName.length > 0) {
                salesNames.push(quote.salesName)
            }
        }

        return Array.from(new Set<string>(salesNames)).sort((a, b) => a.localeCompare(b))
    }, [data])

    const effectiveSalesNames = useMemo(
        () => (selectedSalesNames.length > 0 ? selectedSalesNames : salesNameOptions),
        [selectedSalesNames, salesNameOptions]
    )

    const filteredQuotes = useMemo(
        () => (data?.allQuotes ?? []).filter((quote) => effectiveSalesNames.includes(quote.salesName)),
        [data, effectiveSalesNames]
    )

    const derivedSummary = useMemo(() => {
        const totalSent = filteredQuotes.filter((quote) => quote.status !== "draft").length
        const totalConverted = filteredQuotes.filter((quote) => quote.status === "approved" || quote.status === "converted").length
        const conversionRate = totalSent > 0 ? (totalConverted / totalSent) * 100 : 0

        return {
            totalQuotes: filteredQuotes.length,
            totalSent,
            totalConverted,
            conversionRate,
        }
    }, [filteredQuotes])

    const derivedTopItems = useMemo(() => {
        const itemFrequency: Record<number, { productId: number, name: string, count: number }> = {}
        filteredQuotes.forEach((quote) => {
            quote.items.forEach((item) => {
                if (!item.productId || !item.product) return
                if (!itemFrequency[item.productId]) {
                    itemFrequency[item.productId] = {
                        productId: item.productId,
                        name: item.product.materialDescription || item.product.materialNumber,
                        count: 0,
                    }
                }
                itemFrequency[item.productId].count += 1
            })
        })

        return Object.values(itemFrequency)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
    }, [filteredQuotes])

    const derivedMonthlyTrend = useMemo(() => {
        const monthlyTrend: Record<string, { month: string, sent: number, approved: number, rate: number }> = {}
        const now = new Date()

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const key = `${d.getFullYear()}-${d.getMonth() + 1}`
            monthlyTrend[key] = {
                month: d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
                sent: 0,
                approved: 0,
                rate: 0,
            }
        }

        filteredQuotes.forEach((quote) => {
            const d = new Date(quote.quotationDate)
            const key = `${d.getFullYear()}-${d.getMonth() + 1}`
            if (!monthlyTrend[key]) return
            if (quote.status !== "draft") {
                monthlyTrend[key].sent += 1
                if (quote.status === "approved" || quote.status === "converted") {
                    monthlyTrend[key].approved += 1
                }
            }
        })

        Object.values(monthlyTrend).forEach((month) => {
            month.rate = month.sent > 0 ? (month.approved / month.sent) * 100 : 0
        })

        return Object.values(monthlyTrend)
    }, [filteredQuotes])

    const filteredLostAnalysis = useMemo(() => {
        if (!data?.lostAnalysis) return []
        return data.lostAnalysis.filter((item) =>
            effectiveSalesNames.includes(item.salesName) &&
            (
                item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.quotationNumber ?? "").toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
    }, [data, searchQuery, effectiveSalesNames])

    const filteredLostCount = useMemo(
        () => (data?.lostAnalysis ?? []).filter((item) => effectiveSalesNames.includes(item.salesName)).length,
        [data, effectiveSalesNames]
    )

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border rounded-xl bg-card gap-4">
                <AlertCircle className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground font-medium">Gagal memuat data analisis.</p>
                <Button variant="outline" onClick={() => window.location.reload()}>Coba Lagi</Button>
            </div>
        )
    }

    const summary = derivedSummary
    const topItems = derivedTopItems
    const monthlyTrend = derivedMonthlyTrend

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Quotation Analysis Report
                </h1>
                <p className="text-muted-foreground">
                    Analisis konversi penjualan dan rekomendasi barang sejenis untuk peluang yang hilang.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                        <Filter className="h-3.5 w-3.5" />
                        Salesname Filter
                    </Badge>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Filter className="h-4 w-4" />
                                {selectedSalesNames.length > 0 ? `${selectedSalesNames.length} sales dipilih` : "Semua sales"}
                                <ChevronDown className="h-4 w-4 opacity-70" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64">
                            {salesNameOptions.map((salesName) => (
                                <DropdownMenuCheckboxItem
                                    key={salesName}
                                    checked={effectiveSalesNames.includes(salesName)}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedSalesNames((prev) => Array.from(new Set([...prev, salesName])))
                                            return
                                        }
                                        setSelectedSalesNames((prev) => prev.filter((name) => name !== salesName))
                                    }}
                                >
                                    {salesName}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedSalesNames(salesNameOptions)}>
                        Pilih Semua
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ScoreCard
                    title="Total Quotations"
                    value={summary.totalQuotes}
                    icon={FileText}
                    description="Total penawaran dibuat"
                    gradient="from-blue-500/10 via-blue-400/5 to-indigo-500/10 border-blue-200/50"
                />
                <ScoreCard
                    title="Conversion Rate"
                    value={`${summary.conversionRate.toFixed(1)}%`}
                    icon={Percent}
                    description={`${summary.totalConverted} kuotasi disetujui`}
                    gradient={summary.conversionRate > 20 ? "from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50" : "from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50"}
                />
                <ScoreCard
                    title="Potential Opportunities"
                    value={filteredLostCount}
                    icon={Package}
                    description="Item dari kuotasi lost"
                    gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50"
                />
                <ScoreCard
                    title="Winning Items"
                    value={topItems[0]?.count || 0}
                    icon={ShoppingCart}
                    description={`Top: ${topItems[0]?.name.slice(0, 20)}...`}
                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50"
                />
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Conversion Trend */}
                <Card className="overflow-hidden border-none shadow-premium bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            Conversion Trend
                        </CardTitle>
                        <CardDescription>Persentase kuotasi yang disetujui vs dikirim (6 bulan terakhir)</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="h-[300px] w-100%">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyTrend}>
                                    <defs>
                                        <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                                        axisLine={false}
                                        tickFormatter={(val) => `${val}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "8px",
                                            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                                        }}
                                        formatter={(value: number | string) => [`${parseFloat(String(value)).toFixed(1)}%`, 'Conversion Rate']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="rate"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorRate)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Top Quoted Items */}
                <Card className="overflow-hidden border-none shadow-premium bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-amber-500" />
                            Most Quoted Products
                        </CardTitle>
                        <CardDescription>10 barang yang paling sering masuk dalam kuotasi</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="h-[300px] w-100%">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topItems} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        width={120}
                                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                        tickFormatter={(val) => val.length > 20 ? `${val.slice(0, 17)}...` : val}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "8px"
                                        }}
                                    />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                        {topItems.map((entry, index: number) => (
                                            <Cell key={`cell-${index}`} fill={index < 3 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Lost Opportunity Table */}
            <Card className="border-none shadow-premium bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-destructive" />
                            Lost Opportunity Recovery
                        </CardTitle>
                        <CardDescription>Peluang dari kuotasi lost yang bisa dipulihkan dengan barang sejenis</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari pelanggan atau produk..."
                                className="pl-9 bg-background/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ResponsiveTableWrapper
                        className="rounded-none"
                        mobileView={
                            filteredLostAnalysis.length === 0 ? (
                                <div className="text-sm text-muted-foreground text-center py-6">Tidak ada data yang ditemukan.</div>
                            ) : (
                                <div className="space-y-3 p-3">
                                    {filteredLostAnalysis.map((item, idx: number) => (
                                        <div key={`${item.quotationId}-${idx}`} className="rounded-md border p-3 bg-card">
                                            <div className="flex items-start justify-between">
                                                <div className="text-sm">
                                                    <div className="font-semibold">{item.customerName}</div>
                                                    <Link href={`/dashboard/quotations/${item.quotationId}`} className="text-xs font-mono text-muted-foreground">
                                                        {item.quotationNumber || `Quotation #${item.quotationId}`}
                                                    </Link>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] uppercase">{item.status}</Badge>
                                            </div>
                                            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                                                <div>
                                                    <div className="text-muted-foreground">Lost Product</div>
                                                    <div className="font-medium">{item.productName}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-muted-foreground">Qty</div>
                                                    <div className="font-mono">{item.quantity}</div>
                                                </div>
                                            </div>
                                            <div className="mt-2">
                                                {item.recommendations.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.recommendations.slice(0, 2).map((rec) => (
                                                            <div key={rec.id} className="px-2 py-1 rounded border text-[10px]">
                                                                {rec.materialDescription}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Tidak ada rekomendasi stok serupa.</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        }
                    >
                    <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="pl-6 w-[20%]">Customer & Quotation</TableHead>
                                <TableHead className="w-[25%]">Lost Product</TableHead>
                                <TableHead className="w-[10%] text-center">Qty</TableHead>
                                <TableHead className="w-[45%] pr-6">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500/20" />
                                        <span>Recommended Alternatives (Smart Match)</span>
                                    </div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLostAnalysis.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                        Tidak ada data yang ditemukan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLostAnalysis.map((item, idx: number) => (
                                    <TableRow key={`${item.quotationId}-${idx}`} className="group hover:bg-muted/30 transition-colors">
                                        <TableCell className="pl-6 align-top py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-semibold text-sm group-hover:text-primary transition-colors">{item.customerName}</span>
                                                <Link
                                                    href={`/dashboard/quotations/${item.quotationId}`}
                                                    className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                                                >
                                                    {item.quotationNumber || `Quotation #${item.quotationId}`}
                                                    <ChevronRight className="h-3 w-3" />
                                                </Link>
                                                <Badge variant="outline" className="w-fit text-[10px] mt-1 uppercase">
                                                    {item.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="align-top py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-medium leading-tight">{item.productName}</span>
                                                <span className="text-xs text-muted-foreground uppercase">{item.category}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center align-top py-4">
                                            <span className="text-sm font-mono">{item.quantity}</span>
                                        </TableCell>
                                        <TableCell className="pr-6 align-top py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {item.recommendations.length > 0 ? (
                                                    item.recommendations.map((rec) => (
                                                        <div
                                                            key={rec.id}
                                                            className="flex flex-col gap-1 p-2 rounded-lg border bg-background/30 hover:bg-background/80 hover:border-primary/50 transition-all w-[calc(50%-8px)]"
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <span className="text-[11px] font-semibold line-clamp-2 leading-tight">
                                                                    {rec.materialDescription}
                                                                </span>
                                                                <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[9px] px-1 h-4">
                                                                    Match
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-auto pt-1 border-t border-dashed border-muted-foreground/20">
                                                                <span className="font-mono">{rec.materialNumber}</span>
                                                                {rec.brand && (
                                                                    <span className="italic font-medium text-primary/80">{rec.brand}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Tidak ada rekomendasi stok serupa.</span>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    </div>
                    </ResponsiveTableWrapper>
                </CardContent>
            </Card>
        </div>
    )
}
