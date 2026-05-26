"use client"

import * as React from "react"
import { updateSetting } from "@/app/actions/settings"
import {
    deleteSlowMovingProduct,
    importSlowMovingProducts,
    updateSlowMovingProductInitialStock,
} from "@/app/actions/slow-moving-products"
import type { MonthlySellingQty, SellingOutDetail } from "@/app/actions/slow-moving-products"
import type { getStocks } from "@/app/actions/stock"
import { Box, ChevronRight, Download, Loader2, PackageSearch, RotateCcw, Search, Trash2, Upload, ArrowUpDown } from "lucide-react"
import * as XLSX from "xlsx"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type StockRow = Awaited<ReturnType<typeof getStocks>>[number]
type SavedSlowMovingProduct = Awaited<ReturnType<typeof import("@/app/actions/slow-moving-products").getSlowMovingProducts>>[number]

type ProductOption = {
    key: string
    materialNumber: string
    description: string
    totalQty: number
    stockCount: number
}

type SlowMovingRow = ProductOption & {
    initialStock: number
    unitPrice: number
    totalValue: number
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

function parseNumber(value: string | number | null | undefined) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0
    }
    if (!value) return 0
    const normalized = String(value).replace(/,/g, "").trim()
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
}

function getMaterialKey(stock: StockRow) {
    const materialNumber = stock.product?.materialNumber?.trim()
    return materialNumber ? materialNumber.toUpperCase() : `PRODUCT-${stock.productId}`
}

function getMaterialNumber(stock: StockRow) {
    return stock.product?.materialNumber?.trim() || `Product #${stock.productId}`
}

function getStockAgeDays(stock: StockRow) {
    const createdAt = stock.createdAt ? new Date(stock.createdAt) : null
    if (!createdAt || Number.isNaN(createdAt.getTime())) return 0
    return Math.max(Math.floor((Date.now() - createdAt.getTime()) / DAY_IN_MS), 0)
}

function formatQty(value: number) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

function formatMonthLabel(yyyyMM: string) {
    const [year, month] = yyyyMM.split("-")
    const date = new Date(Number(year), Number(month) - 1, 1)
    return date.toLocaleDateString("id-ID", { month: "short", year: "2-digit" })
}

function buildYearMonths(year: string) {
    const now = new Date()
    const currentYear = now.getFullYear().toString()
    const monthCount = year === currentYear ? now.getMonth() + 1 : 12
    return Array.from({ length: monthCount }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)
}

function buildProductOptions(stocks: StockRow[]) {
    const grouped = new Map<string, ProductOption>()
    for (const stock of stocks) {
        const key = getMaterialKey(stock)
        const current = grouped.get(key)
        const totalQty = Number(stock.totalStock || 0)
        if (current) {
            current.totalQty += totalQty
            current.stockCount += 1
            continue
        }
        grouped.set(key, {
            key,
            materialNumber: getMaterialNumber(stock),
            description: stock.product?.materialDescription?.trim() || "-",
            totalQty,
            stockCount: 1,
        })
    }
    return Array.from(grouped.values()).sort((left, right) =>
        left.materialNumber.localeCompare(right.materialNumber)
    )
}

function buildSlowMovingRow(stocks: StockRow[], option: ProductOption, manualRate: string, initialStock: number): SlowMovingRow {
    const relatedStocks = stocks.filter((stock) => getMaterialKey(stock) === option.key)
    let totalValue = 0
    let allQty = 0
    const rate = parseNumber(manualRate)

    for (const stock of relatedStocks) {
        const qty = Number(stock.totalStock || 0)
        const costSap = parseNumber(stock.product?.costSap)
        allQty += qty
        totalValue += qty * costSap * rate
    }

    return {
        ...option,
        initialStock,
        totalQty: allQty,
        unitPrice: allQty > 0 ? totalValue / allQty : 0,
        totalValue,
    }
}

function getAvailableYears(sellingOutByMonth: MonthlySellingQty[]): string[] {
    const currentYear = new Date().getFullYear().toString()
    const yearSet = new Set<string>([currentYear])
    for (const item of sellingOutByMonth) {
        for (const month of Object.keys(item.monthlyQty)) {
            yearSet.add(month.slice(0, 4))
        }
    }
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a))
}

