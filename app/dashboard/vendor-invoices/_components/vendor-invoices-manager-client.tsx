"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import {
    approveManagerInvoiceAction,
    createPaymentBatchCheckoutAction,
    inviteVendorAction,
    validateFinanceInvoiceAction,
    verifyAdminChecklistAction,
} from "@/app/actions/vendor-invoices"
import { uploadFile } from "@/app/actions/upload"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
    AlertCircle,
    AlertTriangle,
    ArrowUpRight,
    Building2,
    Calendar,
    CheckCircle,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    Download,
    ExternalLink,
    Eye,
    FileCheck,
    FileSpreadsheet,
    FileText,
    History,
    Loader2,
    Mail,
    Plus,
    Search,
    Send,
    ShieldAlert,
    ShieldCheck,
    TrendingUp,
    UploadCloud,
    UserPlus,
    Users,
    Wallet,
    X,
} from "lucide-react"

function formatCurrency(amount: number | string): string {
    const val = Number(amount) || 0
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(val)
}

function formatDate(date: string | Date | null | undefined): string {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

function getStatusBadge(status: string) {
    switch (status) {
        case "submitted":
            return <Badge className="bg-blue-100 text-blue-800 border-blue-200">1. Menunggu Admin</Badge>
        case "verified_admin":
            return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">2. Menunggu Finance</Badge>
        case "validated_finance":
            return <Badge className="bg-amber-100 text-amber-800 border-amber-200">3. Menunggu Manager</Badge>
        case "approved_manager":
            return <Badge className="bg-purple-100 text-purple-800 border-purple-200">4. Siap Dibayar</Badge>
        case "paid":
            return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">5. Lunas (Paid)</Badge>
        case "rejected_admin":
            return <Badge className="bg-red-100 text-red-800 border-red-200">Ditolak Admin</Badge>
        case "rejected_finance":
            return <Badge className="bg-red-100 text-red-800 border-red-200">Ditolak Finance</Badge>
        case "rejected_manager":
            return <Badge className="bg-red-100 text-red-800 border-red-200">Ditolak Manager</Badge>
        default:
            return <Badge variant="outline">{status}</Badge>
    }
}

export function VendorInvoicesManagerClient({
    initialStats,
    initialInvoices,
    initialTenants,
}: {
    initialStats: any
    initialInvoices: any[]
    initialTenants: any[]
}) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState("monitoring")
    const [searchTerm, setSearchTerm] = useState("")

    // Modals
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [isAdminChecklistModalOpen, setIsAdminChecklistModalOpen] = useState(false)
    const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false)
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false)
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
    const [isInviteVendorModalOpen, setIsInviteVendorModalOpen] = useState(false)

    // Admin Validation Gate State
    const [adminChecklist, setAdminChecklist] = useState({
        docValid: false,
        poValid: false,
        calcValid: false,
        bankValid: false,
        taxValid: false,
    })
    const [adminNotes, setAdminNotes] = useState("")
    const [isProcessingAdmin, setIsProcessingAdmin] = useState(false)

    // Finance State
    const [financeNotes, setFinanceNotes] = useState("")
    const [overrideTop, setOverrideTop] = useState<number>(30)
    const [isProcessingFinance, setIsProcessingFinance] = useState(false)

    // Manager State
    const [managerNotes, setManagerNotes] = useState("")
    const [isProcessingManager, setIsProcessingManager] = useState(false)

    // Batch Checkout State
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([])
    const [bankSource, setBankSource] = useState("BCA Operasional - 0353123456")
    const [referenceNo, setReferenceNo] = useState("")
    const [checkoutNotes, setCheckoutNotes] = useState("")
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [isProcessingCheckout, setIsProcessingCheckout] = useState(false)

    // Invite Vendor State
    const [inviteData, setInviteData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        defaultTopDays: 30,
        isPkp: true,
        npwp: "",
        bankName: "BCA",
        bankAccountNo: "",
        bankAccountHolder: "",
    })
    const [isProcessingInvite, setIsProcessingInvite] = useState(false)
    const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null)

    // Filtered lists
    const submittedInvoices = initialInvoices.filter((i) => i.status === "submitted")
    const verifiedAdminInvoices = initialInvoices.filter((i) => i.status === "verified_admin")
    const validatedFinanceInvoices = initialInvoices.filter((i) => i.status === "validated_finance")
    const approvedInvoices = initialInvoices.filter((i) => i.status === "approved_manager")
    const paidInvoices = initialInvoices.filter((i) => i.status === "paid")

    // Open Admin Modal
    const handleOpenAdminModal = (invoice: any) => {
        setSelectedInvoice(invoice)
        setAdminChecklist({
            docValid: invoice.checklistDocValid,
            poValid: invoice.checklistPoValid,
            calcValid: invoice.checklistCalcValid,
            bankValid: invoice.checklistBankValid,
            taxValid: invoice.checklistTaxValid,
        })
        setAdminNotes("")
        setIsAdminChecklistModalOpen(true)
    }

    // Submit Admin Action
    const handleAdminAction = async (action: "verify" | "reject") => {
        if (!selectedInvoice) return
        setIsProcessingAdmin(true)

        try {
            const res = await verifyAdminChecklistAction({
                invoiceId: selectedInvoice.id,
                action,
                checklist: {
                    checklistDocValid: adminChecklist.docValid,
                    checklistPoValid: adminChecklist.poValid,
                    checklistCalcValid: adminChecklist.calcValid,
                    checklistBankValid: adminChecklist.bankValid,
                    checklistTaxValid: adminChecklist.taxValid,
                },
                notes: adminNotes,
            })

            if (!res.success) {
                alert(res.error || "Gagal memproses verifikasi admin.")
                setIsProcessingAdmin(false)
                return
            }

            setIsAdminChecklistModalOpen(false)
            router.refresh()
        } catch (err: any) {
            alert(err.message || "Terjadi kesalahan.")
        } finally {
            setIsProcessingAdmin(false)
        }
    }

    // Open Finance Modal
    const handleOpenFinanceModal = (invoice: any) => {
        setSelectedInvoice(invoice)
        setOverrideTop(invoice.topDays || 30)
        setFinanceNotes("")
        setIsFinanceModalOpen(true)
    }

    // Submit Finance Action
    const handleFinanceAction = async (action: "validate" | "reject") => {
        if (!selectedInvoice) return
        setIsProcessingFinance(true)

        try {
            const res = await validateFinanceInvoiceAction({
                invoiceId: selectedInvoice.id,
                action,
                notes: financeNotes,
                overrideTopDays: overrideTop,
            })

            if (!res.success) {
                alert(res.error || "Gagal memproses validasi finance.")
                setIsProcessingFinance(false)
                return
            }

            setIsFinanceModalOpen(false)
            router.refresh()
        } catch (err: any) {
            alert(err.message || "Terjadi kesalahan.")
        } finally {
            setIsProcessingFinance(false)
        }
    }

    // Open Manager Modal
    const handleOpenManagerModal = (invoice: any) => {
        setSelectedInvoice(invoice)
        setManagerNotes("")
        setIsManagerModalOpen(true)
    }

    // Submit Manager Action
    const handleManagerAction = async (action: "approve" | "reject") => {
        if (!selectedInvoice) return
        setIsProcessingManager(true)

        try {
            const res = await approveManagerInvoiceAction({
                invoiceId: selectedInvoice.id,
                action,
                notes: managerNotes,
            })

            if (!res.success) {
                alert(res.error || "Gagal memproses approval manager.")
                setIsProcessingManager(false)
                return
            }

            setIsManagerModalOpen(false)
            router.refresh()
        } catch (err: any) {
            alert(err.message || "Terjadi kesalahan.")
        } finally {
            setIsProcessingManager(false)
        }
    }

    // Toggle invoice in batch selection
    const handleToggleSelectInvoice = (id: string) => {
        setSelectedInvoiceIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        )
    }

    const handleSelectAllApproved = () => {
        if (selectedInvoiceIds.length === approvedInvoices.length) {
            setSelectedInvoiceIds([])
        } else {
            setSelectedInvoiceIds(approvedInvoices.map((i) => i.id))
        }
    }

    // Calculate selected total
    const selectedInvoicesData = approvedInvoices.filter((i) => selectedInvoiceIds.includes(i.id))
    const totalSelectedAmount = selectedInvoicesData.reduce(
        (sum, i) => sum + (Number(i.grandTotal) || 0),
        0
    )

    // Execute Batch Checkout
    const handleExecuteCheckout = async () => {
        if (selectedInvoiceIds.length === 0) return
        if (!proofFile) {
            alert("Unggah bukti transfer bank terlebih dahulu.")
            return
        }

        setIsProcessingCheckout(true)

        try {
            // 1. Upload proof file
            const formData = new FormData()
            formData.append("file", proofFile)
            const uploadRes = await uploadFile(formData)

            if (!uploadRes.success || !uploadRes.url) {
                throw new Error("Gagal mengunggah bukti transfer: " + uploadRes.error)
            }

            // 2. Execute checkout batch action
            const res = await createPaymentBatchCheckoutAction({
                invoiceIds: selectedInvoiceIds,
                bankSource,
                proofFileUrl: uploadRes.url,
                referenceNo,
                notes: checkoutNotes,
            })

            if (!res.success) {
                throw new Error(res.error || "Gagal memproses checkout batch pembayaran.")
            }

            alert(
                `Pembayaran batch ${res.batch.batchCode} berhasil diproses! Bukti transfer telah otomatis dikirimkan ke email masing-masing vendor.`
            )
            setIsCheckoutModalOpen(false)
            setSelectedInvoiceIds([])
            setProofFile(null)
            router.refresh()
        } catch (err: any) {
            alert(err.message || "Terjadi kesalahan saat checkout.")
        } finally {
            setIsProcessingCheckout(false)
        }
    }

    // Invite Vendor
    const handleInviteVendor = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsProcessingInvite(true)
        setInviteSuccessMsg(null)

        try {
            const res = await inviteVendorAction(inviteData)
            if (!res.success) {
                alert(res.error || "Gagal mengundang vendor.")
                setIsProcessingInvite(false)
                return
            }

            setInviteSuccessMsg(`Undangan resmi berhasil dikirim ke ${inviteData.email}!`)
            setTimeout(() => {
                setIsInviteVendorModalOpen(false)
                setInviteSuccessMsg(null)
                router.refresh()
            }, 1500)
        } catch (err: any) {
            alert(err.message || "Terjadi kesalahan.")
        } finally {
            setIsProcessingInvite(false)
        }
    }

    const { summary, projections, urgentInvoices } = initialStats

    return (
        <div className="space-y-6">
            {/* Real-Time Urgency Due Date Banner */}
            {urgentInvoices.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
                        <div>
                            <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                                Notifikasi Jatuh Tempo Pembayaran ({urgentInvoices.length} Tagihan)
                            </h4>
                            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                                Terdapat tagihan yang telah jatuh tempo atau harus dibayar minggu ini. Pastikan saldo kas operasional memadai untuk batch checkout.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {urgentInvoices.slice(0, 4).map((item: any) => (
                                    <span
                                        key={item.id}
                                        className={`text-[11px] px-2 py-0.5 rounded border ${item.urgency.colorClass}`}
                                    >
                                        Invoice #{item.id.slice(0, 8)} &bull; {formatCurrency(item.grandTotal)} ({item.urgency.label})
                                    </span>
                                ))}
                                {urgentInvoices.length > 4 && (
                                    <span className="text-[11px] text-amber-800 self-center">
                                        +{urgentInvoices.length - 4} lainnya
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs"
                        onClick={() => setActiveTab("checkout")}
                    >
                        Buka Antrean Bayar
                    </Button>
                </div>
            )}

            {/* Main Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
                    <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <TabsTrigger value="monitoring" className="text-xs flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Monitoring & Proyeksi
                        </TabsTrigger>
                        <TabsTrigger value="admin" className="text-xs flex items-center gap-1.5 relative">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Validation Gate Admin
                            {submittedInvoices.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                                    {submittedInvoices.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="finance" className="text-xs flex items-center gap-1.5 relative">
                            <FileCheck className="w-3.5 h-3.5" />
                            Validasi Finance
                            {verifiedAdminInvoices.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 bg-indigo-600 text-white text-[10px] font-bold rounded-full">
                                    {verifiedAdminInvoices.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="manager" className="text-xs flex items-center gap-1.5 relative">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Otorisasi Manager
                            {validatedFinanceInvoices.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 bg-amber-600 text-white text-[10px] font-bold rounded-full">
                                    {validatedFinanceInvoices.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="checkout" className="text-xs flex items-center gap-1.5 relative">
                            <Wallet className="w-3.5 h-3.5" />
                            Batch Checkout
                            {approvedInvoices.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 bg-purple-600 text-white text-[10px] font-bold rounded-full">
                                    {approvedInvoices.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="vendors" className="text-xs flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            Master Vendor
                        </TabsTrigger>
                    </TabsList>

                    <Button
                        size="sm"
                        onClick={() => setIsInviteVendorModalOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-white text-xs flex items-center gap-1.5 shadow-sm"
                    >
                        <UserPlus className="w-4 h-4" />
                        Undang Vendor Baru
                    </Button>
                </div>

                {/* TAB 1: MONITORING & PROYEKSI 3 BULAN */}
                <TabsContent value="monitoring" className="space-y-6">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="shadow-xs">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-medium text-slate-500">Antrean Verifikasi Admin</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-blue-600">{summary.countSubmitted}</div>
                                <p className="text-[11px] text-slate-400 mt-0.5">Memerlukan checklist validasi gate</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-xs">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-medium text-slate-500">Antrean Validasi Finance</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-indigo-600">{summary.countVerifiedAdmin}</div>
                                <p className="text-[11px] text-slate-400 mt-0.5">Pajak, kalkulasi cut-off & TOP</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-xs">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-medium text-slate-500">Siap Bayar (Approved)</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-purple-600">{formatCurrency(summary.totalAmountApproved)}</div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{summary.countApprovedManager} invoice siap batch checkout</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-xs">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-medium text-slate-500">Terbayar Bulan Ini</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.totalAmountPaidThisMonth)}</div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{summary.countPaid} invoice telah lunas</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Proyeksi Pembayaran 3 Bulan ke Depan (M+1, M+2, M+3) */}
                    <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                        <CardHeader className="p-6 pb-4 border-b">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-base font-bold flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        Proyeksi Pembayaran Tagihan (Cash Flow Projection)
                                    </CardTitle>
                                    <CardDescription className="text-xs text-slate-500 mt-1">
                                        Estimasi pengeluaran kas berdasarkan jadwal pembayaran minggu terakhir bulan jatuh tempo TOP.
                                    </CardDescription>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    Aturan Cut-off: Tgl &le; 15 bulan ini, &gt; 15 tgl 1 bulan depan
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Bulan Berjalan */}
                                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                            Bulan Berjalan ({projections.currentMonth.shortLabel})
                                        </span>
                                        <Badge variant="secondary" className="text-[10px]">
                                            {projections.currentMonth.totalInvoices} Invoice
                                        </Badge>
                                    </div>
                                    <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(projections.currentMonth.totalAmount)}
                                    </div>
                                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-blue-200 dark:border-blue-900">
                                        <div className="flex justify-between">
                                            <span>Approved:</span>
                                            <span className="font-semibold text-purple-600">{formatCurrency(projections.currentMonth.approvedAmount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Lunas:</span>
                                            <span className="font-semibold text-emerald-600">{formatCurrency(projections.currentMonth.paidAmount)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bulan Depan (M+1) */}
                                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/20 dark:border-indigo-900 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                            Bulan Depan (M+1 &bull; {projections.nextMonth.shortLabel})
                                        </span>
                                        <Badge variant="secondary" className="text-[10px]">
                                            {projections.nextMonth.totalInvoices} Invoice
                                        </Badge>
                                    </div>
                                    <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(projections.nextMonth.totalAmount)}
                                    </div>
                                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-indigo-200 dark:border-indigo-900">
                                        <div className="flex justify-between">
                                            <span>Approved:</span>
                                            <span className="font-semibold text-purple-600">{formatCurrency(projections.nextMonth.approvedAmount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Pending Review:</span>
                                            <span className="font-semibold text-slate-600">{formatCurrency(projections.nextMonth.pendingApprovalAmount)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 2 Bulan Lagi (M+2) */}
                                <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 dark:bg-purple-950/20 dark:border-purple-900 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                                            2 Bulan Lagi (M+2 &bull; {projections.twoMonthsLater.shortLabel})
                                        </span>
                                        <Badge variant="secondary" className="text-[10px]">
                                            {projections.twoMonthsLater.totalInvoices} Invoice
                                        </Badge>
                                    </div>
                                    <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(projections.twoMonthsLater.totalAmount)}
                                    </div>
                                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-purple-200 dark:border-purple-900">
                                        <div className="flex justify-between">
                                            <span>Approved:</span>
                                            <span className="font-semibold text-purple-600">{formatCurrency(projections.twoMonthsLater.approvedAmount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Pending Review:</span>
                                            <span className="font-semibold text-slate-600">{formatCurrency(projections.twoMonthsLater.pendingApprovalAmount)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 3 Bulan Lagi (M+3) */}
                                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                            3 Bulan Lagi (M+3 &bull; {projections.threeMonthsLater.shortLabel})
                                        </span>
                                        <Badge variant="secondary" className="text-[10px]">
                                            {projections.threeMonthsLater.totalInvoices} Invoice
                                        </Badge>
                                    </div>
                                    <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(projections.threeMonthsLater.totalAmount)}
                                    </div>
                                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-emerald-200 dark:border-emerald-900">
                                        <div className="flex justify-between">
                                            <span>Approved:</span>
                                            <span className="font-semibold text-purple-600">{formatCurrency(projections.threeMonthsLater.approvedAmount)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Pending Review:</span>
                                            <span className="font-semibold text-slate-600">{formatCurrency(projections.threeMonthsLater.pendingApprovalAmount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabel Seluruh Tagihan */}
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                        <CardHeader className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <CardTitle className="text-sm font-bold">Semua Dokumen Invoice Vendor</CardTitle>
                            <div className="relative w-full sm:w-64">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                <Input
                                    placeholder="Cari Invoice / Vendor / PO..."
                                    className="pl-9 h-9 text-xs"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b">
                                        <tr>
                                            <th className="px-4 py-3">Vendor</th>
                                            <th className="px-4 py-3">No. Invoice & PO</th>
                                            <th className="px-4 py-3">Tanggal Tagihan</th>
                                            <th className="px-4 py-3">Grand Total</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Jadwal Bayar</th>
                                            <th className="px-4 py-3 text-right">Detail</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {initialInvoices
                                            .filter(
                                                (i) =>
                                                    i.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    i.tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    i.poNumber.toLowerCase().includes(searchTerm.toLowerCase())
                                            )
                                            .map((inv) => (
                                                <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                                                            {inv.tenant.name}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            {inv.tenant.code}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                                                            {inv.invoiceNumber}
                                                        </div>
                                                        <div className="font-mono text-slate-500 text-[11px]">
                                                            PO: {inv.poNumber}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">{formatDate(inv.invoiceDate)}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                                        {formatCurrency(inv.grandTotal)}
                                                    </td>
                                                    <td className="px-4 py-3">{getStatusBadge(inv.status)}</td>
                                                    <td className="px-4 py-3">
                                                        {inv.scheduledPaymentDate ? (
                                                            <div>
                                                                <div className="font-semibold">{formatDate(inv.scheduledPaymentDate)}</div>
                                                                <span className={`text-[9px] px-1.5 py-0.2 rounded border ${inv.urgency.colorClass}`}>
                                                                    {inv.urgency.label}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic">Belum Tervalidasi</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs"
                                                            onClick={() => {
                                                                setSelectedInvoice(inv)
                                                                setIsDetailModalOpen(true)
                                                            }}
                                                        >
                                                            <Eye className="w-3.5 h-3.5 mr-1" />
                                                            Lihat
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: VALIDATION GATE (ADMIN CHECKLIST) */}
                <TabsContent value="admin" className="space-y-4">
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                        <CardHeader className="p-4 border-b">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-blue-600" />
                                Validation Gate (Mandatory Checklist Admin)
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                                Sistem menerapkan 5 checklist wajib sebelum tagihan dapat diteruskan ke tim Finance untuk validasi pajak dan nominal.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b">
                                        <tr>
                                            <th className="px-4 py-3">Vendor</th>
                                            <th className="px-4 py-3">No. Invoice & PO</th>
                                            <th className="px-4 py-3">Tanggal Tagihan</th>
                                            <th className="px-4 py-3">Grand Total</th>
                                            <th className="px-4 py-3">Dokumen Lampiran</th>
                                            <th className="px-4 py-3 text-right">Aksi Validation Gate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {submittedInvoices.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                    Tidak ada antrean invoice baru yang memerlukan checklist Admin.
                                                </td>
                                            </tr>
                                        ) : (
                                            submittedInvoices.map((inv) => (
                                                <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{inv.tenant.name}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{inv.tenant.code}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{inv.invoiceNumber}</div>
                                                        <div className="font-mono text-slate-500">PO: {inv.poNumber}</div>
                                                    </td>
                                                    <td className="px-4 py-3">{formatDate(inv.invoiceDate)}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                                        {formatCurrency(inv.grandTotal)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <a
                                                                href={resolveUploadDocumentUrl(inv.invoiceFileUrl) || inv.invoiceFileUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-blue-600 hover:underline flex items-center gap-0.5"
                                                            >
                                                                <FileText className="w-3.5 h-3.5" />
                                                                Invoice
                                                            </a>
                                                            {inv.taxInvoiceFileUrl && (
                                                                <a
                                                                    href={resolveUploadDocumentUrl(inv.taxInvoiceFileUrl) || inv.taxInvoiceFileUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-emerald-600 hover:underline flex items-center gap-0.5 ml-2"
                                                                >
                                                                    <FileCheck className="w-3.5 h-3.5" />
                                                                    e-Faktur
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleOpenAdminModal(inv)}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                                                        >
                                                            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                                                            Buka 5 Checklist
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: VALIDASI FINANCE & CUT-OFF ENGINE */}
                <TabsContent value="finance" className="space-y-4">
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                        <CardHeader className="p-4 border-b">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <FileCheck className="w-5 h-5 text-indigo-600" />
                                Validasi Pajak, Akurasi Nominal & Bank (Finance Queue)
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                                Invoice yang lolos checklist Admin siap divalidasi pajaknya dan memicu perhitungan tanggal buku cut-off penerimaan & jadwal pembayaran.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b">
                                        <tr>
                                            <th className="px-4 py-3">Vendor & Rekening</th>
                                            <th className="px-4 py-3">No. Invoice & PO</th>
                                            <th className="px-4 py-3">Rincian Pajak (DPP/PPN/PPh)</th>
                                            <th className="px-4 py-3">Grand Total</th>
                                            <th className="px-4 py-3">Status Admin</th>
                                            <th className="px-4 py-3 text-right">Validasi Finance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {verifiedAdminInvoices.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                    Tidak ada antrean invoice yang menunggu validasi Finance.
                                                </td>
                                            </tr>
                                        ) : (
                                            verifiedAdminInvoices.map((inv) => (
                                                <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{inv.tenant.name}</div>
                                                        <div className="text-[11px] text-slate-500">
                                                            {inv.tenant.bankName}: {inv.tenant.bankAccountNo} (a/n {inv.tenant.bankAccountHolder})
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{inv.invoiceNumber}</div>
                                                        <div className="font-mono text-slate-500">PO: {inv.poNumber}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div>DPP: {formatCurrency(inv.subtotal)}</div>
                                                        <div className="text-[10px] text-slate-500">
                                                            PPN {inv.ppnPercent}%: +{formatCurrency(inv.ppnAmount)} {Number(inv.pphAmount) > 0 ? `| PPh: -${formatCurrency(inv.pphAmount)}` : ""}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                                        {formatCurrency(inv.grandTotal)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                                            Verified by Admin
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleOpenFinanceModal(inv)}
                                                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
                                                        >
                                                            <Calendar className="w-3.5 h-3.5 mr-1" />
                                                            Validasi & Jadwalkan
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 4: OTORISASI MANAGER */}
                <TabsContent value="manager" className="space-y-4">
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                        <CardHeader className="p-4 border-b">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-amber-600" />
                                Otorisasi & Approval Pembayaran (Manager Queue)
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                                Persetujuan pelepasan dana penagihan sebelum Finance melakukan eksekusi transfer batch checkout.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b">
                                        <tr>
                                            <th className="px-4 py-3">Vendor</th>
                                            <th className="px-4 py-3">No. Invoice & PO</th>
                                            <th className="px-4 py-3">Grand Total</th>
                                            <th className="px-4 py-3">Jadwal Pembayaran</th>
                                            <th className="px-4 py-3">Catatan Finance</th>
                                            <th className="px-4 py-3 text-right">Otorisasi Manager</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {validatedFinanceInvoices.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                    Tidak ada antrean invoice yang memerlukan otorisasi Manager saat ini.
                                                </td>
                                            </tr>
                                        ) : (
                                            validatedFinanceInvoices.map((inv) => (
                                                <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-4 py-3 font-semibold">{inv.tenant.name}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{inv.invoiceNumber}</div>
                                                        <div className="font-mono text-slate-500">PO: {inv.poNumber}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                                        {formatCurrency(inv.grandTotal)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{formatDate(inv.scheduledPaymentDate)}</div>
                                                        <div className="text-[10px] text-slate-400">TOP: {inv.topDays} Hari</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                                        {inv.financeNotes || "-"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleOpenManagerModal(inv)}
                                                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                                            Review & Approve
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 5: BATCH PAYMENT CHECKOUT */}
                <TabsContent value="checkout" className="space-y-4">
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                        <CardHeader className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Wallet className="w-5 h-5 text-purple-600" />
                                    Batch Payment Checkout & Otomatisasi Bukti Transfer
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500 mt-0.5">
                                    Pilih kumpulan invoice yang telah di-approve, eksekusi pembayaran, dan kirim bukti transfer otomatis ke email vendor.
                                </CardDescription>
                            </div>

                            {selectedInvoiceIds.length > 0 && (
                                <Button
                                    size="sm"
                                    onClick={() => setIsCheckoutModalOpen(true)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md"
                                >
                                    <CreditCard className="w-4 h-4" />
                                    Checkout ({selectedInvoiceIds.length}) &bull; {formatCurrency(totalSelectedAmount)}
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b">
                                        <tr>
                                            <th className="px-4 py-3 w-10">
                                                <Checkbox
                                                    checked={
                                                        approvedInvoices.length > 0 &&
                                                        selectedInvoiceIds.length === approvedInvoices.length
                                                    }
                                                    onCheckedChange={handleSelectAllApproved}
                                                />
                                            </th>
                                            <th className="px-4 py-3">Vendor & Rekening Bank</th>
                                            <th className="px-4 py-3">No. Invoice & PO</th>
                                            <th className="px-4 py-3">Grand Total</th>
                                            <th className="px-4 py-3">Target Tanggal Bayar</th>
                                            <th className="px-4 py-3 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {approvedInvoices.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                    Tidak ada invoice berstatus Approved yang siap untuk checkout pembayaran saat ini.
                                                </td>
                                            </tr>
                                        ) : (
                                            approvedInvoices.map((inv) => (
                                                <tr
                                                    key={inv.id}
                                                    className={`hover:bg-slate-50/60 transition-colors ${
                                                        selectedInvoiceIds.includes(inv.id) ? "bg-purple-50/40 dark:bg-purple-950/20" : ""
                                                    }`}
                                                >
                                                    <td className="px-4 py-3">
                                                        <Checkbox
                                                            checked={selectedInvoiceIds.includes(inv.id)}
                                                            onCheckedChange={() => handleToggleSelectInvoice(inv.id)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{inv.tenant.name}</div>
                                                        <div className="text-[11px] text-slate-500 font-mono">
                                                            {inv.tenant.bankName}: {inv.tenant.bankAccountNo} (a/n {inv.tenant.bankAccountHolder})
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{inv.invoiceNumber}</div>
                                                        <div className="font-mono text-slate-500">PO: {inv.poNumber}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                                        {formatCurrency(inv.grandTotal)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{formatDate(inv.scheduledPaymentDate)}</div>
                                                        <span className={`text-[9px] px-1.5 py-0.2 rounded border ${inv.urgency.colorClass}`}>
                                                            {inv.urgency.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                                            Approved for Payment
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 6: MASTER VENDOR & UNDANGAN */}
                <TabsContent value="vendors" className="space-y-4">
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                        <CardHeader className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-primary" />
                                    Database Mitra Vendor Terdaftar (Multi-Tenant)
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500">
                                    Vendor hanya dapat mengakses portal jika menerima email undangan resmi dan mengaktifkan akunnya.
                                </CardDescription>
                            </div>

                            <Button
                                size="sm"
                                onClick={() => setIsInviteVendorModalOpen(true)}
                                className="bg-primary hover:bg-primary/90 text-white text-xs flex items-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" />
                                Tambah & Kirim Undangan Vendor
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b">
                                        <tr>
                                            <th className="px-4 py-3">Kode & Nama Vendor</th>
                                            <th className="px-4 py-3">Email Undangan</th>
                                            <th className="px-4 py-3">Status PKP & NPWP</th>
                                            <th className="px-4 py-3">Rekening Bank</th>
                                            <th className="px-4 py-3">TOP Standar</th>
                                            <th className="px-4 py-3">Status Akun</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {initialTenants.map((vt) => (
                                            <tr key={vt.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-slate-900 dark:text-slate-100">{vt.name}</div>
                                                    <div className="font-mono text-[10px] text-slate-400">{vt.code}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono">
                                                    {vt.email}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div>{vt.isPkp ? <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">PKP</Badge> : <Badge variant="secondary" className="text-[10px]">Non-PKP</Badge>}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{vt.npwp || "-"}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold">{vt.bankName || "-"}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono">{vt.bankAccountNo || "-"} (a/n {vt.bankAccountHolder || "-"})</div>
                                                </td>
                                                <td className="px-4 py-3 font-semibold">{vt.defaultTopDays} Hari</td>
                                                <td className="px-4 py-3">
                                                    {vt.status === "active" ? (
                                                        <Badge className="bg-emerald-100 text-emerald-800">Aktif</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                                            Menunggu Aktivasi
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* MODAL 1: ADMIN VALIDATION GATE (5 CHECKLIST MANDATORY) */}
            <Dialog open={isAdminChecklistModalOpen} onOpenChange={setIsAdminChecklistModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                            Validation Gate Admin Checklist &bull; {selectedInvoice?.invoiceNumber}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Sistem menerapkan 5 checklist wajib sebelum tagihan dapat diteruskan ke tahap Finance.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedInvoice && (
                        <div className="space-y-4 text-xs">
                            {/* Ringkasan Invoice */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div>
                                    <span className="text-slate-400 block text-[10px]">Vendor:</span>
                                    <span className="font-semibold">{selectedInvoice.tenant.name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px]">Nomor PO:</span>
                                    <span className="font-mono font-semibold">{selectedInvoice.poNumber}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px]">Grand Total:</span>
                                    <span className="font-bold text-primary">{formatCurrency(selectedInvoice.grandTotal)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px]">Status PKP:</span>
                                    <span className="font-semibold">{selectedInvoice.tenant.isPkp ? "PKP" : "Non-PKP"}</span>
                                </div>
                            </div>

                            {/* Dokumen Lampiran Link */}
                            <div className="flex flex-wrap items-center gap-2 p-2.5 bg-blue-50/50 rounded-lg border border-blue-200">
                                <span className="font-semibold text-blue-900 mr-1">Tinjau Dokumen:</span>
                                <a
                                    href={resolveUploadDocumentUrl(selectedInvoice.invoiceFileUrl) || selectedInvoice.invoiceFileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-1 bg-white rounded border border-blue-200 text-blue-700 font-medium hover:bg-blue-50 flex items-center gap-1"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Invoice PDF
                                </a>
                                {selectedInvoice.taxInvoiceFileUrl && (
                                    <a
                                        href={resolveUploadDocumentUrl(selectedInvoice.taxInvoiceFileUrl) || selectedInvoice.taxInvoiceFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2 py-1 bg-white rounded border border-emerald-200 text-emerald-700 font-medium hover:bg-emerald-50 flex items-center gap-1"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        e-Faktur Pajak
                                    </a>
                                )}
                                {selectedInvoice.deliveryReceiptFileUrl && (
                                    <a
                                        href={resolveUploadDocumentUrl(selectedInvoice.deliveryReceiptFileUrl) || selectedInvoice.deliveryReceiptFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2 py-1 bg-white rounded border border-purple-200 text-purple-700 font-medium hover:bg-purple-50 flex items-center gap-1"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Surat Jalan
                                    </a>
                                )}
                            </div>

                            {/* 5 Mandatory Checklists */}
                            <div className="space-y-3 p-4 border rounded-xl bg-white dark:bg-slate-900">
                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">
                                    5 Butir Pengecekan Wajib (Mandatory Checklist)
                                </h4>

                                <div className="space-y-2.5">
                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <Checkbox
                                            checked={adminChecklist.docValid}
                                            onCheckedChange={(c) => setAdminChecklist({ ...adminChecklist, docValid: Boolean(c) })}
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">1. Validitas Dokumen Fisik</span>
                                            <p className="text-[11px] text-slate-500">Berkas PDF/Scan tidak korup, terbaca jelas, dan asli.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <Checkbox
                                            checked={adminChecklist.poValid}
                                            onCheckedChange={(c) => setAdminChecklist({ ...adminChecklist, poValid: Boolean(c) })}
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">2. Kesesuaian Purchase Order (PO)</span>
                                            <p className="text-[11px] text-slate-500">Nomor PO pada invoice cocok dengan data internal SAP One Chitra.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <Checkbox
                                            checked={adminChecklist.calcValid}
                                            onCheckedChange={(c) => setAdminChecklist({ ...adminChecklist, calcValid: Boolean(c) })}
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">3. Akurasi Kalkulasi Nominal & Pajak</span>
                                            <p className="text-[11px] text-slate-500">Sub-total (DPP) + Pajak (PPN/PPh) sesuai dengan Grand Total.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <Checkbox
                                            checked={adminChecklist.bankValid}
                                            onCheckedChange={(c) => setAdminChecklist({ ...adminChecklist, bankValid: Boolean(c) })}
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">4. Kesesuaian Rekening Bank Vendor</span>
                                            <p className="text-[11px] text-slate-500">
                                                Nama dan nomor rekening cocok dengan Master Vendor ({selectedInvoice.tenant.bankName}: {selectedInvoice.tenant.bankAccountNo} a/n {selectedInvoice.tenant.bankAccountHolder}).
                                            </p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <Checkbox
                                            checked={adminChecklist.taxValid}
                                            onCheckedChange={(c) => setAdminChecklist({ ...adminChecklist, taxValid: Boolean(c) })}
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">5. Kelengkapan Faktur Pajak e-Faktur</span>
                                            <p className="text-[11px] text-slate-500">
                                                {selectedInvoice.tenant.isPkp
                                                    ? "Vendor PKP: e-Faktur terlampir dan nomor faktur valid."
                                                    : "Vendor Non-PKP: Dikecualikan dari kewajiban e-Faktur."}
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Catatan Admin */}
                            <div className="space-y-1.5">
                                <Label htmlFor="adminNotes">Catatan / Alasan Penolakan (Wajib diisi jika menolak revisi)</Label>
                                <Textarea
                                    id="adminNotes"
                                    rows={2}
                                    placeholder="Instruksi revisi untuk vendor jika ada dokumen yang tidak sesuai..."
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={isProcessingAdmin}
                            onClick={() => handleAdminAction("reject")}
                            className="text-xs"
                        >
                            Tolak & Minta Revisi Vendor
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            disabled={
                                isProcessingAdmin ||
                                !(
                                    adminChecklist.docValid &&
                                    adminChecklist.poValid &&
                                    adminChecklist.calcValid &&
                                    adminChecklist.bankValid &&
                                    adminChecklist.taxValid
                                )
                            }
                            onClick={() => handleAdminAction("verify")}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                        >
                            {isProcessingAdmin ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                            Loloskan ke Finance (5 Ceklist Terpenuhi)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL 2: FINANCE VALIDATION & CUT-OFF LIVE CALCULATOR */}
            <Dialog open={isFinanceModalOpen} onOpenChange={setIsFinanceModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <FileCheck className="w-5 h-5 text-indigo-600" />
                            Validasi Finance & Eksekusi Cut-off &bull; {selectedInvoice?.invoiceNumber}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Finance memverifikasi perpajakan dan mengonfirmasi tanggal pembukuan & jadwal pembayaran.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedInvoice && (
                        <div className="space-y-4 text-xs">
                            {/* Live Cut-Off Rule Preview */}
                            <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl space-y-2">
                                <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-xs flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-indigo-600" />
                                    Logika Cut-Off Penerimaan & Jadwal Bayar
                                </h4>
                                <div className="text-slate-600 dark:text-slate-300 space-y-1">
                                    <div>Tanggal Validasi Hari Ini: <strong>{new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</strong></div>
                                    <div>
                                        Status Cut-Off:{" "}
                                        {new Date().getDate() <= 15 ? (
                                            <span className="font-bold text-emerald-700">Tanggal &le; 15 &rarr; Tercatat Diterima Bulan Ini</span>
                                        ) : (
                                            <span className="font-bold text-amber-700">Tanggal &gt; 15 &rarr; Tercatat Diterima Tanggal 1 Bulan Depan</span>
                                        )}
                                    </div>
                                    <div>Aturan Pembayaran: <strong>Hari kerja terakhir (Senin-Jumat) di minggu terakhir bulan jatuh tempo TOP.</strong></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="topDaysInput">Term of Payment (TOP Hari)</Label>
                                    <Input
                                        id="topDaysInput"
                                        type="number"
                                        value={overrideTop}
                                        onChange={(e) => setOverrideTop(Number(e.target.value) || 30)}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Total Tagihan Final</Label>
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded font-bold text-base text-primary">
                                        {formatCurrency(selectedInvoice.grandTotal)}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="financeNotesInput">Catatan Validasi Finance</Label>
                                <Textarea
                                    id="financeNotesInput"
                                    rows={2}
                                    placeholder="Catatan validasi pajak atau instruksi pembayaran..."
                                    value={financeNotes}
                                    onChange={(e) => setFinanceNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={isProcessingFinance}
                            onClick={() => handleFinanceAction("reject")}
                            className="text-xs"
                        >
                            Tolak ke Vendor
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            disabled={isProcessingFinance}
                            onClick={() => handleFinanceAction("validate")}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                        >
                            {isProcessingFinance ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Calendar className="w-4 h-4 mr-1" />}
                            Validasi Pajak & Jadwalkan Bayar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL 3: MANAGER APPROVAL */}
            <Dialog open={isManagerModalOpen} onOpenChange={setIsManagerModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <CheckCircle2 className="w-5 h-5 text-amber-600" />
                            Otorisasi Pembayaran &bull; {selectedInvoice?.invoiceNumber}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Persetujuan pelepasan dana penagihan untuk invoice yang telah tervalidasi oleh Finance.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedInvoice && (
                        <div className="space-y-3 text-xs">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Vendor:</span>
                                    <span className="font-semibold">{selectedInvoice.tenant.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Grand Total:</span>
                                    <span className="font-bold text-sm text-primary">{formatCurrency(selectedInvoice.grandTotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Jadwal Transfer:</span>
                                    <span className="font-semibold text-blue-600">{formatDate(selectedInvoice.scheduledPaymentDate)}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="managerNotesInput">Catatan Otorisasi Manager</Label>
                                <Textarea
                                    id="managerNotesInput"
                                    rows={2}
                                    placeholder="Catatan approval pembayaran..."
                                    value={managerNotes}
                                    onChange={(e) => setManagerNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={isProcessingManager}
                            onClick={() => handleManagerAction("reject")}
                            className="text-xs"
                        >
                            Tolak
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            disabled={isProcessingManager}
                            onClick={() => handleManagerAction("approve")}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                        >
                            {isProcessingManager ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                            Setujui Pembayaran (Approve)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL 4: BATCH PAYMENT CHECKOUT */}
            <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <CreditCard className="w-5 h-5 text-purple-600" />
                            Eksekusi Batch Payment Checkout ({selectedInvoiceIds.length} Invoice)
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Unggah bukti transfer perbankan resmi. Bukti pembayaran akan otomatis dikirimkan ke email masing-masing vendor.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 text-xs">
                        {/* Summary Total */}
                        <div className="p-4 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-xl flex items-center justify-between">
                            <div>
                                <span className="text-purple-700 dark:text-purple-300 font-semibold block text-[11px] uppercase tracking-wider">
                                    Total Pencairan Dana Batch
                                </span>
                                <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                                    {formatCurrency(totalSelectedAmount)}
                                </span>
                            </div>
                            <Badge className="bg-purple-600 text-white">
                                {selectedInvoiceIds.length} Dokumen Invoice
                            </Badge>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="bankSourceInput">Sumber Rekening Pengirim (One Chitra) *</Label>
                            <Input
                                id="bankSourceInput"
                                value={bankSource}
                                onChange={(e) => setBankSource(e.target.value)}
                                placeholder="Contoh: BCA Operasional - 0353123456"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="refNoInput">Nomor Referensi Bank / No. Bukti Transfer</Label>
                            <Input
                                id="refNoInput"
                                value={referenceNo}
                                onChange={(e) => setReferenceNo(e.target.value)}
                                placeholder="Contoh: FT26311098921"
                            />
                        </div>

                        {/* File Upload Bukti Transfer */}
                        <div className="space-y-1.5">
                            <Label>Unggah Bukti Transfer Bank (PDF / Gambar) *</Label>
                            <div className="p-3 border border-dashed rounded-xl bg-slate-50 dark:bg-slate-900">
                                {proofFile ? (
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium truncate max-w-xs">{proofFile.name}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setProofFile(null)}
                                            className="h-6 w-6 p-0"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <input
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                        className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white cursor-pointer"
                                        required
                                    />
                                )}
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Berkas bukti transfer ini akan otomatis dilampirkan dan dikirimkan ke email vendor.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="checkoutNotesInput">Catatan Pembayaran (Opsional)</Label>
                            <Textarea
                                id="checkoutNotesInput"
                                rows={2}
                                value={checkoutNotes}
                                onChange={(e) => setCheckoutNotes(e.target.value)}
                                placeholder="Catatan internal batch pembayaran..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="default"
                            disabled={isProcessingCheckout || !proofFile}
                            onClick={handleExecuteCheckout}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs py-2.5"
                        >
                            {isProcessingCheckout ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                    Memproses Checkout & Mengirim Email ke Vendor...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-1.5" />
                                    Eksekusi Pembayaran & Kirim Bukti ke Vendor
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL 5: DETAIL INVOICE */}
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            Detail Faktur: {selectedInvoice?.invoiceNumber}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedInvoice && (
                        <div className="space-y-4 text-xs">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div>
                                    <span className="text-slate-400 block text-[10px]">Vendor:</span>
                                    <span className="font-semibold">{selectedInvoice.tenant.name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px]">No. PO:</span>
                                    <span className="font-mono font-semibold">{selectedInvoice.poNumber}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px]">Grand Total:</span>
                                    <span className="font-bold text-primary">{formatCurrency(selectedInvoice.grandTotal)}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px]">Status:</span>
                                    {getStatusBadge(selectedInvoice.status)}
                                </div>
                            </div>

                            {/* Dokumen Lampiran */}
                            <div className="space-y-2">
                                <span className="font-semibold block">Dokumen Lampiran:</span>
                                <div className="flex flex-wrap gap-2">
                                    <a
                                        href={resolveUploadDocumentUrl(selectedInvoice.invoiceFileUrl) || selectedInvoice.invoiceFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 flex items-center gap-1 font-medium"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Invoice Fisik
                                    </a>
                                    {selectedInvoice.taxInvoiceFileUrl && (
                                        <a
                                            href={resolveUploadDocumentUrl(selectedInvoice.taxInvoiceFileUrl) || selectedInvoice.taxInvoiceFileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 flex items-center gap-1 font-medium"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            e-Faktur Pajak
                                        </a>
                                    )}
                                    {selectedInvoice.deliveryReceiptFileUrl && (
                                        <a
                                            href={resolveUploadDocumentUrl(selectedInvoice.deliveryReceiptFileUrl) || selectedInvoice.deliveryReceiptFileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-md border border-purple-200 flex items-center gap-1 font-medium"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Surat Jalan / BAP
                                        </a>
                                    )}
                                    {selectedInvoice.paidProofUrl && (
                                        <a
                                            href={resolveUploadDocumentUrl(selectedInvoice.paidProofUrl) || selectedInvoice.paidProofUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-md flex items-center gap-1 font-medium"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Bukti Transfer Bank
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* MODAL 6: UNDANG REKAN VENDOR BARU */}
            <Dialog open={isInviteVendorModalOpen} onOpenChange={setIsInviteVendorModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <UserPlus className="w-5 h-5 text-primary" />
                            Kirim Undangan Resmi Mitra Vendor (Invite-Only)
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Vendor akan menerima tautan aktivasi akun resmi untuk mengisi profil dan mengajukan faktur tagihan.
                        </DialogDescription>
                    </DialogHeader>

                    {inviteSuccessMsg ? (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span>{inviteSuccessMsg}</span>
                        </div>
                    ) : (
                        <form onSubmit={handleInviteVendor} className="space-y-4 text-xs">
                            <div className="space-y-1.5">
                                <Label htmlFor="vName">Nama Perusahaan Vendor *</Label>
                                <Input
                                    id="vName"
                                    placeholder="Contoh: PT Maju Jaya Mandiri"
                                    value={inviteData.name}
                                    onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="vEmail">Email Resmi Penagihan *</Label>
                                    <Input
                                        id="vEmail"
                                        type="email"
                                        placeholder="finance@vendor.com"
                                        value={inviteData.email}
                                        onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="vPhone">No. Telepon / WhatsApp</Label>
                                    <Input
                                        id="vPhone"
                                        placeholder="08123456789"
                                        value={inviteData.phone}
                                        onChange={(e) => setInviteData({ ...inviteData, phone: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="vBank">Bank Pembayaran</Label>
                                    <Input
                                        id="vBank"
                                        placeholder="BCA"
                                        value={inviteData.bankName}
                                        onChange={(e) => setInviteData({ ...inviteData, bankName: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="vAccount">Nomor Rekening</Label>
                                    <Input
                                        id="vAccount"
                                        placeholder="1234567890"
                                        value={inviteData.bankAccountNo}
                                        onChange={(e) => setInviteData({ ...inviteData, bankAccountNo: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="vHolder">Atas Nama Rekening</Label>
                                    <Input
                                        id="vHolder"
                                        placeholder="PT Maju Jaya"
                                        value={inviteData.bankAccountHolder}
                                        onChange={(e) => setInviteData({ ...inviteData, bankAccountHolder: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="vTop">Default Term of Payment (Hari)</Label>
                                    <Input
                                        id="vTop"
                                        type="number"
                                        value={inviteData.defaultTopDays}
                                        onChange={(e) => setInviteData({ ...inviteData, defaultTopDays: Number(e.target.value) || 30 })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="vNpwp">NPWP Perusahaan</Label>
                                    <Input
                                        id="vNpwp"
                                        placeholder="Nomor NPWP"
                                        value={inviteData.npwp}
                                        onChange={(e) => setInviteData({ ...inviteData, npwp: e.target.value })}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isProcessingInvite}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 mt-2"
                            >
                                {isProcessingInvite ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                        Mengirim Email Undangan...
                                    </>
                                ) : (
                                    "Kirim Email Undangan Resmi"
                                )}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
