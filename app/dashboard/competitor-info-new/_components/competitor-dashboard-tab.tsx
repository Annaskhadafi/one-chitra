"use client"

import { useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import { format } from "date-fns"
import { AlertTriangle, BarChart3, CalendarDays, Database, DollarSign, Download, RefreshCw, Search, Target, TrendingDown, Users, Zap } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScoreCard } from "@/components/score-card"

const PUBLISHED_BASE = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk"
const SHEETS = {
    lostSales: { gid: "1550828239", name: "Lost Sale" },
    prices: { gid: "1444121083", name: "Competitor Price" },
    activities: { gid: "98214477", name: "Competitor Activity" },
} as const
const COLORS = ["#2563eb", "#f97316", "#16a34a", "#9333ea", "#dc2626", "#0891b2", "#ca8a04"]

type SheetRow = Record<string, string | undefined>

type CompetitorPriceRecord = {
    id: string
    date: Date | null
    consultant: string
    customer: string
    size: string
    brand: string
    category: string
    supplier: string
    currency: string
    price: number
    status: string
    deliveryPoint: string
}

type CompetitorActivityRecord = {
    id: string
    date: Date | null
    consultant: string
    competitor: string
    industry: string
    location: string
    activityType: string
    customer: string
    marketResponse: string
    businessImpact: string
    strategy: string
    description: string
}

type LostSaleRecord = {
    id: string
    date: Date | null
    consultant: string
    productType: string
    customer: string
    productDetail: string
    reason: string
    remark: string
    actionPlan: string
}

type DashboardData = {
    prices: CompetitorPriceRecord[]
    activities: CompetitorActivityRecord[]
    lostSales: LostSaleRecord[]
}

type DashboardScope = "all" | "prices" | "activities" | "lostSales"

function cleanText(value?: string) {
    return (value ?? "").replace(/\s*\+\d+\s*$/g, "").replace(/\s+/g, " ").trim()
}

function getField(row: SheetRow, names: string[]) {
    const entries = Object.entries(row)
    for (const name of names) {
        const exact = row[name]
        if (exact !== undefined) return cleanText(exact)
        const normalizedName = name.toLowerCase().replace(/\s+/g, " ").trim()
        const found = entries.find(([key]) => key.toLowerCase().replace(/\s+/g, " ").trim().includes(normalizedName))
        if (found) return cleanText(found[1])
    }
    return ""
}

function parseDateValue(value?: string) {
    const text = cleanText(value)
    if (!text) return null
    const datePart = text.split(" ")[0]
    const slashParts = datePart.split("/")
    if (slashParts.length === 3) {
        const [day, month, year] = slashParts
        const parsed = new Date(Number(year), Number(month) - 1, Number(day))
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseMoney(value?: string) {
    const normalized = cleanText(value).replace(/IDR/gi, "").replace(/[^\d.,-]/g, "")
    if (!normalized) return 0
    const dotCount = (normalized.match(/\./g) ?? []).length
    const commaCount = (normalized.match(/,/g) ?? []).length
    if (dotCount > 1 && commaCount === 0) {
        const parsed = Number(normalized.replaceAll(".", ""))
        return Number.isFinite(parsed) ? parsed : 0
    }
    if (commaCount > 1 && dotCount === 0) {
        const parsed = Number(normalized.replaceAll(",", ""))
        return Number.isFinite(parsed) ? parsed : 0
    }
    const lastComma = normalized.lastIndexOf(",")
    const lastDot = normalized.lastIndexOf(".")
    const decimalSep = lastComma > lastDot ? "," : "."
    const thousandsSep = decimalSep === "," ? "." : ","
    const canonical = normalized.replaceAll(thousandsSep, "").replace(decimalSep, ".")
    const parsed = Number(canonical)
    return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
    if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
    if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
    if (value >= 1_000) return `Rp ${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`
    return `Rp ${value.toLocaleString("id-ID")}`
}

function formatDate(value: Date | null) {
    return value ? format(value, "dd MMM yyyy") : "-"
}

function csvUrl(gid: string) {
    return `${PUBLISHED_BASE}/pub?output=csv&gid=${gid}`
}

async function fetchSheet(gid: string) {
    const response = await fetch(csvUrl(gid), { cache: "no-store" })
    if (!response.ok) throw new Error(`Gagal memuat sheet ${gid}`)
    const text = await response.text()
    return Papa.parse<SheetRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
    }).data
}

