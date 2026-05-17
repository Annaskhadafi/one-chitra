"use client"

import { useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import { format } from "date-fns"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Activity, AlertTriangle, CalendarDays, Database, Download, Globe, RefreshCw, Search, Users, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScoreCard } from "@/components/score-card"

const ACTIVITY_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?output=csv&gid=98214477"
const COLORS = ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#0f766e", "#f97316"]
const LINE_COLORS = ["#dc2626", "#2563eb", "#16a34a", "#9333ea", "#f97316", "#0891b2", "#be123c", "#4f46e5"]

type SheetRow = Record<string, string | undefined>

type ActivityRecord = {
    id: string
    timestamp: Date | null
    infoDate: Date | null
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

type DatePreset = "current-year" | "current-month" | "last-30-days" | "all" | "custom"

function cleanText(value?: string) {
    return (value ?? "").replace(/\s+/g, " ").trim()
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

function formatDate(value: Date | null) {
    return value ? format(value, "dd MMM yyyy") : "-"
}

function toDateInputValue(value: Date) {
    return format(value, "yyyy-MM-dd")
}

function getDatePresetRange(preset: DatePreset) {
    const now = new Date()
    if (preset === "current-year") return { startDate: `${now.getFullYear()}-01-01`, endDate: `${now.getFullYear()}-12-31` }
    if (preset === "current-month") return { startDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
    if (preset === "last-30-days") { const d = new Date(); d.setDate(d.getDate() - 30); return { startDate: toDateInputValue(d), endDate: toDateInputValue(now) } }
    return { startDate: "", endDate: "" }
}

function inDateRange(date: Date | null, startDate: string, endDate: string) {
    if (!date) return true
    if (startDate) { const start = new Date(startDate); start.setHours(0, 0, 0, 0); if (date < start) return false }
    if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); if (date > end) return false }
    return true
}

function aggregate(records: string[], limit = 10) {
    const counts = records.reduce<Record<string, number>>((acc, value) => {
        const key = cleanText(value) || "Unknown"
        acc[key] = (acc[key] ?? 0) + 1
        return acc
    }, {})
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit)
}

function renderPieLabel({ name, percent, value }: { name?: string; percent?: number; value?: number }) {
    if (!percent || percent < 0.06) return ""
    return `${name ?? ""} (${value ?? 0})`
}

function parseActivityRows(rows: SheetRow[]) {
    return rows.map((row, index): ActivityRecord | null => {
        const competitor = cleanText(row["Competitor"])
        const activityType = cleanText(row["Jenis Aktivitas"])
        if (!competitor || !activityType) return null
        return {
            id: `act-${index}`,
            timestamp: parseDateValue(row.Timestamp),
            infoDate: parseDateValue(row["Tanggal Informasi"]),
            consultant: cleanText(row["Business Consultant"]),
            competitor,
            industry: cleanText(row["Industri / Kategori"]),
            location: cleanText(row["Lokasi"]),
            activityType,
            customer: cleanText(row["Customer"]),
            marketResponse: cleanText(row["Respon Pasar"]),
            businessImpact: cleanText(row["Perkiraan Pengaruh ke Bisnis"]),
            strategy: cleanText(row["Strategi yang bisa di terapkan   (Re"]),
            description: cleanText(row["Deskripsi Competitor Activity"]),
        }
    }).filter(Boolean).sort((a, b) => {
        const dateA = a?.infoDate?.getTime() ?? 0
        const dateB = b?.infoDate?.getTime() ?? 0
        return dateB - dateA
    }) as ActivityRecord[]
}

function toggleValue(values: string[], value: string) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function MultiSelectFilter({ title, options, selected, onChange }: { title: string; options: string[]; selected: string[]; onChange: (value: string[]) => void }) {
    const [query, setQuery] = useState("")
    const filteredOptions = options.filter((option) => option.toLowerCase().includes(query.toLowerCase()))
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 text-xs justify-between min-w-[120px]">
                    {selected.length ? `${title} (${selected.length})` : title}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 space-y-2" align="start">
                <Input placeholder={`Cari ${title.toLowerCase()}...`} value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 text-xs" />
                <div className="max-h-[200px] overflow-auto space-y-1">
                    {filteredOptions.map((option) => (
                        <label key={option} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                            <Checkbox checked={selected.includes(option)} onCheckedChange={() => onChange(toggleValue(selected, option))} />
                            <span className="truncate">{option}</span>
                        </label>
                    ))}
                </div>
                {selected.length > 0 && <Button variant="ghost" className="w-full h-7 text-xs" onClick={() => onChange([])}>Clear</Button>}
            </PopoverContent>
        </Popover>
    )
}

