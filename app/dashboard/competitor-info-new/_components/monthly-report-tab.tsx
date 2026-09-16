"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Papa from "papaparse"
import { format } from "date-fns"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Sankey, Tooltip, XAxis, YAxis } from "recharts"
import { Bot, CalendarDays, Download, FileText, Loader2, RefreshCw, Sparkles, Target, Trophy, Users } from "lucide-react"
import { toast } from "sonner"

import { generateCompetitorMonthlyReportInsight } from "@/app/actions/competitor-new"
import { getExternalPricesForMonthlyCollapse, getRmiWeights, getLostSaleStockMatch } from "@/app/actions/rmi-dashboard"
import { getSlowMovingDashboardData, SlowMovingDashboardResult } from "@/app/actions/slow-moving-dashboard"
import { getA2RCompetitionData } from "@/app/actions/a2r-competition"
import { getProcurementNextAnalytics } from "@/app/actions/procurement-next"
import { getFleetList } from "@/app/actions/fleet"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cleanText, normalizeBrand, normalizeNames } from "./utils"

const PRICE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?output=csv&gid=1444121083"
const ACTIVITY_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?output=csv&gid=98214477"
const LOST_SALE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?output=csv&gid=1550828239"
const BAR_COLORS = ["#0f4c81", "#f97316", "#16a34a", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04", "#be123c"]
const FOCUS_SIZES = ["27.00R49", "24.00R35", "12.00R24"]
const EXPORT_SLIDE_WIDTH = 1350
const EXPORT_SLIDE_HEIGHT = 760
const PDF_PAGE_WIDTH = 960
const PDF_PAGE_HEIGHT = 540
const EXPORT_SLIDE_STYLE: Partial<CSSStyleDeclaration> = {
    width: `${EXPORT_SLIDE_WIDTH}px`,
    height: `${EXPORT_SLIDE_HEIGHT}px`,
    minWidth: `${EXPORT_SLIDE_WIDTH}px`,
    maxWidth: "none",
    margin: "0",
    left: "0",
    right: "auto",
    transform: "none",
    boxSizing: "border-box",
}
const SEGMENT_TEMPLATE = [
    { segment: "Extra Large", priceRange: "140-180 jt", brands: "Goodyear, Bridgestone", sizes: "27.00R49" },
    { segment: "Large", priceRange: "60-109 jt", brands: "Maxam, Bridgestone, Tiberplus", sizes: "24.00R35, 33.25R29" },
    { segment: "Medium", priceRange: "30-55 jt", brands: "Advance, Bridgestone, Aeolus", sizes: "29.5R25, 20.5R25, 18.00R33" },
    { segment: "Small", priceRange: "4.1-7 jt", brands: "Advance, Bridgestone", sizes: "12.00R24" },
]

type SheetRow = Record<string, string | undefined>
type ChartDatum = { name: string; value: number }
type MatrixRow = { customer: string; rowMedian: string; sortValue: number } & Record<string, string | number>
type SupplierCustomerFlow = { supplier: string; customer: string; value: number; medianPrice: number }

type PriceRecord = {
    id: string
    infoDate: Date | null
    customer: string
    size: string
    brand: string
    supplier: string
    remark: string
    price: number
    consultant: string
}

type ActivityRecord = {
    id: string
    infoDate: Date | null
    consultant: string
    competitor: string
    activityType: string
    customer: string
    industry: string
    location: string
    marketResponse: string
    businessImpact: string
    strategy: string
    description: string
}

type LostSaleRecord = {
    id: string
    offeringDate: Date | null
    consultant: string
    customer: string
    productDetail: string
    reason: string
    remark: string
    actionPlan: string
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
    const raw = cleanText(value).replace(/IDR/gi, "").replace(/[^\d.,-]/g, "")
    if (!raw) return 0
    const dotCount = (raw.match(/\./g) ?? []).length
    const commaCount = (raw.match(/,/g) ?? []).length
    if (dotCount === 1 && commaCount === 0) {
        const parts = raw.split(".")
        if (parts[1].length === 3) return Number(raw.replace(".", "")) || 0
    }
    if (commaCount === 1 && dotCount === 0) {
        const parts = raw.split(",")
        if (parts[1].length === 3) return Number(raw.replace(",", "")) || 0
    }
    if (dotCount > 1 && commaCount === 0) return Number(raw.replaceAll(".", "")) || 0
    if (commaCount > 1 && dotCount === 0) return Number(raw.replaceAll(",", "")) || 0
    const lastComma = raw.lastIndexOf(",")
    const lastDot = raw.lastIndexOf(".")
    const decimalSep = lastComma > lastDot ? "," : "."
    const thousandsSep = decimalSep === "," ? "." : ","
    return Number(raw.replaceAll(thousandsSep, "").replace(decimalSep, ".")) || 0
}

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

function aggregate(values: string[], limit = 8): ChartDatum[] {
    const counts = values.reduce<Record<string, number>>((acc, value) => {
        const key = cleanText(value) || "Unknown"
        acc[key] = (acc[key] ?? 0) + 1
        return acc
    }, {})
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit)
}

function chunkArray<T>(items: T[], size: number) {
    const chunks: T[][] = []
    for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
    return chunks
}

function paginateByWeight<T>(items: T[], maxUnits: number, getWeight: (item: T) => number) {
    const pages: T[][] = []
    let page: T[] = []
    let units = 0

    items.forEach((item) => {
        const weight = Math.max(1, getWeight(item))
        if (page.length && units + weight > maxUnits) {
            pages.push(page)
            page = []
            units = 0
        }
        page.push(item)
        units += weight
    })

    if (page.length) pages.push(page)
    return pages
}

function textWeight(...values: string[]) {
    const longest = Math.max(0, ...values.map((value) => cleanText(value).length))
    return Math.max(1, Math.ceil(longest / 110))
}

function median(values: number[]) {
    const sorted = values.filter((value) => value > 0).sort((a, b) => a - b)
    if (!sorted.length) return 0
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function formatMoney(value: number) {
    if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
    if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
    if (value >= 1_000) return `Rp ${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`
    return `Rp ${value.toLocaleString("id-ID")}`
}

function formatUSD(value: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function currentMonthKey() {
    const today = new Date()
    return format(new Date(today.getFullYear(), today.getMonth() - 1, 1), "yyyy-MM")
}

function waitForExportFrame() {
    return new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.setTimeout(resolve, 0))
    })
}

function monthLabel(monthKey: string) {
    const [year, month] = monthKey.split("-").map(Number)
    return format(new Date(year, month - 1, 1), "MMMM yyyy")
}

function sameMonth(date: Date | null, monthKey: string) {
    return Boolean(date && format(date, "yyyy-MM") === monthKey)
}

function formatDateLabel(date: Date | null) {
    return date ? format(date, "dd MMM yyyy") : "-"
}

function shortLabel(value: string, maxLength = 24) {
    if (!value) return "Unknown"
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}

function sizeMatches(recordSize: string, targetSize: string) {
    return cleanText(recordSize).replace(/\s+/g, "").toUpperCase() === targetSize.toUpperCase()
}

function sizeSegment(size: string, price: number) {
    const normalized = cleanText(size).replace(/\s+/g, "").toUpperCase()
    if (normalized.includes("27.00R49") || price >= 140_000_000) return "Extra Large"
    if (normalized.includes("24.00R35") || normalized.includes("33.25R29") || price >= 60_000_000) return "Large"
    if (price >= 30_000_000) return "Medium"
    return "Small"
}

function formatPercent(value: number) {
    return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("id-ID").format(value)
}

function formatCompactCurrency(value: number) {
    if (!value) return ""
    return new Intl.NumberFormat("id-ID", { notation: "compact", style: "currency", currency: "IDR", maximumFractionDigits: 1 }).format(value)
}

function formatCompactQty(value: number) {
    if (!value) return ""
    return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

function formatRupiahAxis(value: number) {
    const formatter = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    if (Math.abs(value) >= 1_000_000_000) return `Rp ${formatter.format(value / 1_000_000_000)} Miliar`
    if (Math.abs(value) >= 1_000_000) return `Rp ${formatter.format(value / 1_000_000)} Juta`
    return formatCurrency(value)
}

function medianPriceByBrand(records: PriceRecord[], targetSize: string) {
    const groups = new Map<string, number[]>()
    records.filter((row) => sizeMatches(row.size, targetSize) && row.price > 0).forEach((row) => {
        const key = row.brand || "Unknown"
        groups.set(key, [...(groups.get(key) ?? []), row.price])
    })
    return Array.from(groups.entries())
        .map(([name, values]) => ({ name, value: median(values), count: values.length }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
}

function customerSupplierMatrix(records: PriceRecord[], targetSize: string) {
    const cellPrices = new Map<string, number[]>()
    const customerPrices = new Map<string, number[]>()
    const supplierCounts = new Map<string, number>()

    records.filter((row) => sizeMatches(row.size, targetSize) && row.price > 0).forEach((row) => {
        const customer = row.customer || "Unknown"
        const supplier = row.supplier || row.brand || "Unknown"
        const cellKey = `${customer}__${supplier}`
        cellPrices.set(cellKey, [...(cellPrices.get(cellKey) ?? []), row.price])
        customerPrices.set(customer, [...(customerPrices.get(customer) ?? []), row.price])
        supplierCounts.set(supplier, (supplierCounts.get(supplier) ?? 0) + 1)
    })

    const suppliers = Array.from(supplierCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([supplier]) => supplier)
        .slice(0, 5)

    const rows = Array.from(customerPrices.entries())
        .map(([customer, prices]): MatrixRow => {
            const row: MatrixRow = { customer, rowMedian: formatMoney(median(prices)), sortValue: prices.length }
            suppliers.forEach((supplier) => {
                const value = median(cellPrices.get(`${customer}__${supplier}`) ?? [])
                row[supplier] = value ? formatMoney(value) : "-"
            })
            return row
        })
        .sort((a, b) => Number(b.sortValue) - Number(a.sortValue))
        .slice(0, 8)
    return { suppliers, rows }
}

function supplierDistribution(records: PriceRecord[]) {
    const total = records.length || 1
    return aggregate(records.map((row) => row.supplier), 10).map((row) => ({
        ...row,
        percent: (row.value / total) * 100,
        label: `${shortLabel(row.name, 18)} ${formatPercent((row.value / total) * 100)}`,
    }))
}

function supplierDistributionBySize(records: PriceRecord[], targetSize: string) {
    const rows = records.filter((row) => sizeMatches(row.size, targetSize))
    const prices = rows.map((row) => row.price).filter((price) => price > 0)
    const sortedByPrice = rows.filter((row) => row.price > 0).sort((a, b) => a.price - b.price)
    const distribution = supplierDistribution(rows).slice(0, 8)
    const cheapest = sortedByPrice[0]
    const highest = sortedByPrice[sortedByPrice.length - 1]

    return {
        rows,
        distribution,
        recordCount: rows.length,
        supplierCount: new Set(rows.map((row) => row.supplier).filter(Boolean)).size,
        brandCount: new Set(rows.map((row) => row.brand).filter(Boolean)).size,
        medianPrice: median(prices),
        spread: prices.length ? Math.max(...prices) - Math.min(...prices) : 0,
        cheapestLabel: cheapest ? `${cheapest.brand || cheapest.supplier} - ${formatMoney(cheapest.price)}` : "-",
        highestLabel: highest ? `${highest.brand || highest.supplier} - ${formatMoney(highest.price)}` : "-",
    }
}

function supplierCustomerFlowsBySize(records: PriceRecord[], targetSize: string): SupplierCustomerFlow[] {
    const groups = new Map<string, { supplier: string; customer: string; prices: number[]; value: number }>()
    records.filter((row) => sizeMatches(row.size, targetSize)).forEach((row) => {
        const supplier = row.supplier || row.brand || "Unknown"
        const customer = row.customer || "Unknown"
        const key = `${supplier}__${customer}`
        const existing = groups.get(key) ?? { supplier, customer, prices: [], value: 0 }
        existing.value += 1
        if (row.price > 0) existing.prices.push(row.price)
        groups.set(key, existing)
    })

    return Array.from(groups.values())
        .map((row) => ({ supplier: row.supplier, customer: row.customer, value: row.value, medianPrice: median(row.prices) }))
        .sort((a, b) => b.value - a.value || b.medianPrice - a.medianPrice)
        .slice(0, targetSize === "12.00R24" ? 3 : 5)
}

function buildMonthlyPriceTrend(records: PriceRecord[]) {
    const groups = new Map<string, number[]>()
    const monthSet = new Set<string>()
    records.forEach((row) => {
        if (!row.infoDate || row.price <= 0) return
        const matchedSize = FOCUS_SIZES.find((size) => sizeMatches(row.size, size))
        if (!matchedSize) return
        const monthKey = format(row.infoDate, "yyyy-MM")
        monthSet.add(monthKey)
        const key = `${monthKey}__${matchedSize}`
        groups.set(key, [...(groups.get(key) ?? []), row.price])
    })

    return Array.from(monthSet).sort().map((key) => {
        const row: Record<string, string | number | null> = { month: key }
        FOCUS_SIZES.forEach((size) => {
            const value = median(groups.get(`${key}__${size}`) ?? [])
            row[size] = value || null
        })
        return row
    })
}

function buildMonthlyBrandTrend(records: PriceRecord[], targetSize: string) {
    const sizeRows = records.filter((row) => sizeMatches(row.size, targetSize) && row.price > 0 && row.infoDate)
    const brands = aggregate(sizeRows.map((row) => row.brand || row.supplier), 5).map((row) => row.name)
    const groups = new Map<string, number[]>()
    const monthSet = new Set<string>()

    sizeRows.forEach((row) => {
        if (!row.infoDate) return
        const brand = row.brand || row.supplier || "Unknown"
        if (!brands.includes(brand)) return
        const monthKey = format(row.infoDate, "yyyy-MM")
        monthSet.add(monthKey)
        const key = `${monthKey}__${brand}`
        groups.set(key, [...(groups.get(key) ?? []), row.price])
    })

    const data = Array.from(monthSet).sort().map((key) => {
        const row: Record<string, string | number | null> = { month: key }
        brands.forEach((brand) => {
            const value = median(groups.get(`${key}__${brand}`) ?? [])
            row[brand] = value || null
        })
        return row
    })

    return { brands, data }
}

function getSeriesStats(data: Record<string, string | number | null>[], key: string) {
    const values = data
        .map((row) => Number(row[key] ?? 0))
        .filter((value) => Number.isFinite(value) && value > 0)
    if (!values.length) return { min: 0, avg: 0, max: 0, delta: 0, direction: "flat" as const }
    const first = values[0]
    const last = values[values.length - 1]
    const delta = first ? ((last - first) / first) * 100 : 0
    return {
        min: Math.min(...values),
        avg: values.reduce((sum, value) => sum + value, 0) / values.length,
        max: Math.max(...values),
        delta,
        direction: delta > 0 ? "up" as const : delta < 0 ? "down" as const : "flat" as const,
    }
}

function getTrendStats(data: Record<string, string | number | null>[], size: string) {
    return getSeriesStats(data, size)
}

function getBrandTrendStats(data: Record<string, string | number | null>[], brand: string) {
    return getSeriesStats(data, brand)
}

function averageVisibleTrendValue(data: Record<string, string | number | null>[], keys: string[]) {
    const values = data.flatMap((row) => keys.map((key) => Number(row[key] ?? 0))).filter((value) => Number.isFinite(value) && value > 0)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function tableCell(value: string | number | undefined) {
    return value ? String(value) : "-"
}

function parsePriceRows(rows: SheetRow[]) {
    const rawCompanyNames = [
        ...rows.map((row) => cleanText(row["Nama Customer"])),
        ...rows.map((row) => cleanText(row.Supplier)),
    ].filter(Boolean) as string[]
    const companyMapping = normalizeNames(rawCompanyNames)

    return rows.map((row, index): PriceRecord | null => {
        const rawCustomer = cleanText(row["Nama Customer"] || row.Customer)
        const size = cleanText(row["Size Tire / Product"] || row["Size Tire"] || row["Size"] || row["Tire Size"]).replace(/\s+/g, "")
        const brand = cleanText(row.Brand)
        const rawSupplier = cleanText(row.Supplier)
        if (!rawCustomer || !size || !brand) return null
        return {
            id: `price-${index}`,
            infoDate: parseDateValue(row["Tanggal Informasi"]) || parseDateValue(row.Timestamp),
            customer: companyMapping[rawCustomer] || rawCustomer,
            size,
            brand: normalizeBrand(brand),
            supplier: companyMapping[rawSupplier] || rawSupplier,
            remark: getField(row, "Remark / Delivery Drop Point", "Remark / DDP", "Remark/DDP", "Remark", "DDP"),
            price: parseMoney(row.PRICE || row.Price),
            consultant: cleanText(row["Business Consultant"] || row.Consultant),
        }
    }).filter((row): row is PriceRecord => Boolean(row))
}

function parseActivityRows(rows: SheetRow[]) {
    return rows.map((row, index): ActivityRecord | null => {
        const competitor = cleanText(row.Competitor)
        const activityType = cleanText(row["Jenis Aktivitas"])
        if (!competitor || !activityType) return null
        return {
            id: `activity-${index}`,
            infoDate: parseDateValue(row["Tanggal Informasi"]),
            consultant: cleanText(row["Business Consultant"]),
            competitor,
            activityType,
            customer: cleanText(row.Customer),
            industry: cleanText(row["Industri / Kategori"]),
            location: cleanText(row.Lokasi),
            marketResponse: cleanText(row["Respon Pasar"]),
            businessImpact: cleanText(row["Perkiraan Pengaruh ke Bisnis"]),
            strategy: cleanText(row["Strategi yang bisa di terapkan   (Re"]),
            description: cleanText(row["Deskripsi Competitor Activity"]),
        }
    }).filter((row): row is ActivityRecord => Boolean(row))
}

function parseLostRows(rows: SheetRow[]) {
    const rawCustomerNames = rows.map((row) => getField(row, "Customer", "Nama Customer")).filter(Boolean) as string[]
    const customerMapping = normalizeNames(rawCustomerNames)

    return rows.map((row, index): LostSaleRecord | null => {
        const rawCustomer = getField(row, "Customer", "Nama Customer")
        const productDetail = getField(row, "Detail Produk")
        if (!rawCustomer || !productDetail) return null
        return {
            id: `lost-${index}`,
            offeringDate: parseDateValue(getField(row, "Tanggal Penawaran")),
            consultant: getField(row, "Business Consultant", "Sales", "Konsultan"),
            customer: customerMapping[rawCustomer] || rawCustomer,
            productDetail,
            reason: getField(row, "Penyebab Lost Sale", "Alasan") || "OTHER",
            remark: getField(row, "Remark", "Catatan"),
            actionPlan: getField(row, "Action Plan"),
        }
    }).filter((row): row is LostSaleRecord => Boolean(row))
}

async function fetchCsv<T>(url: string, parser: (rows: SheetRow[]) => T[]) {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) throw new Error(`Gagal memuat data ${response.status}`)
    const csv = await response.text()
    const parsed = Papa.parse<SheetRow>(csv, { header: true, skipEmptyLines: true, transformHeader: (header) => header.trim() })
    return parser(parsed.data)
}

function MetricTile({ icon: Icon, label, value, note }: { icon: typeof Trophy; label: string; value: string | number; note: string }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[#0f4c81]/10 p-2 text-[#0f4c81]"><Icon className="h-5 w-5" /></div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="text-2xl font-bold text-slate-950">{value}</p>
                </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">{note}</p>
        </div>
    )
}

function Slide({ children, eyebrow, title }: { children: React.ReactNode; eyebrow: string; title: string }) {
    return (
        <section className="monthly-report-slide relative h-[760px] w-full overflow-hidden rounded-lg border border-slate-200 bg-[#f8fafc] p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
            <div className="absolute left-0 top-0 h-2 w-full bg-[#0f4c81]" />
            <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f97316]">{eyebrow}</p>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h2>
                </div>
                <Badge className="bg-[#0f4c81] text-white hover:bg-[#0f4c81]">Monthly Report</Badge>
            </div>
            {children}
        </section>
    )
}

function EmptySlideState({ message }: { message: string }) {
    return <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">{message}</div>
}

function ReportTable({ children }: { children: React.ReactNode }) {
    return (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-[11px] text-slate-700">
                {children}
            </table>
        </div>
    )
}

function TableHeadCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <th className={`border-b border-slate-200 bg-[#0f4c81] px-3 py-2 font-bold text-white ${className}`}>{children}</th>
}

function TableCellCompact({ children, className = "", colSpan, title }: { children: React.ReactNode; className?: string; colSpan?: number; title?: string }) {
    return <td colSpan={colSpan} title={title} className={`border-b border-slate-100 px-3 py-2 align-top ${className}`}>{children}</td>
}


function InsightList({ items, tone = "blue" }: { items: string[]; tone?: "blue" | "orange" }) {
    const color = tone === "orange" ? "text-[#f97316]" : "text-[#0f4c81]"
    return (
        <div className="space-y-3">
            {items.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-lg border bg-white p-3 text-sm leading-relaxed text-slate-700 shadow-sm">
                    <span className={`mr-2 font-black ${color}`}>{index + 1}.</span>{item}
                </div>
            ))}
        </div>
    )
}