function normalizeBrand(raw: string) {
    const cleaned = cleanText(raw).toUpperCase();
    if (cleaned.includes("GOOD") && cleaned.includes("YEAR")) return "Goodyear";
    if (cleaned.includes("MICHELIN")) return "Michelin";
    if (cleaned.includes("BRIDGESTONE")) return "Bridgestone";
    if (cleaned.includes("YOKOHAMA")) return "Yokohama";
    if (cleaned.includes("MAXAM")) return "Maxam";
    if (cleaned.includes("BKT")) return "BKT";
    if (cleaned.includes("ADVANCE")) return "Advance";
    if (cleaned.includes("TRIANGLE")) return "Triangle";
    if (cleaned.includes("AEOLUS")) return "Aeolus";
    if (cleaned.includes("SAILUN")) return "Sailun";
    if (cleaned.includes("LINGLONG")) return "Linglong";
    if (cleaned.includes("TECHKING")) return "Techking";
    if (cleaned.includes("MAGNA")) return "Magna";
    if (cleaned.includes("GALAXY")) return "Galaxy";
    if (cleaned.includes("TRELLEBORG")) return "Trelleborg";
    if (cleaned.includes("AMBERSTONE")) return "Amberstone";
    if (cleaned.includes("HENAN")) return "Henan";
    if (!raw) return "Unknown";
    return raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function parsePrice(row: SheetRow, index: number): CompetitorPriceRecord | null {
    const customer = getField(row, ["Nama Customer"])
    const size = getField(row, ["Size Tire"])
    const brand = getField(row, ["Brand"])
    if (!customer || !size || !brand) return null
    return {
        id: `price-${index}`,
        date: parseDateValue(getField(row, ["Tanggal Informasi"])),
        consultant: getField(row, ["Business Consultant"]),
        customer,
        size,
        brand: normalizeBrand(brand),
        category: getField(row, ["Category Tire"]),
        supplier: getField(row, ["Supplier"]),
        currency: getField(row, ["Currency"]) || "IDR",
        price: parseMoney(getField(row, ["PRICE", "Price"])),
        status: "",
        deliveryPoint: getField(row, ["Remark / Delivery Drop Point"]),
    }
}

function parseActivity(row: SheetRow, index: number): CompetitorActivityRecord | null {
    const competitor = getField(row, ["Competitor"])
    const activityType = getField(row, ["Jenis Aktivitas"])
    if (!competitor || !activityType) return null
    return {
        id: `activity-${index}`,
        date: parseDateValue(getField(row, ["Tanggal Informasi"])),
        consultant: getField(row, ["Business Consultant"]),
        competitor,
        industry: getField(row, ["Industri / Kategori"]),
        location: getField(row, ["Lokasi"]),
        activityType,
        customer: getField(row, ["Customer"]),
        marketResponse: getField(row, ["Respon Pasar"]),
        businessImpact: getField(row, ["Perkiraan Pengaruh ke Bisnis"]),
        strategy: getField(row, ["Strategi yang bisa di terapkan", "Strategi"]),
        description: getField(row, ["Deskripsi Competitor Activity"]),
    }
}

function parseLostSale(row: SheetRow, index: number): LostSaleRecord | null {
    const customer = getField(row, ["Customer"])
    const productDetail = getField(row, ["Detail Produk"])
    if (!customer || !productDetail) return null
    return {
        id: `lost-${index}`,
        date: parseDateValue(getField(row, ["Tanggal Penawaran"])),
        consultant: getField(row, ["Business Consultant"]),
        productType: getField(row, ["Tipe Produk"]),
        customer,
        productDetail,
        reason: getField(row, ["Penyebab Lost Sale"]) || "OTHER",
        remark: getField(row, ["Remark"]),
        actionPlan: getField(row, ["Action Plan"]),
    }
}

function aggregate(records: string[], limit = 8) {
    const counts = records.reduce<Record<string, number>>((acc, item) => {
        const key = cleanText(item) || "Unknown"
        acc[key] = (acc[key] ?? 0) + 1
        return acc
    }, {})
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit)
}

function aggregateMoney(records: { name: string; value: number }[], limit = 8) {
    const totals = records.reduce<Record<string, number>>((acc, item) => {
        const key = cleanText(item.name) || "Unknown"
        acc[key] = (acc[key] ?? 0) + item.value
        return acc
    }, {})
    return Object.entries(totals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit)
}

