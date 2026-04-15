"use client"

import { useEffect, useMemo, useState } from "react"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
import {
    completeEvhsDraftVoucher,
    getEvhsDraftVoucherSerialCatalog,
    updateEvhsDraftVoucherItems,
} from "@/app/actions/evhs"

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
        category?: string | null
    } | null
}

export type DraftVoucher = {
    id: number
    vhsNo: string
    warehouseId: number
    warehouse?: {
        sloc?: string | null
        description?: string | null
    } | null
    woNo?: string | null
    date?: string | Date | null
    remark?: string | null
    approvedByName?: string | null
    receivedByName?: string | null
    items: DraftVoucherItem[]
}

type ItemEditState = {
    rowKey: string
    sourceItemId: number
    productId: number
    qty: number
    serialNumber: string
    pos: string
    unitId: string
    materialNumberCk: string
    requiresSerial: boolean
}

type SerialCatalogEntry = {
    productId: number
    requiresSerial: boolean
    availableSerials: string[]
}

function toPositiveQty(value: number | string) {
    const parsedValue = typeof value === "number" ? value : Number(value)
    return Math.max(1, Number.isFinite(parsedValue) ? Math.trunc(parsedValue) : 1)
}

function normalizeSerialNumber(value?: string | null) {
    return value?.trim() || ""
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
    const [serialCatalogByProduct, setSerialCatalogByProduct] = useState<Record<number, SerialCatalogEntry>>({})
    const [isLoadingSerialCatalog, setIsLoadingSerialCatalog] = useState(false)
    const [serialCatalogError, setSerialCatalogError] = useState<string | null>(null)

    useEffect(() => {
        let isActive = true

        const hydrateDraftItems = async () => {
            if (!open || !voucher) {
                return
            }

            setWoNo(voucher.woNo || "")
            setRemark(voucher.remark || "")
            setApprovedByName(voucher.approvedByName || "")
            setReceivedByName(voucher.receivedByName || "")
            setIsLoadingSerialCatalog(true)
            setSerialCatalogError(null)

            try {
                const catalogResult = await getEvhsDraftVoucherSerialCatalog(voucher.id)
                if (!isActive) {
                    return
                }

                const catalogEntries: SerialCatalogEntry[] = catalogResult.success ? (catalogResult.data ?? []) : []
                const catalogMap = Object.fromEntries(
                    catalogEntries.map((entry) => [entry.productId, entry])
                ) as Record<number, SerialCatalogEntry>

                if (!catalogResult.success) {
                    setSerialCatalogError(catalogResult.error || "Gagal memuat daftar serial number.")
                }

                setSerialCatalogByProduct(catalogMap)
                setEditItems(
                    voucher.items.flatMap((item) => {
                        const qty = toPositiveQty(item.qty)
                        const catalog = catalogMap[item.productId]
                        const requiresSerial = catalog?.requiresSerial || item.product?.category?.trim().toUpperCase() === "TYRE"

                        if (requiresSerial && qty > 1) {
                            return Array.from({ length: qty }, (_, rowIndex) => ({
                                rowKey: `${item.id}-${rowIndex}`,
                                sourceItemId: item.id,
                                productId: item.productId,
                                qty: 1,
                                serialNumber: rowIndex === 0 ? item.serialNumber || "" : "",
                                pos: item.pos || "",
                                unitId: item.unitId || "",
                                materialNumberCk: item.materialNumberCk || "",
                                requiresSerial: true,
                            }))
                        }

                        return [{
                            rowKey: `${item.id}-0`,
                            sourceItemId: item.id,
                            productId: item.productId,
                            qty: requiresSerial ? 1 : qty,
                            serialNumber: item.serialNumber || "",
                            pos: item.pos || "",
                            unitId: item.unitId || "",
                            materialNumberCk: item.materialNumberCk || "",
                            requiresSerial,
                        }]
                    })
                )
            } catch (error) {
                if (!isActive) {
                    return
                }
                setSerialCatalogError(error instanceof Error ? error.message : "Gagal memuat daftar serial number.")
                setSerialCatalogByProduct({})
            } finally {
                if (isActive) {
                    setIsLoadingSerialCatalog(false)
                }
            }
        }

        void hydrateDraftItems()

        return () => {
            isActive = false
        }
    }, [open, voucher])

    const updateEditItem = (rowKey: string, field: keyof Omit<ItemEditState, "rowKey" | "sourceItemId" | "productId" | "requiresSerial">, value: string | number) => {
        setEditItems((prev) =>
            prev.map((item) => (item.rowKey === rowKey ? { ...item, [field]: value } : item))
        )
    }

    const availableSerialsByRowKey = useMemo(() => {
        const result: Record<string, string[]> = {}

        for (const item of editItems) {
            const baseSerials = serialCatalogByProduct[item.productId]?.availableSerials || []
            const usedByOtherRows = new Set(
                editItems
                    .filter((candidate) => candidate.rowKey !== item.rowKey && candidate.productId === item.productId)
                    .map((candidate) => normalizeSerialNumber(candidate.serialNumber))
                    .filter(Boolean)
            )

            result[item.rowKey] = baseSerials.filter((serialNumber) => (
                normalizeSerialNumber(item.serialNumber) === serialNumber || !usedByOtherRows.has(serialNumber)
            ))
        }

        return result
    }, [editItems, serialCatalogByProduct])

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
                    productId: item.productId,
                    serialNumber: item.serialNumber || undefined,
                    pos: item.pos || undefined,
                    unitId: item.unitId || undefined,
                    materialNumberCk: item.materialNumberCk || undefined,
                    qty: item.requiresSerial ? 1 : toPositiveQty(item.qty),
                })),
            })

            if (result.success) {
                toast.success("Draft voucher berhasil disimpan.")
                onOpenChange(false)
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

        const missingSerialItem = editItems.find((item) => item.requiresSerial && !normalizeSerialNumber(item.serialNumber))
        if (missingSerialItem) {
            toast.error(`Pilih Serial Number dulu untuk material ${missingSerialItem.materialNumberCk || missingSerialItem.productId}.`)
            return
        }

        setIsCompleting(true)
        try {
            const result = await completeEvhsDraftVoucher({
                voucherId: voucher.id,
                woNo: woNo || undefined,
                remark: remark || undefined,
                approvedByName: approvedByName || undefined,
                receivedByName: receivedByName || undefined,
                items: editItems.map((item) => ({
                    productId: item.productId,
                    qty: item.requiresSerial ? 1 : toPositiveQty(item.qty),
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
                            Isi Serial Number, POS, dan Unit ID setelah barang tiba. Item berserial akan otomatis dipecah sesuai qty draft dan SN diambil dari receipt warehouse VHS terkait. Klik{" "}
                            <strong>&quot;Simpan Draft&quot;</strong> untuk menyimpan sementara, atau{" "}
                            <strong>&quot;Selesaikan Voucher&quot;</strong> untuk mengubah status menjadi Completed.
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
                                <Label className="text-xs">Warehouse VHS</Label>
                                <Input
                                    value={[voucher.warehouse?.sloc, voucher.warehouse?.description].filter(Boolean).join(" - ") || `Warehouse #${voucher.warehouseId}`}
                                    readOnly
                                    className="h-8 bg-muted/40 text-sm"
                                />
                            </div>
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
                            {isLoadingSerialCatalog ? (
                                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                    Memuat daftar serial number dari receipt warehouse VHS...
                                </div>
                            ) : null}
                            {serialCatalogError ? (
                                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                    Gagal memuat daftar SN: {serialCatalogError}
                                </div>
                            ) : null}
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
                                            const origItem = voucher.items.find((vi) => vi.id === item.sourceItemId)
                                            const serialOptions = availableSerialsByRowKey[item.rowKey] || []
                                            return (
                                                <tr key={item.rowKey} className="bg-background hover:bg-muted/20">
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
                                                        {item.requiresSerial ? (
                                                            <div className="flex h-7 items-center justify-center rounded-md border bg-muted/30 text-xs font-semibold">
                                                                1
                                                            </div>
                                                        ) : (
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                step={1}
                                                                inputMode="numeric"
                                                                value={item.qty}
                                                                onChange={(e) => updateEditItem(item.rowKey, "qty", toPositiveQty(e.target.value))}
                                                                className="h-7 text-center text-xs w-full"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        {item.requiresSerial ? (
                                                            <div className="space-y-1">
                                                                <Select
                                                                    value={item.serialNumber || undefined}
                                                                    onValueChange={(value) => updateEditItem(item.rowKey, "serialNumber", value)}
                                                                >
                                                                    <SelectTrigger className="h-7 w-full text-xs font-mono">
                                                                        <SelectValue placeholder={serialOptions.length > 0 ? "Pilih SN dari receipt..." : "SN belum tersedia"} />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {serialOptions.length > 0 ? serialOptions.map((serialNumber) => (
                                                                            <SelectItem key={serialNumber} value={serialNumber}>
                                                                                {serialNumber}
                                                                            </SelectItem>
                                                                        )) : (
                                                                            <SelectItem value="__no-serial__" disabled>
                                                                                SN tidak tersedia di warehouse ini
                                                                            </SelectItem>
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {serialOptions.length} SN tersedia
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <div className="flex h-7 items-center rounded-md border bg-muted/30 px-2 text-[11px] text-muted-foreground">
                                                                Tidak perlu SN
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <Input
                                                            value={item.pos}
                                                            onChange={(e) => updateEditItem(item.rowKey, "pos", e.target.value)}
                                                            placeholder="FL/FR/..."
                                                            className="h-7 text-xs"
                                                        />
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <Input
                                                            value={item.unitId}
                                                            onChange={(e) => updateEditItem(item.rowKey, "unitId", e.target.value)}
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