function TrendStatCard({ stat, color }: { stat: ReturnType<typeof getTrendStats> & { size: string }; color: string }) {
    const arrow = stat.direction === "up" ? "↑" : stat.direction === "down" ? "↓" : "→"
    const tone = stat.direction === "up"
        ? "border-red-200 bg-red-50 text-red-700"
        : stat.direction === "down"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50 text-slate-700"

    return (
        <div className={`min-w-[118px] rounded-lg border px-3 py-2 shadow-sm ${tone}`}>
            <div className="flex items-center gap-2 text-[11px] font-black">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{stat.size}</span>
            </div>
            <div className="mt-1 text-sm font-black">{arrow} {Math.abs(stat.delta).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</div>
            <div className="mt-2 grid grid-cols-3 gap-1 border-t border-current/15 pt-1.5 text-[9px] leading-tight">
                <div><p className="font-semibold opacity-70">Min</p><p className="font-black">{formatMoney(stat.min)}</p></div>
                <div><p className="font-semibold opacity-70">Avg</p><p className="font-black">{formatMoney(stat.avg)}</p></div>
                <div><p className="font-semibold opacity-70">Max</p><p className="font-black">{formatMoney(stat.max)}</p></div>
            </div>
        </div>
    )
}

function BrandTrendStatCard({ stat, color }: { stat: ReturnType<typeof getBrandTrendStats> & { brand: string }; color: string }) {
    const arrow = stat.direction === "up" ? "↑" : stat.direction === "down" ? "↓" : "→"
    const tone = stat.direction === "up"
        ? "border-red-200 bg-red-50 text-red-700"
        : stat.direction === "down"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50 text-slate-700"

    return (
        <div className={`rounded-lg border px-2.5 py-2 shadow-sm ${tone}`}>
            <div className="flex min-w-0 items-center gap-2 text-[10px] font-black leading-tight">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="truncate" title={stat.brand}>{stat.brand}</span>
                <span className="ml-auto shrink-0 text-xs">{arrow} {Math.abs(stat.delta).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</span>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1 border-t border-current/15 pt-1.5 text-[9px] leading-tight">
                <div><p className="font-semibold opacity-70">Min</p><p className="font-black">{formatMoney(stat.min)}</p></div>
                <div><p className="font-semibold opacity-70">Avg</p><p className="font-black">{formatMoney(stat.avg)}</p></div>
                <div><p className="font-semibold opacity-70">Max</p><p className="font-black">{formatMoney(stat.max)}</p></div>
            </div>
        </div>
    )
}

function MonthlyBrandTrendPanel({ size, trend, stats }: { size: string; trend: ReturnType<typeof buildMonthlyBrandTrend>; stats: Array<ReturnType<typeof getBrandTrendStats> & { brand: string }> }) {
    const average = averageVisibleTrendValue(trend.data, trend.brands)

    return (
        <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-black text-slate-900">Pergerakan Harga Bulanan by Brand - {size}</p>
                    <p className="text-[10px] text-slate-500">Median harga per bulan untuk top brand pada size ini, dari seluruh data Price Competitor.</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">Label harga cetak</Badge>
            </div>
            <div className="grid grid-cols-[1fr_265px] gap-3">
                <div className="h-[330px] min-w-0 rounded-lg bg-slate-50 px-2 pt-2">
                    {trend.data.length && trend.brands.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trend.data} margin={{ top: 18, right: 26, left: 0, bottom: 2 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={42} />
                                <YAxis width={48} tick={{ fontSize: 10 }} tickFormatter={(value) => `${Number(value) / 1_000_000} jt`} />
                                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                {average ? <ReferenceLine y={average} stroke="#64748b" strokeDasharray="4 4" label={{ value: `Avg ${formatMoney(average)}`, position: "insideTopLeft", fontSize: 10, fill: "#475569" }} /> : null}
                                {trend.brands.map((brand, index) => (
                                    <Line key={brand} type="monotone" dataKey={brand} stroke={BAR_COLORS[index % BAR_COLORS.length]} strokeWidth={2.2} dot={{ r: 3 }} activeDot={{ r: 4 }} connectNulls>
                                        <LabelList dataKey={brand} position="top" formatter={(value: number) => value ? formatMoney(value).replace("Rp ", "") : ""} style={{ fontSize: 9, fontWeight: 700, fill: "#0f172a" }} />
                                    </Line>
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <EmptySlideState message={`Tidak ada trend harga bulanan by brand untuk ${size}.`} />}
                </div>
                <div className="grid content-start gap-1.5">
                    {stats.slice(0, 4).map((stat, index) => <BrandTrendStatCard key={stat.brand} stat={stat} color={BAR_COLORS[index % BAR_COLORS.length]} />)}
                </div>
            </div>
        </div>
    )
}

function SupplierCustomerSankeyPanel({ size, flows }: { size: string; flows: SupplierCustomerFlow[] }) {
    const supplierNames = Array.from(new Set(flows.map((flow) => flow.supplier)))
    const customerNames = Array.from(new Set(flows.map((flow) => flow.customer)))
    const nodes = [
        ...supplierNames.map((name, index) => ({ name: `supplier-${name}`, label: name, role: "Supplier", color: BAR_COLORS[index % BAR_COLORS.length] })),
        ...customerNames.map((name, index) => ({ name: `customer-${name}`, label: name, role: "Customer", color: BAR_COLORS[(index + 3) % BAR_COLORS.length] })),
    ]
    const nodeIndex = new Map(nodes.map((node, index) => [node.name, index]))
    const links = flows.flatMap((flow) => {
        const source = nodeIndex.get(`supplier-${flow.supplier}`)
        const target = nodeIndex.get(`customer-${flow.customer}`)
        if (source === undefined || target === undefined) return []
        return [{ source, target, value: Math.max(flow.value, 1), medianPrice: flow.medianPrice, supplier: flow.supplier, customer: flow.customer }]
    })
    const sankeyData = { nodes, links }

    const renderNode = (props: any) => {
        const { x, y, width, height, payload } = props
        const isSupplier = payload.role === "Supplier"
        const labelX = isSupplier ? x + width + 6 : x - 6
        const anchor = isSupplier ? "start" : "end"

        return (
            <g>
                <rect x={x} y={y} width={width} height={height} fill={payload.color} fillOpacity={0.95} rx={1.5} />
                <text x={labelX} y={y + height / 2 - 3} textAnchor={anchor} fill="#334155" fontSize={9} fontWeight={700} dominantBaseline="middle">
                    {shortLabel(payload.label, 22)}
                </text>
                <text x={labelX} y={y + height / 2 + 9} textAnchor={anchor} fill="#64748b" fontSize={8} dominantBaseline="middle">
                    {payload.role}
                </text>
            </g>
        )
    }

    const renderLink = (props: any) => {
        const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload, index } = props
        const color = BAR_COLORS[index % BAR_COLORS.length]
        return (
            <path
                d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
                fill="none"
                stroke={color}
                strokeOpacity={0.34}
                strokeWidth={Math.max(linkWidth, 4)}
                aria-label={`${payload.supplier} supply ke ${payload.customer}`}
            />
        )
    }

    const renderTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: any; name?: string; value?: number }> }) => {
        if (!active || !payload?.length) return null
        const item = payload[0]?.payload?.payload ?? payload[0]?.payload
        if (!item?.supplier || !item?.customer) return null
        return (
            <div className="rounded-lg border bg-white px-3 py-2 text-[11px] text-slate-700 shadow-lg">
                <p className="font-black text-slate-900">{shortLabel(item.supplier, 24)} → {shortLabel(item.customer, 24)}</p>
                <p>{item.value} data supply</p>
                {item.medianPrice ? <p>Median: {formatMoney(item.medianPrice)}</p> : null}
            </div>
        )
    }

    return (
        <div className="flex h-full min-w-0 flex-col">
            <div className="mb-3 text-center text-base font-black text-blue-600">{size}</div>
            <div className="min-h-0 flex-1 rounded-lg bg-slate-50 p-2">
                {links.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <Sankey
                            data={sankeyData}
                            dataKey="value"
                            nameKey="label"
                            node={renderNode}
                            link={renderLink}
                            nodePadding={18}
                            nodeWidth={8}
                            iterations={48}
                            sort={false}
                            margin={{ top: 8, right: 58, bottom: 8, left: 58 }}
                        >
                            <Tooltip content={renderTooltip} />
                        </Sankey>
                    </ResponsiveContainer>
                ) : <EmptySlideState message={`Tidak ada Sankey supplier-customer untuk ${size}.`} />}
            </div>
        </div>
    )
}

function PriceStatBox({ label, value, tone }: { label: string; value: string; tone: "blue" | "orange" | "green" | "purple" }) {
    const toneClass = {
        blue: "bg-blue-50 text-blue-800",
        orange: "bg-orange-50 text-orange-800",
        green: "bg-emerald-50 text-emerald-800",
        purple: "bg-purple-50 text-purple-800",
    }[tone]

    return (
        <div className={`min-h-[54px] rounded-lg p-2.5 ${toneClass}`}>
            <p className="text-[10px] font-semibold uppercase leading-none tracking-wide">{label}</p>
            <p className="mt-1 line-clamp-2 text-[11px] font-black leading-snug">{value}</p>
        </div>
    )
}

function SupplierDistributionPanel({ size, data }: { size: string; data: ReturnType<typeof supplierDistributionBySize> }) {
    return (
        <div className="flex h-full flex-col rounded-lg border bg-white p-3 shadow-sm">
            <div className="mb-2">
                <p className="text-sm font-black text-slate-900">Supplier Distribution {size}</p>
                <p className="text-[11px] text-slate-500">{data.recordCount} records - {data.supplierCount} suppliers - {data.brandCount} brands</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <PriceStatBox label="Median" value={formatMoney(data.medianPrice)} tone="blue" />
                <PriceStatBox label="Spread" value={formatMoney(data.spread)} tone="orange" />
                <PriceStatBox label="Termurah" value={data.cheapestLabel} tone="green" />
                <PriceStatBox label="Tertinggi" value={data.highestLabel} tone="purple" />
            </div>
            <div className="mt-3 grid min-h-0 flex-1 grid-cols-[0.76fr_1.24fr] gap-3">
                <div className="flex min-h-0 flex-col rounded-lg bg-slate-50 p-2">
                    <p className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">Chart</p>
                    <div className="h-[132px]">
                        {data.distribution.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.distribution} dataKey="value" nameKey="name" innerRadius={30} outerRadius={54} paddingAngle={2}>{data.distribution.map((_, index) => <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />)}</Pie><Tooltip formatter={(value, _name, entry) => [`${value} data (${formatPercent(Number(entry.payload.percent))})`, entry.payload.name]} /></PieChart></ResponsiveContainer> : <EmptySlideState message={`Tidak ada distribusi supplier ${size}.`} />}
                    </div>
                    <p className="text-center text-[10px] font-semibold text-slate-600">Supplier share by record count</p>
                </div>
                <div className="min-h-0 overflow-hidden rounded-lg border border-slate-100">
                    <div className="bg-slate-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Supplier Share</div>
                    <div className="space-y-1.5 p-2">
                        {data.distribution.slice(0, 6).map((row, index) => (
                            <div key={row.name} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 rounded bg-white px-1.5 py-1 text-[10px] leading-tight text-slate-700 shadow-sm">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }} />
                                <span className="truncate" title={row.name}>{row.name}</span>
                                <b>{row.value} / {formatPercent(row.percent)}</b>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function MonthlyReportTab() {
    const [month, setMonth] = useState(currentMonthKey())
    const [prices, setPrices] = useState<PriceRecord[]>([])
    const [activities, setActivities] = useState<ActivityRecord[]>([])
    const [lostSales, setLostSales] = useState<LostSaleRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isExporting, setIsExporting] = useState(false)
    const [exportProgress, setExportProgress] = useState({ current: 0, total: 0, message: "" })
    const [isAiLoading, setIsAiLoading] = useState(false)
    const [error, setError] = useState("")
    const [aiInsights, setAiInsights] = useState<string[]>([])
    const [rmiMonthlyData, setRmiMonthlyData] = useState<Record<string, {
        monthIndex: number
        monthName: string
        naturalRubber: number
        syntheticRubber: number
        carbonBlack: number
        steelCord: number
        freight: number
    }[]>>({})
    const [rmiWeights, setRmiWeights] = useState<{
        naturalRubberWeight: number
        syntheticRubberWeight: number
        carbonBlackWeight: number
        steelCordWeight: number
        freightWeight: number
        fxWeight: number
        basePeriodNaturalRubber: number
        basePeriodSyntheticRubber: number
        basePeriodCarbonBlack: number
        basePeriodSteelCord: number
        basePeriodFreight: number
        basePeriodExchangeRate: number
    } | null>(null)
    const [lostSaleStockData, setLostSaleStockData] = useState<{
        lostItems: Array<{
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
            matchedStock: Array<{
                materialNo: string
                materialDesc: string
                totalQty: number
                totalValue: number
                currency: string
            }>
            hasMatch: boolean
        }>
        topCustomers: Array<{
            customerName: string
            totalValue: number
            totalQty: number
            itemCount: number
            categories: Record<string, { value: number; qty: number; count: number }>
        }>
        readyStockCount: number
        totalLost: number
        totalMatched: number
        totalUnmatched: number
        totalValue: number
    } | null>(null)
    const [slowMovingData, setSlowMovingData] = useState<SlowMovingDashboardResult | null>(null)
    const [a2rData, setA2RData] = useState<any>(null)
    const [procurementData, setProcurementData] = useState<any>(null)
    const [fleetData, setFleetData] = useState<any[]>([])
    const slideRefs = useRef<Array<HTMLElement | null>>([]);

    const loadData = async () => {
        setIsLoading(true)
        setError("")
        try {
            const [priceRows, activityRows, lostRows] = await Promise.all([
                fetchCsv(PRICE_SHEET_URL, parsePriceRows),
                fetchCsv(ACTIVITY_SHEET_URL, parseActivityRows),
                fetchCsv(LOST_SALE_SHEET_URL, parseLostRows),
            ])
            setPrices(priceRows)
            setActivities(activityRows)
            setLostSales(lostRows)
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Gagal memuat report")
        } finally {
            setIsLoading(false)
        }
        // Load RMI monthly data (non-blocking)
        try {
            const rmiRes = await getExternalPricesForMonthlyCollapse()
            if (rmiRes.success && rmiRes.data) {
                setRmiMonthlyData(rmiRes.data as Record<string, {
                    monthIndex: number
                    monthName: string
                    naturalRubber: number
                    syntheticRubber: number
                    carbonBlack: number
                    steelCord: number
                    freight: number
                }[]>)
            }
        } catch {
            // RMI data is optional for this slide
        }
        // Load RMI weights (non-blocking)
        try {
            const wRes = await getRmiWeights()
            if (wRes.success && wRes.data) {
                const d = wRes.data as any
                setRmiWeights({
                    naturalRubberWeight: parseFloat(d.naturalRubberWeight),
                    syntheticRubberWeight: parseFloat(d.syntheticRubberWeight),
                    carbonBlackWeight: parseFloat(d.carbonBlackWeight),
                    steelCordWeight: parseFloat(d.steelCordWeight),
                    freightWeight: parseFloat(d.freightWeight),
                    fxWeight: parseFloat(d.fxWeight),
                    basePeriodNaturalRubber: parseFloat(d.basePeriodNaturalRubber),
                    basePeriodSyntheticRubber: parseFloat(d.basePeriodSyntheticRubber),
                    basePeriodCarbonBlack: parseFloat(d.basePeriodCarbonBlack),
                    basePeriodSteelCord: parseFloat(d.basePeriodSteelCord),
                    basePeriodFreight: parseFloat(d.basePeriodFreight),
                    basePeriodExchangeRate: parseFloat(d.basePeriodExchangeRate),
                })
            }
        } catch {
            // Weights data is optional
        }
        // Load Lost Sale + Stock Match data (non-blocking)
        try {
            const lsRes = await getLostSaleStockMatch()
            if (lsRes?.success && lsRes.data) {
                setLostSaleStockData(lsRes.data as any)
            }
        } catch {
            // Lost sale data is optional
        }
        // Load Slow Moving data (non-blocking)
        try {
            const smData = await getSlowMovingDashboardData(["2025", "2026"], "ALL", "ALL", month)
            setSlowMovingData(smData)
        } catch (e) {
            console.error("Slow moving data load failed:", e)
        }
        // Load A2R Competition data for current month (non-blocking)
        try {
            const [yearStr, monthStr] = month.split("-")
            const a2rData = await getA2RCompetitionData({ year: parseInt(yearStr), months: [monthStr] })
            if (a2rData?.success && a2rData.data) {
                setA2RData(a2rData.data)
            }
        } catch (e) {
            console.error("A2R Competition data load failed:", e)
        }
        // Load Fleet List data (non-blocking)
        try {
            const result = await getFleetList()
            if (result.success && Array.isArray(result.data)) {
                setFleetData(result.data)
            }
        } catch (e) {
            console.error("Fleet list data load failed:", e)
        }

    }

    useEffect(() => {
        void Promise.resolve().then(loadData)
    }, [])

    // Re-fetch slow moving data when month changes
    useEffect(() => {
        if (!month) return
        let cancelled = false
        void (async () => {
            try {
                const smData = await getSlowMovingDashboardData(["2025", "2026"], "ALL", "ALL", month)
                if (!cancelled) setSlowMovingData(smData)
            } catch {
                // optional
            }
        })()
        return () => { cancelled = true }
    }, [month])

    // Re-fetch A2R Competition data when month changes
    useEffect(() => {
        if (!month) return
        let cancelled = false
        void (async () => {
            try {
                const [yearStr, monthStr] = month.split("-")
                const a2rData = await getA2RCompetitionData({ year: parseInt(yearStr), months: [monthStr] })
                if (!cancelled && a2rData?.success && a2rData.data) {
                    setA2RData(a2rData.data)
                }
            } catch {
                // optional
            }
        })()
        return () => { cancelled = true }
    }, [month])

    // Re-fetch Fleet List data when month changes
    useEffect(() => {
        if (!month) return
        let cancelled = false
        void (async () => {
            try {
                const result = await getFleetList()
                if (!cancelled && result.success && Array.isArray(result.data)) {
                    setFleetData(result.data)
                }
            } catch {
                // optional
            }
        })()
        return () => { cancelled = true }
    }, [month])

    // Fetch Procurement data on mount
    useEffect(() => {
        let cancelled = false
        void (async () => {
            try {
                console.log("[Procurement] fetching...")
                const res = await getProcurementNextAnalytics({ horizonMonths: 6, chartGranularity: "monthly", forecastingAlgorithm: "moving_average" })
                console.log("[Procurement] result:", res?.success, res?.data?.items?.length)
                if (!cancelled && res?.success && res.data) {
                    setProcurementData(res.data)
                }
            } catch (e) {
                console.error("[Procurement] error:", e)
            }
        })()
        return () => { cancelled = true }
    }, [])

    const report = useMemo(() => {
        const monthPrices = prices.filter((row) => sameMonth(row.infoDate, month))
        const monthActivities = activities.filter((row) => sameMonth(row.infoDate, month))
        const monthLostSales = lostSales.filter((row) => sameMonth(row.offeringDate, month))
        const priceValues = monthPrices.map((row) => row.price).filter((value) => value > 0)
        const topSizes = aggregate(monthPrices.map((row) => row.size), 8)
        const topBrands = aggregate(monthPrices.map((row) => row.brand), 8)
        const topSuppliers = aggregate(monthPrices.map((row) => row.supplier), 8)
        const topCompetitors = aggregate(monthActivities.map((row) => row.competitor), 200)
        const activityTypes = aggregate(monthActivities.map((row) => row.activityType), 200)
        const lostReasons = aggregate(monthLostSales.map((row) => row.reason), 200)
        const lostCustomers = aggregate(monthLostSales.map((row) => row.customer), 200)
        const activeBc = aggregate(monthPrices.map((row) => row.consultant), 12)
        const activeBcCount = new Set(monthPrices.map((row) => row.consultant).filter(Boolean)).size
        const segmentRows = SEGMENT_TEMPLATE.map((template) => {
            const rows = monthPrices.filter((row) => sizeSegment(row.size, row.price) === template.segment)
            const priceValues = rows.map((row) => row.price).filter((value) => value > 0)
            const brands = aggregate(rows.map((row) => row.brand), 3).map((row) => row.name).join(", ") || template.brands
            const sizes = aggregate(rows.map((row) => row.size), 3).map((row) => row.name).join(", ") || template.sizes
            return {
                ...template,
                brands,
                sizes,
                recordCount: rows.length,
                actualRange: priceValues.length ? `${formatMoney(Math.min(...priceValues))} - ${formatMoney(Math.max(...priceValues))}` : template.priceRange,
            }
        })
        const medianBySize = FOCUS_SIZES.reduce<Record<string, ReturnType<typeof medianPriceByBrand>>>((acc, size) => {
            acc[size] = medianPriceByBrand(monthPrices, size)
            return acc
        }, {})
        const supplierDistributionByFocusSize = FOCUS_SIZES.reduce<Record<string, ReturnType<typeof supplierDistributionBySize>>>((acc, size) => {
            acc[size] = supplierDistributionBySize(monthPrices, size)
            return acc
        }, {})
        const customerSupplierBySize = FOCUS_SIZES.reduce<Record<string, ReturnType<typeof customerSupplierMatrix>>>((acc, size) => {
            acc[size] = customerSupplierMatrix(monthPrices, size)
            return acc
        }, {})
        const supplierCustomerFlows = FOCUS_SIZES.reduce<Record<string, SupplierCustomerFlow[]>>((acc, size) => {
            acc[size] = supplierCustomerFlowsBySize(monthPrices, size)
            return acc
        }, {})
        const supplierShare = supplierDistribution(monthPrices)
        const monthlyPriceTrend = buildMonthlyPriceTrend(prices)
        const monthlyPriceTrendStats = FOCUS_SIZES.map((size) => ({ size, ...getTrendStats(monthlyPriceTrend, size) }))
        const monthlyBrandTrendBySize = FOCUS_SIZES.reduce<Record<string, ReturnType<typeof buildMonthlyBrandTrend>>>((acc, size) => {
            acc[size] = buildMonthlyBrandTrend(prices, size)
            return acc
        }, {})
        const monthlyBrandTrendStatsBySize = FOCUS_SIZES.reduce<Record<string, Array<ReturnType<typeof getBrandTrendStats> & { brand: string }>>>((acc, size) => {
            const trend = monthlyBrandTrendBySize[size]
            acc[size] = trend.brands.map((brand) => ({ brand, ...getBrandTrendStats(trend.data, brand) }))
            return acc
        }, {})
        const priceDetailRows = [...monthPrices].sort((a, b) => {
            const dateDiff = (b.infoDate?.getTime() ?? 0) - (a.infoDate?.getTime() ?? 0)
            if (dateDiff) return dateDiff
            return a.size.localeCompare(b.size) || a.customer.localeCompare(b.customer)
        })
        const competitorActivityRows = [...monthActivities].sort((a, b) => (b.infoDate?.getTime() ?? 0) - (a.infoDate?.getTime() ?? 0))
        const lostSaleRows = [...monthLostSales].sort((a, b) => (b.offeringDate?.getTime() ?? 0) - (a.offeringDate?.getTime() ?? 0))
        const impactChart = aggregate(monthActivities.map((row) => row.businessImpact), 6)
        const responseChart = aggregate(monthActivities.map((row) => row.marketResponse), 6)
        const activityHighlights = monthActivities
            .filter((row) => row.description || row.strategy || row.businessImpact)
            .slice(0, 8)
            .map((row) => [row.customer || row.competitor, row.description || row.businessImpact, row.strategy].filter(Boolean).join(" - "))
        const correctiveActions = monthLostSales
            .filter((row) => row.actionPlan || row.remark)
            .slice(0, 8)
            .map((row) => [row.customer, row.reason, row.actionPlan || row.remark].filter(Boolean).join(" - "))

        return {
            prices: monthPrices,
            activities: monthActivities,
            lostSales: monthLostSales,
            medianPrice: median(priceValues),
            topSizes,
            topBrands,
            topSuppliers,
            topCompetitors,
            activityTypes,
            impactChart,
            responseChart,
            lostReasons,
            lostCustomers,
            activeBc,
            activeBcCount,
            segmentRows,
            medianBySize,
            supplierDistributionByFocusSize,
            customerSupplierBySize,
            supplierCustomerFlows,
            supplierShare,
            monthlyPriceTrend,
            monthlyPriceTrendStats,
            monthlyBrandTrendBySize,
            monthlyBrandTrendStatsBySize,
            priceDetailRows,
            competitorActivityRows,
            lostSaleRows,
            activityHighlights,
            correctiveActions,
        }
    }, [activities, lostSales, month, prices])

    const fallbackInsights = useMemo(() => {
        const topBrand = report.topBrands[0]?.name || "brand utama"
        const topSize = report.topSizes[0]?.name || "size utama"
        const lostReason = report.lostReasons[0]?.name || "penyebab lost sale dominan"
        return [
            `${report.prices.length} price intelligence masuk di ${monthLabel(month)} dengan median ${formatMoney(report.medianPrice)}; fokus awal ada pada ${topSize}.`,
            `Brand ${topBrand} paling sering muncul di benchmark, sehingga perlu dipantau untuk positioning harga dan alternatif supply.`,
            `${report.activities.length} aktivitas competitor perlu dikaitkan dengan customer update agar follow-up bukan hanya reaktif terhadap harga.`,
            `Lost sale terbesar terkait ${lostReason}; tindak lanjut perlu diarahkan ke validasi stok, harga, dan proposal substitusi.`,
        ]
    }, [month, report])

    const handleGenerateAi = async () => {
        setIsAiLoading(true)
        try {
            const response = await generateCompetitorMonthlyReportInsight({
                monthLabel: monthLabel(month),
                priceCount: report.prices.length,
                activityCount: report.activities.length,
                lostSaleCount: report.lostSales.length,
                medianPrice: formatMoney(report.medianPrice),
                topSizes: report.topSizes,
                topBrands: report.topBrands,
                topCompetitors: report.topCompetitors,
                topLostReasons: report.lostReasons,
                lostCustomers: report.lostCustomers,
                activityHighlights: report.activityHighlights.slice(0, 5),
            })
            setAiInsights(response.insights)
            if (!response.success) toast.warning(`AI memakai fallback: ${response.error}`)
        } catch (caught) {
            setAiInsights(fallbackInsights)
            toast.error(caught instanceof Error ? caught.message : "AI interpretation gagal")
        } finally {
            setIsAiLoading(false)
        }
    }

    const exportPdf = async () => {
        setIsExporting(true)
        setExportProgress({ current: 0, total: 0, message: "Menyiapkan export PDF..." })
        try {
            const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")])
            const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT] })
            const width = pdf.internal.pageSize.getWidth()
            const height = pdf.internal.pageSize.getHeight()
            const slides = slideRefs.current.filter(Boolean) as HTMLElement[]

            if (!slides.length) {
                toast.error("Tidak ada slide yang bisa diexport.")
                return
            }

            setExportProgress({ current: 0, total: slides.length, message: `Menyiapkan ${slides.length} slide...` })

            for (let index = 0; index < slides.length; index += 1) {
                setExportProgress({ current: index, total: slides.length, message: `Rendering slide ${index + 1} dari ${slides.length}...` })
                slides[index].dataset.exportSlide = String(index)
                let image: string
                try {
                    await waitForExportFrame()
                    image = await toPng(slides[index], {
                        width: EXPORT_SLIDE_WIDTH,
                        height: EXPORT_SLIDE_HEIGHT,
                        canvasWidth: EXPORT_SLIDE_WIDTH,
                        canvasHeight: EXPORT_SLIDE_HEIGHT,
                        pixelRatio: 1.5,
                        backgroundColor: "#f8fafc",
                        cacheBust: true,
                        style: EXPORT_SLIDE_STYLE,
                    })
                    await waitForExportFrame()
                } finally {
                    delete slides[index].dataset.exportSlide
                }
                if (index > 0) pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT], "landscape")
                pdf.addImage(image, "PNG", 0, 0, width, height)
                setExportProgress({ current: index + 1, total: slides.length, message: `Slide ${index + 1} dari ${slides.length} selesai.` })
            }

            setExportProgress({ current: slides.length, total: slides.length, message: "Membuat file PDF dan memulai download..." })
            await waitForExportFrame()
            pdf.save(`competitor-monthly-report-${month}.pdf`)
            setExportProgress({ current: slides.length, total: slides.length, message: "Download PDF dimulai." })
            toast.success("PDF report berhasil dibuat.")
        } catch (caught) {
            console.error("Export PDF gagal", caught)
            toast.error(caught instanceof Error ? caught.message : "Export PDF gagal")
        } finally {
            setIsExporting(false)
            window.setTimeout(() => setExportProgress({ current: 0, total: 0, message: "" }), 2500)
        }
    }

    const exportPercentage = exportProgress.total ? Math.round((exportProgress.current / exportProgress.total) * 100) : 0

    const marketPositioningInsights = [
        "Bridgestone VMDT dan Goodyear terbaca sebagai premium benchmark, terutama saat harga masuk range extra large.",
        "Size 27.00R49 menjadi highest-value segment sehingga setiap pergerakan harga perlu dipakai sebagai sinyal negosiasi utama.",
        "Maxam, Tiberplus, dan Aeolus berada di mid-tier range 55-72 jt untuk menjaga opsi substitusi saat supply premium terbatas.",
        "Data customer-supplier perlu dipakai untuk membaca vendor lock-in dan peluang masuk melalui alternatif brand.",
    ]
    const priceFallback = [{ id: "price-empty", infoDate: null, consultant: "-", size: "Belum ada data", customer: "-", brand: "-", supplier: "-", remark: "-", price: 0 } as PriceRecord]
    const activityFallback = [{ infoDate: null, consultant: "-", competitor: "-", customer: "-", industry: "-", activityType: "Belum ada data", marketResponse: "-", businessImpact: "-", description: "-" } as ActivityRecord]
    const lostSaleFallback = [{ offeringDate: null, consultant: "-", customer: "-", productDetail: "Belum ada data", reason: "-", remark: "-", actionPlan: "-" } as LostSaleRecord]
    const priceTablePages = paginateByWeight(report.priceDetailRows.length ? report.priceDetailRows : priceFallback, 12, (row) => textWeight(row.customer, row.brand, row.supplier, row.remark, row.size))
    const activityTablePages = paginateByWeight(report.competitorActivityRows.length ? report.competitorActivityRows : activityFallback, 11, (row) => textWeight(row.description, row.activityType, row.customer, row.competitor))
    const activityTypePages = chunkArray(report.activityTypes.length ? report.activityTypes : [{ name: "Belum ada data", value: 0 }], 7)
    const competitorPages = chunkArray(report.topCompetitors.length ? report.topCompetitors : [{ name: "Belum ada data", value: 0 }], 7)
    const activityChartPages = Array.from({ length: Math.max(activityTypePages.length, competitorPages.length) }, (_, index) => ({
        activityTypes: activityTypePages[index] ?? [],
        competitors: competitorPages[index] ?? [],
    }))
    const lostSaleTablePages = paginateByWeight(report.lostSaleRows.length ? report.lostSaleRows : lostSaleFallback, 11, (row) => textWeight(row.productDetail, row.remark, row.actionPlan, row.customer))
    const lostReasonPages = chunkArray(report.lostReasons.length ? report.lostReasons : [{ name: "Belum ada data", value: 0 }], 7)
    const lostCustomerPages = chunkArray(report.lostCustomers.length ? report.lostCustomers : [{ name: "Belum ada data", value: 0 }], 7)
    const correctiveActionPages = chunkArray(report.correctiveActions.length ? report.correctiveActions : ["Belum ada action plan lost sale pada periode ini."], 4)
    const lostSaleChartPages = Array.from({ length: Math.max(lostReasonPages.length, lostCustomerPages.length, correctiveActionPages.length) }, (_, index) => ({
        reasons: lostReasonPages[index] ?? [],
        customers: lostCustomerPages[index] ?? [],
        actions: correctiveActionPages[index] ?? [],
    }))
    const priceDetailSlide = 3
    const segmentSlide = priceDetailSlide + priceTablePages.length
    const marketSlide = segmentSlide + 1
    const medianSlideStart = marketSlide + 1
    const matrixSlideStart = medianSlideStart + FOCUS_SIZES.length
    const supplierSlide = matrixSlideStart + FOCUS_SIZES.length
    const activitySlide = supplierSlide + 1
    const activityChartSlide = activitySlide + activityTablePages.length
    const lostSaleSlide = activityChartSlide + activityChartPages.length
    const lostSaleChartSlide = lostSaleSlide + lostSaleTablePages.length
    const rmiSummarySlide = lostSaleChartSlide + lostSaleChartPages.length

    // Lost Sale + Stock Match: Top 5 Customers with Category Breakdown, max 2 slides
    const lostStockItems = (lostSaleStockData?.lostItems ?? []).filter((l: any) => {
        const [fy, fm] = month.split("-").map(Number)
        const d = new Date(l.date)
        return d.getFullYear() === fy && (d.getMonth() + 1) === fm
    })

    // Filter topCustomers by current month
    const monthTopCustomers = (lostSaleStockData?.topCustomers ?? []).filter((c: any) => {
        // Check if any of customer's items are in current month
        return lostStockItems.some((item: any) => item.customerName === c.customerName)
    })

    // Re-calculate top 5 from month items
    const customerMap: Record<string, { customerName: string; totalValue: number; totalQty: number; itemCount: number; categories: Record<string, { value: number; qty: number; count: number }> }> = {}
    lostStockItems.forEach((item: any) => {
        const name = item.customerName || "Unknown"
        if (!customerMap[name]) customerMap[name] = { customerName: name, totalValue: 0, totalQty: 0, itemCount: 0, categories: {} }
        const val = Number(item.unitPrice || 0) * item.quantity
        const cat = (item.category || "OTHER").toUpperCase()
        customerMap[name].totalValue += val
        customerMap[name].totalQty += item.quantity
        customerMap[name].itemCount += 1
        if (!customerMap[name].categories[cat]) customerMap[name].categories[cat] = { value: 0, qty: 0, count: 0 }
        customerMap[name].categories[cat].value += val
        customerMap[name].categories[cat].qty += item.quantity
        customerMap[name].categories[cat].count += 1
    })
    const topCustSorted = Object.values(customerMap).sort((a, b) => b.totalValue - a.totalValue)
    const top5Customers = topCustSorted.slice(0, 5)
    const restCustomers = topCustSorted.slice(5)

    // Split into max 2 slides
    const MAX_SLIDES = 2
    type TopCustItem = (typeof topCustSorted)[number]
    const lostStockPages: TopCustItem[][] = []
    if (top5Customers.length <= 3) {
        lostStockPages.push(top5Customers)
        if (restCustomers.length > 0) lostStockPages.push(restCustomers)
    } else {
        lostStockPages.push(top5Customers.slice(0, 3))
        lostStockPages.push(top5Customers.slice(3))
    }
    if (lostStockPages.length === 0) lostStockPages.push([])

    const lostStockSlideStart = rmiSummarySlide + 1
    const quotationSlide = lostStockSlideStart + lostStockPages.length
    const slowMovingChartSlide = quotationSlide + 1
    const slowMovingTableSlide = slowMovingChartSlide + 1
    const a2rSlide = slowMovingTableSlide + 1
    const procurementChartSlide = a2rSlide + 1
    const procurementTopSlide = procurementChartSlide + 1
    const monthFleet = fleetData.filter((item: any) => item.lastupdate?.startsWith(month))
    const fleetPages = monthFleet.length > 0
        ? paginateByWeight(monthFleet, 15, (item: any) => textWeight(item.customer, item.site, item.location, item.model, item.unit_manufacture, item.tire_size))
        : []
    const fleetSlide = procurementTopSlide + 1
    const closingSlide = fleetSlide + Math.max(1, fleetPages.length)

    return (
        <div className="space-y-5">
            <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-2 flex flex-wrap gap-2">
                            <Badge className="bg-[#0f4c81] text-white hover:bg-[#0f4c81]">Report Bulan Berjalan</Badge>
                            <Badge variant="outline">16:9 Slide Sections</Badge>
                            <Badge variant="outline">AI Interpretation</Badge>
                        </div>
                        <CardTitle className="text-2xl">Monthly Competitor Report</CardTitle>
                        <p className="mt-1 text-sm text-slate-500">Template mengikuti urutan monthly report: KPI, corrective action, market update, competitor information, dan interpretation.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-10 w-[170px] pl-9" />
                        </div>
                        <Button variant="outline" onClick={loadData} disabled={isLoading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                        <Button variant="outline" onClick={handleGenerateAi} disabled={isAiLoading || isLoading}><Bot className="mr-2 h-4 w-4" />Interpretasi AI</Button>
                        <Button onClick={exportPdf} disabled={isExporting || isLoading} className="min-w-[132px]">
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            {isExporting ? `${exportPercentage}%` : "Export PDF"}
                        </Button>
                    </div>
                </CardHeader>
                {(isExporting || exportProgress.message) && (
                    <CardContent className="pt-0">
                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-950">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                                <div className="flex items-center gap-2 font-bold">
                                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    <span>{exportProgress.message || "Menyiapkan export PDF..."}</span>
                                </div>
                                <span className="font-black tabular-nums">{exportPercentage}%</span>
                            </div>
                            <Progress value={exportPercentage} className="h-2 bg-blue-100 [&>div]:bg-[#0f4c81]" />
                            <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] font-semibold text-blue-800">
                                <span>{exportProgress.total ? `${exportProgress.current} / ${exportProgress.total} slide selesai` : "Menghitung jumlah slide..."}</span>
                                <span>Jangan tutup halaman sampai download dimulai.</span>
                            </div>
                        </div>
                    </CardContent>
                )}
                {error && <CardContent><div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div></CardContent>}
                {aiInsights.length > 0 && (
                    <CardContent className="pt-0">
                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                            <div className="mb-2 flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4" />AI Interpretation</div>
                            <div className="grid gap-2 md:grid-cols-2">
                                {aiInsights.slice(0, 4).map((item, index) => <p key={`${item}-${index}`} className="leading-relaxed">{index + 1}. {item}</p>)}
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {isLoading ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-lg border bg-white text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memuat data report...</div>
            ) : (
                <div className="space-y-6">
                    {[
                        <section key="cover" className="monthly-report-slide relative h-[760px] w-full overflow-hidden rounded-lg bg-[#f8fafc] shadow-sm print:rounded-none print:shadow-none">
                            <div className="absolute inset-y-0 right-0 w-[38%] bg-[#0f4c81]" />
                            <div className="absolute left-0 top-0 h-2 w-full bg-[#0f4c81]" />
                            <div className="absolute bottom-0 left-0 h-2 w-full bg-emerald-300" />
                            <div className="absolute right-[33%] top-0 h-full w-16 skew-x-[-10deg] bg-emerald-300" />
                            <div className="relative grid h-full grid-cols-[1.08fr_0.92fr] gap-8 p-10">
                                <div className="flex flex-col justify-between py-2">
                                    <div className="flex items-center gap-4">
                                        <Image src="/cp_logo_alpha.png" alt="Chitra Paratama" width={182} height={72} className="h-16 w-auto rounded-md bg-white p-2 shadow-sm outline outline-1 outline-black/10" priority />
                                        <div className="h-12 w-px bg-slate-300" />
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#0f4c81]">BIMA</p>
                                            <p className="text-sm font-semibold text-slate-500">Business Innovation & Marketing</p>
                                        </div>
                                    </div>
                                    <div className="max-w-[690px]">
                                        <p className="mb-4 inline-flex rounded-md bg-[#0f4c81] px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-white shadow-sm">Monthly Report</p>
                                        <h2 className="max-w-[680px] text-[58px] font-black leading-[0.98] tracking-tight text-slate-950 text-balance">Monthly Competitor Dashboard</h2>
                                        <p className="mt-3 text-[42px] font-black leading-none text-[#0f4c81]">{monthLabel(month)}</p>
                                        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 text-pretty">Dashboard BIMA untuk membaca price intelligence, aktivitas kompetitor, customer-supplier mapping, dan indikasi risiko market bulanan.</p>
                                        <p className="mt-3 text-sm font-semibold text-slate-500">Compile by: <span className="font-black text-[#0f4c81]">Mochamad Annas Khadafi</span></p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <MetricTile icon={FileText} label="Price" value={report.prices.length} note="competitor price data" />
                                        <MetricTile icon={Users} label="Active BC" value={report.activeBcCount} note="pengumpul data aktif" />
                                        <MetricTile icon={Target} label="Activity" value={report.activities.length} note="competitor activity" />
                                    </div>
                                </div>
                                <div className="relative flex items-center justify-center pl-6 text-slate-950">
                                    <div className="w-full rounded-lg border border-emerald-200 bg-emerald-100/95 p-8 shadow-2xl outline outline-1 outline-white/50">
                                        <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-800">Competitor Intelligence</p>
                                        <p className="mt-6 text-5xl font-black leading-tight text-[#0f4c81]">Market Price<br />Activity<br />Lost Sale</p>
                                        <p className="mt-8 text-sm font-semibold leading-7 text-emerald-900">Prepared for monthly commercial review and competitor movement monitoring.</p>
                                    </div>
                                </div>
                            </div>
                        </section>,
                        <Slide key="bc-activity" eyebrow="Slide 2 - Competitor Price Update" title="BC Activity Contribution">
                            <div className="grid h-[calc(100%-88px)] grid-cols-[0.85fr_1.15fr] gap-6">
                                <div className="grid content-start gap-4">
                                    <MetricTile icon={Users} label="Active BC" value={report.activeBcCount} note="Business Consultant yang mengumpulkan data competitor price" />
                                    <MetricTile icon={FileText} label="Collected Price" value={report.prices.length} note={`Total record di ${monthLabel(month)}`} />
                                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                                        <p className="mb-3 text-sm font-bold text-slate-700">BC Leaderboard</p>
                                        <div className="space-y-2">
                                            {(report.activeBc.length ? report.activeBc : [{ name: "Belum ada data BC", value: 0 }]).slice(0, 5).map((row, index) => (
                                                <div key={row.name} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                                                    <span><b className="text-[#f97316]">#{index + 1}</b> {shortLabel(row.name, 26)}</span>
                                                    <b>{row.value}</b>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-lg border bg-white p-4 shadow-sm">
                                    <p className="mb-3 text-sm font-semibold text-slate-700">Kontribusi Data per BC</p>
                                    {report.activeBc.length ? <ResponsiveContainer width="100%" height={380}><BarChart data={report.activeBc.map((item) => ({ ...item, label: shortLabel(item.name, 16) }))} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="label" type="category" width={120} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" radius={[0, 6, 6, 0]}>{report.activeBc.map((_, index) => <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />)}<LabelList dataKey="value" position="right" /></Bar></BarChart></ResponsiveContainer> : <EmptySlideState message="Belum ada kontribusi BC pada periode ini." />}
                                </div>
                            </div>
                        </Slide>,
                        ...priceTablePages.map((rows, pageIndex) => (
                            <Slide key={`price-detail-${pageIndex}`} eyebrow={`Slide ${priceDetailSlide}.${pageIndex + 1} - Price Competitor Detail`} title="Table Price Competitor All Size">
                                <div className="h-[calc(100%-88px)] overflow-hidden rounded-lg border bg-white p-3 shadow-sm">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-black text-slate-900">Data Detail Price Competitor</p>
                                            <p className="text-[10px] text-slate-500">All size periode {monthLabel(month)} lengkap dengan BC, customer, brand, supplier, remark, dan price.</p>
                                        </div>
                                        <Badge variant="outline" className="text-[10px]">Page {pageIndex + 1} / {priceTablePages.length}</Badge>
                                    </div>
                                    <ReportTable>
                                        <colgroup>
                                            <col className="w-[9%]" />
                                            <col className="w-[10%]" />
                                            <col className="w-[9%]" />
                                            <col className="w-[16%]" />
                                            <col className="w-[11%]" />
                                            <col className="w-[15%]" />
                                            <col className="w-[18%]" />
                                            <col className="w-[12%]" />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <TableHeadCell>Timestamp</TableHeadCell>
                                                <TableHeadCell>BC</TableHeadCell>
                                                <TableHeadCell>Size Tire</TableHeadCell>
                                                <TableHeadCell>Nama Customer</TableHeadCell>
                                                <TableHeadCell>Brand</TableHeadCell>
                                                <TableHeadCell>Supplier</TableHeadCell>
                                                <TableHeadCell>Remark / DDP</TableHeadCell>
                                                <TableHeadCell>Price</TableHeadCell>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row, index) => (
                                                <tr key={`${row.id}-${pageIndex}-${index}`}>
                                                    <TableCellCompact className="break-words text-[9px] leading-snug">{formatDateLabel(row.infoDate)}</TableCellCompact>
                                                    <TableCellCompact className="break-words text-[9px] leading-snug">{row.consultant || "-"}</TableCellCompact>
                                                    <TableCellCompact className="break-words text-[9px] font-semibold leading-snug">{row.size || "-"}</TableCellCompact>
                                                    <TableCellCompact className="break-words text-[9px] leading-snug">{row.customer || "-"}</TableCellCompact>
                                                    <TableCellCompact className="break-words text-[9px] leading-snug">{row.brand || "-"}</TableCellCompact>
                                                    <TableCellCompact className="break-words text-[9px] leading-snug">{row.supplier || "-"}</TableCellCompact>
                                                    <TableCellCompact className="whitespace-normal break-words text-[9px] leading-snug">{row.remark || "-"}</TableCellCompact>
                                                    <TableCellCompact className="border-l border-blue-300 text-right text-[9px] font-black leading-snug text-slate-900">{row.price ? row.price.toLocaleString("id-ID") : "-"}</TableCellCompact>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </ReportTable>
                                </div>
                            </Slide>
                        )),
                        <Slide key="segment-overview" eyebrow={`Slide ${segmentSlide} - Price Analysis Overview`} title="Competitor Tire Price Analysis Overview">
                            <div className="space-y-3">
                                <ReportTable>
                                    <thead><tr><TableHeadCell>Segmen</TableHeadCell><TableHeadCell>Price Range</TableHeadCell><TableHeadCell>Brand Dominan</TableHeadCell><TableHeadCell>Ukuran Umum</TableHeadCell><TableHeadCell>Data</TableHeadCell></tr></thead>
                                    <tbody>{report.segmentRows.map((row) => <tr key={row.segment}><TableCellCompact><b>{row.segment}</b></TableCellCompact><TableCellCompact>{row.actualRange}</TableCellCompact><TableCellCompact>{row.brands}</TableCellCompact><TableCellCompact>{row.sizes}</TableCellCompact><TableCellCompact>{row.recordCount}</TableCellCompact></tr>)}</tbody>
                                </ReportTable>
                                <div className="rounded-lg border bg-white p-3 shadow-sm">
                                    <div className="mb-1 flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Trend Harga Competitor Bulanan - by Size</p>
                                            <p className="text-[11px] text-slate-500">Median harga competitor tiap bulan untuk 27.00R49, 24.00R35, dan 12.00R24.</p>
                                        </div>
                                        <div className="flex flex-wrap justify-end gap-2">
                                            {report.monthlyPriceTrendStats.map((stat, index) => <TrendStatCard key={stat.size} stat={stat} color={BAR_COLORS[index]} />)}
                                        </div>
                                    </div>
                                    {report.monthlyPriceTrend.length ? <ResponsiveContainer width="100%" height={210}><LineChart data={report.monthlyPriceTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 10 }} angle={-28} textAnchor="end" height={48} /><YAxis width={52} tick={{ fontSize: 10 }} tickFormatter={(value) => `${Number(value) / 1_000_000} jt`} /><Tooltip formatter={(value) => formatMoney(Number(value))} /><Legend wrapperStyle={{ fontSize: 11 }} />{FOCUS_SIZES.map((size, index) => <Line key={size} type="monotone" dataKey={size} stroke={BAR_COLORS[index]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />)}</LineChart></ResponsiveContainer> : <EmptySlideState message="Belum ada trend bulanan untuk size fokus." />}
                                </div>
                                <div className="rounded-lg border-l-4 border-[#f97316] bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-slate-800 shadow-sm">Bridgestone & Goodyear dominasi premium, sedangkan Maxam, Aeolus, dan Tiberplus mengisi mid-tier sebagai opsi substitusi harga dan supply.</div>
                            </div>
                        </Slide>,
                        <Slide key="market-positioning" eyebrow={`Slide ${marketSlide} - Market Positioning`} title="Data Competitor Price">
                            <div className="grid h-[calc(100%-88px)] grid-cols-[1.1fr_0.9fr] gap-6">
                                <InsightList items={marketPositioningInsights} tone="orange" />
                                <div className="rounded-lg border bg-white p-4 shadow-sm">
                                    <p className="mb-3 text-sm font-semibold text-slate-700">Brand Frequency</p>
                                    {report.topBrands.length ? <ResponsiveContainer width="100%" height={330}><BarChart data={report.topBrands.map((item) => ({ ...item, label: shortLabel(item.name, 14) }))}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" radius={[6, 6, 0, 0]}>{report.topBrands.map((_, index) => <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />)}<LabelList dataKey="value" position="top" /></Bar></BarChart></ResponsiveContainer> : <EmptySlideState message="Tidak ada brand benchmark pada bulan ini." />}
                                </div>
                            </div>
                        </Slide>,
                        ...FOCUS_SIZES.map((size, offset) => (
                            <Slide key={`median-${size}`} eyebrow={`Slide ${medianSlideStart + offset} - Median Price ${size}`} title={`Median Price ${size}`}>
                                <div className="grid h-[calc(100%-88px)] grid-cols-[0.94fr_1.06fr] gap-5">
                                    <div className="flex h-full flex-col rounded-lg border bg-white p-4 shadow-sm">
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-700">Median Harga per Brand</p>
                                            <Badge variant="outline" className="text-[10px]">Label harga cetak</Badge>
                                        </div>
                                        <div className="min-h-0 flex-1 rounded-lg bg-slate-50 px-2 pt-2">
                                            {report.medianBySize[size]?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={report.medianBySize[size].map((item) => ({ ...item, label: shortLabel(item.name, 16) }))} margin={{ top: 24, right: 12, bottom: 4, left: 0 }} barCategoryGap="34%"><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `${Number(value) / 1_000_000} jt`} /><Tooltip formatter={(value) => formatMoney(Number(value))} /><Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72}>{report.medianBySize[size].map((_, index) => <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />)}<LabelList dataKey="value" position="top" formatter={(value: number) => formatMoney(value)} style={{ fontSize: 11, fontWeight: 700 }} /></Bar></BarChart></ResponsiveContainer> : <EmptySlideState message={`Tidak ada data median ${size} pada periode ini.`} />}
                                        </div>
                                        <div className="mt-3 grid shrink-0 grid-cols-2 gap-2">
                                            {report.medianBySize[size]?.slice(0, 4).map((row, index) => (
                                                <div key={row.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-700">
                                                    <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }} /><span className="truncate">{row.name}</span></span>
                                                    <b>{formatMoney(row.value)}</b>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <SupplierDistributionPanel size={size} data={report.supplierDistributionByFocusSize[size]} />
                                </div>
                            </Slide>
                        )),
                        ...FOCUS_SIZES.map((size, offset) => {
                            const matrix = report.customerSupplierBySize[size]
                            const brandTrend = report.monthlyBrandTrendBySize[size]
                            const brandStats = report.monthlyBrandTrendStatsBySize[size]
                            return (
                                <Slide key={`matrix-${size}`} eyebrow={`Slide ${matrixSlideStart + offset} - Customer Supplier ${size}`} title={`Customer Supplier ${size}`}>
                                    <div className="grid h-[calc(100%-88px)] grid-rows-[170px_1fr] gap-4 overflow-hidden">
                                        <div className="min-h-0 overflow-hidden">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-sm font-semibold text-slate-700">Matrix median harga customer vs supplier</p>
                                                <Badge variant="secondary" className="text-[10px]">Sumber: Price Competitor</Badge>
                                            </div>
                                            {matrix.rows.length ? <ReportTable><thead><tr><TableHeadCell>Customer</TableHeadCell>{matrix.suppliers.map((supplier) => <TableHeadCell key={supplier}>{shortLabel(supplier, 18)}</TableHeadCell>)}<TableHeadCell>Median Price</TableHeadCell></tr></thead><tbody>{matrix.rows.slice(0, 5).map((row) => <tr key={String(row.customer)}><TableCellCompact><b>{shortLabel(String(row.customer), 30)}</b></TableCellCompact>{matrix.suppliers.map((supplier) => <TableCellCompact key={supplier}>{tableCell(row[supplier])}</TableCellCompact>)}<TableCellCompact><b>{tableCell(row.rowMedian)}</b></TableCellCompact></tr>)}</tbody></ReportTable> : <EmptySlideState message={`Tidak ada matrix harga customer-supplier untuk ${size}.`} />}
                                        </div>
                                        <MonthlyBrandTrendPanel size={size} trend={brandTrend} stats={brandStats} />
                                    </div>
                                </Slide>
                            )
                        }),
                        <Slide key="supplier-distribution" eyebrow={`Slide ${supplierSlide} - Supplier Distribution`} title="Supplier Supply Mapping">
                            <div className="h-[calc(100%-88px)] rounded-lg border bg-white p-5 shadow-sm">
                                <div className="mb-4 flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Supplier supply ke customer berdasarkan size</p>
                                        <p className="text-[11px] text-slate-500">Diambil dari Price Competitor periode {monthLabel(month)}. Blok menunjukkan pasangan supplier-customer teratas per size.</p>
                                    </div>
                                    <Badge variant="outline" className="text-[10px]">12.00R24 / 27.00R49 / 24.00R35</Badge>
                                </div>
                                <div className="grid h-[calc(100%-52px)] grid-cols-3 gap-8">
                                    {["27.00R49", "24.00R35", "12.00R24"].map((size) => <SupplierCustomerSankeyPanel key={size} size={size} flows={report.supplierCustomerFlows[size] ?? []} />)}
                                </div>
                            </div>
                        </Slide>,
                        ...activityTablePages.map((rows, pageIndex) => (
                            <Slide key={`activity-table-${pageIndex}`} eyebrow={`Slide ${activitySlide}.${pageIndex + 1} - Competitor Activity`} title="Competitor Activity Detail">
                                <div className="h-[calc(100%-88px)] overflow-hidden rounded-lg border bg-white p-3 shadow-sm">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-sm font-black text-slate-900">Data Detail Competitor Activity</p>
                                        <Badge variant="outline" className="text-[10px]">Page {pageIndex + 1} / {activityTablePages.length}</Badge>
                                    </div>
                                    <ReportTable><colgroup><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[13%]" /><col className="w-[12%]" /><col className="w-[9%]" /><col className="w-[13%]" /><col className="w-[8%]" /><col className="w-[8%]" /><col className="w-[21%]" /></colgroup><thead><tr><TableHeadCell>Last Update</TableHeadCell><TableHeadCell>BC</TableHeadCell><TableHeadCell>Competitor</TableHeadCell><TableHeadCell>Customer</TableHeadCell><TableHeadCell>Industri</TableHeadCell><TableHeadCell>Jenis Aktivitas</TableHeadCell><TableHeadCell>Response</TableHeadCell><TableHeadCell>Impact</TableHeadCell><TableHeadCell>Deskripsi</TableHeadCell></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.competitor}-${row.customer}-${pageIndex}-${index}`}><TableCellCompact className="break-words text-[10px] leading-snug">{formatDateLabel(row.infoDate)}</TableCellCompact><TableCellCompact className="break-words text-[10px] leading-snug">{row.consultant || "Unknown"}</TableCellCompact><TableCellCompact className="break-words text-[10px] font-bold leading-snug">{row.competitor || "-"}</TableCellCompact><TableCellCompact className="break-words text-[10px] leading-snug">{row.customer || "-"}</TableCellCompact><TableCellCompact className="break-words text-[10px] leading-snug">{row.industry || "Unknown"}</TableCellCompact><TableCellCompact className="break-words text-[10px] leading-snug">{row.activityType || "-"}</TableCellCompact><TableCellCompact className="break-words text-[10px] leading-snug">{row.marketResponse || "-"}</TableCellCompact><TableCellCompact className="break-words text-[10px] leading-snug">{row.businessImpact || "-"}</TableCellCompact><TableCellCompact className="whitespace-normal break-words text-[10px] leading-snug">{row.description || "-"}</TableCellCompact></tr>)}</tbody></ReportTable>
                                </div>
                            </Slide>
                        )),
                        ...activityChartPages.map((page, pageIndex) => (
                            <Slide key={`activity-chart-${pageIndex}`} eyebrow={`Slide ${activityChartSlide}.${pageIndex + 1} - Competitor Activity`} title="Competitor Activity Charts">
                                <div className="grid h-[calc(100%-88px)] grid-cols-2 gap-4">
                                    <div className="flex min-h-0 flex-col rounded-lg border bg-white p-3 shadow-sm"><p className="mb-2 text-sm font-black text-slate-900">Grafik Jenis Aktivitas Competitor</p><div className="min-h-0 flex-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={page.activityTypes.map((item) => ({ ...item, label: shortLabel(item.name, 26) }))} layout="vertical" margin={{ top: 8, right: 28, left: 8, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="label" width={172} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#0f4c81"><LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700 }} /></Bar></BarChart></ResponsiveContainer></div></div>
                                    <div className="flex min-h-0 flex-col rounded-lg border bg-white p-3 shadow-sm"><p className="mb-2 text-sm font-black text-slate-900">Grafik Kompetitor</p><div className="min-h-0 flex-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={page.competitors.map((item) => ({ ...item, label: shortLabel(item.name, 26) }))} layout="vertical" margin={{ top: 8, right: 28, left: 8, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="label" width={172} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#f97316"><LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700 }} /></Bar></BarChart></ResponsiveContainer></div></div>
                                </div>
                            </Slide>
                        )),
                        ...lostSaleTablePages.map((rows, pageIndex) => (
                            <Slide key={`lost-sale-table-${pageIndex}`} eyebrow={`Slide ${lostSaleSlide}.${pageIndex + 1} - Lost Sale`} title="Lost Sale Detail">
                                <div className="h-[calc(100%-88px)] overflow-hidden rounded-lg border bg-white p-3 shadow-sm">
                                    <div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-900">Data Detail Lost Sale</p><p className="text-[10px] text-slate-500">Data terbaru di periode {monthLabel(month)} dengan detail produk, penyebab, dan action plan.</p></div><Badge variant="outline" className="text-[10px]">Page {pageIndex + 1} / {lostSaleTablePages.length}</Badge></div>
                                    <ReportTable><colgroup><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[14%]" /><col className="w-[18%]" /><col className="w-[13%]" /><col className="w-[17%]" /><col className="w-[20%]" /></colgroup><thead><tr><TableHeadCell>Tanggal</TableHeadCell><TableHeadCell>BC</TableHeadCell><TableHeadCell>Customer</TableHeadCell><TableHeadCell>Detail Produk</TableHeadCell><TableHeadCell>Penyebab</TableHeadCell><TableHeadCell>Remark</TableHeadCell><TableHeadCell>Action Plan</TableHeadCell></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.customer}-${row.productDetail}-${pageIndex}-${index}`}><TableCellCompact className="break-words text-[10px] leading-snug">{formatDateLabel(row.offeringDate)}</TableCellCompact><TableCellCompact className="break-words text-[10px] leading-snug">{row.consultant || "Unknown"}</TableCellCompact><TableCellCompact className="break-words text-[10px] font-bold leading-snug">{row.customer || "-"}</TableCellCompact><TableCellCompact className="whitespace-normal break-words text-[10px] leading-snug">{row.productDetail || "-"}</TableCellCompact><TableCellCompact className="break-words text-[10px] font-semibold leading-snug text-red-700">{row.reason || "-"}</TableCellCompact><TableCellCompact className="whitespace-normal break-words text-[10px] leading-snug">{row.remark || "-"}</TableCellCompact><TableCellCompact className="whitespace-normal break-words text-[10px] leading-snug">{row.actionPlan || "-"}</TableCellCompact></tr>)}</tbody></ReportTable>
                                </div>
                            </Slide>
                        )),
                        ...lostSaleChartPages.map((page, pageIndex) => (
                            <Slide key={`lost-sale-chart-${pageIndex}`} eyebrow={`Slide ${lostSaleChartSlide}.${pageIndex + 1} - Lost Sale`} title="Lost Sale Charts & Follow Up">
                                <div className="grid h-[calc(100%-88px)] grid-cols-[1fr_1fr_0.72fr] gap-4"><div className="flex min-h-0 flex-col rounded-lg border bg-white p-3 shadow-sm"><p className="mb-2 text-sm font-black text-slate-900">Grafik Penyebab Lost Sale</p><div className="min-h-0 flex-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={page.reasons.map((item) => ({ ...item, label: shortLabel(item.name, 24) }))} layout="vertical" margin={{ top: 8, right: 28, left: 8, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="label" width={148} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#dc2626"><LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700 }} /></Bar></BarChart></ResponsiveContainer></div></div><div className="flex min-h-0 flex-col rounded-lg border bg-white p-3 shadow-sm"><p className="mb-2 text-sm font-black text-slate-900">Grafik Customer Lost Sale</p><div className="min-h-0 flex-1"><ResponsiveContainer width="100%" height="100%"><BarChart data={page.customers.map((item) => ({ ...item, label: shortLabel(item.name, 24) }))} layout="vertical" margin={{ top: 8, right: 28, left: 8, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="label" width={148} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#0f4c81"><LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700 }} /></Bar></BarChart></ResponsiveContainer></div></div><div className="rounded-lg border border-orange-100 bg-orange-50 p-3 shadow-sm"><p className="text-sm font-black text-orange-900">Priority Follow Up</p><div className="mt-2 space-y-2">{page.actions.map((item, index) => <div key={`${item}-${pageIndex}-${index}`} className="rounded-md bg-white/85 p-2 text-[10px] font-semibold leading-snug text-slate-700 shadow-sm"><span className="mr-1 font-black text-orange-700">{(pageIndex * 4) + index + 1}.</span>{item}</div>)}</div></div></div>
                            </Slide>
                        )),
                        <Slide key="rmi-summary" eyebrow={`Slide ${rmiSummarySlide} - RMI Summary`} title={`Raw Material Index — ${monthLabel(month)}`}>
                            {(() => {
                                // Dynamic RMI_BASES and RMI_WEIGHTS from database
                                const RMI_BASES = { 
                                    nr: rmiWeights?.basePeriodNaturalRubber ?? 2.05, 
                                    sr: rmiWeights?.basePeriodSyntheticRubber ?? 13200.0, 
                                    cb: rmiWeights?.basePeriodCarbonBlack ?? 1.45, 
                                    sc: rmiWeights?.basePeriodSteelCord ?? 1.10, 
                                    fr: rmiWeights?.basePeriodFreight ?? 2800.0 
                                }
                                const RMI_WEIGHTS = { 
                                    nr: rmiWeights?.naturalRubberWeight ?? 0.35, 
                                    sr: rmiWeights?.syntheticRubberWeight ?? 0.20, 
                                    cb: rmiWeights?.carbonBlackWeight ?? 0.20, 
                                    sc: rmiWeights?.steelCordWeight ?? 0.15, 
                                    fr: rmiWeights?.freightWeight ?? 0.05 
                                }

                                // Ambil data bulanan untuk chart tren (semua data tersedia)
                                const chartRows: { label: string; nr: number; sr: number; cb: number; sc: number; fr: number; rmi: number; sortKey: number }[] = []
                                const getShortMonth = (mi: number) => ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"][mi - 1] || ""

                                Object.keys(rmiMonthlyData).forEach(qKey => {
                                    const [y, qp] = qKey.split("-Q").map(Number)
                                    if (y < 2025 || (y === 2025 && qp < 4)) return
                                    const details = rmiMonthlyData[qKey] || []
                                    details.forEach(m => {
                                        const idxNR = m.naturalRubber > 0 ? (m.naturalRubber / RMI_BASES.nr) * 100 : 0
                                        const idxSR = m.syntheticRubber > 0 ? (m.syntheticRubber / RMI_BASES.sr) * 100 : 0
                                        const idxCB = m.carbonBlack > 0 ? (m.carbonBlack / RMI_BASES.cb) * 100 : 0
                                        const idxSC = m.steelCord > 0 ? (m.steelCord / RMI_BASES.sc) * 100 : 0
                                        const idxFR = m.freight > 0 ? (m.freight / RMI_BASES.fr) * 100 : 0
                                        const rmi = (idxNR > 0 || idxSR > 0) ? (idxNR * RMI_WEIGHTS.nr) + (idxSR * RMI_WEIGHTS.sr) + (idxCB * RMI_WEIGHTS.cb) + (idxSC * RMI_WEIGHTS.sc) + (idxFR * RMI_WEIGHTS.fr) : 0
                                        chartRows.push({
                                            sortKey: y * 100 + m.monthIndex,
                                            label: `${getShortMonth(m.monthIndex)} '${String(y).slice(-2)}`,
                                            nr: parseFloat(idxNR.toFixed(1)),
                                            sr: parseFloat(idxSR.toFixed(1)),
                                            cb: parseFloat(idxCB.toFixed(1)),
                                            sc: parseFloat(idxSC.toFixed(1)),
                                            fr: parseFloat(idxFR.toFixed(1)),
                                            rmi: rmi > 0 ? parseFloat(rmi.toFixed(1)) : 0,
                                        })
                                    })
                                })
                                chartRows.sort((a, b) => a.sortKey - b.sortKey)

                                // Cari data bulan yang di-filter (month = "yyyy-MM")
                                const [filterYear, filterMonth] = month.split("-").map(Number)
                                let currentMonthData: typeof chartRows[0] | undefined
                                Object.keys(rmiMonthlyData).forEach(qKey => {
                                    const [y] = qKey.split("-Q").map(Number)
                                    if (y !== filterYear) return
                                    const details = rmiMonthlyData[qKey] || []
                                    const found = details.find(d => d.monthIndex === filterMonth)
                                    if (found) {
                                        const idxNR = found.naturalRubber > 0 ? (found.naturalRubber / RMI_BASES.nr) * 100 : 0
                                        const idxSR = found.syntheticRubber > 0 ? (found.syntheticRubber / RMI_BASES.sr) * 100 : 0
                                        const idxCB = found.carbonBlack > 0 ? (found.carbonBlack / RMI_BASES.cb) * 100 : 0
                                        const idxSC = found.steelCord > 0 ? (found.steelCord / RMI_BASES.sc) * 100 : 0
                                        const idxFR = found.freight > 0 ? (found.freight / RMI_BASES.fr) * 100 : 0
                                        const rmi = (idxNR > 0 || idxSR > 0) ? (idxNR * RMI_WEIGHTS.nr) + (idxSR * RMI_WEIGHTS.sr) + (idxCB * RMI_WEIGHTS.cb) + (idxSC * RMI_WEIGHTS.sc) + (idxFR * RMI_WEIGHTS.fr) : 0
                                        currentMonthData = {
                                            sortKey: y * 100 + found.monthIndex,
                                            label: monthLabel(month),
                                            nr: parseFloat(idxNR.toFixed(1)),
                                            sr: parseFloat(idxSR.toFixed(1)),
                                            cb: parseFloat(idxCB.toFixed(1)),
                                            sc: parseFloat(idxSC.toFixed(1)),
                                            fr: parseFloat(idxFR.toFixed(1)),
                                            rmi: rmi > 0 ? parseFloat(rmi.toFixed(1)) : 0,
                                        }
                                    }
                                })

                                // Tabel komponen material bulan ini
                                const materialMap: Record<string, { key: keyof typeof chartRows[0]; label: string; unit: string; baseVal: number; weight: number; color: string }> = {
                                    nr: { key: "nr", label: "Natural Rubber", unit: "USD/kg", baseVal: RMI_BASES.nr, weight: RMI_WEIGHTS.nr, color: BAR_COLORS[0] },
                                    sr: { key: "sr", label: "Synthetic Rubber", unit: "CNY/T", baseVal: RMI_BASES.sr, weight: RMI_WEIGHTS.sr, color: BAR_COLORS[1] },
                                    cb: { key: "cb", label: "Carbon Black", unit: "USD/kg", baseVal: RMI_BASES.cb, weight: RMI_WEIGHTS.cb, color: BAR_COLORS[2] },
                                    sc: { key: "sc", label: "Steel Cord", unit: "USD/kg", baseVal: RMI_BASES.sc, weight: RMI_WEIGHTS.sc, color: BAR_COLORS[3] },
                                    fr: { key: "fr", label: "Freight (Drewry)", unit: "USD/40ft", baseVal: RMI_BASES.fr, weight: RMI_WEIGHTS.fr, color: BAR_COLORS[4] },
                                }

                                // Cari raw price dari rmiMonthlyData untuk tabel
                                let rawCurrentMonth: { naturalRubber: number; syntheticRubber: number; carbonBlack: number; steelCord: number; freight: number } | undefined
                                Object.keys(rmiMonthlyData).forEach(qKey => {
                                    const [y] = qKey.split("-Q").map(Number)
                                    if (y !== filterYear) return
                                    const details = rmiMonthlyData[qKey] || []
                                    const found = details.find(d => d.monthIndex === filterMonth)
                                    if (found) rawCurrentMonth = found
                                })

                                const pieData = Object.values(materialMap).map(m => ({
                                    name: m.label,
                                    value: Math.round(m.weight * 100),
                                    color: m.color
                                }))

                                const hasData = chartRows.length > 0

                                return (
                                    <div className="grid h-[calc(100%-88px)] grid-rows-[auto_1fr] gap-3">
                                        {/* Top: KPI cards untuk setiap material */}
                                        <div className="grid grid-cols-5 gap-2">
                                            {Object.entries(materialMap).map(([mk, mat]) => {
                                                const idxVal = currentMonthData ? (currentMonthData[mat.key] as number) : null
                                                const rawVal = rawCurrentMonth ? ({
                                                    nr: rawCurrentMonth.naturalRubber,
                                                    sr: rawCurrentMonth.syntheticRubber,
                                                    cb: rawCurrentMonth.carbonBlack,
                                                    sc: rawCurrentMonth.steelCord,
                                                    fr: rawCurrentMonth.freight,
                                                }[mk]) : null
                                                const trend = idxVal !== null ? (idxVal > 100 ? "up" : idxVal < 100 ? "down" : "flat") : "flat"
                                                const trendColor = trend === "up" ? "text-red-600" : trend === "down" ? "text-emerald-600" : "text-slate-500"
                                                const arrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "→"
                                                return (
                                                    <div key={mk} className="rounded-lg border bg-white p-2.5 shadow-sm">
                                                        <div className="flex items-start gap-1.5">
                                                            <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: mat.color }} />
                                                            <div className="min-w-0">
                                                                <p className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-500">{mat.label}</p>
                                                                <p className="text-[9px] text-slate-400">{mat.unit} · Bobot {Math.round(mat.weight * 100)}%</p>
                                                            </div>
                                                        </div>
                                                        {idxVal !== null && idxVal > 0 ? (
                                                            <>
                                                                <p className={`mt-1.5 text-lg font-black leading-none ${trendColor}`}>{idxVal.toFixed(1)}</p>
                                                                <p className="text-[9px] text-slate-500">{arrow} vs base Q4 2025 (100)</p>
                                                                {rawVal !== null && rawVal !== undefined && rawVal > 0 && (
                                                                    <p className="mt-1 text-[9px] font-semibold text-slate-600">{rawVal.toFixed(rawVal < 100 ? 2 : 0)} {mat.unit}</p>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="mt-1.5 text-[10px] text-slate-400">Belum ada data</p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Bottom: Grafik tren indeks + mini overview */}
                                        <div className="grid min-h-0 grid-cols-[1fr_200px] gap-3">
                                            {/* Grafik tren RMI indeks per komponen */}
                                            <div className="rounded-lg border bg-white p-3 shadow-sm">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900">Tren Indeks Harga RMI per Komponen</p>
                                                        <p className="text-[10px] text-slate-500">Indeks berbasis Q4 2025 = 100. Sumber: API ICS Chitra Paratama.</p>
                                                    </div>
                                                    <Badge className="bg-[#0f4c81] text-[10px] text-white">RMI Index</Badge>
                                                </div>
                                                {hasData ? (
                                                    <ResponsiveContainer width="100%" height={280}>
                                                        <LineChart data={chartRows} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                            <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={40} />
                                                            <YAxis width={44} tick={{ fontSize: 9 }} domain={["auto", "auto"]} />
                                                            <Tooltip formatter={(v, n) => [`${Number(v).toFixed(2)}`, n]} />
                                                            <Legend wrapperStyle={{ fontSize: 10 }} />
                                                            <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="5 3" label={{ value: "Base 100", position: "insideTopRight", fontSize: 9, fill: "#64748b" }} />
                                                            <Line type="monotone" dataKey="nr" name="Natural Rubber" stroke={BAR_COLORS[0]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                                                            <Line type="monotone" dataKey="sr" name="Synthetic Rubber" stroke={BAR_COLORS[1]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                                                            <Line type="monotone" dataKey="cb" name="Carbon Black" stroke={BAR_COLORS[2]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                                                            <Line type="monotone" dataKey="sc" name="Steel Cord" stroke={BAR_COLORS[3]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                                                            <Line type="monotone" dataKey="fr" name="Freight" stroke={BAR_COLORS[4]} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                                                            <Line type="monotone" dataKey="rmi" name="RMI Composite" stroke="#0f4c81" strokeWidth={2.8} dot={{ r: 3 }} strokeDasharray="6 3" connectNulls />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                ) : (
                                                    <EmptySlideState message="Belum ada data RMI bulanan (loading...)" />
                                                )}
                                            </div>

                                            {/* Panel kanan: Bobot komponen + RMI composite bulan ini */}
                                            <div className="flex flex-col gap-2">
                                                <div className="rounded-lg border bg-white p-3 shadow-sm">
                                                    <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-600">Komposisi Bobot RMI</p>
                                                    <div className="h-[130px]">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} paddingAngle={2}>
                                                                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                                                </Pie>
                                                                <Tooltip formatter={(v, n) => [`${v}%`, n]} />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {pieData.map(p => (
                                                            <div key={p.name} className="flex items-center justify-between text-[9px] text-slate-600">
                                                                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />{p.name.split(" ")[0]}</span>
                                                                <b>{p.value}%</b>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                {currentMonthData && currentMonthData.rmi > 0 && (
                                                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-sm">
                                                        <p className="text-[10px] font-bold text-blue-700">RMI Composite</p>
                                                        <p className="text-[10px] text-blue-600">{monthLabel(month)}</p>
                                                        <p className="mt-1.5 text-3xl font-black text-[#0f4c81]">{currentMonthData.rmi.toFixed(1)}</p>
                                                        <p className="text-[9px] text-blue-600">vs base 100 (Q4 2025)</p>
                                                        <div className="mt-2 rounded bg-white/80 px-2 py-1 text-[9px] text-blue-800">
                                                            {currentMonthData.rmi > 100 ? "▲ RMI naik dari basis" : currentMonthData.rmi < 100 ? "▼ RMI turun dari basis" : "→ RMI stabil"}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}
                        </Slide>,
                        ...lostStockPages.map((pageCustomers, pageIndex) => {
                            const lsData = lostSaleStockData
                            const totalLost = lsData?.totalLost ?? 0
                            const totalMatched = lsData?.totalMatched ?? 0
                            const totalValue = lsData?.totalValue ?? 0
                            const readyStockCount = lsData?.readyStockCount ?? 0
                            const allMonthItems = lostStockItems
                            const monthMatched = allMonthItems.filter((i: any) => i.hasMatch).length
                            const isFirstPage = pageIndex === 0
                            const slideNum = lostStockSlideStart + pageIndex

                            const STATUS_COLORS: Record<string, string> = { rejected: "#dc2626", expired: "#f97316", cancelled: "#6b7280", lost: "#7c3aed", converted: "#16a34a", approved: "#16a34a" }
                            const CAT_COLORS: Record<string, string> = { TYRE: "#0f4c81", ACC: "#f97316", PART: "#16a34a", OTHER: "#6b7280" }

                            return (
                                <Slide key={`lost-stock-${pageIndex}`} eyebrow={`Slide ${slideNum} — Top Customer By Quotation Expired${lostStockPages.length > 1 ? ` (${pageIndex + 1}/${lostStockPages.length})` : ''}`} title={`Top Customer By Quotation Expired- ${monthLabel(month)}`}>
                                    <div className="flex h-[calc(100%-88px)] flex-col gap-2 overflow-hidden">
                                        {/* KPI Row */}
                                        {isFirstPage && (
                                            <div className="grid grid-cols-4 gap-2">
                                                <div className="rounded-lg border bg-white p-2 shadow-sm">
                                                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Total Lost</p>
                                                    <p className="text-xl font-black text-red-600">{allMonthItems.length}</p>
                                                    <p className="text-[8px] text-slate-400">{topCustSorted.length} customer</p>
                                                </div>
                                                <div className="rounded-lg border bg-white p-2 shadow-sm">
                                                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Total Value</p>
                                                    <p className="text-xl font-black text-red-600">Rp {totalValue.toLocaleString("id-ID")}</p>
                                                </div>
                                                <div className="rounded-lg border bg-white p-2 shadow-sm">
                                                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Bisa Dipulihkan</p>
                                                    <p className="text-xl font-black text-emerald-600">{monthMatched}</p>
                                                </div>
                                                <div className="rounded-lg border bg-white p-2 shadow-sm">
                                                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Ready Stock</p>
                                                    <p className="text-xl font-black text-[#0f4c81]">{readyStockCount}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Customer Cards - compact */}
                                        <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
                                            {pageCustomers.map((cust, ci) => {
                                                const custItems = lostStockItems.filter((i: any) => i.customerName === cust.customerName)
                                                const matchedCount = custItems.filter((i: any) => i.hasMatch).length
                                                const cats = Object.entries(cust.categories).sort(([, a], [, b]) => b.value - a.value)
                                                const rank = pageIndex * 3 + ci + 1

                                                return (
                                                    <div key={ci} className="rounded-lg border bg-white p-2 shadow-sm">
                                                        {/* Customer Header */}
                                                        <div className="mb-1 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0f4c81] text-[10px] font-black text-white">{rank}</span>
                                                                <span className="text-xs font-black text-slate-900">{cust.customerName}</span>
                                                                <span className="text-[9px] text-slate-400">· {cust.itemCount} item · {cust.totalQty} pcs</span>
                                                                {matchedCount > 0 && <span className="rounded bg-emerald-100 px-1 py-0.5 text-[7px] font-bold text-emerald-700">{matchedCount} cocok stok</span>}
                                                            </div>
                                                            <span className="text-sm font-black text-slate-900">Rp {cust.totalValue.toLocaleString("id-ID")}</span>
                                                        </div>

                                                        {/* Category Breakdown - inline */}
                                                        <div className="mb-1 flex flex-wrap gap-1">
                                                            {cats.map(([cat, data]) => (
                                                                <span key={cat} className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8px]" style={{ borderColor: (CAT_COLORS[cat] || "#94a3b8") + "40" }}>
                                                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CAT_COLORS[cat] || "#94a3b8" }} />
                                                                    <span className="font-bold text-slate-700">{cat}</span>
                                                                    <span className="font-black" style={{ color: CAT_COLORS[cat] || "#334155" }}>Rp {data.value.toLocaleString("id-ID")}</span>
                                                                    <span className="text-slate-400">({data.count})</span>
                                                                </span>
                                                            ))}
                                                        </div>

                                                        {/* Items Table - compact */}
                                                        <table className="w-full text-left text-[8px]">
                                                            <thead>
                                                                <tr className="border-b border-slate-200">
                                                                    <th className="pb-0.5 font-medium text-slate-500">Produk</th>
                                                                    <th className="pb-0.5 font-medium text-slate-500">Kategori</th>
                                                                    <th className="pb-0.5 font-medium text-slate-500 text-center">Qty</th>
                                                                    <th className="pb-0.5 font-medium text-slate-500 text-right">Value</th>
                                                                    <th className="pb-0.5 font-medium text-slate-500">Status</th>
                                                                    <th className="pb-0.5 font-medium text-emerald-600">Stock Ready</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {custItems.slice(0, 4).map((item: any, ii: number) => {
                                                                    const up = Number(item.unitPrice || 0)
                                                                    const tv = up * item.quantity
                                                                    return (
                                                                    <tr key={ii} className="border-b border-slate-50 last:border-0">
                                                                        <td className="py-0.5 font-medium text-slate-700 max-w-[130px] truncate" title={item.productName}>{item.productName}</td>
                                                                        <td className="py-0.5">
                                                                            <span className="rounded px-1 py-0.5 text-[6px] font-bold" style={{ backgroundColor: (CAT_COLORS[(item.category || "OTHER").toUpperCase()] || "#94a3b8") + "20", color: CAT_COLORS[(item.category || "OTHER").toUpperCase()] || "#334155" }}>
                                                                                {(item.category || "OTHER").toUpperCase()}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-0.5 text-center font-mono font-bold text-slate-700">{item.quantity}</td>
                                                                        <td className="py-0.5 text-right font-mono font-bold text-slate-700">Rp {tv.toLocaleString("id-ID")}</td>
                                                                        <td className="py-0.5">
                                                                            <span className="rounded px-1 py-0.5 text-[6px] font-bold capitalize" style={{ backgroundColor: (STATUS_COLORS[item.status] || "#94a3b8") + "20", color: STATUS_COLORS[item.status] || "#334155" }}>
                                                                                {item.status}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-0.5">
                                                                            {item.hasMatch ? (
                                                                                <div className="flex items-center gap-0.5">
                                                                                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                                                                    <span className="truncate text-[7px] text-emerald-700 font-medium max-w-[80px]">{item.matchedStock[0]?.materialDesc}</span>
                                                                                    <span className="text-[6px] font-bold text-emerald-600 whitespace-nowrap">({item.matchedStock[0]?.totalQty} pcs)</span>
                                                                                </div>
                                                                            ) : <span className="text-slate-300">—</span>}
                                                                        </td>
                                                                    </tr>
                                                                    )
                                                                })}
                                                                {custItems.length > 4 && (
                                                                    <tr><td colSpan={6} className="py-0.5 text-center text-[7px] text-slate-400">+{custItems.length - 4} item lainnya</td></tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </Slide>
                            )
                        }),
                        <Slide key="slow-moving-chart" eyebrow={`Slide ${slowMovingChartSlide} - Slow Moving Report`} title="Slow Moving Report — Dashboard">
                            <div className="grid h-[calc(100%-88px)] grid-rows-[auto_1fr] gap-2 overflow-hidden">
                                {/* KPI Summary - compact */}
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 px-3 py-2 shadow-sm">
                                        <p className="text-[9px] font-bold uppercase tracking-wide text-blue-700">Total Revenue</p>
                                        <p className="text-lg font-black text-blue-950">{slowMovingData ? formatMoney(slowMovingData.summary.totalAmount) : "-"}</p>
                                    </div>
                                    <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-3 py-2 shadow-sm">
                                        <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Total Qty Terjual</p>
                                        <p className="text-lg font-black text-emerald-950">{slowMovingData ? `${slowMovingData.summary.totalQty.toLocaleString("id-ID")} pcs` : "-"}</p>
                                    </div>
                                    <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 px-3 py-2 shadow-sm">
                                        <p className="text-[9px] font-bold uppercase tracking-wide text-purple-700">Salesman Terlibat</p>
                                        <p className="text-lg font-black text-purple-950">{slowMovingData?.topSalesman?.length || 0}</p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 px-3 py-2 shadow-sm">
                                        <p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Pelanggan Aktif</p>
                                        <p className="text-lg font-black text-amber-950">{slowMovingData?.topCustomers?.length || 0}</p>
                                    </div>
                                </div>

                                {/* Charts Row */}
                                <div className="grid min-h-0 grid-cols-[1.2fr_0.8fr] gap-2">
                                    {/* YoY Trend Composed Chart */}
                                    <div className="flex min-h-0 flex-col rounded-lg border bg-white p-2 shadow-sm">
                                        <div className="mb-1">
                                            <p className="text-xs font-black text-slate-900">Tren Penjualan YoY</p>
                                            <p className="text-[9px] text-slate-500">Revenue (Bar) & Qty (Line) antar tahun</p>
                                        </div>
                                        <div className="min-h-0 flex-1">
                                            {slowMovingData && slowMovingData.monthlyTrend.length > 0 ? (() => {
                                                const selectedYearList = ["2025", "2026"]
                                                const yoyMap = new Map<string, any>()
                                                const months = ["01","02","03","04","05","06","07","08","09","10","11","12"]
                                                months.forEach(m => yoyMap.set(m, { month: m }))
                                                slowMovingData.monthlyTrend.forEach(item => {
                                                    const [yr, mo] = item.period.split("-")
                                                    if (yr && mo) {
                                                        const mData = yoyMap.get(mo)
                                                        if (mData) {
                                                            mData[`qty_${yr}`] = item.qty
                                                            mData[`amount_${yr}`] = item.amount
                                                        }
                                                    }
                                                })
                                                const trendDataLocal = Array.from(yoyMap.values())
                                                const BAR_COLORS_LOCAL = ['#3b82f6','#f59e0b','#10b981','#8b5cf6']
                                                const LINE_COLORS_LOCAL = ['#1d4ed8','#d97706','#047857','#6d28d9']
                                                return (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <ComposedChart data={trendDataLocal} margin={{ top: 8, right: 50, bottom: 0, left: 0 }}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                            <XAxis dataKey="month" tickFormatter={(v) => { const m = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"]; return m[parseInt(v)-1] || v }} tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                                                            <YAxis yAxisId="left" orientation="left" tickFormatter={(value) => formatNumber(value)} tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} width={50} />
                                                            <YAxis yAxisId="right" orientation="right" tickFormatter={formatRupiahAxis} tick={{ fontSize: 8, fill: '#1e3a8a', fontWeight: 600 }} width={80} axisLine={{ stroke: '#bfdbfe' }} tickLine={false} />
                                                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number, name: string) => { if (name.startsWith("Revenue")) return [formatCurrency(value), name]; return [formatNumber(value), name] }} labelFormatter={(label) => { const m = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"]; return m[parseInt(label)-1] || label }} />
                                                            <Legend wrapperStyle={{ fontSize: 9 }} />
                                                            {selectedYearList.map((year, idx) => (
                                                                <Bar key={`bar-${year}`} yAxisId="right" dataKey={`amount_${year}`} name={`Revenue ${year}`} fill={BAR_COLORS_LOCAL[idx % BAR_COLORS_LOCAL.length]} radius={[3, 3, 0, 0]} maxBarSize={22}>
                                                                    <LabelList dataKey={`amount_${year}`} position="top" formatter={formatCompactCurrency} style={{ fontSize: 7, fill: '#64748b' }} />
                                                                </Bar>
                                                            ))}
                                                            {selectedYearList.map((year, idx) => (
                                                                <Line key={`line-${year}`} yAxisId="left" type="monotone" dataKey={`qty_${year}`} name={`Qty ${year}`} stroke={LINE_COLORS_LOCAL[idx % LINE_COLORS_LOCAL.length]} strokeWidth={2} dot={{ r: 2, fill: LINE_COLORS_LOCAL[idx % LINE_COLORS_LOCAL.length], strokeWidth: 1.5, stroke: '#fff' }} />
                                                            ))}
                                                        </ComposedChart>
                                                    </ResponsiveContainer>
                                                )
                                            })() : <EmptySlideState message="Memuat data slow moving..." />}
                                        </div>
                                    </div>

                                    {/* Right: Top Salesman + Top Customers */}
                                    <div className="grid min-h-0 grid-rows-[1fr_1fr] gap-2">
                                        <div className="flex min-h-0 flex-col rounded-lg border bg-white p-2 shadow-sm">
                                            <p className="mb-1 text-[11px] font-black text-slate-900">Top Salesman</p>
                                            <div className="min-h-0 flex-1">
                                                {slowMovingData?.topSalesman?.length ? (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={slowMovingData.topSalesman.slice(0, 5)} layout="vertical" margin={{ top: 2, right: 28, left: 2, bottom: 2 }}>
                                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                                            <XAxis type="number" hide />
                                                            <YAxis dataKey="salesman" type="category" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 8 }} width={90} />
                                                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => formatCurrency(value)} />
                                                            <Bar dataKey="amount" name="Revenue" radius={[0, 3, 3, 0]}>
                                                                <LabelList dataKey="amount" position="right" formatter={formatCompactCurrency} style={{ fontSize: 7, fill: '#64748b' }} />
                                                                {slowMovingData.topSalesman.slice(0, 5).map((_, index) => <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />)}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                ) : <EmptySlideState message="Tidak ada data salesman." />}
                                            </div>
                                        </div>
                                        <div className="flex min-h-0 flex-col rounded-lg border bg-white p-2 shadow-sm">
                                            <p className="mb-1 text-[11px] font-black text-slate-900">Top Pelanggan</p>
                                            <div className="min-h-0 flex-1">
                                                {slowMovingData?.topCustomers?.length ? (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie data={slowMovingData.topCustomers.slice(0, 5)} cx="50%" cy="50%" innerRadius={28} outerRadius={55} paddingAngle={2} dataKey="amount" nameKey="customerName" label={({ name, percent }) => { const n = String(name || "?"); const t = n.length > 10 ? n.slice(0, 10) + "..." : n; return `${t} ${(percent * 100).toFixed(0)}%` }} labelLine={false}>
                                                                {slowMovingData.topCustomers.slice(0, 5).map((_, index) => <Cell key={index} fill={BAR_COLORS[(index + 3) % BAR_COLORS.length]} />)}
                                                            </Pie>
                                                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => formatCurrency(value)} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                ) : <EmptySlideState message="Tidak ada data pelanggan." />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Slide>,
                        <Slide key="slow-moving-table" eyebrow={`Slide ${slowMovingTableSlide} - Slow Moving Report`} title="Slow Moving Report — Detail Data">
                            <div className="grid h-[calc(100%-88px)] grid-cols-[1fr_1fr] gap-2 overflow-hidden">
                                {/* Left: Watch Products (high stock, low sales) + Summary */}
                                <div className="flex min-h-0 flex-col gap-2">
                                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-red-200 bg-red-50/50 p-2 shadow-sm">
                                        <div className="mb-1">
                                            <p className="text-xs font-black text-red-900">Watch Products — High Stock, Low Sales</p>
                                            <p className="text-[9px] text-red-600">Top 11 produk dengan stock tersisa terbesar yang perlu dijual</p>
                                        </div>
                                        <div className="min-h-0 flex-1 overflow-auto">
                                            <ReportTable>
                                                <thead>
                                                    <tr>
                                                        <TableHeadCell className="bg-red-600">No</TableHeadCell>
                                                        <TableHeadCell className="bg-red-600">Product</TableHeadCell>
                                                        <TableHeadCell className="bg-red-600 text-right">Stock Awal</TableHeadCell>
                                                        <TableHeadCell className="bg-red-600 text-right">Terjual</TableHeadCell>
                                                        <TableHeadCell className="bg-red-600 text-right">Stock Curr</TableHeadCell>
                                                        <TableHeadCell className="bg-red-600 text-right">Valuation</TableHeadCell>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {slowMovingData?.watchProducts?.length ? slowMovingData.watchProducts.filter(wp => wp.remainingStock > 0).map((wp, idx) => {
                                                        const isWarning = wp.remainingStock > 0 && wp.remainingStock >= wp.initialStock * 0.5
                                                        return (
                                                        <tr key={wp.materialKey} className={isWarning ? "bg-red-50" : ""}>
                                                            <TableCellCompact className="font-bold">{idx + 1}</TableCellCompact>
                                                            <TableCellCompact>
                                                                <div className="max-w-[140px]">
                                                                    <p className="font-semibold text-[9px] leading-tight truncate" title={wp.materialKey}>{wp.materialKey}</p>
                                                                    <p className="text-[8px] text-slate-500 truncate" title={wp.description}>{wp.description}</p>
                                                                </div>
                                                            </TableCellCompact>
                                                            <TableCellCompact className="text-right tabular-nums">{wp.initialStock.toLocaleString("id-ID")}</TableCellCompact>
                                                            <TableCellCompact className="text-right tabular-nums text-emerald-700">{wp.totalSold.toLocaleString("id-ID")}</TableCellCompact>
                                                            <TableCellCompact className="text-right tabular-nums font-black">{wp.remainingStock.toLocaleString("id-ID")}</TableCellCompact>
                                                            <TableCellCompact className={`text-right font-black tabular-nums ${isWarning ? "text-red-700" : ""}`}>{formatUSD(wp.remainingValue)}</TableCellCompact>
                                                        </tr>
                                                        )
                                                    }) : <tr><TableCellCompact colSpan={6} className="text-center text-red-400">Memuat data...</TableCellCompact></tr>}
                                                </tbody>
                                            </ReportTable>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 shadow-sm">
                                            <p className="text-[8px] font-bold uppercase tracking-wide text-blue-600">Total Valuation Slow Moving</p>
                                            <p className="text-sm font-black text-blue-900">{slowMovingData ? formatMoney(slowMovingData.summary.totalAmount) : "-"}</p>
                                        </div>
                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 shadow-sm">
                                            <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-600">Total Qty</p>
                                            <p className="text-sm font-black text-emerald-900">{slowMovingData ? `${slowMovingData.summary.totalQty.toLocaleString("id-ID")} pcs` : "-"}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Tire Sold in Month (full height) */}
                                <div className="flex min-h-0 flex-col gap-2">
                                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-orange-200 bg-orange-50/50 p-2 shadow-sm">
                                        <div className="mb-1">
                                            <p className="text-xs font-black text-orange-900">Tire Sold — {monthLabel(month)}</p>
                                            <p className="text-[9px] text-orange-600">Penjualan slow moving di bulan terfilter</p>
                                        </div>
                                        <div className="min-h-0 flex-1 overflow-auto">
                                            <ReportTable>
                                                <thead>
                                                    <tr>
                                                        <TableHeadCell className="bg-orange-500">No</TableHeadCell>
                                                        <TableHeadCell className="bg-orange-500">Product Name</TableHeadCell>
                                                        <TableHeadCell className="bg-orange-500">Tire Size</TableHeadCell>
                                                        <TableHeadCell className="bg-orange-500">Sales</TableHeadCell>
                                                        <TableHeadCell className="bg-orange-500 text-right">Qty</TableHeadCell>
                                                        <TableHeadCell className="bg-orange-500 text-right">Revenue</TableHeadCell>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {slowMovingData?.monthlyTireDetail?.length ? slowMovingData.monthlyTireDetail.map((ts, idx) => (
                                                        <tr key={`${ts.productName}-${ts.salesman}-${idx}`}>
                                                            <TableCellCompact className="font-bold">{idx + 1}</TableCellCompact>
                                                            <TableCellCompact className="font-semibold max-w-[160px] truncate" title={ts.productName}>{ts.productName}</TableCellCompact>
                                                            <TableCellCompact>{ts.tireSize}</TableCellCompact>
                                                            <TableCellCompact className="text-[9px]">{ts.salesman}</TableCellCompact>
                                                            <TableCellCompact className="text-right tabular-nums">{ts.qty.toLocaleString("id-ID")}</TableCellCompact>
                                                            <TableCellCompact className="text-right font-black tabular-nums">{formatMoney(ts.amount)}</TableCellCompact>
                                                        </tr>
                                                    )) : <tr><TableCellCompact colSpan={6} className="text-center text-orange-400">Tidak ada penjualan di bulan ini</TableCellCompact></tr>}
                                                </tbody>
                                            </ReportTable>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border-l-4 border-[#f97316] bg-white px-2 py-1.5 text-[10px] font-semibold leading-snug text-slate-700 shadow-sm">
                                        Slow moving inventory perlu dipantau berkala untuk strategi promosi & clearance.
                                    </div>
                                </div>
                            </div>
                        </Slide>,
                        <Slide key="a2r-competition" eyebrow={`Slide ${a2rSlide} - A2R Competition`} title={`A2R Competition — ${monthLabel(month)}`}>
                            <div className="grid h-[calc(100%-88px)] grid-rows-[auto_1fr_auto] gap-2 overflow-hidden">
                                {/* Top: Grand Champion + Monthly Leader */}
                                <div className="grid grid-cols-[1fr_1fr] gap-2">
                                    {/* Grand Champion */}
                                    {a2rData?.grandChampion && (() => {
                                        const gc = a2rData.grandChampion
                                        const ml = a2rData?.monthlyLeaders?.[0]?.leader
                                        const isSame = ml && gc.salesman === ml.salesman
                                        return (
                                            <div className="rounded-lg bg-gradient-to-r from-amber-50 to-orange-100 border border-amber-300 p-3 shadow-sm flex items-center gap-3">
                                                <div className="rounded-full bg-amber-400 p-2.5 shadow-md">
                                                    <Trophy className="h-6 w-6 text-white" />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase tracking-wide text-amber-700">Grand Champion {isSame ? `& ${a2rData.monthlyLeaders[0].periodLabel}` : ""}</p>
                                                    <p className="text-lg font-black text-amber-950">{gc.salesman}</p>
                                                    <p className="text-[10px] text-amber-700">{gc.totalPoints.toLocaleString("id-ID")} pts · {formatCurrency(gc.revenueActual)} revenue{isSame ? ` · Juara ${a2rData.monthlyLeaders[0].periodLabel}` : ""}</p>
                                                </div>
                                            </div>
                                        )
                                    })()}
                                    {/* Monthly Leader (only if different from Grand Champion) */}
                                    {a2rData?.monthlyLeaders?.[0]?.leader && a2rData.grandChampion && a2rData.monthlyLeaders[0].leader.salesman !== a2rData.grandChampion.salesman && (
                                        <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-100 border border-blue-200 p-3 shadow-sm flex items-center gap-3">
                                            <div className="rounded-full bg-blue-500 p-2.5 shadow-md">
                                                <Target className="h-6 w-6 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wide text-blue-700">{a2rData.monthlyLeaders[0].periodLabel}</p>
                                                <p className="text-lg font-black text-blue-950">{a2rData.monthlyLeaders[0].leader.salesman}</p>
                                                <p className="text-[10px] text-blue-700">{a2rData.monthlyLeaders[0].leader.totalPoints.toLocaleString("id-ID")} pts</p>
                                            </div>
                                        </div>
                                    )}
                                    {/* If same person, show scoring summary instead */}
                                    {a2rData?.monthlyLeaders?.[0]?.leader && a2rData.grandChampion && a2rData.monthlyLeaders[0].leader.salesman === a2rData.grandChampion.salesman && a2rData.summary && (
                                        <div className="rounded-lg bg-gradient-to-r from-emerald-50 to-teal-100 border border-emerald-200 p-3 shadow-sm flex items-center gap-3">
                                            <div className="rounded-full bg-emerald-500 p-2.5 shadow-md">
                                                <Sparkles className="h-6 w-6 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Summary</p>
                                                <p className="text-lg font-black text-emerald-950">{a2rData.summary.activeSalesmen} Salesman</p>
                                                <p className="text-[10px] text-emerald-700">{formatCompactCurrency(a2rData.summary.totalRevenue)} revenue · {(a2rData.summary.achievementPct || 0).toFixed(0)}% achievement</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Middle: Ranking Table */}
                                <div className="min-h-0 rounded-lg border bg-white p-2 shadow-sm">
                                    <p className="mb-1 text-xs font-black text-slate-900">Ranking Salesman — {monthLabel(month)}</p>
                                    <div className="min-h-0 h-[calc(100%-24px)] overflow-auto">
                                        <ReportTable>
                                            <thead>
                                                <tr>
                                                    <TableHeadCell className="bg-[#0f4c81]">Rank</TableHeadCell>
                                                    <TableHeadCell className="bg-[#0f4c81]">Salesman</TableHeadCell>
                                                    <TableHeadCell className="bg-[#0f4c81] text-right">Revenue</TableHeadCell>
                                                    <TableHeadCell className="bg-[#0f4c81] text-right">Target</TableHeadCell>
                                                    <TableHeadCell className="bg-[#0f4c81] text-right">Achieve</TableHeadCell>
                                                    <TableHeadCell className="bg-[#0f4c81] text-right">R49</TableHeadCell>
                                                    <TableHeadCell className="bg-[#0f4c81] text-right">Cosm</TableHeadCell>
                                                    <TableHeadCell className="bg-[#0f4c81] text-right">Inv</TableHeadCell>
                                                    <TableHeadCell className="bg-[#0f4c81] text-right">SM</TableHeadCell>
                                                    <TableHeadCell className="bg-[#0f4c81] text-right">Total Pts</TableHeadCell>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {a2rData?.rows?.length ? a2rData.rows.slice(0, 10).map((row: any, idx: number) => (
                                                    <tr key={row.salesman} className={idx === 0 ? "bg-amber-50" : idx === 1 ? "bg-slate-50" : ""}>
                                                        <TableCellCompact>
                                                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black ${idx === 0 ? "bg-amber-400 text-white" : idx === 1 ? "bg-slate-300 text-white" : "bg-slate-200 text-slate-600"}`}>{idx + 1}</span>
                                                        </TableCellCompact>
                                                        <TableCellCompact className="font-semibold max-w-[120px] truncate" title={row.salesman}>{row.salesman}</TableCellCompact>
                                                        <TableCellCompact className="text-right tabular-nums text-[10px]">{formatCompactCurrency(row.revenueActual)}</TableCellCompact>
                                                        <TableCellCompact className="text-right tabular-nums text-[10px]">{formatCompactCurrency(row.revenueTarget)}</TableCellCompact>
                                                        <TableCellCompact className={`text-right tabular-nums font-black text-[10px] ${(row.achievementPct || 0) >= 100 ? "text-emerald-600" : "text-orange-600"}`}>{(row.achievementPct || 0).toFixed(0)}%</TableCellCompact>
                                                        <TableCellCompact className="text-right tabular-nums">{Math.round(row.r49Points || 0)}</TableCellCompact>
                                                        <TableCellCompact className="text-right tabular-nums">{Math.round(row.cosmeticPoints || 0)}</TableCellCompact>
                                                        <TableCellCompact className="text-right tabular-nums">{Math.round(row.inventoryPoints || 0)}</TableCellCompact>
                                                        <TableCellCompact className="text-right tabular-nums">{Math.round(row.slowMovingPoints || 0)}</TableCellCompact>
                                                        <TableCellCompact className="text-right font-black tabular-nums text-[#0f4c81]">{Math.round(row.totalPoints || 0)}</TableCellCompact>
                                                    </tr>
                                                )) : <tr><TableCellCompact colSpan={10} className="text-center text-slate-400">Loading A2R Competition data...</TableCellCompact></tr>}
                                            </tbody>
                                        </ReportTable>
                                    </div>
                                </div>

                                {/* Bottom: Scoring Rules */}
                                <div className="grid grid-cols-5 gap-1.5">
                                    <div className="rounded-md border border-slate-200 bg-white p-1.5 shadow-sm text-center">
                                        <p className="text-[8px] font-black text-slate-900 mb-0.5">Target Revenue</p>
                                        <p className="text-[7px] leading-tight text-slate-500">Poin = achievement %, cap 120</p>
                                    </div>
                                    <div className="rounded-md border border-slate-200 bg-white p-1.5 shadow-sm text-center">
                                        <p className="text-[8px] font-black text-slate-900 mb-0.5">27.00R49</p>
                                        <p className="text-[7px] leading-tight text-slate-500">Harga satuan = revenue/qty, &gt;= Rp 215jt/tire = 100 poin per customer</p>
                                    </div>
                                    <div className="rounded-md border border-slate-200 bg-white p-1.5 shadow-sm text-center">
                                        <p className="text-[8px] font-black text-slate-900 mb-0.5">Cosmetic Tire</p>
                                        <p className="text-[7px] leading-tight text-slate-500">Match material + serial delivery = 50 poin per customer</p>
                                    </div>
                                    <div className="rounded-md border border-slate-200 bg-white p-1.5 shadow-sm text-center">
                                        <p className="text-[8px] font-black text-slate-900 mb-0.5">Existing Inventory</p>
                                        <p className="text-[7px] leading-tight text-slate-500">Non slow moving, non-R49 = 10 poin per material</p>
                                    </div>
                                    <div className="rounded-md border border-slate-200 bg-white p-1.5 shadow-sm text-center">
                                        <p className="text-[8px] font-black text-slate-900 mb-0.5">Slow Moving</p>
                                        <p className="text-[7px] leading-tight text-slate-500">Material slow moving = 20 poin per material</p>
                                    </div>
                                </div>
                            </div>
                        </Slide>,
                        <Slide key="procurement-chart" eyebrow={`Slide ${procurementChartSlide} - Order Fulfillment`} title="Order Fulfillment — Forecast & Urgency">
                            <div className="grid h-[calc(100%-88px)] grid-cols-[1.4fr_0.6fr] gap-3 overflow-hidden">
                                {/* Left: Forecast Trend Chart */}
                                <div className="flex min-h-0 flex-col rounded-lg border bg-white p-3 shadow-sm">
                                    <div className="mb-2">
                                        <p className="text-xs font-black text-slate-900">Demand Forecast Trend</p>
                                        <p className="text-[9px] text-slate-500">Actual sales, predicted lost sales, projected stock, forecast demand</p>
                                    </div>
                                    <div className="min-h-0 flex-1">
                                        {procurementData?.charts?.forecastTrend?.length ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={procurementData.charts.forecastTrend} margin={{ top: 8, right: 50, bottom: 4, left: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                                                    <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#7c3aed', fontWeight: 600 }} width={60} axisLine={false} tickLine={false} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 10 }} />
                                                    <Legend wrapperStyle={{ fontSize: 10 }} />
                                                    <Bar yAxisId="left" dataKey="actualSales" name="Actual Sales" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
                                                    <Bar yAxisId="left" dataKey="predictedLostSales" name="Predicted Lost" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={20} />
                                                    <Line yAxisId="right" type="monotone" dataKey="projectedStock" name="Projected Stock" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                                                    <Line yAxisId="left" type="monotone" dataKey="forecastSales" name="Forecast Demand" stroke="#06b6d4" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2 }} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        ) : <EmptySlideState message="Memuat data forecast..." />}
                                    </div>
                                    {procurementData?.summary && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <span className="rounded-md bg-red-50 px-2 py-0.5 text-[8px] font-bold text-red-700 border border-red-200">Urgent: {procurementData.summary.urgentItems} items</span>
                                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[8px] font-bold text-amber-700 border border-amber-200">Soon: {procurementData.summary.soonItems} items</span>
                                            <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[8px] font-bold text-sky-700 border border-sky-200">Watch: {procurementData.summary.watchItems} items</span>
                                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700 border border-emerald-200">Healthy: {procurementData.summary.healthyItems} items</span>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Urgency Breakdown Pie + Category Risk */}
                                <div className="flex min-h-0 flex-col gap-2">
                                    {/* Urgency Pie */}
                                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-white p-2 shadow-sm">
                                        <p className="mb-1 text-[10px] font-black text-slate-900 text-center">Urgency Mix</p>
                                        <div className="min-h-0 flex-1">
                                            {procurementData?.charts?.urgencyBreakdown?.length ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie data={procurementData.charts.urgencyBreakdown} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                                            {procurementData.charts.urgencyBreakdown.map((entry: any, index: number) => (
                                                                <Cell key={index} fill={entry.fill || BAR_COLORS[index % BAR_COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 10 }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            ) : <EmptySlideState message="Loading..." />}
                                        </div>
                                    </div>

                                    {/* Category Risk */}
                                    <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-white p-2 shadow-sm">
                                        <p className="mb-1 text-[10px] font-black text-slate-900">Risk by Category</p>
                                        <div className="min-h-0 flex-1">
                                            {procurementData?.charts?.categoryRisk?.length ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={procurementData.charts.categoryRisk.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                        <XAxis type="number" tick={{ fontSize: 8 }} />
                                                        <YAxis type="category" dataKey="category" tick={{ fontSize: 8 }} width={70} />
                                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 9 }} />
                                                        <Bar dataKey="urgent" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="soon" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="watch" stackId="a" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="healthy" stackId="a" fill="#22c55e" radius={[0, 3, 3, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : <EmptySlideState message="Loading..." />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Slide>,
                        <Slide key="procurement-top" eyebrow={`Slide ${procurementTopSlide} - Order Fulfillment`} title="Top 15 Urgent — Segera Diorder">
                            <div className="h-[calc(100%-88px)] overflow-hidden rounded-lg border bg-white p-3 shadow-sm">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Produk Urgent — Perlu Segera Diorder</p>
                                        <p className="text-[10px] text-slate-500">Diurutkan berdasarkan recommended qty terbesar (stock tidak cukup untuk {procurementData?.filters?.horizonMonths || 6} bulan ke depan)</p>
                                    </div>
                                    {procurementData?.summary && (
                                        <div className="flex gap-2">
                                            <span className="rounded-md bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700 border border-red-200">Total Order Qty: {procurementData.summary.totalRecommendedQty.toLocaleString("id-ID")}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="min-h-0 h-[calc(100%-48px)] overflow-auto">
                                    <ReportTable>
                                        <thead>
                                            <tr>
                                                <TableHeadCell className="bg-red-600">No</TableHeadCell>
                                                <TableHeadCell className="bg-red-600">Material</TableHeadCell>
                                                <TableHeadCell className="bg-red-600">Description</TableHeadCell>
                                                <TableHeadCell className="bg-red-600 text-right">Stock</TableHeadCell>
                                                <TableHeadCell className="bg-red-600 text-right">Min Stock</TableHeadCell>
                                                <TableHeadCell className="bg-red-600 text-right">Sold 60D</TableHeadCell>
                                                <TableHeadCell className="bg-red-600 text-right">Monthly Avg</TableHeadCell>
                                                <TableHeadCell className="bg-red-600 text-right">Days Cover</TableHeadCell>
                                                <TableHeadCell className="bg-red-600 text-right">Order Qty</TableHeadCell>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {procurementData?.items?.filter((item: any) => item.priority === "urgent").slice(0, 15).map((item: any, idx: number) => (
                                                <tr key={item.stockLevelId} className={idx < 3 ? "bg-red-50" : ""}>
                                                    <TableCellCompact className="font-bold">{idx + 1}</TableCellCompact>
                                                    <TableCellCompact className="font-semibold text-[9px] max-w-[100px] truncate" title={item.materialNumber}>{item.materialNumber}</TableCellCompact>
                                                    <TableCellCompact className="text-[9px] max-w-[140px] truncate" title={item.description}>{item.description || "-"}</TableCellCompact>
                                                    <TableCellCompact className="text-right tabular-nums font-black text-red-600">{item.currentStock}</TableCellCompact>
                                                    <TableCellCompact className="text-right tabular-nums">{item.minStock}</TableCellCompact>
                                                    <TableCellCompact className="text-right tabular-nums">{item.sold60d}</TableCellCompact>
                                                    <TableCellCompact className="text-right tabular-nums">{item.monthlyAvg.toFixed(1)}</TableCellCompact>
                                                    <TableCellCompact className="text-right tabular-nums font-black text-red-600">{item.daysCover60d !== null ? `${item.daysCover60d.toFixed(0)}d` : "-"}</TableCellCompact>
                                                    <TableCellCompact className="text-right font-black tabular-nums text-[#0f4c81]">{item.recommendedQty.toLocaleString("id-ID")}</TableCellCompact>
                                                </tr>
                                            ))}
                                            {(!procurementData?.items || procurementData.items.filter((item: any) => item.priority === "urgent").length === 0) && (
                                                <tr><TableCellCompact colSpan={9} className="text-center text-slate-400">Memuat data procurement...</TableCellCompact></tr>
                                            )}
                                        </tbody>
                                    </ReportTable>
                                </div>
                            </div>
                        </Slide>,
                        ...(fleetPages.length > 0 ? fleetPages.map((pageRows, pageIndex) => {
                            const totalUnits = pageRows.reduce((acc: number, item: any) => acc + (parseInt(item.unit_qty) || 0), 0)
                            const totalTires = pageRows.reduce((acc: number, item: any) => acc + (parseInt(item.totaltire) || 0), 0)
                            const totalCustomers = new Set(pageRows.map((item: any) => item.customer)).size
                            const totalSites = new Set(pageRows.map((item: any) => item.site)).size
                            const isFirstPage = pageIndex === 0
                            return (
                                <Slide key={`fleet-${pageIndex}`} eyebrow={`Slide ${fleetSlide + pageIndex} - Fleet List${fleetPages.length > 1 ? ` (${pageIndex + 1}/${fleetPages.length})` : ""}`} title={`Fleet List Update — ${monthLabel(month)}`}>
                                    <div className="grid h-[calc(100%-88px)] grid-rows-[auto_1fr] gap-3 overflow-hidden">
                                        {isFirstPage && (
                                            <div className="grid grid-cols-4 gap-2">
                                                <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 px-3 py-2 shadow-sm">
                                                    <p className="text-[9px] font-bold uppercase tracking-wide text-blue-700">Units Updated</p>
                                                    <p className="text-lg font-black text-blue-950">{totalUnits.toLocaleString()}</p>
                                                </div>
                                                <div className="rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100/50 px-3 py-2 shadow-sm">
                                                    <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-700">Total Tires</p>
                                                    <p className="text-lg font-black text-indigo-950">{totalTires.toLocaleString()}</p>
                                                </div>
                                                <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-3 py-2 shadow-sm">
                                                    <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">Customers</p>
                                                    <p className="text-lg font-black text-emerald-950">{totalCustomers}</p>
                                                </div>
                                                <div className="rounded-lg border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 px-3 py-2 shadow-sm">
                                                    <p className="text-[9px] font-bold uppercase tracking-wide text-orange-700">Sites</p>
                                                    <p className="text-lg font-black text-orange-950">{totalSites}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="min-h-0 overflow-hidden rounded-lg border bg-white p-3 shadow-sm">
                                            <p className="mb-2 text-sm font-black text-slate-900">Fleet List — Updated {monthLabel(month)}{fleetPages.length > 1 ? ` (Page ${pageIndex + 1})` : ""}</p>
                                            <div className="h-[calc(100%-28px)] overflow-auto">
                                                <ReportTable>
                                                    <colgroup>
                                                        <col className="w-[16%]" />
                                                        <col className="w-[10%]" />
                                                        <col className="w-[10%]" />
                                                        <col className="w-[12%]" />
                                                        <col className="w-[10%]" />
                                                        <col className="w-[10%]" />
                                                        <col className="w-[10%]" />
                                                        <col className="w-[8%]" />
                                                        <col className="w-[8%]" />
                                                        <col className="w-[6%]" />
                                                    </colgroup>
                                                    <thead>
                                                        <tr>
                                                            <TableHeadCell>Customer</TableHeadCell>
                                                            <TableHeadCell>Site</TableHeadCell>
                                                            <TableHeadCell>Status</TableHeadCell>
                                                            <TableHeadCell>Location</TableHeadCell>
                                                            <TableHeadCell>Manufacture</TableHeadCell>
                                                            <TableHeadCell>Model</TableHeadCell>
                                                            <TableHeadCell>Tire Size</TableHeadCell>
                                                            <TableHeadCell className="text-right">Units</TableHeadCell>
                                                            <TableHeadCell className="text-right">Tires</TableHeadCell>
                                                            <TableHeadCell>Last Update</TableHeadCell>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pageRows.map((item: any, idx: number) => (
                                                            <tr key={item.id_fleet_list || idx}>
                                                                <TableCellCompact className="font-semibold text-[10px] max-w-[120px] truncate" title={item.customer}>{item.customer}</TableCellCompact>
                                                                <TableCellCompact className="text-[10px]">{item.site}</TableCellCompact>
                                                                <TableCellCompact>
                                                                    <span className={`inline-block rounded px-1 py-0.5 text-[8px] font-bold ${item.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
                                                                </TableCellCompact>
                                                                <TableCellCompact className="text-[10px] max-w-[100px] truncate" title={item.location}>{item.location}</TableCellCompact>
                                                                <TableCellCompact className="text-[10px]">{item.unit_manufacture}</TableCellCompact>
                                                                <TableCellCompact className="text-[10px]">{item.model}</TableCellCompact>
                                                                <TableCellCompact className="text-[10px]">{item.tire_size}</TableCellCompact>
                                                                <TableCellCompact className="text-right tabular-nums text-[10px]">{item.unit_qty}</TableCellCompact>
                                                                <TableCellCompact className="text-right tabular-nums font-black text-[10px]">{item.totaltire}</TableCellCompact>
                                                                <TableCellCompact className="tabular-nums text-[9px]">{item.lastupdate}</TableCellCompact>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </ReportTable>
                                            </div>
                                        </div>
                                    </div>
                                </Slide>
                            )
                        }) : [
                            <Slide key="fleet-empty" eyebrow={`Slide ${fleetSlide} - Fleet List`} title={`Fleet List Update — ${monthLabel(month)}`}>
                                <div className="flex h-[calc(100%-88px)] items-center justify-center rounded-lg border border-dashed bg-white text-sm text-slate-500">
                                    {fleetData.length === 0 ? "Memuat data fleet..." : "Tidak ada update fleet di bulan ini."}
                                </div>
                            </Slide>
                        ]),
                        <Slide key="thanks" eyebrow={`Slide ${closingSlide} - Closing`} title="Thank You / Closing">
                            <div className="flex h-[calc(100%-88px)] flex-col items-center justify-center rounded-lg bg-[#0f4c81] text-center text-white">
                                <Image src="/cp_logo_alpha.png" alt="Chitra Paratama" width={190} height={80} className="mb-8 h-20 w-auto rounded bg-white/95 p-3" />
                                <p className="text-7xl font-black">Thank You!</p>
                                <p className="mt-5 text-xl text-blue-100">BIMA - Monthly Competitor Dashboard - {monthLabel(month)}</p>
                            </div>
                        </Slide>,
                    ].map((slide, index) => (
                        <div key={slide.key} ref={(node) => { slideRefs.current[index] = node }} className="mx-auto w-full max-w-[1350px]">
                            {slide}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
