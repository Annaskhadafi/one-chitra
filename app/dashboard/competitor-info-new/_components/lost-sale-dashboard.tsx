
"use client"

import { useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import { format } from "date-fns"
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, DollarSign, Download, RefreshCw, Search, Target, TrendingDown, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { ScoreCard } from "@/components/score-card"
import { cleanText, normalizeNames } from "./utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const LOST_SALE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?output=csv&gid=1550828239"
const PAGE_SIZE = 25
const BAR_COLORS = ["#2563eb", "#7c3aed", "#ea580c", "#0891b2", "#dc2626", "#16a34a", "#4f46e5", "#be123c"]

type SheetRow = Record<string, string | undefined>
type DatePreset = "current-year" | "current-month" | "last-30-days" | "all" | "custom"

type LostSaleRecord = {
    id: string
    timestamp: Date | null
    consultant: string
    productType: string
    offeringDate: Date | null
    customer: string
    productDetail: string
    reason: string
    remark: string
    actionPlan: string
}

type ChartDatum = { name: string; value: number; count?: number; fill?: string }



function getField(row: SheetRow, ...keys: string[]) {
    const normalized = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[cleanText(key).toLowerCase()] = cleanText(value)
        return acc
    }, {})
    for (const key of keys) {
        const value = normalized[cleanText(key).toLowerCase()]
        if (value) return value
    }
    return ""
}

