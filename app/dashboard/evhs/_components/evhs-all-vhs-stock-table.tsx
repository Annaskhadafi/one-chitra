"use client"

import { Fragment, useMemo, useState } from "react"
import type { CheckedState } from "@radix-ui/react-checkbox"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Search, ChevronRight, ChevronDown, Package, Layers3, History, Edit2, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react"
import { EvhsStockUsageDialog } from "./evhs-stock-usage-dialog"
import { EvhsEditUsageDialog } from "./evhs-edit-usage-dialog"
import { EvhsMultipleUsageDialog } from "./evhs-multiple-usage-dialog"
import { toast } from "sonner"
import { exportToExcel } from "@/lib/export-excel"

type EvhsAllVhsDetailRow = {
    id: string
    dateIn?: Date | string | null
    cpDo?: string | null
    sourceLabel?: string
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
    sapStock: number
    totalStock: number
    totalSupply: number
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
    defaultQty?: number
    cpDo?: string | null
    sourceType?: "receipt" | "legacy-stock"
    product: {
        materialDescription?: string | null
        materialNumberCk?: string | null
        category?: string | null
    }
    detailRows?: EvhsAllVhsDetailRow[]
}

type SortKey =
    | "default"
    | "materialNumber"
    | "materialDescription"
    | "category"
    | "sloc"
    | "warehouseDescription"
    | "sapStock"
    | "totalStock"
    | "totalSupply"
    | "usedQty"
    | "availableQty"
    | "status"

type SortDirection = "asc" | "desc"

const MAIN_TABLE_COLUMN_COUNT = 15

function getWarehouseLabel(warehouse: { sloc: string; description?: string | null }) {
    return warehouse.description ? `${warehouse.sloc} - ${warehouse.description}` : warehouse.sloc
}

function getCategoryPriority(category: string) {
    return category.toUpperCase() === "TYRE" ? 0 : 1
}

function getStatusLabel(row: Pick<EvhsAllVhsStockRow, "availableQty" | "usedQty" | "totalStock">) {
    const effectiveAvailable = (row.availableQty && row.availableQty > 0) ? row.availableQty : (row.totalStock || 0)
    if (effectiveAvailable === 0) return "Used Out"
    if (row.usedQty > 0) return "Partial"
    return "Ready"
}

function compareText(left: string, right: string) {
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
}

function compareNumber(left: number, right: number) {
    return left - right
}

function sortRows(left: EvhsAllVhsStockRow, right: EvhsAllVhsStockRow, key: SortKey, direction: SortDirection) {
    const directionFactor = direction === "asc" ? 1 : -1
    let result = 0

    switch (key) {
        case "materialNumber":
            result = compareText(left.materialNumber, right.materialNumber)
            break
        case "materialDescription":
            result = compareText(left.materialDescription || "", right.materialDescription || "")
            break
        case "category":
            result = compareText(left.category, right.category)
            break
        case "sloc":
            result = compareText(left.warehouse.sloc, right.warehouse.sloc)
            break
        case "warehouseDescription":
            result = compareText(left.warehouse.description || "", right.warehouse.description || "")
            break
        case "totalStock":
            result = compareNumber(left.totalStock, right.totalStock)
            break
        case "totalSupply":
            result = compareNumber(left.totalSupply, right.totalSupply)
            break
        case "sapStock":
            result = compareNumber(left.sapStock, right.sapStock)
            break
        case "usedQty":
            result = compareNumber(left.usedQty, right.usedQty)
            break
        case "availableQty":
            result = compareNumber(left.availableQty, right.availableQty)
            break
        case "status":
            result = compareText(getStatusLabel(left), getStatusLabel(right))
            break
        case "default":
        default:
            result = compareText(getWarehouseLabel(left.warehouse), getWarehouseLabel(right.warehouse))
            if (result === 0) {
                result = compareNumber(getCategoryPriority(left.category), getCategoryPriority(right.category))
            }
            if (result === 0) {
                result = compareText(left.materialNumber, right.materialNumber)
            }
            break
    }

    if (result !== 0) {
        return result * directionFactor
    }

    const siteFallback = compareText(getWarehouseLabel(left.warehouse), getWarehouseLabel(right.warehouse))
    if (siteFallback !== 0) return siteFallback

    const categoryFallback = compareNumber(getCategoryPriority(left.category), getCategoryPriority(right.category))
    if (categoryFallback !== 0) return categoryFallback

    return compareText(left.materialNumber, right.materialNumber)
}