export function CompetitorActivityDashboard() {
    const [records, setRecords] = useState<ActivityRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")
    const [search, setSearch] = useState("")
    const initialYearRange = getDatePresetRange("current-year")
    const [datePreset, setDatePreset] = useState<DatePreset>("current-year")
    const [startDate, setStartDate] = useState(initialYearRange.startDate)
    const [endDate, setEndDate] = useState(initialYearRange.endDate)
    const [competitorFilter, setCompetitorFilter] = useState<string[]>([])
    const [impactFilter, setImpactFilter] = useState<string[]>([])
    const [responseFilter, setResponseFilter] = useState<string[]>([])
    const [activityTypeFilter, setActivityTypeFilter] = useState<string[]>([])
    const [locationFilter, setLocationFilter] = useState<string[]>([])
    const [page, setPage] = useState(0)
    const PAGE_SIZE = 10

    const loadData = async () => {
        setIsLoading(true)
        setError("")
        try {
            const response = await fetch(ACTIVITY_SHEET_URL, { cache: "no-store" })
            if (!response.ok) throw new Error("Gagal memuat Form Response 2")
            const csv = await response.text()
            const parsed = Papa.parse<SheetRow>(csv, { header: true, skipEmptyLines: true, transformHeader: (header) => header.trim() })
            setRecords(parseActivityRows(parsed.data))
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Gagal memuat data")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { loadData() }, [])

    const options = useMemo(() => ({
        competitors: aggregate(records.map((r) => r.competitor), 200).map((i) => i.name),
        impacts: aggregate(records.map((r) => r.businessImpact), 50).map((i) => i.name),
        responses: aggregate(records.map((r) => r.marketResponse), 50).map((i) => i.name),
        activityTypes: aggregate(records.map((r) => r.activityType), 200).map((i) => i.name),
        locations: aggregate(records.map((r) => r.location), 200).map((i) => i.name),
    }), [records])

    const filtered = useMemo(() => {
        const query = search.toLowerCase()
        return records.filter((r) => {
            const matchesSearch = [r.competitor, r.customer, r.location, r.activityType, r.consultant, r.description].join(" ").toLowerCase().includes(query)
            return matchesSearch
                && (!competitorFilter.length || competitorFilter.includes(r.competitor))
                && (!impactFilter.length || impactFilter.includes(r.businessImpact))
                && (!responseFilter.length || responseFilter.includes(r.marketResponse))
                && (!activityTypeFilter.length || activityTypeFilter.includes(r.activityType))
                && (!locationFilter.length || locationFilter.includes(r.location))
                && inDateRange(r.infoDate, startDate, endDate)
        }).sort((a, b) => (b.infoDate?.getTime() ?? 0) - (a.infoDate?.getTime() ?? 0))
    }, [records, search, competitorFilter, impactFilter, responseFilter, activityTypeFilter, locationFilter, startDate, endDate])

    const handleDatePresetChange = (preset: DatePreset) => {
        setDatePreset(preset)
        if (preset === "custom") return
        const range = getDatePresetRange(preset)
        setStartDate(range.startDate)
        setEndDate(range.endDate)
    }

    const infoCount = filtered.length
    const categoryCount = new Set(filtered.map((r) => r.industry).filter(Boolean)).size
    const activityTypeCount = new Set(filtered.map((r) => r.activityType).filter(Boolean)).size

    const activityTypeChart = useMemo(() => aggregate(filtered.map((r) => r.activityType), 12), [filtered])
    const impactChart = useMemo(() => aggregate(filtered.map((r) => r.businessImpact), 6), [filtered])
    const competitorChart = useMemo(() => aggregate(filtered.map((r) => r.competitor), 10), [filtered])
    const locationChart = useMemo(() => aggregate(filtered.map((r) => r.location), 8), [filtered])
    const consultantChart = useMemo(() => aggregate(filtered.map((r) => r.consultant), 12), [filtered])

    // Activity Timeline - monthly count using ALL records (not filtered)
    const activityTimeline = useMemo(() => {
        const monthly: Record<string, number> = {}
        records.forEach((r) => {
            if (!r.infoDate) return
            const key = format(r.infoDate, "yyyy-MM")
            monthly[key] = (monthly[key] ?? 0) + 1
        })
        return Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }))
    }, [records])

    // Threat Matrix: competitor x impact
    const threatMatrix = useMemo(() => {
        const map = new Map<string, { total: number; high: number; customers: Set<string> }>()
        filtered.forEach((r) => {
            const entry = map.get(r.competitor) ?? { total: 0, high: 0, customers: new Set() }
            entry.total++
            if (r.businessImpact === "Tinggi") entry.high++
            if (r.customer) entry.customers.add(r.customer)
            map.set(r.competitor, entry)
        })
        return Array.from(map.entries()).map(([name, data]) => ({
            name,
            total: data.total,
            highImpactPct: Math.round((data.high / data.total) * 100),
            customerCount: data.customers.size,
        })).sort((a, b) => b.highImpactPct - a.highImpactPct).slice(0, 10)
    }, [filtered])

    // High Impact Alerts
    const highImpactAlerts = useMemo(() => {
        return filtered.filter((r) => r.businessImpact === "Tinggi" && r.marketResponse === "Positif").slice(0, 8)
    }, [filtered])

    // Repeat Target customers
    const repeatTargets = useMemo(() => {
        const counts = new Map<string, { count: number; competitors: Set<string>; lastDate: Date | null }>()
        filtered.forEach((r) => {
            if (!r.customer) return
            const entry = counts.get(r.customer) ?? { count: 0, competitors: new Set(), lastDate: null }
            entry.count++
            entry.competitors.add(r.competitor)
            if (!entry.lastDate || (r.infoDate && r.infoDate > entry.lastDate)) entry.lastDate = r.infoDate
            counts.set(r.customer, entry)
        })
        return Array.from(counts.entries())
            .filter(([, data]) => data.count > 1)
            .map(([customer, data]) => ({ customer, count: data.count, competitors: Array.from(data.competitors).join(", "), lastDate: data.lastDate }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
    }, [filtered])

    // Competitor Strategy Pattern
    const strategyPattern = useMemo(() => {
        const map = new Map<string, Record<string, number>>()
        filtered.forEach((r) => {
            if (!map.has(r.competitor)) map.set(r.competitor, {})
            const types = map.get(r.competitor)!
            types[r.activityType] = (types[r.activityType] ?? 0) + 1
        })
        return Array.from(map.entries())
            .map(([competitor, types]) => {
                const sorted = Object.entries(types).sort(([, a], [, b]) => b - a)
                return { competitor, topStrategy: sorted[0]?.[0] ?? "-", topCount: sorted[0]?.[1] ?? 0, totalActivities: Object.values(types).reduce((s, v) => s + v, 0) }
            })
            .sort((a, b) => b.totalActivities - a.totalActivities)
            .slice(0, 10)
    }, [filtered])

    const exportCsv = () => {
        const csv = Papa.unparse(filtered)
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `competitor-activity-${format(new Date(), "yyyyMMdd-HHmm")}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

    return (
        <div className="space-y-6">
            <Card className="overflow-hidden border-none bg-white shadow-sm">
                <div className="bg-gradient-to-r from-[#1d5fad] via-[#1f6fbe] to-[#0f4b8f] px-6 py-5 text-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="mb-2 flex flex-wrap gap-2">
                                <Badge className="bg-white text-[#1d5fad] hover:bg-white">Form Response 2</Badge>
                                <Badge className="bg-yellow-300 text-slate-900 hover:bg-yellow-300">COMPETITOR ACTIVITY</Badge>
                            </div>
                            <h2 className="text-2xl font-bold">Competitor Activity Dashboard</h2>
                            <p className="text-sm text-blue-100">Monitoring aktivitas kompetitor: peluncuran produk, promosi, ekspansi, dan dampak bisnis.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={loadData} disabled={isLoading}>
                                <RefreshCw className="mr-2 h-4 w-4" />Refresh
                            </Button>
                            <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={exportCsv}>
                                <Download className="mr-2 h-4 w-4" />Export
                            </Button>
                        </div>
                    </div>
                </div>
                <CardContent className="p-5">
                    {error && (
                        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            <AlertTriangle className="h-4 w-4" />{error}
                        </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <ScoreCard title="Informasi" value={isLoading ? "..." : infoCount} icon={Database} description="Total activity records" />
                        <ScoreCard title="Kategory" value={isLoading ? "..." : categoryCount} icon={Globe} description="Unique industry/category" gradient="from-indigo-500/10 via-blue-400/5 to-cyan-500/10 border-indigo-200/50" iconColor="text-indigo-600" textColor="text-indigo-900" />
                        <ScoreCard title="Jenis Aktivitas" value={isLoading ? "..." : activityTypeCount} icon={Zap} description="Unique activity types" gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50" iconColor="text-purple-600" textColor="text-purple-900" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Filter Competitor Activity</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Cari competitor, customer, lokasi..." className="pl-9 h-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={datePreset} onValueChange={(value) => handleDatePresetChange(value as DatePreset)}>
                        <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Date range" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="current-year">Tahun berjalan</SelectItem>
                            <SelectItem value="current-month">Bulan berjalan</SelectItem>
                            <SelectItem value="last-30-days">30 hari terakhir</SelectItem>
                            <SelectItem value="all">Semua tanggal</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9 h-9 text-xs" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatePreset("custom") }} />
                    </div>
                    <Input className="h-9 text-xs w-[140px]" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatePreset("custom") }} />
                    <MultiSelectFilter title="Competitor" options={options.competitors} selected={competitorFilter} onChange={setCompetitorFilter} />
                    <MultiSelectFilter title="Impact" options={options.impacts} selected={impactFilter} onChange={setImpactFilter} />
                    <MultiSelectFilter title="Respon" options={options.responses} selected={responseFilter} onChange={setResponseFilter} />
                    <MultiSelectFilter title="Jenis" options={options.activityTypes} selected={activityTypeFilter} onChange={setActivityTypeFilter} />
                    <MultiSelectFilter title="Lokasi" options={options.locations} selected={locationFilter} onChange={setLocationFilter} />
                    <Button variant="outline" className="h-9 text-xs" onClick={() => { const range = getDatePresetRange("current-year"); setSearch(""); setDatePreset("current-year"); setStartDate(range.startDate); setEndDate(range.endDate); setCompetitorFilter([]); setImpactFilter([]); setResponseFilter([]); setActivityTypeFilter([]); setLocationFilter([]) }}>Reset</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Data Detail</CardTitle>
                    <CardDescription>{filtered.length} record competitor activity setelah filter. Halaman {page + 1} / {totalPages || 1}</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto overflow-y-auto max-h-[560px]">
                    <Table className="min-w-[1400px]">
                        <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
                            <TableRow>
                                <TableHead className="w-8">#</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Business Consultant</TableHead>
                                <TableHead>Competitor</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Industri / Kategori</TableHead>
                                <TableHead>Jenis Aktivitas</TableHead>
                                <TableHead>Respon Pasar</TableHead>
                                <TableHead>Pengaruh Bisnis</TableHead>
                                <TableHead className="max-w-[280px]">Deskripsi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.map((r, idx) => (
                                <TableRow key={r.id}>
                                    <TableCell className="text-muted-foreground">{page * PAGE_SIZE + idx + 1}</TableCell>
                                    <TableCell>{formatDate(r.infoDate)}</TableCell>
                                    <TableCell className="font-medium">{r.consultant || "-"}</TableCell>
                                    <TableCell><Badge variant="outline">{r.competitor}</Badge></TableCell>
                                    <TableCell>{r.customer || "-"}</TableCell>
                                    <TableCell>{r.industry || "-"}</TableCell>
                                    <TableCell>{r.activityType}</TableCell>
                                    <TableCell><Badge variant={r.marketResponse === "Positif" ? "success" : r.marketResponse === "Negatif" ? "destructive" : "secondary"}>{r.marketResponse || "-"}</Badge></TableCell>
                                    <TableCell><Badge variant={r.businessImpact === "Tinggi" ? "destructive" : r.businessImpact === "Sedang" ? "warning" : "secondary"}>{r.businessImpact || "-"}</Badge></TableCell>
                                    <TableCell className="max-w-[280px] whitespace-normal text-xs">{r.description || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <div className="flex items-center justify-end gap-2 pt-3">
                        <span className="text-xs text-muted-foreground">{page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>&lt;</Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>&gt;</Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-base">Jenis Aktivitas Competitor</CardTitle></CardHeader>
                    <CardContent className="h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 28, right: 42, bottom: 70, left: 42 }}>
                                <Pie data={activityTypeChart} dataKey="value" nameKey="name" cx="50%" cy="42%" outerRadius={90} label={renderPieLabel} labelLine>
                                    {activityTypeChart.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={64} wrapperStyle={{ fontSize: 11, lineHeight: "16px" }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Pengaruh Terhadap Bisnis</CardTitle></CardHeader>
                    <CardContent className="h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={impactChart} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" name="Jumlah" fill="#1d5fad" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="value" position="top" className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-base">Grafik Kompetitor</CardTitle></CardHeader>
                    <CardContent className="h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={competitorChart} layout="vertical" margin={{ top: 10, right: 40, bottom: 10, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" name="Jumlah" fill="#2563eb" radius={[0, 8, 8, 0]}>
                                    <LabelList dataKey="value" position="right" className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Area / Lokasi</CardTitle></CardHeader>
                    <CardContent className="h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 28, right: 42, bottom: 70, left: 42 }}>
                                <Pie data={locationChart} dataKey="value" nameKey="name" cx="50%" cy="42%" outerRadius={90} label={renderPieLabel} labelLine>
                                    {locationChart.map((item, index) => <Cell key={item.name} fill={LINE_COLORS[index % LINE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={64} wrapperStyle={{ fontSize: 11, lineHeight: "16px" }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-base">Data Record by Consultant</CardTitle></CardHeader>
                <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={consultantChart} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="value" name="Record Count" fill="#1d4ed8" radius={[8, 8, 0, 0]}>
                                <LabelList dataKey="value" position="top" className="fill-slate-700 text-[10px]" />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}


