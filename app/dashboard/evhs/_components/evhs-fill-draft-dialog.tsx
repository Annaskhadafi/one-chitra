"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, Save, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
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
import { updateEvhsDraftVoucherItems, completeEvhsDraftVoucher } from "@/app/actions/evhs"

type DraftVoucherItem = {
    id: number
    productId: number
    qty: number | string
    serialNumber?: string | null
    materialNumberCk?: string | null
    pos?: string | null
    unitId?: string | null
    product?: {
        materialNumber?: string | null
        materialDescription?: string | null
    } | null
}

export type DraftVoucher = {
    id: number
    vhsNo: string
    woNo?: string | null
    date?: string | Date | null
    remark?: string | null
    approvedByName?: string | null
    receivedByName?: string | null
    items: DraftVoucherItem[]
}

type ItemEditState = {
    itemId: number
    productId: number
    qty: number
    serialNumber: string
    pos: string
    unitId: string
    materialNumberCk: string
}

export function EvhsFillDraftDialog({
    open,
    onOpenChange,
    voucher,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    voucher: DraftVoucher | null
}) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const [isCompleting, setIsCompleting] = useState(false)
    const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false)

    // Header state
    const [woNo, setWoNo] = useState("")
    const [remark, setRemark] = useState("")
    const [approvedByName, setApprovedByName] = useState("")
    const [receivedByName, setReceivedByName] = useState("")

    // Items edit state
    const [editItems, setEditItems] = useState<ItemEditState[]>([])

    useEffect(() => {
        if (open && voucher) {
            setWoNo(voucher.woNo || "")
            setRemark(voucher.remark || "")
            setApprovedByName(voucher.approvedByName || "")
            setReceivedByName(voucher.receivedByName || "")
            setEditItems(
                voucher.items.map((item) => ({
                    itemId: item.id,
                    productId: item.productId,
                    qty: Number(item.qty) || 1,
                    serialNumber: item.serialNumber || "",
                    pos: item.pos || "",
                    unitId: item.unitId || "",
                    materialNumberCk: item.materialNumberCk || "",
                }))
            )
        }
    }, [open, voucher])

    const updateEditItem = (itemId: number, field: keyof Omit<ItemEditState, "itemId" | "productId">, value: string | number) => {
        setEditItems((prev) =>
            prev.map((item) => (item.itemId === itemId ? { ...item, [field]: value } : item))
        )
    }

    const handleSaveDraft = async () => {
        if (!voucher) return
        setIsSaving(true)
        try {
            const result = await updateEvhsDraftVoucherItems({
                voucherId: voucher.id,
                woNo: woNo || undefined,
                remark: remark || undefined,
                approvedByName: approvedByName || undefined,
                receivedByName: receivedByName || undefined,
                items: editItems.map((item) => ({
                    itemId: item.itemId,
                    serialNumber: item.serialNumber || undefined,
                    pos: item.pos || undefined,
                    unitId: item.unitId || undefined,
                    materialNumberCk: item.materialNumberCk || undefined,
                    qty: item.qty,
                })),
            })

            if (result.success) {
                toast.success("Draft voucher berhasil disimpan.")
                router.refresh()
            } else {
                toast.error("error" in result ? result.error : "Gagal menyimpan draft.")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem.")
        } finally {
            setIsSaving(false)
        }
    }

    const handleComplete = async () => {
        if (!voucher) return
        setIsCompleting(true)
        try {
            const result = await completeEvhsDraftVoucher({
                voucherId: voucher.id,
                woNo: woNo || undefined,
                remark: remark || undefined,
                approvedByName: approvedByName || undefined,
                receivedByName: receivedByName || undefined,
                items: editItems.map((item) => ({
                    itemId: item.itemId,
                    productId: item.productId,
                    qty: item.qty,
                    serialNumber: item.serialNumber || undefined,
                    pos: item.pos || undefined,
                    unitId: item.unitId || undefined,
                    materialNumberCk: item.materialNumberCk || undefined,
                })),
            })

            if (result.success) {
                toast.success("Voucher berhasil diselesaikan! Status berubah menjadi Completed.")
                setConfirmCompleteOpen(false)
                onOpenChange(false)
                router.refresh()
            } else {
                toast.error("error" in result ? result.error : "Gagal menyelesaikan voucher.")
                setConfirmCompleteOpen(false)
            }
        } catch {
            toast.error("Terjadi kesalahan sistem.")
            setConfirmCompleteOpen(false)
        } finally {
            setIsCompleting(false)
        }
    }

    if (!voucher) return null

    return (
        <>
            <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Selesaikan Voucher {voucher.vhsNo}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Voucher akan berubah status menjadi <strong>Completed</strong> dan stok akan dikurangi sesuai Qty.
                            Tindakan ini <strong>tidak dapat dibatalkan</strong> secara langsung. Pastikan semua data sudah benar.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCompleting}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleComplete() }}
                            disabled={isCompleting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isCompleting ? "Memproses..." : "Ya, Selesaikan"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            Isi Detail Voucher Draft
                        </DialogTitle>
                        <DialogDescription>
                            Voucher <span className="font-mono font-bold text-foreground">{voucher.vhsNo}</span> —
                            Isi Serial Number, POS, dan Unit ID setelah barang tiba. Klik{" "}
                            <strong>"Simpan Draft"</strong> untuk menyimpan sementara, atau{" "}
                            <strong>"Selesaikan Voucher"</strong> untuk mengubah status menjadi Completed.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">

                        {/* Header Info */}
                        <div className="flex items-center gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">DRAFT</Badge>
                            <span className="font-mono text-sm font-bold">{voucher.vhsNo}</span>
                            <span className="text-xs text-muted-foreground">
                                {voucher.date ? new Date(voucher.date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : ""}
                            </span>
                        </div>

                        {/* WO + Penerima */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fill-wo" className="text-xs">WO Number</Label>
                                <Input
                                    id="fill-wo"
                                    placeholder="Contoh: WO-CK-MHU-001"
                                    value={woNo}
                                    onChange={(e) => setWoNo(e.target.value)}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fill-remark" className="text-xs">Remark</Label>
                                <Input
                                    id="fill-remark"
                                    placeholder="Catatan..."
                                    value={remark}
                                    onChange={(e) => setRemark(e.target.value)}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fill-approved" className="text-xs">Approved By (Customer)</Label>
                                <Input
                                    id="fill-approved"
                                    placeholder="Nama..."
                                    value={approvedByName}
                                    onChange={(e) => setApprovedByName(e.target.value)}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fill-received" className="text-xs">Received By (Customer)</Label>
                                <Input
                                    id="fill-received"
                                    placeholder="Nama..."
                                    value={receivedByName}
                                    onChange={(e) => setReceivedByName(e.target.value)}
                                    className="h-8 text-sm"
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* Items Table */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Detail Item — Isi SN & Unit</Label>
                            <div className="rounded-md border overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground w-6">#</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[120px]">Material CK</th>
                                            <th className="text-center py-2 px-3 font-medium text-muted-foreground w-16">Qty</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[120px]">Serial Number (SN)</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground w-24">POS</th>
                                            <th className="text-left py-2 px-3 font-medium text-muted-foreground w-28">Unit ID</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {editItems.map((item, idx) => {
                                            const origItem = voucher.items.find((vi) => vi.id === item.itemId)
                                            return (
                                                <tr key={item.itemId} className="bg-background hover:bg-muted/20">
                                                    <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                                                    <td className="py-2 px-3">
                                                        <div className="font-mono font-bold text-blue-700 dark:text-blue-400 text-[10px]">
                                                            {item.materialNumberCk || "—"}
                                                        </div>
                                                        {origItem?.product?.materialDescription && (
                                                            <div className="text-[9px] text-muted-foreground line-clamp-1 mt-0.5">
                                                                {origItem.product.materialDescription}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            value={item.qty}
                                                            onChange={(e) => updateEditItem(item.itemId, "qty", Math.max(1, Number(e.target.value)))}
                                                            className="h-7 text-center text-xs w-full"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <Input
                                                            value={item.serialNumber}
                                                            onChange={(e) => updateEditItem(item.itemId, "serialNumber", e.target.value)}
                                                            placeholder="SN Tire..."
                                                            className="h-7 text-xs font-mono"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <Input
                                                            value={item.pos}
                                                            onChange={(e) => updateEditItem(item.itemId, "pos", e.target.value)}
                                                            placeholder="FL/FR/..."
                                                            className="h-7 text-xs"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <Input
                                                            value={item.unitId}
                                                            onChange={(e) => updateEditItem(item.itemId, "unitId", e.target.value)}
                                                            placeholder="Unit ID..."
                                                            className="h-7 text-xs"
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 flex-col sm:flex-row">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || isCompleting} className="sm:mr-auto">
                            Tutup
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleSaveDraft}
                            disabled={isSaving || isCompleting}
                            className="border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {isSaving ? "Menyimpan..." : "Simpan Draft"}
                        </Button>
                        <Button
                            onClick={() => setConfirmCompleteOpen(true)}
                            disabled={isSaving || isCompleting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Selesaikan Voucher
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
