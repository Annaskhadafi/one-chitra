"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { Search, AlertTriangle, Download } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ResponsiveTableWrapper } from "@/components/ui/responsive-table-wrapper"
import { DataTableFacetedFilter } from "@/app/dashboard/billing/_components/data-table-faceted-filter"
import { cn } from "@/lib/utils"
import type { ABCProduct } from "@/lib/types"
import { Button } from "@/components/ui/button"
import * as XLSX from "xlsx"

interface ABCAnalysisTableProps {
    data: ABCProduct[]
}

const classBadge: Record<"A" | "B" | "C", React.ReactNode> = {
    A: (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 text-xs font-bold w-6 justify-center">
            A
        </Badge>
    ),
    B: (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 text-xs font-bold w-6 justify-center">
            B
        </Badge>
    ),
    C: (
        <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400 border-slate-200 text-xs font-bold w-6 justify-center">
            C
        </Badge>
    ),
}

export function ABCAnalysisTable({ data }: ABCAnalysisTableProps) {
    const [search, setSearch] = useState("")
    const [filterClasses, setFilterClasses] = useState<string[]>([])
    const [filterCategories, setFilterCategories] = useState<string[]>([])
    const [filterBrands, setFilterBrands] = useState<string[]>([])

    const categories = useMemo(() => {
        const cats = new Set(data.map((d) => d.category).filter(Boolean))
        return Array.from(cats).sort()
    }, [data])

    const brands = useMemo(() => {
        const values = new Set(data.map((d) => d.brand).filter(Boolean))
        return Array.from(values).sort() as string[]
    }, [data])

    const filtered = useMemo(() => {
        return data.filter((row) => {
            const q = search.toLowerCase()
            const matchSearch =
                !q ||
                row.materialNumber.toLowerCase().includes(q) ||
                row.materialDescription?.toLowerCase().includes(q) ||
                row.brand?.toLowerCase().includes(q)
            const matchClass = filterClasses.length === 0 || filterClasses.includes(row.abcClass)
            const matchCat = filterCategories.length === 0 || filterCategories.includes(row.category)
            const matchBrand = filterBrands.length === 0 || filterBrands.includes(row.brand ?? "")
            return matchSearch && matchClass && matchCat && matchBrand
        })
    }, [data, filterBrands, filterCategories, filterClasses, search])

    const handleExportExcel = () => {
        if (filtered.length === 0) {
            return
        }

        const exportRows = filtered.map((row) => ({
            "Class": row.abcClass,
            "Material Number": row.materialNumber,
            "Description": row.materialDescription ?? "",
            "Category": row.category,
            "Brand": row.brand ?? "",
            "Total Movement Qty": row.totalMovementQty,
            "Movement Count": row.totalMovementCount,
            "Cumulative Percentage": row.cumulativePercentage,
            "Current Stock": row.currentStock,
            "Low Stock": row.isLowStock ? "Yes" : "No",
        }))

        const worksheet = XLSX.utils.json_to_sheet(exportRows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "ABC Analysis")
        XLSX.writeFile(workbook, `abc-analysis-${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari material / deskripsi / brand..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <DataTableFacetedFilter
                    title="Kelas"
                    options={["A", "B", "C"]}
                    selectedValues={filterClasses}
                    onFilterChange={setFilterClasses}
                    searchPlaceholder="Cari kelas..."
                />
                <DataTableFacetedFilter
                    title="Kategori"
                    options={categories}
                    selectedValues={filterCategories}
                    onFilterChange={setFilterCategories}
                    searchPlaceholder="Cari kategori..."
                />
                <DataTableFacetedFilter
                    title="Brand"
                    options={brands}
                    selectedValues={filterBrands}
                    onFilterChange={setFilterBrands}
                    searchPlaceholder="Cari brand..."
                />
                <Button variant="outline" onClick={handleExportExcel} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export Excel
                </Button>
            </div>

            {/* Table */}
            <ResponsiveTableWrapper
                mobileView={
                    <div className="space-y-2">
                        {filtered.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                                    <Search className="h-8 w-8" />
                                </div>
                                <p className="font-medium">
                                    {data.length === 0
                                        ? "Belum ada data pergerakan stok untuk periode ini"
                                        : "Tidak ada hasil sesuai filter"}
                                </p>
                            </div>
                        ) : (
                            filtered.map((row, i) => {
                                const classColors = {
                                    A: {
                                        bg: "from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20",
                                        border: "border-emerald-300 dark:border-emerald-800",
                                        badge: "bg-emerald-600",
                                        progress: "bg-emerald-500"
                                    },
                                    B: {
                                        bg: "from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20",
                                        border: "border-blue-300 dark:border-blue-800",
                                        badge: "bg-blue-600",
                                        progress: "bg-blue-500"
                                    },
                                    C: {
                                        bg: "from-slate-50 to-slate-100/50 dark:from-slate-950/30 dark:to-slate-900/20",
                                        border: "border-slate-300 dark:border-slate-800",
                                        badge: "bg-slate-600",
                                        progress: "bg-slate-400"
                                    }
                                }
                                const colors = classColors[row.abcClass]

                                return (
                                    <div
                                        key={row.productId}
                                        className={cn(
                                            "relative overflow-hidden rounded-lg border-2 transition-all active:scale-[0.98]",
                                            `bg-gradient-to-br ${colors.bg} ${colors.border}`
                                        )}
                                    >
                                        {/* Class Badge - Top Right */}
                                        <div className="absolute top-3 right-3 z-10">
                                            <div className={cn(
                                                "w-12 h-12 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg",
                                                colors.badge
                                            )}>
                                                {row.abcClass}
                                            </div>
                                        </div>

                                        {/* Low Stock Alert */}
                                        {row.isLowStock && (
                                            <div className="absolute top-3 left-3 z-10">
                                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-600 text-white shadow-lg">
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    <span className="text-xs font-bold">LOW</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-4 space-y-4">
                                            {/* Header */}
                                            <div className={cn("pr-16", row.isLowStock && "pl-20")}>
                                                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm mb-2">
                                                    <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                                                </div>
                                                <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                                                    {row.materialNumber}
                                                </h3>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                                                    {row.materialDescription ?? "-"}
                                                </p>
                                            </div>

                                            {/* Info Grid */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/50">
                                                    <div className="text-xs text-muted-foreground mb-1 font-medium">Kategori</div>
                                                    <div className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                                                        {row.category}
                                                    </div>
                                                </div>
                                                <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-lg p-3 border border-gray-200/50 dark:border-gray-700/50">
                                                    <div className="text-xs text-muted-foreground mb-1 font-medium">Brand</div>
                                                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                                                        {row.brand ?? "-"}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Movement Stats */}
                                            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 border-2 border-gray-200/50 dark:border-gray-700/50">
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1 font-medium">Total Qty Bergerak</div>
                                                        <div className="text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
                                                            {row.totalMovementQty.toLocaleString("id-ID")}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1 font-medium">Stok Saat Ini</div>
                                                        <div className="text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums">
                                                            {row.currentStock.toLocaleString("id-ID")}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                                                    <div>
                                                        <div className="text-xs text-muted-foreground font-medium">Frekuensi</div>
                                                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                                            {row.totalMovementCount.toLocaleString("id-ID")}x
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-24 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                                            <div
                                                                className={cn("h-full rounded-full", colors.progress)}
                                                                style={{ width: `${Math.min(row.cumulativePercentage, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums min-w-[3ch]">
                                                            {row.cumulativePercentage}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                }
            >
                <div className="rounded-xl border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/40">
                                <TableHead className="w-8">#</TableHead>
                                <TableHead className="w-10">Kelas</TableHead>
                                <TableHead>Material No.</TableHead>
                                <TableHead>Deskripsi</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Brand</TableHead>
                                <TableHead className="text-right">Total Qty Bergerak</TableHead>
                                <TableHead className="text-right">Frekuensi</TableHead>
                                <TableHead className="text-right">Kumulatif %</TableHead>
                                <TableHead className="text-right">Stok Saat Ini</TableHead>
                                <TableHead>Stok Alert</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                                        {data.length === 0
                                            ? "Belum ada data pergerakan stok untuk periode ini."
                                            : "Tidak ada hasil sesuai filter."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((row, i) => (
                                    <TableRow key={row.productId} className="text-sm">
                                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                                        <TableCell>{classBadge[row.abcClass]}</TableCell>
                                        <TableCell className="font-mono font-medium">{row.materialNumber}</TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={row.materialDescription ?? ""}>
                                            {row.materialDescription ?? "-"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">{row.category}</Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{row.brand ?? "-"}</TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {row.totalMovementQty.toLocaleString("id-ID")}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {row.totalMovementCount.toLocaleString("id-ID")}x
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            row.abcClass === "A"
                                                                ? "bg-emerald-500"
                                                                : row.abcClass === "B"
                                                                ? "bg-blue-500"
                                                                : "bg-slate-400"
                                                        }`}
                                                        style={{ width: `${Math.min(row.cumulativePercentage, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-muted-foreground">{row.cumulativePercentage}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">{row.currentStock.toLocaleString("id-ID")}</TableCell>
                                        <TableCell>
                                            {row.isLowStock ? (
                                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 gap-1 text-xs">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Low
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">OK</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ResponsiveTableWrapper>
            <p className="text-xs text-muted-foreground">
                Menampilkan {filtered.length} dari {data.length} produk dengan pergerakan stok
            </p>
        </div>
    )
}
