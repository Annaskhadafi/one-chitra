"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { StockCardCatalogItem } from "@/lib/stock-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ScoreCard } from "@/components/score-card"
import { Box, Printer, QrCode, Search, Warehouse } from "lucide-react"

type StockCardManagerProps = {
    data: StockCardCatalogItem[]
}

export function StockCardManager({ data }: StockCardManagerProps) {
    const [search, setSearch] = useState("")
    const [warehouseFilter, setWarehouseFilter] = useState("all")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [warehouseType, setWarehouseType] = useState("all")
    const [stockState, setStockState] = useState("all")
    const [selectedIds, setSelectedIds] = useState<number[]>([])

    const warehouses = useMemo(() => {
        return Array.from(
            new Map(
                data.map((item) => [
                    item.warehouseId,
                    {
                        warehouseId: item.warehouseId,
                        label: `${item.warehouseCode}${item.warehouseName ? ` - ${item.warehouseName}` : ""}`,
                    },
                ]),
            ).values(),
        ).sort((left, right) => left.label.localeCompare(right.label))
    }, [data])

    const categories = useMemo(() => {
        return Array.from(new Set(data.map((item) => item.category).filter(Boolean))).sort()
    }, [data])

    const warehouseTypes = useMemo(() => {
        return Array.from(new Set(data.map((item) => item.warehouseType).filter(Boolean))) as string[]
    }, [data])

    const filteredData = useMemo(() => {
        const term = search.trim().toLowerCase()

        return data.filter((item) => {
            const matchesSearch =
                !term ||
                item.category.toLowerCase().includes(term) ||
                item.materialNumber.toLowerCase().includes(term) ||
                item.materialDescription?.toLowerCase().includes(term) ||
                item.oldMaterialNo?.toLowerCase().includes(term) ||
                item.warehouseCode.toLowerCase().includes(term) ||
                item.warehouseName?.toLowerCase().includes(term)

            const matchesWarehouse = warehouseFilter === "all" || item.warehouseId.toString() === warehouseFilter
            const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
            const matchesWarehouseType = warehouseType === "all" || item.warehouseType === warehouseType
            const matchesStockState =
                stockState === "all" ||
                (stockState === "in-stock" && item.currentQty > 0) ||
                (stockState === "empty" && item.currentQty <= 0)

            return matchesSearch && matchesWarehouse && matchesCategory && matchesWarehouseType && matchesStockState
        })
    }, [categoryFilter, data, search, stockState, warehouseFilter, warehouseType])

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
    const visibleIds = filteredData.map((item) => item.stockId)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id))

    const selectedItems = useMemo(() => {
        return data.filter((item) => selectedSet.has(item.stockId))
    }, [data, selectedSet])

    const handleToggleSelection = (stockId: number, checked: boolean) => {
        setSelectedIds((current) => {
            if (checked) {
                return current.includes(stockId) ? current : [...current, stockId]
            }

            return current.filter((id) => id !== stockId)
        })
    }

    const handleToggleVisible = (checked: boolean) => {
        setSelectedIds((current) => {
            if (checked) {
                return Array.from(new Set([...current, ...visibleIds]))
            }

            const visibleSet = new Set(visibleIds)
            return current.filter((id) => !visibleSet.has(id))
        })
    }

    const handlePrint = () => {
        if (!selectedIds.length) return

        const params = new URLSearchParams({
            ids: selectedIds.join(","),
        })

        window.open(`/print/stock-card?${params.toString()}`, "_blank", "noopener,noreferrer")
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <ScoreCard
                    title="Total Label"
                    value={data.length}
                    icon={QrCode}
                    description="Semua kombinasi produk + warehouse"
                    gradient="from-blue-500/10 via-blue-400/5 to-cyan-500/10 border-blue-200/50 hover:shadow-lg"
                    iconColor="text-blue-600"
                    textColor="text-blue-900"
                />
                <ScoreCard
                    title="Terpilih"
                    value={selectedIds.length}
                    icon={Printer}
                    description="Siap dicetak ke A4 landscape / 2 sticker"
                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 hover:shadow-lg"
                    iconColor="text-emerald-600"
                    textColor="text-emerald-900"
                />
                <ScoreCard
                    title="Warehouse"
                    value={new Set(data.map((item) => item.warehouseId)).size}
                    icon={Warehouse}
                    description="Lokasi yang memiliki label stock card"
                    gradient="from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-200/50 hover:shadow-lg"
                    iconColor="text-amber-600"
                    textColor="text-amber-900"
                />
            </div>

            <Card>
                <CardHeader className="gap-3">
                    <CardTitle>Generator Stiker Stock Card</CardTitle>
                    <CardDescription>
                        Pilih item yang ingin dicetak. Setiap sticker akan berisi nama produk, material number, material old number, warehouse, dan barcode scan menuju halaman stock card.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-1 flex-col gap-3 md:flex-row">
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Cari material number, produk, old number, atau warehouse..."
                                    className="pl-9"
                                />
                            </div>

                            <Select value={warehouseType} onValueChange={setWarehouseType}>
                                <SelectTrigger className="w-full md:w-[220px]">
                                    <SelectValue placeholder="Tipe warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Tipe Warehouse</SelectItem>
                                    {warehouseTypes.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                                <SelectTrigger className="w-full md:w-[260px]">
                                    <SelectValue placeholder="Warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Warehouse</SelectItem>
                                    {warehouses.map((warehouse) => (
                                        <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId.toString()}>
                                            {warehouse.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger className="w-full md:w-[220px]">
                                    <SelectValue placeholder="Category Product" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Category</SelectItem>
                                    {categories.map((category) => (
                                        <SelectItem key={category} value={category}>
                                            {category}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={stockState} onValueChange={setStockState}>
                                <SelectTrigger className="w-full md:w-[180px]">
                                    <SelectValue placeholder="Status stok" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Stok</SelectItem>
                                    <SelectItem value="in-stock">Ada Stok</SelectItem>
                                    <SelectItem value="empty">Kosong / 0</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" onClick={() => setSelectedIds([])} disabled={!selectedIds.length}>
                                Reset Pilihan
                            </Button>
                            <Button onClick={handlePrint} disabled={!selectedIds.length}>
                                <Printer className="mr-2 h-4 w-4" />
                                Cetak {selectedIds.length ? `(${selectedIds.length})` : ""}
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        Layout cetak menggunakan kertas A4 landscape dibagi 2 stock card per halaman. Qty tidak dicetak di sticker agar label tetap valid meskipun stok berubah.
                    </div>

                    <div className="rounded-xl border">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-14">
                                            <Checkbox
                                                checked={allVisibleSelected}
                                                onCheckedChange={(checked) => handleToggleVisible(Boolean(checked))}
                                                aria-label="Pilih semua hasil filter"
                                            />
                                        </TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Material Number</TableHead>
                                        <TableHead>Nama Produk</TableHead>
                                        <TableHead>Old Number</TableHead>
                                        <TableHead>Warehouse</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Total Qty</TableHead>
                                        <TableHead className="w-[180px]">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.length ? (
                                        filteredData.map((item) => (
                                            <TableRow key={item.stockId}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedSet.has(item.stockId)}
                                                        onCheckedChange={(checked) => handleToggleSelection(item.stockId, Boolean(checked))}
                                                        aria-label={`Pilih ${item.materialNumber}`}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{item.category}</Badge>
                                                </TableCell>
                                                <TableCell className="font-semibold text-blue-700">
                                                    {item.materialNumber}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="max-w-[320px]">
                                                        <div className="font-medium text-slate-900">
                                                            {item.materialDescription || "-"}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{item.oldMaterialNo || "-"}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="font-medium text-slate-900">
                                                            {item.warehouseCode}
                                                            {item.warehouseName ? ` - ${item.warehouseName}` : ""}
                                                        </div>
                                                        <Badge variant="outline">
                                                            {item.warehouseType || "Warehouse"}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {item.currentQty.toLocaleString("id-ID")}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {item.totalQtyAllWarehouses.toLocaleString("id-ID")}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Link href={`/stock-card/${item.stockId}`} target="_blank">
                                                            <Button size="sm" variant="outline">
                                                                Lihat Scan
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            size="sm"
                                                            variant={selectedSet.has(item.stockId) ? "default" : "secondary"}
                                                            onClick={() => handleToggleSelection(item.stockId, !selectedSet.has(item.stockId))}
                                                        >
                                                            {selectedSet.has(item.stockId) ? "Terpilih" : "Pilih"}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Box className="h-8 w-8 opacity-30" />
                                                    Tidak ada data yang cocok dengan filter saat ini.
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {selectedItems.length > 0 && (
                        <div className="rounded-xl border bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-semibold text-slate-900">Ringkasan Cetak</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedItems.length} label dipilih, estimasi {Math.ceil(selectedItems.length / 2)} halaman cetak.
                                    </p>
                                </div>
                                <Button onClick={handlePrint}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Cetak Sekarang
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {selectedItems.map((item) => (
                                    <Badge key={item.stockId} variant="secondary" className="gap-2 px-3 py-1.5">
                                        {item.materialNumber}
                                        <span className="text-slate-500">|</span>
                                        {item.warehouseCode}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
