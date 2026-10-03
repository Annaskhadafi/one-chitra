"use client"

import { useEffect, useMemo, useState } from "react"
import Papa from "papaparse"
import { format } from "date-fns"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle, CalendarDays, Database, Download, RefreshCw, Search, Tag, Truck, Wallet, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScoreCard } from "@/components/score-card"
import { cleanRepairSize, filterNonRepairRecords, filterRepairRecords, getMonthlyBrandTrendAverage, getMonthlyBrandTrendStats, isRepairRecord } from "./price-competitor-chart-utils"
import { cleanText, normalizeBrand, normalizeNames } from "./utils"

const PRICE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?output=csv&gid=1444121083"
const COLORS = ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#0f766e", "#f97316"]
const LINE_COLORS = ["#dc2626", "#2563eb", "#16a34a", "#9333ea", "#f97316", "#0891b2", "#be123c", "#4f46e5"]
const FOCUS_SIZES = ["27.00R49", "24.00R35", "12.00R24"]

type SheetRow = Record<string, string | undefined>

type PriceRecord = {
    id: string
    timestamp: Date | null
    infoDate: Date | null
    customer: string
    size: string
    brand: string
    category: string
    supplier: string
    currency: string
    price: number
    deliveryPoint: string
    consultant: string
}

type DatePreset = "current-year" | "current-month" | "last-30-days" | "all" | "custom"



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
    const raw = cleanText(value).replace(/[^\d.,-]/g, "")
    if (!raw) return 0
    const dotCount = (raw.match(/\./g) ?? []).length
    const commaCount = (raw.match(/,/g) ?? []).length
    if (dotCount === 1 && commaCount === 0) {
        const parts = raw.split(".")
        if (parts[1].length === 3) {
            const parsed = Number(raw.replace(".", ""))
            return Number.isFinite(parsed) ? parsed : 0
        }
    }
    if (commaCount === 1 && dotCount === 0) {
        const parts = raw.split(",")
        if (parts[1].length === 3) {
            const parsed = Number(raw.replace(",", ""))
            return Number.isFinite(parsed) ? parsed : 0
        }
    }
    if (dotCount > 1 && commaCount === 0) {
        const parsed = Number(raw.replaceAll(".", ""))
        return Number.isFinite(parsed) ? parsed : 0
    }
    if (commaCount > 1 && dotCount === 0) {
        const parsed = Number(raw.replaceAll(",", ""))
        return Number.isFinite(parsed) ? parsed : 0
    }
    const lastComma = raw.lastIndexOf(",")
    const lastDot = raw.lastIndexOf(".")
    const decimalSep = lastComma > lastDot ? "," : "."
    const thousandsSep = decimalSep === "," ? "." : ","
    const canonical = raw.replaceAll(thousandsSep, "").replace(decimalSep, ".")
    const parsed = Number(canonical)
    return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
    if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
    if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
    if (value >= 1_000) return `Rp ${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`
    return `Rp ${value.toLocaleString("id-ID")}`
}

function formatShortNumber(value: number) {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
    if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
    if (value >= 1_000) return `${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`
    return value.toLocaleString("id-ID")
}

function formatDate(value: Date | null) {
    return value ? format(value, "dd MMM yyyy") : "-"
}

function toDateInputValue(value: Date) {
    return format(value, "yyyy-MM-dd")
}

