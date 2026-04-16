"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
    Loader2,
    ScanText,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    Upload,
    PencilLine,
    Plus,
    Trash2,
    Save,
} from "lucide-react"
import { saveVendorQuotationDraft, triggerVendorQuotationOcr, type TriggerOcrResult } from "@/app/actions/vendor-quotation"
import { uploadFile } from "@/app/actions/upload"
import { toAbsoluteUploadDocumentUrl } from "@/lib/upload-url"

type OcrResultData = NonNullable<TriggerOcrResult["data"]>

type EditableOcrItem = OcrResultData["items"][number]

type EditableOcrDraft = {
    vendorName: string
    quoteNumber: string
    quoteDate: string
    remark: string
    items: EditableOcrItem[]
}

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialUrl?: string
    onSuccess?: () => void
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(value || 0)
}

function toEditableDraft(data: OcrResultData): EditableOcrDraft {
    return {
        vendorName: data.vendorName ?? "",
        quoteNumber: data.quoteNumber ?? "",
        quoteDate: data.quoteDate ?? "",
        remark: data.remark ?? "",
        items: data.items.map((item) => ({
            itemName: item.itemName ?? "",
            qty: Number(item.qty ?? 0),
            unit: item.unit ?? "",
            unitPrice: Number(item.unitPrice ?? 0),
            totalPrice: Number(item.totalPrice ?? 0),
            remark: item.remark ?? "",
        })),
    }
}

function createEmptyItem(): EditableOcrItem {
    return {
        itemName: "",
        qty: 0,
        unit: "",
        unitPrice: 0,
        totalPrice: 0,
        remark: "",
    }
}

function normalizeNumber(value: string) {
    const sanitized = value.replace(/,/g, "")
    const parsed = Number(sanitized)
    return Number.isFinite(parsed) ? parsed : 0
}

