"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Search, FileText, MoreHorizontal, Edit, Trash2, PackagePlus, ClipboardEdit, Printer } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { format } from "date-fns"
import { EvhsVoucherPreview, openBulkVoucherPrint } from "./evhs-voucher-preview"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EvhsEditVoucherDialog } from "./evhs-edit-voucher-dialog"
import { EvhsAddManualVoucherDialog } from "./evhs-add-manual-voucher-dialog"
import { EvhsFillDraftDialog, type DraftVoucher } from "./evhs-fill-draft-dialog"
import { deleteEvhsVoucher } from "@/app/actions/evhs"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

type WarehouseOption = {
    id: number
    sloc?: string | null
    description?: string | null
    type?: string | null
}

type ProductOption = {
    id: number
    materialNumber: string
    materialNumberCk?: string | null
    materialDescription?: string | null
    category?: string | null
}

type VoucherRow = {
    id: number
    vhsNo: string
    date: string | Date
    warehouseId: number
    woNo?: string | null
    status: string
    items: Array<{
        id: number
        productId: number
        qty: number | string
        serialNumber?: string | null
        materialNumberCk?: string | null
        unitPrice?: string | number | null
        lineTotal?: number | null
        pos?: string | null
        unitId?: string | null
        product?: {
            materialNumber?: string | null
            materialDescription?: string | null
        } | null
    }>
    totalAmount?: number | null
    remark?: string | null
    receivedByName?: string | null
    approvedByName?: string | null
    canDelete?: boolean
    warehouse?: {
        sloc?: string | null
        description?: string | null
    } | null
    issuedByUser?: {
        name?: string | null
    } | null
}

function formatWarehouseLabel(warehouse?: { sloc?: string | null; description?: string | null } | null) {
    if (!warehouse) {
        return "Tanpa Warehouse"
    }

    return [warehouse.sloc, warehouse.description].filter(Boolean).join(" - ") || "Tanpa Warehouse"
}

function normalizePosValue(pos?: string | null) {
    return pos?.trim() || ""
}

function getPosSortMeta(pos?: string | null) {
    const normalized = normalizePosValue(pos).toUpperCase()
    const numericMatch = normalized.match(/\d+/)

    return {
        numeric: numericMatch ? Number.parseInt(numericMatch[0], 10) : Number.MAX_SAFE_INTEGER,
        text: normalized || "ZZZ",
    }
}

function summarizeVoucherPos(voucher: VoucherRow) {
    const values = Array.from(new Set(
        voucher.items
            .map((item) => normalizePosValue(item.pos))
            .filter(Boolean)
    )).sort((left, right) => {
        const leftMeta = getPosSortMeta(left)
        const rightMeta = getPosSortMeta(right)

        if (leftMeta.numeric !== rightMeta.numeric) {
            return leftMeta.numeric - rightMeta.numeric
        }

        return leftMeta.text.localeCompare(rightMeta.text)
    })

    if (values.length === 0) {
        return "-"
    }

    const visibleValues = values.slice(0, 3)
    return values.length > 3 ? `${visibleValues.join(", ")} +${values.length - 3}` : visibleValues.join(", ")
}

function StatusBadge({ status }: { status: string }) {
    if (status === "draft") {
        return (
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200">
                Draft
            </Badge>
        )
    }
    if (status === "cancelled") {
        return (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border border-red-200">
                Cancelled
            </Badge>
        )
    }
    return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
            {status}
        </Badge>
    )
}