function sizeSegment(size: string, price: number) {
    if (size.includes("27.00R49") || price >= 140_000_000) return "Extra Large"
    if (size.includes("24.00R35") || size.includes("33.25R29") || price >= 60_000_000) return "Large"
    if (price >= 30_000_000) return "Medium"
    return "Small"
}

function inDateRange(date: Date | null, startDate: string, endDate: string) {
    if (!startDate && !endDate) return true
    if (!date) return false
    if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        if (date < start) return false
    }
    if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        if (date > end) return false
    }
    return true
}

export function CompetitorDashboardTab({ scope = "all" }: { scope?: DashboardScope }) {
    const [rawData, setRawData] = useState<DashboardData>({ prices: [], activities: [], lostSales: [] })
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")
    const [search, setSearch] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [reasonFilter, setReasonFilter] = useState("all")
    const [segmentFilter, setSegmentFilter] = useState("all")
    const [impactFilter, setImpactFilter] = useState("all")

    const loadSheet = async () => {
        setIsLoading(true)
        setError("")
        try {
            const [lostRows, priceRows, activityRows] = await Promise.all([
                scope === "all" || scope === "lostSales" ? fetchSheet(SHEETS.lostSales.gid) : Promise.resolve([]),
                scope === "all" || scope === "prices" ? fetchSheet(SHEETS.prices.gid) : Promise.resolve([]),
                scope === "all" || scope === "activities" ? fetchSheet(SHEETS.activities.gid) : Promise.resolve([]),
            ])
            setRawData({
                prices: priceRows.map(parsePrice).filter(Boolean) as CompetitorPriceRecord[],
                activities: activityRows.map(parseActivity).filter(Boolean) as CompetitorActivityRecord[],
                lostSales: lostRows.map(parseLostSale).filter(Boolean) as LostSaleRecord[],
            })
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Gagal memuat data")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadSheet()
    }, [])

    const filtered = useMemo(() => {
        const query = search.toLowerCase()
        const prices = rawData.prices.filter((item) => {
            const segment = sizeSegment(item.size, item.price)
            return [item.customer, item.brand, item.size, item.supplier, item.consultant].join(" ").toLowerCase().includes(query)
                && (segmentFilter === "all" || segment === segmentFilter)
                && inDateRange(item.date, startDate, endDate)
        })
        const activities = rawData.activities.filter((item) => {
            return [item.customer, item.competitor, item.activityType, item.location, item.consultant].join(" ").toLowerCase().includes(query)
                && (impactFilter === "all" || item.businessImpact === impactFilter)
                && inDateRange(item.date, startDate, endDate)
        })
        const lostSales = rawData.lostSales.filter((item) => {
            return [item.customer, item.productDetail, item.reason, item.consultant].join(" ").toLowerCase().includes(query)
                && (reasonFilter === "all" || item.reason === reasonFilter)
                && inDateRange(item.date, startDate, endDate)
        })
        return { prices, activities, lostSales }
    }, [rawData, reasonFilter, search, segmentFilter, impactFilter, startDate, endDate])

    const stats = useMemo(() => {
        const topReason = aggregate(filtered.lostSales.map((item) => item.reason), 1)[0]?.name ?? "-"
        const highImpact = filtered.activities.filter((item) => item.businessImpact === "Tinggi").length
        const median27 = filtered.prices.filter((item) => item.size.includes("27.00R49")).map((item) => item.price).sort((a, b) => a - b)
        const median27Price = median27.length ? median27[Math.floor(median27.length / 2)] : 0
        return { topReason, highImpact, median27Price }
    }, [filtered])

    const brandChart = useMemo(() => aggregate(filtered.prices.map((item) => item.brand)), [filtered.prices])
    const segmentChart = useMemo(() => aggregate(filtered.prices.map((item) => sizeSegment(item.size, item.price))), [filtered.prices])
    const activityChart = useMemo(() => aggregate(filtered.activities.map((item) => item.activityType)), [filtered.activities])
    const impactChart = useMemo(() => aggregate(filtered.activities.map((item) => item.businessImpact)), [filtered.activities])
    const reasonChart = useMemo(() => aggregate(filtered.lostSales.map((item) => item.reason)), [filtered.lostSales])
    const customerLostChart = useMemo(() => aggregate(filtered.lostSales.map((item) => item.customer)), [filtered.lostSales])
    const consultantChart = useMemo(() => aggregate([...filtered.lostSales.map((item) => item.consultant), ...filtered.activities.map((item) => item.consultant), ...filtered.prices.map((item) => item.consultant)]), [filtered])
    const reasons = useMemo(() => aggregate(rawData.lostSales.map((item) => item.reason), 40).map((item) => item.name), [rawData.lostSales])
    const impacts = useMemo(() => aggregate(rawData.activities.map((item) => item.businessImpact), 40).map((item) => item.name), [rawData.activities])

    const exportCsv = () => {
        const csv = Papa.unparse({
            fields: ["worksheet", "date", "consultant", "customer", "topic", "note"],
            data: [
                ...filtered.lostSales.map((item) => ["Lost Sale", formatDate(item.date), item.consultant, item.customer, item.reason, item.actionPlan || item.remark]),
                ...filtered.activities.map((item) => ["Competitor Activity", formatDate(item.date), item.consultant, item.customer, item.competitor, item.activityType, item.businessImpact, item.strategy || item.description]),
                ...filtered.prices.map((item) => ["Competitor Price", formatDate(item.date), item.consultant, item.customer, item.brand, item.size, item.price, item.deliveryPoint]),
            ],
        })
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `competitor-dashboard-${format(new Date(), "yyyyMMdd-HHmm")}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-6">
            <Card className="border-none bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white shadow-xl">
                <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-2 flex flex-wrap gap-2">
                            <Badge className="bg-white/15 text-white hover:bg-white/20">3 Live Worksheets</Badge>
                            <Badge className="bg-orange-400 text-slate-950 hover:bg-orange-400">Date Range Filter</Badge>
                        </div>
                        <CardTitle className="text-2xl md:text-3xl">Competitor Intelligence Dashboard</CardTitle>
                        <CardDescription className="max-w-3xl text-blue-100">
                            Dashboard lengkap dari sheet Lost Sale, Competitor Price, dan Competitor Activity. Filter tanggal berlaku ke semua worksheet.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={loadSheet} disabled={isLoading}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                        <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={exportCsv}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Filtered
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="flex items-center gap-2 p-4 text-sm text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        {error}
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ScoreCard title="Price Records" value={isLoading ? "..." : filtered.prices.length} icon={Database} description={`${SHEETS.prices.name} worksheet`} />
                <ScoreCard title="Activity Records" value={isLoading ? "..." : filtered.activities.length} icon={Zap} description={`${stats.highImpact} high impact`} gradient="from-indigo-500/10 via-blue-400/5 to-cyan-500/10 border-indigo-200/50" iconColor="text-indigo-600" textColor="text-indigo-900" />
                <ScoreCard title="Lost Sale Records" value={isLoading ? "..." : filtered.lostSales.length} icon={Target} description="Jumlah potensial hilang" gradient="from-red-500/10 via-red-400/5 to-orange-500/10 border-red-200/50" iconColor="text-red-600" textColor="text-red-900" />
                <ScoreCard title="Median 27.00R49" value={stats.median27Price ? formatMoney(stats.median27Price) : "-"} icon={Target} description="Benchmark premium segment" gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50" iconColor="text-purple-600" textColor="text-purple-900" />
            </div>

            <Card className="border-none shadow-sm">
                <CardContent className="grid gap-3 p-4 md:grid-cols-6">
                    <div className="relative md:col-span-2">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Cari customer, brand, competitor, BC..." value={search} onChange={(event) => setSearch(event.target.value)} />
                    </div>
                    <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                    </div>
                    <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                    <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                        <SelectTrigger><SelectValue placeholder="Segment" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Segments</SelectItem>
                            <SelectItem value="Extra Large">Extra Large</SelectItem>
                            <SelectItem value="Large">Large</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Small">Small</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); setReasonFilter("all"); setSegmentFilter("all"); setImpactFilter("all") }}>
                        Reset Filter
                    </Button>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Select value={reasonFilter} onValueChange={setReasonFilter}>
                    <SelectTrigger><SelectValue placeholder="Lost Sale Reason" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Lost Sale Reasons</SelectItem>
                        {reasons.map((reason) => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={impactFilter} onValueChange={setImpactFilter}>
                    <SelectTrigger><SelectValue placeholder="Business Impact" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Business Impacts</SelectItem>
                        {impacts.map((impact) => <SelectItem key={impact} value={impact}>{impact}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base">Lost Sale Count by Reason</CardTitle>
                        <CardDescription>Frekuensi kehilangan berdasarkan alasan.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reasonChart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#f97316" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Price Segment Mix</CardTitle>
                        <CardDescription>Segment PDF tetap dipakai untuk price worksheet.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={segmentChart} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={4}>
                                    {segmentChart.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Competitor Activity by Type</CardTitle>
                        <CardDescription>Sheet activity dibuat dashboard sendiri, bukan cuma tabel.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={activityChart} layout="vertical" margin={{ left: 32 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#2563eb" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Business Impact (Activity)</CardTitle>
                        <CardDescription>Perkiraan pengaruh competitor activity ke bisnis.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={impactChart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#dc2626" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Top Customer in Lost Sale</CardTitle>
                        <CardDescription>Customer yang sering dilaporkan di Lost Sale.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={customerLostChart} layout="vertical" margin={{ left: 24 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#9333ea" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Top Brand & Consultant Signal</CardTitle>
                        <CardDescription>Brand price update dan BC paling aktif dari semua worksheet.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid h-[280px] gap-4 md:grid-cols-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={brandChart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#16a34a" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={consultantChart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#0891b2" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" />Worksheet: Lost Sale & Action Plan</CardTitle>
                    <CardDescription>{filtered.lostSales.length} rows setelah filter tanggal dan filter lain.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[460px] overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead><TableHead>BC</TableHead><TableHead>Customer</TableHead><TableHead>Product Type</TableHead><TableHead>Detail Product</TableHead><TableHead>Reason</TableHead><TableHead>Remark</TableHead><TableHead>Action Plan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.lostSales.slice(0, 120).map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{formatDate(item.date)}</TableCell>
                                    <TableCell className="font-medium">{item.consultant || "-"}</TableCell>
                                    <TableCell>{item.customer}</TableCell>
                                    <TableCell>{item.productType}</TableCell>
                                    <TableCell className="max-w-[220px] whitespace-normal">{item.productDetail}</TableCell>
                                    <TableCell><Badge variant={item.reason === "Price" ? "warning" : "secondary"}>{item.reason}</Badge></TableCell>
                                    <TableCell className="max-w-[220px] whitespace-normal">{item.remark || "-"}</TableCell>
                                    <TableCell className="max-w-[320px] whitespace-normal">{item.actionPlan || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" />Worksheet: Competitor Activity</CardTitle>
                    <CardDescription>{filtered.activities.length} rows activity, termasuk impact dan strategi.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[420px] overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead><TableHead>BC</TableHead><TableHead>Competitor</TableHead><TableHead>Activity</TableHead><TableHead>Customer</TableHead><TableHead>Impact</TableHead><TableHead>Strategy</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.activities.slice(0, 120).map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{formatDate(item.date)}</TableCell>
                                    <TableCell className="font-medium">{item.consultant || "-"}</TableCell>
                                    <TableCell>{item.competitor}</TableCell>
                                    <TableCell>{item.activityType}</TableCell>
                                    <TableCell>{item.customer || "-"}</TableCell>
                                    <TableCell><Badge variant={item.businessImpact === "Tinggi" ? "destructive" : "outline"}>{item.businessImpact || "-"}</Badge></TableCell>
                                    <TableCell className="max-w-[360px] whitespace-normal">{item.strategy || item.description || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="h-4 w-4 text-primary" />Worksheet: Competitor Price Update</CardTitle>
                    <CardDescription>{filtered.prices.length} rows price benchmark per size, brand, supplier.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[420px] overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead><TableHead>BC</TableHead><TableHead>Customer</TableHead><TableHead>Size</TableHead><TableHead>Brand</TableHead><TableHead>Segment</TableHead><TableHead>Supplier</TableHead><TableHead>Price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.prices.slice(0, 120).map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{formatDate(item.date)}</TableCell>
                                    <TableCell className="font-medium">{item.consultant || "-"}</TableCell>
                                    <TableCell>{item.customer}</TableCell>
                                    <TableCell>{item.size}</TableCell>
                                    <TableCell>{item.brand}</TableCell>
                                    <TableCell><Badge variant="outline">{sizeSegment(item.size, item.price)}</Badge></TableCell>
                                    <TableCell>{item.supplier}</TableCell>
                                    <TableCell>{formatMoney(item.price)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
