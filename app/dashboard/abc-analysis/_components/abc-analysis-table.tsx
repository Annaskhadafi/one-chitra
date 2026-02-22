"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { Search, AlertTriangle } from "lucide-react"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { ABCProduct } from "@/lib/types"

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
    const [filterClass, setFilterClass] = useState("all")
    const [filterCategory, setFilterCategory] = useState("all")

    const categories = useMemo(() => {
        const cats = new Set(data.map((d) => d.category).filter(Boolean))
        return Array.from(cats).sort()
    }, [data])

    const filtered = useMemo(() => {
        return data.filter((row) => {
            const q = search.toLowerCase()
            const matchSearch =
                !q ||
                row.materialNumber.toLowerCase().includes(q) ||
                row.materialDescription?.toLowerCase().includes(q) ||
                row.brand?.toLowerCase().includes(q)
            const matchClass = filterClass === "all" || row.abcClass === filterClass
            const matchCat = filterCategory === "all" || row.category === filterCategory
            return matchSearch && matchClass && matchCat
        })
    }, [data, search, filterClass, filterCategory])

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
                <Select value={filterClass} onValueChange={setFilterClass}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Kelas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Kelas</SelectItem>
                        <SelectItem value="A">Kelas A</SelectItem>
                        <SelectItem value="B">Kelas B</SelectItem>
                        <SelectItem value="C">Kelas C</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {categories.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
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
                                        ? "Belum ada data pergerakan stok dalam 12 bulan terakhir."
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
            <p className="text-xs text-muted-foreground">
                Menampilkan {filtered.length} dari {data.length} produk dengan pergerakan stok
            </p>
        </div>
    )
}
