"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    getAvailablePosForVendorAction,
    lookupSapPoForVendorAction,
    lookupVendorContractAction,
    submitVendorInvoiceAction,
} from "@/app/actions/vendor-invoices"
import { uploadFile } from "@/app/actions/upload"
import { calculateTaxAndTotals } from "@/lib/vendor-invoice-calculator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
    AlertCircle,
    CheckCircle2,
    CheckCircle,
    FileCheck,
    FileText,
    HelpCircle,
    Loader2,
    Search,
    ShieldAlert,
    Package,
    Clock,
    UploadCloud,
    X,
    ChevronLeft,
    ChevronRight,
    ListChecks,
    ArrowRight,
    DollarSign,
    Layers,
} from "lucide-react"

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(amount)
}

function formatDate(dateStr?: string | null): string {
    if (!dateStr) return "-"
    try {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
    } catch {
        return dateStr
    }
}

export function VendorInvoiceCreateForm({ tenant }: { tenant: any }) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // Tab State: "tab1" | "tab2" | "tab3"
    const [activeTab, setActiveTab] = useState<string>("tab1")

    // Form fields
    const [referenceType, setReferenceType] = useState<"PO" | "CONTRACT">("PO")
    const [invoiceNumber, setInvoiceNumber] = useState("")
    const [poNumber, setPoNumber] = useState("")
    const [contractNumber, setContractNumber] = useState("")
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
    const [subtotal, setSubtotal] = useState<number>(0)
    const [ppnPercent, setPpnPercent] = useState<number>(tenant.isPkp ? 11 : 0)
    const [pphPercent, setPphPercent] = useState<number>(0)
    const [topDays, setTopDays] = useState<number>(tenant.defaultTopDays || 30)

    // Available Active POs (Hanya Non-Completed & Milik Vendor Ini)
    const [availablePos, setAvailablePos] = useState<any[]>([])
    const [isLoadingAvailablePos, setIsLoadingAvailablePos] = useState(false)

    // PO Table Search & Pagination State
    const [poSearchTerm, setPoSearchTerm] = useState("")
    const [poCurrentPage, setPoCurrentPage] = useState(1)
    const poPageSize = 5

    // SAP PO & Contract Lookup state
    const [isCheckingPo, setIsCheckingPo] = useState(false)
    const [poCheckResult, setPoCheckResult] = useState<any>(null)
    const [isCheckingContract, setIsCheckingContract] = useState(false)
    const [contractCheckResult, setContractCheckResult] = useState<any>(null)

    // PO Items Selection (Centang Item yang Akan Di-invoice)
    const [selectedItemIndexes, setSelectedItemIndexes] = useState<number[]>([])

    // File attachments (Urutan 1..5: PO/Kontrak -> DO/BAST -> GR Slip -> Invoice -> Faktur Pajak)
    const [contractFile, setContractFile] = useState<File | null>(null)
    const [poFile, setPoFile] = useState<File | null>(null)
    const [deliveryReceiptFile, setDeliveryReceiptFile] = useState<File | null>(null)
    const [grSlipFile, setGrSlipFile] = useState<File | null>(null)
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
    const [taxInvoiceFile, setTaxInvoiceFile] = useState<File | null>(null)

    // Calculated amounts
    const { ppnAmount, pphAmount, grandTotal } = calculateTaxAndTotals({
        subtotal,
        ppnPercent,
        pphPercent,
    })

    // Load available active POs on mount or when referenceType changes
    React.useEffect(() => {
        if (referenceType === "PO" && tenant?.id) {
            setIsLoadingAvailablePos(true)
            getAvailablePosForVendorAction(tenant.id)
                .then((pos) => {
                    setAvailablePos(pos)
                })
                .catch((err) => {
                    console.error("Gagal memuat PO aktif vendor:", err)
                })
                .finally(() => {
                    setIsLoadingAvailablePos(false)
                })
        }
    }, [referenceType, tenant?.id])

    // Inisialisasi pilihan item saat PO dipilih / dicek
    const initSelectedItemIndexes = (items: any[]) => {
        if (!items || items.length === 0) {
            setSelectedItemIndexes([])
            return
        }
        // Default: centang semua item yang BELUM di-invoice sebelumnya
        const activeIndexes: number[] = []
        let totalActiveVal = 0
        items.forEach((item, idx) => {
            if (!item.isInvoiced) {
                activeIndexes.push(idx)
                totalActiveVal += Number(item.netValue) || 0
            }
        })
        setSelectedItemIndexes(activeIndexes)
        setSubtotal(totalActiveVal)
    }

    // Memilih PO dari daftar tabel PO aktif
    const handleSelectAvailablePo = (po: any) => {
        setPoNumber(po.poNumber)
        setPoCheckResult({
            found: true,
            poNumber: po.poNumber,
            vendorName: po.vendorName,
            netValue: po.remainingValue || po.netValue,
            totalNetValue: po.netValue,
            poStatus: po.poStatus,
            poDate: po.poDate,
            totalItems: po.totalItems || po.items?.length || 1,
            invoicedItems: po.invoicedItems || 0,
            items: po.items || [],
            materialSummary: po.materialSummary,
        })
        initSelectedItemIndexes(po.items || [])
    }

    // Toggle centang item individual
    const handleToggleItem = (index: number) => {
        const items = poCheckResult?.items || []
        const item = items[index]
        if (!item || item.isInvoiced) return

        let nextSelected: number[]
        if (selectedItemIndexes.includes(index)) {
            nextSelected = selectedItemIndexes.filter((i) => i !== index)
        } else {
            nextSelected = [...selectedItemIndexes, index].sort((a, b) => a - b)
        }
        setSelectedItemIndexes(nextSelected)

        // Otomatis sinkronisasi subtotal DPP
        const sumVal = nextSelected.reduce((sum, idx) => sum + (Number(items[idx]?.netValue) || 0), 0)
        setSubtotal(sumVal)
    }

    // Centang semua item yang belum di-invoice
    const handleSelectAllItems = () => {
        const items = poCheckResult?.items || []
        const available = items
            .map((it: any, idx: number) => (!it.isInvoiced ? idx : null))
            .filter((idx: any): idx is number => idx !== null)

        setSelectedItemIndexes(available)
        const sumVal = available.reduce((sum, idx) => sum + (Number(items[idx]?.netValue) || 0), 0)
        setSubtotal(sumVal)
    }

    // Batalkan seluruh centang item
    const handleDeselectAllItems = () => {
        setSelectedItemIndexes([])
        setSubtotal(0)
    }

    // PO check handler dengan validasi multi-tenant & status non-completed
    const handleCheckPo = async (overridePoNumber?: string) => {
        const poToSearch = overridePoNumber || poNumber
        if (!poToSearch.trim()) return
        setIsCheckingPo(true)
        setPoCheckResult(null)
        setSelectedItemIndexes([])

        try {
            const res = await lookupSapPoForVendorAction(poToSearch, tenant.id)
            setPoCheckResult(res)
            if (res.found && res.items && res.items.length > 0) {
                initSelectedItemIndexes(res.items)
            } else if (res.found && res.netValue) {
                setSubtotal(res.netValue)
            }
        } catch {
            setPoCheckResult({ found: false, message: "Gagal memeriksa ke database SAP." })
        } finally {
            setIsCheckingPo(false)
        }
    }

    // Contract check handler
    const handleCheckContract = async () => {
        if (!contractNumber.trim()) return
        setIsCheckingContract(true)
        setContractCheckResult(null)

        try {
            const res = await lookupVendorContractAction(contractNumber)
            setContractCheckResult(res)
            if (res.found && res.contract) {
                if (subtotal === 0 && res.contract.contractValue) {
                    setSubtotal(Number(res.contract.contractValue) || 0)
                }
                if (res.contract.ppnPercent !== undefined) {
                    setPpnPercent(Number(res.contract.ppnPercent) || 11)
                }
                if (res.contract.pphPercent !== undefined) {
                    setPphPercent(Number(res.contract.pphPercent) || 2)
                }
                if (res.contract.topDays) {
                    setTopDays(Number(res.contract.topDays) || 45)
                }
            }
        } catch {
            setContractCheckResult({ found: false, message: "Gagal memeriksa kontrak ke sistem." })
        } finally {
            setIsCheckingContract(false)
        }
    }

    // Filter & Pagination PO Aktif
    const filteredPos = useMemo(() => {
        if (!poSearchTerm.trim()) return availablePos
        const term = poSearchTerm.toLowerCase()
        return availablePos.filter(
            (p) =>
                p.poNumber.toLowerCase().includes(term) ||
                (p.materialSummary && p.materialSummary.toLowerCase().includes(term)) ||
                (p.poStatus && p.poStatus.toLowerCase().includes(term))
        )
    }, [availablePos, poSearchTerm])

    const totalPoPages = Math.max(1, Math.ceil(filteredPos.length / poPageSize))
    const paginatedPos = useMemo(() => {
        const start = (poCurrentPage - 1) * poPageSize
        return filteredPos.slice(start, start + poPageSize)
    }, [filteredPos, poCurrentPage])

    // Hitung proyeksi status PO berdasarkan pilihan item saat ini
    const poItemsList = poCheckResult?.items || []
    const totalItemsInPo = poCheckResult?.totalItems || poItemsList.length || 1
    const prevInvoicedCount = poCheckResult?.invoicedItems || poItemsList.filter((it: any) => it.isInvoiced).length || 0
    const availableItemsToInvoice = poItemsList.filter((it: any) => !it.isInvoiced)
    const newlySelectedCount = selectedItemIndexes.length
    const nextCalculatedPoStatus: "completed" | "partial" =
        poItemsList.length > 0 && prevInvoicedCount + newlySelectedCount >= totalItemsInPo
            ? "completed"
            : "partial"

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMessage(null)

        if (!invoiceNumber.trim()) {
            setErrorMessage("Nomor Invoice wajib diisi di Tab 1.")
            setActiveTab("tab1")
            return
        }

        if (referenceType === "PO") {
            if (!poNumber.trim()) {
                setErrorMessage("Nomor Purchase Order (PO) wajib diisi di Tab 1.")
                setActiveTab("tab1")
                return
            }

            // Jika belum ada check result atau PO berubah, validasi ulang
            let activeCheck = poCheckResult
            if (!activeCheck || activeCheck.poNumber !== poNumber.trim()) {
                const checked = await lookupSapPoForVendorAction(poNumber.trim(), tenant.id)
                setPoCheckResult(checked)
                activeCheck = checked
            }

            if (!activeCheck.found) {
                setErrorMessage(activeCheck.message || "Nomor PO tidak valid atau tidak dapat ditagihkan.")
                setActiveTab("tab1")
                return
            }
            if (activeCheck.isWrongVendor) {
                setErrorMessage(activeCheck.message || "PO ini diterbitkan untuk rekanan lain.")
                setActiveTab("tab1")
                return
            }
            if (activeCheck.isCompleted) {
                setErrorMessage(activeCheck.message || "PO ini telah selesai ditagihkan penuh (COMPLETED).")
                setActiveTab("tab1")
                return
            }

            // Validasi centang minimal 1 item jika PO memiliki rincian item
            if (activeCheck.items && activeCheck.items.length > 0 && selectedItemIndexes.length === 0) {
                setErrorMessage("Pilih minimal 1 item barang/jasa dari tabel PO yang akan ditagihkan pada invoice ini (Tab 1).")
                setActiveTab("tab1")
                return
            }
        }

        if (referenceType === "CONTRACT" && !contractNumber.trim()) {
            setErrorMessage("Nomor Kontrak Perjanjian wajib diisi di Tab 1.")
            setActiveTab("tab1")
            return
        }

        if (subtotal <= 0) {
            setErrorMessage("Subtotal nominal invoice harus lebih besar dari 0 (Periksa Tab 2).")
            setActiveTab("tab2")
            return
        }

        if (!invoiceFile) {
            setErrorMessage("Berkas PDF/Scan Invoice fisik asli wajib diunggah di Tab 3.")
            setActiveTab("tab3")
            return
        }

        if (!grSlipFile && !deliveryReceiptFile) {
            setErrorMessage("Wajib melampirkan minimal salah satu bukti penerimaan di Tab 3: GR Slip atau Surat Jalan / BAST / Rekap Absen.")
            setActiveTab("tab3")
            return
        }

        if ((tenant.isPkp || ppnPercent > 0) && !taxInvoiceFile) {
            setErrorMessage("Vendor PKP wajib melampirkan berkas e-Faktur Pajak di Tab 3.")
            setActiveTab("tab3")
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

            // 2. Upload GR Slip File if provided
            let uploadGrUrl: string | undefined = undefined
            if (grSlipFile) {
                const grFormData = new FormData()
                grFormData.append("file", grSlipFile)
                const uploadGrRes = await uploadFile(grFormData)
                if (uploadGrRes.success && uploadGrRes.url) {
                    uploadGrUrl = uploadGrRes.url
                }
            }

            // 3. Upload Surat Jalan / BAST / Absen if provided
            let uploadDelivUrl: string | undefined = undefined
            if (deliveryReceiptFile) {
                const delivFormData = new FormData()
                delivFormData.append("file", deliveryReceiptFile)
                const uploadDelivRes = await uploadFile(delivFormData)
                if (uploadDelivRes.success && uploadDelivRes.url) {
                    uploadDelivUrl = uploadDelivRes.url
                }
            }

            // 4. Upload e-Faktur Pajak
            let taxInvoiceUrl: string | undefined = undefined
            if (taxInvoiceFile) {
                const taxFormData = new FormData()
                taxFormData.append("file", taxInvoiceFile)
                const uploadTaxRes = await uploadFile(taxFormData)
                if (uploadTaxRes.success && uploadTaxRes.url) {
                    taxInvoiceUrl = uploadTaxRes.url
                }
            }

            // 5. Upload PO / Contract File
            let poUrl: string | undefined = undefined
            if (poFile) {
                const poFormData = new FormData()
                poFormData.append("file", poFile)
                const uploadPoRes = await uploadFile(poFormData)
                if (uploadPoRes.success && uploadPoRes.url) {
                    poUrl = uploadPoRes.url
                }
            }

            let contractFileUrl: string | undefined = undefined
            if (contractFile) {
                const cFormData = new FormData()
                cFormData.append("file", contractFile)
                const uploadCRes = await uploadFile(cFormData)
                if (uploadCRes.success && uploadCRes.url) {
                    contractFileUrl = uploadCRes.url
                }
            }

            // 6. Submit to database action dengan kalkulasi item & status PO akurat
            const res = await submitVendorInvoiceAction({
                tenantId: tenant.id,
                invoiceNumber,
                poNumber: referenceType === "PO" ? poNumber : `KONTRAK:${contractNumber}`,
                referenceType,
                contractNumber: referenceType === "CONTRACT" ? contractNumber : undefined,
                contractFileUrl,
                poStatus: referenceType === "PO" ? nextCalculatedPoStatus : "open",
                invoicedItemsCount: newlySelectedCount || 1,
                totalPoItemsCount: totalItemsInPo,
                invoiceDate,
                subtotal,
                ppnPercent,
                pphPercent,
                currency: poCheckResult?.currency || tenant.sapCurrency || "IDR",
                invoiceFileUrl: uploadInvoiceRes.url,
                grSlipFileUrl: uploadGrUrl,
                deliveryReceiptFileUrl: uploadDelivUrl,
                taxInvoiceFileUrl: taxInvoiceUrl,
                poFileUrl: poUrl,
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
        <form onSubmit={handleSubmit} className="w-full space-y-4">
            {errorMessage && (
                <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* TAB CONTAINER VIEW FULL WIDE */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
                <TabsList className="grid grid-cols-3 w-full h-auto p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <TabsTrigger
                        value="tab1"
                        className="flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-700 dark:data-[state=active]:text-cyan-400 data-[state=active]:shadow-sm transition-all"
                    >
                        <div className="flex items-center justify-center size-6 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 text-xs font-bold shrink-0">
                            1
                        </div>
                        <span className="truncate">1. Informasi &amp; Dokumen Referensi</span>
                        {(poNumber || contractNumber) && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 hidden md:inline" />
                        )}
                    </TabsTrigger>

                    <TabsTrigger
                        value="tab2"
                        className="flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-700 dark:data-[state=active]:text-cyan-400 data-[state=active]:shadow-sm transition-all"
                    >
                        <div className="flex items-center justify-center size-6 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 text-xs font-bold shrink-0">
                            2
                        </div>
                        <span className="truncate">2. Rincian Nominal, Pajak &amp; TOP</span>
                        {subtotal > 0 && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 hidden md:inline" />
                        )}
                    </TabsTrigger>

                    <TabsTrigger
                        value="tab3"
                        className="flex items-center justify-center gap-2 py-3 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-cyan-700 dark:data-[state=active]:text-cyan-400 data-[state=active]:shadow-sm transition-all"
                    >
                        <div className="flex items-center justify-center size-6 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 text-xs font-bold shrink-0">
                            3
                        </div>
                        <span className="truncate">3. Dokumen Lampiran Penagihan</span>
                        {invoiceFile && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 hidden md:inline" />
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ========================================================= */}
                {/* TAB 1: INFORMASI INVOICE & DOKUMEN REFERENSI (PO / KONTRAK) */}
                {/* ========================================================= */}
                <TabsContent value="tab1" className="space-y-4 focus-visible:outline-none">
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800 w-full">
                        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                            <CardTitle className="text-base font-semibold flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-cyan-600" />
                                    <span>1. Informasi Invoice &amp; Dokumen Referensi (PO / Kontrak)</span>
                                </div>
                                <span className="text-xs font-normal text-slate-400">
                                    Langkah 1 dari 3
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            {/* Data Nomor & Tanggal Invoice */}
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

                            {/* Toggle Jenis Dokumen Referensi */}
                            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                <Label className="text-xs font-semibold block">Jenis Dokumen Referensi Tagihan *</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setReferenceType("PO")}
                                        className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                                            referenceType === "PO"
                                                ? "border-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 font-bold shadow-xs"
                                                : "border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileCheck className="w-4 h-4" />
                                            <span>Purchase Order (PO)</span>
                                        </div>
                                        {referenceType === "PO" && <CheckCircle2 className="w-4 h-4 text-cyan-600" />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setReferenceType("CONTRACT")}
                                        className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition-all ${
                                            referenceType === "CONTRACT"
                                                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs"
                                                : "border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            <span>Kontrak Payung / Sewa</span>
                                        </div>
                                        {referenceType === "CONTRACT" && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                                    </button>
                                </div>

                                {/* PO Section: Data Tabel PO Aktif + Cek PO + Data Tabel Detail Item */}
                                {referenceType === "PO" ? (
                                    <div className="space-y-4 pt-1">
                                        {/* A. Data Tabel Daftar PO Aktif Milik Vendor (Siap Ditagihkan) */}
                                        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-700 pb-2.5">
                                                <div className="flex items-center gap-2">
                                                    <Package className="w-4 h-4 text-cyan-600" />
                                                    <div>
                                                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                                            Daftar PO Aktif Milik {tenant.name}
                                                        </Label>
                                                        <span className="text-[11px] text-slate-400">
                                                            Pilih nomor PO yang siap ditagihkan (Hanya PO Open &amp; Partial)
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="relative w-full sm:w-64">
                                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                                                        <Input
                                                            placeholder="Cari No. PO atau uraian barang..."
                                                            value={poSearchTerm}
                                                            onChange={(e) => {
                                                                setPoSearchTerm(e.target.value)
                                                                setPoCurrentPage(1)
                                                            }}
                                                            className="h-8 text-xs pl-8 bg-slate-50 dark:bg-slate-900"
                                                        />
                                                    </div>
                                                    <Badge variant="outline" className="text-cyan-700 bg-cyan-50 border-cyan-300 text-[11px] shrink-0 font-mono">
                                                        {filteredPos.length} PO
                                                    </Badge>
                                                </div>
                                            </div>

                                            {isLoadingAvailablePos ? (
                                                <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                                                    <span>Memuat daftar PO aktif dari database SAP One Chitra...</span>
                                                </div>
                                            ) : filteredPos.length > 0 ? (
                                                <div className="space-y-2">
                                                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <table className="w-full text-xs text-left">
                                                            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider border-b">
                                                                <tr>
                                                                    <th className="p-2.5 w-32">Nomor PO</th>
                                                                    <th className="p-2.5 w-24">Status SAP</th>
                                                                    <th className="p-2.5 w-28">Tgl Dokumen</th>
                                                                    <th className="p-2.5">Uraian Barang / Jasa</th>
                                                                    <th className="p-2.5 text-center w-20">Total Item</th>
                                                                    <th className="p-2.5 text-right w-32">Sisa Tagihan</th>
                                                                    <th className="p-2.5 text-center w-24">Aksi</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                {paginatedPos.map((p) => {
                                                                    const isSelected = poNumber === p.poNumber
                                                                    return (
                                                                        <tr
                                                                            key={p.poNumber}
                                                                            onClick={() => handleSelectAvailablePo(p)}
                                                                            className={`cursor-pointer transition-colors ${
                                                                                isSelected
                                                                                    ? "bg-cyan-50/80 dark:bg-cyan-950/50 font-medium"
                                                                                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                                                                            }`}
                                                                        >
                                                                            <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                                                                                #{p.poNumber}
                                                                            </td>
                                                                            <td className="p-2.5">
                                                                                <Badge
                                                                                    variant="outline"
                                                                                    className={
                                                                                        p.poStatus === "partial"
                                                                                            ? "bg-amber-50 text-amber-700 border-amber-300 text-[10px]"
                                                                                            : "bg-blue-50 text-blue-700 border-blue-300 text-[10px]"
                                                                                    }
                                                                                >
                                                                                    {p.poStatus === "partial" ? "PARTIAL" : "OPEN"}
                                                                                </Badge>
                                                                            </td>
                                                                            <td className="p-2.5 text-slate-500 text-[11px]">
                                                                                {formatDate(p.poDate)}
                                                                            </td>
                                                                            <td className="p-2.5 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                                                                                {p.materialSummary || "-"}
                                                                            </td>
                                                                            <td className="p-2.5 text-center font-semibold">
                                                                                {p.totalItems || p.items?.length || 1}
                                                                            </td>
                                                                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                                                                {formatCurrency(p.remainingValue)}
                                                                            </td>
                                                                            <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                                                <Button
                                                                                    type="button"
                                                                                    size="sm"
                                                                                    variant={isSelected ? "default" : "outline"}
                                                                                    onClick={() => handleSelectAvailablePo(p)}
                                                                                    className={`h-7 text-xs px-2.5 ${
                                                                                        isSelected
                                                                                            ? "bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
                                                                                            : "hover:bg-cyan-50 hover:text-cyan-700 border-slate-300"
                                                                                    }`}
                                                                                >
                                                                                    {isSelected ? "Terpilih ✓" : "Pilih PO"}
                                                                                </Button>
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* Paginasi Tabel PO */}
                                                    {totalPoPages > 1 && (
                                                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 px-1">
                                                            <span>
                                                                Menampilkan {(poCurrentPage - 1) * poPageSize + 1} -{" "}
                                                                {Math.min(poCurrentPage * poPageSize, filteredPos.length)} dari {filteredPos.length} PO
                                                            </span>
                                                            <div className="flex items-center gap-1.5">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={poCurrentPage <= 1}
                                                                    onClick={() => setPoCurrentPage((p) => Math.max(1, p - 1))}
                                                                    className="h-7 w-7 p-0"
                                                                >
                                                                    <ChevronLeft className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <span className="font-medium text-[11px] px-1">
                                                                    Hal {poCurrentPage} / {totalPoPages}
                                                                </span>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={poCurrentPage >= totalPoPages}
                                                                    onClick={() => setPoCurrentPage((p) => Math.min(totalPoPages, p + 1))}
                                                                    className="h-7 w-7 p-0"
                                                                >
                                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg text-center text-xs text-slate-500">
                                                    {poSearchTerm
                                                        ? `Tidak ada PO yang cocok dengan kata kunci "${poSearchTerm}".`
                                                        : `Tidak ada PO aktif (Open/Partial) yang siap ditagihkan saat ini untuk ${tenant.name}.`}
                                                </div>
                                            )}
                                        </div>

                                        {/* B. Input Manual / Pencarian Langsung Nomor Purchase Order */}
                                        <div>
                                            <Label htmlFor="poNumber" className="text-xs font-semibold block mb-1">
                                                Atau Masukkan / Cari Nomor PO SAP Lainnya:
                                            </Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="poNumber"
                                                    placeholder="Contoh: 8210010671 atau 8220031001"
                                                    value={poNumber}
                                                    onChange={(e) => {
                                                        setPoNumber(e.target.value)
                                                        if (poCheckResult) setPoCheckResult(null)
                                                        setSelectedItemIndexes([])
                                                    }}
                                                    required
                                                    className="font-mono text-xs"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => handleCheckPo()}
                                                    disabled={isCheckingPo || !poNumber.trim()}
                                                    className="shrink-0 flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-slate-800"
                                                >
                                                    {isCheckingPo ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Search className="w-3.5 h-3.5" />
                                                    )}
                                                    Cek PO Internal
                                                </Button>
                                            </div>
                                        </div>

                                        {/* C. Hasil Validasi Live PO SAP (Multi-Tenant & Status Guard) */}
                                        {poCheckResult && (
                                            <div
                                                className={`p-3.5 rounded-xl text-xs border transition-all animate-in fade-in ${
                                                    poCheckResult.found
                                                        ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200"
                                                        : poCheckResult.isWrongVendor
                                                        ? "bg-red-50/90 dark:bg-red-950/50 border-red-300 text-red-900 dark:text-red-200"
                                                        : poCheckResult.isCompleted
                                                        ? "bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 text-amber-900 dark:text-amber-200"
                                                        : "bg-slate-100 dark:bg-slate-800 border-slate-300 text-slate-700 dark:text-slate-300"
                                                }`}
                                            >
                                                {/* KASUS 1: PO Valid & Non-Completed milik vendor ini */}
                                                {poCheckResult.found && (
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                                                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                                                PO Valid Milik {poCheckResult.vendorName}
                                                            </span>
                                                            <Badge
                                                                className={
                                                                    poCheckResult.poStatus === "partial"
                                                                        ? "bg-amber-600 text-white text-[10px]"
                                                                        : "bg-emerald-600 text-white text-[10px]"
                                                                }
                                                            >
                                                                STATUS SAP: {poCheckResult.poStatus?.toUpperCase() || "OPEN"}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                                            Nomor PO: <strong className="font-mono">{poCheckResult.poNumber}</strong> &bull; Total Net PO: <strong>{formatCurrency(poCheckResult.netValue)}</strong>
                                                            {poCheckResult.invoicedValue > 0 && (
                                                                <span> &bull; Telah Di-invoice: <strong className="text-amber-600">{formatCurrency(poCheckResult.invoicedValue)}</strong></span>
                                                            )}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* KASUS 2: PO Diterbitkan untuk VENDOR LAIN (Wrong Vendor Protection) */}
                                                {poCheckResult.isWrongVendor && (
                                                    <div className="flex items-start gap-2.5">
                                                        <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                                        <div className="space-y-0.5">
                                                            <span className="font-bold text-red-700 dark:text-red-300 block">
                                                                Akses Ditolak: PO Diterbitkan untuk Rekanan Lain
                                                            </span>
                                                            <p className="text-[11px] text-red-600 dark:text-red-300">
                                                                {poCheckResult.message}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* KASUS 3: PO Sudah Selesai (COMPLETED) */}
                                                {poCheckResult.isCompleted && (
                                                    <div className="flex items-start gap-2.5">
                                                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                        <div className="space-y-0.5">
                                                            <span className="font-bold text-amber-800 dark:text-amber-200 block">
                                                                PO Sudah Selesai Ditagihkan Penuh (Status: COMPLETED)
                                                            </span>
                                                            <p className="text-[11px] text-amber-700 dark:text-amber-300">
                                                                {poCheckResult.message}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* KASUS 4: PO Tidak Ditemukan / Belum Sinkron */}
                                                {!poCheckResult.found && !poCheckResult.isWrongVendor && !poCheckResult.isCompleted && (
                                                    <div className="flex items-start gap-2">
                                                        <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-semibold block">PO Tidak Ditemukan</span>
                                                            <p className="text-[11px] mt-0.5">{poCheckResult.message}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* D. DATA TABEL DETAIL ITEM PO (PILIHAN CENTANG ITEM YANG AKAN DI-INVOICE) */}
                                        {poCheckResult?.found && poItemsList.length > 0 && (
                                            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-cyan-200 dark:border-cyan-900 shadow-xs space-y-3">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-700 pb-3">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <ListChecks className="w-4 h-4 text-cyan-600" />
                                                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                                                Rincian Item Purchase Order #{poCheckResult.poNumber}
                                                            </h4>
                                                            <Badge className={poCheckResult.poStatus === "partial" ? "bg-amber-600" : "bg-blue-600"}>
                                                                PO {poCheckResult.poStatus?.toUpperCase()}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            Centang item-item barang/jasa di bawah ini yang akan dimasukkan ke invoice tagihan saat ini.
                                                        </p>
                                                    </div>

                                                    {/* Quick Actions Button */}
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={handleSelectAllItems}
                                                            className="h-7 text-xs px-2.5 bg-slate-50 dark:bg-slate-900"
                                                        >
                                                            Centang Semua
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={handleDeselectAllItems}
                                                            className="h-7 text-xs px-2.5 text-slate-500"
                                                        >
                                                            Batal Centang
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Status Kalkulasi Item Terpilih & Proyeksi Status PO */}
                                                <div className="p-3 bg-slate-50/80 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                                                    <div className="flex items-center gap-3">
                                                        <div>
                                                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                                                                Item Terpilih:
                                                            </span>
                                                            <span className="font-bold text-slate-900 dark:text-slate-100">
                                                                {selectedItemIndexes.length} dari {availableItemsToInvoice.length} item siap ditagihkan
                                                            </span>
                                                        </div>
                                                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                                                        <div>
                                                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                                                                Proyeksi Status PO:
                                                            </span>
                                                            {nextCalculatedPoStatus === "completed" ? (
                                                                <Badge className="bg-emerald-600 text-white text-[10px] flex items-center gap-1">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    COMPLETED (Tagihan Selesai Penuh)
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-amber-600 text-white text-[10px] flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    PARTIAL (Masih ada sisa item)
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                                                            Subtotal Nilai Item Terpilih:
                                                        </span>
                                                        <span className="font-mono font-bold text-sm text-cyan-700 dark:text-cyan-400">
                                                            {formatCurrency(subtotal)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Data Tabel Item PO */}
                                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider border-b">
                                                            <tr>
                                                                <th className="p-2.5 text-center w-10">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={
                                                                            availableItemsToInvoice.length > 0 &&
                                                                            selectedItemIndexes.length === availableItemsToInvoice.length
                                                                        }
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) handleSelectAllItems()
                                                                            else handleDeselectAllItems()
                                                                        }}
                                                                        className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                                                    />
                                                                </th>
                                                                <th className="p-2.5 w-16">Item #</th>
                                                                <th className="p-2.5 w-24">Kode</th>
                                                                <th className="p-2.5">Deskripsi Barang / Jasa</th>
                                                                <th className="p-2.5 text-right w-20">Qty PO</th>
                                                                <th className="p-2.5 text-right w-20">Qty GR</th>
                                                                <th className="p-2.5 text-right w-28">Nilai Net</th>
                                                                <th className="p-2.5 text-center w-32">Status Tagihan</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {poItemsList.map((item: any, idx: number) => {
                                                                const isChecked = selectedItemIndexes.includes(idx)
                                                                const isInvoiced = Boolean(item.isInvoiced)
                                                                return (
                                                                    <tr
                                                                        key={idx}
                                                                        onClick={() => {
                                                                            if (!isInvoiced) handleToggleItem(idx)
                                                                        }}
                                                                        className={`transition-colors ${
                                                                            isInvoiced
                                                                                ? "bg-slate-100/60 dark:bg-slate-900/40 opacity-60 cursor-not-allowed"
                                                                                : isChecked
                                                                                ? "bg-cyan-50/70 dark:bg-cyan-950/40 font-medium cursor-pointer"
                                                                                : "hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                                                                        }`}
                                                                    >
                                                                        <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                                            <input
                                                                                type="checkbox"
                                                                                disabled={isInvoiced}
                                                                                checked={isChecked}
                                                                                onChange={() => handleToggleItem(idx)}
                                                                                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer disabled:cursor-not-allowed"
                                                                            />
                                                                        </td>
                                                                        <td className="p-2.5 font-mono text-slate-500">
                                                                            Item {item.itemNo || (idx + 1) * 10}
                                                                        </td>
                                                                        <td className="p-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                                                            {item.material || "-"}
                                                                        </td>
                                                                        <td className="p-2.5 text-slate-900 dark:text-slate-100">
                                                                            {item.shortText || "Barang/Jasa"}
                                                                        </td>
                                                                        <td className="p-2.5 text-right font-mono">
                                                                            {item.poQuantity} {item.oun || "PCS"}
                                                                        </td>
                                                                        <td className="p-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400">
                                                                            {item.grQuantity} {item.oun || "PCS"}
                                                                        </td>
                                                                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                                                            {formatCurrency(item.netValue)}
                                                                        </td>
                                                                        <td className="p-2.5 text-center">
                                                                            {isInvoiced ? (
                                                                                <Badge variant="secondary" className="text-[10px] bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                                                    Sudah Di-invoice
                                                                                </Badge>
                                                                            ) : isChecked ? (
                                                                                <Badge className="bg-cyan-600 text-white text-[10px]">
                                                                                    Siap Di-invoice ✓
                                                                                </Badge>
                                                                            ) : (
                                                                                <Badge variant="outline" className="text-slate-400 text-[10px]">
                                                                                    Belum Dipilih
                                                                                </Badge>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Contract Input with Live Lookup */
                                    <div className="space-y-2 pt-1">
                                        <Label htmlFor="contractNumber">Nomor Kontrak Perjanjian Vendor *</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="contractNumber"
                                                placeholder="Contoh: 505/TJ-CP/LV/X/2025"
                                                value={contractNumber}
                                                onChange={(e) => setContractNumber(e.target.value)}
                                                required
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={handleCheckContract}
                                                disabled={isCheckingContract || !contractNumber.trim()}
                                                className="shrink-0 flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                                            >
                                                {isCheckingContract ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Search className="w-4 h-4" />
                                                )}
                                                Cek Kontrak
                                            </Button>
                                        </div>

                                        {contractCheckResult && (
                                            <div
                                                className={`p-3 rounded-lg text-xs border ${
                                                    contractCheckResult.found
                                                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 text-indigo-800 dark:text-indigo-300"
                                                        : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-800 dark:text-amber-300"
                                                }`}
                                            >
                                                {contractCheckResult.found ? (
                                                    <div className="flex items-start gap-2">
                                                        <CheckCircle className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="font-semibold">
                                                                Kontrak Terdaftar: {contractCheckResult.contract.title}
                                                            </p>
                                                            <p className="mt-0.5">
                                                                Unit/Barang: <strong>{contractCheckResult.contract.itemName}</strong> &bull; Nilai Sewa: <strong>{formatCurrency(contractCheckResult.contract.contractValue)} / bln</strong> &bull; TOP: <strong>{contractCheckResult.contract.topDays} Hari</strong>
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-2">
                                                        <HelpCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="font-semibold">Kontrak Tidak Ditemukan</p>
                                                            <p className="mt-0.5">{contractCheckResult.message}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Tombol Navigasi ke Tab 2 */}
                            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    onClick={() => setActiveTab("tab2")}
                                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-5 flex items-center gap-2"
                                >
                                    <span>Lanjut ke Tab 2: Rincian Nominal &amp; Pajak</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ========================================================= */}
                {/* TAB 2: RINCIAN NOMINAL, PAJAK (PPN/PPH) & TOP */}
                {/* ========================================================= */}
                <TabsContent value="tab2" className="space-y-4 focus-visible:outline-none">
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800 w-full">
                        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                            <CardTitle className="text-base font-semibold flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-cyan-600" />
                                    <span>2. Rincian Nominal, Pajak (PPN/PPh) &amp; TOP</span>
                                </div>
                                <span className="text-xs font-normal text-slate-400">
                                    Langkah 2 dari 3
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-4">
                            {/* Summary Bar Dokumen Referensi dari Tab 1 */}
                            <div className="p-3.5 bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2.5">
                                    <Package className="w-4 h-4 text-cyan-600 shrink-0" />
                                    <div>
                                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                                            Dokumen Referensi Terpilih (Tab 1):
                                        </span>
                                        <span className="font-bold text-slate-900 dark:text-slate-100">
                                            {referenceType === "PO"
                                                ? `Purchase Order (PO): #${poNumber || "(Belum dipilih)"}`
                                                : `Kontrak Sewa: #${contractNumber || "(Belum diisi)"}`}
                                        </span>
                                    </div>
                                </div>

                                {referenceType === "PO" && poCheckResult?.found && (
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                                                Item Tercentang:
                                            </span>
                                            <span className="font-bold text-cyan-700 dark:text-cyan-400">
                                                {selectedItemIndexes.length} item ({formatCurrency(subtotal)})
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                                                Proyeksi Status:
                                            </span>
                                            <Badge className={nextCalculatedPoStatus === "completed" ? "bg-emerald-600" : "bg-amber-600"}>
                                                {nextCalculatedPoStatus.toUpperCase()}
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Inputs Rincian Nominal */}
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
                                    {referenceType === "PO" && poCheckResult?.items?.length > 0 && (
                                        <p className="text-[11px] text-cyan-700 dark:text-cyan-400 font-medium">
                                            * Otomatis terhitung dari total nilai {selectedItemIndexes.length} item PO yang dicentang di Tab 1.
                                        </p>
                                    )}
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

                            {/* TOP & Summary Card */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="topDays">Term of Payment (TOP) - Master Vendor</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="topDays"
                                            type="text"
                                            readOnly
                                            disabled
                                            value={`${tenant.defaultTopDays || 30} Hari ${tenant.sapTopCode ? `(SAP: ${tenant.sapTopCode})` : ""}`}
                                            className="bg-slate-100 dark:bg-slate-800 font-semibold cursor-not-allowed text-slate-700 dark:text-slate-300"
                                        />
                                        <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-2 py-2 rounded-md border">
                                            Read-Only
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        Sesuai data Master Vendor SAP. TOP terhitung otomatis setelah invoice valid by Finance.
                                    </p>
                                </div>

                                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Subtotal (DPP):</span>
                                        <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">PPN ({ppnPercent}%):</span>
                                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">+ {formatCurrency(ppnAmount)}</span>
                                    </div>
                                    {pphPercent > 0 && (
                                        <div className="flex justify-between text-red-600">
                                            <span>PPh ({pphPercent}%):</span>
                                            <span>- {formatCurrency(pphAmount)}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between font-bold text-sm">
                                        <span className="text-slate-900 dark:text-slate-100">Grand Total Tagihan:</span>
                                        <span className="text-cyan-700 dark:text-cyan-400 font-mono text-base">{formatCurrency(grandTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Tombol Navigasi Tab 2 */}
                            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setActiveTab("tab1")}
                                    className="flex items-center gap-2"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    <span>Kembali ke Tab 1: Dokumen Referensi</span>
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => setActiveTab("tab3")}
                                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-5 flex items-center gap-2"
                                >
                                    <span>Lanjut ke Tab 3: Dokumen Lampiran</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ========================================================= */}
                {/* TAB 3: DOKUMEN LAMPIRAN PENAGIHAN (URUTAN WAJIB VERIFIKASI) */}
                {/* ========================================================= */}
                <TabsContent value="tab3" className="space-y-4 focus-visible:outline-none">
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800 w-full">
                        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                            <CardTitle className="text-base font-semibold flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UploadCloud className="w-5 h-5 text-cyan-600" />
                                    <span>3. Dokumen Lampiran Penagihan (Urutan Wajib Verifikasi)</span>
                                </div>
                                <span className="text-xs font-normal text-slate-400">
                                    Langkah 3 dari 3
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            {/* Petunjuk Urutan Verifikasi */}
                            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs space-y-1.5">
                                <span className="font-bold text-blue-900 dark:text-blue-300 block">
                                    Aturan Urutan Dokumen Referensi Verifikasi:
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5 text-blue-800 dark:text-blue-200 font-semibold">
                                    <span className="bg-white dark:bg-blue-900 px-2 py-0.5 rounded border">1. PO / Kontrak</span>
                                    <span>&rarr;</span>
                                    <span className="bg-white dark:bg-blue-900 px-2 py-0.5 rounded border">2. DO / BAST / Absen</span>
                                    <span>&rarr;</span>
                                    <span className="bg-white dark:bg-blue-900 px-2 py-0.5 rounded border">3. GR Slip</span>
                                    <span>&rarr;</span>
                                    <span className="bg-white dark:bg-blue-900 px-2 py-0.5 rounded border">4. Invoice</span>
                                    <span>&rarr;</span>
                                    <span className="bg-white dark:bg-blue-900 px-2 py-0.5 rounded border">5. Faktur Pajak</span>
                                </div>
                                <p className="text-[11px] text-slate-500 pt-0.5">
                                    * Seluruh dokumen harus sesuai dan saling mendukung untuk memastikan keakuratan proses pembayaran ke rekening vendor.
                                </p>
                            </div>

                            {/* Quick Summary Bar Tagihan */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[10px]">Nomor Invoice &amp; Referensi:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {invoiceNumber || "(Nomor Invoice belum diisi di Tab 1)"} &bull;{" "}
                                        {referenceType === "PO" ? `PO #${poNumber}` : `Kontrak #${contractNumber}`}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-slate-400 block text-[10px]">Grand Total Tagihan:</span>
                                    <span className="font-mono font-bold text-base text-cyan-700 dark:text-cyan-400">
                                        {formatCurrency(grandTotal)}
                                    </span>
                                </div>
                            </div>

                            {/* 5 Slot Upload Dokumen */}
                            <div className="space-y-3.5">
                                {/* 1. PO / Kontrak */}
                                <div className="p-3.5 border rounded-xl border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                            1. Dokumen Purchase Order (PO) / Perjanjian Kontrak (PDF)
                                        </Label>
                                        <span className="text-[10px] text-slate-400">Lampiran Referensi</span>
                                    </div>
                                    {poFile || contractFile ? (
                                        <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs">
                                            <span className="truncate max-w-xs font-medium">
                                                {poFile ? poFile.name : contractFile?.name}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setPoFile(null)
                                                    setContractFile(null)
                                                }}
                                                className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <input
                                            type="file"
                                            accept=".pdf,image/*"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0] || null
                                                if (referenceType === "PO") setPoFile(f)
                                                else setContractFile(f)
                                            }}
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                        />
                                    )}
                                </div>

                                {/* 2. Surat Jalan / BAST / Rekap Absen */}
                                <div className="p-3.5 border rounded-xl border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                            2. Surat Jalan (DO) / BAST / Rekap Absen (PDF/Foto)
                                        </Label>
                                        <span className="text-[10px] text-slate-500 font-semibold">Bukti Serah Terima Fisik</span>
                                    </div>
                                    {deliveryReceiptFile ? (
                                        <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs">
                                            <span className="truncate max-w-xs font-medium">{deliveryReceiptFile.name}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDeliveryReceiptFile(null)}
                                                className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <input
                                            type="file"
                                            accept=".pdf,image/*"
                                            onChange={(e) => setDeliveryReceiptFile(e.target.files?.[0] || null)}
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                        />
                                    )}
                                </div>

                                {/* 3. Goods Receipt (GR) Slip */}
                                <div className="p-3.5 border rounded-xl border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                            3. Goods Receipt (GR) Slip SAP (PDF/Foto) *
                                        </Label>
                                        <span className="text-[10px] text-emerald-600 font-bold">Wajib (Kecuali ada BAST lengkap)</span>
                                    </div>
                                    {grSlipFile ? (
                                        <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs">
                                            <span className="truncate max-w-xs font-medium">{grSlipFile.name}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setGrSlipFile(null)}
                                                className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <input
                                            type="file"
                                            accept=".pdf,image/*"
                                            onChange={(e) => setGrSlipFile(e.target.files?.[0] || null)}
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                        />
                                    )}
                                </div>

                                {/* 4. Berkas Scan Invoice Fisik Asli */}
                                <div className="p-3.5 border rounded-xl border-dashed border-cyan-400 bg-cyan-50/30">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                            4. Berkas Fisik / Scan Invoice Asli Bertanda Tangan (PDF) *
                                        </Label>
                                        <span className="text-[10px] text-red-500 font-bold">Wajib Diunggah</span>
                                    </div>
                                    {invoiceFile ? (
                                        <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs">
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
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                                            required
                                        />
                                    )}
                                </div>

                                {/* 5. e-Faktur Pajak (Wajib jika PKP) */}
                                <div className={`p-3.5 border rounded-xl border-dashed ${tenant.isPkp || ppnPercent > 0 ? "border-amber-400 bg-amber-50/30" : "border-slate-300 dark:border-slate-700 bg-slate-50/50"}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                            5. Faktur Pajak e-Faktur (PDF) {tenant.isPkp || ppnPercent > 0 ? "*" : "(Opsional)"}
                                        </Label>
                                        <span className={`text-[10px] font-bold ${tenant.isPkp || ppnPercent > 0 ? "text-amber-700" : "text-slate-400"}`}>
                                            {tenant.isPkp || ppnPercent > 0 ? "Wajib bagi Vendor PKP *" : "Opsional Non-PKP"}
                                        </span>
                                    </div>
                                    {taxInvoiceFile ? (
                                        <div className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 border rounded-lg text-xs">
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
                                            required={tenant.isPkp || ppnPercent > 0}
                                            onChange={(e) => setTaxInvoiceFile(e.target.files?.[0] || null)}
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-600 file:text-white hover:file:bg-amber-700 cursor-pointer"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Tombol Navigasi & Submit Final */}
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setActiveTab("tab2")}
                                    className="flex items-center gap-2 w-full sm:w-auto"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    <span>Kembali ke Tab 2: Rincian Nominal</span>
                                </Button>

                                <Button
                                    type="submit"
                                    disabled={
                                        isSubmitting ||
                                        (referenceType === "PO" && poCheckResult && !poCheckResult.found) ||
                                        (referenceType === "PO" && poCheckResult?.items?.length > 0 && selectedItemIndexes.length === 0)
                                    }
                                    className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 text-base rounded-xl shadow-md transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Mengunggah Dokumen &amp; Mengirimkan Invoice...
                                        </>
                                    ) : (
                                        "Kirimkan Pengajuan Invoice ke Finance"
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </form>
    )
}
