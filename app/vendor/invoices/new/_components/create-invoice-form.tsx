"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { lookupSapPoForVendorAction, submitVendorInvoiceAction } from "@/app/actions/vendor-invoices"
import { uploadFile } from "@/app/actions/upload"
import { calculateTaxAndTotals } from "@/lib/vendor-invoice-calculator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    AlertCircle,
    CheckCircle2,
    CheckCircle,
    FileCheck,
    FileText,
    HelpCircle,
    Loader2,
    Search,
    UploadCloud,
    X,
} from "lucide-react"

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(amount)
}

export function VendorInvoiceCreateForm({ tenant }: { tenant: any }) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // Form fields
    const [invoiceNumber, setInvoiceNumber] = useState("")
    const [poNumber, setPoNumber] = useState("")
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
    const [subtotal, setSubtotal] = useState<number>(0)
    const [ppnPercent, setPpnPercent] = useState<number>(tenant.isPkp ? 11 : 0)
    const [pphPercent, setPphPercent] = useState<number>(0)
    const [topDays, setTopDays] = useState<number>(tenant.defaultTopDays || 30)

    // SAP PO Lookup state
    const [isCheckingPo, setIsCheckingPo] = useState(false)
    const [poCheckResult, setPoCheckResult] = useState<any>(null)

    // File attachments
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
    const [taxInvoiceFile, setTaxInvoiceFile] = useState<File | null>(null)
    const [poFile, setPoFile] = useState<File | null>(null)
    const [deliveryReceiptFile, setDeliveryReceiptFile] = useState<File | null>(null)

    // Calculated amounts
    const { ppnAmount, pphAmount, grandTotal } = calculateTaxAndTotals({
        subtotal,
        ppnPercent,
        pphPercent,
    })

    // PO check handler
    const handleCheckPo = async () => {
        if (!poNumber.trim()) return
        setIsCheckingPo(true)
        setPoCheckResult(null)

        try {
            const res = await lookupSapPoForVendorAction(poNumber)
            setPoCheckResult(res)
            if (res.found && res.netValue && subtotal === 0) {
                // Auto-fill subtotal from SAP PO value if not yet set
                setSubtotal(res.netValue)
            }
        } catch {
            setPoCheckResult({ found: false, message: "Gagal memeriksa ke database SAP." })
        } finally {
            setIsCheckingPo(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (!invoiceNumber.trim()) {
            setErrorMessage("Nomor Invoice wajib diisi.")
            return
        }

        if (!poNumber.trim()) {
            setErrorMessage("Nomor Purchase Order (PO) wajib diisi.")
            return
        }

        if (subtotal <= 0) {
            setErrorMessage("Subtotal nominal invoice harus lebih besar dari 0.")
            return
        }

        if (!invoiceFile) {
            setErrorMessage("Berkas PDF/Scan Invoice fisik wajib diunggah.")
            return
        }

        if (tenant.isPkp && !taxInvoiceFile) {
            setErrorMessage("Vendor PKP wajib melampirkan berkas e-Faktur Pajak.")
            return
        }

        setIsSubmitting(true)

        try {
            // 1. Upload Invoice File
            const invoiceFormData = new FormData()
            invoiceFormData.append("file", invoiceFile)
            const uploadInvoiceRes = await uploadFile(invoiceFormData)

            if (!uploadInvoiceRes.success || !uploadInvoiceRes.url) {
                throw new Error("Gagal mengunggah berkas invoice: " + uploadInvoiceRes.error)
            }

            // 2. Upload e-Faktur Pajak if exists
            let taxInvoiceUrl: string | undefined = undefined
            if (taxInvoiceFile) {
                const taxFormData = new FormData()
                taxFormData.append("file", taxInvoiceFile)
                const uploadTaxRes = await uploadFile(taxFormData)
                if (uploadTaxRes.success && uploadTaxRes.url) {
                    taxInvoiceUrl = uploadTaxRes.url
                }
            }

            // 3. Upload PO File if exists
            let poUrl: string | undefined = undefined
            if (poFile) {
                const poFormData = new FormData()
                poFormData.append("file", poFile)
                const uploadPoRes = await uploadFile(poFormData)
                if (uploadPoRes.success && uploadPoRes.url) {
                    poUrl = uploadPoRes.url
                }
            }

            // 4. Upload Surat Jalan/BAP if exists
            let deliveryUrl: string | undefined = undefined
            if (deliveryReceiptFile) {
                const delivFormData = new FormData()
                delivFormData.append("file", deliveryReceiptFile)
                const uploadDelivRes = await uploadFile(delivFormData)
                if (uploadDelivRes.success && uploadDelivRes.url) {
                    deliveryUrl = uploadDelivRes.url
                }
            }

            // 5. Submit to database action
            const res = await submitVendorInvoiceAction({
                tenantId: tenant.id,
                invoiceNumber,
                poNumber,
                invoiceDate,
                subtotal,
                ppnPercent,
                pphPercent,
                topDays,
                currency: poCheckResult?.currency || "IDR",
                invoiceFileUrl: uploadInvoiceRes.url,
                taxInvoiceFileUrl: taxInvoiceUrl,
                poFileUrl: poUrl,
                deliveryReceiptFileUrl: deliveryUrl,
            })

            if (!res.success) {
                throw new Error(res.error || "Gagal menyimpan pengajuan invoice.")
            }

            router.push("/vendor/dashboard?submitted=1")
        } catch (err: any) {
            setErrorMessage(err.message || "Terjadi kesalahan saat pengajuan invoice.")
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
                <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Step 1: Informasi Dokumen & PO */}
            <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        1. Informasi Invoice & Nomor Purchase Order (PO)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="invoiceNumber">Nomor Invoice Tagihan *</Label>
                            <Input
                                id="invoiceNumber"
                                placeholder="Contoh: INV/2026/XI/0089"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="invoiceDate">Tanggal Invoice *</Label>
                            <Input
                                id="invoiceDate"
                                type="date"
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* PO Input with Live SAP Checker */}
                    <div className="space-y-2">
                        <Label htmlFor="poNumber">Nomor Purchase Order (PO) One Chitra *</Label>
                        <div className="flex gap-2">
                            <Input
                                id="poNumber"
                                placeholder="Contoh: 4500012345"
                                value={poNumber}
                                onChange={(e) => setPoNumber(e.target.value)}
                                required
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCheckPo}
                                disabled={isCheckingPo || !poNumber.trim()}
                                className="shrink-0 flex items-center gap-1.5"
                            >
                                {isCheckingPo ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Search className="w-4 h-4" />
                                )}
                                Cek PO Internal
                            </Button>
                        </div>

                        {poCheckResult && (
                            <div
                                className={`p-3 rounded-lg text-xs border ${
                                    poCheckResult.found
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300"
                                        : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-800 dark:text-amber-300"
                                }`}
                            >
                                {poCheckResult.found ? (
                                    <div className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-semibold">
                                                PO Ditemukan di Sistem SAP: {poCheckResult.poNumber}
                                            </p>
                                            <p className="mt-0.5">
                                                Vendor: <strong>{poCheckResult.vendorName}</strong> &bull; Total Net: <strong>{formatCurrency(poCheckResult.netValue)}</strong> &bull; Barang: {poCheckResult.materialSummary || "N/A"}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2">
                                        <HelpCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-semibold">PO Belum Tersinkron di SAP</p>
                                            <p className="mt-0.5">{poCheckResult.message}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Step 2: Kalkulasi Nominal & Pajak */}
            <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-primary" />
                        2. Rincian Nominal, Pajak (PPN/PPh) & TOP
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="subtotal">Sub-Total (DPP) Rupiah *</Label>
                            <Input
                                id="subtotal"
                                type="number"
                                min={0}
                                placeholder="0"
                                value={subtotal || ""}
                                onChange={(e) => setSubtotal(Number(e.target.value) || 0)}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="ppnPercent">Tarif PPN (%)</Label>
                            <Input
                                id="ppnPercent"
                                type="number"
                                min={0}
                                max={100}
                                value={ppnPercent}
                                onChange={(e) => setPpnPercent(Number(e.target.value) || 0)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="pphPercent">Tarif PPh (%) [Opsional]</Label>
                            <Input
                                id="pphPercent"
                                type="number"
                                min={0}
                                max={100}
                                value={pphPercent}
                                onChange={(e) => setPphPercent(Number(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="topDays">Term of Payment (TOP Hari)</Label>
                            <Input
                                id="topDays"
                                type="number"
                                min={1}
                                max={180}
                                value={topDays}
                                onChange={(e) => setTopDays(Number(e.target.value) || 30)}
                            />
                            <p className="text-[11px] text-slate-400">
                                TOP akan terhitung setelah invoice dinyatakan valid oleh Finance.
                            </p>
                        </div>

                        {/* Ringkasan Perhitungan */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>Subtotal (DPP):</span>
                                <span className="font-semibold">{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                <span>PPN ({ppnPercent}%):</span>
                                <span>+ {formatCurrency(ppnAmount)}</span>
                            </div>
                            {pphAmount > 0 && (
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                    <span>PPh ({pphPercent}%):</span>
                                    <span>- {formatCurrency(pphAmount)}</span>
                                </div>
                            )}
                            <div className="border-t pt-1.5 flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100">
                                <span>Grand Total:</span>
                                <span className="text-primary">{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Step 3: Unggah Berkas & Dokumen Pendukung */}
            <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <UploadCloud className="w-5 h-5 text-primary" />
                        3. Unggah Dokumen Lampiran (PDF / Scan Asli)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* File Invoice (Wajib) */}
                    <div className="p-4 border rounded-xl border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between mb-2">
                            <Label className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                Berkas Invoice Fisik (PDF / Gambar) *
                            </Label>
                            <span className="text-[11px] text-red-500 font-medium">Wajib Diunggah</span>
                        </div>
                        {invoiceFile ? (
                            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border rounded-lg text-xs">
                                <span className="truncate max-w-xs font-medium">{invoiceFile.name}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setInvoiceFile(null)}
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <input
                                type="file"
                                accept=".pdf,image/*"
                                onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                                className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                required
                            />
                        )}
                    </div>

                    {/* e-Faktur Pajak (Wajib jika PKP) */}
                    <div className="p-4 border rounded-xl border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between mb-2">
                            <Label className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                Faktur Pajak e-Faktur (PDF) {tenant.isPkp ? "*" : "(Opsional)"}
                            </Label>
                            {tenant.isPkp && (
                                <span className="text-[11px] text-amber-600 font-medium">Wajib bagi Vendor PKP</span>
                            )}
                        </div>
                        {taxInvoiceFile ? (
                            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border rounded-lg text-xs">
                                <span className="truncate max-w-xs font-medium">{taxInvoiceFile.name}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setTaxInvoiceFile(null)}
                                    className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <input
                                type="file"
                                accept=".pdf,image/*"
                                onChange={(e) => setTaxInvoiceFile(e.target.files?.[0] || null)}
                                className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-800 cursor-pointer"
                            />
                        )}
                    </div>

                    {/* Surat Jalan / BAP / Proof of Delivery & PO copy */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 border rounded-xl border-slate-200 dark:border-slate-800">
                            <Label className="text-xs font-medium block mb-1.5">
                                Surat Jalan / BAP (Opsional)
                            </Label>
                            {deliveryReceiptFile ? (
                                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs">
                                    <span className="truncate max-w-xs">{deliveryReceiptFile.name}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeliveryReceiptFile(null)}
                                        className="h-6 w-6 p-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <input
                                    type="file"
                                    accept=".pdf,image/*"
                                    onChange={(e) => setDeliveryReceiptFile(e.target.files?.[0] || null)}
                                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-slate-200 file:text-slate-700 cursor-pointer"
                                />
                            )}
                        </div>

                        <div className="p-3 border rounded-xl border-slate-200 dark:border-slate-800">
                            <Label className="text-xs font-medium block mb-1.5">
                                Salinan PO Internal (Opsional)
                            </Label>
                            {poFile ? (
                                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-xs">
                                    <span className="truncate max-w-xs">{poFile.name}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setPoFile(null)}
                                        className="h-6 w-6 p-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <input
                                    type="file"
                                    accept=".pdf,image/*"
                                    onChange={(e) => setPoFile(e.target.files?.[0] || null)}
                                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-slate-200 file:text-slate-700 cursor-pointer"
                                />
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 text-base rounded-xl shadow-md"
            >
                {isSubmitting ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Mengunggah Dokumen & Mengajukan Invoice...
                    </>
                ) : (
                    "Kirim Pengajuan Invoice ke Admin One Chitra"
                )}
            </Button>
        </form>
    )
}
