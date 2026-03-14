"use client"

import { Fragment, useMemo, useState } from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Search, ChevronRight, ChevronDown, Package, Layers3, History, Edit2 } from "lucide-react"
import { EvhsStockUsageDialog } from "./evhs-stock-usage-dialog"
import { EvhsEditUsageDialog } from "./evhs-edit-usage-dialog"

type EvhsAllVhsDetailRow = {
    id: string
    dateIn?: Date | string | null
    cpDo?: string | null
    materialNumberCp: string
    materialNumberCk?: string | null
    sn?: string | null
    qty?: number
    receivedQty?: number
    availableQty?: number
    usedQty?: number
    installDate?: Date | string | null
    pos?: string | null
    unitId?: string | null
    voucherNo?: string | null
    voucherId?: number | null
    voucherItemId?: number | null
    woNo?: string | null
    giNumber?: string | null
    mrko?: string | null
    inv?: string | null
    warehouseId?: number | null
    warehouse?: {
        id: number
        sloc: string
        description?: string | null
    } | null
    productId: number
    product?: {
        materialDescription?: string | null
        materialNumberCk?: string | null
        category?: string | null
    } | null
}

type EvhsAllVhsStockRow = {
    id: string
    warehouseId: number
    warehouse: {
        id: number
        sloc: string
        description?: string | null
        type?: string | null
    }
    productId: number
    materialNumber: string
    materialNumberCk?: string | null
    materialDescription?: string | null
    category: string
    totalStock: number
    usedQty: number
    availableQty: number
    detailRows: EvhsAllVhsDetailRow[]
}

type UsageTrackingItem = {
    warehouseId: number
    productId: number
    materialNumberCp: string
    materialNumberCk?: string | null
    sn: string
    qty?: number
    availableQty?: number
    cpDo?: string | null
    sourceType?: "receipt" | "legacy-stock"
    product: {
        materialDescription?: string | null
        materialNumberCk?: string | null
        category?: string | null
    }
}

const MAIN_TABLE_COLUMN_COUNT = 12

