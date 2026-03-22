"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, CheckCircle2, AlertTriangle, Loader2, X, FileText, Upload, Paperclip, Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
    updateOpnameItemCount,
    closeStockOpnameSession,
    cancelStockOpnameSession,
    updateStockOpnameDocument,
    type OpnameSourceType,
} from "@/app/actions/stock-opname"
import { uploadFile } from "@/app/actions/upload"
import type { StockOpnameSession } from "@/lib/types"
import { extractUploadFilename, resolveUploadDocumentUrl } from "@/lib/upload-url"

interface OpnameDetailViewProps {
    session: StockOpnameSession
    basePath?: string
    sourceType?: OpnameSourceType
}

export function OpnameDetailView({
    session,
    basePath = "/dashboard/stock-opname",
    sourceType = "sap",
}: OpnameDetailViewProps) {
    const router = useRouter()
    const isOpen = session.status === "open"

    const [items, setItems] = useState(session.items ?? [])
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editValue, setEditValue] = useState<string>("")
    const [editNotes, setEditNotes] = useState<string>("")
    const [search, setSearch] = useState("")
    const [filterStatus, setFilterStatus] = useState("all")
    const [saving, setSaving] = useState(false)
    const [closing, setClosing] = useState(false)
    const [applyAdjustments, setApplyAdjustments] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const orderedSignatures = useMemo(
        () => [...(session.signatures ?? [])].sort((a, b) => a.order - b.order),
        [session.signatures]
    )
    const documentUrl = resolveUploadDocumentUrl(session.documentUrl)
    const documentFileName =
        session.documentFileName?.trim() ||
        extractUploadFilename(session.documentUrl) ||
        "document"

    const formattedOpnameDate = session.opnameDate
        ? new Date(session.opnameDate).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        })
        : "-"

    async function handlePrintPdf(mode: 'checklist' | 'report' = 'report') {
        if (mode === 'report' && session.status !== "closed") {
            toast.error("Hanya sesi yang sudah ditutup yang bisa dicetak sebagai laporan")
            return
        }

        // Open PDF in new window
        window.open(`${basePath}/${session.id}/pdf?mode=${mode}`, '_blank')
    }

    async function handleUploadDocument(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        const formData = new FormData()
        formData.append("file", file)

        try {
            const uploadResult = await uploadFile(formData)
            if (uploadResult.success && uploadResult.url) {
                const saveResult = await updateStockOpnameDocument(session.id, {
                    url: uploadResult.url,
                    originalFileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    title: "Dokumen Hasil Audit Lapangan",
                })

                if (saveResult.success) {
                    toast.success("Dokumen hasil audit berhasil diunggah")
                    router.refresh()
                } else {
                    toast.error(saveResult.error || "Gagal menyimpan metadata dokumen")
                }
            } else {
                toast.error(uploadResult.error || "Gagal mengunggah file")
            }
        } catch (_error) {
            toast.error("Terjadi kesalahan saat mengunggah")
        } finally {
            setIsUploading(false)
        }
    }

    const filtered = useMemo(() => {
        return items.filter((item) => {
            const q = search.toLowerCase()
            const matchSearch =
                !q ||
                item.product?.materialNumber?.toLowerCase().includes(q) ||
                item.product?.materialDescription?.toLowerCase().includes(q)
            const matchStatus =
                filterStatus === "all" ||
                (filterStatus === "counted" && item.countedQty !== null) ||
                (filterStatus === "uncounted" && item.countedQty === null) ||
                (filterStatus === "variance" && item.variance !== null && item.variance !== 0)
            return matchSearch && matchStatus
        })
    }, [items, search, filterStatus])

    function startEdit(itemId: number, currentCountedQty: number | null, currentNotes: string | null) {
        if (!isOpen) return
        setEditingId(itemId)
        setEditValue(currentCountedQty !== null ? String(currentCountedQty) : "")
        setEditNotes(currentNotes ?? "")
    }

    async function saveEdit(itemId: number, systemQty: number) {
        const qty = parseInt(editValue)
        if (isNaN(qty) || qty < 0) {
            toast.error("Masukkan angka yang valid (≥ 0)")
            return
        }
        setSaving(true)
        const result = await updateOpnameItemCount({
            itemId,
            countedQty: qty,
            notes: editNotes,
        })
        setSaving(false)
        if (result.success) {
            setItems((prev) =>
                prev.map((i) =>
                    i.id === itemId
                        ? { ...i, countedQty: qty, variance: qty - systemQty, notes: editNotes }
                        : i
                )
            )
            setEditingId(null)
            toast.success("Hitungan disimpan")
        } else {
            toast.error(result.error ?? "Gagal")
        }
    }

    async function handleClose() {
        setClosing(true)
        const result = await closeStockOpnameSession(session.id, applyAdjustments, sourceType)
        setClosing(false)
        if (result.success) {
            toast.success("Sesi opname berhasil ditutup")
            if (result.notification && !result.notification.sent) {
                toast.warning(`Email notifikasi belum terkirim: ${result.notification.reason || "cek konfigurasi SMTP / penerima"}`)
            }
            if (result.notification?.sent) {
                toast.success(`Email notifikasi terkirim ke ${result.notification.recipientCount ?? 0} penerima`)
            }
            router.push(basePath)
            router.refresh()
        } else {
            toast.error(result.error ?? "Gagal menutup sesi")
        }
    }

    async function handleCancel() {
        const result = await cancelStockOpnameSession(session.id, sourceType)
        if (result.success) {
            toast.success("Sesi dibatalkan")
            router.push(basePath)
            router.refresh()
        } else {
            toast.error(result.error ?? "Gagal membatalkan")
        }
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-5">
            {/* Session Information */}
            <Card className="overflow-hidden">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">Detail Form Stock Opname</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-md border bg-muted/20 p-3">
                            <p className="text-[11px] text-muted-foreground">Tanggal Opname</p>
                            <p className="text-sm font-semibold mt-1">{formattedOpnameDate}</p>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-3">
                            <p className="text-[11px] text-muted-foreground">Waktu</p>
                            <p className="text-sm font-semibold mt-1">{session.opnameTime ?? "-"}</p>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-3">
                            <p className="text-[11px] text-muted-foreground">Lokasi</p>
                            <p className="text-sm font-semibold mt-1">{session.location ?? "-"}</p>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-3">
                            <p className="text-[11px] text-muted-foreground">Dibuat Oleh</p>
                            <p className="text-sm font-semibold mt-1">{session.createdBy?.name ?? "-"}</p>
                        </div>
                    </div>

                    <div className="mt-3 rounded-md border bg-muted/20 p-3">
                        <p className="text-[11px] text-muted-foreground">Peserta / Tanda Tangan</p>
                        {orderedSignatures.length === 0 ? (
                            <p className="text-sm mt-1 text-muted-foreground">Belum ada data peserta</p>
                        ) : (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {orderedSignatures.map((sig) => (
                                    <Badge key={sig.id} variant="secondary" className="text-xs font-normal">
                                        {sig.name} ({sig.position})
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="mt-3 rounded-md border bg-muted/20 p-3">
                        <p className="text-[11px] text-muted-foreground">Catatan Form</p>
                        <p className="text-sm mt-1">{session.notes?.trim() || "-"}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Toolbar */}
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="flex w-full flex-col gap-3 sm:flex-1 sm:flex-row sm:flex-wrap">
                    <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari material..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-full sm:w-44">
                            <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Item</SelectItem>
                            <SelectItem value="counted">Sudah Dihitung</SelectItem>
                            <SelectItem value="uncounted">Belum Dihitung</SelectItem>
                            <SelectItem value="variance">Ada Selisih</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
                    {/* Print Checklist Button - for open sessions */}
                    {session.status === "open" && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full sm:w-auto"
                            onClick={() => window.open(`${basePath}/${session.id}/print-checklist`, '_blank')}
                        >
                            <FileText className="h-4 w-4 mr-1" />
                            Cetak Checklist
                        </Button>
                    )}

                    {/* Print PDF Button - only show for closed sessions */}
                    {session.status === "closed" && (
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => handlePrintPdf('report')}>
                            <FileText className="h-4 w-4 mr-1" />
                            Cetak PDF
                        </Button>
                    )}

                    {isOpen && (
                        <>
                            {/* Cancel Dialog */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-full text-red-600 sm:w-auto">
                                        <X className="h-4 w-4 mr-1" /> Batalkan
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Batalkan sesi ini?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Sesi akan dibatalkan dan tidak dapat dilanjutkan. Tidak ada perubahan stok yang akan terjadi.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Kembali</AlertDialogCancel>
                                        <AlertDialogAction
                                            className="bg-red-600 hover:bg-red-700"
                                            onClick={handleCancel}
                                        >
                                            Ya, Batalkan
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* Close Session Dialog */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" className="w-full sm:w-auto">
                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                        Tutup & Selesaikan
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Tutup sesi opname?</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="space-y-3">
                                                <p>
                                                    Setelah ditutup, sesi tidak bisa diedit lagi.
                                                    Item yang belum dihitung akan diabaikan.
                                                </p>
                                                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                                                    <Checkbox
                                                        id="adjust"
                                                        checked={applyAdjustments}
                                                        onCheckedChange={(v) => setApplyAdjustments(!!v)}
                                                    />
                                                    <label htmlFor="adjust" className="text-sm cursor-pointer">
                                                        <strong>Terapkan adjustment stok</strong> — update stok lokal sesuai hitungan fisik & catat movement ADJUSTMENT
                                                    </label>
                                                </div>
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClose} disabled={closing}>
                                            {closing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Tutup Sesi
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                </div>
            </div>

            {/* Status banner if closed/cancelled */}
            {!isOpen && (
                <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${session.status === "closed"
                    ? "bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                    : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                    }`}>
                    {session.status === "closed" ? (
                        <CheckCircle2 className="h-4 w-4 flex-none" />
                    ) : (
                        <X className="h-4 w-4 flex-none" />
                    )}
                    Sesi ini sudah <strong>{session.status === "closed" ? "ditutup" : "dibatalkan"}</strong>. Data bersifat read-only.
                </div>
            )}

            {/* Document Upload Section */}
            <Card className="mt-2">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Dokumen Hasil Audit Lapangan (Sudah TTD)
                    </CardTitle>
                </CardHeader>
                <CardContent className="py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {documentUrl ? (
                            <div className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-green-700 sm:flex-1 sm:flex-row sm:items-center sm:gap-2">
                                <Paperclip className="h-4 w-4" />
                                <span className="min-w-0 flex-1 truncate text-xs">{documentFileName}</span>
                                <Button variant="ghost" size="sm" className="h-8 px-3 text-green-700 hover:bg-green-100 hover:text-green-800" asChild>
                                    <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="h-3 w-3 mr-1" />
                                        Lihat
                                    </a>
                                </Button>
                                <div className="relative">
                                    <input
                                        type="file"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleUploadDocument}
                                        disabled={isUploading}
                                        accept=".pdf,image/*"
                                    />
                                    <Button variant="outline" size="sm" className="h-8 px-3" disabled={isUploading}>
                                        Ganti
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 rounded-xl border-2 border-dashed border-gray-200 p-4 text-center">
                                <p className="text-xs text-gray-500 mb-2">Belum ada dokumen yang diunggah</p>
                                <div className="relative inline-block">
                                    <input
                                        type="file"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleUploadDocument}
                                        disabled={isUploading}
                                        accept=".pdf,image/*"
                                    />
                                    <Button variant="outline" size="sm" disabled={isUploading}>
                                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                                        Unggah Hasil Audit
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                        Format yang didukung: PDF, Gambar. Maksimal 5MB.
                    </p>
                </CardContent>
            </Card>

            {/* Items Mobile */}
            <div className="space-y-3 md:hidden">
                {filtered.length === 0 ? (
                    <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                        Tidak ada item.
                    </div>
                ) : (
                    filtered.map((item, i) => {
                        const isEditing = editingId === item.id
                        const hasVariance = item.variance !== null && item.variance !== 0
                        const isCounted = item.countedQty !== null

                        return (
                            <Card key={item.id} className={hasVariance ? "border-amber-200 bg-amber-50/30" : ""}>
                                <CardContent className="space-y-3 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[11px] text-muted-foreground">#{i + 1} · {item.product?.category ?? "-"}</p>
                                            <p className="font-semibold">{item.product?.materialNumber ?? "-"}</p>
                                            <p className="text-sm text-muted-foreground break-words">{item.product?.materialDescription ?? "-"}</p>
                                        </div>
                                        {!isCounted ? (
                                            <span className="text-xs text-muted-foreground">Belum</span>
                                        ) : hasVariance ? (
                                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 text-xs">
                                                <AlertTriangle className="h-3 w-3" />
                                                Selisih
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 text-xs">
                                                <CheckCircle2 className="h-3 w-3" />
                                                OK
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/30 p-3">
                                        <div>
                                            <p className="text-[11px] text-muted-foreground">{sourceType === "actual" ? "Qty Aktual Sistem" : "Qty SAP"}</p>
                                            <p className="mt-1 font-semibold">{item.systemQty}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] text-muted-foreground">Selisih</p>
                                            <p className={`mt-1 font-semibold ${
                                                item.variance == null
                                                    ? "text-muted-foreground"
                                                    : item.variance > 0
                                                        ? "text-emerald-600"
                                                        : item.variance < 0
                                                            ? "text-red-600"
                                                            : "text-foreground"
                                            }`}>
                                                {item.variance !== null ? `${item.variance > 0 ? "+" : ""}${item.variance}` : "—"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[11px] text-muted-foreground">Qty Fisik</p>
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="h-10"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") saveEdit(item.id, item.systemQty)
                                                        if (e.key === "Escape") setEditingId(null)
                                                    }}
                                                />
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-10 w-10 shrink-0"
                                                    disabled={saving}
                                                    onClick={() => saveEdit(item.id, item.systemQty)}
                                                >
                                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full justify-between"
                                                onClick={() => isOpen && startEdit(item.id, item.countedQty, item.notes)}
                                                disabled={!isOpen}
                                            >
                                                <span>{isCounted ? item.countedQty : "Belum diinput"}</span>
                                                {isOpen ? <span className="text-xs text-muted-foreground">Tap untuk edit</span> : null}
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[11px] text-muted-foreground">Catatan</p>
                                        {isEditing ? (
                                            <Input
                                                placeholder="catatan..."
                                                value={editNotes}
                                                onChange={(e) => setEditNotes(e.target.value)}
                                                className="h-10 text-sm"
                                            />
                                        ) : (
                                            <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                                                {item.notes?.trim() || "-"}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>

            {/* Table */}
            <div className="hidden overflow-hidden rounded-xl border md:block">
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/40">
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Material No.</TableHead>
                            <TableHead>Deskripsi</TableHead>
                            <TableHead>Kategori</TableHead>
                            <TableHead className="text-right">{sourceType === "actual" ? "Qty Aktual Sistem" : "Qty SAP"}</TableHead>
                            <TableHead className="text-right">Qty Fisik</TableHead>
                            <TableHead className="text-right">Selisih</TableHead>
                            <TableHead>Catatan</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                    Tidak ada item.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((item, i) => {
                                const isEditing = editingId === item.id
                                const hasVariance = item.variance !== null && item.variance !== 0
                                const isCounted = item.countedQty !== null

                                return (
                                    <TableRow
                                        key={item.id}
                                        className={hasVariance ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}
                                    >
                                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                                        <TableCell className="font-mono text-sm font-medium">
                                            {item.product?.materialNumber ?? "-"}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[180px] truncate" title={item.product?.materialDescription ?? ""}>
                                            {item.product?.materialDescription ?? "-"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs">
                                                {item.product?.category ?? "-"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{item.systemQty}</TableCell>
                                        <TableCell className="text-right">
                                            {isEditing ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="w-20 h-7 text-right text-sm"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") saveEdit(item.id, item.systemQty)
                                                            if (e.key === "Escape") setEditingId(null)
                                                        }}
                                                    />
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7"
                                                        disabled={saving}
                                                        onClick={() => saveEdit(item.id, item.systemQty)}
                                                    >
                                                        {saving ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <button
                                                    className={`text-right w-full font-medium ${!isOpen
                                                        ? "cursor-default"
                                                        : "hover:text-blue-600 hover:underline cursor-pointer"
                                                        } ${!isCounted ? "text-muted-foreground italic" : ""}`}
                                                    onClick={() => isOpen && startEdit(item.id, item.countedQty, item.notes)}
                                                    title={isOpen ? "Klik untuk edit" : undefined}
                                                >
                                                    {isCounted ? item.countedQty : "—"}
                                                </button>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {item.variance !== null ? (
                                                <span className={
                                                    item.variance > 0
                                                        ? "text-emerald-600 font-semibold"
                                                        : item.variance < 0
                                                            ? "text-red-600 font-semibold"
                                                            : "text-muted-foreground"
                                                }>
                                                    {item.variance > 0 ? "+" : ""}{item.variance}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                                            {isEditing ? (
                                                <Input
                                                    placeholder="catatan..."
                                                    value={editNotes}
                                                    onChange={(e) => setEditNotes(e.target.value)}
                                                    className="h-7 text-xs"
                                                />
                                            ) : (
                                                item.notes ?? ""
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {!isCounted ? (
                                                <span className="text-muted-foreground text-xs">Belum</span>
                                            ) : hasVariance ? (
                                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 gap-1 text-xs">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Selisih
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 gap-1 text-xs">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    OK
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
            <p className="text-xs text-muted-foreground">
                Menampilkan {filtered.length} dari {items.length} item ·{" "}
                {isOpen && "Klik angka di kolom Qty Fisik untuk menginput hitungan"}
            </p>
        </div>
    )
}
