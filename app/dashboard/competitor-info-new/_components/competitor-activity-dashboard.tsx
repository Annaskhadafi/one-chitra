"use client"

import { useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import { format } from "date-fns"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Activity, AlertTriangle, Building2, CalendarDays, Download, MapPin, RefreshCw, Search, Target, Users, Zap } from "lucide-react"
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
const COLORS = ["#1d4ed8", "#f97316", "#16a34a", "#9333ea", "#dc2626", "#0891b2", "#be123c", "#4f46e5", "#ca8a04"]

type SheetRow = Record<string, string | undefined>
type DatePreset = "current-year" | "current-month" | "last-30-days" | "all" | "custom"

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
    if (preset === "current-month") return {
        startDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    }
    if (preset === "last-30-days") {
        const start = new Date(now)
        start.setDate(start.getDate() - 30)
        return { startDate: toDateInputValue(start), endDate: toDateInputValue(now) }
    }
    return { startDate: "", endDate: "" }
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

function aggregate(records: string[], limit = 10) {
    const counts = records.reduce<Record<string, number>>((acc, value) => {
        const key = cleanText(value) || "Unknown"
        acc[key] = (acc[key] ?? 0) + 1
        return acc
    }, {})
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit)
}

function formatMonthKey(date: Date | null) {
    return date ? format(date, "yyyy-MM") : ""
}

function monthlyCount(records: ActivityRecord[]) {
    const counts = records.reduce<Record<string, number>>((acc, record) => {
        const month = formatMonthKey(record.infoDate)
        if (!month) return acc
        acc[month] = (acc[month] ?? 0) + 1
        return acc
    }, {})
    return Object.entries(counts).map(([month, value]) => ({ month, value })).sort((a, b) => a.month.localeCompare(b.month))
}

function renderPieLabel({ name, percent, value }: { name?: string; percent?: number; value?: number }) {
    if (!percent || percent < 0.08) return ""
    return `${name ?? ""} ${value ?? 0} (${(percent * 100).toFixed(0)}%)`
}

