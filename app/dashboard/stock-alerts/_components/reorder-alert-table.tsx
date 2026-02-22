"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { AlertTriangle, XCircle, Search } from "lucide-react"
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
import type { ReorderAlert } from "@/lib/types"

interface ReorderAlertTableProps {
    data: ReorderAlert[]
}

export function ReorderAlertTable({ data }: ReorderAlertTableProps) {
    const [search, setSearch] = useState("")
    const [filterUrgency, setFilterUrgency] = useState("all")
    const [filterWarehouse, setFilterWarehouse] = useState("all")

    const warehouses = useMemo(() => {
        const names = new Set(data.map((d) => d.warehouse?.sloc).filter(Boolean) as string[])
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
            return matchSearch && matchUrgency && matchWarehouse
        })
    }, [data, search, filterUrgency, filterWarehouse])

    return (
        <div className="flex flex-col gap-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
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
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Urgency" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Level</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filterWarehouse} onValueChange={setFilterWarehouse}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Warehouse</SelectItem>
                        {warehouses.map((w) => (
                            <SelectItem key={w} value={w}>{w}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
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
            <p className="text-xs text-muted-foreground">
                Menampilkan {filtered.length} dari {data.length} alert
            </p>
        </div>
    )
}