function parseDateValue(value?: string) {
    const text = cleanText(value)
    if (!text) return null
    const parts = text.split(" ")[0].split("/")
    if (parts.length === 3) {
        const [day, month, year] = parts
        const parsed = new Date(Number(year), Number(month) - 1, Number(day))
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseMoney(value?: string) {
    const raw = cleanText(value).replace(/IDR/gi, "").replace(/[^\d.,-]/g, "")
    if (!raw) return 0
    const dotCount = (raw.match(/\./g) ?? []).length
    const commaCount = (raw.match(/,/g) ?? []).length
    if (dotCount > 1 && commaCount === 0) return Number(raw.replaceAll(".", "")) || 0
    if (commaCount > 1 && dotCount === 0) return Number(raw.replaceAll(",", "")) || 0
    const lastComma = raw.lastIndexOf(",")
    const lastDot = raw.lastIndexOf(".")
    const decimalSep = lastComma > lastDot ? "," : "."
    const thousandsSep = decimalSep === "," ? "." : ","
    return Number(raw.replaceAll(thousandsSep, "").replace(decimalSep, ".")) || 0
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

function toDateInputValue(value: Date) {
    return format(value, "yyyy-MM-dd")
}

function getDatePresetRange(preset: DatePreset) {
    const now = new Date()
    if (preset === "current-year") return { startDate: `${now.getFullYear()}-01-01`, endDate: `${now.getFullYear()}-12-31` }
    if (preset === "current-month") return { startDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
    if (preset === "last-30-days") {
        const start = new Date()
        start.setDate(start.getDate() - 30)
        return { startDate: toDateInputValue(start), endDate: toDateInputValue(now) }
    }
    return { startDate: "", endDate: "" }
}

function inDateRange(date: Date | null, startDate: string, endDate: string) {
    if (!date) return true
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

function shortLabel(value: string, maxLength = 26) {
    if (!value) return "Unknown"
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function aggregateCount(values: string[], limit = 10) {
    const counts = values.reduce<Record<string, number>>((acc, value) => {
        const key = cleanText(value) || "Unknown"
        acc[key] = (acc[key] ?? 0) + 1
        return acc
    }, {})
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit)
}

function aggregateMoney(items: { name: string; value: number }[], limit = 10): ChartDatum[] {
    const totals = items.reduce<Record<string, { value: number; count: number }>>((acc, item) => {
        const key = cleanText(item.name) || "Unknown"
        if (!acc[key]) acc[key] = { value: 0, count: 0 }
        acc[key].value += item.value || 0
        acc[key].count += 1
        return acc
    }, {})
    return Object.entries(totals)
        .map(([name, item], index) => ({ name, value: item.value, count: item.count, fill: BAR_COLORS[index % BAR_COLORS.length] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
}

function toggleValue(values: string[], value: string) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function parseLostRows(rows: SheetRow[], customerMapping: Record<string, string>): LostSaleRecord[] {
    return rows.map((row, index): LostSaleRecord | null => {
        const rawCustomer = getField(row, "Customer", "Nama Customer")
        const productDetail = getField(row, "Detail Produk")
        if (!rawCustomer || !productDetail) return null
        return {
            id: `lost-${index}`,
            timestamp: parseDateValue(getField(row, "Timestamp")),
            consultant: getField(row, "Business Consultant", "Sales", "Konsultan"),
            productType: getField(row, "Tipe Produk"),
            offeringDate: parseDateValue(getField(row, "Tanggal Penawaran")),
            customer: customerMapping[rawCustomer] || rawCustomer,
            productDetail,
            reason: getField(row, "Penyebab Lost Sale", "Alasan") || "OTHER",
            remark: getField(row, "Remark", "Catatan"),
            actionPlan: getField(row, "Action Plan"),
        }
    }).filter(Boolean).sort((a, b) => (b.offeringDate?.getTime() ?? 0) - (a.offeringDate?.getTime() ?? 0)) as LostSaleRecord[]
}

function MultiSelectFilter({ title, options, selected, onChange }: { title: string; options: string[]; selected: string[]; onChange: (value: string[]) => void }) {
    const [query, setQuery] = useState("")
    const visible = options.filter((option) => option.toLowerCase().includes(query.toLowerCase()))
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 min-w-[150px] justify-between rounded-xl bg-white text-xs shadow-sm">
                    {selected.length ? `${title} (${selected.length})` : title}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 rounded-2xl p-3 shadow-xl" align="start">
                <Input placeholder={`Cari ${title.toLowerCase()}...`} value={query} onChange={(event) => setQuery(event.target.value)} className="mb-2 h-9 rounded-xl text-xs" />
                <div className="max-h-[240px] space-y-1 overflow-auto pr-1">
                    {visible.map((option) => (
                        <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100">
                            <Checkbox checked={selected.includes(option)} onCheckedChange={() => onChange(toggleValue(selected, option))} />
                            <span className="truncate" title={option}>{option}</span>
                        </label>
                    ))}
                </div>
                {selected.length > 0 && <Button variant="ghost" className="mt-2 h-8 w-full rounded-lg text-xs" onClick={() => onChange([])}>Clear {title}</Button>}
            </PopoverContent>
        </Popover>
    )
}

function EmptyState({ message }: { message: string }) {
    return <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-dashed bg-slate-50 text-sm text-slate-500">{message}</div>
}

export function LostSaleDashboard() {
    const [records, setRecords] = useState<LostSaleRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")
    const [datePreset, setDatePreset] = useState<DatePreset>("current-year")
    const initialRange = getDatePresetRange("current-year")
    const [startDate, setStartDate] = useState(initialRange.startDate)
    const [endDate, setEndDate] = useState(initialRange.endDate)
    const [search, setSearch] = useState("")
    const [reasonFilter, setReasonFilter] = useState<string[]>([])
    const [consultantFilter, setConsultantFilter] = useState<string[]>([])
    const [customerFilter, setCustomerFilter] = useState<string[]>([])
    const [page, setPage] = useState(0)

    useEffect(() => {
        let mounted = true
        const CACHE_KEY = "lost_sale_cache_v1"
        const CACHE_TTL = 5 * 60 * 1000
        try {
            const raw = localStorage.getItem(CACHE_KEY)
            if (raw) {
                const parsed = JSON.parse(raw)
                if (mounted) { setRecords(parsed.data); setIsLoading(false) }
                if (Date.now() - parsed.timestamp < CACHE_TTL) return () => { mounted = false }
            }
        } catch { /* ignore */ }
        Papa.parse(LOST_SALE_SHEET_URL, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
                if (!mounted) return
                try {
                    const rawCustomerNames = (result.data as SheetRow[]).map(row => getField(row, "Customer", "Nama Customer")).filter(Boolean) as string[]
                    const customerMapping = normalizeNames(rawCustomerNames)
                    const mapped = parseLostRows(result.data as SheetRow[], customerMapping)
                    setRecords(mapped)
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: mapped }))
                } catch { /* ignore */ }
                setError("")
                setIsLoading(false)
            },
            error: (err) => {
                if (!mounted) return
                setError(err.message)
                setIsLoading(false)
            },
        })
        return () => { mounted = false }
    }, [])

    const options = useMemo(() => ({
        reasons: aggregateCount(records.map((record) => record.reason), 100).map((item) => item.name),
        consultants: aggregateCount(records.map((record) => record.consultant), 100).map((item) => item.name),
        customers: aggregateCount(records.map((record) => record.customer), 100).map((item) => item.name),
    }), [records])

    const filtered = useMemo(() => {
        const query = search.toLowerCase()
        return records.filter((record) => {
            const searchable = [record.customer, record.productDetail, record.remark, record.actionPlan].join(" ").toLowerCase()
            return inDateRange(record.offeringDate, startDate, endDate)
                && (!query || searchable.includes(query))
                && (!reasonFilter.length || reasonFilter.includes(record.reason))
                && (!customerFilter.length || customerFilter.includes(record.customer))
                && (!consultantFilter.length || consultantFilter.includes(record.consultant))
        })
    }, [records, startDate, endDate, search, reasonFilter, customerFilter, consultantFilter])

    const topReason = aggregateCount(filtered.map((record) => record.reason), 1)[0]?.name || "-"
    const topCustomer = aggregateCount(filtered.map((record) => record.customer), 1)[0]?.name || "-"
    const topConsultant = aggregateCount(filtered.map((record) => record.consultant), 1)[0]?.name || "-"
    const reasonChart = useMemo(() => aggregateCount(filtered.map((record) => record.reason), 8).map((item, index) => ({ ...item, fill: BAR_COLORS[index % BAR_COLORS.length] })), [filtered])
    const customerChart = useMemo(() => aggregateCount(filtered.map((record) => record.customer), 8).map((item, index) => ({ ...item, fill: BAR_COLORS[index % BAR_COLORS.length] })), [filtered])
    const productTypeChart = useMemo(() => aggregateCount(filtered.map((record) => record.productType || "Unknown"), 4).map((item, index) => ({ ...item, fill: BAR_COLORS[index % BAR_COLORS.length] })), [filtered])
    const consultantChart = useMemo(() => aggregateCount(filtered.map((record) => record.consultant), 8).map((item, index) => ({ ...item, fill: BAR_COLORS[index % BAR_COLORS.length] })), [filtered])
    const paginatedData = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

    function handlePresetChange(value: DatePreset) {
        setDatePreset(value)
        if (value !== "custom") {
            const range = getDatePresetRange(value)
            setStartDate(range.startDate)
            setEndDate(range.endDate)
        }
        setPage(0)
    }

    function exportCsv() {
        const csv = Papa.unparse(filtered)
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `lost-sale-${format(new Date(), "yyyyMMdd-HHmm")}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    if (isLoading) return <div className="rounded-3xl border bg-white p-10 text-center text-sm text-slate-500 shadow-sm">Loading Lost Sale data...</div>
    if (error) return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Gagal load Lost Sale: {error}</div>

    return (
        <div className="space-y-6">
            <Card className="overflow-hidden border-none bg-white shadow-sm">
                <div className="bg-gradient-to-r from-[#1d5fad] via-[#1f6fbe] to-[#0f4b8f] px-6 py-5 text-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="mb-2 flex flex-wrap gap-2">
                                <Badge className="bg-white text-[#1d5fad] hover:bg-white">Form Response 3</Badge>
                                <Badge className="bg-red-400 text-white hover:bg-red-400">LOST SALE</Badge>
                            </div>
                            <h2 className="text-2xl font-bold">Lost Sale Dashboard</h2>
                            <p className="text-sm text-blue-100">Analisa nilai kehilangan, alasan kalah, competitor yang menang, dan follow-up tanpa action plan.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
                            <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
                        </div>
                    </div>
                </div>
            </Card>

            <Card className="border-0 bg-white shadow-sm shadow-slate-200">
                <CardContent className="p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                            <div className="relative min-w-[240px] flex-1 xl:max-w-[360px]">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Cari customer, product, competitor, action plan..." className="h-10 rounded-xl bg-slate-50 pl-9" />
                            </div>
                            <MultiSelectFilter title="Reason" options={options.reasons} selected={reasonFilter} onChange={setReasonFilter} />
                            <MultiSelectFilter title="Customer" options={options.customers} selected={customerFilter} onChange={setCustomerFilter} />
                            <MultiSelectFilter title="Consultant" options={options.consultants} selected={consultantFilter} onChange={setConsultantFilter} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Select value={datePreset} onValueChange={(value) => handlePresetChange(value as DatePreset)}>
                                <SelectTrigger className="h-10 w-[170px] rounded-xl bg-white"><CalendarDays className="mr-2 h-4 w-4 text-slate-500" /><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="current-year">Tahun berjalan</SelectItem>
                                    <SelectItem value="current-month">Bulan berjalan</SelectItem>
                                    <SelectItem value="last-30-days">30 hari terakhir</SelectItem>
                                    <SelectItem value="all">Semua data</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setDatePreset("custom"); setPage(0) }} className="h-10 w-[150px] rounded-xl" />
                            <Input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setDatePreset("custom"); setPage(0) }} className="h-10 w-[150px] rounded-xl" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ScoreCard title="Lost Records" value={filtered.length.toLocaleString("id-ID")} icon={Target} />
                <ScoreCard title="Top Reason" value={topReason} icon={AlertTriangle} />
                <ScoreCard title="Top Customer" value={topCustomer} icon={TrendingDown} />
                <ScoreCard title="Top Consultant" value={topConsultant} icon={Users} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-0 shadow-sm shadow-slate-200">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Alasan Lost Sale</CardTitle><CardDescription>Jumlah record berdasarkan alasan.</CardDescription></CardHeader>
                    <CardContent className="h-[430px] pr-6">
                        {reasonChart.length ? <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reasonChart} layout="vertical" margin={{ top: 10, right: 38, bottom: 20, left: 130 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis dataKey="name" type="category" width={128} tickFormatter={(value) => shortLabel(String(value), 20)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value) => Number(value)} labelFormatter={(label) => String(label)} />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                                    {reasonChart.map((item) => <Cell key={item.name} fill={item.fill} />)}
                                    <LabelList dataKey="value" position="right" className="fill-slate-700 text-[11px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer> : <EmptyState message="Tidak ada data sesuai filter." />}
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm shadow-slate-200">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Top Customers</CardTitle><CardDescription>Jumlah record berdasarkan customer.</CardDescription></CardHeader>
                    <CardContent className="h-[430px] pr-6">
                        {customerChart.length ? <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={customerChart} layout="vertical" margin={{ top: 10, right: 38, bottom: 20, left: 130 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis dataKey="name" type="category" width={128} tickFormatter={(value) => shortLabel(String(value), 20)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value) => Number(value)} labelFormatter={(label) => String(label)} />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                                    {customerChart.map((item) => <Cell key={item.name} fill={item.fill} />)}
                                    <LabelList dataKey="value" position="right" className="fill-slate-700 text-[11px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer> : <EmptyState message="Tidak ada data sesuai filter." />}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-0 shadow-sm shadow-slate-200">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Product Type</CardTitle><CardDescription>Tipe produk yang lost sale.</CardDescription></CardHeader>
                    <CardContent className="h-[340px] pr-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={productTypeChart} margin={{ top: 24, right: 36, bottom: 70, left: 24 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={88} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[10, 10, 0, 0]}>{productTypeChart.map((item) => <Cell key={item.name} fill={item.fill} />)}<LabelList dataKey="value" position="top" className="fill-slate-700 text-[11px]" /></Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm shadow-slate-200">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Record by Consultant</CardTitle><CardDescription>Jumlah lost sale per business consultant.</CardDescription></CardHeader>
                    <CardContent className="h-[340px] pr-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={consultantChart} margin={{ top: 24, right: 18, bottom: 82, left: 12 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={96} tickFormatter={(value) => shortLabel(String(value), 16)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip labelFormatter={(label) => String(label)} />
                                <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#2563eb"><LabelList dataKey="value" position="top" className="fill-slate-700 text-[11px]" /></Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

            </div>

            <Card className="border-0 shadow-sm shadow-slate-200">
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div><CardTitle className="text-base">Data Detail Lost Sale</CardTitle><CardDescription>{filtered.length.toLocaleString("id-ID")} records • data terbaru di atas • table bisa scroll horizontal.</CardDescription></div>
                        <div className="text-xs text-slate-500">Page {page + 1} / {totalPages}</div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-hidden rounded-2xl border bg-white">
                        <div className="max-h-[620px] overflow-auto">
                            <Table className="min-w-[1750px]">
                                <TableHeader className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                                    <TableRow className="hover:bg-slate-50">
                                        <TableHead className="w-[60px]">No</TableHead>
                                        <TableHead className="w-[160px]">Timestamp</TableHead>
                                        <TableHead className="w-[170px]">Consultant</TableHead>
                                        <TableHead className="w-[150px]">Tipe Produk</TableHead>
                                        <TableHead className="w-[140px]">Tgl Penawaran</TableHead>
                                        <TableHead className="w-[200px]">Customer</TableHead>
                                        <TableHead className="w-[300px]">Detail Produk</TableHead>
                                        <TableHead className="w-[150px]">Reason</TableHead>
                                        <TableHead className="w-[240px]">Remark</TableHead>
                                        <TableHead className="w-[300px]">Action Plan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedData.map((record, index) => (
                                        <TableRow key={record.id} className="align-top hover:bg-blue-50/50">
                                            <TableCell className="text-xs text-slate-500">{page * PAGE_SIZE + index + 1}</TableCell>
                                            <TableCell className="whitespace-nowrap text-xs">{formatDate(record.timestamp)}</TableCell>
                                            <TableCell className="font-medium">{record.consultant || "-"}</TableCell>
                                            <TableCell className="text-xs text-slate-500">{record.productType || "-"}</TableCell>
                                            <TableCell className="whitespace-nowrap text-xs">{formatDate(record.offeringDate)}</TableCell>
                                            <TableCell><div className="font-semibold text-slate-900">{record.customer}</div></TableCell>
                                            <TableCell className="whitespace-normal text-sm leading-relaxed">{record.productDetail}</TableCell>
                                            <TableCell><Badge variant="secondary" className="rounded-full">{record.reason}</Badge></TableCell>
                                            <TableCell className="whitespace-normal text-sm leading-relaxed text-slate-600">{record.remark || "-"}</TableCell>
                                            <TableCell className="whitespace-normal text-sm leading-relaxed text-slate-600">{record.actionPlan || "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" className="rounded-xl" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft className="h-4 w-4" /> Prev</Button>
                        <Button variant="outline" size="sm" className="rounded-xl" disabled={page >= totalPages - 1} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}>Next <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