function SortableHeader({
    label,
    active,
    direction,
    onClick,
    className,
}: {
    label: string
    active: boolean
    direction: SortDirection
    onClick: () => void
    className?: string
}) {
    const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-auto px-0 py-0 text-[10px] font-semibold uppercase tracking-wider text-slate-700 hover:bg-transparent ${className || ""}`}
            onClick={onClick}
        >
            {label}
            <Icon className="ml-1 h-3 w-3" />
        </Button>
    )
}

export function EvhsAllVhsStockTable({ rows }: { rows: EvhsAllVhsStockRow[] }) {
    const [searchQuery, setSearchQuery] = useState("")
    const [warehouseFilter, setWarehouseFilter] = useState("all")
    const [expandedRows, setExpandedRows] = useState<string[]>([])
    const [selectedUsageItem, setSelectedUsageItem] = useState<UsageTrackingItem | null>(null)
    const [usageDialogOpen, setUsageDialogOpen] = useState(false)
    const [selectedEditItem, setSelectedEditItem] = useState<EvhsAllVhsDetailRow | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [multipleUsageDialogOpen, setMultipleUsageDialogOpen] = useState(false)
    const [selectedItemsForBatch, setSelectedItemsForBatch] = useState<string[]>([])
    const [sortKey, setSortKey] = useState<SortKey>("default")
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

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

    const sortedRows = useMemo(() => {
        return [...filteredRows].sort((left, right) => sortRows(left, right, sortKey, sortDirection))
    }, [filteredRows, sortKey, sortDirection])

    const stats = useMemo(() => {
        return sortedRows.reduce((accumulator, row) => {
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
    }, [sortedRows])

    const selectedBatchRows = useMemo(() => {
        return rows.filter((row) => selectedItemsForBatch.includes(row.id))
    }, [rows, selectedItemsForBatch])

    const lockedWarehouseId = selectedBatchRows[0]?.warehouseId || null
    const lockedWarehouseLabel = selectedBatchRows[0]?.warehouse
        ? getWarehouseLabel(selectedBatchRows[0].warehouse)
        : null

    const selectableRowsInView = sortedRows.filter((row) => row.totalStock > 0)
    const selectableRowsForLockedWarehouse = selectableRowsInView.filter((row) => (
        !lockedWarehouseId || row.warehouseId === lockedWarehouseId
    ))
    const isAllSelected = selectableRowsForLockedWarehouse.length > 0 && (
        selectableRowsForLockedWarehouse.every((row) => selectedItemsForBatch.includes(row.id))
    )

    const toggleExpanded = (rowId: string) => {
        setExpandedRows((currentRows) =>
            currentRows.includes(rowId)
                ? currentRows.filter((currentRowId) => currentRowId !== rowId)
                : [...currentRows, rowId]
        )
    }

    const requestSort = (nextSortKey: SortKey) => {
        if (sortKey === nextSortKey) {
            setSortDirection((currentDirection) => currentDirection === "asc" ? "desc" : "asc")
            return
        }

        setSortKey(nextSortKey)
        setSortDirection("asc")
    }

    const handleSelectItem = (row: EvhsAllVhsStockRow, checked: CheckedState) => {
        const isChecked = checked === true
        if (!isChecked) {
            setSelectedItemsForBatch((currentRows) => currentRows.filter((currentRowId) => currentRowId !== row.id))
            return
        }

        if (lockedWarehouseId && lockedWarehouseId !== row.warehouseId) {
            toast("Multi select voucher hanya bisa untuk 1 warehouse yang sama.")
            return
        }

        setSelectedItemsForBatch((currentRows) => (
            currentRows.includes(row.id) ? currentRows : [...currentRows, row.id]
        ))
    }

    const handleSelectAll = (checked: CheckedState) => {
        if (checked !== true) {
            setSelectedItemsForBatch([])
            return
        }

        if (selectableRowsInView.length === 0) {
            return
        }

        const targetWarehouseId = lockedWarehouseId || selectableRowsInView[0]?.warehouseId
        const rowsToSelect = selectableRowsInView
            .filter((row) => row.warehouseId === targetWarehouseId)
            .map((row) => row.id)

        setSelectedItemsForBatch(rowsToSelect)

        if (!lockedWarehouseId && warehouseFilter === "all" && selectableRowsInView.some((row) => row.warehouseId !== targetWarehouseId)) {
            toast("Select all mengikuti warehouse pertama yang tampil. Gunakan filter site untuk memilih warehouse lain.")
        }
    }

    const openLegacyUsage = (row: EvhsAllVhsStockRow) => {
        const availableStock = row.availableQty > 0 ? row.availableQty : row.totalStock
        const isEvhsSupply = row.totalSupply > 0
        setSelectedUsageItem({
            warehouseId: row.warehouseId,
            productId: row.productId,
            materialNumberCp: row.materialNumber,
            materialNumberCk: row.materialNumberCk,
            sn: "-",
            qty: availableStock,
            availableQty: availableStock,
            defaultQty: row.category.toUpperCase() === "TYRE" ? 1 : availableStock,
            cpDo: isEvhsSupply ? "EVHS SUPPLY" : "LEGACY STOCK",
            sourceType: isEvhsSupply ? "receipt" : "legacy-stock",
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

    const handleExportExcel = () => {
        const exportData = sortedRows.map((row, index) => ({
            "No": index + 1,
            "Material Number": row.materialNumber,
            "Material Description": row.materialDescription || "-",
            "Category": row.category,
            "SLoc": row.warehouse.sloc,
            "SLoc Description": row.warehouse.description || "-",
            "Stock SAP": row.sapStock,
            "Stock Local": row.totalStock,
            "Total Supply": row.totalSupply,
            "Used EVHS": row.usedQty,
            "Variants": row.availableQty,
            "Status": getStatusLabel(row)
        }))
        exportToExcel(exportData, `Stock_All_VHS_${format(new Date(), "yyyyMMdd_HHmmss")}`)
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
                            <p className="text-sm text-slate-500">Variants</p>
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
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-3 py-1.5 text-sm font-normal">
                        Total baris: <strong>{sortedRows.length}</strong>
                    </Badge>
                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-8">
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
                </div>
            </div>

            {selectedItemsForBatch.length > 0 && (
                <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="border-transparent bg-blue-600 text-white">
                                {selectedItemsForBatch.length} item terpilih
                            </Badge>
                            <span className="text-sm font-medium text-blue-900">Siap dibuat 1 voucher bundle.</span>
                        </div>
                        <p className="text-xs text-blue-800">
                            Multi select hanya untuk 1 warehouse yang sama{lockedWarehouseLabel ? `: ${lockedWarehouseLabel}` : ""}.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-white"
                            onClick={() => setSelectedItemsForBatch([])}
                        >
                            Batalkan
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => setMultipleUsageDialogOpen(true)}
                        >
                            Generate Multiple Voucher
                        </Button>
                    </div>
                </div>
            )}

            <div className="rounded-md border bg-card">
                <div className="relative h-[640px] overflow-auto scrollbar-thin scrollbar-thumb-accent">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-secondary shadow-sm">
                            <TableRow className="whitespace-nowrap uppercase text-[10px] tracking-wider">
                                <TableHead className="w-[52px] text-center">
                                    <Checkbox
                                        checked={isAllSelected}
                                        onCheckedChange={handleSelectAll}
                                        aria-label="Pilih semua item"
                                    />
                                </TableHead>
                                <TableHead className="w-[52px] text-center">Detail</TableHead>
                                <TableHead className="w-[52px] text-center">No</TableHead>
                                <TableHead>
                                    <SortableHeader label="Material #" active={sortKey === "materialNumber"} direction={sortDirection} onClick={() => requestSort("materialNumber")} />
                                </TableHead>
                                <TableHead>
                                    <SortableHeader label="Description" active={sortKey === "materialDescription"} direction={sortDirection} onClick={() => requestSort("materialDescription")} />
                                </TableHead>
                                <TableHead>
                                    <SortableHeader label="Category" active={sortKey === "category"} direction={sortDirection} onClick={() => requestSort("category")} />
                                </TableHead>
                                <TableHead>
                                    <SortableHeader label="SLoc" active={sortKey === "sloc"} direction={sortDirection} onClick={() => requestSort("sloc")} />
                                </TableHead>
                                <TableHead>
                                    <SortableHeader label="SLoc Desc" active={sortKey === "warehouseDescription"} direction={sortDirection} onClick={() => requestSort("warehouseDescription")} />
                                </TableHead>
                                <TableHead className="text-right">
                                    <SortableHeader label="Stock SAP" active={sortKey === "sapStock"} direction={sortDirection} onClick={() => requestSort("sapStock")} className="justify-end" />
                                </TableHead>
                                <TableHead className="text-right">
                                    <SortableHeader label="Stock Local" active={sortKey === "totalStock"} direction={sortDirection} onClick={() => requestSort("totalStock")} className="justify-end" />
                                </TableHead>
                                <TableHead className="text-right">
                                    <SortableHeader label="Total Supply" active={sortKey === "totalSupply"} direction={sortDirection} onClick={() => requestSort("totalSupply")} className="justify-end" />
                                </TableHead>
                                <TableHead className="text-right">
                                    <SortableHeader label="Used EVHS" active={sortKey === "usedQty"} direction={sortDirection} onClick={() => requestSort("usedQty")} className="justify-end" />
                                </TableHead>
                                <TableHead className="text-right">
                                    <SortableHeader label="Variants" active={sortKey === "availableQty"} direction={sortDirection} onClick={() => requestSort("availableQty")} className="justify-end" />
                                </TableHead>
                                <TableHead>
                                    <SortableHeader label="Status" active={sortKey === "status"} direction={sortDirection} onClick={() => requestSort("status")} />
                                </TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedRows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={MAIN_TABLE_COLUMN_COUNT} className="h-24 text-center text-muted-foreground">
                                        Tidak ada stock VHS CK yang cocok dengan filter.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedRows.map((row, index) => {
                                    const isTyre = row.category.toUpperCase() === "TYRE"
                                    const isExpanded = expandedRows.includes(row.id)
                                    const effectiveAvailable = (row.availableQty && row.availableQty > 0) ? row.availableQty : (row.totalStock || 0)
                                    const statusVariant = effectiveAvailable === 0
                                        ? "bg-slate-100 text-slate-700 border-slate-200"
                                        : row.usedQty > 0
                                            ? "bg-amber-100 text-amber-700 border-amber-200"
                                            : "bg-emerald-100 text-emerald-700 border-emerald-200"
                                    const statusLabel = getStatusLabel(row)
                                    const isSelected = selectedItemsForBatch.includes(row.id)
                                    const selectionLockedByOtherWarehouse = Boolean(lockedWarehouseId && lockedWarehouseId !== row.warehouseId && !isSelected)

                                    return (
                                        <Fragment key={row.id}>
                                            <TableRow key={row.id} className={`whitespace-nowrap text-xs ${isSelected ? "bg-blue-50/50" : ""}`}>
                                                <TableCell className="text-center">
                                                    {(row.availableQty > 0 || row.totalStock > 0) ? (
                                                        <Checkbox
                                                            checked={isSelected}
                                                            disabled={selectionLockedByOtherWarehouse}
                                                            onCheckedChange={(checked) => handleSelectItem(row, checked)}
                                                            aria-label={`Pilih ${row.materialNumber}`}
                                                        />
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
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
                                                <TableCell className="text-right font-mono text-slate-700">{row.sapStock}</TableCell>
                                                <TableCell className="text-right font-mono font-bold">{row.totalStock}</TableCell>
                                                <TableCell className="text-right font-mono font-bold text-indigo-700">{row.totalSupply}</TableCell>
                                                <TableCell className="text-right font-mono text-amber-700">{row.usedQty}</TableCell>
                                                <TableCell className="text-right font-mono text-emerald-700">{row.availableQty}</TableCell>
                                                <TableCell>
                                                    <Badge className={statusVariant}>{statusLabel}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {(row.availableQty > 0 || row.totalStock > 0) ? (
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
                                                                            <TableHead>Source</TableHead>
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
                                                                                <TableCell colSpan={18} className="h-20 text-center text-muted-foreground">
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
                                                                                        <TableCell>
                                                                                            <Badge variant={detailRow.sourceLabel === "Voucher Legacy" ? "secondary" : "outline"} className="text-[10px]">
                                                                                                {detailRow.sourceLabel || "Penerimaan EVHS"}
                                                                                            </Badge>
                                                                                        </TableCell>
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

            <EvhsMultipleUsageDialog
                open={multipleUsageDialogOpen}
                onOpenChange={setMultipleUsageDialogOpen}
                trackingItems={rows
                    .filter((row) => selectedItemsForBatch.includes(row.id) && row.totalStock > 0)
                    .map((row) => ({
                        id: row.id,
                        warehouseId: row.warehouseId,
                        warehouseLabel: getWarehouseLabel(row.warehouse),
                        productId: row.productId,
                        materialNumberCp: row.materialNumber,
                        materialNumberCk: row.materialNumberCk,
                        sn: "-",
                        qty: row.totalStock,
                        availableQty: row.totalStock,
                        defaultQty: 1,
                        sourceType: "legacy-stock" as const,
                        product: {
                            materialDescription: row.materialDescription,
                            materialNumberCk: row.materialNumberCk,
                            category: row.category,
                        },
                    }))}
                onSuccess={() => setSelectedItemsForBatch([])}
            />

            <EvhsEditUsageDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                trackingItem={selectedEditItem}
            />
        </div>
    )
}
