"use client"

import { useMemo, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { Search, Edit2, Trash2, Package, CheckCircle2, Factory, Download, SlidersHorizontal } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { EvhsStockUsageDialog } from "./evhs-stock-usage-dialog"
import { EvhsEditUsageDialog } from "./evhs-edit-usage-dialog"
import { EvhsMultipleUsageDialog } from "./evhs-multiple-usage-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import type { CheckedState } from "@radix-ui/react-checkbox"
import { toast } from "sonner"
import { exportToExcel } from "@/lib/export-excel"
import { deleteEvhsReceiptItem, deleteEvhsReceiptSerialNumber, deleteEvhsStockAdjustment, deleteEvhsVoucherItem } from "@/app/actions/evhs"
import { EvhsEditReceiptSnDialog } from "./evhs-edit-receipt-sn-dialog"
import { EvhsEditAdjustmentSnDialog } from "./evhs-edit-adjustment-sn-dialog"
import { EvhsBulkEditReceiptSnDialog } from "./evhs-bulk-edit-receipt-sn-dialog"
import { EvhsStockAdjustmentDialog } from "./evhs-stock-adjustment-dialog"

type WarehouseOption = {
    id: number
    sloc: string
    description?: string | null
}

type TrackingRow = {
    id: string
    receiptItemId?: number
    adjustmentId?: number
    serialNumbers?: string[]
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
    warehouse?: WarehouseOption | null
    productId: number
    product?: {
        materialDescription?: string | null
        materialNumberCk?: string | null
        category?: string | null
    } | null
}

type TrackingDialogItem = {
    warehouseId: number
    productId: number
    materialNumberCp: string
    materialNumberCk?: string | null
    sn: string
    serialNumbers?: string[]
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

type MultipleTrackingItem = TrackingDialogItem & {
    id: string
    warehouseLabel?: string
}

export function EvhsTrackingTable({ trackingData }: { trackingData: TrackingRow[] }) {
    const [searchQuery, setSearchQuery] = useState("")
    const [usageDialogOpen, setUsageDialogOpen] = useState(false)
    const [editUsageDialogOpen, setEditUsageDialogOpen] = useState(false)
    const [selectedItem, setSelectedItem] = useState<TrackingRow | null>(null)
    const [multipleUsageDialogOpen, setMultipleUsageDialogOpen] = useState(false)
    const [selectedItemsForBatch, setSelectedItemsForBatch] = useState<string[]>([])
    const [warehouseFilter, setWarehouseFilter] = useState("all")
    const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false)
    const [deletingUsageId, setDeletingUsageId] = useState<number | null>(null)
    const [editReceiptSnOpen, setEditReceiptSnOpen] = useState(false)
    const [bulkEditReceiptSnOpen, setBulkEditReceiptSnOpen] = useState(false)
    const [editAdjustmentSnOpen, setEditAdjustmentSnOpen] = useState(false)
    const [deletingReceiptSn, setDeletingReceiptSn] = useState<string | null>(null)

    const uniqueWarehouses = Array.from(new Map(trackingData.map((item) => [item.warehouseId, item.warehouse])).values()).filter(Boolean) as WarehouseOption[]
    const uniqueProducts = Array.from(new Map(trackingData.map((item) => [item.productId, item.product])).entries())
        .filter(([, product]) => product)
        .map(([id, product]) => ({
            id,
            materialNumber: trackingData.find((item) => item.productId === id)?.materialNumberCp || "-",
            materialNumberCk: product?.materialNumberCk,
            materialDescription: product?.materialDescription,
        }))

    const displayTrackingData = useMemo(() => {
        const grouped = new Map<number, TrackingRow>()
        const result: TrackingRow[] = []
        for (const item of trackingData) {
            if (!item.adjustmentId) {
                result.push(item)
                continue
            }
            const current = grouped.get(item.adjustmentId)
            if (!current) {
                const serialNumbers = item.sn && item.sn !== "-" && (item.availableQty || 0) > 0 ? [item.sn] : []
                const groupedItem = { ...item, id: `adjustment-${item.adjustmentId}-group`, sn: "-", serialNumbers }
                grouped.set(item.adjustmentId, groupedItem)
                result.push(groupedItem)
                continue
            }
            current.qty = (current.qty || 0) + (item.qty || 0)
            current.receivedQty = (current.receivedQty || 0) + (item.receivedQty || 0)
            current.availableQty = (current.availableQty || 0) + (item.availableQty || 0)
            current.usedQty = (current.usedQty || 0) + (item.usedQty || 0)
            if (item.sn && item.sn !== "-" && (item.availableQty || 0) > 0) current.serialNumbers = [...(current.serialNumbers || []), item.sn]
        }
        return result
    }, [trackingData])

    const warehouseFilteredData = displayTrackingData.filter(item =>
        warehouseFilter === "all" || item.warehouseId?.toString() === warehouseFilter
    )

    const getReceivedQty = (item: TrackingRow) => item.receivedQty ?? item.qty ?? 0
    const getAvailableQty = (item: TrackingRow) => item.availableQty ?? (!item.voucherNo ? item.qty || 0 : 0)
    const getUsedQty = (item: TrackingRow) => item.usedQty ?? (item.voucherNo ? getReceivedQty(item) : 0)
    const toTrackingDialogItem = (item: TrackingRow): TrackingDialogItem | null => {
        if (typeof item.warehouseId !== "number") {
            return null
        }

        return {
            warehouseId: item.warehouseId,
            productId: item.productId,
            materialNumberCp: item.materialNumberCp,
            materialNumberCk: item.materialNumberCk,
            sn: item.sn ?? "-",
            serialNumbers: item.serialNumbers,
            qty: item.qty,
            availableQty: item.availableQty,
            cpDo: item.cpDo,
            sourceType: "receipt",
            product: item.product ?? {},
        }
    }

    const toMultipleTrackingItem = (item: TrackingRow): MultipleTrackingItem | null => {
        const normalized = toTrackingDialogItem(item)
        if (!normalized) {
            return null
        }

        return {
            ...normalized,
            id: item.id,
            warehouseLabel: item.warehouse ? `${item.warehouse.sloc} - ${item.warehouse.description || ""}` : undefined,
        }
    }

    const stats = {
        total: warehouseFilteredData.reduce((acc, curr) => acc + getReceivedQty(curr), 0),
        available: warehouseFilteredData.reduce((acc, curr) => acc + getAvailableQty(curr), 0),
        used: warehouseFilteredData.reduce((acc, curr) => acc + getUsedQty(curr), 0)
    }

    const filteredData = warehouseFilteredData.filter((item) => {
        const query = searchQuery.toLowerCase()
        return (
            item.sn?.toLowerCase().includes(query) ||
            item.serialNumbers?.some((serial) => serial.toLowerCase().includes(query)) ||
            item.materialNumberCp?.toLowerCase().includes(query) ||
            item.cpDo?.toLowerCase().includes(query) ||
            item.woNo?.toLowerCase().includes(query) ||
            item.voucherNo?.toLowerCase().includes(query)
        )
    })

    const selectedBatchItems = useMemo(() => (
        displayTrackingData.filter((item) => selectedItemsForBatch.includes(item.id))
    ), [displayTrackingData, selectedItemsForBatch])

    const lockedWarehouseId = selectedBatchItems[0]?.warehouseId || null
    const selectedDialogItem = selectedItem ? toTrackingDialogItem(selectedItem) : null
    const selectedBatchDialogItems = filteredData
        .filter(item => selectedItemsForBatch.includes(item.id.toString()) && getAvailableQty(item) > 0)
        .map(toMultipleTrackingItem)
        .filter((item): item is MultipleTrackingItem => item !== null)

    const handleSelectItem = (item: TrackingRow, checked: CheckedState) => {
        const isChecked = checked === true

        if (!isChecked) {
            setSelectedItemsForBatch(prev => prev.filter(i => i !== item.id))
            return
        }

        if (typeof item.warehouseId !== "number") {
            toast("Item ini belum punya warehouse, jadi belum bisa dibuat voucher.")
            return
        }

        if (lockedWarehouseId && lockedWarehouseId !== item.warehouseId) {
            toast("Multi select voucher hanya bisa untuk 1 warehouse yang sama.")
            return
        }

        setSelectedItemsForBatch(prev =>
            prev.includes(item.id) ? prev : [...prev, item.id]
        )
    }

    const handleSelectAll = (checked: CheckedState) => {
        if (checked !== true) {
            setSelectedItemsForBatch([])
            return
        }

        const selectableItems = filteredData.filter(item => getAvailableQty(item) > 0 && typeof item.warehouseId === "number")
        if (selectableItems.length === 0) return

        const targetWarehouseId = lockedWarehouseId || selectableItems[0]?.warehouseId
        const selectableIds = selectableItems
            .filter(item => item.warehouseId === targetWarehouseId)
            .map(item => item.id.toString())

        setSelectedItemsForBatch(selectableIds)

        if (!lockedWarehouseId && warehouseFilter === "all" && selectableItems.some(item => item.warehouseId !== targetWarehouseId)) {
            toast("Select all mengikuti warehouse pertama yang tampil. Gunakan filter site untuk memilih warehouse lain.")
        }
    }

    const selectableItemsCount = filteredData.filter(item => (
        getAvailableQty(item) > 0 && (!lockedWarehouseId || item.warehouseId === lockedWarehouseId)
    )).length
    const isAllSelected = selectableItemsCount > 0 && filteredData
        .filter(item => getAvailableQty(item) > 0 && (!lockedWarehouseId || item.warehouseId === lockedWarehouseId))
        .every(item => selectedItemsForBatch.includes(item.id.toString()))

    const handleExportExcel = () => {
        const exportData = filteredData.map((item, index) => ({
            "No": index + 1,
            "Date In": item.dateIn ? format(new Date(item.dateIn), "dd-MMM-yy") : "-",
            "Site VHS": item.warehouse ? `${item.warehouse.sloc} - ${item.warehouse.description || ''}` : "-",
            "CP DO": item.cpDo || "-",
            "Material Number CP": item.materialNumberCp,
            "Material Number CK": item.materialNumberCk || "-",
            "SN": item.sn,
            "Qty": item.receivedQty ? `${getAvailableQty(item)} / ${getReceivedQty(item)}` : item.qty,
            "Install Date": item.installDate ? format(new Date(item.installDate), "dd-MMM-yy") : "-",
            "POS": item.pos || "-",
            "Unit ID": item.unitId || "-",
            "Voucher": item.voucherNo || "-",
            "WO Number": item.woNo || "-",
            "GI Number": item.giNumber || "-",
            "MRKO": item.mrko || "-",
            "INV": item.inv || "-"
        }))
        exportToExcel(exportData, `Stock_VHS_WO_${format(new Date(), "yyyyMMdd_HHmmss")}`)
    }

    const handleBulkDelete = async () => {
        let deleted = 0
        for (const item of selectedBatchItems) {
            if (typeof item.adjustmentId === "number") {
                const result = await deleteEvhsStockAdjustment({ adjustmentId: item.adjustmentId })
                if (result.success) deleted++
                else toast.error(result.error)
                continue
            }
            const adjustmentIdFromRow = Number(item.id.match(/^adjustment-(\d+)/)?.[1])
            if (Number.isInteger(adjustmentIdFromRow) && adjustmentIdFromRow > 0) {
                const result = await deleteEvhsStockAdjustment({ adjustmentId: adjustmentIdFromRow })
                if (result.success) deleted++
                else toast.error(result.error)
                continue
            }
            if (typeof item.receiptItemId !== "number") continue
            const result = item.sn && item.sn !== "-"
                ? await deleteEvhsReceiptSerialNumber({ receiptItemId: item.receiptItemId, serialNumber: item.sn })
                : await deleteEvhsReceiptItem({ receiptItemId: item.receiptItemId })
            if (result.success) deleted++
            else toast.error(result.error)
        }
        if (deleted) {
            toast.success(`${deleted} baris berhasil dihapus`)
            setSelectedItemsForBatch([])
            window.location.reload()
        } else {
            toast.error("Baris terpilih tidak dapat dihapus")
        }
    }

    const handleDeleteUsage = async (item: TrackingRow) => {
        if (!item.voucherItemId || !window.confirm(`Hapus usage SN ${item.sn || "-"}? Stok akan dikembalikan.`)) return

        setDeletingUsageId(item.voucherItemId)
        try {
            const result = await deleteEvhsVoucherItem({
                voucherId: item.voucherId!,
                voucherItemId: item.voucherItemId,
            })
            if (result.success) {
                toast.success("Usage EVHS berhasil dihapus")
                window.location.reload()
            } else {
                toast.error("error" in result ? result.error : "Gagal menghapus usage")
            }
        } catch (_error) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setDeletingUsageId(null)
        }
    }

    const handleDeleteReceiptSn = async (item: TrackingRow) => {
        if (!item.receiptItemId || !item.sn || item.sn === "-" || !window.confirm(`Hapus SN ${item.sn} dari supply receipt?`)) return

        setDeletingReceiptSn(item.id)
        try {
            const result = await deleteEvhsReceiptSerialNumber({
                receiptItemId: item.receiptItemId,
                serialNumber: item.sn,
            })
            if (result.success) {
                toast.success("SN receipt berhasil dihapus")
                window.location.reload()
            } else {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setDeletingReceiptSn(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Total Stok Masuk</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.total}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-full">
                            <Package className="h-5 w-5 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Stok Available (Belum Terpakai)</p>
                            <h3 className="text-2xl font-bold text-emerald-600">{stats.available}</h3>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-full">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Stok Digunakan (Voucher)</p>
                            <h3 className="text-2xl font-bold text-amber-600">{stats.used}</h3>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-full">
                            <Factory className="h-5 w-5 text-amber-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center gap-2">
                <select
                    className="flex h-9 w-[250px] items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={warehouseFilter}
                    onChange={(e) => setWarehouseFilter(e.target.value)}
                >
                    <option value="all">Semua Warehouse (Site VHS)</option>
                    {uniqueWarehouses.map((w) => (
                        <option value={w.id.toString()} key={w.id}>{w.sloc} - {w.description}</option>
                    ))}
                </select>

                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Cari SN, Material, DO, WO..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="px-3 py-1.5 font-normal text-sm">
                        Total baris: <strong>{filteredData.length}</strong>
                    </Badge>
                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9">
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setAdjustmentDialogOpen(true)} className="h-9">
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        Adjustment
                    </Button>
                </div>
            </div>

            {selectedItemsForBatch.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="bg-blue-600 text-white border-transparent">
                            {selectedItemsForBatch.length} Terpilih
                        </Badge>
                        <span className="text-sm font-medium text-blue-800">Siap untuk generate voucher massal</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white"
                            onClick={() => setSelectedItemsForBatch([])}
                        >
                            Batalkan
                        </Button>
                        <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => setMultipleUsageDialogOpen(true)}
                        >
                            Generate Multiple Voucher
                        </Button>
                        <Button variant="outline" size="sm" className="bg-white" onClick={() => setBulkEditReceiptSnOpen(true)}>
                            Bulk Edit SN
                        </Button>
                        <Button variant="outline" size="sm" className="bg-white text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleBulkDelete}>
                            Delete Baris
                        </Button>
                    </div>
                </div>
            )}

            <div className="rounded-md border bg-card overflow-auto relative h-[600px] scrollbar-thin scrollbar-thumb-accent">
                <Table className="relative w-full">
                    <TableHeader className="sticky top-0 bg-secondary shadow-sm z-10">
                        <TableRow className="whitespace-nowrap uppercase text-[10px] tracking-wider">
                            <TableHead className="w-[50px] text-center">
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[40px] text-center">NO</TableHead>
                            <TableHead>DATE IN</TableHead>
                            <TableHead>SITE VHS</TableHead>
                            <TableHead>CP DO</TableHead>
                            <TableHead>MATERIAL NUMBER CP</TableHead>
                            <TableHead>NAME DESCRIPTION</TableHead>
                            <TableHead>MATERIAL NUMBER CK</TableHead>
                            <TableHead>SN</TableHead>
                            <TableHead>QTY</TableHead>
                            <TableHead>INSTALL DATE</TableHead>
                            <TableHead>POS</TableHead>
                            <TableHead>UNIT ID</TableHead>
                            <TableHead>VOUCHER</TableHead>
                            <TableHead>WO NUMBER</TableHead>
                            <TableHead>GI NUMBER</TableHead>
                            <TableHead>MRKO</TableHead>
                            <TableHead>INV</TableHead>
                            <TableHead>Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={19} className="h-24 text-center text-muted-foreground">
                                    Tidak ada data pelacakan.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item, index) => {
                                return (
                                <TableRow key={item.id} className={`whitespace-nowrap text-xs ${selectedItemsForBatch.includes(item.id.toString()) ? "bg-blue-50/50" : ""}`}>
                                    <TableCell className="text-center">
                                        {getAvailableQty(item) > 0 && (
                                            <Checkbox
                                                checked={selectedItemsForBatch.includes(item.id.toString())}
                                                disabled={typeof item.warehouseId !== "number" || Boolean(lockedWarehouseId && lockedWarehouseId !== item.warehouseId && !selectedItemsForBatch.includes(item.id.toString()))}
                                                onCheckedChange={(checked) => handleSelectItem(item, checked)}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell className="font-mono text-muted-foreground text-center">{index + 1}</TableCell>
                                    <TableCell suppressHydrationWarning>{item.dateIn ? format(new Date(item.dateIn), "dd-MMM-yy") : "-"}</TableCell>
                                    <TableCell className="font-medium text-[10px]">
                                        {item.warehouse ? `${item.warehouse.sloc} - ${item.warehouse.description || ''}` : "-"}
                                    </TableCell>
                                    <TableCell>{item.cpDo || "-"}</TableCell>
                                    <TableCell className="font-semibold">{item.materialNumberCp}</TableCell>
                                    <TableCell className="max-w-[220px] truncate" title={item.product?.materialDescription || "-"}>{item.product?.materialDescription || "-"}</TableCell>
                                    <TableCell>{item.materialNumberCk || "-"}</TableCell>
                                    <TableCell className="font-mono font-medium">
                                        {item.serialNumbers && item.serialNumbers.length > 0 ? (
                                            <details>
                                                <summary className="cursor-pointer text-indigo-700">{item.serialNumbers.length} SN</summary>
                                                <div className="mt-1 max-h-28 min-w-[150px] overflow-y-auto rounded border bg-muted p-1 text-[10px]">
                                                    {item.serialNumbers.map((serial, serialIndex) => <div key={`${serial}-${serialIndex}`}>{serial}</div>)}
                                                </div>
                                            </details>
                                        ) : item.sn}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {item.receivedQty ? `${getAvailableQty(item)} / ${getReceivedQty(item)}` : item.qty}
                                    </TableCell>
                                    <TableCell suppressHydrationWarning>{item.installDate ? format(new Date(item.installDate), "dd-MMM-yy") : "-"}</TableCell>
                                    <TableCell>{item.pos || "-"}</TableCell>
                                    <TableCell>{item.unitId || "-"}</TableCell>
                                    <TableCell className="font-mono">{item.voucherNo || "-"}</TableCell>
                                    <TableCell className="font-mono">{item.woNo || "-"}</TableCell>
                                    <TableCell className="font-mono">{item.giNumber || "-"}</TableCell>
                                    <TableCell>
                                        {item.mrko ? (
                                            <Badge variant={item.mrko === "SETTLED" ? "default" : "secondary"} className="text-[10px]">
                                                {item.mrko}
                                            </Badge>
                                        ) : "-"}
                                    </TableCell>
                                    <TableCell>{item.inv || "-"}</TableCell>
                                    <TableCell>
                                        {getAvailableQty(item) > 0 ? (
                                            <div className="flex flex-col gap-1 items-center justify-center">
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                                                    onClick={() => {
                                                        if (typeof item.warehouseId !== "number") {
                                                            toast("Warehouse item ini belum terdeteksi, jadi usage belum bisa diinput.")
                                                            return
                                                        }
                                                        setSelectedItem(item)
                                                        setUsageDialogOpen(true)
                                                    }}
                                                >
                                                    Input Usage
                                                </Button>
                                                {(item.receiptItemId || item.adjustmentId) && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700 w-full"
                                                            onClick={() => {
                                                                setSelectedItem(item)
                                                                item.adjustmentId ? setEditAdjustmentSnOpen(true) : setEditReceiptSnOpen(true)
                                                            }}
                                                        >
                                                            <Edit2 className="h-3 w-3 mr-1" />
                                                            {item.sn && item.sn !== "-" ? "Edit SN" : "Input SN"}
                                                        </Button>
                                                            {item.receiptItemId && item.sn && item.sn !== "-" && <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 w-full"
                                                            disabled={deletingReceiptSn === item.id}
                                                            onClick={() => handleDeleteReceiptSn(item)}
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-1" />
                                                            {deletingReceiptSn === item.id ? "Menghapus..." : "Delete SN"}
                                                        </Button>}
                                                            </>
                                                        )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2 items-center justify-center">
                                                <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200">Used / Inputted</Badge>
                                                {item.voucherItemId && (
                                                    <div className="flex w-full flex-col gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 w-full"
                                                            onClick={() => {
                                                                setSelectedItem(item)
                                                                setEditUsageDialogOpen(true)
                                                            }}
                                                        >
                                                            <Edit2 className="h-3 w-3 mr-1" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 w-full"
                                                            disabled={deletingUsageId === item.voucherItemId}
                                                            onClick={() => handleDeleteUsage(item)}
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-1" />
                                                            {deletingUsageId === item.voucherItemId ? "Menghapus..." : "Delete"}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <EvhsMultipleUsageDialog
                open={multipleUsageDialogOpen}
                onOpenChange={setMultipleUsageDialogOpen}
                trackingItems={selectedBatchDialogItems}
                onSuccess={() => setSelectedItemsForBatch([])}
            />

            <EvhsStockUsageDialog
                open={usageDialogOpen}
                onOpenChange={setUsageDialogOpen}
                trackingItem={selectedDialogItem}
            />

            <EvhsEditUsageDialog
                open={editUsageDialogOpen}
                onOpenChange={setEditUsageDialogOpen}
                trackingItem={selectedItem}
            />

            <EvhsEditReceiptSnDialog
                open={editReceiptSnOpen}
                onOpenChange={setEditReceiptSnOpen}
                trackingItem={selectedItem}
            />

            <EvhsBulkEditReceiptSnDialog
                open={bulkEditReceiptSnOpen}
                onOpenChange={setBulkEditReceiptSnOpen}
                items={selectedBatchItems}
                onSuccess={() => {
                    setSelectedItemsForBatch([])
                    window.location.reload()
                }}
            />

            <EvhsEditAdjustmentSnDialog
                open={editAdjustmentSnOpen}
                onOpenChange={setEditAdjustmentSnOpen}
                trackingItem={selectedItem}
            />

            <EvhsStockAdjustmentDialog
                open={adjustmentDialogOpen}
                onOpenChange={setAdjustmentDialogOpen}
                warehouses={uniqueWarehouses}
                products={uniqueProducts}
            />
        </div>
    )
}