export function VendorQuotationOcrDialog({ open, onOpenChange, initialUrl = "", onSuccess }: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [fileUrl, setFileUrl] = useState(() => toAbsoluteUploadDocumentUrl(initialUrl) ?? initialUrl)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [result, setResult] = useState<OcrResultData | null>(null)
    const [draft, setDraft] = useState<EditableOcrDraft | null>(null)
    const isManualFlow = !initialUrl.trim()

    useEffect(() => {
        setFileUrl(toAbsoluteUploadDocumentUrl(initialUrl) ?? initialUrl)
    }, [initialUrl])

    function resetState() {
        setResult(null)
        setDraft(null)
        setFileUrl(toAbsoluteUploadDocumentUrl(initialUrl) ?? initialUrl)
        setUploading(false)
        setLoading(false)
        setSaving(false)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    function handleClose(nextOpen: boolean) {
        if (!nextOpen && !loading && !saving) {
            resetState()
        }
        onOpenChange(nextOpen)
    }

    async function handleManualFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
        const selectedFile = event.target.files?.[0]
        if (!selectedFile) {
            return
        }

        const allowedTypes = [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
        ]

        if (!allowedTypes.includes(selectedFile.type)) {
            toast.error("File harus berupa PDF, PNG, JPG, atau WEBP")
            event.target.value = ""
            return
        }

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("file", selectedFile)
            const uploadResult = await uploadFile(formData)

            if (!uploadResult.success || !uploadResult.url) {
                toast.error(uploadResult.error || "Upload file gagal")
                return
            }

            setFileUrl(toAbsoluteUploadDocumentUrl(uploadResult.url) ?? uploadResult.url)
            toast.success("File berhasil diupload. Lanjutkan Extract untuk melihat hasil OCR.")
        } catch {
            toast.error("Terjadi kesalahan saat upload file")
        } finally {
            setUploading(false)
            event.target.value = ""
        }
    }

    async function handleExtract() {
        if (!fileUrl.trim()) {
            toast.error("Upload file atau masukkan URL file terlebih dahulu")
            return
        }

        setLoading(true)
        setResult(null)
        setDraft(null)
        try {
            const normalizedFileUrl = toAbsoluteUploadDocumentUrl(fileUrl) ?? fileUrl.trim()
            setFileUrl(normalizedFileUrl)

            const res = await triggerVendorQuotationOcr(normalizedFileUrl, undefined, !isManualFlow)
            if (!res.success || !res.data) {
                toast.error(res.error ?? "OCR gagal")
                return
            }

            setResult(res.data)
            if (isManualFlow) {
                setDraft(toEditableDraft(res.data))
                toast.success("OCR berhasil. Silakan review dan edit dulu sebelum simpan.")
            } else {
                toast.success(`OCR berhasil dan data langsung disimpan${res.id ? ` (ID #${res.id})` : ""}.`)
                onSuccess?.()
                handleClose(false)
            }
        } catch {
            toast.error("Terjadi kesalahan saat menjalankan OCR")
        } finally {
            setLoading(false)
        }
    }

    function updateDraftField<K extends keyof EditableOcrDraft>(key: K, value: EditableOcrDraft[K]) {
        setDraft((current) => (current ? { ...current, [key]: value } : current))
    }

    function updateDraftItem(index: number, patch: Partial<EditableOcrItem>) {
        setDraft((current) => {
            if (!current) {
                return current
            }

            const nextItems = current.items.map((item, itemIndex) => {
                if (itemIndex !== index) {
                    return item
                }

                const nextItem = { ...item, ...patch }
                if ("qty" in patch || "unitPrice" in patch) {
                    nextItem.totalPrice = Number(nextItem.qty || 0) * Number(nextItem.unitPrice || 0)
                }
                return nextItem
            })

            return { ...current, items: nextItems }
        })
    }

    function handleAddItem() {
        setDraft((current) => (current ? { ...current, items: [...current.items, createEmptyItem()] } : current))
    }

    function handleRemoveItem(index: number) {
        setDraft((current) => {
            if (!current) {
                return current
            }

            const nextItems = current.items.filter((_, itemIndex) => itemIndex !== index)
            return { ...current, items: nextItems }
        })
    }

    async function handleSave() {
        if (!draft) {
            toast.error("Belum ada hasil OCR yang bisa disimpan")
            return
        }

        if (!fileUrl.trim()) {
            toast.error("File URL tidak boleh kosong")
            return
        }

        const validItems = draft.items.filter((item) => item.itemName.trim().length > 0)
        if (validItems.length === 0) {
            toast.error("Minimal isi satu item sebelum simpan")
            return
        }

        setSaving(true)
        try {
            const saveResult = await saveVendorQuotationDraft({
                fileUrl: fileUrl.trim(),
                vendorName: draft.vendorName.trim() || null,
                quoteNumber: draft.quoteNumber.trim() || null,
                quoteDate: draft.quoteDate.trim() || null,
                remark: draft.remark.trim() || null,
                items: validItems.map((item) => ({
                    itemName: item.itemName.trim(),
                    qty: Number(item.qty || 0),
                    unit: String(item.unit ?? "").trim() || null,
                    unitPrice: Number(item.unitPrice || 0),
                    totalPrice: Number(item.totalPrice || 0),
                    remark: String(item.remark ?? "").trim() || null,
                })),
            })

            if (!saveResult.success) {
                toast.error(saveResult.error || "Gagal menyimpan vendor quotation")
                return
            }

            toast.success(`Vendor quotation berhasil disimpan${saveResult.id ? ` (ID #${saveResult.id})` : ""}`)
            onSuccess?.()
            handleClose(false)
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan vendor quotation")
        } finally {
            setSaving(false)
        }
    }

    const totalNilai = draft?.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0) ?? 0

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ScanText className="h-5 w-5 text-indigo-500" />
                        Extract Quotation Vendor via OCR
                    </DialogTitle>
                    <DialogDescription>
                        {isManualFlow
                            ? "Upload file, jalankan OCR, lalu edit hasil ekstraksi sebelum disimpan ke database."
                            : "Jalankan OCR untuk quotation vendor dari data auto. Hasilnya akan langsung disimpan seperti alur sebelumnya."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Upload File Manual (PDF / Gambar)</Label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                            onChange={handleManualFileSelect}
                            disabled={loading || uploading || saving}
                        />
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading || uploading || saving}
                                className="gap-2"
                            >
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {uploading ? "Uploading..." : "Upload PDF / Gambar"}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                {isManualFlow
                                    ? "File diupload dulu, lalu hasil OCR bisa Anda review dan edit sebelum simpan."
                                    : "File bisa diganti bila perlu, tetapi flow auto tetap langsung simpan setelah OCR berhasil."}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="vq-file-url">URL File Quotation (PDF / Gambar)</Label>
                        <div className="flex gap-2">
                            <Input
                                id="vq-file-url"
                                placeholder="https://example.com/quotation.pdf"
                                value={fileUrl}
                                onChange={(e) => setFileUrl(e.target.value)}
                                disabled={loading || uploading || saving}
                                className="flex-1"
                            />
                            {fileUrl && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    type="button"
                                    onClick={() => window.open(fileUrl, "_blank")}
                                    title="Buka file di tab baru"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Bisa isi URL langsung, atau upload file manual di atas lalu URL akan terisi otomatis.
                        </p>
                    </div>

                    {(loading || uploading || saving) && (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                            <p className="text-sm font-medium">
                                {uploading ? "Mengupload file... Mohon tunggu" : saving ? "Menyimpan ke database... Mohon tunggu" : "Memproses OCR... Mohon tunggu"}
                            </p>
                            <p className="text-xs">
                                {uploading
                                    ? "Menyimpan file PDF/gambar agar bisa diproses OCR"
                                    : saving
                                        ? "Menyimpan hasil OCR yang sudah Anda edit"
                                        : "Mengunduh file dan mengekstrak data dengan AI"}
                            </p>
                        </div>
                    )}

                    {isManualFlow && draft && !loading && !uploading && (
                        <div className="space-y-4">
                            <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-950/30">
                                <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                        Hasil OCR siap direview
                                    </p>
                                    <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                                        Data belum masuk database. Silakan edit jika perlu, lalu klik Simpan ke Database.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="vendor-name">Nama Vendor</Label>
                                    <Input
                                        id="vendor-name"
                                        value={draft.vendorName}
                                        onChange={(e) => updateDraftField("vendorName", e.target.value)}
                                        placeholder="Nama vendor"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quote-number">Nomor Quote</Label>
                                    <Input
                                        id="quote-number"
                                        value={draft.quoteNumber}
                                        onChange={(e) => updateDraftField("quoteNumber", e.target.value)}
                                        placeholder="Nomor quotation"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="quote-date">Tanggal Quote</Label>
                                    <Input
                                        id="quote-date"
                                        value={draft.quoteDate}
                                        onChange={(e) => updateDraftField("quoteDate", e.target.value)}
                                        placeholder="YYYY-MM-DD atau sesuai dokumen"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Total Item</Label>
                                    <div className="flex h-10 items-center rounded-md border bg-background px-3 text-sm font-medium">
                                        {draft.items.length} item
                                    </div>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="quote-remark">Remark</Label>
                                    <Textarea
                                        id="quote-remark"
                                        value={draft.remark}
                                        onChange={(e) => updateDraftField("remark", e.target.value)}
                                        placeholder="Remark, syarat pembayaran, validity, atau catatan lain"
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <div className="flex items-center justify-between border-b px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold">Item quotation</p>
                                        <p className="text-xs text-muted-foreground">Edit hasil OCR per baris sebelum disimpan.</p>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="gap-2">
                                        <Plus className="h-4 w-4" />
                                        Tambah Item
                                    </Button>
                                </div>

                                <div className="overflow-x-auto">
                                    <Table className="min-w-[1080px]">
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="min-w-[280px]">Item</TableHead>
                                                <TableHead className="min-w-[100px]">Qty</TableHead>
                                                <TableHead className="min-w-[110px]">Satuan</TableHead>
                                                <TableHead className="min-w-[160px]">Harga Satuan</TableHead>
                                                <TableHead className="min-w-[160px]">Total</TableHead>
                                                <TableHead className="min-w-[220px]">Remark</TableHead>
                                                <TableHead className="w-[80px] text-right">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {draft.items.length > 0 ? (
                                                draft.items.map((item, idx) => (
                                                    <TableRow key={`draft-item-${idx}`}>
                                                        <TableCell>
                                                            <Input
                                                                value={item.itemName}
                                                                onChange={(e) => updateDraftItem(idx, { itemName: e.target.value })}
                                                                placeholder="Nama item"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                value={String(item.qty)}
                                                                onChange={(e) => updateDraftItem(idx, { qty: normalizeNumber(e.target.value) })}
                                                                placeholder="0"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                value={String(item.unit ?? "")}
                                                                onChange={(e) => updateDraftItem(idx, { unit: e.target.value })}
                                                                placeholder="pcs"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                value={String(item.unitPrice)}
                                                                onChange={(e) => updateDraftItem(idx, { unitPrice: normalizeNumber(e.target.value) })}
                                                                placeholder="0"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                value={String(item.totalPrice)}
                                                                onChange={(e) => updateDraftItem(idx, { totalPrice: normalizeNumber(e.target.value) })}
                                                                placeholder="0"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                value={String(item.remark ?? "")}
                                                                onChange={(e) => updateDraftItem(idx, { remark: e.target.value })}
                                                                placeholder="Catatan item"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRemoveItem(idx)}
                                                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                title="Hapus item"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                                                        Belum ada item. Tambahkan item manual sebelum simpan.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            <TableRow className="bg-muted/30 font-semibold">
                                                <TableCell colSpan={4} className="text-right text-sm">Grand Total</TableCell>
                                                <TableCell className="text-sm">{formatCurrency(totalNilai)}</TableCell>
                                                <TableCell colSpan={2} />
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {result && (
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                        OCR sukses
                                    </Badge>
                                    <span>Draft dibuat dari hasil OCR dan masih bisa Anda ubah sebelum disimpan.</span>
                                </div>
                            )}
                        </div>
                    )}

                    {!draft && !loading && !uploading && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                {isManualFlow
                                    ? "OCR akan mengekstrak data dari file PDF/gambar. Setelah hasil muncul, Anda bisa edit dulu sebelum menyimpannya ke Vendor Quotation Database."
                                    : "OCR akan mengekstrak data dari file PDF/gambar dan langsung menyimpannya ke Vendor Quotation Database untuk flow auto."}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {isManualFlow && draft ? (
                        <>
                            <Button variant="outline" onClick={() => { setResult(null); setDraft(null) }} disabled={saving}>
                                Ulangi OCR
                            </Button>
                            <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
                                Tutup
                            </Button>
                            <Button onClick={handleSave} disabled={saving || loading || uploading} className="gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {saving ? "Menyimpan..." : "Simpan ke Database"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => handleClose(false)} disabled={loading || saving}>
                                Batal
                            </Button>
                            <Button
                                onClick={handleExtract}
                                disabled={loading || uploading || saving || !fileUrl.trim()}
                                className="gap-2"
                            >
                                {loading ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</>
                                ) : (
                                    <><ScanText className="h-4 w-4" /> {isManualFlow ? "Extract Dulu" : "Extract & Simpan"}</>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function VendorQuotationOcrBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; className: string }> = {
        done: { label: "Selesai", className: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
        pending: { label: "Pending", className: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
        processing: { label: "Proses", className: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
        failed: { label: "Gagal", className: "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-400" },
    }
    const config = map[status] ?? { label: status, className: "" }
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>
}