export function EvhsVoucherTable({
    vouchers,
    products,
    warehouses,
}: {
    vouchers: VoucherRow[],
    products: ProductOption[],
    warehouses: WarehouseOption[]
}) {
    const [searchTerm, setSearchTerm] = useState("")
    const [warehouseFilter, setWarehouseFilter] = useState("all")
    const [selectedVoucher, setSelectedVoucher] = useState<VoucherRow | null>(null)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [addManualOpen, setAddManualOpen] = useState(false)
    const [fillDraftOpen, setFillDraftOpen] = useState(false)
    const [selectedVoucherIds, setSelectedVoucherIds] = useState<number[]>([])
    const router = useRouter()

    useEffect(() => {
        const validIds = new Set(vouchers.map((voucher) => voucher.id))
        setSelectedVoucherIds((current) => current.filter((id) => validIds.has(id)))
    }, [vouchers])

    // Cek apakah ada warehouse VHS CK yang tersedia untuk tombol Add Manual
    const hasVhsWarehouse = warehouses.some((w) => {
        const type = (w.type || "").trim().toUpperCase()
        const label = `${(w.sloc || "")} ${(w.description || "")}`.toUpperCase()
        return type === "WAREHOUSE VHS" && label.includes("CK")
    })

    const warehouseOptions = useMemo(() => {
        const map = new Map<string, { value: string; label: string }>()
        for (const voucher of vouchers) {
            const value = String(voucher.warehouseId)
            if (!map.has(value)) {
                map.set(value, {
                    value,
                    label: formatWarehouseLabel(voucher.warehouse),
                })
            }
        }
        return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label))
    }, [vouchers])

    const filteredVouchers = useMemo(() => vouchers.filter((voucher) => {
        const matchesSearch =
            voucher.vhsNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            voucher.woNo?.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesWarehouse = warehouseFilter === "all" || String(voucher.warehouseId) === warehouseFilter

        return matchesSearch && matchesWarehouse
    }), [searchTerm, vouchers, warehouseFilter])

    const summaryCards = useMemo(() => {
        const totalAmount = filteredVouchers.reduce((sum, voucher) => sum + Number(voucher.totalAmount || 0), 0)
        return [
            {
                title: "Total Voucher",
                value: filteredVouchers.length.toLocaleString("id-ID"),
                helper: "Semua voucher hasil filter",
            },
            {
                title: "Draft",
                value: filteredVouchers.filter((voucher) => voucher.status === "draft").length.toLocaleString("id-ID"),
                helper: "Butuh isi detail / SN",
            },
            {
                title: "Completed",
                value: filteredVouchers.filter((voucher) => voucher.status === "completed").length.toLocaleString("id-ID"),
                helper: "Voucher selesai",
            },
            {
                title: "Nilai Voucher",
                value: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(totalAmount),
                helper: "Total amount hasil filter",
            },
        ]
    }, [filteredVouchers])

    const filteredVoucherIds = useMemo(
        () => filteredVouchers.map((voucher) => voucher.id),
        [filteredVouchers]
    )

    const selectedFilteredVouchers = useMemo(
        () => filteredVouchers.filter((voucher) => selectedVoucherIds.includes(voucher.id)),
        [filteredVouchers, selectedVoucherIds]
    )

    const selectedFilteredCount = selectedFilteredVouchers.length
    const isAllFilteredSelected = filteredVouchers.length > 0 && selectedFilteredCount === filteredVouchers.length
    const isSomeFilteredSelected = selectedFilteredCount > 0 && selectedFilteredCount < filteredVouchers.length

    const toggleVoucherSelection = (voucherId: number, checked: boolean) => {
        setSelectedVoucherIds((current) => (
            checked
                ? Array.from(new Set([...current, voucherId]))
                : current.filter((id) => id !== voucherId)
        ))
    }

    const toggleAllFilteredSelection = (checked: boolean) => {
        if (!checked) {
            setSelectedVoucherIds((current) => current.filter((id) => !filteredVoucherIds.includes(id)))
            return
        }

        setSelectedVoucherIds((current) => Array.from(new Set([...current, ...filteredVoucherIds])))
    }

    const handleDelete = async () => {
        if (!selectedVoucher) return

        setIsDeleting(true)
        try {
            const result = await deleteEvhsVoucher(selectedVoucher.id)
            if (result.success) {
                toast.success("Voucher berhasil dihapus, stok kembali.")
                setDeleteOpen(false)
                router.refresh()
            } else {
                toast.error("error" in result ? result.error : "Gagal menghapus voucher.")
            }
        } catch (_error) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsDeleting(false)
        }
    }

    const handleBulkPrint = () => {
        if (selectedFilteredVouchers.length === 0) {
            toast.error("Pilih voucher yang ingin dicetak terlebih dulu.")
            return
        }

        openBulkVoucherPrint(selectedFilteredVouchers)
    }

    return (
        <div className="space-y-4">
            <EvhsVoucherPreview
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                voucher={selectedVoucher}
            />

            <EvhsEditVoucherDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                voucher={selectedVoucher}
            />

            <EvhsAddManualVoucherDialog
                open={addManualOpen}
                onOpenChange={setAddManualOpen}
                warehouses={warehouses}
                products={products as ProductOption[]}
            />

            <EvhsFillDraftDialog
                open={fillDraftOpen}
                onOpenChange={setFillDraftOpen}
                voucher={selectedVoucher as DraftVoucher | null}
            />

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Dokumen Voucher?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini akan menghapus Voucher <span className="font-bold text-slate-800">{selectedVoucher?.vhsNo}</span> secara permanen.
                            Semua Serial Number (SN) yang terikat pada voucher ini akan dikembalikan statusnya menjadi stok aktif
                            dan dapat diinput kembali di kemudian hari.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDelete(); }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? "Menghapus..." : "Ya, Hapus Voucher"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="grid gap-3 lg:grid-cols-4">
                {summaryCards.map((card) => (
                    <Card key={card.title} className="border-slate-200/80 shadow-sm">
                        <CardContent className="p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.title}</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari No VHS atau WO..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filter warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Warehouse</SelectItem>
                            {warehouseOptions.map((warehouse) => (
                                <SelectItem key={warehouse.value} value={warehouse.value}>
                                    {warehouse.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleBulkPrint}
                        disabled={selectedFilteredCount === 0}
                        className="gap-2"
                    >
                        <Printer className="h-4 w-4" />
                        Cetak PDF Bulk
                        {selectedFilteredCount > 0 ? ` (${selectedFilteredCount})` : ""}
                    </Button>

                    {hasVhsWarehouse && (
                        <Button
                            id="btn-add-manual-voucher"
                            onClick={() => setAddManualOpen(true)}
                            className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm gap-2"
                            size="sm"
                        >
                            <PackagePlus className="h-4 w-4" />
                            Tambah Voucher Manual
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <span>
                    Pilih voucher lalu cetak bulk. Urutan print otomatis mengikuti POS terkecil: `#1`, `#2`, `#3`, dst.
                </span>
                <span className="font-semibold text-slate-700">
                    {selectedFilteredCount} voucher dipilih
                </span>
            </div>

            <div className="rounded-md border bg-card overflow-x-auto">
                <Table className="min-w-[1120px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={isAllFilteredSelected ? true : isSomeFilteredSelected ? "indeterminate" : false}
                                    onCheckedChange={(checked) => toggleAllFilteredSelection(checked === true)}
                                    aria-label="Pilih semua voucher hasil filter"
                                />
                            </TableHead>
                            <TableHead>Voucher No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>WO Number</TableHead>
                            <TableHead>Pos</TableHead>
                            <TableHead>Warehouse</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredVouchers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                                    Belum ada voucher yang di-generate.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredVouchers.map((voucher) => (
                                <TableRow
                                    key={voucher.id}
                                    className={voucher.status === "draft" ? "bg-amber-50/30 dark:bg-amber-950/10" : undefined}
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedVoucherIds.includes(voucher.id)}
                                            onCheckedChange={(checked) => toggleVoucherSelection(voucher.id, checked === true)}
                                            aria-label={`Pilih voucher ${voucher.vhsNo}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-mono font-bold text-xs">{voucher.vhsNo}</TableCell>
                                    <TableCell suppressHydrationWarning>{format(new Date(voucher.date), "dd MMM yyyy")}</TableCell>
                                    <TableCell className="font-medium">{voucher.woNo || "—"}</TableCell>
                                    <TableCell className="text-xs font-medium text-slate-700">{summarizeVoucherPos(voucher)}</TableCell>
                                    <TableCell>{formatWarehouseLabel(voucher.warehouse)}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{voucher.items.length} Items</Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(voucher.totalAmount || 0))}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={voucher.status} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Buka menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Aksi</DropdownMenuLabel>

                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedVoucher(voucher)
                                                        setPreviewOpen(true)
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <FileText className="mr-2 h-4 w-4 text-blue-500" />
                                                    Preview / Print
                                                </DropdownMenuItem>

                                                {/* Menu Isi Detail — khusus voucher DRAFT */}
                                                {voucher.status === "draft" && (
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setSelectedVoucher(voucher)
                                                            setFillDraftOpen(true)
                                                        }}
                                                        className="cursor-pointer text-amber-600 focus:text-amber-700 focus:bg-amber-50"
                                                    >
                                                        <ClipboardEdit className="mr-2 h-4 w-4" />
                                                        Isi Detail / SN
                                                    </DropdownMenuItem>
                                                )}

                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setSelectedVoucher(voucher)
                                                        setEditOpen(true)
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <Edit className="mr-2 h-4 w-4 text-amber-500" />
                                                    Edit Data Voucher
                                                </DropdownMenuItem>

                                                {voucher.canDelete ? (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setSelectedVoucher(voucher)
                                                                setDeleteOpen(true)
                                                            }}
                                                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Hapus & Kembalikan Stok
                                                        </DropdownMenuItem>
                                                    </>
                                                ) : null}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
