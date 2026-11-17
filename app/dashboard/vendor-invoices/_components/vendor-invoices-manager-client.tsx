"use client"

import React, { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    approveManagerInvoiceAction,
    createMasterVendorAction,
    createPaymentBatchCheckoutAction,
    createVendorContractAction,
    deleteMasterVendorAction,
    getVendorContractsAction,
    inviteVendorAction,
    lookupSapPoForVendorAction,
    lookupVendorContractAction,
    recheckAdminChecklistAction,
    searchSapVendorMasterAction,
    submitInvoiceByAdminAction,
    updateMasterVendorAction,
    validateFinanceInvoiceAction,
    verifyAdminChecklistAction,
    triggerInvoiceOcrMatchingAction,
    setInvoiceOnHoldAction,
    resolveInvoiceDisputeAction,
    validateDjpTaxInvoiceAction,
    exportBankBatchDisbursementAction,
} from "@/app/actions/vendor-invoices"
import { uploadFile } from "@/app/actions/upload"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"
import { AccentureMasterVendorsView } from "./accenture-master-vendors"
import { AccentureInvoiceEntry } from "./accenture-invoice-entry"
import { AccentureExecutiveDashboard } from "./accenture-executive-dashboard"
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
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ArrowUpRight,
    Building2,
    Calendar,
    CheckCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    CreditCard,
    ClipboardCheck,
    DollarSign,
    Download,
    ExternalLink,
    Eye,
    Edit3,
    FileCheck,
    FilePlus2,
    FileSignature,
    FileSpreadsheet,
    FileText,
    History,
    Layers,
    Loader2,
    Mail,
    Plus,
    Search,
    Send,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    TrendingUp,
    UploadCloud,
    UserPlus,
    Users,
    Wallet,
    X,
    Coins,
    Percent,
    Scissors,
    RefreshCw,
    Paperclip,
    Handshake,
    Scale,
    User,
    Tag,
    Package,
    Car,
    MapPin,
    Landmark,
    Hash,
    Save,
    BarChart3,
    LayoutGrid,
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
        case "on_hold":
            return <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-semibold">⚠️ On-Hold / Sengketa</Badge>
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
    initialSapVendors = [],
    initialContracts = [],
}: {
    initialStats: any
    initialInvoices: any[]
    initialTenants: any[]
    initialSapVendors?: any[]
    initialContracts?: any[]
}) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState("monitoring")
    const [searchTerm, setSearchTerm] = useState("")
    const [sortBy, setSortBy] = useState<"entry_date" | "vendor_name" | "top" | "due_date">("entry_date")
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(50)

    // Modals
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [isAdminChecklistModalOpen, setIsAdminChecklistModalOpen] = useState(false)
    const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false)
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false)
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
    const [isInviteVendorModalOpen, setIsInviteVendorModalOpen] = useState(false)
    const [isProcurementEntryOpen, setIsProcurementEntryOpen] = useState(false)

    // Master Vendor State (CRUD)
    const [tenants, setTenants] = useState<any[]>(initialTenants || [])
    const [isAddVendorOpen, setIsAddVendorOpen] = useState(false)
    const [isEditVendorOpen, setIsEditVendorOpen] = useState(false)
    const [selectedVendorForEdit, setSelectedVendorForEdit] = useState<any | null>(null)
    const [isSavingVendor, setIsSavingVendor] = useState(false)
    const [vendorFormError, setVendorFormError] = useState<string | null>(null)
    const [vendorForm, setVendorForm] = useState({
        name: "",
        code: "",
        sapVendorCode: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        isPkp: true,
        npwp: "",
        bankName: "",
        bankAccountNo: "",
        bankAccountHolder: "",
        defaultTopDays: 30,
    })

    // Master Kontrak State (CRUD)
    const [contracts, setContracts] = useState<any[]>(initialContracts || [])
    const [isAddContractOpen, setIsAddContractOpen] = useState(false)
    const [selectedContractDetail, setSelectedContractDetail] = useState<any | null>(null)
    const [isSavingContract, setIsSavingContract] = useState(false)
    const [contractFormError, setContractFormError] = useState<string | null>(null)
    const [contractForm, setContractForm] = useState({
        contractNumber: "",
        vendorName: "",
        vendorSapCode: "",
        title: "Perjanjian Sewa Menyewa Kendaraan",
        category: "Sewa Kendaraan",
        itemName: "MITSUBISHI TRITON 2.5L DC HDX-L (4X4) MT",
        policeNumber: "DA 8109 HH",
        chassisNumber: "",
        year: 2022,
        location: "Adaro / Tanjung Tabalong",
        contractValue: 15500000,
        billingFrequency: "monthly",
        startDate: "2025-10-09",
        endDate: "2026-10-08",
        topDays: 45,
        isPkp: true,
        ppnPercent: 11,
        pphPercent: 2,
        bankName: "BRI - TANJUNG KOTA",
        bankAccountNumber: "4595-01-028276-53-9",
        bankAccountHolder: "CV TRIMICEL JAYA",
        npwpNumber: "02.919.245.7-735.000",
        vendorAddress: "",
        vendorPicName: "Reny Tiurlina",
        notes: "",
    })
    const [contractPdfFile, setContractPdfFile] = useState<File | null>(null)

    // State Lookup & Sinkronisasi Vendor untuk Master Kontrak
    const [contractVendorSearch, setContractVendorSearch] = useState("")
    const [contractVendorResults, setContractVendorResults] = useState<any[]>([])
    const [isSearchingContractVendor, setIsSearchingContractVendor] = useState(false)
    const [isContractVendorDropdownOpen, setIsContractVendorDropdownOpen] = useState(false)

    // Debounce search vendor untuk master kontrak
    useEffect(() => {
        const query = contractVendorSearch.trim().toLowerCase()
        if (!query || query.length < 1) {
            setContractVendorResults([])
            return
        }

        // 1. Cari di local tenants (Master Vendor terdaftar)
        const matchedTenants = (tenants || [])
            .filter((t) => {
                const name = (t.name || "").toLowerCase()
                const code = (t.code || "").toLowerCase()
                const sap = (t.sapVendorCode || "").toLowerCase()
                return name.includes(query) || code.includes(query) || sap.includes(query)
            })
            .map((t) => ({
                id: `tenant-${t.id}`,
                vendorName: t.name,
                supplierCode: t.sapVendorCode || t.code || "",
                city: t.city || "Indonesia",
                bankName: t.bankName || "",
                bankAccountNumber: t.bankAccountNo || "",
                bankAccountHolder: t.bankAccountHolder || t.name,
                topDays: t.defaultTopDays || 30,
                isPkp: t.isPkp !== false,
                npwp: t.npwp || "",
                source: "Master Vendor",
            }))

        // 2. Cari di initialSapVendors
        const matchedSap = (initialSapVendors || [])
            .filter((s) => {
                const name = (s.vendorName || "").toLowerCase()
                const code = (s.supplierCode || "").toLowerCase()
                return name.includes(query) || code.includes(query)
            })
            .map((s) => ({
                id: `sap-${s.id || s.supplierCode}`,
                vendorName: s.vendorName,
                supplierCode: s.supplierCode,
                city: s.city || "Indonesia",
                bankName: s.bankName || "",
                bankAccountNumber: s.bankAccount || "",
                bankAccountHolder: s.bankAccountHolder || s.vendorName,
                topDays: s.topDays || 30,
                isPkp: s.isPkp !== false,
                npwp: s.taxNumber || s.npwp || "",
                source: "SAP Master",
            }))

        // 3. Cari dari invoice yang ada (termasuk CV. APTA JAYA PRIMA, ODG, dll)
        const matchedInvoices: any[] = []
        const seenNames = new Set(matchedTenants.map((x) => x.vendorName.toLowerCase()))
        ;(initialInvoices || []).forEach((inv) => {
            const vName = inv.tenant?.name || inv.vendorName
            if (vName && vName.toLowerCase().includes(query) && !seenNames.has(vName.toLowerCase())) {
                seenNames.add(vName.toLowerCase())
                matchedInvoices.push({
                    id: `inv-vendor-${vName}`,
                    vendorName: vName,
                    supplierCode: inv.tenant?.sapVendorCode || inv.tenant?.code || "",
                    city: "Indonesia",
                    bankName: inv.tenant?.bankName || "",
                    bankAccountNumber: inv.tenant?.bankAccountNo || "",
                    bankAccountHolder: inv.tenant?.bankAccountHolder || vName,
                    topDays: inv.topDays || 30,
                    isPkp: true,
                    npwp: inv.taxInvoiceNumber || "",
                    source: "Database Invoice",
                })
            }
        })

        // Gabungkan hasil lokal
        const combined = [...matchedTenants, ...matchedSap, ...matchedInvoices]
        setContractVendorResults(combined.slice(0, 10))

        // 4. Cari juga ke server backend SAP Vendor Master
        if (query.length >= 2) {
            setIsSearchingContractVendor(true)
            const timer = setTimeout(async () => {
                try {
                    const serverRes = await searchSapVendorMasterAction(query)
                    if (serverRes && serverRes.length > 0) {
                        const serverMapped = serverRes.map((s: any) => ({
                            id: `server-sap-${s.id || s.supplierCode}`,
                            vendorName: s.vendorName,
                            supplierCode: s.supplierCode,
                            city: s.city || "Indonesia",
                            bankName: s.bankName || "",
                            bankAccountNumber: s.bankAccount || "",
                            bankAccountHolder: s.bankAccountHolder || s.vendorName,
                            topDays: s.topDays || 30,
                            isPkp: s.isPkp !== false,
                            npwp: s.taxNumber || "",
                            source: "SAP Server",
                        }))
                        setContractVendorResults((prev) => {
                            const map = new Map<string, any>()
                            ;[...prev, ...serverMapped].forEach((it) => {
                                const key = (it.vendorName || "").toLowerCase().trim()
                                if (key && !map.has(key)) map.set(key, it)
                            })
                            return Array.from(map.values()).slice(0, 12)
                        })
                    }
                } catch (err) {
                    console.error("Error searching SAP vendor for contract:", err)
                } finally {
                    setIsSearchingContractVendor(false)
                }
            }, 300)
            return () => clearTimeout(timer)
        }
    }, [contractVendorSearch, tenants, initialSapVendors, initialInvoices])

    const handleSelectVendorForContract = (v: any) => {
        const vName = v.vendorName || v.name || ""
        const vSap = v.supplierCode || v.sapVendorCode || v.code || (vName.toLowerCase().includes("apta") ? "2000002" : "2000001")
        const vBank = v.bankName || (vName.toLowerCase().includes("trimicel") ? "BRI - TANJUNG KOTA" : (vName.toLowerCase().includes("apta") ? "BCA - JAKARTA" : "BANK MANDIRI"))
        const vAccNo = v.bankAccountNumber || v.bankAccountNo || (vName.toLowerCase().includes("apta") ? "035-309-8812" : (vName.toLowerCase().includes("trimicel") ? "4595-01-028276-53-9" : ""))
        const vAccHolder = v.bankAccountHolder || vName
        const vTop = Number(v.topDays || v.defaultTopDays) || 30
        const vPpn = v.isPkp !== false ? 11 : 0
        const vPph = 2

        setContractForm((prev) => ({
            ...prev,
            vendorName: vName,
            vendorSapCode: vSap,
            bankName: vBank,
            bankAccountNumber: vAccNo,
            bankAccountHolder: vAccHolder,
            topDays: vTop,
            ppnPercent: vPpn,
            pphPercent: vPph,
            npwpNumber: v.npwp || prev.npwpNumber,
        }))

        setContractVendorSearch(vName)
        setIsContractVendorDropdownOpen(false)
    }

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

    // Finance State (TOP Read-Only from Master Vendor & Re-Check Gate)
    const [financeNotes, setFinanceNotes] = useState("")
    const [financeRecheckPassed, setFinanceRecheckPassed] = useState(false)
    const [isProcessingFinance, setIsProcessingFinance] = useState(false)

    // Procurement Entry State (with Master Vendor SAP Lookup)
    const [procurementVendorId, setProcurementVendorId] = useState("")
    const [procurementSelectedVendor, setProcurementSelectedVendor] = useState<any | null>(null)
    const [procurementVendorSearch, setProcurementVendorSearch] = useState("")
    const [procurementVendorSuggestions, setProcurementVendorSuggestions] = useState<any[]>([])
    const [isSearchingVendorDropdown, setIsSearchingVendorDropdown] = useState(false)
    const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false)
    const [procurementIsPkp, setProcurementIsPkp] = useState(true)
    const [procurementReferenceType, setProcurementReferenceType] = useState<"PO" | "CONTRACT">("PO")
    const [procurementContractNumber, setProcurementContractNumber] = useState("")
    const [procurementContractFile, setProcurementContractFile] = useState<File | null>(null)
    const [isCheckingProcurementContract, setIsCheckingProcurementContract] = useState(false)
    const [procurementContractResult, setProcurementContractResult] = useState<any>(null)
    const [procurementInvoicedItemsCount, setProcurementInvoicedItemsCount] = useState<number>(1)
    const [procurementTotalPoItemsCount, setProcurementTotalPoItemsCount] = useState<number>(1)
    const [procurementPoStatus, setProcurementPoStatus] = useState<string>("open")
    const [procurementInvoiceNumber, setProcurementInvoiceNumber] = useState("")
    const [procurementPoNumber, setProcurementPoNumber] = useState("")
    const [procurementInvoiceDate, setProcurementInvoiceDate] = useState(new Date().toISOString().slice(0, 10))
    const [procurementSubtotal, setProcurementSubtotal] = useState<number>(0)
    const [procurementPpnPercent, setProcurementPpnPercent] = useState<number>(11)
    const [procurementPphPercent, setProcurementPphPercent] = useState<number>(0)
    const [procurementInvoiceFile, setProcurementInvoiceFile] = useState<File | null>(null)
    const [procurementGrSlipFile, setProcurementGrSlipFile] = useState<File | null>(null)
    const [procurementTaxFile, setProcurementTaxFile] = useState<File | null>(null)
    const [procurementPoFile, setProcurementPoFile] = useState<File | null>(null)
    const [procurementDeliveryFile, setProcurementDeliveryFile] = useState<File | null>(null)
    const [procurementNotes, setProcurementNotes] = useState("")
    const [isCheckingProcurementPo, setIsCheckingProcurementPo] = useState(false)
    const [procurementPoResult, setProcurementPoResult] = useState<any>(null)
    const [isSubmittingProcurement, setIsSubmittingProcurement] = useState(false)
    const [procurementError, setProcurementError] = useState<string | null>(null)

    // SAP Master Vendor Search State
    const [sapSearchQuery, setSapSearchQuery] = useState("")
    const [sapSearchResults, setSapSearchResults] = useState<any[]>(initialSapVendors)
    const [isSearchingSap, setIsSearchingSap] = useState(false)

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

    // Invite Vendor State (with SAP link)
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
        sapVendorCode: "",
        sapTopCode: "",
        sapCurrency: "IDR",
    })
    const [isProcessingInvite, setIsProcessingInvite] = useState(false)
    const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null)

    // Filtered lists
    const submittedInvoices = initialInvoices.filter((i) => i.status === "submitted")
    const onHoldInvoices = initialInvoices.filter((i) => i.status === "on_hold")
    const verifiedAdminInvoices = initialInvoices.filter((i) => i.status === "verified_admin")
    const validatedFinanceInvoices = initialInvoices.filter((i) => i.status === "validated_finance")
    const approvedInvoices = initialInvoices.filter((i) => i.status === "approved_manager")
    const paidInvoices = initialInvoices.filter((i) => i.status === "paid")

    const getInvoiceDueDate = (inv: any): Date => {
        if (inv.paymentDueDate) return new Date(inv.paymentDueDate)
        if (inv.scheduledPaymentDate) return new Date(inv.scheduledPaymentDate)
        const base = new Date(inv.invoiceDate || inv.createdAt)
        const topDays = Number(inv.topDays) || 30
        base.setDate(base.getDate() + topDays)
        return base
    }

    const handleSort = (field: "entry_date" | "vendor_name" | "top" | "due_date") => {
        if (sortBy === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc")
        } else {
            setSortBy(field)
            setSortOrder(field === "vendor_name" ? "asc" : "desc")
        }
        setCurrentPage(1)
    }

    const renderSortIcon = (field: "entry_date" | "vendor_name" | "top" | "due_date") => {
        if (sortBy !== field) {
            return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 inline ml-1" />
        }
        return sortOrder === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5 text-primary font-bold inline ml-1" />
        ) : (
            <ArrowDown className="w-3.5 h-3.5 text-primary font-bold inline ml-1" />
        )
    }

    const cleanQuery = searchTerm.toLowerCase().trim()
    const cleanQueryAlnum = cleanQuery.replace(/[^a-z0-9]/g, "")

    const filteredAndSortedInvoices = useMemo(() => {
        return initialInvoices
            .filter((i) => {
                if (!cleanQuery) return true
                const invNum = (i.invoiceNumber || "").toLowerCase()
                const venName = (i.tenant?.name || "").toLowerCase()
                const poNum = (i.poNumber || "").toLowerCase()
                const taxNum = (i.taxInvoiceNumber || "").toLowerCase()

                if (
                    invNum.includes(cleanQuery) ||
                    venName.includes(cleanQuery) ||
                    poNum.includes(cleanQuery) ||
                    taxNum.includes(cleanQuery)
                ) {
                    return true
                }

                if (cleanQueryAlnum.length >= 3) {
                    const normInv = invNum.replace(/[^a-z0-9]/g, "")
                    const normPo = poNum.replace(/[^a-z0-9]/g, "")
                    if (normInv.includes(cleanQueryAlnum) || normPo.includes(cleanQueryAlnum)) {
                        return true
                    }
                }

                return false
            })
            .sort((a, b) => {
                let res = 0
                if (sortBy === "entry_date") {
                    const dateA = new Date(a.createdAt || a.invoiceDate).getTime()
                    const dateB = new Date(b.createdAt || b.invoiceDate).getTime()
                    res = dateA - dateB
                } else if (sortBy === "vendor_name") {
                    res = (a.tenant?.name || "").localeCompare(b.tenant?.name || "")
                } else if (sortBy === "top") {
                    const topA = Number(a.topDays) || 30
                    const topB = Number(b.topDays) || 30
                    res = topA - topB
                } else if (sortBy === "due_date") {
                    const dueA = getInvoiceDueDate(a).getTime()
                    const dueB = getInvoiceDueDate(b).getTime()
                    res = dueA - dueB
                }
                return sortOrder === "asc" ? res : -res
            })
    }, [initialInvoices, cleanQuery, cleanQueryAlnum, sortBy, sortOrder])

    const totalFiltered = filteredAndSortedInvoices.length
    const totalPages = Math.ceil(totalFiltered / pageSize) || 1
    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return filteredAndSortedInvoices.slice(start, start + pageSize)
    }, [filteredAndSortedInvoices, currentPage, pageSize])

    // Enterprise P2P States: On-Hold, OCR Match, Bank Export, DJP Tax
    const [isOnHoldModalOpen, setIsOnHoldModalOpen] = useState(false)
    const [onHoldReason, setOnHoldReason] = useState("Klarifikasi Dokumen / Faktur Pajak")
    const [onHoldNotes, setOnHoldNotes] = useState("")
    const [isSubmittingOnHold, setIsSubmittingOnHold] = useState(false)

    const [isRunningOcrMatch, setIsRunningOcrMatch] = useState(false)
    const [isExportingBank, setIsExportingBank] = useState(false)
    const [exportBankFormat, setExportBankFormat] = useState<"bca" | "mandiri" | "universal">("bca")

    const [taxQrInput, setTaxQrInput] = useState("")
    const [isValidatingDjp, setIsValidatingDjp] = useState(false)

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
        setFinanceRecheckPassed(invoice.financeRecheckPassed || false)
        setFinanceNotes(invoice.financeNotes || "")
        setIsFinanceModalOpen(true)
    }

    // Submit Finance Action (TOP is READ-ONLY, re-check mandatory)
    const handleFinanceAction = async (action: "validate" | "reject") => {
        if (!selectedInvoice) return

        if (action === "validate" && !financeRecheckPassed) {
            alert("Mandatory: Finance wajib mencentang konfirmasi re-check checklist admin sebelum menyetujui.")
            return
        }

        setIsProcessingFinance(true)

        try {
            const res = await validateFinanceInvoiceAction({
                invoiceId: selectedInvoice.id,
                action,
                notes: financeNotes,
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

    // Handler Dispute / On-Hold Hub
    const handleOpenOnHold = (invoice: any) => {
        setSelectedInvoice(invoice)
        setOnHoldReason(invoice.disputeReason || "Klarifikasi Dokumen / Faktur Pajak")
        setOnHoldNotes(invoice.disputeNotes || "")
        setIsOnHoldModalOpen(true)
    }

    const handleConfirmOnHold = async () => {
        if (!selectedInvoice) return
        if (!onHoldNotes.trim()) {
            alert("Mohon isi instruksi/catatan revisi untuk vendor.")
            return
        }
        setIsSubmittingOnHold(true)
        try {
            const res = await setInvoiceOnHoldAction({
                invoiceId: selectedInvoice.id,
                reason: onHoldReason,
                notes: onHoldNotes,
            })
            if (!res.success) {
                alert(res.error || "Gagal mengubah status menjadi On-Hold.")
                return
            }
            setIsOnHoldModalOpen(false)
            setIsAdminChecklistModalOpen(false)
            setIsFinanceModalOpen(false)
            router.refresh()
        } catch (e: any) {
            alert(e.message || "Terjadi kesalahan.")
        } finally {
            setIsSubmittingOnHold(false)
        }
    }

    const handleResolveOnHold = async (invoiceId: string) => {
        if (!confirm("Selesaikan masa On-Hold dan kembalikan invoice ini ke antrean verifikasi?")) return
        try {
            const res = await resolveInvoiceDisputeAction({ invoiceId })
            if (res.success) {
                router.refresh()
            } else {
                alert(res.error || "Gagal menyelesaikan status On-Hold.")
            }
        } catch (e: any) {
            alert(e.message || "Terjadi kesalahan.")
        }
    }

    // Handler AI 3-Way Matching Trigger
    const handleRun3WayMatch = async (invoiceId: string) => {
        setIsRunningOcrMatch(true)
        try {
            const res = await triggerInvoiceOcrMatchingAction(invoiceId)
            if (!res.success) {
                alert(res.error || "Gagal menjalankan 3-Way Matching.")
                return
            }
            alert(
                `3-Way Matching Selesai! Status: ${res.matchResult?.matchStatus?.toUpperCase()}.\n${res.matchResult?.summaryMessage || ""}`
            )
            router.refresh()
        } catch (e: any) {
            alert(e.message || "Terjadi kesalahan.")
        } finally {
            setIsRunningOcrMatch(false)
        }
    }

    // Handler DJP Tax QR Validation
    const handleValidateDjpQr = async (invoiceId: string) => {
        if (!taxQrInput.trim()) {
            alert("Masukkan URL atau scan QR Faktur Pajak DJP terlebih dahulu.")
            return
        }
        setIsValidatingDjp(true)
        try {
            const res = await validateDjpTaxInvoiceAction({
                invoiceId,
                qrUrl: taxQrInput.trim(),
            })
            if (!res.success) {
                alert(res.error || "Gagal memvalidasi faktur DJP.")
                return
            }
            alert(`Faktur Pajak Terverifikasi!\n${res.result?.validationNotes || ""}`)
            router.refresh()
        } catch (e: any) {
            alert(e.message || "Terjadi kesalahan.")
        } finally {
            setIsValidatingDjp(false)
        }
    }

    // Handler Bank Batch Export (BCA / Mandiri / Universal)
    const handleExportBankBatch = async (format: "bca" | "mandiri" | "universal") => {
        if (selectedInvoiceIds.length === 0) {
            alert("Pilih minimal 1 invoice untuk di-export ke format perbankan.")
            return
        }
        setIsExportingBank(true)
        try {
            const res = await exportBankBatchDisbursementAction({
                invoiceIds: selectedInvoiceIds,
                format,
                bankSource,
                batchCode: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`,
            })
            if (!res.success || !res.export) {
                alert(res.error || "Gagal men-generate file batch bank.")
                return
            }

            const blob = new Blob([res.export.content], { type: res.export.mimeType })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = res.export.filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (e: any) {
            alert(e.message || "Terjadi kesalahan export perbankan.")
        } finally {
            setIsExportingBank(false)
        }
    }

    // SAP Vendor Search handler
    const handleSearchSap = async (query: string) => {
        setSapSearchQuery(query)
        if (!query || query.trim().length < 2) {
            setSapSearchResults(initialSapVendors)
            return
        }
        setIsSearchingSap(true)
        try {
            const results = await searchSapVendorMasterAction(query)
            setSapSearchResults(results)
        } catch (err) {
            console.error("Gagal mencari vendor SAP:", err)
        } finally {
            setIsSearchingSap(false)
        }
    }

    // Pilih vendor SAP untuk otomatis isi form invite
    const handleSelectSapForInvite = (v: any) => {
        setInviteData({
            name: v.vendorName,
            email: "",
            phone: v.telephone || "",
            address: `${v.street || ""}, ${v.city || ""}, ${v.country || ""}`.replace(/^,\s*|,\s*$/g, ""),
            defaultTopDays: v.topDays || 30,
            isPkp: true,
            npwp: "",
            bankName: "BCA",
            bankAccountNo: "",
            bankAccountHolder: v.vendorName,
            sapVendorCode: v.supplierCode,
            sapTopCode: v.termsOfPayment || "",
            sapCurrency: v.orderCurrency || "IDR",
        })
        setIsInviteVendorModalOpen(true)
    }

    // Cek PO internal untuk Procurement Entry
    const handleCheckProcurementPo = async () => {
        if (!procurementPoNumber.trim()) return
        setIsCheckingProcurementPo(true)
        setProcurementPoResult(null)
        try {
            const res = await lookupSapPoForVendorAction(procurementPoNumber)
            setProcurementPoResult(res)
            if (res.found) {
                if (res.netValue && procurementSubtotal === 0) {
                    setProcurementSubtotal(res.netValue)
                }
                if (res.totalItems) {
                    setProcurementTotalPoItemsCount(res.totalItems)
                }
                if (res.invoicedItems !== undefined) {
                    const nextItem = res.invoicedItems + 1 > res.totalItems ? res.totalItems : res.invoicedItems + 1
                    setProcurementInvoicedItemsCount(nextItem)
                }
                if (res.poStatus) {
                    setProcurementPoStatus(res.poStatus)
                }
            }
        } catch {
            setProcurementPoResult({ found: false, message: "Gagal memeriksa database SAP." })
        } finally {
            setIsCheckingProcurementPo(false)
        }
    }

    // Cek Kontrak Vendor untuk Entry Berbasis Kontrak
    const handleCheckProcurementContract = async () => {
        if (!procurementContractNumber.trim()) return
        setIsCheckingProcurementContract(true)
        setProcurementContractResult(null)
        try {
            const res = await lookupVendorContractAction(procurementContractNumber)
            setProcurementContractResult(res)
            if (res.found && res.contract) {
                const c = res.contract
                if (procurementSubtotal === 0 && c.contractValue) {
                    setProcurementSubtotal(c.contractValue)
                }
                if (c.ppnPercent !== undefined) setProcurementPpnPercent(c.ppnPercent)
                if (c.pphPercent !== undefined) setProcurementPphPercent(c.pphPercent)
                if (c.isPkp !== undefined) setProcurementIsPkp(c.isPkp)

                // Hubungkan vendor jika belum dipilih
                if (!procurementSelectedVendor && c.vendorName) {
                    const matchTenant = tenants.find((t) => t.name.toLowerCase() === c.vendorName.toLowerCase())
                    if (matchTenant) {
                        handleSelectProcurementVendor({
                            isTenant: true,
                            id: matchTenant.id,
                            supplierCode: matchTenant.code,
                            vendorName: matchTenant.name,
                            topDays: matchTenant.defaultTopDays || c.topDays || 45,
                            isPkp: matchTenant.isPkp,
                            city: matchTenant.city || "",
                        })
                    } else {
                        handleSelectProcurementVendor({
                            isTenant: false,
                            id: `sap:${c.vendorSapCode || "contract"}`,
                            supplierCode: c.vendorSapCode || "KONTRAK",
                            vendorName: c.vendorName,
                            topDays: c.topDays || 45,
                            isPkp: c.isPkp,
                            city: "",
                        })
                    }
                }
            }
        } catch {
            setProcurementContractResult({ found: false, message: "Gagal memeriksa database Kontrak." })
        } finally {
            setIsCheckingProcurementContract(false)
        }
    }

    // Handler Master Vendor CRUD
    const handleSaveVendor = async (e: React.FormEvent) => {
        e.preventDefault()
        setVendorFormError(null)
        if (!vendorForm.name.trim()) {
            setVendorFormError("Nama vendor wajib diisi.")
            return
        }
        setIsSavingVendor(true)
        try {
            if (selectedVendorForEdit) {
                const res = await updateMasterVendorAction(selectedVendorForEdit.id, vendorForm)
                if (!res.success) throw new Error(res.error)
            } else {
                const res = await createMasterVendorAction(vendorForm)
                if (!res.success) throw new Error(res.error)
            }
            setIsAddVendorOpen(false)
            setIsEditVendorOpen(false)
            setSelectedVendorForEdit(null)
            router.refresh()
        } catch (err: any) {
            setVendorFormError(err.message || "Gagal menyimpan data vendor.")
        } finally {
            setIsSavingVendor(false)
        }
    }

    const handleDeleteVendor = async (vendorId: string) => {
        if (!confirm("Nonaktifkan master vendor ini?")) return
        try {
            const res = await deleteMasterVendorAction(vendorId)
            if (res.success) {
                router.refresh()
            }
        } catch (err) {
            console.error(err)
        }
    }

    // Handler Master Kontrak CRUD
    const handleSaveContract = async (e: React.FormEvent) => {
        e.preventDefault()
        setContractFormError(null)
        if (!contractForm.contractNumber.trim()) {
            setContractFormError("Nomor Kontrak wajib diisi.")
            return
        }
        if (!contractForm.vendorName.trim()) {
            setContractFormError("Nama Vendor wajib diisi.")
            return
        }
        if (!contractForm.itemName.trim()) {
            setContractFormError("Nama Barang/Jasa/Unit wajib diisi.")
            return
        }
        setIsSavingContract(true)
        try {
            let contractPdfUrl: string | undefined = undefined
            if (contractPdfFile) {
                const form = new FormData()
                form.append("file", contractPdfFile)
                const up = await uploadFile(form)
                if (up.success && up.url) contractPdfUrl = up.url
            }

            const res = await createVendorContractAction({
                contractNumber: contractForm.contractNumber,
                vendorName: contractForm.vendorName,
                vendorSapCode: contractForm.vendorSapCode,
                title: contractForm.title,
                category: contractForm.category,
                itemName: contractForm.itemName,
                itemDetails: {
                    policeNumber: contractForm.policeNumber,
                    chassisNumber: contractForm.chassisNumber,
                    year: contractForm.year,
                    location: contractForm.location,
                },
                contractValue: Number(contractForm.contractValue) || 0,
                billingFrequency: contractForm.billingFrequency,
                startDate: contractForm.startDate,
                endDate: contractForm.endDate,
                topDays: Number(contractForm.topDays) || 45,
                isPkp: contractForm.isPkp,
                ppnPercent: Number(contractForm.ppnPercent) || 11,
                pphPercent: Number(contractForm.pphPercent) || 2,
                bankName: contractForm.bankName,
                bankAccountNumber: contractForm.bankAccountNumber,
                bankAccountHolder: contractForm.bankAccountHolder,
                npwpNumber: contractForm.npwpNumber,
                vendorAddress: contractForm.vendorAddress,
                vendorPicName: contractForm.vendorPicName,
                notes: contractForm.notes,
                contractFileUrl: contractPdfUrl,
            })

            if (!res.success) throw new Error(res.error)
            setIsAddContractOpen(false)
            setContractPdfFile(null)
            router.refresh()
        } catch (err: any) {
            setContractFormError(err.message || "Gagal menyimpan kontrak.")
        } finally {
            setIsSavingContract(false)
        }
    }

    // Live search untuk dropdown Mitra Vendor (Master SAP + Terdaftar)
    const handleSearchProcurementVendor = async (query: string) => {
        setProcurementVendorSearch(query)
        setIsSearchingVendorDropdown(true)
        setIsVendorDropdownOpen(true)
        try {
            const cleanQuery = (query || "").toLowerCase().trim()
            const tenantMatches = initialTenants
                .filter(
                    (t) =>
                        !cleanQuery ||
                        t.name.toLowerCase().includes(cleanQuery) ||
                        t.code.toLowerCase().includes(cleanQuery)
                )
                .map((t) => ({
                    isTenant: true,
                    id: t.id,
                    supplierCode: t.code,
                    vendorName: t.name,
                    topDays: t.defaultTopDays || 30,
                    isPkp: t.isPkp,
                    city: t.address || "",
                }))

            let sapMatches: any[] = []
            if (cleanQuery.length >= 2) {
                const results = await searchSapVendorMasterAction(query)
                sapMatches = results.map((r) => ({
                    isTenant: false,
                    id: `sap:${r.supplierCode}`,
                    supplierCode: r.supplierCode,
                    vendorName: r.vendorName,
                    topDays: r.topDays || 30,
                    isPkp: true,
                    city: r.city || "",
                    country: r.country || "",
                    termsOfPayment: r.termsOfPayment,
                }))
            } else {
                sapMatches = (initialSapVendors || []).slice(0, 25).map((r) => ({
                    isTenant: false,
                    id: `sap:${r.supplierCode}`,
                    supplierCode: r.supplierCode,
                    vendorName: r.vendorName,
                    topDays: r.topDays || 30,
                    isPkp: true,
                    city: r.city || "",
                    country: r.country || "",
                    termsOfPayment: r.termsOfPayment,
                }))
            }

            const combined = [...tenantMatches, ...sapMatches]
            setProcurementVendorSuggestions(combined.slice(0, 30))
        } catch (err) {
            console.error("Gagal mencari vendor:", err)
        } finally {
            setIsSearchingVendorDropdown(false)
        }
    }

    // Pilih vendor dari hasil lookup
    const handleSelectProcurementVendor = (v: any) => {
        setProcurementSelectedVendor(v)
        setProcurementVendorId(v.id)
        setProcurementVendorSearch(`${v.vendorName} (${v.supplierCode})`)
        setProcurementVendorSuggestions([])
        setIsVendorDropdownOpen(false)
        const pkp = v.isPkp ?? true
        setProcurementIsPkp(pkp)
        setProcurementPpnPercent(pkp ? 11 : 0)
    }

    // Tombol Cepat: Gunakan Vendor dari Hasil Cek PO SAP
    const handleUsePoVendor = async (poVendorName: string, poVendorCode?: string) => {
        if (poVendorCode) {
            const found = await searchSapVendorMasterAction(poVendorCode)
            if (found.length > 0) {
                const sv = found[0]
                handleSelectProcurementVendor({
                    isTenant: false,
                    id: `sap:${sv.supplierCode}`,
                    supplierCode: sv.supplierCode,
                    vendorName: sv.vendorName,
                    topDays: sv.topDays || 30,
                    isPkp: true,
                    city: sv.city || "",
                })
                return
            }
        }
        const foundByName = await searchSapVendorMasterAction(poVendorName)
        if (foundByName.length > 0) {
            const sv = foundByName[0]
            handleSelectProcurementVendor({
                isTenant: false,
                id: `sap:${sv.supplierCode}`,
                supplierCode: sv.supplierCode,
                vendorName: sv.vendorName,
                topDays: sv.topDays || 30,
                isPkp: true,
                city: sv.city || "",
            })
        } else {
            handleSelectProcurementVendor({
                isTenant: false,
                id: `sap:${poVendorCode || "temp"}`,
                supplierCode: poVendorCode || "PO-REF",
                vendorName: poVendorName,
                topDays: 30,
                isPkp: true,
            })
        }
    }

    // Submit Procurement Entry on behalf of Vendor
    const handleProcurementSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setProcurementError(null)

        if (!procurementVendorId) {
            setProcurementError("Pilih Vendor penerima tagihan dari Master Vendor.")
            return
        }
        if (!procurementInvoiceNumber.trim()) {
            setProcurementError("Nomor Invoice wajib diisi.")
            return
        }
        if (procurementReferenceType === "CONTRACT") {
            if (!procurementContractNumber.trim()) {
                setProcurementError("Nomor Kontrak wajib diisi.")
                return
            }
        } else {
            if (!procurementPoNumber.trim()) {
                setProcurementError("Nomor PO wajib diisi.")
                return
            }
        }
        if (procurementSubtotal <= 0) {
            setProcurementError("Subtotal nominal tagihan harus lebih dari 0.")
            return
        }
        if (!procurementInvoiceFile) {
            setProcurementError("Berkas Invoice fisik wajib diunggah.")
            return
        }

        // Minimal salah satu antara GR Slip ATAU Surat Jalan/BAST/Absen wajib diunggah
        if (!procurementGrSlipFile && !procurementDeliveryFile) {
            setProcurementError("Wajib melampirkan minimal salah satu bukti penerimaan: Lampiran GR Slip atau Surat Jalan / BAST / Rekap Absen.")
            return
        }

        // Wajib e-Faktur Pajak bagi Vendor PKP
        const isPkp = procurementIsPkp || procurementPpnPercent > 0
        if (isPkp && !procurementTaxFile) {
            setProcurementError("Vendor PKP wajib melampirkan berkas e-Faktur Pajak.")
            return
        }

        setIsSubmittingProcurement(true)

        try {
            // Upload Invoice File (Mandatory)
            const invForm = new FormData()
            invForm.append("file", procurementInvoiceFile)
            const upInv = await uploadFile(invForm)
            if (!upInv.success || !upInv.url) {
                throw new Error("Gagal mengunggah berkas invoice: " + upInv.error)
            }

            // Upload GR Slip if provided
            let grUrl: string | undefined = undefined
            if (procurementGrSlipFile) {
                const grForm = new FormData()
                grForm.append("file", procurementGrSlipFile)
                const upGr = await uploadFile(grForm)
                if (!upGr.success || !upGr.url) {
                    throw new Error("Gagal mengunggah berkas GR Slip: " + upGr.error)
                }
                grUrl = upGr.url
            }

            // Upload Surat Jalan / BAST / Absen if provided
            let delivUrl: string | undefined = undefined
            if (procurementDeliveryFile) {
                const delivForm = new FormData()
                delivForm.append("file", procurementDeliveryFile)
                const upDeliv = await uploadFile(delivForm)
                if (!upDeliv.success || !upDeliv.url) {
                    throw new Error("Gagal mengunggah berkas Surat Jalan / BAST / Absen: " + upDeliv.error)
                }
                delivUrl = upDeliv.url
            }

            // Upload Tax File if exists (Mandatory if PKP)
            let taxUrl: string | undefined = undefined
            if (procurementTaxFile) {
                const taxForm = new FormData()
                taxForm.append("file", procurementTaxFile)
                const upTax = await uploadFile(taxForm)
                if (upTax.success && upTax.url) taxUrl = upTax.url
            }

            // Upload PO copy if exists
            let poUrl: string | undefined = undefined
            if (procurementPoFile) {
                const poForm = new FormData()
                poForm.append("file", procurementPoFile)
                const upPo = await uploadFile(poForm)
                if (upPo.success && upPo.url) poUrl = upPo.url
            }

            // Upload Contract File if exists
            let contractUrl: string | undefined = undefined
            if (procurementContractFile) {
                const contractFormData = new FormData()
                contractFormData.append("file", procurementContractFile)
                const upContract = await uploadFile(contractFormData)
                if (upContract.success && upContract.url) contractUrl = upContract.url
            }

            const res = await submitInvoiceByAdminAction({
                tenantId: procurementVendorId,
                invoiceNumber: procurementInvoiceNumber,
                poNumber: procurementReferenceType === "PO" ? procurementPoNumber : (procurementContractNumber || "-"),
                referenceType: procurementReferenceType,
                contractNumber: procurementContractNumber,
                invoiceDate: procurementInvoiceDate,
                subtotal: procurementSubtotal,
                ppnPercent: procurementPpnPercent,
                pphPercent: procurementPphPercent,
                invoiceFileUrl: upInv.url,
                grSlipFileUrl: grUrl,
                deliveryReceiptFileUrl: delivUrl,
                taxInvoiceFileUrl: taxUrl,
                poFileUrl: poUrl,
                contractFileUrl: contractUrl,
                invoicedItemsCount: procurementInvoicedItemsCount,
                totalPoItemsCount: procurementTotalPoItemsCount,
                poStatus: procurementPoStatus,
                notes: procurementNotes,
            })

            if (!res.success) {
                throw new Error(res.error || "Gagal menyimpan entry invoice.")
            }

            // Reset form
            setIsProcurementEntryOpen(false)
            setProcurementInvoiceNumber("")
            setProcurementPoNumber("")
            setProcurementContractNumber("")
            setProcurementContractFile(null)
            setProcurementContractResult(null)
            setProcurementPoResult(null)
            setProcurementSubtotal(0)
            setProcurementInvoiceFile(null)
            setProcurementGrSlipFile(null)
            setProcurementTaxFile(null)
            setProcurementPoFile(null)
            setProcurementDeliveryFile(null)
            setProcurementSelectedVendor(null)
            setProcurementVendorId("")
            setProcurementVendorSearch("")
            setIsVendorDropdownOpen(false)
            router.refresh()
        } catch (err: any) {
            setProcurementError(err.message || "Terjadi kesalahan saat submit entry invoice.")
        } finally {
            setIsSubmittingProcurement(false)
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
                `Pembayaran batch ${res.batch?.batchCode || ""} berhasil diproses! Bukti transfer telah otomatis dikirimkan ke email masing-masing vendor.`
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

    if (isProcurementEntryOpen) {
        return (
            <AccentureInvoiceEntry
                onBack={() => setIsProcurementEntryOpen(false)}
                onSuccess={() => {
                    setIsProcurementEntryOpen(false)
                    router.refresh()
                }}
                initialSapVendors={initialSapVendors}
                initialTenants={tenants}
            />
        )
    }

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
                {activeTab !== "monitoring" && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
                        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            <TabsTrigger value="monitoring" className="text-xs flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5" />
                                Monitoring & Proyeksi
                            </TabsTrigger>
                            <TabsTrigger value="aging" className="text-xs flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                AP Aging (Umur Utang)
                            </TabsTrigger>
                            <TabsTrigger value="on_hold" className="text-xs flex items-center gap-1.5 relative">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                Sengketa (On-Hold)
                                {onHoldInvoices.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.2 bg-amber-600 text-white text-[10px] font-bold rounded-full">
                                        {onHoldInvoices.length}
                                    </span>
                                )}
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
                            <TabsTrigger value="contracts" className="text-xs flex items-center gap-1.5 relative">
                                <FileText className="w-3.5 h-3.5" />
                                Master Kontrak
                                {contracts.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-bold rounded-full">
                                        {contracts.length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="vendors" className="text-xs flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" />
                                Master Vendor
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                onClick={() => setIsProcurementEntryOpen(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5 shadow-sm"
                            >
                                <FilePlus2 className="w-4 h-4" />
                                Entry Invoice (Procurement)
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setIsInviteVendorModalOpen(true)}
                                className="bg-primary hover:bg-primary/90 text-white text-xs flex items-center gap-1.5 shadow-sm"
                            >
                                <UserPlus className="w-4 h-4" />
                                Undang Vendor Baru
                            </Button>
                        </div>
                    </div>
                )}

                {/* TAB 1: MONITORING & PROYEKSI 3 BULAN */}
                <TabsContent value="monitoring" className="space-y-6">
                    <AccentureExecutiveDashboard
                        invoices={initialInvoices}
                        stats={initialStats}
                        onSelectInvoice={(inv) => {
                            setSelectedInvoice(inv)
                            setIsDetailModalOpen(true)
                        }}
                        onOpenTab={(tabKey) => {
                            setActiveTab(tabKey)
                        }}
                        onOpenAddContract={() => {
                            setIsAddContractOpen(true)
                        }}
                        onOpenAddVendor={() => {
                            setIsAddVendorOpen(true)
                        }}
                        onOpenProcurementEntry={() => {
                            setIsProcurementEntryOpen(true)
                        }}
                    />
                </TabsContent>

                {/* TAB: AP AGING DASHBOARD */}
                <TabsContent value="aging" className="space-y-6">
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                        <CardHeader className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-amber-500" />
                                    Analisis Umur Utang Vendor (Accounts Payable Aging)
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500 mt-0.5">
                                    Pantau jatuh tempo seluruh tagihan belum lunas untuk menjaga likuiditas dan memprioritaskan pembayaran vendor.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                    Total Utang Aktif: <strong className="ml-1 text-slate-900 dark:text-slate-100">{formatCurrency(initialStats?.apAging?.totalOutstandingAmount || 0)}</strong>
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-6">
                            {/* 5 Buckets Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                {/* Current */}
                                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900 space-y-1">
                                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 block">
                                        Current (Belum JT)
                                    </span>
                                    <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                                        {formatCurrency(initialStats?.apAging?.current?.totalAmount || 0)}
                                    </div>
                                    <span className="text-[10px] text-slate-500 block">
                                        {initialStats?.apAging?.current?.count || 0} Invoice
                                    </span>
                                </div>

                                {/* 1 - 30 Hari */}
                                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900 space-y-1">
                                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
                                        1 - 30 Hari Overdue
                                    </span>
                                    <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                                        {formatCurrency(initialStats?.apAging?.aging1To30?.totalAmount || 0)}
                                    </div>
                                    <span className="text-[10px] text-slate-500 block">
                                        {initialStats?.apAging?.aging1To30?.count || 0} Invoice
                                    </span>
                                </div>

                                {/* 31 - 60 Hari */}
                                <div className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/40 dark:bg-orange-950/20 dark:border-orange-900 space-y-1">
                                    <span className="text-[11px] font-bold text-orange-800 dark:text-orange-300 block">
                                        31 - 60 Hari Overdue
                                    </span>
                                    <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                                        {formatCurrency(initialStats?.apAging?.aging31To60?.totalAmount || 0)}
                                    </div>
                                    <span className="text-[10px] text-slate-500 block">
                                        {initialStats?.apAging?.aging31To60?.count || 0} Invoice
                                    </span>
                                </div>

                                {/* 61 - 90 Hari */}
                                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 dark:bg-rose-950/20 dark:border-rose-900 space-y-1">
                                    <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 block">
                                        61 - 90 Hari Overdue
                                    </span>
                                    <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                                        {formatCurrency(initialStats?.apAging?.aging61To90?.totalAmount || 0)}
                                    </div>
                                    <span className="text-[10px] text-slate-500 block">
                                        {initialStats?.apAging?.aging61To90?.count || 0} Invoice
                                    </span>
                                </div>

                                {/* > 90 Hari */}
                                <div className="p-3.5 rounded-xl border border-red-300 bg-red-50/50 dark:bg-red-950/30 dark:border-red-900 space-y-1">
                                    <span className="text-[11px] font-bold text-red-800 dark:text-red-300 block">
                                        &gt; 90 Hari (Kritis)
                                    </span>
                                    <div className="text-lg font-black text-red-600 dark:text-red-400">
                                        {formatCurrency(initialStats?.apAging?.agingOver90?.totalAmount || 0)}
                                    </div>
                                    <span className="text-[10px] text-red-600 block">
                                        {initialStats?.apAging?.agingOver90?.count || 0} Invoice
                                    </span>
                                </div>
                            </div>

                            {/* Daftar Invoice AP Aging */}
                            <div className="border rounded-xl overflow-hidden">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 font-semibold text-xs border-b">
                                    Rincian Tagihan Belum Lunas Menurut Kategori Umur Utang
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase font-semibold border-b text-[11px]">
                                            <tr>
                                                <th className="px-4 py-3">No. Invoice &amp; PO</th>
                                                <th className="px-4 py-3">Vendor / Rekanan</th>
                                                <th className="px-4 py-3">Net Payable</th>
                                                <th className="px-4 py-3">Jatuh Tempo</th>
                                                <th className="px-4 py-3">Kategori Aging</th>
                                                <th className="px-4 py-3">Status Saat Ini</th>
                                                <th className="px-4 py-3 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {initialInvoices
                                                .filter((i) => i.status !== "paid" && !i.status.startsWith("rejected"))
                                                .map((inv) => {
                                                    const now = new Date()
                                                    now.setHours(0, 0, 0, 0)
                                                    const targetDate = inv.scheduledPaymentDate || inv.paymentDueDate
                                                    let daysOverdue = 0
                                                    if (targetDate) {
                                                        const d = new Date(targetDate)
                                                        d.setHours(0, 0, 0, 0)
                                                        daysOverdue = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
                                                    }

                                                    let badge = <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Current</Badge>
                                                    if (daysOverdue > 90) {
                                                        badge = <Badge className="bg-red-100 text-red-800 border-red-300 font-bold">&gt; 90 Hari ({daysOverdue}h)</Badge>
                                                    } else if (daysOverdue > 60) {
                                                        badge = <Badge className="bg-rose-100 text-rose-800 border-rose-300">61-90 Hari ({daysOverdue}h)</Badge>
                                                    } else if (daysOverdue > 30) {
                                                        badge = <Badge className="bg-orange-100 text-orange-800 border-orange-300">31-60 Hari ({daysOverdue}h)</Badge>
                                                    } else if (daysOverdue > 0) {
                                                        badge = <Badge className="bg-amber-100 text-amber-800 border-amber-300">1-30 Hari ({daysOverdue}h)</Badge>
                                                    }

                                                    return (
                                                        <tr key={inv.id} className="hover:bg-slate-50/60">
                                                            <td className="px-4 py-3 font-mono font-semibold">
                                                                {inv.invoiceNumber}
                                                                <div className="text-[10px] text-slate-400 font-sans font-normal">PO: {inv.poNumber}</div>
                                                            </td>
                                                            <td className="px-4 py-3 font-medium">{inv.tenant?.name || "-"}</td>
                                                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                                                {formatCurrency(inv.netPayable || inv.grandTotal)}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-600">
                                                                {formatDate(targetDate)}
                                                            </td>
                                                            <td className="px-4 py-3">{badge}</td>
                                                            <td className="px-4 py-3">{getStatusBadge(inv.status)}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-xs px-2.5"
                                                                    onClick={() => {
                                                                        setSelectedInvoice(inv)
                                                                        setIsDetailModalOpen(true)
                                                                    }}
                                                                >
                                                                    <Eye className="w-3 h-3 mr-1" />
                                                                    Detail
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB: SENGKETA / ON-HOLD HUB */}
                <TabsContent value="on_hold" className="space-y-4">
                    <Card className="shadow-xs border-amber-200 dark:border-amber-900/60">
                        <CardHeader className="p-4 border-b bg-amber-50/30 dark:bg-amber-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-900 dark:text-amber-300">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                    Manajemen Status Sengketa Tagihan (Dispute / On-Hold Hub)
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500 mt-0.5">
                                    Tagihan yang ditahan untuk klarifikasi dokumen, revisi faktur pajak, atau verifikasi fisik tanpa membatalkan invoice.
                                </CardDescription>
                            </div>
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300">
                                {onHoldInvoices.length} Tagihan Ditahan
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b">
                                        <tr>
                                            <th className="px-4 py-3">No. Invoice &amp; PO</th>
                                            <th className="px-4 py-3">Vendor / Rekanan</th>
                                            <th className="px-4 py-3">Nominal Tagihan</th>
                                            <th className="px-4 py-3">Alasan Sengketa / Penahanan</th>
                                            <th className="px-4 py-3">Catatan Klarifikasi</th>
                                            <th className="px-4 py-3 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {onHoldInvoices.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                    Tidak ada tagihan yang berstatus On-Hold / Sengketa saat ini. Semua dokumen berjalan lancar!
                                                </td>
                                            </tr>
                                        ) : (
                                            onHoldInvoices.map((inv) => (
                                                <tr key={inv.id} className="hover:bg-amber-50/30 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                                            {inv.invoiceNumber}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">PO: {inv.poNumber}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-medium">{inv.tenant?.name}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                                        {formatCurrency(inv.netPayable || inv.grandTotal)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                                                            {inv.disputeReason || "Klarifikasi Dokumen"}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                                                        {inv.disputeNotes || "-"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleResolveOnHold(inv.id)}
                                                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                            >
                                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                                Selesaikan &amp; Lanjutkan
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-xs"
                                                                onClick={() => {
                                                                    setSelectedInvoice(inv)
                                                                    setIsDetailModalOpen(true)
                                                                }}
                                                            >
                                                                <Eye className="w-3 h-3 mr-1" />
                                                                Detail
                                                            </Button>
                                                        </div>
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
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleExportBankBatch("bca")}
                                            disabled={isExportingBank}
                                            className="text-xs h-7 px-2.5 hover:bg-white dark:hover:bg-slate-700 font-medium flex items-center gap-1"
                                            title="Download format CSV BCA KlikBCA Bisnis Multi-Transfer"
                                        >
                                            <Download className="w-3.5 h-3.5 text-blue-600" />
                                            BCA KlikBCA
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleExportBankBatch("mandiri")}
                                            disabled={isExportingBank}
                                            className="text-xs h-7 px-2.5 hover:bg-white dark:hover:bg-slate-700 font-medium flex items-center gap-1"
                                            title="Download format CSV Mandiri MCM II Corporate Transfer"
                                        >
                                            <Download className="w-3.5 h-3.5 text-amber-600" />
                                            Mandiri MCM
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleExportBankBatch("universal")}
                                            disabled={isExportingBank}
                                            className="text-xs h-7 px-2.5 hover:bg-white dark:hover:bg-slate-700 font-medium flex items-center gap-1"
                                            title="Download format CSV Excel AP Disbursement"
                                        >
                                            <Download className="w-3.5 h-3.5 text-emerald-600" />
                                            Universal CSV
                                        </Button>
                                    </div>

                                    <Button
                                        size="sm"
                                        onClick={() => setIsCheckoutModalOpen(true)}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md h-8"
                                    >
                                        <CreditCard className="w-4 h-4" />
                                        Checkout ({selectedInvoiceIds.length}) &bull; {formatCurrency(totalSelectedAmount)}
                                    </Button>
                                </div>
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

                {/* TAB 5: MASTER KONTRAK */}
                <TabsContent value="contracts" className="space-y-4">
                    <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                        <CardHeader className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" />
                                    Database Master Kontrak Vendor &amp; Perjanjian Sewa
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500">
                                    Pengelolaan kontrak payung, sewa kendaraan/alat berat, dan jasa rutin vendor sebagai dasar penagihan berulang.
                                </CardDescription>
                            </div>

                            <Button
                                size="sm"
                                onClick={() => {
                                    setContractFormError(null)
                                    setIsAddContractOpen(true)
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1.5 shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Buat Kontrak Baru
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold border-b">
                                        <tr>
                                            <th className="px-4 py-3">No. Kontrak &amp; Judul</th>
                                            <th className="px-4 py-3">Vendor / Mitra</th>
                                            <th className="px-4 py-3">Barang / Jasa / Unit</th>
                                            <th className="px-4 py-3">Nilai Sewa (Bulan)</th>
                                            <th className="px-4 py-3">Realisasi &amp; Pagu</th>
                                            <th className="px-4 py-3">Masa Berlaku</th>
                                            <th className="px-4 py-3">TOP &amp; Status</th>
                                            <th className="px-4 py-3 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {contracts.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                                                    Belum ada kontrak vendor yang tercatat. Klik tombol &quot;Buat Kontrak Baru&quot; untuk menambahkan kontrak sewa atau jasa.
                                                </td>
                                            </tr>
                                        ) : (
                                            contracts.map((ct) => (
                                                <tr key={ct.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                                                            {ct.contractNumber}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">
                                                            {ct.title || "Perjanjian Sewa / Kontrak"}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{ct.vendorName}</div>
                                                        {ct.vendorSapCode && (
                                                            <div className="font-mono text-[10px] text-slate-400">
                                                                SAP: {ct.vendorSapCode}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{ct.itemName}</div>
                                                        {ct.itemDetails && typeof ct.itemDetails === "object" && (
                                                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                                                                {ct.itemDetails.policeNumber && (
                                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-slate-50">
                                                                        Plat: {ct.itemDetails.policeNumber}
                                                                    </Badge>
                                                                )}
                                                                {ct.itemDetails.location && (
                                                                    <span>Lokasi: {ct.itemDetails.location}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                                                        {formatCurrency(ct.contractValue)}
                                                        <span className="text-[10px] text-slate-400 font-normal block">
                                                            / {ct.billingFrequency === "monthly" ? "bulan" : ct.billingFrequency}
                                                        </span>
                                                        {ct.projectCategory === "sipil" && (
                                                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] mt-0.5">
                                                                Pekerjaan Sipil (Retensi 5%)
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-1 w-36">
                                                            <div className="flex justify-between text-[10px]">
                                                                <span className="text-slate-500">Terpakai:</span>
                                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(ct.totalInvoiced || 0)}</span>
                                                            </div>
                                                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${
                                                                        (ct.burnRatePercent || 0) > 85 ? "bg-red-500" : "bg-indigo-600"
                                                                    }`}
                                                                    style={{ width: `${Math.min(100, ct.burnRatePercent || 0)}%` }}
                                                                />
                                                            </div>
                                                            <div className="flex justify-between text-[9px]">
                                                                <span className="text-slate-400">Burn: {(ct.burnRatePercent || 0).toFixed(0)}%</span>
                                                                <span className="text-emerald-700 font-medium">Sisa: {formatCurrency(ct.remainingBalance || ct.contractValue || 0)}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-slate-700 dark:text-slate-300">
                                                            {formatDate(ct.startDate)} s.d {formatDate(ct.endDate)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold">{ct.topDays || 45} Hari</div>
                                                        <Badge className={ct.status === "active" ? "bg-emerald-100 text-emerald-800 text-[10px]" : "bg-slate-100 text-slate-600 text-[10px]"}>
                                                            {ct.status === "active" ? "Aktif" : ct.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setSelectedContractDetail(ct)}
                                                                className="text-xs h-7 px-2"
                                                            >
                                                                Detail
                                                            </Button>
                                                            {ct.contractFileUrl && (
                                                                <a
                                                                    href={resolveUploadDocumentUrl(ct.contractFileUrl) || ct.contractFileUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="h-7 px-2 text-xs inline-flex items-center gap-1 rounded border border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                    PDF
                                                                </a>
                                                            )}
                                                        </div>
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

                {/* TAB 6: MASTER VENDOR & UNDANGAN (ACCENTURE VPMS STANDARD CRUD) */}
                <TabsContent value="vendors" className="space-y-4">
                    <AccentureMasterVendorsView />
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

                            {/* Status PO Tracking & Kontrak */}
                            <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500 font-medium">Jenis Dokumen Referensi:</span>
                                    <Badge className={selectedInvoice.referenceType === "CONTRACT" ? "bg-indigo-600 text-white" : "bg-blue-600 text-white"}>
                                        {selectedInvoice.referenceType === "CONTRACT" ? "KONTRAK KERJA SAMA" : "PURCHASE ORDER (PO)"}
                                    </Badge>
                                    {selectedInvoice.referenceType === "CONTRACT" ? (
                                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                            No: {selectedInvoice.contractNumber || "-"}
                                        </span>
                                    ) : (
                                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                            PO: {selectedInvoice.poNumber}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    {selectedInvoice.referenceType === "CONTRACT" ? (
                                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300">
                                            Kontrak Aktif
                                        </Badge>
                                    ) : (
                                        <Badge
                                            className={
                                                selectedInvoice.poStatus === "completed"
                                                    ? "bg-emerald-600 text-white"
                                                    : selectedInvoice.poStatus === "partial"
                                                    ? "bg-amber-600 text-white"
                                                    : "bg-slate-600 text-white"
                                            }
                                        >
                                            {selectedInvoice.poStatus === "completed"
                                                ? "PO COMPLETED (FULL)"
                                                : selectedInvoice.poStatus === "partial"
                                                ? `PO PARTIAL (${selectedInvoice.invoicedItemsCount || 0}/${selectedInvoice.totalPoItemsCount || 0} Item)`
                                                : "PO OPEN"}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* 5 Dokumen Referensi Berurutan: PO/Kontrak -> DO/BAST/Absen -> GR Slip -> Invoice -> Faktur Pajak */}
                            <div className="space-y-2 p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-blue-900 dark:text-blue-200 text-xs flex items-center gap-1.5">
                                        <FileCheck className="w-4 h-4 text-blue-600" />
                                        Alur 5 Dokumen Referensi Verifikasi (Berurutan):
                                    </span>
                                    <span className="text-[10px] text-blue-700 dark:text-blue-300 italic">
                                        Wajib saling mendukung &amp; sesuai
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center">
                                    {/* 1. PO / Kontrak */}
                                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 block">1. PO / Kontrak</span>
                                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                                                {selectedInvoice.referenceType === "CONTRACT"
                                                    ? selectedInvoice.contractNumber || "Kontrak"
                                                    : selectedInvoice.poNumber || "PO"}
                                            </span>
                                        </div>
                                        <div className="mt-2">
                                            {selectedInvoice.contractFileUrl || selectedInvoice.poFileUrl ? (
                                                <a
                                                    href={resolveUploadDocumentUrl(selectedInvoice.contractFileUrl || selectedInvoice.poFileUrl) || ""}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="w-full py-1 text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded border border-indigo-200 font-semibold inline-flex items-center justify-center gap-1"
                                                >
                                                    <ExternalLink className="w-2.5 h-2.5" /> Buka Berkas
                                                </a>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">Data SAP/Sistem</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. DO / BAST / Absen */}
                                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 block">2. DO / BAST / Absen</span>
                                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                                                Surat Jalan / BAST
                                            </span>
                                        </div>
                                        <div className="mt-2">
                                            {selectedInvoice.deliveryReceiptFileUrl ? (
                                                <a
                                                    href={resolveUploadDocumentUrl(selectedInvoice.deliveryReceiptFileUrl) || selectedInvoice.deliveryReceiptFileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="w-full py-1 text-[10px] bg-purple-50 text-purple-700 hover:bg-purple-100 rounded border border-purple-200 font-semibold inline-flex items-center justify-center gap-1"
                                                >
                                                    <ExternalLink className="w-2.5 h-2.5" /> Buka DO/BAST
                                                </a>
                                            ) : (
                                                <span className="text-[10px] text-amber-600 font-medium">Tidak terlampir</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. GR Slip */}
                                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 block">3. GR Slip</span>
                                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                                                Goods Receipt
                                            </span>
                                        </div>
                                        <div className="mt-2">
                                            {selectedInvoice.grSlipFileUrl ? (
                                                <a
                                                    href={resolveUploadDocumentUrl(selectedInvoice.grSlipFileUrl) || selectedInvoice.grSlipFileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="w-full py-1 text-[10px] bg-blue-600 text-white hover:bg-blue-700 rounded font-semibold inline-flex items-center justify-center gap-1 shadow-xs"
                                                >
                                                    <ExternalLink className="w-2.5 h-2.5" /> Buka GR Slip
                                                </a>
                                            ) : (
                                                <span className="text-[10px] text-amber-600 font-medium">Tidak terlampir</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. Invoice Fisik Tagihan */}
                                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 block">4. Invoice Fisik</span>
                                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                                                {selectedInvoice.invoiceNumber}
                                            </span>
                                        </div>
                                        <div className="mt-2">
                                            {selectedInvoice.invoiceFileUrl ? (
                                                <a
                                                    href={resolveUploadDocumentUrl(selectedInvoice.invoiceFileUrl) || selectedInvoice.invoiceFileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="w-full py-1 text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 font-semibold inline-flex items-center justify-center gap-1"
                                                >
                                                    <ExternalLink className="w-2.5 h-2.5" /> Buka Invoice
                                                </a>
                                            ) : (
                                                <span className="text-[10px] text-red-500 font-medium">Wajib Ada</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 5. Faktur Pajak */}
                                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 block">5. Faktur Pajak</span>
                                            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                                                e-Faktur DJP
                                            </span>
                                        </div>
                                        <div className="mt-2">
                                            {selectedInvoice.taxInvoiceFileUrl ? (
                                                <a
                                                    href={resolveUploadDocumentUrl(selectedInvoice.taxInvoiceFileUrl) || selectedInvoice.taxInvoiceFileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="w-full py-1 text-[10px] bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 font-semibold inline-flex items-center justify-center gap-1"
                                                >
                                                    <ExternalLink className="w-2.5 h-2.5" /> Buka e-Faktur
                                                </a>
                                            ) : (
                                                <span className="text-[10px] text-slate-400">
                                                    {selectedInvoice.tenant.isPkp ? "Wajib PKP" : "Non-PKP"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 5 Mandatory Checklists */}
                            <div className="space-y-3 p-4 border rounded-xl bg-white dark:bg-slate-900">
                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center justify-between">
                                    <span>5 Butir Pengecekan Wajib (Mandatory Checklist)</span>
                                    <span className="text-[10px] text-blue-600 font-semibold normal-case">
                                        PO &rarr; DO &rarr; GR Slip &rarr; Invoice &rarr; Faktur Pajak
                                    </span>
                                </h4>

                                <div className="space-y-2.5">
                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <Checkbox
                                            checked={adminChecklist.docValid}
                                            onCheckedChange={(c) => setAdminChecklist({ ...adminChecklist, docValid: Boolean(c) })}
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                1. Validitas &amp; Keterbacaan Berkas Fisik Invoice
                                            </span>
                                            <p className="text-[11px] text-slate-500">
                                                Berkas PDF/Scan Invoice asli tidak rusak, nomor invoice, tanggal dan stempel basah terbaca jelas.
                                            </p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <Checkbox
                                            checked={adminChecklist.poValid}
                                            onCheckedChange={(c) => setAdminChecklist({ ...adminChecklist, poValid: Boolean(c) })}
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                2. Kesesuaian Dokumen Referensi Utama (PO / Kontrak)
                                            </span>
                                            <p className="text-[11px] text-slate-500">
                                                {selectedInvoice.referenceType === "CONTRACT"
                                                    ? `Nomor Kontrak ${selectedInvoice.contractNumber || "-"} sesuai masa berlaku dan perjanjian sewa/jasa One Chitra.`
                                                    : `Nomor PO ${selectedInvoice.poNumber} cocok dengan SAP. Status PO: ${selectedInvoice.poStatus?.toUpperCase() || "OPEN"}.`}
                                            </p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <Checkbox
                                            checked={adminChecklist.calcValid}
                                            onCheckedChange={(c) => setAdminChecklist({ ...adminChecklist, calcValid: Boolean(c) })}
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                3. Kesesuaian Bukti Penerimaan (DO / BAST / Absen &amp; GR Slip)
                                            </span>
                                            <p className="text-[11px] text-slate-500">
                                                Barang/jasa pada DO/BAST sesuai dengan GR Slip yang telah divalidasi bagian penerimaan/lapangan.
                                            </p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <Checkbox
                                            checked={adminChecklist.bankValid}
                                            onCheckedChange={(c) => setAdminChecklist({ ...adminChecklist, bankValid: Boolean(c) })}
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                4. Akurasi Kalkulasi Nominal &amp; Rekening Bank Vendor
                                            </span>
                                            <p className="text-[11px] text-slate-500">
                                                Subtotal DPP ({formatCurrency(selectedInvoice.subtotal)}) + PPN/PPh cocok dengan Grand Total ({formatCurrency(selectedInvoice.grandTotal)}), serta rekening bank sesuai Master Vendor ({selectedInvoice.tenant.bankName}: {selectedInvoice.tenant.bankAccountNo}).
                                            </p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-2.5 cursor-pointer">
                                        <Checkbox
                                            checked={adminChecklist.taxValid}
                                            onCheckedChange={(c) => setAdminChecklist({ ...adminChecklist, taxValid: Boolean(c) })}
                                        />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                5. Kelengkapan Faktur Pajak e-Faktur DJP
                                            </span>
                                            <p className="text-[11px] text-slate-500">
                                                {selectedInvoice.tenant.isPkp
                                                    ? "Vendor PKP: e-Faktur terlampir, NPWP sesuai, dan nilai PPN sinkron dengan tagihan."
                                                    : "Vendor Non-PKP: Dikecualikan dari kewajiban Faktur Pajak."}
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
                            variant="outline"
                            size="sm"
                            disabled={isProcessingAdmin}
                            onClick={() => handleOpenOnHold(selectedInvoice)}
                            className="text-xs border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                        >
                            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                            Tahan / On-Hold (Klarifikasi)
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

            {/* MODAL KHUSUS: ON-HOLD / SENGKETA KLARIFIKASI VENDOR */}
            <Dialog open={isOnHoldModalOpen} onOpenChange={setIsOnHoldModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base text-amber-900 dark:text-amber-300">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                            Tahan Tagihan (On-Hold / Sengketa)
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Tagihan {selectedInvoice?.invoiceNumber} akan ditahan sementara untuk klarifikasi vendor tanpa membatalkan/menolak invoice.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3.5 text-xs py-2">
                        <div className="space-y-1">
                            <Label htmlFor="holdReasonSelect">Alasan Penahanan *</Label>
                            <select
                                id="holdReasonSelect"
                                value={onHoldReason}
                                onChange={(e) => setOnHoldReason(e.target.value)}
                                className="w-full text-xs h-9 rounded-md border border-slate-200 bg-white dark:bg-slate-900 px-3"
                            >
                                <option value="Klarifikasi Dokumen / Faktur Pajak">Klarifikasi Dokumen / Faktur Pajak</option>
                                <option value="Perbedaan Harga / Kuantitas (3-Way Match)">Perbedaan Harga / Kuantitas (3-Way Match)</option>
                                <option value="BAST / Surat Jalan Belum Lengkap">BAST / Surat Jalan Belum Lengkap</option>
                                <option value="Rekening Bank Tidak Sesuai Master">Rekening Bank Tidak Sesuai Master</option>
                                <option value="Klarifikasi Potongan Retensi / Penalti">Klarifikasi Potongan Retensi / Penalti</option>
                                <option value="Lainnya">Lainnya</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="holdNotesArea">Instruksi &amp; Catatan Klarifikasi Vendor *</Label>
                            <Textarea
                                id="holdNotesArea"
                                rows={3}
                                placeholder="Jelaskan secara spesifik berkas apa yang perlu direvisi atau diklarifikasi oleh pihak vendor..."
                                value={onHoldNotes}
                                onChange={(e) => setOnHoldNotes(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsOnHoldModalOpen(false)}
                            className="text-xs"
                        >
                            Batal
                        </Button>
                        <Button
                            size="sm"
                            disabled={isSubmittingOnHold || !onHoldNotes.trim()}
                            onClick={handleConfirmOnHold}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                        >
                            {isSubmittingOnHold ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <AlertTriangle className="w-4 h-4 mr-1" />}
                            Konfirmasi Status On-Hold
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

                            {/* Re-Check Hasil Validasi Admin (Mandatory Gate) */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-2.5">
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                                        Re-Check Hasil Validasi Admin (Mandatory)
                                    </span>
                                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                                        Admin Verified
                                    </Badge>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Dokumen Fisik &amp; GR Slip: <strong>{selectedInvoice.checklistDocValid ? "Lengkap" : "Perlu Cek"}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Kesesuaian PO One Chitra: <strong>{selectedInvoice.checklistPoValid ? "Cocok" : "Perlu Cek"}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Akurasi Kalkulasi DPP &amp; Pajak: <strong>{selectedInvoice.checklistCalcValid ? "Akurat" : "Perlu Cek"}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Rekening Bank Vendor: <strong>{selectedInvoice.checklistBankValid ? "Valid" : "Perlu Cek"}</strong></span>
                                    </div>
                                </div>

                                {selectedInvoice.adminChecklistNotes && (
                                    <p className="text-[11px] italic text-slate-500 bg-white dark:bg-slate-800 p-2 rounded border">
                                        Catatan Admin: {selectedInvoice.adminChecklistNotes}
                                    </p>
                                )}

                                <div className="pt-1 border-t">
                                    <label className="flex items-start gap-2 cursor-pointer p-2 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-lg">
                                        <Checkbox
                                            checked={financeRecheckPassed}
                                            onCheckedChange={(c) => setFinanceRecheckPassed(Boolean(c))}
                                        />
                                        <div className="text-[11px]">
                                            <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                                                Konfirmasi Re-Check Finance *
                                            </span>
                                            <p className="text-slate-500">
                                                Saya telah melakukan re-check independen terhadap kelengkapan berkas fisik invoice, GR Slip, PO SAP, kalkulasi perpajakan (PPN/PPh), dan rekening tujuan transfer.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="topDaysInput">Term of Payment (TOP) - Master Vendor</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="topDaysInput"
                                            type="text"
                                            readOnly
                                            disabled
                                            value={`${selectedInvoice.topDays || selectedInvoice.tenant.defaultTopDays || 30} Hari`}
                                            className="bg-slate-100 dark:bg-slate-800 font-semibold cursor-not-allowed text-slate-700 dark:text-slate-300"
                                        />
                                        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-2 py-2 rounded-md border">
                                            Read-Only
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        Mengikuti data Master Vendor SAP. TOP terhitung otomatis setelah invoice valid by Finance.
                                    </p>
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
                            variant="outline"
                            size="sm"
                            disabled={isProcessingFinance}
                            onClick={() => handleOpenOnHold(selectedInvoice)}
                            className="text-xs border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                        >
                            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                            Tahan / On-Hold (Klarifikasi)
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            disabled={isProcessingFinance || !financeRecheckPassed}
                            onClick={() => handleFinanceAction("validate")}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs disabled:opacity-50"
                        >
                            {isProcessingFinance ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Calendar className="w-4 h-4 mr-1" />}
                            Validasi Pajak &amp; Jadwalkan Bayar
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

            {/* MODAL 5: DETAIL INVOICE (Landscape 75% Screen Width Redesign) */}
            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="w-[75vw] max-w-[75vw] min-w-[75vw] max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
                    <DialogHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
                        <DialogTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="text-xl font-bold text-slate-900 dark:text-slate-100 block tracking-tight">
                                        Detail Faktur: {selectedInvoice?.invoiceNumber}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedInvoice && (
                                    <div className="px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-full flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs shadow-xs">
                                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>
                                            {selectedInvoice.status === "pending_review"
                                                ? "1. Menunggu Admin Review"
                                                : selectedInvoice.status === "verified_admin"
                                                ? "2. Menunggu Verifikasi Finance"
                                                : selectedInvoice.status === "validated_finance"
                                                ? "3. Menunggu Manager"
                                                : selectedInvoice.status === "approved_manager"
                                                ? "4. Disetujui (Siap Dibayar)"
                                                : selectedInvoice.status === "paid"
                                                ? "5. Lunas (Paid)"
                                                : selectedInvoice.status === "on_hold"
                                                ? "Ditahan (On-Hold)"
                                                : selectedInvoice.status}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedInvoice && (
                        <div className="space-y-4 pt-2 text-xs">
                            {/* Alert Sengketa On-Hold jika ada */}
                            {selectedInvoice.status === "on_hold" && (
                                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>Faktur Tagihan Sedang Ditahan (On-Hold / Dispute)</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs bg-white dark:bg-slate-900 border-amber-300 hover:bg-amber-100 text-amber-900 dark:text-amber-200"
                                            onClick={async () => {
                                                await handleResolveOnHold(selectedInvoice.id)
                                                setIsDetailModalOpen(false)
                                            }}
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                            Selesaikan Sengketa & Lanjutkan
                                        </Button>
                                    </div>
                                    <div className="text-slate-700 dark:text-slate-300 text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-amber-200 dark:border-amber-800/60">
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Alasan Penahanan:</span>
                                            <span className="font-semibold text-amber-950 dark:text-amber-100">
                                                {selectedInvoice.disputeReason || "Klarifikasi Dokumen"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Catatan Verifikator:</span>
                                            <span className="italic">{selectedInvoice.disputeNotes || "-"}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ROW 1: INFORMASI RINGKAS MITRA & KONTRAK (Full Width 4 Kolom) */}
                            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 text-xs">
                                        <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                                        Mitra Vendor
                                    </span>
                                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block leading-snug">
                                        {selectedInvoice.tenant?.name || "-"}
                                    </span>
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded text-[10px] font-mono border border-blue-200/60">
                                        <span>Kode :</span>
                                        <span>{selectedInvoice.tenant?.sapVendorCode || selectedInvoice.tenant?.code || "-"}</span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 text-xs">
                                        <ClipboardCheck className="w-4 h-4 text-blue-600 shrink-0" />
                                        No. PO / Kontrak
                                    </span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm block">
                                        {selectedInvoice.poNumber || "-"}
                                    </span>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                        Ref: {selectedInvoice.referenceType || "PO"}
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 text-xs">
                                        <LayoutGrid className="w-4 h-4 text-blue-600 shrink-0" />
                                        Kategori Pekerjaan
                                    </span>
                                    <div className="pt-0.5">
                                        <Badge
                                            variant="secondary"
                                            className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 px-3 py-1 text-xs font-semibold capitalize rounded-lg"
                                        >
                                            {selectedInvoice.projectCategory || "General"}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 text-xs">
                                        <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                                        Tanggal &amp; TOP
                                    </span>
                                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block">
                                        {new Date(selectedInvoice.invoiceDate).toLocaleDateString("id-ID")}
                                    </span>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                        TOP: {selectedInvoice.topDays || 30} Hari
                                    </span>
                                </div>
                            </div>

                            {/* ROW 2: RINCIAN FINANSIAL & REKONSILIASI NET PAYABLE (Full Width Card) */}
                            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3.5 shadow-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                        <BarChart3 className="w-4 h-4" />
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-tight">
                                        Rincian Finansial &amp; Rekonsiliasi Net Payable
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* 1. Subtotal DPP */}
                                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 flex items-center justify-center shrink-0">
                                                <Coins className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Subtotal (DPP)</span>
                                                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm font-mono">
                                                    {formatCurrency(selectedInvoice.subtotal)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. PPN */}
                                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
                                                <Percent className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                                                    PPN ({selectedInvoice.ppnPercent || 11}%)
                                                </span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                                                    +{formatCurrency(selectedInvoice.ppnAmount || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. PPh */}
                                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
                                                <Percent className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                                                    PPh ({selectedInvoice.pphPercent || 0}%)
                                                </span>
                                                <span className="font-bold text-rose-600 dark:text-rose-400 text-sm font-mono">
                                                    -{formatCurrency(selectedInvoice.pphAmount || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Kliring Uang Muka DP */}
                                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
                                                <Scissors className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Kliring Uang Muka (DP)</span>
                                                <span className="font-bold text-amber-700 dark:text-amber-400 text-sm font-mono">
                                                    -{formatCurrency(selectedInvoice.dpDeduction || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 5. Retensi Sipil */}
                                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                                                <RefreshCw className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                                                    Retensi Sipil ({selectedInvoice.retentionPercent || 0}%)
                                                </span>
                                                <span className="font-bold text-blue-700 dark:text-blue-400 text-sm font-mono">
                                                    -{formatCurrency(selectedInvoice.retentionAmount || 0)}
                                                </span>
                                                <span className="text-[10px] text-slate-400 block">
                                                    Status: {selectedInvoice.retentionStatus || "None"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 6. Potongan Denda/Pinalti */}
                                    <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 flex items-center justify-center shrink-0">
                                                <Wallet className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Potongan Denda/Pinalti</span>
                                                <span className="font-bold text-rose-700 dark:text-rose-400 text-sm font-mono">
                                                    -{formatCurrency(selectedInvoice.penaltyAmount || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Strip Net Payable Hijau Emerald Penuh */}
                                <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
                                                Net Payable (Jumlah Bersih Pencairan Dana ke Rekening Vendor)
                                            </span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                Grand Total Tagihan: {formatCurrency(selectedInvoice.grandTotal)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono tracking-tight">
                                            {formatCurrency(selectedInvoice.netPayable || selectedInvoice.grandTotal)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ROW 3: 3-WAY MATCHING & VALIDASI PAJAK DJP (Grid 2 Kolom Berdampingan) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                                {/* Kotak Kiri: 3-Way Matching */}
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-3">
                                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 flex items-center justify-center shrink-0">
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-tight">
                                                Hasil Otomatisasi 3-Way Matching (PO vs Invoice vs GR/BAST)
                                            </span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs px-2.5 border-blue-200 hover:bg-blue-50 text-blue-700 dark:border-blue-900 shrink-0"
                                            disabled={isRunningOcrMatch}
                                            onClick={() => handleRun3WayMatch(selectedInvoice.id)}
                                        >
                                            {isRunningOcrMatch ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                                    Memproses...
                                                </>
                                            ) : (
                                                <>
                                                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                                                    Jalankan Ulang OCR Match
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 dark:text-slate-400 text-xs">Hasil Matching:</span>
                                            {selectedInvoice.threeWayMatchResult?.matchStatus === "match" ? (
                                                <Badge className="bg-emerald-600 text-white text-xs px-3 py-1 font-bold rounded-lg">
                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> MATCH (Sempurna)
                                                </Badge>
                                            ) : selectedInvoice.threeWayMatchResult?.matchStatus === "variance" ? (
                                                <Badge className="bg-amber-600 text-white text-xs px-3 py-1 font-bold rounded-lg">
                                                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> VARIANCE (Dalam Toleransi)
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 font-bold rounded-lg shadow-xs">
                                                    <AlertCircle className="w-3.5 h-3.5 mr-1" /> UNMATCHED (Perlu Investigasi)
                                                </Badge>
                                            )}
                                        </div>
                                        {selectedInvoice.threeWayMatchResult?.summaryMessage && (
                                            <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                                                {selectedInvoice.threeWayMatchResult.summaryMessage}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Kotak Kanan: Kepatuhan Pajak & Validasi Faktur DJP */}
                                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-3">
                                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                            Kepatuhan Pajak &amp; Validasi Faktur DJP (CoreTax Ready)
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">NPWP 16 Digit</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                                {selectedInvoice.vendorNpwp16 || selectedInvoice.tenant?.npwp || "-"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Nomor Seri Faktur Pajak</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs break-all">
                                                {selectedInvoice.taxInvoiceNumber || "-"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Status Validasi DJP</span>
                                            <div className="pt-0.5">
                                                <Badge
                                                    variant="secondary"
                                                    className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/70 px-2 py-0.5 text-[10px] font-semibold"
                                                >
                                                    {selectedInvoice.taxValidationStatus || "unverified"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ROW 4: DOKUMEN LAMPIRAN PENDUKUNG (Full Width Card) */}
                            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 flex items-center justify-center shrink-0">
                                        <Paperclip className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                        Dokumen Lampiran Pendukung:
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <a
                                        href={resolveUploadDocumentUrl(selectedInvoice.invoiceFileUrl) || selectedInvoice.invoiceFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3.5 py-1.5 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-200/80 dark:border-blue-900 flex items-center gap-1.5 font-bold text-xs hover:bg-blue-50 shadow-2xs"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Invoice Fisik
                                    </a>

                                    {selectedInvoice.grSlipFileUrl && (
                                        <a
                                            href={resolveUploadDocumentUrl(selectedInvoice.grSlipFileUrl) || selectedInvoice.grSlipFileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl flex items-center gap-1.5 font-bold text-xs shadow-xs hover:bg-blue-700"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            GR Slip (Wajib)
                                        </a>
                                    )}

                                    {selectedInvoice.taxInvoiceFileUrl && (
                                        <a
                                            href={resolveUploadDocumentUrl(selectedInvoice.taxInvoiceFileUrl) || selectedInvoice.taxInvoiceFileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl border border-emerald-200/80 flex items-center gap-1.5 font-bold text-xs hover:bg-emerald-100"
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
                                            className="px-3.5 py-1.5 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 rounded-xl border border-purple-200/80 flex items-center gap-1.5 font-bold text-xs hover:bg-purple-100"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Surat Jalan / BAST
                                        </a>
                                    )}

                                    {selectedInvoice.contractFileUrl && (
                                        <a
                                            href={resolveUploadDocumentUrl(selectedInvoice.contractFileUrl) || selectedInvoice.contractFileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3.5 py-1.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 rounded-xl border border-amber-200/80 flex items-center gap-1.5 font-bold text-xs hover:bg-amber-100"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Dokumen Kontrak / SPK
                                        </a>
                                    )}

                                    {selectedInvoice.paidProofUrl && (
                                        <a
                                            href={resolveUploadDocumentUrl(selectedInvoice.paidProofUrl) || selectedInvoice.paidProofUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl flex items-center gap-1.5 font-bold text-xs hover:bg-emerald-700 shadow-xs"
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

            {/* MODAL 8: TAMBAH / EDIT MASTER VENDOR */}
            <Dialog
                open={isAddVendorOpen || isEditVendorOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsAddVendorOpen(false)
                        setIsEditVendorOpen(false)
                        setSelectedVendorForEdit(null)
                    }
                }}
            >
                <DialogContent className="w-[75vw] max-w-[75vw] min-w-[75vw] max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
                    <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <DialogTitle className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-xl font-bold text-slate-900 dark:text-slate-100 block tracking-tight">
                                    {selectedVendorForEdit ? "Perbarui Data Mitra Vendor" : "Daftarkan Rekan Vendor Baru"}
                                </span>
                                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {selectedVendorForEdit
                                        ? "Perbarui informasi legalitas, perpajakan, dan rekening bank vendor."
                                        : "Daftarkan profil mitra vendor rekanan One Chitra ke database sistem."}
                                </DialogDescription>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {vendorFormError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{vendorFormError}</span>
                        </div>
                    )}

                    <form onSubmit={handleSaveVendor} className="space-y-4 pt-1 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* KOLOM KIRI: Identitas & Kontak */}
                            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 border-b pb-2">
                                    <User className="w-4 h-4 text-blue-600" />
                                    Identitas Perusahaan &amp; Kontak Resmi
                                </span>

                                <div className="space-y-1.5">
                                    <Label htmlFor="mName" className="font-semibold text-slate-700 dark:text-slate-300">
                                        Nama Perusahaan Vendor *
                                    </Label>
                                    <Input
                                        id="mName"
                                        placeholder="Contoh: PT TRI PUTRA ABADI"
                                        value={vendorForm.name}
                                        onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                                        className="h-9 rounded-xl bg-white dark:bg-slate-900"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mCode" className="font-semibold text-slate-700 dark:text-slate-300">
                                            Kode Vendor (Sistem) *
                                        </Label>
                                        <Input
                                            id="mCode"
                                            placeholder="VND-001"
                                            value={vendorForm.code}
                                            onChange={(e) => setVendorForm({ ...vendorForm, code: e.target.value })}
                                            className="h-9 rounded-xl bg-white dark:bg-slate-900 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mSapCode" className="font-semibold text-slate-700 dark:text-slate-300">
                                            Kode SAP Vendor (Opsional)
                                        </Label>
                                        <Input
                                            id="mSapCode"
                                            placeholder="2000001"
                                            value={vendorForm.sapVendorCode}
                                            onChange={(e) => setVendorForm({ ...vendorForm, sapVendorCode: e.target.value })}
                                            className="h-9 rounded-xl bg-white dark:bg-slate-900 font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mEmail" className="font-semibold text-slate-700 dark:text-slate-300">
                                            Email Penagihan Resmi *
                                        </Label>
                                        <Input
                                            id="mEmail"
                                            type="email"
                                            placeholder="finance@vendor.com"
                                            value={vendorForm.email}
                                            onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                                            className="h-9 rounded-xl bg-white dark:bg-slate-900"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mPhone" className="font-semibold text-slate-700 dark:text-slate-300">
                                            No. WhatsApp / Telepon
                                        </Label>
                                        <Input
                                            id="mPhone"
                                            placeholder="08123456789"
                                            value={vendorForm.phone}
                                            onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                                            className="h-9 rounded-xl bg-white dark:bg-slate-900 font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* KOLOM KANAN: Rekening Perbankan & Pajak */}
                            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 border-b pb-2">
                                    <Landmark className="w-4 h-4 text-emerald-600" />
                                    Rekening Perbankan &amp; Legalitas Perpajakan
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mBank" className="font-semibold text-slate-700 dark:text-slate-300">
                                            Bank Pembayaran
                                        </Label>
                                        <Input
                                            id="mBank"
                                            placeholder="BCA / Mandiri / BRI"
                                            value={vendorForm.bankName}
                                            onChange={(e) => setVendorForm({ ...vendorForm, bankName: e.target.value })}
                                            className="h-9 rounded-xl bg-white dark:bg-slate-900"
                                        />
                                    </div>
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <Label htmlFor="mAcc" className="font-semibold text-slate-700 dark:text-slate-300">
                                            Nomor Rekening
                                        </Label>
                                        <Input
                                            id="mAcc"
                                            placeholder="4595-01-028..."
                                            value={vendorForm.bankAccountNo}
                                            onChange={(e) => setVendorForm({ ...vendorForm, bankAccountNo: e.target.value })}
                                            className="h-9 rounded-xl bg-white dark:bg-slate-900 font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="mHolder" className="font-semibold text-slate-700 dark:text-slate-300">
                                        Atas Nama Rekening Rekanan
                                    </Label>
                                    <Input
                                        id="mHolder"
                                        placeholder="CV Trimicel Jaya"
                                        value={vendorForm.bankAccountHolder}
                                        onChange={(e) => setVendorForm({ ...vendorForm, bankAccountHolder: e.target.value })}
                                        className="h-9 rounded-xl bg-white dark:bg-slate-900"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mNpwp" className="font-semibold text-slate-700 dark:text-slate-300">
                                            Nomor NPWP 16 Digit
                                        </Label>
                                        <Input
                                            id="mNpwp"
                                            placeholder="02.919.245..."
                                            value={vendorForm.npwp}
                                            onChange={(e) => setVendorForm({ ...vendorForm, npwp: e.target.value })}
                                            className="h-9 rounded-xl bg-white dark:bg-slate-900 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="mTop" className="font-semibold text-slate-700 dark:text-slate-300">
                                            Term of Payment (Hari)
                                        </Label>
                                        <Input
                                            id="mTop"
                                            type="number"
                                            value={vendorForm.defaultTopDays}
                                            onChange={(e) => setVendorForm({ ...vendorForm, defaultTopDays: Number(e.target.value) || 30 })}
                                            className="h-9 rounded-xl bg-white dark:bg-slate-900"
                                        />
                                    </div>
                                </div>

                                <div className="pt-1">
                                    <label className="flex items-center gap-2.5 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer font-medium">
                                        <Checkbox
                                            checked={vendorForm.isPkp}
                                            onCheckedChange={(c) => setVendorForm({ ...vendorForm, isPkp: Boolean(c) })}
                                        />
                                        <span className="text-slate-700 dark:text-slate-300 text-xs">
                                            Vendor Terdaftar sebagai Pengusaha Kena Pajak (PKP - Faktur Pajak Wajib)
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsAddVendorOpen(false)
                                    setIsEditVendorOpen(false)
                                    setSelectedVendorForEdit(null)
                                }}
                                className="rounded-xl px-5 h-10 text-xs"
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSavingVendor}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-6 h-10 text-xs shadow-md shadow-blue-500/20"
                            >
                                {isSavingVendor ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                                {selectedVendorForEdit ? "Simpan Perubahan Vendor" : "Daftarkan Mitra Vendor"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL 9: BUAT KONTRAK BARU (Landscape 75% Screen Width Redesign) */}
            <Dialog open={isAddContractOpen} onOpenChange={setIsAddContractOpen}>
                <DialogContent className="w-[75vw] max-w-[75vw] min-w-[75vw] max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
                    <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                        <DialogTitle className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-xl font-bold text-slate-900 dark:text-slate-100 block tracking-tight">
                                    Buat Master Kontrak Vendor &amp; Perjanjian Sewa
                                </span>
                                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Daftarkan kontrak payung atau sewa kendaraan/jasa lengkap dengan spesifikasi unit dan harga sewa.
                                </DialogDescription>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {contractFormError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{contractFormError}</span>
                        </div>
                    )}

                    <form onSubmit={handleSaveContract} className="space-y-4 pt-1 text-xs">
                        {/* ROW 1: NOMOR KONTRAK & JUDUL PERJANJIAN */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="cNum" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Handshake className="w-4 h-4 text-indigo-600 shrink-0" />
                                    Nomor Kontrak *
                                </Label>
                                <Input
                                    id="cNum"
                                    placeholder="Contoh: 505/TI-CP/LV/X/2025"
                                    value={contractForm.contractNumber}
                                    onChange={(e) => setContractForm({ ...contractForm, contractNumber: e.target.value })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="cTitle" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Scale className="w-4 h-4 text-indigo-600 shrink-0" />
                                    Judul Kontrak / Perjanjian *
                                </Label>
                                <Input
                                    id="cTitle"
                                    placeholder="Perjanjian Sewa Menyewa Kendaraan"
                                    value={contractForm.title}
                                    onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800"
                                    required
                                />
                            </div>
                        </div>

                        {/* ROW 2: NAMA VENDOR (LOOKUP & SINKRONISASI REAL-TIME) & KODE SAP */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 relative">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cVendor" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <User className="w-4 h-4 text-indigo-600 shrink-0" />
                                        Nama Rekan Vendor *
                                    </Label>
                                    {contractForm.vendorName && contractForm.vendorSapCode && (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Tersinkronisasi SAP
                                        </span>
                                    )}
                                </div>

                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <Input
                                        id="cVendor"
                                        placeholder="Ketik nama atau kode vendor (contoh: APTA, TRIMICEL, ODG)..."
                                        value={contractForm.vendorName}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setContractForm({ ...contractForm, vendorName: val })
                                            setContractVendorSearch(val)
                                            setIsContractVendorDropdownOpen(true)
                                        }}
                                        onFocus={() => {
                                            if (contractForm.vendorName) {
                                                setContractVendorSearch(contractForm.vendorName)
                                            }
                                            setIsContractVendorDropdownOpen(true)
                                        }}
                                        className="pl-9 pr-8 h-9 rounded-xl border-slate-200 dark:border-slate-800"
                                        required
                                    />
                                    {isSearchingContractVendor && (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-2.5 text-indigo-600" />
                                    )}
                                </div>

                                {/* Floating Dropdown Hasil Lookup */}
                                {isContractVendorDropdownOpen && contractVendorResults.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 backdrop-blur-md">
                                        <div className="p-2 bg-slate-50/90 dark:bg-slate-800/90 flex items-center justify-between text-[11px] text-slate-500 font-medium border-b border-slate-100 dark:border-slate-700">
                                            <span>Pilih Rekan Vendor untuk Sinkronisasi Otomatis:</span>
                                            <button
                                                type="button"
                                                onClick={() => setIsContractVendorDropdownOpen(false)}
                                                className="text-slate-400 hover:text-slate-600 text-xs px-1"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        {contractVendorResults.map((v) => (
                                            <div
                                                key={v.id}
                                                onClick={() => handleSelectVendorForContract(v)}
                                                className="p-3 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 cursor-pointer transition-colors flex items-center justify-between text-xs group"
                                            >
                                                <div className="space-y-0.5">
                                                    <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 flex items-center gap-2">
                                                        <span>{v.vendorName}</span>
                                                        {v.source && (
                                                            <span className="text-[10px] font-normal px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">
                                                                {v.source}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono">
                                                        <span>Kode SAP: {v.supplierCode || "-"}</span>
                                                        <span>&bull;</span>
                                                        <span>TOP: {v.topDays || 30} Hari</span>
                                                        {v.bankName && (
                                                            <>
                                                                <span>&bull;</span>
                                                                <span className="font-sans text-slate-600 dark:text-slate-300">{v.bankName}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2.5 text-[11px] rounded-lg bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all"
                                                >
                                                    Sinkronkan
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Pilihan Cepat Rekanan Populer */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <span className="text-[10px] text-slate-400">Pilihan Cepat:</span>
                                    {[
                                        { vendorName: "CV. APTA JAYA PRIMA", supplierCode: "2000002", bankName: "BCA - JAKARTA", bankAccountNumber: "035-309-8812", bankAccountHolder: "CV APTA JAYA PRIMA", topDays: 60 },
                                        { vendorName: "CV TRIMICEL JAYA", supplierCode: "2000001", bankName: "BRI - TANJUNG KOTA", bankAccountNumber: "4595-01-028276-53-9", bankAccountHolder: "CV TRIMICEL JAYA", topDays: 45 },
                                        { vendorName: "PT ODG INDONESIA", supplierCode: "IP0101INDONESIA-1460", bankName: "BANK MANDIRI", bankAccountNumber: "123-00-9876543-1", bankAccountHolder: "PT ODG INDONESIA", topDays: 60 },
                                        { vendorName: "PT. MENTARI GRIH KENCANA", supplierCode: "2000045", bankName: "BNI - BANJARMASIN", bankAccountNumber: "089-223-4451", bankAccountHolder: "PT MENTARI GRIH KENCANA", topDays: 30 },
                                    ].map((rec, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => handleSelectVendorForContract(rec)}
                                            className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-[10px] text-slate-600 dark:text-slate-400 font-medium transition-colors"
                                        >
                                            {rec.vendorName}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="cVendorCode" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Tag className="w-4 h-4 text-indigo-600 shrink-0" />
                                    Kode SAP Vendor
                                </Label>
                                <Input
                                    id="cVendorCode"
                                    placeholder="2000001"
                                    value={contractForm.vendorSapCode}
                                    onChange={(e) => setContractForm({ ...contractForm, vendorSapCode: e.target.value })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800 font-mono font-bold text-blue-600 dark:text-blue-400 bg-slate-50/50"
                                />
                                <span className="text-[10px] text-slate-400 block">
                                    Otomatis tersinkron dari master vendor SAP saat rekanan dipilih.
                                </span>
                            </div>
                        </div>

                        {/* ROW 3: BOX SPESIFIKASI BARANG / JASA / UNIT KENDARAAN (Biru Transparan Rounded) */}
                        <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/60 rounded-2xl space-y-3">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs">
                                <Package className="w-3.5 h-3.5" />
                                Spesifikasi Barang / Jasa / Unit Kendaraan
                            </div>

                            <div className="space-y-1.5 pt-1">
                                <Label htmlFor="cItemName" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Package className="w-4 h-4 text-blue-600 shrink-0" />
                                    Nama Barang / Unit *
                                </Label>
                                <Input
                                    id="cItemName"
                                    placeholder="MITSUBISHI TRITON 2.5L DC HDX-L (4X4) MT"
                                    value={contractForm.itemName}
                                    onChange={(e) => setContractForm({ ...contractForm, itemName: e.target.value })}
                                    className="h-9 rounded-xl bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="cPlate" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <Car className="w-4 h-4 text-blue-600 shrink-0" />
                                        Nomor Polisi
                                    </Label>
                                    <Input
                                        id="cPlate"
                                        placeholder="DA 8109 HH"
                                        value={contractForm.policeNumber}
                                        onChange={(e) => setContractForm({ ...contractForm, policeNumber: e.target.value })}
                                        className="h-9 rounded-xl bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="cYear" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                                        Tahun Pembuatan
                                    </Label>
                                    <Input
                                        id="cYear"
                                        type="number"
                                        placeholder="2022"
                                        value={contractForm.year}
                                        onChange={(e) => setContractForm({ ...contractForm, year: Number(e.target.value) || 2022 })}
                                        className="h-9 rounded-xl bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="cLoc" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                                        Lokasi Kerja
                                    </Label>
                                    <Input
                                        id="cLoc"
                                        placeholder="Adaro / Tanjung Tabalong"
                                        value={contractForm.location}
                                        onChange={(e) => setContractForm({ ...contractForm, location: e.target.value })}
                                        className="h-9 rounded-xl bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ROW 4: NILAI SEWA & PERIODE (3 Kolom) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="cVal" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                                    Nilai Sewa (Rupiah/Bulan) *
                                </Label>
                                <Input
                                    id="cVal"
                                    type="number"
                                    placeholder="15500000"
                                    value={contractForm.contractValue}
                                    onChange={(e) => setContractForm({ ...contractForm, contractValue: Number(e.target.value) || 0 })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800 font-mono"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="cStart" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                                    Tanggal Mulai Berlaku
                                </Label>
                                <Input
                                    id="cStart"
                                    type="date"
                                    value={contractForm.startDate}
                                    onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="cEnd" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                                    Tanggal Berakhir *
                                </Label>
                                <Input
                                    id="cEnd"
                                    type="date"
                                    value={contractForm.endDate}
                                    onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800"
                                    required
                                />
                            </div>
                        </div>

                        {/* ROW 5: TOP & PAJAK (3 Kolom) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="cTop" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                                    Term of Payment (Hari)
                                </Label>
                                <Input
                                    id="cTop"
                                    type="number"
                                    placeholder="45"
                                    value={contractForm.topDays}
                                    onChange={(e) => setContractForm({ ...contractForm, topDays: Number(e.target.value) || 45 })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="cPpn" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Percent className="w-4 h-4 text-indigo-600 shrink-0" />
                                    % PPN (%)
                                </Label>
                                <Input
                                    id="cPpn"
                                    type="number"
                                    placeholder="11"
                                    value={contractForm.ppnPercent}
                                    onChange={(e) => setContractForm({ ...contractForm, ppnPercent: Number(e.target.value) || 11 })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="cPph" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Percent className="w-4 h-4 text-indigo-600 shrink-0" />
                                    % PPH (%)
                                </Label>
                                <Input
                                    id="cPph"
                                    type="number"
                                    placeholder="2"
                                    value={contractForm.pphPercent}
                                    onChange={(e) => setContractForm({ ...contractForm, pphPercent: Number(e.target.value) || 2 })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800"
                                />
                            </div>
                        </div>

                        {/* ROW 6: REKENING BANK PEMBAYARAN (3 Kolom) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="cBName" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Landmark className="w-4 h-4 text-indigo-600 shrink-0" />
                                    Bank
                                </Label>
                                <Input
                                    id="cBName"
                                    placeholder="BRI - TANJUNG KOT"
                                    value={contractForm.bankName}
                                    onChange={(e) => setContractForm({ ...contractForm, bankName: e.target.value })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="cBNum" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <Hash className="w-4 h-4 text-indigo-600 shrink-0" />
                                    # No. Rekening
                                </Label>
                                <Input
                                    id="cBNum"
                                    placeholder="4595-01-028276-5E"
                                    value={contractForm.bankAccountNumber}
                                    onChange={(e) => setContractForm({ ...contractForm, bankAccountNumber: e.target.value })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="cBOwner" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                    <User className="w-4 h-4 text-indigo-600 shrink-0" />
                                    Atas Nama
                                </Label>
                                <Input
                                    id="cBOwner"
                                    placeholder="CV TRIMICEL JAYA"
                                    value={contractForm.bankAccountHolder}
                                    onChange={(e) => setContractForm({ ...contractForm, bankAccountHolder: e.target.value })}
                                    className="h-9 rounded-xl border-slate-200 dark:border-slate-800"
                                />
                            </div>
                        </div>

                        {/* ROW 7: FOOTER UPLOAD BERKAS & TOMBOL SIMPAN KONTRAK */}
                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* Kotak Upload PDF Kontrak */}
                            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 rounded-2xl flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex items-center gap-2 shrink-0">
                                    <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                                        Unggah Salinan PDF Kontrak Perjanjian (Opsional)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="cursor-pointer px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 shrink-0">
                                        Pilih File
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={(e) => setContractPdfFile(e.target.files?.[0] || null)}
                                            className="hidden"
                                        />
                                    </label>
                                    <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                                        {contractPdfFile ? contractPdfFile.name : "Tidak ada file yang dipilih"}
                                    </span>
                                </div>
                            </div>

                            {/* Tombol Simpan Master Kontrak */}
                            <Button
                                type="submit"
                                disabled={isSavingContract}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-7 py-5 rounded-2xl flex items-center gap-2 text-sm shadow-md shadow-indigo-500/20 shrink-0"
                            >
                                {isSavingContract ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Simpan Master Kontrak &gt;
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL 10: DETAIL KONTRAK */}
            <Dialog open={Boolean(selectedContractDetail)} onOpenChange={() => setSelectedContractDetail(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            Detail Kontrak Perjanjian Sewa
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {selectedContractDetail?.contractNumber}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedContractDetail && (
                        <div className="space-y-3.5 text-xs">
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border space-y-1">
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block">
                                    {selectedContractDetail.title}
                                </span>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Mitra Rekanan: <strong>{selectedContractDetail.vendorName}</strong>
                                    {selectedContractDetail.vendorSapCode ? ` (SAP: ${selectedContractDetail.vendorSapCode})` : ""}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 p-3 border rounded-xl">
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Unit Kendaraan / Barang:</span>
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                        {selectedContractDetail.itemName}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Nomor Polisi:</span>
                                    <span className="font-mono font-bold text-primary">
                                        {selectedContractDetail.itemDetails?.policeNumber || "-"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Nilai Sewa per Bulan:</span>
                                    <span className="font-bold text-emerald-600 text-sm">
                                        {formatCurrency(selectedContractDetail.contractValue)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Term of Payment:</span>
                                    <span className="font-semibold">{selectedContractDetail.topDays || 45} Hari Kalender</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Masa Berlaku:</span>
                                    <span>{formatDate(selectedContractDetail.startDate)} s.d {formatDate(selectedContractDetail.endDate)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Lokasi Unit:</span>
                                    <span>{selectedContractDetail.itemDetails?.location || "-"}</span>
                                </div>
                            </div>

                            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 rounded-xl space-y-1">
                                <span className="font-bold text-indigo-950 dark:text-indigo-200 block text-[11px]">
                                    Rekening Pembayaran &amp; Perpajakan:
                                </span>
                                <p className="text-[11px] text-indigo-900 dark:text-indigo-300">
                                    {selectedContractDetail.bankName}: <strong>{selectedContractDetail.bankAccountNumber}</strong> a/n {selectedContractDetail.bankAccountHolder}
                                </p>
                                <p className="text-[10px] text-indigo-800 dark:text-indigo-400">
                                    NPWP: {selectedContractDetail.npwpNumber || "-"} &bull; PPN: {selectedContractDetail.ppnPercent}% &bull; PPh: {selectedContractDetail.pphPercent}%
                                </p>
                            </div>

                            {selectedContractDetail.contractFileUrl && (
                                <a
                                    href={resolveUploadDocumentUrl(selectedContractDetail.contractFileUrl) || selectedContractDetail.contractFileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-indigo-700"
                                >
                                    <ExternalLink className="w-4 h-4" /> Buka Salinan PDF Kontrak
                                </a>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
