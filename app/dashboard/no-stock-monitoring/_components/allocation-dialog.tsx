"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ExternalLink, Plus, Save, Trash2, X } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteNoStockMonitoringAllocation, saveNoStockMonitoringAllocation } from "@/app/actions/no-stock-monitoring"
import type { getNoStockMonitoringData } from "@/app/actions/no-stock-monitoring"
import { calculatePoAgingDays, getPoAgingUrgency } from "@/lib/no-stock-monitoring"

type MonitoringData = Awaited<ReturnType<typeof getNoStockMonitoringData>>["data"]
type MonitoringItem = MonitoringData[number]
type Allocation = MonitoringItem["allocations"][number]

const statusClass: Record<string, string> = {
    "Belum Diisi": "border-slate-300 bg-slate-50 text-slate-700",
    "PR Terhubung": "border-indigo-300 bg-indigo-50 text-indigo-700",
    "PO Terbit": "border-amber-300 bg-amber-50 text-amber-700",
    "GR Parsial": "border-orange-300 bg-orange-50 text-orange-700",
    "GR Selesai": "border-emerald-300 bg-emerald-50 text-emerald-700",
    "Konflik": "border-red-300 bg-red-50 text-red-700",
}

function statusBadge(status: string) {
    return <Badge variant="outline" className={statusClass[status] ?? ""}>{status}</Badge>
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

function formatDate(date: Date | string | null | undefined) {
    if (!date) return "-"
    const d = new Date(date)
    if (isNaN(d.getTime())) return "-"
    const day = String(d.getDate()).padStart(2, "0")
    const month = MONTH_NAMES[d.getMonth()] ?? ""
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value)
}

interface AllocationDialogProps {
    item: MonitoringItem | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AllocationDialog({ item, open, onOpenChange }: AllocationDialogProps) {
    const router = useRouter()
    const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null)
    const [isCreatingNew, setIsCreatingNew] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Form states
    const [eprPrNumber, setEprPrNumber] = useState("")
    const [vendorPoNumber, setVendorPoNumber] = useState("")
    const [vendorPoItem, setVendorPoItem] = useState("")
    const [allocatedQty, setAllocatedQty] = useState("")

    if (!item) return null

    const resetForm = () => {
        setEditingAllocation(null)
        setIsCreatingNew(false)
        setEprPrNumber("")
        setVendorPoNumber("")
        setVendorPoItem("")
        setAllocatedQty("")
    }

    const startEdit = (alloc: Allocation) => {
        setEditingAllocation(alloc)
        setIsCreatingNew(false)
        setEprPrNumber(alloc.eprPrNumber || "")
        setVendorPoNumber(alloc.vendorPoNumber || "")
        setVendorPoItem(alloc.vendorPoItem ? String(alloc.vendorPoItem) : "")
        setAllocatedQty(String(alloc.allocatedQty || 0))
    }

    const startAddNew = () => {
        setEditingAllocation(null)
        setIsCreatingNew(true)
        setEprPrNumber("")
        setVendorPoNumber("")
        setVendorPoItem("")
        const alreadyAllocated = item.allocations.reduce((sum, a) => sum + a.allocatedQty, 0)
        const remainingNeeded = Math.max(0, item.outstandingQty - alreadyAllocated)
        setAllocatedQty(remainingNeeded > 0 ? String(remainingNeeded) : "0")
    }

    const handleSave = () => {
        if (!item) return
        startTransition(async () => {
            const result = await saveNoStockMonitoringAllocation({
                id: editingAllocation?.id,
                salesOrderItemId: item.itemId,
                eprPrNumber,
                vendorPoNumber,
                vendorPoItem: vendorPoItem ? Number(vendorPoItem) : null,
                allocatedQty: Number(allocatedQty) || 0,
            })

            if (!result.success) {
                toast.error(result.error)
                return
            }

            toast.success("Alokasi procurement berhasil disimpan")
            resetForm()
            router.refresh()
        })
    }

    const handleDelete = (allocId: number) => {
        startTransition(async () => {
            await deleteNoStockMonitoringAllocation(allocId)
            toast.success("Alokasi berhasil dihapus")
            if (editingAllocation?.id === allocId) {
                resetForm()
            }
            router.refresh()
        })
    }