function getMonthsForYears(selectedYears: string[]): string[] {
    const monthSet = new Set<string>()
    for (const year of selectedYears) {
        for (const month of buildYearMonths(year)) monthSet.add(month)
    }
    return Array.from(monthSet).sort()
}

function sumByMonths(values: Record<string, number> | undefined, months: string[]) {
    return months.reduce((total, month) => total + (values?.[month] ?? 0), 0)
}

function filterDetailsByMonths(details: SellingOutDetail[] | undefined, months: string[]) {
    const monthSet = new Set(months)
    return (details ?? []).filter((detail) => monthSet.has(detail.month))
}

function formatDate(value: string | null) {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

export function SlowMovingClient({
    stocks,
    defaultRate = "1",
    savedProducts = [],
    showHeader = true,
    sellingOutByMonth = [],
}: {
    stocks: StockRow[]
    defaultRate?: string
    savedProducts?: SavedSlowMovingProduct[]
    showHeader?: boolean
    sellingOutByMonth?: MonthlySellingQty[]
}) {
    const [search, setSearch] = React.useState("")
    const [selectedKeys, setSelectedKeys] = React.useState<string[]>([])
    const [importedKeys, setImportedKeys] = React.useState<string[]>(() =>
        savedProducts.map((product) => product.materialKey)
    )
    const [manualRate, setManualRate] = React.useState(defaultRate)
    const [isImporting, setIsImporting] = React.useState(false)
    const [deletingKey, setDeletingKey] = React.useState<string | null>(null)
    const [selectedYears, setSelectedYears] = React.useState<string[]>(["2025", "2026"])
    const [expandedKeys, setExpandedKeys] = React.useState<string[]>([])
    const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

    const productOptions = React.useMemo(() => buildProductOptions(stocks), [stocks])

    const filteredOptions = React.useMemo(() => {
        const keyword = search.trim().toLowerCase()
        if (!keyword) return productOptions
        return productOptions.filter((option) =>
            `${option.materialNumber} ${option.description}`.toLowerCase().includes(keyword)
        )
    }, [productOptions, search])

    const reportRows = React.useMemo(() => {
        return importedKeys
            .map((key) => productOptions.find((option) => option.key === key))
            .filter((option): option is ProductOption => Boolean(option))
            .map((option) => {
                const saved = savedProducts.find(p => p.materialKey === option.key)
                return buildSlowMovingRow(stocks, option, manualRate, saved?.initialStock || 0)
            })
    }, [importedKeys, manualRate, productOptions, stocks, savedProducts])

    const sortedReportRows = React.useMemo(() => {
        let sortableItems = [...reportRows]
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (sortConfig.key === 'totalQty') {
                    if (a.totalQty < b.totalQty) {
                        return sortConfig.direction === 'asc' ? -1 : 1
                    }
                    if (a.totalQty > b.totalQty) {
                        return sortConfig.direction === 'asc' ? 1 : -1
                    }
                }
                return 0
            })
        }
        return sortableItems
    }, [reportRows, sortConfig])

    const availableYears = React.useMemo(() => getAvailableYears(sellingOutByMonth), [sellingOutByMonth])
    const allMonths = React.useMemo(() => getMonthsForYears(selectedYears), [selectedYears])

    const sellingMap = React.useMemo(() => {
        const map = new Map<string, { monthlyQty: Record<string, number>; monthlyRevenue: Record<string, number>; details: SellingOutDetail[]; totalQtySold: number; totalRevenue: number }>()
        for (const item of sellingOutByMonth) {
            map.set(item.materialKey, {
                monthlyQty: item.monthlyQty,
                monthlyRevenue: item.monthlyRevenue,
                details: item.details,
                totalQtySold: item.totalQtySold,
                totalRevenue: item.totalRevenue,
            })
        }
        return map
    }, [sellingOutByMonth])

    const stats = React.useMemo(() => {
        const monthlyTotals: Record<string, number> = {}
        const base = reportRows.reduce(
            (acc, row) => {
                acc.totalQty += row.totalQty
                acc.initialStock += row.initialStock
                acc.totalValue += row.totalValue
                const entry = sellingMap.get(row.key)
                acc.totalQtySold += sumByMonths(entry?.monthlyQty, allMonths)
                acc.totalRevenue += sumByMonths(entry?.monthlyRevenue, allMonths)
                const monthlyQty = entry?.monthlyQty ?? {}
                for (const [month, qty] of Object.entries(monthlyQty)) {
                    if (allMonths.includes(month)) {
                        monthlyTotals[month] = (monthlyTotals[month] ?? 0) + qty
                    }
                }
                return acc
            },
            { totalQty: 0, initialStock: 0, totalValue: 0, totalQtySold: 0, totalRevenue: 0 }
        )
        return { ...base, monthlyTotals }
    }, [allMonths, reportRows, sellingMap])

    const selectedKeySet = React.useMemo(() => new Set(selectedKeys), [selectedKeys])
    const importedKeySet = React.useMemo(() => new Set(importedKeys), [importedKeys])

    const toggleProductSelection = (key: string, checked: boolean) => {
        setSelectedKeys((current) => {
            if (checked) return current.includes(key) ? current : [...current, key]
            return current.filter((item) => item !== key)
        })
    }

    const toggleYearSelection = (year: string, checked: boolean) => {
        setSelectedYears((current) => {
            if (checked) return current.includes(year) ? current : [...current, year].sort()
            const next = current.filter((item) => item !== year)
            return next.length > 0 ? next : [year]
        })
    }

    const toggleExpanded = (key: string) => {
        setExpandedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
    }

    const handleImportSelected = async () => {
        if (selectedKeys.length === 0) {
            toast.error("Pilih minimal satu product terlebih dahulu")
            return
        }
        const keysToImport = selectedKeys.filter((key) => !importedKeySet.has(key))
        if (keysToImport.length === 0) {
            toast.info("Semua product terpilih sudah ada di tabel")
            return
        }
        const itemsToImport = keysToImport
            .map((key) => productOptions.find((option) => option.key === key))
            .filter((option): option is ProductOption => Boolean(option))
            .map((option) => ({
                materialKey: option.key,
                materialNumber: option.materialNumber,
                description: option.description,
            }))

        setIsImporting(true)
        const result = await importSlowMovingProducts(itemsToImport)
        setIsImporting(false)

        if (!result.success) {
            toast.error(result.error)
            return
        }

        setImportedKeys((current) => Array.from(new Set([...current, ...keysToImport])))
        setSelectedKeys((current) => current.filter((key) => !keysToImport.includes(key)))
        toast.success(`${result.count} product berhasil disimpan ke database`)
    }

    const handleRemoveImported = async (materialKey: string) => {
        setDeletingKey(materialKey)
        const result = await deleteSlowMovingProduct(materialKey)
        setDeletingKey(null)

        if (!result.success) {
            toast.error(result.error)
            return
        }

        setImportedKeys((current) => current.filter((key) => key !== materialKey))
        setSelectedKeys((current) => current.filter((key) => key !== materialKey))
        toast.success("Product slow moving dihapus dari database")
    }

    const handleSelectVisible = () => {
        const visibleKeys = filteredOptions
            .map((option) => option.key)
            .filter((key) => !importedKeySet.has(key))
        if (visibleKeys.length === 0) {
            toast.info("Tidak ada product baru yang bisa dipilih")
            return
        }
        setSelectedKeys((current) => Array.from(new Set([...current, ...visibleKeys])))
    }

    const handleExport = () => {
        if (reportRows.length === 0) {
            toast.error("Tidak ada data untuk diexport")
            return
        }

        const rows = reportRows.map((row, index) => {
            const sellingEntry = sellingMap.get(row.key)
            const totalQtySold = sumByMonths(sellingEntry?.monthlyQty, allMonths)
            const totalRevenue = sumByMonths(sellingEntry?.monthlyRevenue, allMonths)
            const monthlyQty = sellingEntry?.monthlyQty ?? {}
            const sellOutPct = row.initialStock > 0 ? ((totalQtySold / row.initialStock) * 100).toFixed(1) + "%" : "-"
            const base: Record<string, unknown> = {
                No: index + 1,
                "Material Number": row.materialNumber,
                Desc: row.description,
                "Stock Awal": row.initialStock,
                "Stock Saat Ini": row.totalQty,
                "Unit Price": Math.round(row.unitPrice),
                "Total Value": Math.round(row.totalValue),
                "Total Terjual": totalQtySold,
                "Revenue Terjual": Math.round(totalRevenue),
                "% Sell Out": sellOutPct,
            }
            for (const month of allMonths) {
                base[formatMonthLabel(month)] = monthlyQty[month] ?? 0
            }
            return base
        })

        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Slow Moving")
        XLSX.writeFile(workbook, `slow-moving-${new Date().toISOString().slice(0, 10)}.xlsx`)
        toast.success("Export Excel berhasil")
    }

    const totalMonthCols = allMonths.length
    const totalCols = 12 + totalMonthCols

    return (
        <div className={showHeader ? "flex min-h-screen flex-1 flex-col gap-6 bg-white p-4 text-zinc-950 md:p-8 lg:p-10" : "flex flex-col gap-6"}>
            {showHeader && (
                <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Slow Moving</h1>
                        <Badge variant="outline">{productOptions.length} product stock</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Pilih product dari data stock lalu import ke tabel analisa slow moving.
                    </p>
                </div>
            )}

            <div className="grid gap-3 md:grid-cols-4">
                <Card className="rounded-lg bg-white py-4">
                    <CardContent className="flex items-center justify-between px-4">
                        <div>
                            <p className="text-xs text-muted-foreground">Product Diimport</p>
                            <p className="text-2xl font-bold">{reportRows.length}</p>
                        </div>
                        <PackageSearch className="h-5 w-5 text-blue-600" />
                    </CardContent>
                </Card>
                <Card className="rounded-lg bg-white py-4">
                    <CardContent className="flex items-center justify-between px-4">
                        <div>
                            <p className="text-xs text-muted-foreground">All Qty</p>
                            <p className="text-2xl font-bold">{formatQty(stats.totalQty)}</p>
                        </div>
                        <Box className="h-5 w-5 text-emerald-600" />
                    </CardContent>
                </Card>
                <Card className="rounded-lg bg-white py-4">
                    <CardContent className="flex items-center justify-between px-4">
                        <div>
                            <p className="text-xs text-muted-foreground">Qty 366&gt;</p>
                            <p className="text-2xl font-bold">{formatQty(stats.moreThan366Qty)}</p>
                        </div>
                        <PackageSearch className="h-5 w-5 text-amber-600" />
                    </CardContent>
                </Card>
                <Card className="rounded-lg bg-white py-4">
                    <CardContent className="flex items-center justify-between px-4">
                        <div>
                            <p className="text-xs text-muted-foreground">Total Value</p>
                            <p className="text-xl font-bold">{formatCurrency(stats.totalValue)}</p>
                        </div>
                        <Download className="h-5 w-5 text-violet-600" />
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col gap-4 rounded-lg border bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="w-full lg:max-w-xs">
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Cari Product</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Material number atau desc..."
                                className="pl-8"
                            />
                        </div>
                    </div>
                    <div className="w-full lg:max-w-[180px]">
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Manual Rate Exchange</label>
                        <Input
                            type="number"
                            value={manualRate}
                            onChange={(event) => setManualRate(event.target.value)}
                            onBlur={(event) => {
                                if (event.target.value) {
                                    updateSetting("manual_usd_rate", event.target.value)
                                }
                            }}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <label className="mb-1.5 block text-xs font-medium text-slate-500">Filter Tahun</label>
                        <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1 scrollbar-thin">
                            {availableYears.map((year) => {
                                const isActive = selectedYears.includes(year)
                                return (
                                    <label 
                                        key={year} 
                                        className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 rounded-md border transition-all ${
                                            isActive 
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Checkbox
                                            checked={isActive}
                                            onCheckedChange={(checked) => toggleYearSelection(year, Boolean(checked))}
                                            className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                        />
                                        <span className="text-sm font-medium">{year}</span>
                                    </label>
                                )
                            })}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={handleSelectVisible} className="gap-2">
                            <Search className="h-4 w-4" />
                            Pilih Semua Visible
                        </Button>
                        <Button onClick={handleImportSelected} disabled={isImporting || selectedKeys.length === 0} className="gap-2">
                            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {isImporting ? "Menyimpan..." : "Import Product Terpilih"}
                        </Button>
                        <Button variant="outline" onClick={handleExport} className="gap-2">
                            <Download className="h-4 w-4" />
                            Export
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setSearch("")
                                setSelectedKeys([])
                                setSelectedYears(["2025", "2026"])
                            }}
                            className="gap-2"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Reset Filter
                        </Button>
                    </div>
                </div>

                <div className="rounded-md border">
                    <div className="flex items-center justify-between border-b bg-zinc-50 px-3 py-2 text-xs text-muted-foreground">
                        <span>{selectedKeys.length} product dipilih, {reportRows.length} sudah diimport</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedKeys([])}
                            disabled={selectedKeys.length === 0}
                            className="h-7"
                        >
                            Clear Selection
                        </Button>
                    </div>
                    <div className="max-h-72 overflow-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                                Product tidak ditemukan.
                            </div>
                        ) : (
                            filteredOptions.map((option) => {
                                const isImported = importedKeySet.has(option.key)
                                const isSelected = selectedKeySet.has(option.key)
                                return (
                                    <label
                                        key={option.key}
                                        className={`flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-zinc-50 ${
                                            isImported ? "bg-emerald-50/60 text-muted-foreground" : ""
                                        }`}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={(checked) =>
                                                toggleProductSelection(option.key, Boolean(checked))
                                            }
                                            disabled={isImported}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-zinc-950">{option.materialNumber}</span>
                                                {isImported && <Badge variant="success">Imported</Badge>}
                                            </div>
                                            <p className="truncate text-xs text-muted-foreground">{option.description}</p>
                                        </div>
                                        <div className="text-right font-mono text-xs">
                                            {formatQty(option.totalQty)}
                                        </div>
                                    </label>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-md border bg-card">
                <div className="overflow-x-auto">
                    <Table className="border-collapse" style={{ minWidth: `${980 + totalMonthCols * 100}px` }}>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="h-10 w-12 text-center"></TableHead>
                                <TableHead className="h-10 w-16 text-center">No</TableHead>
                                <TableHead className="h-10">Material Number</TableHead>
                                <TableHead className="h-10">Desc</TableHead>
                                <TableHead className="h-10 text-right">Stock Awal</TableHead>
                                <TableHead 
                                    className="h-10 text-right cursor-pointer hover:bg-muted/80 transition-colors"
                                    onClick={() => {
                                        let direction: 'asc' | 'desc' = 'asc'
                                        if (sortConfig && sortConfig.key === 'totalQty' && sortConfig.direction === 'asc') {
                                            direction = 'desc'
                                        }
                                        setSortConfig({ key: 'totalQty', direction })
                                    }}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Stock Saat Ini
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="h-10 text-right">Unit Price</TableHead>
                                <TableHead className="h-10 text-right">Total Value</TableHead>
                                {allMonths.map((month) => (
                                    <TableHead key={month} className="h-10 text-right text-blue-700">
                                        {formatMonthLabel(month)}
                                    </TableHead>
                                ))}
                                <TableHead className="h-10 text-right text-emerald-700">Total Terjual</TableHead>
                                <TableHead className="h-10 text-right text-emerald-700">Revenue Terjual</TableHead>
                                <TableHead className="h-10 text-right text-orange-700">% Sell Out</TableHead>
                                <TableHead className="h-10 text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedReportRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={totalCols} className="h-40 text-center text-sm text-muted-foreground">
                                        Belum ada product yang diimport.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedReportRows.map((row, index) => {
                                    const sellingEntry = sellingMap.get(row.key)
                                    const monthlyQty = sellingEntry?.monthlyQty ?? {}
                                    const totalQtySold = sumByMonths(sellingEntry?.monthlyQty, allMonths)
                                    const totalRevenue = sumByMonths(sellingEntry?.monthlyRevenue, allMonths)
                                    const sellOutPct = row.initialStock > 0 ? (totalQtySold / row.initialStock) * 100 : 0
                                    const details = filterDetailsByMonths(sellingEntry?.details, allMonths)
                                    const isExpanded = expandedKeys.includes(row.key)
                                    return (
                                        <React.Fragment key={row.key}>
                                            <TableRow>
                                                <TableCell className="text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => toggleExpanded(row.key)}
                                                        aria-label={`${isExpanded ? "Tutup" : "Buka"} detail ${row.materialNumber}`}
                                                    >
                                                        <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="text-center font-mono">{index + 1}</TableCell>
                                                <TableCell className="font-medium text-blue-600">{row.materialNumber}</TableCell>
                                                <TableCell className="whitespace-normal">{row.description}</TableCell>
                                                <TableCell className="text-right">
                                                    <Input
                                                        type="number"
                                                        defaultValue={row.initialStock}
                                                        className="w-20 text-right h-8 ml-auto"
                                                        onBlur={async (e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            if (val !== row.initialStock) {
                                                                await updateSlowMovingProductInitialStock(row.key, val);
                                                            }
                                                        }}
                                                        onKeyDown={async (e) => {
                                                            if (e.key === 'Enter') {
                                                                e.currentTarget.blur();
                                                            }
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right font-mono">{formatQty(row.totalQty)}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(row.unitPrice)}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(row.totalValue)}</TableCell>
                                                {allMonths.map((month) => (
                                                    <TableCell key={month} className="text-right font-mono text-blue-800">
                                                        {formatQty(monthlyQty[month] ?? 0)}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-right font-mono text-emerald-700">{formatQty(totalQtySold)}</TableCell>
                                                <TableCell className="text-right font-mono text-emerald-700">{formatCurrency(totalRevenue)}</TableCell>
                                                <TableCell className="text-right font-mono text-orange-700 font-semibold">
                                                    {sellOutPct > 0 ? sellOutPct.toFixed(1) + "%" : "-"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive"
                                                        onClick={() => handleRemoveImported(row.key)}
                                                        disabled={deletingKey === row.key}
                                                        aria-label={`Hapus ${row.materialNumber}`}
                                                    >
                                                        {deletingKey === row.key ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                                    <TableCell colSpan={totalCols} className="p-0">
                                                        <div className="px-4 py-3">
                                                            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                <Badge variant="outline">Detail Selling Out</Badge>
                                                                <span>{details.length} transaksi sesuai filter tahun</span>
                                                            </div>
                                                            <div className="overflow-x-auto rounded-md border bg-white">
                                                                <table className="w-full min-w-[820px] text-sm">
                                                                    <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                                                                        <tr>
                                                                            <th className="px-3 py-2 text-left">Tanggal</th>
                                                                            <th className="px-3 py-2 text-left">Billing</th>
                                                                            <th className="px-3 py-2 text-right">Qty</th>
                                                                            <th className="px-3 py-2 text-right">Revenue Docc Curr</th>
                                                                            <th className="px-3 py-2 text-right">Total</th>
                                                                            <th className="px-3 py-2 text-left">Sales</th>
                                                                            <th className="px-3 py-2 text-left">Customer</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {details.length === 0 ? (
                                                                            <tr>
                                                                                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                                                                                    Tidak ada detail transaksi untuk filter tahun ini.
                                                                                </td>
                                                                            </tr>
                                                                        ) : (
                                                                            details.map((detail, detailIndex) => (
                                                                                <tr key={`${detail.billingNo ?? detail.month}-${detailIndex}`} className="border-t">
                                                                                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(detail.billingDate)}</td>
                                                                                    <td className="px-3 py-2 font-mono">{detail.billingNo || "-"}</td>
                                                                                    <td className="px-3 py-2 text-right font-mono">{formatQty(detail.qty)}</td>
                                                                                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(detail.revenueInDocCurr)}</td>
                                                                                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(detail.total)}</td>
                                                                                    <td className="px-3 py-2">{detail.sales || "-"}</td>
                                                                                    <td className="px-3 py-2">{detail.customer || "-"}</td>
                                                                                </tr>
                                                                            ))
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            )}
                        </TableBody>
                        {reportRows.length > 0 && (
                            <tfoot>
                                <tr className="border-t bg-muted/70 font-semibold">
                                    <td />
                                    <td colSpan={3} className="h-10 px-4 text-sm">Total</td>
                                    <td className="px-4 text-right font-mono text-sm">{formatQty(stats.initialStock)}</td>
                                    <td className="px-4 text-right font-mono text-sm">{formatQty(stats.totalQty)}</td>
                                    <td className="px-4 text-right font-mono text-sm"></td>
                                    <td className="px-4 text-right font-mono text-sm">{formatCurrency(stats.totalValue)}</td>
                                    {allMonths.map((month) => (
                                        <td key={month} className="px-4 text-right font-mono text-sm text-blue-800">
                                            {formatQty(stats.monthlyTotals[month] ?? 0)}
                                        </td>
                                    ))}
                                    <td className="px-4 text-right font-mono text-sm text-emerald-700">{formatQty(stats.totalQtySold)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-emerald-700">{formatCurrency(stats.totalRevenue)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-orange-700 font-semibold">
                                        {stats.initialStock > 0 ? ((stats.totalQtySold / stats.initialStock) * 100).toFixed(1) + "%" : "-"}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </Table>
                </div>
            </div>
        </div>
    )
}