function getDatePresetRange(preset: DatePreset) {
    const now = new Date()
    if (preset === "current-year") {
        return {
            startDate: `${now.getFullYear()}-01-01`,
            endDate: `${now.getFullYear()}-12-31`,
        }
    }
    if (preset === "current-month") {
        return {
            startDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
            endDate: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        }
    }
    if (preset === "last-30-days") {
        const start = new Date(now)
        start.setDate(start.getDate() - 30)
        return {
            startDate: toDateInputValue(start),
            endDate: toDateInputValue(now),
        }
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

function median(values: number[]) {
    const sorted = values.filter((value) => value > 0).sort((a, b) => a - b)
    if (!sorted.length) return 0
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function average(values: number[]) {
    const clean = values.filter((value) => value > 0)
    if (!clean.length) return 0
    return clean.reduce((sum, value) => sum + value, 0) / clean.length
}

function priceStatsBy(records: PriceRecord[], key: keyof Pick<PriceRecord, "brand" | "supplier" | "size" | "customer">, limit = 10) {
    const groups = new Map<string, number[]>()
    records.forEach((record) => {
        const name = cleanText(String(record[key])) || "Unknown"
        groups.set(name, [...(groups.get(name) ?? []), record.price])
    })
    return Array.from(groups.entries())
        .map(([name, prices]) => ({ name, medianPrice: median(prices), averagePrice: average(prices), recordCount: prices.length }))
        .sort((a, b) => b.medianPrice - a.medianPrice)
        .slice(0, limit)
}

function sizeMatches(recordSize: string, targetSize: string) {
    return cleanText(recordSize).toUpperCase() === targetSize.toUpperCase()
}

function priceSpread(values: number[]) {
    const clean = values.filter((value) => value > 0)
    if (!clean.length) return 0
    return Math.max(...clean) - Math.min(...clean)
}

function buildSizeAnalysis(records: PriceRecord[], targetSize: string) {
    const rows = records.filter((record) => sizeMatches(record.size, targetSize))
    const prices = rows.map((record) => record.price).filter((price) => price > 0)
    const supplierDistribution = aggregate(rows.map((record) => record.supplier), 8)
    const brandDistribution = aggregate(rows.map((record) => record.brand), 8)
    const cheapest = rows.filter((record) => record.price > 0).sort((a, b) => a.price - b.price)[0]
    const premium = rows.filter((record) => record.price > 0).sort((a, b) => b.price - a.price)[0]

    return {
        size: targetSize,
        rows,
        recordCount: rows.length,
        supplierCount: new Set(rows.map((record) => record.supplier).filter(Boolean)).size,
        brandCount: new Set(rows.map((record) => record.brand).filter(Boolean)).size,
        medianPrice: median(prices),
        minPrice: prices.length ? Math.min(...prices) : 0,
        maxPrice: prices.length ? Math.max(...prices) : 0,
        spread: priceSpread(prices),
        cheapest,
        premium,
        supplierDistribution,
        brandDistribution,
    }
}

function formatMonthKey(date: Date | null) {
    return date ? format(date, "yyyy-MM") : ""
}

function buildMonthlyBrandTrend(records: PriceRecord[], targetSize: string) {
    const sizeRows = records.filter((record) => sizeMatches(record.size, targetSize) && record.price > 0 && record.infoDate)
    const topBrands = aggregate(sizeRows.map((record) => record.brand), 5).map((item) => item.name)
    const monthSet = new Set<string>()
    const groups = new Map<string, number[]>()

    sizeRows.forEach((record) => {
        const month = formatMonthKey(record.infoDate)
        if (!month || !topBrands.includes(record.brand)) return
        monthSet.add(month)
        const key = `${month}__${record.brand}`
        groups.set(key, [...(groups.get(key) ?? []), record.price])
    })

    const data = Array.from(monthSet).sort().map((month) => {
        const row: Record<string, string | number | null> = { month }
        topBrands.forEach((brand) => {
            const value = median(groups.get(`${month}__${brand}`) ?? [])
            row[brand] = value || null
        })
        return row
    })

    return { size: targetSize, brands: topBrands, data }
}

function buildMonthlySizeTrend(records: PriceRecord[], activeSizes: string[]) {
    const monthSet = new Set<string>()
    const groups = new Map<string, number[]>()

    records.forEach((record) => {
        const month = formatMonthKey(record.infoDate)
        const matchedSize = activeSizes.find((size) => sizeMatches(record.size, size))
        if (!month || !matchedSize || record.price <= 0) return
        monthSet.add(month)
        const key = `${month}__${matchedSize}`
        groups.set(key, [...(groups.get(key) ?? []), record.price])
    })

    return Array.from(monthSet).sort().map((month) => {
        const row: Record<string, string | number | null> = { month }
        activeSizes.forEach((size) => {
            const value = median(groups.get(`${month}__${size}`) ?? [])
            row[size] = value || null
        })
        return row
    })
}

function getSeriesTrend(data: Record<string, string | number | null>[], key: string) {
    const points = data
        .map((row) => Number(row[key] ?? 0))
        .filter((value) => Number.isFinite(value) && value > 0)
    if (points.length < 2) {
        return { direction: "flat", delta: 0, first: points[0] ?? 0, last: points[0] ?? 0 }
    }
    const first = points[0]
    const last = points[points.length - 1]
    const delta = first ? ((last - first) / first) * 100 : 0
    return {
        direction: delta > 1 ? "up" : delta < -1 ? "down" : "flat",
        delta,
        first,
        last,
    }
}

function TrendBadge({
    label,
    trend,
    color,
    priceStats,
}: {
    label: string
    trend: ReturnType<typeof getSeriesTrend>
    color: string
    priceStats?: ReturnType<typeof getMonthlyBrandTrendStats>
}) {
    const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"
    const tone = trend.direction === "up"
        ? "bg-red-50 text-red-700 border-red-200"
        : trend.direction === "down"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-slate-50 text-slate-700 border-slate-200"

    return (
        <div className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm ${tone}`}>
            <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{label}</span>
            </div>
            <div className="mt-1 text-sm">
                {arrow} {Math.abs(trend.delta).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
            </div>
            {priceStats && priceStats.average > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-1 border-t pt-2 text-[10px] leading-tight text-slate-600">
                    <div>
                        <p className="font-medium text-slate-500">Min</p>
                        <p className="font-semibold text-slate-800">{formatShortNumber(priceStats.min)}</p>
                    </div>
                    <div>
                        <p className="font-medium text-slate-500">Avg</p>
                        <p className="font-semibold text-slate-800">{formatShortNumber(priceStats.average)}</p>
                    </div>
                    <div>
                        <p className="font-medium text-slate-500">Max</p>
                        <p className="font-semibold text-slate-800">{formatShortNumber(priceStats.max)}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

function renderPieLabel({ name, percent, value }: { name?: string; percent?: number; value?: number }) {
    if (!percent || percent < 0.08) return ""
    return `${name ?? ""} ${value ?? 0} (${(percent * 100).toFixed(0)}%)`
}

function parsePriceRows(rows: SheetRow[], companyMapping: Record<string, string>) {
    return rows.map((row, index): PriceRecord | null => {
        const rawCustomer = cleanText(row["Nama Customer"] || row.Customer)
        const size = cleanText(row["Size Tire / Product"] || row["Size Tire"] || row["Size"] || row["Tire Size"]).replace(/\s+/g, "")
        const brand = cleanText(row.Brand)
        const rawSupplier = cleanText(row.Supplier)
        if (!rawCustomer || !size || !brand) return null
        return {
            id: `price-${index}`,
            timestamp: parseDateValue(row.Timestamp),
            infoDate: parseDateValue(row["Tanggal Informasi"]) || parseDateValue(row.Timestamp),
            customer: companyMapping[rawCustomer] || rawCustomer,
            size,
            brand: normalizeBrand(brand),
            category: cleanText(row["Category Tire"] || row.Category),
            supplier: companyMapping[rawSupplier] || rawSupplier,
            currency: cleanText(row.Currency) || "IDR",
            price: parseMoney(row.PRICE || row.Price),
            deliveryPoint: cleanText(row["Remark / Delivery Drop Point"] || row.Remark),
            consultant: cleanText(row["Business Consultant"] || row.Consultant),
        }
    }).filter(Boolean).sort((a, b) => {
        const dateA = a?.infoDate?.getTime() ?? 0
        const dateB = b?.infoDate?.getTime() ?? 0
        return dateB - dateA
    }) as PriceRecord[]
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

export function PriceCompetitorDashboard() {
    const [records, setRecords] = useState<PriceRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")
    const [search, setSearch] = useState("")
    const initialYearRange = getDatePresetRange("current-year")
    const [datePreset, setDatePreset] = useState<DatePreset>("current-year")
    const [startDate, setStartDate] = useState(initialYearRange.startDate)
    const [endDate, setEndDate] = useState(initialYearRange.endDate)
    const [brandFilter, setBrandFilter] = useState<string[]>([])
    const [supplierFilter, setSupplierFilter] = useState<string[]>([])
    const [categoryFilter, setCategoryFilter] = useState<string[]>([])
    const [sizeFilter, setSizeFilter] = useState<string[]>([])
    const [excludeRepairFromCharts, setExcludeRepairFromCharts] = useState(true)

    const loadData = async () => {
        setIsLoading(true)
        setError("")
        try {
            const response = await fetch(PRICE_SHEET_URL, { cache: "no-store" })
            if (!response.ok) throw new Error("Gagal memuat Form Response 1")
            const csv = await response.text()
            const parsed = Papa.parse<SheetRow>(csv, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) => header.trim(),
            })
            
            const rawCompanyNames = [
                ...parsed.data.map(row => cleanText(row["Nama Customer"])),
                ...parsed.data.map(row => cleanText(row.Supplier))
            ].filter(Boolean) as string[]
            const companyMapping = normalizeNames(rawCompanyNames)

            setRecords(parsePriceRows(parsed.data, companyMapping))
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
        brands: aggregate(records.map((record) => record.brand), 200).map((item) => item.name),
        suppliers: aggregate(records.map((record) => record.supplier), 200).map((item) => item.name),
        categories: aggregate(records.map((record) => record.category), 50).map((item) => item.name),
        sizes: aggregate(records.map((record) => record.size), 300).map((item) => item.name),
    }), [records])

    const filtered = useMemo(() => {
        const query = search.toLowerCase()
        return records.filter((record) => {
            const matchesSearch = [record.customer, record.size, record.brand, record.supplier, record.consultant, record.deliveryPoint].join(" ").toLowerCase().includes(query)
            return matchesSearch
                && (!brandFilter.length || brandFilter.includes(record.brand))
                && (!supplierFilter.length || supplierFilter.includes(record.supplier))
                && (!categoryFilter.length || categoryFilter.includes(record.category))
                && (!sizeFilter.length || sizeFilter.includes(record.size))
                && inDateRange(record.infoDate, startDate, endDate)
        }).sort((a, b) => (b.infoDate?.getTime() ?? 0) - (a.infoDate?.getTime() ?? 0))
    }, [records, search, brandFilter, supplierFilter, categoryFilter, sizeFilter, startDate, endDate])

    const handleDatePresetChange = (preset: DatePreset) => {
        setDatePreset(preset)
        if (preset === "custom") return
        const range = getDatePresetRange(preset)
        setStartDate(range.startDate)
        setEndDate(range.endDate)
    }

    // Pisahkan dataset untuk visualisasi/grafik harga ban baru (mengecualikan repair)
    const chartFiltered = useMemo(() => {
        if (!excludeRepairFromCharts) return filtered
        return filterNonRepairRecords(filtered)
    }, [filtered, excludeRepairFromCharts])

    const chartAllRecords = useMemo(() => {
        if (!excludeRepairFromCharts) return records
        return filterNonRepairRecords(records)
    }, [records, excludeRepairFromCharts])

    const prices = chartFiltered.map((record) => record.price).filter((price) => price > 0)
    const supplierCount = new Set(filtered.map((record) => record.supplier).filter(Boolean)).size
    const sizeCount = new Set(filtered.map((record) => record.size).filter(Boolean)).size
    const brandCount = new Set(filtered.map((record) => record.brand).filter(Boolean)).size

    const medianBySupplier = useMemo(() => priceStatsBy(chartFiltered, "supplier", 10), [chartFiltered])
    const medianByBrand = useMemo(() => priceStatsBy(chartFiltered, "brand", 8), [chartFiltered])
    const medianBySize = useMemo(() => priceStatsBy(chartFiltered, "size", 12), [chartFiltered])
    const brandDistribution = useMemo(() => aggregate(chartFiltered.map((record) => record.brand), 7), [chartFiltered])
    const consultantRecords = useMemo(() => aggregate(chartFiltered.map((record) => record.consultant), 12), [chartFiltered])
    const historyPrice = useMemo(() => priceStatsBy(chartFiltered, "customer", 10), [chartFiltered])
    
    const activeSizes = useMemo(() => sizeFilter.length > 0 ? sizeFilter : FOCUS_SIZES, [sizeFilter])

    const focusSizeAnalysis = useMemo(() => activeSizes.map((size) => buildSizeAnalysis(chartFiltered, size)), [chartFiltered, activeSizes])
    const focusSizeSummary = useMemo(() => focusSizeAnalysis.map((item) => ({
        name: item.size,
        medianPrice: item.medianPrice,
        minPrice: item.minPrice,
        maxPrice: item.maxPrice,
        spread: item.spread,
        recordCount: item.recordCount,
        supplierCount: item.supplierCount,
    })), [focusSizeAnalysis])
    const monthlySizeTrend = useMemo(() => buildMonthlySizeTrend(chartAllRecords, activeSizes), [chartAllRecords, activeSizes])
    const monthlyBrandTrends = useMemo(() => activeSizes.map((size) => buildMonthlyBrandTrend(chartAllRecords, size)), [chartAllRecords, activeSizes])

    // Dedicated Dataset & Calculations for Separate Repair Charts
    const repairRecords = useMemo(() => {
        const fromFiltered = filterRepairRecords(filtered)
        return fromFiltered.length > 0 ? fromFiltered : filterRepairRecords(records)
    }, [filtered, records])

    const repairPrices = useMemo(() => repairRecords.map((r) => r.price).filter((p) => p > 0), [repairRecords])
    const repairSupplierCount = useMemo(() => new Set(repairRecords.map((r) => r.supplier).filter(Boolean)).size, [repairRecords])

    const repairBySize = useMemo(() => {
        const groups = new Map<string, number[]>()
        repairRecords.forEach((record) => {
            const cleanSize = cleanRepairSize(record.size) || "Unknown"
            groups.set(cleanSize, [...(groups.get(cleanSize) ?? []), record.price])
        })
        return Array.from(groups.entries())
            .map(([name, sizePrices]) => ({
                name,
                medianPrice: median(sizePrices),
                averagePrice: average(sizePrices),
                minPrice: Math.min(...sizePrices),
                maxPrice: Math.max(...sizePrices),
                recordCount: sizePrices.length,
            }))
            .sort((a, b) => a.medianPrice - b.medianPrice)
    }, [repairRecords])

    const repairBySupplier = useMemo(() => {
        const counts = repairRecords.reduce<Record<string, number>>((acc, r) => {
            const key = cleanText(r.supplier) || "Unknown"
            acc[key] = (acc[key] ?? 0) + 1
            return acc
        }, {})
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [repairRecords])

    const repair27R49Records = useMemo(() => {
        return repairRecords.filter((r) => cleanRepairSize(r.size) === "27.00R49" || r.size.includes("27.00R49"))
    }, [repairRecords])


    const exportCsv = () => {
        const csv = Papa.unparse(filtered)
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `price-competitor-${format(new Date(), "yyyyMMdd-HHmm")}.csv`
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
                                <Badge className="bg-white text-[#1d5fad] hover:bg-white">Form Response 1</Badge>
                                <Badge className="bg-yellow-300 text-slate-900 hover:bg-yellow-300">PRICE COMPETITOR</Badge>
                            </div>
                            <h2 className="text-2xl font-bold">Price Competitor Dashboard</h2>
                            <p className="text-sm text-blue-100">Analisa supplier, brand, size tire, median price, history price, dan update price dari Google Sheet.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={loadData} disabled={isLoading}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                            <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={exportCsv}>
                                <Download className="mr-2 h-4 w-4" />
                                Export
                            </Button>
                        </div>
                    </div>
                </div>
                <CardContent className="p-5">
                    {error && (
                        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            <AlertTriangle className="h-4 w-4" />
                            {error}
                        </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <ScoreCard title="Supplier" value={isLoading ? "..." : supplierCount} icon={Truck} description="Unique supplier" />
                        <ScoreCard title="Size Tire" value={isLoading ? "..." : sizeCount} icon={Database} description="Unique size tire" gradient="from-indigo-500/10 via-blue-400/5 to-cyan-500/10 border-indigo-200/50" iconColor="text-indigo-600" textColor="text-indigo-900" />
                        <ScoreCard title="Brand" value={isLoading ? "..." : brandCount} icon={Tag} description="Unique brand" gradient="from-purple-500/10 via-purple-400/5 to-pink-500/10 border-purple-200/50" iconColor="text-purple-600" textColor="text-purple-900" />
                        <ScoreCard title="Median Price" value={isLoading ? "..." : formatMoney(median(prices))} icon={Wallet} description={`Average ${formatMoney(average(prices))}`} gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50" iconColor="text-emerald-600" textColor="text-emerald-900" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base">Filter Price Competitor</CardTitle>
                            <CardDescription>Date range pakai kolom `Tanggal Informasi` dari Form Response 1.</CardDescription>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                            <Checkbox
                                checked={excludeRepairFromCharts}
                                onCheckedChange={(checked) => setExcludeRepairFromCharts(Boolean(checked))}
                            />
                            <span>Kecualikan Ban/Jasa Repair di Grafik</span>
                        </label>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-4 xl:grid-cols-9">
                    <div className="relative md:col-span-2">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Cari customer, supplier, brand, size..." value={search} onChange={(event) => setSearch(event.target.value)} />
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
                    <MultiSelectFilter title="Brand" options={options.brands} selected={brandFilter} onChange={setBrandFilter} />
                    <MultiSelectFilter title="Supplier" options={options.suppliers} selected={supplierFilter} onChange={setSupplierFilter} />
                    <MultiSelectFilter title="Size Tire" options={options.sizes} selected={sizeFilter} onChange={setSizeFilter} />
                    <MultiSelectFilter title="Category" options={options.categories} selected={categoryFilter} onChange={setCategoryFilter} />
                    <Button variant="outline" onClick={() => { const range = getDatePresetRange("current-year"); setSearch(""); setDatePreset("current-year"); setStartDate(range.startDate); setEndDate(range.endDate); setBrandFilter([]); setSupplierFilter([]); setCategoryFilter([]); setSizeFilter([]) }}>
                        Reset
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base">Data Detail</CardTitle>
                            <CardDescription>{filtered.length} record price competitor setelah filter.</CardDescription>
                        </div>
                        {excludeRepairFromCharts && (
                            <span className="text-xs text-muted-foreground">
                                * Data repair tetap tercatat di tabel, namun otomatis dikecualikan dari grafik harga ban baru
                            </span>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="max-h-[520px] overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
                            <TableRow>
                                <TableHead>Tanggal Informasi</TableHead><TableHead>Business Consultant</TableHead><TableHead>Size Tire</TableHead><TableHead>Nama Customer</TableHead><TableHead>Brand</TableHead><TableHead>Supplier</TableHead><TableHead>Remark / Drop Point</TableHead><TableHead>Price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.slice(0, 150).map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell>{formatDate(record.infoDate)}</TableCell>
                                    <TableCell className="font-medium">{record.consultant || "-"}</TableCell>
                                    <TableCell>{record.size}</TableCell>
                                    <TableCell>{record.customer}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant="outline">{record.brand}</Badge>
                                            {isRepairRecord(record) && (
                                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0 font-normal">
                                                    Repair
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{record.supplier}</TableCell>
                                    <TableCell className="max-w-[240px] whitespace-normal">{record.deliveryPoint || "-"}</TableCell>
                                    <TableCell>{formatMoney(record.price)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                    <CardHeader>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-base">Analisa Fokus Tire Size: 27.00R49, 24.00R35, 12.00R24</CardTitle>
                                <CardDescription>Ringkasan market price range untuk size utama management (khusus ban baru).</CardDescription>
                            </div>
                            {excludeRepairFromCharts && (
                                <Badge variant="outline" className="w-fit text-[11px] text-emerald-700 bg-emerald-50 border-emerald-200">
                                    Ban Baru (Tanpa Repair)
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={focusSizeSummary}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value, name) => name === "recordCount" || name === "supplierCount" ? Number(value).toLocaleString("id-ID") : formatMoney(Number(value))} />
                                <Legend />
                                <Bar dataKey="minPrice" name="Min Price" fill="#93c5fd" radius={[6, 6, 0, 0]}>
                                    <LabelList dataKey="minPrice" position="top" formatter={(value: number) => formatShortNumber(value)} className="fill-slate-700 text-[10px]" />
                                </Bar>
                                <Bar dataKey="medianPrice" name="Median Price" fill="#1d4ed8" radius={[6, 6, 0, 0]}>
                                    <LabelList dataKey="medianPrice" position="top" formatter={(value: number) => formatShortNumber(value)} className="fill-slate-700 text-[10px]" />
                                </Bar>
                                <Bar dataKey="maxPrice" name="Max Price" fill="#f97316" radius={[6, 6, 0, 0]}>
                                    <LabelList dataKey="maxPrice" position="top" formatter={(value: number) => formatShortNumber(value)} className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Sales / BC Paling Sering Update</CardTitle>
                        <CardDescription>Jumlah record update dari Business Consultant.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[340px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={consultantRecords} layout="vertical" margin={{ top: 10, right: 40, bottom: 10, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="value" name="Record Count" fill="#0891b2" radius={[0, 8, 8, 0]}>
                                    <LabelList dataKey="value" position="right" className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                {focusSizeAnalysis.map((analysis) => (
                    <Card key={analysis.size}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Supplier Distribution {analysis.size}</CardTitle>
                                {excludeRepairFromCharts && (
                                    <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                                        Ban Baru
                                    </Badge>
                                )}
                            </div>
                            <CardDescription>
                                {analysis.recordCount} records · {analysis.supplierCount} suppliers · {analysis.brandCount} brands
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg bg-blue-50 p-3">
                                    <p className="text-xs text-blue-700">Median</p>
                                    <p className="font-semibold text-blue-950">{formatMoney(analysis.medianPrice)}</p>
                                </div>
                                <div className="rounded-lg bg-orange-50 p-3">
                                    <p className="text-xs text-orange-700">Spread</p>
                                    <p className="font-semibold text-orange-950">{formatMoney(analysis.spread)}</p>
                                </div>
                                <div className="rounded-lg bg-emerald-50 p-3">
                                    <p className="text-xs text-emerald-700">Termurah</p>
                                    <p className="font-semibold text-emerald-950">{analysis.cheapest ? `${analysis.cheapest.brand} · ${formatMoney(analysis.cheapest.price)}` : "-"}</p>
                                </div>
                                <div className="rounded-lg bg-purple-50 p-3">
                                    <p className="text-xs text-purple-700">Tertinggi</p>
                                    <p className="font-semibold text-purple-950">{analysis.premium ? `${analysis.premium.brand} · ${formatMoney(analysis.premium.price)}` : "-"}</p>
                                </div>
                            </div>
                            <div className="h-[360px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart margin={{ top: 28, right: 42, bottom: 70, left: 42 }}>
                                        <Pie
                                            data={analysis.supplierDistribution}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="42%"
                                            outerRadius={86}
                                            label={renderPieLabel}
                                            labelLine
                                        >
                                            {analysis.supplierDistribution.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={64} wrapperStyle={{ fontSize: 11, lineHeight: "16px" }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                    <CardHeader><CardTitle className="text-base">Median Price Competitor</CardTitle></CardHeader>
                    <CardContent className="h-[330px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={medianBySupplier} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                                <Bar dataKey="medianPrice" name="Median Price" fill="#1d5fad" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="medianPrice" position="top" formatter={(value: number) => formatShortNumber(value)} className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Grafik Supplier</CardTitle></CardHeader>
                    <CardContent className="h-[330px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 28, right: 42, bottom: 70, left: 42 }}>
                                <Pie data={brandDistribution} dataKey="value" nameKey="name" cx="50%" cy="42%" innerRadius={52} outerRadius={82} label={renderPieLabel} labelLine>
                                    {brandDistribution.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={64} wrapperStyle={{ fontSize: 11, lineHeight: "16px" }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-base">Median Price by Brand</CardTitle></CardHeader>
                    <CardContent className="h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={medianByBrand} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                                <Bar dataKey="medianPrice" name="Median Price" fill="#2563eb" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="medianPrice" position="top" formatter={(value: number) => formatShortNumber(value)} className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">History Price by Customer</CardTitle></CardHeader>
                    <CardContent className="h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={historyPrice} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                                <Bar dataKey="averagePrice" name="Average Price" fill="#0ea5e9" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="averagePrice" position="top" formatter={(value: number) => formatShortNumber(value)} className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle className="text-base">Data Record by Consultant</CardTitle></CardHeader>
                    <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={consultantRecords} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
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
                <Card>
                    <CardHeader><CardTitle className="text-base">Price Update by Size Tire</CardTitle></CardHeader>
                    <CardContent className="h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={medianBySize} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                                <Bar dataKey="medianPrice" name="Median Price" fill="#16a34a" radius={[8, 8, 0, 0]}>
                                    <LabelList dataKey="medianPrice" position="top" formatter={(value: number) => formatShortNumber(value)} className="fill-slate-700 text-[10px]" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <CardTitle className="text-base">Trend Harga Competitor Bulanan - by Size</CardTitle>
                            <CardDescription>
                                Median harga competitor tiap bulan untuk size yang dipilih (default: 3 Size Utama{excludeRepairFromCharts ? ", ban baru" : ""}). Grafik ini memakai seluruh data API, tidak mengikuti filter date range.
                            </CardDescription>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {activeSizes.map((size, index) => (
                                <TrendBadge
                                    key={size}
                                    label={size}
                                    trend={getSeriesTrend(monthlySizeTrend, size)}
                                    color={LINE_COLORS[index % LINE_COLORS.length]}
                                />
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="h-[430px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlySizeTrend} margin={{ top: 28, right: 36, bottom: 32, left: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" angle={-35} textAnchor="end" interval={0} height={76} tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(value) => formatMoney(Number(value))} />
                            <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 12 }} />
                            {activeSizes.map((size, index) => (
                                <Line
                                    key={size}
                                    type="monotone"
                                    dataKey={size}
                                    stroke={LINE_COLORS[index % LINE_COLORS.length]}
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                    connectNulls
                                >
                                    <LabelList dataKey={size} position="top" formatter={(value: number) => value ? formatShortNumber(value) : ""} className="fill-slate-700 text-[10px]" />
                                </Line>
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="grid gap-4">
                {monthlyBrandTrends.map((trend) => {
                    const averagePrice = getMonthlyBrandTrendAverage(trend.data, trend.brands)

                    return (
                    <Card key={trend.size}>
                        <CardHeader>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <CardTitle className="text-base">Pergerakan Harga Bulanan by Brand - {trend.size}</CardTitle>
                                    <CardDescription>
                                        Median harga per bulan untuk top brand pada size {trend.size}{excludeRepairFromCharts ? " (hanya ban baru)" : ""}. Grafik ini memakai seluruh data API, tidak mengikuti filter date range.
                                    </CardDescription>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    {trend.brands.slice(0, 6).map((brand, index) => (
                                        <TrendBadge
                                            key={`${trend.size}-${brand}-trend`}
                                            label={brand}
                                            trend={getSeriesTrend(trend.data, brand)}
                                            color={LINE_COLORS[index % LINE_COLORS.length]}
                                            priceStats={getMonthlyBrandTrendStats(trend.data, brand)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="h-[420px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trend.data} margin={{ top: 28, right: 32, bottom: 28, left: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" angle={-35} textAnchor="end" interval={0} height={76} tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                                    <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 11 }} />
                                    {averagePrice > 0 && (
                                        <ReferenceLine
                                            y={averagePrice}
                                            stroke="#334155"
                                            strokeDasharray="6 4"
                                            strokeWidth={2}
                                            ifOverflow="extendDomain"
                                            label={{
                                                value: `Average ${formatShortNumber(averagePrice)}`,
                                                position: "insideTopRight",
                                                fill: "#334155",
                                                fontSize: 11,
                                                fontWeight: 600,
                                            }}
                                        />
                                    )}
                                    {trend.brands.map((brand, index) => (
                                        <Line
                                            key={`${trend.size}-${brand}`}
                                            type="monotone"
                                            dataKey={brand}
                                            stroke={LINE_COLORS[index % LINE_COLORS.length]}
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            connectNulls
                                        >
                                            <LabelList dataKey={brand} position="top" formatter={(value: number) => value ? formatShortNumber(value) : ""} className="fill-slate-700 text-[10px]" />
                                        </Line>
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    )
                })}
            </div>

            {/* Dedicated Repair Tires & Service Analysis Section */}
            <Card className="overflow-hidden border border-amber-200/80 bg-gradient-to-b from-amber-50/20 via-white to-white shadow-sm">
                <div className="border-b border-amber-200/70 bg-gradient-to-r from-amber-700 via-amber-800 to-orange-800 px-6 py-4 text-white">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 text-xs font-bold">
                                    GRAFIK TERPISAH
                                </Badge>
                                <Badge className="bg-amber-900/50 text-amber-200 border-amber-600/40 text-xs">
                                    JASA & BAN REPAIR
                                </Badge>
                            </div>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Wrench className="h-5 w-5 text-amber-300" />
                                Analisa & Grafik Khusus Jasa Repair Ban
                            </h3>
                            <p className="text-xs text-amber-100">
                                Benchmark perbaikan / reparasi ban (termasuk 27.00R49 dan tire size lainnya) dipisahkan dari grafik harga ban baru.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3.5 py-2 border border-white/10">
                            <Wrench className="h-4 w-4 text-amber-300" />
                            <div>
                                <p className="text-[10px] text-amber-200 font-medium uppercase tracking-wider">Total Record Repair</p>
                                <p className="text-lg font-bold text-white leading-tight">{repairRecords.length} record</p>
                            </div>
                        </div>
                    </div>
                </div>

                <CardContent className="p-6 space-y-6">
                    {/* Ringkasan Biaya Repair */}
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                            <p className="text-xs font-medium text-amber-700">Median Biaya Repair</p>
                            <p className="text-xl font-bold text-amber-950 mt-1">{formatMoney(median(repairPrices))}</p>
                            <p className="text-[11px] text-amber-600/90 mt-1">Rata-rata: {formatMoney(average(repairPrices))}</p>
                        </div>
                        <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                            <p className="text-xs font-medium text-orange-700">Rentang Tarif Repair</p>
                            <p className="text-xl font-bold text-orange-950 mt-1">
                                {repairPrices.length ? `${formatShortNumber(Math.min(...repairPrices))} - ${formatShortNumber(Math.max(...repairPrices))}` : "-"}
                            </p>
                            <p className="text-[11px] text-orange-600/90 mt-1">Spread: {formatMoney(priceSpread(repairPrices))}</p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                            <p className="text-xs font-medium text-amber-700">Supplier Jasa Repair</p>
                            <p className="text-xl font-bold text-amber-950 mt-1">{repairSupplierCount} Vendor</p>
                            <p className="text-[11px] text-amber-600/90 mt-1">Penyedia perbaikan ban</p>
                        </div>
                        <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                            <p className="text-xs font-medium text-orange-700">Repair 27.00R49 Record</p>
                            <p className="text-xl font-bold text-orange-950 mt-1">{repair27R49Records.length} record</p>
                            <p className="text-[11px] text-orange-600/90 mt-1">Mulai {formatMoney(7_200_000)} / pcs</p>
                        </div>
                    </div>

                    {/* Grafik 1: Perbandingan Biaya Repair per Ukuran Ban & Grafik 2: Distribusi Vendor */}
                    <div className="grid gap-6 xl:grid-cols-3">
                        <Card className="xl:col-span-2 border-slate-200 shadow-none">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold text-slate-800">
                                    Grafik Tarif Jasa Repair per Ukuran Ban
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Median estimasi biaya jasa repair ban (TBR Dump Truck hingga OTR Giant HD)
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="h-[340px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={repairBySize} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} />
                                        <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} />
                                        <Tooltip formatter={(value) => formatMoney(Number(value))} />
                                        <Bar dataKey="medianPrice" name="Median Tarif Repair" fill="#d97706" radius={[6, 6, 0, 0]}>
                                            <LabelList dataKey="medianPrice" position="top" formatter={(value: number) => formatShortNumber(value)} className="fill-amber-900 text-[10px] font-semibold" />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-none">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold text-slate-800">
                                    Vendor / Supplier Jasa Repair
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Distribusi record supplier penyedia jasa repair
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="h-[340px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart margin={{ top: 20, right: 30, bottom: 60, left: 30 }}>
                                        <Pie
                                            data={repairBySupplier}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="44%"
                                            outerRadius={78}
                                            innerRadius={44}
                                            label={renderPieLabel}
                                            labelLine
                                        >
                                            {repairBySupplier.map((item, index) => (
                                                <Cell key={item.name} fill={["#d97706", "#f59e0b", "#b45309", "#0284c7", "#0d9488"][index % 5]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={56} wrapperStyle={{ fontSize: 11, lineHeight: "16px" }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Benchmark Khusus 27.00R49 Repair vs Ban Baru */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 pb-3 border-b border-amber-200/60">
                            <div>
                                <h4 className="text-base font-bold text-amber-950 flex items-center gap-2">
                                    <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-[11px]">Special Focus</Badge>
                                    Rincian Jasa Repair Ukuran 27.00R49
                                </h4>
                                <p className="text-xs text-amber-800/80 mt-0.5">
                                    Perbandingan penawaran jasa perbaikan 27.00R49 dari berbagai vendor (alasan dipisahkan dari ban baru seharga Rp 118 jt - Rp 236 jt)
                                </p>
                            </div>
                            <span className="text-xs font-semibold text-amber-900 bg-amber-100 px-3 py-1 rounded-full w-fit">
                                {repair27R49Records.length} Record Ditemukan
                            </span>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                            {repair27R49Records.map((r) => (
                                <div key={r.id} className="rounded-lg border border-amber-200/80 bg-white p-4 shadow-sm hover:border-amber-400 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <Badge variant="outline" className="border-amber-300 text-amber-900 font-semibold text-xs">
                                            {r.brand}
                                        </Badge>
                                        <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            {formatMoney(r.price)}
                                        </span>
                                    </div>
                                    <div className="mt-3 space-y-1 text-xs">
                                        <p className="text-slate-600"><span className="font-medium text-slate-800">Supplier:</span> {r.supplier}</p>
                                        <p className="text-slate-600"><span className="font-medium text-slate-800">Customer:</span> {r.customer}</p>
                                        <p className="text-slate-600"><span className="font-medium text-slate-800">Keterangan:</span> {r.deliveryPoint || "-"}</p>
                                        <p className="text-slate-400 text-[10px] pt-1">Tanggal: {formatDate(r.infoDate)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

