"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, ScanText, CheckCircle2, AlertCircle, ExternalLink, Upload } from "lucide-react"
import { triggerVendorQuotationOcr, type TriggerOcrResult } from "@/app/actions/vendor-quotation"
import { uploadFile } from "@/app/actions/upload"

type OcrResultData = NonNullable<TriggerOcrResult["data"]>

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
    }).format(value)
}

export function VendorQuotationOcrDialog({ open, onOpenChange, initialUrl = "", onSuccess }: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [fileUrl, setFileUrl] = useState(initialUrl)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [result, setResult] = useState<OcrResultData | null>(null)
    const [savedId, setSavedId] = useState<number | null>(null)

    // Sync fileUrl with initialUrl prop when it changes
    useEffect(() => {
        setFileUrl(initialUrl)
    }, [initialUrl])

    function handleClose() {
        if (!loading) {
            onOpenChange(false)
            setResult(null)
            setSavedId(null)
            setFileUrl(initialUrl)
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }
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

            setFileUrl(uploadResult.url)
            toast.success("File berhasil diupload. Lanjutkan Extract Sekarang untuk menjalankan OCR.")
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
        setSavedId(null)
        try {
            const res = await triggerVendorQuotationOcr(fileUrl.trim())
            if (!res.success) {
                toast.error(res.error ?? "OCR gagal")
                return
            }
            setResult(res.data ?? null)
            setSavedId(res.id ?? null)
            toast.success("OCR berhasil! Data telah disimpan ke database.")
            onSuccess?.()
        } catch {
            toast.error("Terjadi kesalahan saat menjalankan OCR")
        } finally {
            setLoading(false)
        }
    }

    const totalNilai = result?.items.reduce((sum, item) => sum + item.totalPrice, 0) ?? 0

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ScanText className="h-5 w-5 text-indigo-500" />
                        Extract Quotation Vendor via OCR
                    </DialogTitle>
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
                            disabled={loading || uploading}
                        />
                        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/50 p-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading || uploading}
                                className="gap-2"
                            >
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {uploading ? "Uploading..." : "Upload PDF / Gambar"}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                File yang diupload akan disimpan lalu bisa langsung diextract ke Vendor Quotation Database.
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
                                disabled={loading || uploading}
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

                    {(loading || uploading) && (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                            <p className="text-sm font-medium">
                                {uploading ? "Mengupload file... Mohon tunggu" : "Memproses OCR... Mohon tunggu"}
                            </p>
                            <p className="text-xs">
                                {uploading ? "Menyimpan file PDF/gambar agar bisa diproses OCR" : "Mengunduh file dan mengekstrak data dengan AI"}
                            </p>
                        </div>
                    )}

                    {result && !loading && !uploading && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                                    Data berhasil diekstrak dan disimpan
                                    {savedId && <span className="ml-1 font-medium">(ID #{savedId})</span>}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Nama Vendor</p>
                                    <p className="font-semibold">{result.vendorName ?? "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Nomor Quote</p>
                                    <p className="font-semibold">{result.quoteNumber ?? "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Tanggal</p>
                                    <p className="font-semibold">{result.quoteDate ?? "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Item</p>
                                    <p className="font-semibold">{result.items.length} item</p>
                                </div>
                                {result.remark && (
                                    <div className="col-span-2 sm:col-span-4">
                                        <p className="text-xs text-muted-foreground">Remark</p>
                                        <p className="text-sm">{result.remark}</p>
                                    </div>
                                )}
                            </div>

                            {result.items.length > 0 && (
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead className="text-xs">Item</TableHead>
                                                <TableHead className="text-xs text-right">Qty</TableHead>
                                                <TableHead className="text-xs">Satuan</TableHead>
                                                <TableHead className="text-xs text-right">Harga Satuan</TableHead>
                                                <TableHead className="text-xs text-right">Total</TableHead>
                                                <TableHead className="text-xs">Remark</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {result.items.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell className="text-sm font-medium">{item.itemName}</TableCell>
                                                    <TableCell className="text-right text-sm">{item.qty}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">{item.unit ?? "—"}</TableCell>
                                                    <TableCell className="text-right text-sm">{formatCurrency(item.unitPrice)}</TableCell>
                                                    <TableCell className="text-right text-sm font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">{item.remark ?? "—"}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="bg-muted/30 font-semibold">
                                                <TableCell colSpan={4} className="text-right text-sm">Grand Total</TableCell>
                                                <TableCell className="text-right text-sm">{formatCurrency(totalNilai)}</TableCell>
                                                <TableCell />
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    )}

                    {!result && !loading && !uploading && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                OCR akan mengekstrak data dari file PDF/gambar lalu langsung menyimpannya ke Vendor Quotation Database. Anda bisa upload file manual atau pakai URL publik.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {result ? (
                        <Button onClick={handleClose} variant="outline">Tutup</Button>
                    ) : (
                        <>
                        <Button variant="outline" onClick={handleClose} disabled={loading}>
                            Batal
                        </Button>
                        <Button
                            onClick={handleExtract}
                            disabled={loading || uploading || !fileUrl.trim()}
                            className="gap-2"
                        >
                            {loading ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</>
                                ) : (
                                    <><ScanText className="h-4 w-4" /> Extract Sekarang</>
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
