"use client"

import * as React from "react"
import { updateSetting } from "@/app/actions/settings"
import {
    deleteSlowMovingProduct,
    importSlowMovingProducts,
} from "@/app/actions/slow-moving-products"
import type { MonthlySellingQty } from "@/app/actions/slow-moving-products"
import type { getStocks } from "@/app/actions/stock"
import { Box, Download, Loader2, PackageSearch, RotateCcw, Search, Trash2, Upload } from "lucide-react"
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
    lessThan366Qty: number
    moreThan366Qty: number
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

function buildSlowMovingRow(stocks: StockRow[], option: ProductOption, manualRate: string): SlowMovingRow {
    const relatedStocks = stocks.filter((stock) => getMaterialKey(stock) === option.key)
    let lessThan366Qty = 0
    let moreThan366Qty = 0
    let totalValue = 0
    const rate = parseNumber(manualRate)

    for (const stock of relatedStocks) {
        const qty = Number(stock.totalStock || 0)
        const costSap = parseNumber(stock.product?.costSap)
        if (getStockAgeDays(stock) < 366) {
            lessThan366Qty += qty
        } else {
            moreThan366Qty += qty
        }
        totalValue += qty * costSap * rate
    }

    const allQty = lessThan366Qty + moreThan366Qty
    return {
        ...option,
        totalQty: allQty,
        lessThan366Qty,
        moreThan366Qty,
        unitPrice: allQty > 0 ? totalValue / allQty : 0,
        totalValue,
    }
}