    const totalAllocated = item.allocations.reduce((sum, a) => sum + a.allocatedQty, 0)
    const isShowingForm = isCreatingNew || editingAllocation !== null

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) resetForm()
            onOpenChange(val)
        }}>
            <DialogContent className="max-w-3xl sm:max-w-3xl">
                <DialogHeader>
                    <div className="flex items-center justify-between pr-6">
                        <DialogTitle className="text-lg font-bold">
                            Kelola Alokasi Procurement
                        </DialogTitle>
                        {statusBadge(item.status)}
                    </div>
                    <DialogDescription className="text-xs text-slate-500">
                        Alokasikan nomor PR/PE EPR, PO Vendor, dan Qty pengadaan untuk Sales Order ini.
                    </DialogDescription>
                </DialogHeader>

                {/* Ringkasan SO & Barang */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                        <div>
                            <span className="text-slate-400">Sales Order:</span>
                            <p className="font-semibold text-slate-800">{item.invoiceNumber || `SO-${item.orderId}`}</p>
                        </div>
                        <div>
                            <span className="text-slate-400">PO Customer:</span>
                            <p className="font-semibold text-slate-800">{item.customerPo || "-"}</p>
                        </div>
                        <div>
                            <span className="text-slate-400">PO Date:</span>
                            <p className="font-semibold text-slate-800 font-mono" suppressHydrationWarning>
                                {formatDate(item.poReceive || item.salesDate)}
                            </p>
                        </div>
                        <div>
                            <span className="text-slate-400">PO Aging:</span>
                            <div className="mt-0.5">
                                <Badge
                                    variant="outline"
                                    suppressHydrationWarning
                                    className={`text-xs px-2 py-0.5 font-bold ${
                                        getPoAgingUrgency(calculatePoAgingDays(item.poReceive, item.salesDate)) === "urgent"
                                            ? "bg-rose-50 text-rose-700 border-rose-300"
                                            : getPoAgingUrgency(calculatePoAgingDays(item.poReceive, item.salesDate)) === "warning"
                                            ? "bg-amber-50 text-amber-700 border-amber-300"
                                            : "bg-emerald-50 text-emerald-700 border-emerald-300"
                                    }`}
                                >
                                    {calculatePoAgingDays(item.poReceive, item.salesDate)} Hari
                                </Badge>
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-400">Customer:</span>
                            <p className="font-semibold text-slate-800 truncate">{item.customerName}</p>
                        </div>
                        <div>
                            <span className="text-slate-400">Sales Person:</span>
                            <p className="font-semibold text-slate-800 truncate">{item.salesPersonName}</p>
                        </div>
                    </div>

                    <div className="mt-2.5 border-t border-slate-200 pt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="col-span-2">
                            <span className="text-slate-400">Barang:</span>
                            <p className="font-mono font-semibold text-slate-900">{item.materialNumber}</p>
                            <p className="text-slate-600 truncate">{item.materialDescription}</p>
                        </div>
                        <div>
                            <span className="text-slate-400">Kebutuhan SO:</span>
                            <p className="font-bold text-slate-900">{formatNumber(item.outstandingQty)}</p>
                        </div>
                        <div>
                            <span className="text-slate-400">Stok Gudang:</span>
                            <p className="font-bold text-slate-900">{formatNumber(item.availableStock)}</p>
                        </div>
                    </div>
                </div>

                {/* Form Tambah / Edit Alokasi */}
                {isShowingForm ? (
                    <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/30 p-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-indigo-900">
                                {editingAllocation ? "Edit Alokasi PO" : "Tambah Alokasi PO Baru"}
                            </h4>
                            <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="h-6 w-6 p-0">
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                            <div>
                                <Label className="text-[11px]">No. PR / PE (EPR)</Label>
                                <Input
                                    placeholder="Contoh: 1002341"
                                    value={eprPrNumber}
                                    onChange={(e) => setEprPrNumber(e.target.value)}
                                    className="h-8 text-xs mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-[11px]">No. PO Vendor</Label>
                                <Input
                                    placeholder="Contoh: 45000123"
                                    value={vendorPoNumber}
                                    onChange={(e) => setVendorPoNumber(e.target.value)}
                                    className="h-8 text-xs mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-[11px]">PO Item</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    placeholder="Contoh: 10"
                                    value={vendorPoItem}
                                    onChange={(e) => setVendorPoItem(e.target.value)}
                                    className="h-8 text-xs mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-[11px]">Qty Alokasi</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    placeholder="Qty"
                                    value={allocatedQty}
                                    onChange={(e) => setAllocatedQty(e.target.value)}
                                    className="h-8 text-xs mt-1 font-semibold"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <Button type="button" variant="outline" size="sm" onClick={resetForm} disabled={isPending}>
                                Batal
                            </Button>
                            <Button type="button" size="sm" onClick={handleSave} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700">
                                <Save className="mr-1.5 h-3.5 w-3.5" />
                                Simpan Alokasi
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-700">
                            Daftar Alokasi ({item.allocations.length})
                        </span>
                        <Button type="button" size="sm" variant="outline" onClick={startAddNew}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Tambah Alokasi PO
                        </Button>
                    </div>
                )}

                {/* Tabel Alokasi Terpasang */}
                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-100 text-slate-600">
                            <tr className="border-b text-left">
                                <th className="p-2.5">No. PR / PE</th>
                                <th className="p-2.5">No. PO Vendor</th>
                                <th className="p-2.5">PO Item</th>
                                <th className="p-2.5 text-right">Qty Alokasi</th>
                                <th className="p-2.5">Status Alokasi</th>
                                <th className="p-2.5">Penerimaan GR</th>
                                <th className="p-2.5 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {item.allocations.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-4 text-center text-slate-400">
                                        Belum ada alokasi PO Vendor untuk item ini.
                                    </td>
                                </tr>
                            ) : (
                                item.allocations.map((alloc) => {
                                    const prSearch = alloc.eprPrNumber || alloc.effectivePoNumber
                                    return (
                                        <tr key={alloc.id} className="hover:bg-slate-50/50">
                                            <td className="p-2.5 font-medium">
                                                {alloc.eprPrNumber ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{alloc.eprPrNumber}</span>
                                                        {prSearch && (
                                                            <Link
                                                                href={`/dashboard/epr-integrasi?search=${encodeURIComponent(prSearch)}`}
                                                                target="_blank"
                                                                className="text-indigo-600 hover:text-indigo-800"
                                                                title="Buka di EPR Integrasi"
                                                            >
                                                                <ExternalLink className="h-3 w-3" />
                                                            </Link>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="p-2.5 font-mono">
                                                {alloc.vendorPoNumber || alloc.eprVendorPoNumber || <span className="text-slate-400">-</span>}
                                            </td>
                                            <td className="p-2.5">
                                                {alloc.vendorPoItem ?? <span className="text-slate-400">-</span>}
                                            </td>
                                            <td className="p-2.5 text-right font-bold text-slate-800">
                                                {formatNumber(alloc.allocatedQty)}
                                            </td>
                                            <td className="p-2.5">
                                                {statusBadge(alloc.status)}
                                            </td>
                                            <td className="p-2.5 text-slate-500">
                                                GR: {formatNumber(alloc.receivedQty)} / {formatNumber(alloc.poQty)}
                                            </td>
                                            <td className="p-2.5 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 text-xs text-indigo-600"
                                                        onClick={() => startEdit(alloc)}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-red-600 hover:bg-red-50"
                                                        onClick={() => handleDelete(alloc.id)}
                                                        disabled={isPending}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 font-semibold text-slate-700">
                            <tr>
                                <td colSpan={3} className="p-2.5 text-right">Total Teralokasi:</td>
                                <td className="p-2.5 text-right text-indigo-600 font-bold">{formatNumber(totalAllocated)}</td>
                                <td colSpan={3} className="p-2.5 text-slate-500">
                                    {totalAllocated >= item.outstandingQty
                                        ? "✓ Kebutuhan terpenuhi penuh"
                                        : `Kurang ${formatNumber(item.outstandingQty - totalAllocated)} pcs`}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </DialogContent>
        </Dialog>
    )
}
