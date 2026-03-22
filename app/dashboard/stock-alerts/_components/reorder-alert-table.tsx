"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { AlertTriangle, XCircle, Search, Download } from "lucide-react"
import Papa from "papaparse"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ResponsiveTableWrapper } from "@/components/ui/responsive-table-wrapper"
import { cn } from "@/lib/utils"
import type { ReorderAlert } from "@/lib/types"

interface ReorderAlertTableProps {
    data: ReorderAlert[]
}

export function ReorderAlertTable({ data }: ReorderAlertTableProps) {
    const [search, setSearch] = useState("")
    const [filterUrgency, setFilterUrgency] = useState("all")
    const [filterWarehouse, setFilterWarehouse] = useState("all")
    const [filterCategory, setFilterCategory] = useState("all")

    const warehouses = useMemo(() => {
        const names = new Set(data.map((d) => d.warehouse?.sloc).filter(Boolean) as string[])
        return Array.from(names).sort()
    }, [data])

    const categories = useMemo(() => {
        const names = new Set(data.map((d) => d.product?.category).filter(Boolean) as string[])
        return Array.from(names).sort()
    }, [data])

    const filtered = useMemo(() => {
        return data.filter((row) => {
            const q = search.toLowerCase()
            const matchSearch =
                !q ||
                row.product?.materialNumber?.toLowerCase().includes(q) ||
                row.product?.materialDescription?.toLowerCase().includes(q) ||
                row.warehouse?.sloc?.toLowerCase().includes(q)
            const matchUrgency = filterUrgency === "all" || row.urgency === filterUrgency
            const matchWarehouse =
                filterWarehouse === "all" || row.warehouse?.sloc === filterWarehouse
            const matchCategory =
                filterCategory === "all" || row.product?.category === filterCategory
            return matchSearch && matchUrgency && matchWarehouse && matchCategory
        })
    }, [data, search, filterUrgency, filterWarehouse, filterCategory])

    const handleExport = () => {
        // Prepare data for CSV
        const exportData = filtered.map((row, index) => ({
            "No": index + 1,
            "Material No.": row.product?.materialNumber || "-",
            "Deskripsi": row.product?.materialDescription || "-",
            "Brand": row.product?.brand || "-",
            "Kategori": row.product?.category || "-",
            "Warehouse": row.warehouse?.sloc || "-",
            "Stok Saat Ini": Number(row.totalStock) || 0,
            "Min Stock": Number(row.minStock) || 0,
            "Kekurangan": (Number(row.minStock) || 0) - (Number(row.totalStock) || 0),
            "Urgensi": row.urgency?.toUpperCase() || "-",
        }))

        // Generate CSV content using PapaParse
        const csv = Papa.unparse(exportData)

        // Create a blob with proper CSV mime type and UTF-8 encoding (BOM) for Excel
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })

        // Use the exact ObjectURL + hidden anchor technique to bypass policy
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")

        // Setup simple filename
        const fileName = `reorder_alerts_${new Date().toISOString().split('T')[0]}.csv`

        link.setAttribute("href", url)
        link.setAttribute("download", fileName)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari material / deskripsi / lokasi..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={filterUrgency} onValueChange={setFilterUrgency}>
                    <SelectTrigger className="w-32">
                        <SelectValue placeholder="Urgency" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Level</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {categories.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Warehouse</SelectItem>
                        {warehouses.map((w) => (
                            <SelectItem key={w} value={w}>{w}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    onClick={handleExport}
                    className="flex items-center gap-2 border-blue-600 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/20 shadow-sm"
                >
                    <Download className="h-4 w-4" />
                    Export CSV
                </Button>
            </div>

            {/* Table */}
            <ResponsiveTableWrapper
                mobileView={
                    <div className="space-y-2">
                        {filtered.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground">
                                <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                                    <AlertTriangle className="h-8 w-8" />
                                </div>
                                <p className="font-medium">
                                    {data.length === 0
                                        ? "Tidak ada produk di bawah minimum stok"
                                        : "Tidak ada hasil sesuai filter"}
                                </p>
                            </div>
                        ) : (
                            filtered.map((row, i) => {
                                const shortage = row.minStock - row.totalStock
                                const isCritical = row.urgency === "critical"

                                return (
                                    <div
                                        key={row.id}
                                        className={cn(
                                            "relative overflow-hidden rounded-lg border-2 transition-all active:scale-[0.98]",
                                            isCritical
                                                ? "bg-gradient-to-br from-red-50 to-red-100/50 border-red-300 dark:from-red-950/30 dark:to-red-900/20 dark:border-red-800"
                                                : "bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-300 dark:from-amber-950/30 dark:to-amber-900/20 dark:border-amber-800"
                                        )}
                                    >
                                        {/* Status Badge - Top Right */}
                                        <div className="absolute top-3 right-3 z-10">
                                            {isCritical ? (
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 text-white shadow-lg">
                                                    <XCircle className="h-4 w-4" />
                                                    <span className="text-xs font-bold">CRITICAL</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-600 text-white shadow-lg">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <span className="text-xs font-bold">WARNING</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4 space-y-4">
                                            {/* Header */}
                                            <div className="pr-24">
                                                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm mb-2">
                                                    <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                                                </div>
                                                <h3 className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                                                    {row.product?.materialNumber ?? "-"}
                                                </h3>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                                                    {row.product?.materialDescription ?? "-"}
                                                </p>
                                            </div>

                                            {/* Info Grid */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl p-3 border border-gray-200/50 dark:border-gray-700/50">
                                                    <div className="text-xs text-muted-foreground mb-1 font-medium">Kategori</div>
                                                    <div className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                                                        {row.product?.category ?? "-"}
                                                    </div>
                                                </div>
                                                <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-xl p-3 border border-gray-200/50 dark:border-gray-700/50">
                                                    <div className="text-xs text-muted-foreground mb-1 font-medium">Warehouse</div>
                                                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                                        {row.warehouse?.sloc}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Stock Stats */}
                                            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 border-2 border-gray-200/50 dark:border-gray-700/50">
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="text-center">
                                                        <div className="text-xs text-muted-foreground mb-2 font-medium">Stok Saat Ini</div>
                                                        <div className={cn(
                                                            "text-2xl font-black tabular-nums",
                                                            row.totalStock === 0
                                                                ? "text-red-600 dark:text-red-400"
                                                                : "text-amber-600 dark:text-amber-400"
                                                        )}>
                                                            {row.totalStock}
                                                        </div>
                                                    </div>
                                                    <div className="text-center border-x border-gray-200 dark:border-gray-700">
                                                        <div className="text-xs text-muted-foreground mb-2 font-medium">Min Stock</div>
                                                        <div className="text-2xl font-black text-gray-600 dark:text-gray-400 tabular-nums">
                                                            {row.minStock}
                                                        </div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-xs text-muted-foreground mb-2 font-medium">Kekurangan</div>
                                                        <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                                            -{shortage}
                                                        </div>
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
                                <TableHead className="w-10">#</TableHead>
                                <TableHead>Material No.</TableHead>
                                <TableHead>Deskripsi</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Warehouse</TableHead>
                                <TableHead className="text-right">Stok Saat Ini</TableHead>
                                <TableHead className="text-right">Min Stock</TableHead>
                                <TableHead className="text-right">Kekurangan</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                        {data.length === 0
                                            ? "Tidak ada produk di bawah minimum stok."
                                            : "Tidak ada hasil sesuai filter."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((row, i) => {
                                    const shortage = row.minStock - row.totalStock
                                    return (
                                        <TableRow
                                            key={row.id}
                                            className={
                                                row.urgency === "critical"
                                                    ? "bg-red-50/50 dark:bg-red-950/10"
                                                    : "bg-amber-50/30 dark:bg-amber-950/10"
                                            }
                                        >
                                            <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                                            <TableCell className="font-mono text-sm font-medium">
                                                {row.product?.materialNumber ?? "-"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {row.product?.materialDescription ?? "-"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {row.product?.category ?? "-"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {row.warehouse?.sloc}
                                                {row.warehouse?.description && (
                                                    <span className="text-muted-foreground text-xs ml-1">
                                                        ({row.warehouse.description})
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-bold">
                                                <span
                                                    className={
                                                        row.totalStock === 0
                                                            ? "text-red-600 dark:text-red-400"
                                                            : "text-amber-600 dark:text-amber-400"
                                                    }
                                                >
                                                    {row.totalStock}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {row.minStock}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="font-semibold text-rose-600">
                                                    -{shortage}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {row.urgency === "critical" ? (
                                                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 gap-1 border-red-200">
                                                        <XCircle className="h-3 w-3" />
                                                        Critical
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 gap-1 border-amber-200">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Warning
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ResponsiveTableWrapper>
            <p className="text-xs text-muted-foreground">
                Menampilkan {filtered.length} dari {data.length} alert
            </p>
        </div>
    )
}