function getAllMonths(sellingOutByMonth: MonthlySellingQty[]): string[] {
    const currentYear = new Date().getFullYear().toString()
    const monthSet = new Set<string>()
    for (const item of sellingOutByMonth) {
        for (const month of Object.keys(item.monthlyQty)) {
            if (month.startsWith(currentYear)) {
                monthSet.add(month)
            }
        }
    }
    return Array.from(monthSet).sort()
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
            .map((option) => buildSlowMovingRow(stocks, option, manualRate))
    }, [importedKeys, manualRate, productOptions, stocks])

    const allMonths = React.useMemo(() => getAllMonths(sellingOutByMonth), [sellingOutByMonth])

    const sellingMap = React.useMemo(() => {
        const map = new Map<string, { monthlyQty: Record<string, number>; totalQtySold: number; totalRevenue: number }>()
        for (const item of sellingOutByMonth) {
            map.set(item.materialKey, {
                monthlyQty: item.monthlyQty,
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
                acc.lessThan366Qty += row.lessThan366Qty
                acc.moreThan366Qty += row.moreThan366Qty
                acc.totalValue += row.totalValue
                const entry = sellingMap.get(row.key)
                acc.totalQtySold += entry?.totalQtySold ?? 0
                acc.totalRevenue += entry?.totalRevenue ?? 0
                const monthlyQty = entry?.monthlyQty ?? {}
                for (const [month, qty] of Object.entries(monthlyQty)) {
                    monthlyTotals[month] = (monthlyTotals[month] ?? 0) + qty
                }
                return acc
            },
            { totalQty: 0, lessThan366Qty: 0, moreThan366Qty: 0, totalValue: 0, totalQtySold: 0, totalRevenue: 0 }
        )
        return { ...base, monthlyTotals }
    }, [reportRows, sellingMap])

    const selectedKeySet = React.useMemo(() => new Set(selectedKeys), [selectedKeys])
    const importedKeySet = React.useMemo(() => new Set(importedKeys), [importedKeys])

    const toggleProductSelection = (key: string, checked: boolean) => {
        setSelectedKeys((current) => {
            if (checked) return current.includes(key) ? current : [...current, key]
            return current.filter((item) => item !== key)
        })
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
            const totalQtySold = sellingEntry?.totalQtySold ?? 0
            const totalRevenue = sellingEntry?.totalRevenue ?? 0
            const monthlyQty = sellingEntry?.monthlyQty ?? {}
            const sellOutPct = row.totalQty > 0 ? ((totalQtySold / (row.totalQty + totalQtySold)) * 100).toFixed(1) + "%" : "-"
            const base: Record<string, unknown> = {
                No: index + 1,
                "Material Number": row.materialNumber,
                Desc: row.description,
                "All Qty": row.totalQty,
                "<366": row.lessThan366Qty,
                "366>": row.moreThan366Qty,
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
                                <TableHead className="h-10 w-16 text-center">No</TableHead>
                                <TableHead className="h-10">Material Number</TableHead>
                                <TableHead className="h-10">Desc</TableHead>
                                <TableHead className="h-10 text-right">All Qty</TableHead>
                                <TableHead className="h-10 text-right">&lt;366</TableHead>
                                <TableHead className="h-10 text-right">366&gt;</TableHead>
                                <TableHead className="h-10 text-right">Unit Price</TableHead>
                                <TableHead className="h-10 text-right">Total Value</TableHead>
                                <TableHead className="h-10 text-right text-emerald-700">Total Terjual</TableHead>
                                <TableHead className="h-10 text-right text-emerald-700">Revenue Terjual</TableHead>
                                <TableHead className="h-10 text-right text-orange-700">% Sell Out</TableHead>
                                {allMonths.map((month) => (
                                    <TableHead key={month} className="h-10 text-right text-blue-700">
                                        {formatMonthLabel(month)}
                                    </TableHead>
                                ))}
                                <TableHead className="h-10 text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={totalCols} className="h-40 text-center text-sm text-muted-foreground">
                                        Belum ada product yang diimport.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportRows.map((row, index) => {
                                    const sellingEntry = sellingMap.get(row.key)
                                    const monthlyQty = sellingEntry?.monthlyQty ?? {}
                                    const totalQtySold = sellingEntry?.totalQtySold ?? 0
                                    const totalRevenue = sellingEntry?.totalRevenue ?? 0
                                    const sellOutPct = row.totalQty > 0 ? (totalQtySold / (row.totalQty + totalQtySold)) * 100 : 0
                                    return (
                                        <TableRow key={row.key}>
                                            <TableCell className="text-center font-mono">{index + 1}</TableCell>
                                            <TableCell className="font-medium text-blue-600">{row.materialNumber}</TableCell>
                                            <TableCell className="whitespace-normal">{row.description}</TableCell>
                                            <TableCell className="text-right font-mono">{formatQty(row.totalQty)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatQty(row.lessThan366Qty)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatQty(row.moreThan366Qty)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.unitPrice)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(row.totalValue)}</TableCell>
                                            <TableCell className="text-right font-mono text-emerald-700">{formatQty(totalQtySold)}</TableCell>
                                            <TableCell className="text-right font-mono text-emerald-700">{formatCurrency(totalRevenue)}</TableCell>
                                            <TableCell className="text-right font-mono text-orange-700 font-semibold">
                                                {sellOutPct > 0 ? sellOutPct.toFixed(1) + "%" : "-"}
                                            </TableCell>
                                            {allMonths.map((month) => (
                                                <TableCell key={month} className="text-right font-mono text-blue-800">
                                                    {formatQty(monthlyQty[month] ?? 0)}
                                                </TableCell>
                                            ))}
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
                                    )
                                })
                            )}
                        </TableBody>
                        {reportRows.length > 0 && (
                            <tfoot>
                                <tr className="border-t bg-muted/70 font-semibold">
                                    <td colSpan={3} className="h-10 px-4 text-sm">Total</td>
                                    <td className="px-4 text-right font-mono text-sm">{formatQty(stats.totalQty)}</td>
                                    <td className="px-4 text-right font-mono text-sm">{formatQty(stats.lessThan366Qty)}</td>
                                    <td className="px-4 text-right font-mono text-sm">{formatQty(stats.moreThan366Qty)}</td>
                                    <td className="px-4 text-right font-mono text-sm"></td>
                                    <td className="px-4 text-right font-mono text-sm">{formatCurrency(stats.totalValue)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-emerald-700">{formatQty(stats.totalQtySold)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-emerald-700">{formatCurrency(stats.totalRevenue)}</td>
                                    <td className="px-4 text-right font-mono text-sm text-orange-700 font-semibold">
                                        {stats.totalQty > 0 ? ((stats.totalQtySold / (stats.totalQty + stats.totalQtySold)) * 100).toFixed(1) + "%" : "-"}
                                    </td>
                                    {allMonths.map((month) => (
                                        <td key={month} className="px-4 text-right font-mono text-sm text-blue-800">
                                            {formatQty(stats.monthlyTotals[month] ?? 0)}
                                        </td>
                                    ))}
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