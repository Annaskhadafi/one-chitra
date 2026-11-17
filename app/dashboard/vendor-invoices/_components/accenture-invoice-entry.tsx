"use client"

import React, { useState, useEffect } from "react"
import {
    searchSapVendorMasterAction,
    lookupSapPoForVendorAction,
    lookupVendorContractAction,
    submitInvoiceByAdminAction,
} from "@/app/actions/vendor-invoices"
import { uploadFile } from "@/app/actions/upload"
import { calculateTaxAndTotals } from "@/lib/vendor-invoice-calculator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Building2,
    CreditCard,
    FileText,
    FileSpreadsheet,
    FileSignature,
    Package,
    Search,
    Loader2,
    Calendar,
    UploadCloud,
    HelpCircle,
    Layers,
    ShieldCheck,
    Info,
    Sparkles,
    ChevronDown,
    ChevronUp,
    FileCheck,
} from "lucide-react"

interface AccentureInvoiceEntryProps {
    onBack: () => void
    onSuccess: () => void
    initialSapVendors?: any[]
    initialTenants?: any[]
}

function formatCurrency(val: number | string) {
    const num = Number(val) || 0
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(num)
}

export function AccentureInvoiceEntry({
    onBack,
    onSuccess,
    initialSapVendors = [],
    initialTenants = [],
}: AccentureInvoiceEntryProps) {
    const [isSaving, setIsSaving] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [formSuccess, setFormSuccess] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<"vendor" | "documents" | "reconciliation">("vendor")

    // Vendor Selection
    const [vendorSearch, setVendorSearch] = useState("")
    const [vendorSearchResults, setVendorSearchResults] = useState<any[]>([])
    const [isSearchingVendor, setIsSearchingVendor] = useState(false)
    const [selectedVendor, setSelectedVendor] = useState<any | null>(null)

    // Reference Type: PO vs CONTRACT
    const [referenceType, setReferenceType] = useState<"PO" | "CONTRACT">("PO")

    // PO Fields & Lookup
    const [poNumber, setPoNumber] = useState("")
    const [isCheckingPo, setIsCheckingPo] = useState(false)
    const [poLookupResult, setPoLookupResult] = useState<any | null>(null)
    const [invoicedItemsCount, setInvoicedItemsCount] = useState<number>(1)
    const [totalPoItemsCount, setTotalPoItemsCount] = useState<number>(1)
    const [calculatedPoStatus, setCalculatedPoStatus] = useState<"open" | "partial" | "completed">("completed")

    // Contract Fields & Lookup
    const [contractNumber, setContractNumber] = useState("")
    const [isCheckingContract, setIsCheckingContract] = useState(false)
    const [contractLookupResult, setContractLookupResult] = useState<any | null>(null)

    // Invoice Details & Tax
    const [invoiceNumber, setInvoiceNumber] = useState("")
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
    const [subtotal, setSubtotal] = useState<number>(0)
    const [ppnPercent, setPpnPercent] = useState<number>(11)
    const [pphPercent, setPphPercent] = useState<number>(0)
    const [topDays, setTopDays] = useState<number>(30)

    // Enterprise P2P Enhancements: Kategori Pekerjaan Sipil (Retensi 5%), Kliring Uang Muka (DP), dan CoreTax
    const [projectCategory, setProjectCategory] = useState<"general" | "sipil">("general")
    const [retentionPercent, setRetentionPercent] = useState<number>(0)
    const [dpDeduction, setDpDeduction] = useState<number>(0)
    const [penaltyAmount, setPenaltyAmount] = useState<number>(0)
    const [penaltyNotes, setPenaltyNotes] = useState<string>("")
    const [taxInvoiceNumber, setTaxInvoiceNumber] = useState<string>("")
    const [taxQrUrl, setTaxQrUrl] = useState<string>("")
    const [vendorNpwp16, setVendorNpwp16] = useState<string>("")

    // File Attachments: Bundel Lengkap (Single PDF) & Opsi Terpisah
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
    const [contractPdfFile, setContractPdfFile] = useState<File | null>(null)
    const [deliveryReceiptFile, setDeliveryReceiptFile] = useState<File | null>(null)
    const [grSlipFile, setGrSlipFile] = useState<File | null>(null)
    const [taxInvoiceFile, setTaxInvoiceFile] = useState<File | null>(null)
    const [showSeparateUploads, setShowSeparateUploads] = useState<boolean>(false)

    // Additional Notes
    const [notes, setNotes] = useState("")

    // Hitung Pajak & Total secara Real-time
    const totals = calculateTaxAndTotals({
        subtotal,
        ppnPercent: (selectedVendor?.isPkp ?? true) ? ppnPercent : 0,
        pphPercent,
    })

    // Real-time Retensi & Net Payable Calculation
    const retentionAmount = retentionPercent > 0 ? Math.round(subtotal * (retentionPercent / 100)) : 0
    const netPayable = Math.max(0, totals.grandTotal - dpDeduction - retentionAmount - penaltyAmount)

    // Estimasi Tanggal Jatuh Tempo
    const dueDateEstimate = (() => {
        if (!invoiceDate) return null
        const d = new Date(invoiceDate)
        d.setDate(d.getDate() + (topDays || 30))
        return d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
        })
    })()

    // Real-time Vendor Search
    useEffect(() => {
        if (!vendorSearch.trim()) {
            setVendorSearchResults([])
            return
        }
        const timer = setTimeout(async () => {
            setIsSearchingVendor(true)
            try {
                const raw = await searchSapVendorMasterAction(vendorSearch)
                // Map SAP vendor master result agar id selalu berbentuk "sap:<supplierCode>" (string)
                // sehingga action submitInvoiceByAdminAction dapat mendeteksi dan melakukan on-the-fly linking
                const res = raw.slice(0, 8).map((v: any) => ({
                    ...v,
                    id: v.supplierCode ? `sap:${v.supplierCode}` : `sap:${v.id}`,
                    name: v.vendorName || v.name,
                    sapVendorCode: v.supplierCode || v.sapVendorCode,
                    topDays: v.topDays || 30,
                    isPkp: true,
                    bankName: v.bankName,
                    bankAccountNo: v.bankAccountNumber || v.bankAccountNo,
                    bankAccountHolder: v.bankAccountHolder,
                }))
                setVendorSearchResults(res)
            } catch {
                setVendorSearchResults([])
            } finally {
                setIsSearchingVendor(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [vendorSearch])

    // Update PO Status whenever items change
    useEffect(() => {
        if (!poLookupResult) return
        const total = totalPoItemsCount || poLookupResult.totalItems || 1
        const invoiced = invoicedItemsCount || 1
        if (invoiced >= total) {
            setCalculatedPoStatus("completed")
        } else if (invoiced > 0) {
            setCalculatedPoStatus("partial")
        } else {
            setCalculatedPoStatus("open")
        }
    }, [invoicedItemsCount, totalPoItemsCount, poLookupResult])

    // Handle Select Vendor
    const handleSelectVendor = (v: any) => {
        setSelectedVendor(v)
        setVendorSearch("")
        setVendorSearchResults([])
        setTopDays(Number(v.topDays) || 30)
        setPpnPercent(v.isPkp !== false ? 11 : 0)
    }

    // Handle Lookup SAP PO
    const handleCheckSapPo = async () => {
        if (!poNumber.trim()) {
            setFormError("Masukkan nomor Purchase Order (PO) terlebih dahulu.")
            return
        }
        setIsCheckingPo(true)
        setFormError(null)
        try {
            const res = await lookupSapPoForVendorAction(poNumber.trim())
            if (!res.found) {
                setPoLookupResult({
                    found: false,
                    message: "PO tidak ditemukan di database SAP. Anda tetap dapat melanjutkan input manual.",
                })
                return
            }
            setPoLookupResult(res)
            if (res.netValue) {
                setSubtotal(res.netValue)
            }
            const total = res.totalItems || 1
            setTotalPoItemsCount(total)
            setInvoicedItemsCount(total) // Default to full completed, user can reduce to partial
            const validPoStatus: "open" | "partial" | "completed" =
                res.poStatus === "open" || res.poStatus === "partial" || res.poStatus === "completed"
                    ? res.poStatus
                    : "completed"
            setCalculatedPoStatus(validPoStatus)

            // Jika vendor belum terpilih, auto-select vendor dari PO
            if (!selectedVendor && res.vendorName) {
                setSelectedVendor({
                    id: `sap:${res.vendorCode || poNumber}`,
                    name: res.vendorName,
                    sapVendorCode: res.vendorCode,
                    topDays: 30,
                    isPkp: true,
                })
            }
        } catch (e: any) {
            setFormError("Gagal memeriksa PO di SAP: " + (e.message || "Error jaringan"))
        } finally {
            setIsCheckingPo(false)
        }
    }

    // Handle Lookup Contract
    const handleCheckContract = async () => {
        if (!contractNumber.trim()) {
            setFormError("Masukkan nomor kontrak terlebih dahulu.")
            return
        }
        setIsCheckingContract(true)
        setFormError(null)
        try {
            const res = await lookupVendorContractAction(contractNumber.trim())
            if (!res.found || !res.contract) {
                setContractLookupResult({
                    found: false,
                    message: "Nomor kontrak tidak ditemukan di sistem.",
                })
                return
            }
            const c = res.contract
            setContractLookupResult(c)
            setSubtotal(Number(c.contractValue) || 0)
            setTopDays(c.topDays || 45)
            setPpnPercent(c.ppnPercent ?? 11)
            setPphPercent(c.pphPercent ?? 2)

            if (!selectedVendor) {
                setSelectedVendor({
                    id: c.vendorTenantId || `sap:${c.vendorSapCode || c.contractNumber}`,
                    name: c.vendorName,
                    sapVendorCode: c.vendorSapCode,
                    topDays: c.topDays || 45,
                    isPkp: c.isPkp ?? true,
                })
            }
        } catch (e: any) {
            setFormError("Gagal memeriksa kontrak: " + (e.message || "Error jaringan"))
        } finally {
            setIsCheckingContract(false)
        }
    }

    // Submit Handler
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormError(null)
        setFormSuccess(null)

        if (!selectedVendor) {
            setFormError("Pilih mitra rekanan vendor terlebih dahulu.")
            return
        }
        if (!invoiceNumber.trim()) {
            setFormError("Nomor invoice tagihan fisik wajib diisi.")
            return
        }
        if (referenceType === "PO" && !poNumber.trim()) {
            setFormError("Nomor Purchase Order (PO) wajib diisi.")
            return
        }
        if (referenceType === "CONTRACT" && !contractNumber.trim()) {
            setFormError("Nomor Kontrak Sewa/Payung wajib diisi.")
            return
        }
        if (subtotal <= 0) {
            setFormError("Nominal Subtotal (DPP) harus lebih besar dari Rp 0.")
            return
        }

        // Validasi Berkas Dokumen: Bundel berkas lengkap / single PDF wajib ada
        if (!invoiceFile) {
            setFormError("Berkas dokumen faktur tagihan (Single PDF Bundel / Berkas Lengkap) wajib diunggah.")
            return
        }

        setIsSaving(true)

        try {
            // Upload files sequentially via proxy
            let invoiceFileUrl = ""
            let taxInvoiceFileUrl = ""
            let grSlipFileUrl = ""
            let deliveryReceiptFileUrl = ""
            let contractPdfUrl = contractLookupResult?.contractFileUrl || ""

            if (invoiceFile) {
                const fd = new FormData()
                fd.append("file", invoiceFile)
                const up = await uploadFile(fd)
                if (!up.success || !up.url) throw new Error("Gagal mengunggah berkas Invoice: " + up.error)
                invoiceFileUrl = up.url
            }

            if (taxInvoiceFile) {
                const fd = new FormData()
                fd.append("file", taxInvoiceFile)
                const up = await uploadFile(fd)
                if (!up.success || !up.url) throw new Error("Gagal mengunggah berkas Faktur Pajak: " + up.error)
                taxInvoiceFileUrl = up.url
            }

            if (grSlipFile) {
                const fd = new FormData()
                fd.append("file", grSlipFile)
                const up = await uploadFile(fd)
                if (!up.success || !up.url) throw new Error("Gagal mengunggah berkas GR Slip: " + up.error)
                grSlipFileUrl = up.url
            }

            if (deliveryReceiptFile) {
                const fd = new FormData()
                fd.append("file", deliveryReceiptFile)
                const up = await uploadFile(fd)
                if (!up.success || !up.url) throw new Error("Gagal mengunggah berkas Surat Jalan / BAST: " + up.error)
                deliveryReceiptFileUrl = up.url
            }

            if (contractPdfFile) {
                const fd = new FormData()
                fd.append("file", contractPdfFile)
                const up = await uploadFile(fd)
                if (!up.success || !up.url) throw new Error("Gagal mengunggah berkas Salinan Kontrak: " + up.error)
                contractPdfUrl = up.url
            }

            const payload = {
                tenantId: selectedVendor.id,
                sapSupplierCode: selectedVendor.sapVendorCode || selectedVendor.supplierCode,
                invoiceNumber: invoiceNumber.trim(),
                poNumber: referenceType === "PO" ? poNumber.trim() : (poNumber.trim() || `KTR-${contractNumber.trim()}`),
                contractNumber: referenceType === "CONTRACT" ? contractNumber.trim() : undefined,
                referenceType,
                invoiceDate,
                subtotal,
                ppnPercent,
                pphPercent,
                topDays,
                invoiceFileUrl,
                taxInvoiceFileUrl: taxInvoiceFileUrl || undefined,
                grSlipFileUrl: grSlipFileUrl || undefined,
                deliveryReceiptFileUrl: deliveryReceiptFileUrl || undefined,
                contractFileUrl: contractPdfUrl || undefined,
                projectCategory,
                retentionPercent,
                dpDeduction,
                penaltyAmount,
                penaltyNotes: penaltyNotes.trim() || undefined,
                taxInvoiceNumber: taxInvoiceNumber.trim() || undefined,
                taxQrUrl: taxQrUrl.trim() || undefined,
                vendorNpwp16: vendorNpwp16.trim() || undefined,
                invoicedItemsCount,
                totalPoItemsCount,
                poStatus: calculatedPoStatus,
                notes: notes.trim() || undefined,
            }

            const res = await submitInvoiceByAdminAction(payload)

            if (!res.success) {
                setFormError(res.error || "Gagal menerbitkan invoice.")
                setIsSaving(false)
                return
            }

            setFormSuccess(`Invoice ${invoiceNumber} berhasil diterbitkan dan masuk ke antrean Validation Gate Admin!`)
            setTimeout(() => {
                onSuccess()
            }, 1200)
        } catch (err: any) {
            setFormError(err.message || "Terjadi kesalahan saat memproses invoice.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-4 font-sans text-slate-800 dark:text-slate-200 max-w-5xl mx-auto pb-12">
            {/* Header with < Back button & Breadcrumb (Persis Accenture Slide 2) */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-cyan-600 hover:text-cyan-700 text-xs font-semibold flex items-center gap-1 p-1 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 rounded transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-cyan-600" />
                            Entry Invoice Vendor
                        </h2>
                        <p className="text-[11px] text-slate-500">
                            Pencatatan tagihan rekan vendor oleh Admin Procurement sesuai standar verifikasi 5 dokumen
                        </p>
                    </div>
                </div>

                <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
                    Dashboard &gt; Invoices &gt; <span className="text-slate-700 dark:text-slate-300 font-semibold">{invoiceNumber || "New Entry"}</span>
                </div>
            </div>

            {/* Notification Alerts */}
            {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                </div>
            )}

            {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{formSuccess}</span>
                </div>
            )}

            {/* TAB NAVIGATION HEADER (Per-Tab Entry Mode) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <button
                    type="button"
                    onClick={() => setActiveTab("vendor")}
                    className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        activeTab === "vendor"
                            ? "bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80"
                            : "text-slate-500 hover:text-slate-800 hover:bg-white/50 dark:hover:bg-slate-700/50"
                    }`}
                >
                    <Building2 className="w-4 h-4 shrink-0 text-cyan-600" />
                    <span>Tab 1: Data Vendor &amp; Tagihan</span>
                    {selectedVendor && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("documents")}
                    className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        activeTab === "documents"
                            ? "bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80"
                            : "text-slate-500 hover:text-slate-800 hover:bg-white/50 dark:hover:bg-slate-700/50"
                    }`}
                >
                    <UploadCloud className="w-4 h-4 shrink-0 text-cyan-600" />
                    <span>Tab 2: Lampiran Dokumen SOP</span>
                    {invoiceFile && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("reconciliation")}
                    className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        activeTab === "reconciliation"
                            ? "bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80"
                            : "text-slate-500 hover:text-slate-800 hover:bg-white/50 dark:hover:bg-slate-700/50"
                    }`}
                >
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-cyan-600" />
                    <span>Tab 3: Rekonsiliasi &amp; Simpan</span>
                </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6 text-xs bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                {/* ============================================================== */}
                {/* TAB 1: DATA VENDOR & RINCIAN TAGIHAN */}
                {/* ============================================================== */}
                {activeTab === "vendor" && (
                    <div className="space-y-6">
                        {/* SECTION 1: DATA REKANAN VENDOR */}
                        <div className="space-y-3 pb-5 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-cyan-600" />
                                    1. Data Mitra Rekan Vendor
                                </h3>
                                {selectedVendor && (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                                        Vendor Terpilih
                                    </Badge>
                                )}
                            </div>

                    {!selectedVendor ? (
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <Input
                                    value={vendorSearch}
                                    onChange={(e) => setVendorSearch(e.target.value)}
                                    placeholder="Cari vendor berdasarkan Nama atau Kode SAP (contoh: REMA TIP TOP, 2000001, TOTALINDO)..."
                                    className="pl-9 text-xs h-9 bg-slate-50 dark:bg-slate-800/60"
                                />
                                {isSearchingVendor && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-2.5 text-slate-400" />
                                )}
                            </div>

                            {vendorSearchResults.length > 0 && (
                                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                                    {vendorSearchResults.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => handleSelectVendor(v)}
                                            className="w-full text-left p-2.5 hover:bg-cyan-50/60 dark:hover:bg-cyan-950/20 transition-colors flex items-center justify-between text-xs"
                                        >
                                            <div>
                                                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                                    {v.vendorName || v.name}
                                                </span>
                                                <span className="text-[10px] text-slate-500">
                                                    SAP: {v.supplierCode || v.sapVendorCode || "-"} &bull; {v.city || "Indonesia"} &bull; TOP: {v.topDays || 30} Hari
                                                </span>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] text-cyan-700 bg-cyan-50 border-cyan-200">
                                                Pilih
                                            </Badge>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Quick Select dari Tenant Terdaftar */}
                            {initialTenants.length > 0 && vendorSearchResults.length === 0 && (
                                <div className="pt-1">
                                    <span className="text-[10px] text-slate-400 block mb-1">Atau pilih dari rekanan terdaftar:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {initialTenants.slice(0, 6).map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => handleSelectVendor(t)}
                                                className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-cyan-50 hover:border-cyan-300 text-[11px] transition-colors"
                                            >
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-3.5 bg-cyan-50/40 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                        {selectedVendor.vendorName || selectedVendor.name}
                                    </span>
                                    {(selectedVendor.supplierCode || selectedVendor.sapVendorCode) && (
                                        <Badge variant="secondary" className="font-mono text-[10px]">
                                            SAP: {selectedVendor.supplierCode || selectedVendor.sapVendorCode}
                                        </Badge>
                                    )}
                                    <Badge
                                        variant="outline"
                                        className={
                                            selectedVendor.isPkp !== false
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]"
                                                : "bg-slate-100 text-slate-600 text-[10px]"
                                        }
                                    >
                                        {selectedVendor.isPkp !== false ? "PKP (Kena Pajak)" : "Non-PKP"}
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                    {selectedVendor.address || "Alamat Kantor Terdaftar"} &bull; Term of Payment Standard:{" "}
                                    <strong className="text-cyan-700 dark:text-cyan-300">{selectedVendor.topDays || 30} Hari Kalender</strong>
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedVendor(null)}
                                className="text-xs h-7 self-start sm:self-auto border-cyan-300 hover:bg-cyan-100"
                            >
                                Ganti Vendor
                            </Button>
                        </div>
                    )}
                </div>

                {/* ============================================================== */}
                {/* SECTION 2: DOKUMEN REFERENSI TAGIHAN (PO / KONTRAK) */}
                {/* ============================================================== */}
                <div className="space-y-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h3 className="font-bold text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-cyan-600" />
                            2. Dokumen Referensi Tagihan &amp; Realisasi
                        </h3>
                        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                            <button
                                type="button"
                                onClick={() => setReferenceType("PO")}
                                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                                    referenceType === "PO"
                                        ? "bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                }`}
                            >
                                Purchase Order (PO)
                            </button>
                            <button
                                type="button"
                                onClick={() => setReferenceType("CONTRACT")}
                                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                                    referenceType === "CONTRACT"
                                        ? "bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                }`}
                            >
                                Kontrak Sewa / Payung
                            </button>
                        </div>
                    </div>

                    {/* Jika Referensi: Purchase Order */}
                    {referenceType === "PO" && (
                        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-2 space-y-1">
                                    <Label htmlFor="poNumberInput" className="font-semibold text-xs">
                                        Nomor Purchase Order (PO) SAP *
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="poNumberInput"
                                            value={poNumber}
                                            onChange={(e) => setPoNumber(e.target.value)}
                                            placeholder="Contoh: 8210010575 / 4500096001 / 8220025198"
                                            className="font-mono text-xs h-9 bg-white dark:bg-slate-900"
                                            required={referenceType === "PO"}
                                        />
                                        <Button
                                            type="button"
                                            onClick={handleCheckSapPo}
                                            disabled={isCheckingPo || !poNumber.trim()}
                                            className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-9 px-3 shrink-0"
                                        >
                                            {isCheckingPo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1" />}
                                            Cek SAP PO
                                        </Button>
                                    </div>
                                    <span className="text-[10px] text-slate-400">
                                        Sistem akan memeriksa item, harga satuan, kuantitas GR, dan riwayat penagihan SAP.
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <Label className="font-semibold text-xs">Status Realisasi PO</Label>
                                    <div className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between">
                                        <span className="text-xs font-semibold capitalize">{calculatedPoStatus}</span>
                                        <Badge
                                            variant="outline"
                                            className={
                                                calculatedPoStatus === "completed"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                                    : calculatedPoStatus === "partial"
                                                    ? "bg-amber-50 text-amber-700 border-amber-300"
                                                    : "bg-blue-50 text-blue-700 border-blue-300"
                                            }
                                        >
                                            {calculatedPoStatus === "completed"
                                                ? "Completed"
                                                : calculatedPoStatus === "partial"
                                                ? "Partial"
                                                : "Open"}
                                        </Badge>
                                    </div>
                                    <span className="text-[10px] text-slate-400">
                                        {calculatedPoStatus === "completed"
                                            ? "Seluruh item PO telah di-invoice penuh"
                                            : "Sebagian item/kuantitas masih tersisa"}
                                    </span>
                                </div>
                            </div>

                            {/* Hasil Lookup PO SAP */}
                            {poLookupResult && (
                                <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                                PO Ditemukan di SAP ({poLookupResult.vendorName})
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-emerald-600">
                                            Total Net: {formatCurrency(poLookupResult.netValue)}
                                        </span>
                                    </div>

                                    {/* Item Counter Slider / Input (Memenuhi aturan: jika 5 item baru ter-invoice 4, maka Partial) */}
                                    <div className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 rounded-lg space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-cyan-950 dark:text-cyan-200 flex items-center gap-1.5">
                                                <Package className="w-4 h-4 text-cyan-600" />
                                                Realisasi Item yang Ditagihkan pada Invoice Ini:
                                            </span>
                                            <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                                                {invoicedItemsCount} dari {totalPoItemsCount} Item
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                            <div className="flex items-center gap-2">
                                                <Label htmlFor="itemCountInput" className="text-[11px] text-slate-600 shrink-0">
                                                    Jumlah Item Ditagih:
                                                </Label>
                                                <Input
                                                    id="itemCountInput"
                                                    type="number"
                                                    min={1}
                                                    max={totalPoItemsCount}
                                                    value={invoicedItemsCount}
                                                    onChange={(e) => setInvoicedItemsCount(Math.min(totalPoItemsCount, Math.max(1, Number(e.target.value) || 1)))}
                                                    className="w-20 text-xs h-8 bg-white dark:bg-slate-900 text-center font-bold"
                                                />
                                                <span className="text-[11px] text-slate-500">/ {totalPoItemsCount} total item</span>
                                            </div>

                                            <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                                Status Realisasi:{" "}
                                                <strong className={calculatedPoStatus === "completed" ? "text-emerald-600" : "text-amber-600"}>
                                                    {calculatedPoStatus === "completed"
                                                        ? "Completed (100% Full Tagihan)"
                                                        : `Partial (${invoicedItemsCount}/${totalPoItemsCount} item ter-invoice)`}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Preview Daftar Item Material PO */}
                                    {poLookupResult.items && poLookupResult.items.length > 0 && (
                                        <div className="max-h-40 overflow-y-auto border rounded divide-y divide-slate-100 text-[11px]">
                                            {poLookupResult.items.map((it: any, i: number) => (
                                                <div key={i} className="p-2 flex items-center justify-between">
                                                    <div>
                                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                            {it.shortText} ({it.material})
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 block">
                                                            Qty PO: {it.poQuantity} {it.oun} &bull; Qty GR SAP: {it.grQuantity} {it.oun}
                                                        </span>
                                                    </div>
                                                    <span className="font-mono text-slate-700 dark:text-slate-300">
                                                        {formatCurrency(it.netValue)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Jika Referensi: Kontrak Sewa / Payung */}
                    {referenceType === "CONTRACT" && (
                        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-2 space-y-1">
                                    <Label htmlFor="contractNumberInput" className="font-semibold text-xs">
                                        Nomor Kontrak Perjanjian Sewa / Kerja Sama *
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="contractNumberInput"
                                            value={contractNumber}
                                            onChange={(e) => setContractNumber(e.target.value)}
                                            placeholder="Contoh: 001/TRIMICEL-CP/SEWA/X/2025"
                                            className="font-mono text-xs h-9 bg-white dark:bg-slate-900"
                                            required={referenceType === "CONTRACT"}
                                        />
                                        <Button
                                            type="button"
                                            onClick={handleCheckContract}
                                            disabled={isCheckingContract || !contractNumber.trim()}
                                            className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-9 px-3 shrink-0"
                                        >
                                            {isCheckingContract ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1" />}
                                            Cek Kontrak
                                        </Button>
                                    </div>
                                    <span className="text-[10px] text-slate-400">
                                        Sistem memverifikasi nama vendor, unit barang/kendaraan, harga sewa bulanan, dan masa berlaku kontrak.
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <Label className="font-semibold text-xs">Term of Payment (TOP)</Label>
                                    <Input
                                        type="number"
                                        value={topDays}
                                        readOnly
                                        className="text-xs h-9 bg-slate-100 font-bold text-cyan-800 cursor-not-allowed"
                                    />
                                    <span className="text-[10px] text-slate-400">Hari kalender sesuai pasal kontrak</span>
                                </div>
                            </div>

                            {/* Ringkasan Detail Kontrak & Realisasi Pagu (Burn Rate) */}
                            {contractLookupResult && (
                                <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                                {contractLookupResult.title}
                                            </span>
                                            {contractLookupResult.projectCategory === "sipil" && (
                                                <Badge className="bg-amber-100 text-amber-900 text-[9px] border-amber-300">
                                                    Pekerjaan Sipil (Retensi 5%)
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="font-bold text-xs text-emerald-600">
                                            {formatCurrency(contractLookupResult.contractValue)} / Bulan
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                        <div>
                                            Unit: <strong>{contractLookupResult.itemName}</strong> ({contractLookupResult.itemDetails?.policeNumber || "-"})
                                        </div>
                                        <div>
                                            Masa Berlaku: <strong>{contractLookupResult.startDate} s.d {contractLookupResult.endDate}</strong>
                                        </div>
                                        <div>
                                            Lokasi Unit: <strong>{contractLookupResult.itemDetails?.location || "Site Project"}</strong>
                                        </div>
                                        <div>
                                            Rekening: <strong>{contractLookupResult.bankName} - {contractLookupResult.bankAccountNumber}</strong>
                                        </div>
                                    </div>

                                    {/* Pemantauan Realisasi & Sisa Pagu Kontrak */}
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-md border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-500 font-semibold">Realisasi Serapan Kontrak:</span>
                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                                {formatCurrency(contractLookupResult.totalInvoiced || 0)} / {formatCurrency(contractLookupResult.contractValue || 0)}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    (contractLookupResult.burnRatePercent || 0) > 90 ? "bg-red-500" : "bg-cyan-600"
                                                }`}
                                                style={{ width: `${Math.min(100, contractLookupResult.burnRatePercent || 0)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-400">
                                                Burn Rate: <strong>{(contractLookupResult.burnRatePercent || 0).toFixed(1)}%</strong>
                                            </span>
                                            <span className="text-emerald-700 font-semibold">
                                                Sisa Pagu: {formatCurrency(contractLookupResult.remainingBalance || contractLookupResult.contractValue || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ============================================================== */}
                {/* SECTION 3: RINCIAN NILAI INVOICE & PERPAJAKAN */}
                {/* ============================================================== */}
                <div className="space-y-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-cyan-600" />
                        3. Rincian Tagihan &amp; Kalkulasi Pajak
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="invNum" className="font-semibold text-xs">
                                Nomor Invoice Tagihan Fisik *
                            </Label>
                            <Input
                                id="invNum"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                placeholder="Contoh: INV/2026/XI/001"
                                className="font-mono text-xs h-9 bg-slate-50 dark:bg-slate-800/60"
                                required
                            />
                            <span className="text-[10px] text-slate-400">Harus sesuai fisik kwitansi/invoice</span>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="invDate" className="font-semibold text-xs">
                                Tanggal Invoice *
                            </Label>
                            <Input
                                id="invDate"
                                type="date"
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                                className="text-xs h-9 bg-slate-50 dark:bg-slate-800/60"
                                required
                            />
                            <span className="text-[10px] text-slate-400">Tanggal cetak pada dokumen vendor</span>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="subtotalInput" className="font-semibold text-xs">
                                Sub-Total (DPP) Rupiah *
                            </Label>
                            <Input
                                id="subtotalInput"
                                type="number"
                                min={0}
                                step="any"
                                value={subtotal || ""}
                                onChange={(e) => setSubtotal(Number(e.target.value) || 0)}
                                placeholder="0"
                                className="text-xs h-9 font-bold bg-slate-50 dark:bg-slate-800/60"
                                required
                            />
                            <span className="text-[10px] text-slate-400">Dasar Pengenaan Pajak (DPP)</span>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="topDaysInput" className="font-semibold text-xs">
                                Term of Payment (TOP)
                            </Label>
                            <Input
                                id="topDaysInput"
                                type="number"
                                value={topDays}
                                readOnly
                                className="text-xs h-9 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold cursor-not-allowed"
                            />
                            <span className="text-[10px] text-slate-400">Read-Only dari Master Vendor SAP</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="ppnInput" className="font-semibold text-xs">
                                Tarif PPN (%)
                            </Label>
                            <Input
                                id="ppnInput"
                                type="number"
                                min={0}
                                max={100}
                                value={ppnPercent}
                                onChange={(e) => setPpnPercent(Number(e.target.value) || 0)}
                                className="text-xs h-9 bg-slate-50 dark:bg-slate-800/60"
                            />
                            <span className="text-[10px] text-slate-400">
                                {selectedVendor?.isPkp !== false ? "Default 11% (Vendor PKP)" : "0% (Vendor Non-PKP)"}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="pphInput" className="font-semibold text-xs">
                                Tarif PPh (%)
                            </Label>
                            <Input
                                id="pphInput"
                                type="number"
                                min={0}
                                max={100}
                                value={pphPercent}
                                onChange={(e) => setPphPercent(Number(e.target.value) || 0)}
                                className="text-xs h-9 bg-slate-50 dark:bg-slate-800/60"
                            />
                            <span className="text-[10px] text-slate-400">Contoh: PPh 23 = 2% (Sewa/Jasa)</span>
                        </div>

                        {/* Real-time Calculation Card */}
                        <div className="md:col-span-2 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <span className="text-[11px] text-slate-500 block">Grand Total Tagihan:</span>
                                <span className="text-base font-extrabold text-cyan-700 dark:text-cyan-300">
                                    {formatCurrency(totals.grandTotal)}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                    PPN (+{formatCurrency(totals.ppnAmount)}) &bull; PPh (-{formatCurrency(totals.pphAmount)})
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-slate-400 block">Estimasi Jatuh Tempo:</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {dueDateEstimate || "-"}
                                </span>
                                <span className="text-[10px] text-cyan-600 block">TOP: {topDays} Hari Kalender</span>
                            </div>
                        </div>
                    </div>

                    {/* Enterprise P2P Additions: Retensi Pekerjaan Sipil, Potongan Uang Muka (DP), dan CoreTax */}
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-amber-600" />
                                Ketentuan Khusus Enterprise P2P (Retensi Sipil &amp; Kliring DP)
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-900 border-amber-300">
                                Tata Kelola Procurement
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="projCat" className="text-xs font-semibold">
                                    Kategori Pekerjaan *
                                </Label>
                                <select
                                    id="projCat"
                                    value={projectCategory}
                                    onChange={(e) => {
                                        const val = e.target.value as "general" | "sipil"
                                        setProjectCategory(val)
                                        if (val === "sipil") {
                                            setRetentionPercent(5)
                                        } else {
                                            setRetentionPercent(0)
                                        }
                                    }}
                                    className="w-full text-xs h-9 rounded-md border border-slate-200 bg-white dark:bg-slate-900 px-3"
                                >
                                    <option value="general">Umum / Sewa Armada / Pengadaan</option>
                                    <option value="sipil">Pekerjaan Sipil / Konstruksi (Retensi 5%)</option>
                                </select>
                                <span className="text-[10px] text-slate-400">
                                    {projectCategory === "sipil" ? "Otomatis potong retensi pemeliharaan 5%" : "Standar tanpa retensi"}
                                </span>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="retPercent" className="text-xs font-semibold">
                                    Retensi Pemeliharaan (%)
                                </Label>
                                <Input
                                    id="retPercent"
                                    type="number"
                                    min={0}
                                    max={20}
                                    step="0.5"
                                    value={retentionPercent}
                                    onChange={(e) => setRetentionPercent(Number(e.target.value) || 0)}
                                    className="text-xs h-9 bg-white dark:bg-slate-900"
                                />
                                <span className="text-[10px] text-amber-700 font-semibold block">
                                    Nilai Retensi: -{formatCurrency(retentionAmount)}
                                </span>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="dpDeduct" className="text-xs font-semibold">
                                    Potongan Uang Muka (DP)
                                </Label>
                                <Input
                                    id="dpDeduct"
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={dpDeduction || ""}
                                    onChange={(e) => setDpDeduction(Number(e.target.value) || 0)}
                                    placeholder="0"
                                    className="text-xs h-9 bg-white dark:bg-slate-900"
                                />
                                <span className="text-[10px] text-slate-400">Kliring DP yang sudah dibayar</span>
                            </div>

                            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-amber-300 dark:border-amber-800 space-y-1">
                                <span className="text-[10px] text-slate-500 block uppercase font-bold">
                                    Net Payable (Dibayarkan):
                                </span>
                                <span className="text-lg font-black text-emerald-600 block">
                                    {formatCurrency(netPayable)}
                                </span>
                                <span className="text-[9px] text-slate-400 block">
                                    Grand Total dikurangi DP &amp; Retensi
                                </span>
                            </div>
                        </div>

                        {/* DJP QR e-Faktur & CoreTax 16 Digit */}
                        <div className="pt-2 border-t border-amber-200 dark:border-amber-900/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="taxQr" className="text-xs font-semibold flex items-center gap-1.5">
                                    <span>Link / URL QR Code e-Faktur DJP</span>
                                    <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                                        CoreTax Ready
                                    </Badge>
                                </Label>
                                <Input
                                    id="taxQr"
                                    placeholder="https://efaktur.pajak.go.id/faktur-validasi?kd=..."
                                    value={taxQrUrl}
                                    onChange={(e) => setTaxQrUrl(e.target.value)}
                                    className="text-xs h-9 bg-white dark:bg-slate-900"
                                />
                                <span className="text-[10px] text-slate-400">
                                    Scan QR faktur fisik untuk validasi otomatis dengan DJP
                                </span>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="npwp16" className="text-xs font-semibold">
                                    NPWP 16 Digit Vendor (NIK / CoreTax)
                                </Label>
                                <Input
                                    id="npwp16"
                                    placeholder="Contoh: 0123456789012345"
                                    maxLength={20}
                                    value={vendorNpwp16}
                                    onChange={(e) => setVendorNpwp16(e.target.value)}
                                    className="text-xs h-9 bg-white dark:bg-slate-900 font-mono"
                                />
                                <span className="text-[10px] text-slate-400">
                                    Format identitas perpajakan 16 digit CoreTax
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                        {/* ACTION BAR TAB 1 */}
                        <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-slate-800">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onBack}
                                className="text-xs h-9 px-5 rounded-xl"
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    if (!selectedVendor) {
                                        setFormError("Pilih mitra rekanan vendor terlebih dahulu.")
                                        return
                                    }
                                    if (!invoiceNumber.trim()) {
                                        setFormError("Nomor invoice tagihan fisik wajib diisi.")
                                        return
                                    }
                                    if (referenceType === "PO" && !poNumber.trim()) {
                                        setFormError("Nomor PO SAP wajib diisi.")
                                        return
                                    }
                                    if (referenceType === "CONTRACT" && !contractNumber.trim()) {
                                        setFormError("Nomor Kontrak Sewa wajib diisi.")
                                        return
                                    }
                                    if (subtotal <= 0) {
                                        setFormError("Nominal Subtotal (DPP) harus lebih besar dari Rp 0.")
                                        return
                                    }
                                    setFormError(null)
                                    setActiveTab("documents")
                                }}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs h-9 px-6 rounded-xl shadow-xs flex items-center gap-1.5"
                            >
                                <span>Lanjut ke Tab 2: Lampiran Dokumen</span>
                                <span>&gt;</span>
                            </Button>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 2: UNGGAH BUNDEL DOKUMEN FAKTUR & LAMPIRAN (ALL-IN-ONE)    */}
                {/* ============================================================== */}
                {activeTab === "documents" && (
                    <div className="space-y-6">
                        {/* Info Header */}
                        <div className="p-4 bg-gradient-to-r from-cyan-50 via-sky-50 to-blue-50 dark:from-cyan-950/30 dark:via-sky-950/20 dark:to-blue-950/30 border border-cyan-200 dark:border-cyan-800 rounded-2xl">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-cyan-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-cyan-950 dark:text-cyan-100 flex items-center gap-2">
                                        Pemindaian Berkas Tunggal Cerdas (All-in-One Multi-Page Scan)
                                    </h3>
                                    <p className="text-xs text-cyan-800/90 dark:text-cyan-300/90 mt-1 leading-relaxed">
                                        Sistem AI OCR secara otomatis membaca <strong>seluruh halaman berkas PDF</strong> (halaman 1 s/d lampiran belakang).
                                        Anda <strong>tidak perlu memisahkan berkas secara manual</strong> &mdash; cukup unggah 1 bundel PDF lengkap, sistem akan memilah dan memvalidasi otomatis: <em>Invoice Fisik, Bukti Surat Jalan / BAST, Slip PO/GR SAP, dan Faktur Pajak DJP</em>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Kotak Unggah Utama: Single PDF Bundle */}
                        <div className="p-6 bg-white dark:bg-slate-900 border-2 border-dashed border-cyan-300 dark:border-cyan-700 hover:border-cyan-500 dark:hover:border-cyan-500 rounded-3xl transition-all shadow-xs">
                            <div className="max-w-xl mx-auto text-center space-y-4">
                                <div className="w-16 h-16 rounded-2xl bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 flex items-center justify-center mx-auto shadow-inner">
                                    <UploadCloud className="w-8 h-8" />
                                </div>

                                <div>
                                    <Label className="text-base font-bold text-slate-800 dark:text-slate-100 block">
                                        Unggah Bundel Dokumen Faktur (Single PDF) *
                                    </Label>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Pilih berkas PDF lengkap yang berisi dokumen faktur beserta seluruh lampirannya
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <input
                                        id="bundleUploadInput"
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                                        className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700 file:cursor-pointer cursor-pointer border border-slate-200 dark:border-slate-800 rounded-2xl p-2 bg-slate-50 dark:bg-slate-800/40"
                                    />
                                </div>

                                {/* Preview & Info Berkas Terpilih */}
                                {invoiceFile ? (
                                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-left flex items-start justify-between gap-3 animate-in fade-in">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0 mt-0.5">
                                                <FileCheck className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <span className="font-bold text-xs text-emerald-950 dark:text-emerald-100 block truncate max-w-sm">
                                                    {invoiceFile.name}
                                                </span>
                                                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                                    Ukuran: {(invoiceFile.size / 1024 / 1024).toFixed(2)} MB &bull; Siap diproses multi-halaman
                                                </span>
                                            </div>
                                        </div>
                                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] shrink-0">
                                            Bundel Siap
                                        </Badge>
                                    </div>
                                ) : (
                                    <span className="text-[11px] text-slate-400 block italic">
                                        Format berkas disarankan: .PDF multi-halaman (atau gambar scan beresolusi tinggi).
                                    </span>
                                )}

                                {/* Rincian Otomatisasi AI OCR */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-left">
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 block">1. Invoice Fisik</span>
                                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">Nomor, tanggal, DPP &amp; pajak di halaman depan</span>
                                    </div>
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 block">2. DO / BAST</span>
                                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">Surat jalan &amp; serah terima di lampiran tengah</span>
                                    </div>
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 block">3. PO / GR SAP</span>
                                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">Slip PO 10 digit &amp; nomor GR di lampiran belakang</span>
                                    </div>
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 block">4. e-Faktur Pajak</span>
                                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">NSFP 16 digit &amp; validasi barcode DJP</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Collapsible: Opsi Tambahan Pisahkan Berkas Manual (Jika user punya berkas pecahan) */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/60 dark:bg-slate-800/30">
                            <button
                                type="button"
                                onClick={() => setShowSeparateUploads(!showSeparateUploads)}
                                className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-cyan-600 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-cyan-600" />
                                    Opsi Tambahan: Lampirkan Berkas Terpisah Secara Manual (Opsional)
                                </span>
                                {showSeparateUploads ? (
                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                            </button>

                            {showSeparateUploads && (
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                                    {/* 1. PO / Kontrak */}
                                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                                            Salinan PO / Kontrak Payung Terpisah
                                        </Label>
                                        <input
                                            type="file"
                                            accept=".pdf,image/*"
                                            onChange={(e) => setContractPdfFile(e.target.files?.[0] || null)}
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                                        />
                                    </div>

                                    {/* 2. DO / BAST */}
                                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                                            Surat Jalan (DO) / BAST Terpisah
                                        </Label>
                                        <input
                                            type="file"
                                            accept=".pdf,image/*"
                                            onChange={(e) => setDeliveryReceiptFile(e.target.files?.[0] || null)}
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                                        />
                                    </div>

                                    {/* 3. GR Slip */}
                                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                                            Slip Goods Receipt (GR) SAP Terpisah
                                        </Label>
                                        <input
                                            type="file"
                                            accept=".pdf,image/*"
                                            onChange={(e) => setGrSlipFile(e.target.files?.[0] || null)}
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                                        />
                                    </div>

                                    {/* 4. Faktur Pajak */}
                                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                                            Berkas Faktur Pajak e-Faktur Terpisah
                                        </Label>
                                        <input
                                            type="file"
                                            accept=".pdf,image/*"
                                            onChange={(e) => setTaxInvoiceFile(e.target.files?.[0] || null)}
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ACTION BAR TAB 2 */}
                        <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-slate-800">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setActiveTab("vendor")}
                                className="text-xs h-9 px-5 rounded-xl"
                            >
                                &lt; Kembali ke Data Vendor
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    if (!invoiceFile) {
                                        setFormError("Silakan pilih berkas bundel dokumen faktur (PDF) terlebih dahulu.")
                                        return
                                    }
                                    setFormError(null)
                                    setActiveTab("reconciliation")
                                }}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs h-9 px-6 rounded-xl shadow-xs flex items-center gap-1.5"
                            >
                                <span>Lanjut ke Tab 3: Rekonsiliasi &amp; Simpan</span>
                                <span>&gt;</span>
                            </Button>
                        </div>
                    </div>
                )}

                {/* ============================================================== */}
                {/* TAB 3: REKONSILIASI & KONFIRMASI PENGAJUAN */}
                {/* ============================================================== */}
                {activeTab === "reconciliation" && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="font-bold text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                3. Rekonsiliasi Net Payable &amp; Verifikasi Akhir
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Periksa kembali kelengkapan administrasi dan rincian nominal bersih yang akan dibayarkan ke rekening mitra rekanan.
                            </p>
                        </div>

                        {/* Ringkasan Kartu Vendor & Finansial */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Rekening Tujuan Pencairan */}
                            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 border-b pb-1.5">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    Rekening Bank Pencairan Dana
                                </span>
                                <div className="space-y-1 pt-1">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Penerima:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedVendor?.vendorName || selectedVendor?.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Bank:</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedVendor?.bankName || "BCA"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">No. Rekening:</span>
                                        <span className="font-mono font-bold text-blue-700 dark:text-blue-400">{selectedVendor?.bankAccountNo || "1234567890"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Atas Nama:</span>
                                        <span className="text-slate-700 dark:text-slate-300">{selectedVendor?.bankAccountHolder || selectedVendor?.name}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Ringkasan Rincian Finansial Net Payable */}
                            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 border-b pb-1.5">
                                    <CreditCard className="w-4 h-4 text-emerald-600" />
                                    Rincian Bersih Pembayaran
                                </span>
                                <div className="space-y-1 pt-1 text-slate-600 dark:text-slate-300">
                                    <div className="flex justify-between">
                                        <span>Subtotal DPP:</span>
                                        <span className="font-mono font-semibold">{formatCurrency(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>PPN ({ppnPercent}%):</span>
                                        <span className="font-mono text-emerald-600">+{formatCurrency(totals.ppnAmount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>PPh ({pphPercent}%):</span>
                                        <span className="font-mono text-rose-600">-{formatCurrency(totals.pphAmount)}</span>
                                    </div>
                                    {dpDeduction > 0 && (
                                        <div className="flex justify-between">
                                            <span>Kliring DP:</span>
                                            <span className="font-mono text-amber-600">-{formatCurrency(dpDeduction)}</span>
                                        </div>
                                    )}
                                    {retentionAmount > 0 && (
                                        <div className="flex justify-between">
                                            <span>Retensi Sipil ({retentionPercent}%):</span>
                                            <span className="font-mono text-blue-600">-{formatCurrency(retentionAmount)}</span>
                                        </div>
                                    )}
                                    {penaltyAmount > 0 && (
                                        <div className="flex justify-between">
                                            <span>Potongan Denda:</span>
                                            <span className="font-mono text-rose-600">-{formatCurrency(penaltyAmount)}</span>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t flex justify-between items-center">
                                        <span className="font-bold text-slate-900 dark:text-slate-100">Net Payable:</span>
                                        <span className="text-base font-black text-emerald-600 font-mono">{formatCurrency(netPayable)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Catatan Internal Procurement */}
                        <div className="space-y-1.5">
                            <Label htmlFor="procNotes" className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                                Catatan Internal Procurement (Opsional)
                            </Label>
                            <Textarea
                                id="procNotes"
                                rows={2}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Tambahkan catatan kelengkapan dokumen atau nomor referensi internal jika diperlukan..."
                                className="text-xs bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                            />
                        </div>

                        {/* ACTION BAR TAB 3 (Submit Form) */}
                        <div className="flex items-center justify-between pt-5 border-t border-slate-100 dark:border-slate-800">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setActiveTab("documents")}
                                className="text-xs h-9 px-5 rounded-xl"
                            >
                                &lt; Kembali ke Dokumen
                            </Button>
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onBack}
                                    disabled={isSaving}
                                    className="text-xs h-9 px-5 rounded-xl"
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-8 rounded-xl shadow-md transition-colors flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                            Menyimpan &amp; Menerbitkan...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            Simpan &amp; Terbitkan Invoice
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </div>
    )
}