export function EvhsAllVhsStockTable({ rows }: { rows: EvhsAllVhsStockRow[] }) {
    const [searchQuery, setSearchQuery] = useState("")
    const [warehouseFilter, setWarehouseFilter] = useState("all")
    const [expandedRows, setExpandedRows] = useState<string[]>([])
    const [selectedUsageItem, setSelectedUsageItem] = useState<UsageTrackingItem | null>(null)
    const [usageDialogOpen, setUsageDialogOpen] = useState(false)
    const [selectedEditItem, setSelectedEditItem] = useState<EvhsAllVhsDetailRow | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)

    const warehouseOptions = useMemo(() => {
        return Array.from(
            new Map(rows.map((row) => [row.warehouseId, row.warehouse])).values()
        ).sort((left, right) => {
            const leftLabel = `${left.sloc} - ${left.description || ""}`.trim()
            const rightLabel = `${right.sloc} - ${right.description || ""}`.trim()
            return leftLabel.localeCompare(rightLabel)
        })
    }, [rows])

    const filteredRows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()

        return rows.filter((row) => {
            const matchesWarehouse = warehouseFilter === "all" || row.warehouseId.toString() === warehouseFilter
            if (!matchesWarehouse) return false

            if (!query) return true

            return (
                row.materialNumber.toLowerCase().includes(query) ||
                (row.materialNumberCk || "").toLowerCase().includes(query) ||
                (row.materialDescription || "").toLowerCase().includes(query) ||
                row.category.toLowerCase().includes(query) ||
                row.warehouse.sloc.toLowerCase().includes(query) ||
                (row.warehouse.description || "").toLowerCase().includes(query)
            )
        })
    }, [rows, searchQuery, warehouseFilter])

    const stats = useMemo(() => {
        return filteredRows.reduce((accumulator, row) => {
            accumulator.totalItems += 1
            accumulator.totalStock += row.totalStock
            accumulator.usedQty += row.usedQty
            accumulator.availableQty += row.availableQty
            return accumulator
        }, {
            totalItems: 0,
            totalStock: 0,
            usedQty: 0,
            availableQty: 0,
        })
    }, [filteredRows])

    const toggleExpanded = (rowId: string) => {
        setExpandedRows((currentRows) =>
            currentRows.includes(rowId)
                ? currentRows.filter((currentRowId) => currentRowId !== rowId)
                : [...currentRows, rowId]
        )
    }

    const openLegacyUsage = (row: EvhsAllVhsStockRow) => {
        setSelectedUsageItem({
            warehouseId: row.warehouseId,
            productId: row.productId,
            materialNumberCp: row.materialNumber,
            materialNumberCk: row.materialNumberCk,
            sn: "-",
            qty: row.availableQty,
            availableQty: row.availableQty,
            cpDo: "LEGACY STOCK",
            sourceType: "legacy-stock",
            product: {
                materialDescription: row.materialDescription,
                materialNumberCk: row.materialNumberCk,
                category: row.category,
            },
        })
        setUsageDialogOpen(true)
    }

    const openDetailUsage = (row: EvhsAllVhsDetailRow) => {
        setSelectedUsageItem({
            warehouseId: row.warehouseId || 0,
            productId: row.productId,
            materialNumberCp: row.materialNumberCp,
            materialNumberCk: row.materialNumberCk,
            sn: row.sn || "-",
            qty: row.qty,
            availableQty: row.availableQty,
            cpDo: row.cpDo,
            sourceType: "receipt",
            product: {
                materialDescription: row.product?.materialDescription,
                materialNumberCk: row.product?.materialNumberCk,
                category: row.product?.category,
            },
        })
        setUsageDialogOpen(true)
    }

    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-sm text-slate-500">Material Stock</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.totalItems}</p>
                        </div>
                        <div className="rounded-full bg-slate-100 p-3">
                            <Layers3 className="h-5 w-5 text-slate-700" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-sm text-slate-500">Stock Local</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.totalStock}</p>
                        </div>
                        <div className="rounded-full bg-blue-50 p-3">
                            <Package className="h-5 w-5 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-sm text-slate-500">Used EVHS</p>
                            <p className="text-2xl font-bold text-amber-600">{stats.usedQty}</p>
                        </div>
                        <div className="rounded-full bg-amber-50 p-3">
                            <History className="h-5 w-5 text-amber-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-sm text-slate-500">Available EVHS</p>
                            <p className="text-2xl font-bold text-emerald-600">{stats.availableQty}</p>
                        </div>
                        <div className="rounded-full bg-emerald-50 p-3">
                            <Package className="h-5 w-5 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                    <div className="w-full md:w-[260px]">
                        <select
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={warehouseFilter}
                            onChange={(event) => setWarehouseFilter(event.target.value)}
                        >
                            <option value="all">Semua Site CK VHS</option>
                            {warehouseOptions.map((warehouse) => (
                                <option key={warehouse.id} value={warehouse.id.toString()}>
                                    {warehouse.sloc} - {warehouse.description}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="relative w-full md:max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari material, CK, site, kategori..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </div>
                </div>
                <Badge variant="outline" className="px-3 py-1.5 text-sm font-normal">
                    Total baris: <strong>{filteredRows.length}</strong>
                </Badge>
            </div>

            <div className="rounded-md border bg-card">
                <div className="relative h-[640px] overflow-auto scrollbar-thin scrollbar-thumb-accent">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-secondary shadow-sm">
                            <TableRow className="whitespace-nowrap uppercase text-[10px] tracking-wider">
                                <TableHead className="w-[52px] text-center">Detail</TableHead>
                                <TableHead className="w-[52px] text-center">No</TableHead>
                                <TableHead>Material #</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>SLoc</TableHead>
                                <TableHead>SLoc Desc</TableHead>
                                <TableHead className="text-right">Stock Local</TableHead>
                                <TableHead className="text-right">Used EVHS</TableHead>
                                <TableHead className="text-right">Available EVHS</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={MAIN_TABLE_COLUMN_COUNT} className="h-24 text-center text-muted-foreground">
                                        Tidak ada stock VHS CK yang cocok dengan filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRows.map((row, index) => {
                                    const isTyre = row.category.toUpperCase() === "TYRE"
                                    const isExpanded = expandedRows.includes(row.id)
                                    const statusVariant = row.availableQty === 0
                                        ? "bg-slate-100 text-slate-700 border-slate-200"
                                        : row.usedQty > 0
                                            ? "bg-amber-100 text-amber-700 border-amber-200"
                                            : "bg-emerald-100 text-emerald-700 border-emerald-200"
                                    const statusLabel = row.availableQty === 0
                                        ? "Used Out"
                                        : row.usedQty > 0
                                            ? "Partial"
                                            : "Ready"

                                    return (
                                        <Fragment key={row.id}>
                                            <TableRow key={row.id} className="whitespace-nowrap text-xs">
                                                <TableCell className="text-center">
                                                    {isTyre ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => toggleExpanded(row.id)}
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronDown className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronRight className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-mono text-muted-foreground">{index + 1}</TableCell>
                                                <TableCell className="font-semibold text-blue-600">{row.materialNumber}</TableCell>
                                                <TableCell className="max-w-[280px] truncate" title={row.materialDescription || ""}>
                                                    {row.materialDescription || "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{row.category}</Badge>
                                                </TableCell>
                                                <TableCell>{row.warehouse.sloc}</TableCell>
                                                <TableCell>{row.warehouse.description || "-"}</TableCell>
                                                <TableCell className="text-right font-mono font-bold">{row.totalStock}</TableCell>
                                                <TableCell className="text-right font-mono text-amber-700">{row.usedQty}</TableCell>
                                                <TableCell className="text-right font-mono text-emerald-700">{row.availableQty}</TableCell>
                                                <TableCell>
                                                    <Badge className={statusVariant}>{statusLabel}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {row.availableQty > 0 ? (
                                                        <Button
                                                            size="sm"
                                                            className={isTyre ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                                                            onClick={() => openLegacyUsage(row)}
                                                        >
                                                            {isTyre ? "Input SN / Usage" : "Input Usage"}
                                                        </Button>
                                                    ) : (
                                                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                                            Used / Inputted
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {isTyre && isExpanded && (
                                                <TableRow className="bg-slate-50/70">
                                                    <TableCell colSpan={MAIN_TABLE_COLUMN_COUNT} className="p-0">
                                                        <div className="space-y-3 p-4">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-800">Detail TYRE / SN</p>
                                                                    <p className="text-xs text-slate-500">
                                                                        Menampilkan detail SN, voucher, dan usage EVHS untuk {row.materialNumber}.
                                                                    </p>
                                                                </div>
                                                                <Badge variant="secondary">{row.detailRows.length} baris detail</Badge>
                                                            </div>

                                                            <div className="rounded-md border bg-white">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="whitespace-nowrap uppercase text-[10px] tracking-wider">
                                                                            <TableHead className="text-center">No</TableHead>
                                                                            <TableHead>Date In</TableHead>
                                                                            <TableHead>Site VHS</TableHead>
                                                                            <TableHead>CP DO</TableHead>
                                                                            <TableHead>Material Number CP</TableHead>
                                                                            <TableHead>Material Number CK</TableHead>
                                                                            <TableHead>SN</TableHead>
                                                                            <TableHead>Qty</TableHead>
                                                                            <TableHead>Install Date</TableHead>
                                                                            <TableHead>POS</TableHead>
                                                                            <TableHead>Unit ID</TableHead>
                                                                            <TableHead>Voucher</TableHead>
                                                                            <TableHead>WO Number</TableHead>
                                                                            <TableHead>GI Number</TableHead>
                                                                            <TableHead>MRKO</TableHead>
                                                                            <TableHead>INV</TableHead>
                                                                            <TableHead>Aksi</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {row.detailRows.length === 0 ? (
                                                                            <TableRow>
                                                                                <TableCell colSpan={17} className="h-20 text-center text-muted-foreground">
                                                                                    Belum ada SN atau usage EVHS untuk material ini. Gunakan tombol <strong>Input SN / Usage</strong> di baris utama.
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ) : (
                                                                            row.detailRows.map((detailRow, detailIndex) => {
                                                                                const availableQty = detailRow.availableQty ?? 0
                                                                                const receivedQty = detailRow.receivedQty ?? detailRow.qty ?? 0
                                                                                const qtyLabel = detailRow.receivedQty !== undefined
                                                                                    ? `${availableQty} / ${receivedQty}`
                                                                                    : (detailRow.qty ?? 0)

                                                                                return (
                                                                                    <TableRow key={detailRow.id} className="whitespace-nowrap text-xs">
                                                                                        <TableCell className="text-center font-mono text-muted-foreground">{detailIndex + 1}</TableCell>
                                                                                        <TableCell suppressHydrationWarning>
                                                                                            {detailRow.dateIn ? format(new Date(detailRow.dateIn), "dd-MMM-yy") : "-"}
                                                                                        </TableCell>
                                                                                        <TableCell>
                                                                                            {detailRow.warehouse
                                                                                                ? `${detailRow.warehouse.sloc} - ${detailRow.warehouse.description || ""}`
                                                                                                : `${row.warehouse.sloc} - ${row.warehouse.description || ""}`}
                                                                                        </TableCell>
                                                                                        <TableCell>{detailRow.cpDo || "-"}</TableCell>
                                                                                        <TableCell className="font-semibold">{detailRow.materialNumberCp}</TableCell>
                                                                                        <TableCell>{detailRow.materialNumberCk || "-"}</TableCell>
                                                                                        <TableCell className="font-mono font-medium">{detailRow.sn || "-"}</TableCell>
                                                                                        <TableCell className="text-right font-mono">{qtyLabel}</TableCell>
                                                                                        <TableCell suppressHydrationWarning>
                                                                                            {detailRow.installDate ? format(new Date(detailRow.installDate), "dd-MMM-yy") : "-"}
                                                                                        </TableCell>
                                                                                        <TableCell>{detailRow.pos || "-"}</TableCell>
                                                                                        <TableCell>{detailRow.unitId || "-"}</TableCell>
                                                                                        <TableCell className="font-mono">{detailRow.voucherNo || "-"}</TableCell>
                                                                                        <TableCell className="font-mono">{detailRow.woNo || "-"}</TableCell>
                                                                                        <TableCell className="font-mono">{detailRow.giNumber || "-"}</TableCell>
                                                                                        <TableCell>
                                                                                            {detailRow.mrko ? (
                                                                                                <Badge variant={detailRow.mrko === "SETTLED" ? "default" : "secondary"} className="text-[10px]">
                                                                                                    {detailRow.mrko}
                                                                                                </Badge>
                                                                                            ) : "-"}
                                                                                        </TableCell>
                                                                                        <TableCell>{detailRow.inv || "-"}</TableCell>
                                                                                        <TableCell>
                                                                                            {availableQty > 0 ? (
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    className="h-7 bg-indigo-600 px-3 text-xs hover:bg-indigo-700"
                                                                                                    onClick={() => openDetailUsage(detailRow)}
                                                                                                >
                                                                                                    Input Usage
                                                                                                </Button>
                                                                                            ) : detailRow.voucherItemId ? (
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="ghost"
                                                                                                    className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                                                                                    onClick={() => {
                                                                                                        setSelectedEditItem(detailRow)
                                                                                                        setEditDialogOpen(true)
                                                                                                    }}
                                                                                                >
                                                                                                    <Edit2 className="mr-1 h-3 w-3" />
                                                                                                    Edit
                                                                                                </Button>
                                                                                            ) : (
                                                                                                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                                                                                    Used / Inputted
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
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <EvhsStockUsageDialog
                open={usageDialogOpen}
                onOpenChange={setUsageDialogOpen}
                trackingItem={selectedUsageItem}
            />

            <EvhsEditUsageDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                trackingItem={selectedEditItem}
            />
        </div>
    )
}