function toggleValue(values: string[], value: string) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function MultiSelectFilter({
    title,
    options,
    selected,
    onChange,
}: {
    title: string
    options: string[]
    selected: string[]
    onChange: (value: string[]) => void
}) {
    const [query, setQuery] = useState("")
    const visibleOptions = options.filter((option) => option.toLowerCase().includes(query.toLowerCase())).slice(0, 120)

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">{selected.length ? `${title}: ${selected.length}` : `All ${title}`}</span>
                    <span className="text-xs text-muted-foreground">Multi</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-3">
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{title}</p>
                        <Button variant="ghost" size="sm" onClick={() => onChange([])}>Clear</Button>
                    </div>
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}...`} className="h-8" />
                    <div className="max-h-72 space-y-2 overflow-auto pr-1">
                        {visibleOptions.map((option) => (
                            <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                                <Checkbox checked={selected.includes(option)} onCheckedChange={() => onChange(toggleValue(selected, option))} />
                                <span className="truncate">{option}</span>
                            </label>
                        ))}
                        {!visibleOptions.length && <p className="py-4 text-center text-sm text-muted-foreground">No option</p>}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

function parseActivityRows(rows: SheetRow[]) {
    return rows.map((row, index): ActivityRecord | null => {
        const competitor = cleanText(row.Competitor)
        const activityType = cleanText(row["Jenis Aktivitas"])
        if (!competitor || !activityType) return null
        return {
            id: `activity-${index}`,
            timestamp: parseDateValue(row.Timestamp),
            infoDate: parseDateValue(row["Tanggal Informasi"]),
            consultant: cleanText(row["Business Consultant"]),
            competitor,
            industry: cleanText(row["Industri / Kategori"]),
            location: cleanText(row.Lokasi),
            activityType,
            customer: cleanText(row.Customer),
            marketResponse: cleanText(row["Respon Pasar"]),
            businessImpact: cleanText(row["Perkiraan Pengaruh ke Bisnis"]),
            strategy: cleanText(row["Strategi yang bisa di terapkan   (Re"]),
            description: cleanText(row["Deskripsi Competitor Activity"]),
        }
    }).filter(Boolean).sort((a, b) => (b?.infoDate?.getTime() ?? 0) - (a?.infoDate?.getTime() ?? 0)) as ActivityRecord[]
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
    const [industryFilter, setIndustryFilter] = useState<string[]>([])
    const [activityFilter, setActivityFilter] = useState<string[]>([])
    const [impactFilter, setImpactFilter] = useState<string[]>([])
    const [responseFilter, setResponseFilter] = useState<string[]>([])
    const [locationFilter, setLocationFilter] = useState<string[]>([])

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

    useEffect(() => {
        loadData()
    }, [])

    const options = useMemo(() => ({
        competitors: aggregate(records.map((record) => record.competitor), 300).map((item) => item.name),
        industries: aggregate(records.map((record) => record.industry), 100).map((item) => item.name),
        activities: aggregate(records.map((record) => record.activityType), 200).map((item) => item.name),
        impacts: aggregate(records.map((record) => record.businessImpact), 50).map((item) => item.name),
        responses: aggregate(records.map((record) => record.marketResponse), 50).map((item) => item.name),
        locations: aggregate(records.map((record) => record.location), 300).map((item) => item.name),
    }), [records])

    const filtered = useMemo(() => {
        const query = search.toLowerCase()
        return records.filter((record) => {
            const matchesSearch = [record.consultant, record.competitor, record.customer, record.industry, record.location, record.activityType, record.description].join(" ").toLowerCase().includes(query)
            return matchesSearch
                && (!competitorFilter.length || competitorFilter.includes(record.competitor))
                && (!industryFilter.length || industryFilter.includes(record.industry))
                && (!activityFilter.length || activityFilter.includes(record.activityType))
                && (!impactFilter.length || impactFilter.includes(record.businessImpact))
                && (!responseFilter.length || responseFilter.includes(record.marketResponse))
                && (!locationFilter.length || locationFilter.includes(record.location))
                && inDateRange(record.infoDate, startDate, endDate)
        }).sort((a, b) => (b.infoDate?.getTime() ?? 0) - (a.infoDate?.getTime() ?? 0))
    }, [records, search, competitorFilter, industryFilter, activityFilter, impactFilter, responseFilter, locationFilter, startDate, endDate])

    const totalCompetitors = new Set(filtered.map((record) => record.competitor).filter(Boolean)).size
    const totalIndustries = new Set(filtered.map((record) => record.industry).filter(Boolean)).size
    const totalActivities = new Set(filtered.map((record) => record.activityType).filter(Boolean)).size
    const highImpact = filtered.filter((record) => record.businessImpact.toLowerCase() === "tinggi").length

    const activityTypeChart = useMemo(() => aggregate(filtered.map((record) => record.activityType), 10), [filtered])
    const impactChart = useMemo(() => aggregate(filtered.map((record) => record.businessImpact), 8), [filtered])
    const competitorChart = useMemo(() => aggregate(filtered.map((record) => record.competitor), 12), [filtered])
    const areaChart = useMemo(() => aggregate(filtered.map((record) => record.location), 10), [filtered])
    const responseChart = useMemo(() => aggregate(filtered.map((record) => record.marketResponse), 8), [filtered])
    const consultantChart = useMemo(() => aggregate(filtered.map((record) => record.consultant), 12), [filtered])
    const monthlyActivity = useMemo(() => monthlyCount(records), [records])

    const handleDatePresetChange = (preset: DatePreset) => {
        setDatePreset(preset)
        if (preset === "custom") return
        const range = getDatePresetRange(preset)
        setStartDate(range.startDate)
        setEndDate(range.endDate)
    }

    const resetFilters = () => {
        const range = getDatePresetRange("current-year")
        setSearch("")
        setDatePreset("current-year")
        setStartDate(range.startDate)
        setEndDate(range.endDate)
        setCompetitorFilter([])
        setIndustryFilter([])
        setActivityFilter([])
        setImpactFilter([])
        setResponseFilter([])
        setLocationFilter([])
    }

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
                            <p className="text-sm text-blue-100">Pantau aktivitas kompetitor, area, respon pasar, dan pengaruh bisnis dari Google Sheet.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={loadData} disabled={isLoading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                            <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export</Button>
                        </div>
                    </div>
                </div>
                <CardContent className="p-5">
                    {error && <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{error}</div>}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <ScoreCard title="Informasi" value={isLoading ? "..." : filtered.length} icon={Activity} description="Filtered activity records" />
                        <ScoreCard title="Kompetitor" value={isLoading ? "..." : totalCompetitors} icon={Building2} description="Unique competitors" gradient="from-indigo-500/10 via-blue-400/5 to-cyan-500/10 border-indigo-200/50" iconColor="text-indigo-600" textColor="text-indigo-900" />
                        <ScoreCard title="Kategori" value={isLoading ? "..." : totalIndustries} icon={Target} description="Industry/category coverage" gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50" iconColor="text-purple-600" textColor="text-purple-900" />
                        <ScoreCard title="High Impact" value={isLoading ? "..." : highImpact} icon={Zap} description={`${totalActivities} jenis aktivitas`} gradient="from-red-500/10 via-red-400/5 to-orange-500/10 border-red-200/50" iconColor="text-red-600" textColor="text-red-900" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Filter Competitor Activity</CardTitle>
                    <CardDescription>Date range pakai kolom `Tanggal Informasi` dari Form Response 2.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4 xl:grid-cols-10">
                    <div className="relative md:col-span-2">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Cari competitor, customer, area, activity..." value={search} onChange={(event) => setSearch(event.target.value)} />
                    </div>
                    <Select value={datePreset} onValueChange={(value) => handleDatePresetChange(value as DatePreset)}>
                        <SelectTrigger><SelectValue placeholder="Date range" /></SelectTrigger>
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
                        <Input className="pl-9" type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setDatePreset("custom") }} />
                    </div>
                    <Input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setDatePreset("custom") }} />
                    <MultiSelectFilter title="Competitor" options={options.competitors} selected={competitorFilter} onChange={setCompetitorFilter} />
                    <MultiSelectFilter title="Activity" options={options.activities} selected={activityFilter} onChange={setActivityFilter} />
                    <MultiSelectFilter title="Impact" options={options.impacts} selected={impactFilter} onChange={setImpactFilter} />
                    <MultiSelectFilter title="Area" options={options.locations} selected={locationFilter} onChange={setLocationFilter} />
                    <Button variant="outline" onClick={resetFilters}>Reset</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Data Detail</CardTitle>
                    <CardDescription>{filtered.length} record competitor activity setelah filter.</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[560px] overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
                            <TableRow>
                                <TableHead>Last Update</TableHead><TableHead>Business Consultant</TableHead><TableHead>Competitor</TableHead><TableHead>Customer</TableHead><TableHead>Industri / Kategori</TableHead><TableHead>Jenis Aktivitas</TableHead><TableHead>Respon Pasar</TableHead><TableHead>Pengaruh Bisnis</TableHead><TableHead>Deskripsi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.slice(0, 150).map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell>{formatDate(record.infoDate)}</TableCell>
                                    <TableCell className="font-medium">{record.consultant || "-"}</TableCell>
                                    <TableCell>{record.competitor}</TableCell>
                                    <TableCell>{record.customer || "-"}</TableCell>
                                    <TableCell>{record.industry || "-"}</TableCell>
                                    <TableCell><Badge variant="outline">{record.activityType}</Badge></TableCell>
                                    <TableCell><Badge variant={record.marketResponse === "Positif" ? "success" : record.marketResponse === "Negatif" ? "destructive" : "secondary"}>{record.marketResponse || "-"}</Badge></TableCell>
                                    <TableCell><Badge variant={record.businessImpact === "Tinggi" ? "destructive" : record.businessImpact === "Sedang" ? "warning" : "outline"}>{record.businessImpact || "-"}</Badge></TableCell>
                                    <TableCell className="max-w-[360px] whitespace-normal">{record.description || record.strategy || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-base">Jenis Aktivitas</CardTitle></CardHeader>
                    <CardContent className="h-[360px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 28, right: 42, bottom: 70, left: 42 }}>
                                <Pie data={activityTypeChart} dataKey="value" nameKey="name" cx="50%" cy="42%" outerRadius={94} label={renderPieLabel} labelLine>
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
                    <CardContent className="h-[360px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={impactChart}>
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

            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-base">Grafik Kompetitor</CardTitle></CardHeader>
                    <CardContent className="h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={competitorChart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={90} tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" name="Record Count" fill="#0ea5e9" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="value" position="top" className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Area</CardTitle></CardHeader>
                    <CardContent className="h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 28, right: 42, bottom: 70, left: 42 }}>
                                <Pie data={areaChart} dataKey="value" nameKey="name" cx="50%" cy="42%" innerRadius={52} outerRadius={94} label={renderPieLabel} labelLine>
                                    {areaChart.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={64} wrapperStyle={{ fontSize: 11, lineHeight: "16px" }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <Card>
                    <CardHeader><CardTitle className="text-base">Respon Pasar</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={responseChart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" name="Record Count" fill="#16a34a" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="value" position="top" className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Business Consultant Update</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={consultantChart}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" name="Record Count" fill="#9333ea" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="value" position="top" className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Monthly Activity Trend</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyActivity}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" name="Record Count" fill="#f97316" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="value" position="top" className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
