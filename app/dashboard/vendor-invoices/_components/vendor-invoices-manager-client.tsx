"use client"

import React, { useState } from "react"
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
} from "@/app/actions/vendor-invoices"
import { uploadFile } from "@/app/actions/upload"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"
import { AccentureMasterVendorsView } from "./accenture-master-vendors"
import { AccentureInvoiceEntry } from "./accenture-invoice-entry"
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
                                            <th className="px-4 py-3">Masa Berlaku</th>
                                            <th className="px-4 py-3">TOP &amp; Status</th>
                                            <th className="px-4 py-3 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {contracts.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
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
                                    {selectedInvoice.grSlipFileUrl && (
                                        <a
                                            href={resolveUploadDocumentUrl(selectedInvoice.grSlipFileUrl) || selectedInvoice.grSlipFileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-md flex items-center gap-1 font-medium shadow-xs"
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
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <Building2 className="w-5 h-5 text-primary" />
                            {selectedVendorForEdit ? "Edit Master Vendor" : "Tambah Master Vendor Baru"}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {selectedVendorForEdit
                                ? "Perbarui informasi legalitas, perpajakan, dan rekening bank vendor."
                                : "Daftarkan profil mitra vendor rekanan One Chitra ke database sistem."}
                        </DialogDescription>
                    </DialogHeader>

                    {vendorFormError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{vendorFormError}</span>
                        </div>
                    )}

                    <form onSubmit={handleSaveVendor} className="space-y-3.5 text-xs">
                        <div className="space-y-1">
                            <Label htmlFor="mName">Nama Perusahaan Vendor *</Label>
                            <Input
                                id="mName"
                                placeholder="Contoh: PT TRI PUTRA ABADI"
                                value={vendorForm.name}
                                onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="mCode">Kode Vendor (Unik) *</Label>
                                <Input
                                    id="mCode"
                                    placeholder="VND-001"
                                    value={vendorForm.code}
                                    onChange={(e) => setVendorForm({ ...vendorForm, code: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="mSapCode">Kode SAP (Opsional)</Label>
                                <Input
                                    id="mSapCode"
                                    placeholder="2000001"
                                    value={vendorForm.sapVendorCode}
                                    onChange={(e) => setVendorForm({ ...vendorForm, sapVendorCode: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="mEmail">Email Kontak *</Label>
                                <Input
                                    id="mEmail"
                                    type="email"
                                    placeholder="finance@vendor.com"
                                    value={vendorForm.email}
                                    onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="mPhone">Telepon / WhatsApp</Label>
                                <Input
                                    id="mPhone"
                                    placeholder="08123456789"
                                    value={vendorForm.phone}
                                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="mBank">Nama Bank</Label>
                                <Input
                                    id="mBank"
                                    placeholder="BRI"
                                    value={vendorForm.bankName}
                                    onChange={(e) => setVendorForm({ ...vendorForm, bankName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="mAcc">No. Rekening</Label>
                                <Input
                                    id="mAcc"
                                    placeholder="4595-01-028..."
                                    value={vendorForm.bankAccountNo}
                                    onChange={(e) => setVendorForm({ ...vendorForm, bankAccountNo: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="mHolder">Atas Nama</Label>
                                <Input
                                    id="mHolder"
                                    placeholder="CV Trimicel Jaya"
                                    value={vendorForm.bankAccountHolder}
                                    onChange={(e) => setVendorForm({ ...vendorForm, bankAccountHolder: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="mTop">TOP Default (Hari)</Label>
                                <Input
                                    id="mTop"
                                    type="number"
                                    value={vendorForm.defaultTopDays}
                                    onChange={(e) => setVendorForm({ ...vendorForm, defaultTopDays: Number(e.target.value) || 30 })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="mNpwp">NPWP</Label>
                                <Input
                                    id="mNpwp"
                                    placeholder="02.919.245..."
                                    value={vendorForm.npwp}
                                    onChange={(e) => setVendorForm({ ...vendorForm, npwp: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Status PKP</Label>
                                <div className="pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                                        <Checkbox
                                            checked={vendorForm.isPkp}
                                            onCheckedChange={(c) => setVendorForm({ ...vendorForm, isPkp: Boolean(c) })}
                                        />
                                        <span>Pengusaha Kena Pajak</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isSavingVendor}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-2 mt-2"
                        >
                            {isSavingVendor ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                            {selectedVendorForEdit ? "Simpan Perubahan Vendor" : "Daftarkan Vendor"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL 9: BUAT KONTRAK BARU */}
            <Dialog open={isAddContractOpen} onOpenChange={setIsAddContractOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            Buat Master Kontrak Vendor &amp; Perjanjian Sewa
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Daftarkan kontrak payung atau sewa kendaraan/jasa lengkap dengan spesifikasi unit dan harga sewa.
                        </DialogDescription>
                    </DialogHeader>

                    {contractFormError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{contractFormError}</span>
                        </div>
                    )}

                    <form onSubmit={handleSaveContract} className="space-y-3.5 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="cNum">Nomor Kontrak *</Label>
                                <Input
                                    id="cNum"
                                    placeholder="Contoh: 505/TJ-CP/LV/X/2025"
                                    value={contractForm.contractNumber}
                                    onChange={(e) => setContractForm({ ...contractForm, contractNumber: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cTitle">Judul Kontrak / Perjanjian *</Label>
                                <Input
                                    id="cTitle"
                                    placeholder="Perjanjian Sewa Menyewa Kendaraan"
                                    value={contractForm.title}
                                    onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="cVendor">Nama Rekan Vendor *</Label>
                                <Input
                                    id="cVendor"
                                    placeholder="CV TRIMICEL JAYA"
                                    value={contractForm.vendorName}
                                    onChange={(e) => setContractForm({ ...contractForm, vendorName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cVendorCode">Kode SAP Vendor (Opsional)</Label>
                                <Input
                                    id="cVendorCode"
                                    placeholder="2000001"
                                    value={contractForm.vendorSapCode}
                                    onChange={(e) => setContractForm({ ...contractForm, vendorSapCode: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Rincian Barang / Jasa / Unit Sewa */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border space-y-2.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                Spesifikasi Barang / Jasa / Unit Kendaraan
                            </span>

                            <div className="space-y-1">
                                <Label htmlFor="cItemName">Nama Barang / Unit *</Label>
                                <Input
                                    id="cItemName"
                                    placeholder="MITSUBISHI TRITON 2.5L DC HDX-L (4X4) MT"
                                    value={contractForm.itemName}
                                    onChange={(e) => setContractForm({ ...contractForm, itemName: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="cPlate">Nomor Polisi</Label>
                                    <Input
                                        id="cPlate"
                                        placeholder="DA 8109 HH"
                                        value={contractForm.policeNumber}
                                        onChange={(e) => setContractForm({ ...contractForm, policeNumber: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="cYear">Tahun Pembuatan</Label>
                                    <Input
                                        id="cYear"
                                        type="number"
                                        placeholder="2022"
                                        value={contractForm.year}
                                        onChange={(e) => setContractForm({ ...contractForm, year: Number(e.target.value) || 2022 })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="cLoc">Lokasi Kerja</Label>
                                    <Input
                                        id="cLoc"
                                        placeholder="Adaro / Tanjung Tabalong"
                                        value={contractForm.location}
                                        onChange={(e) => setContractForm({ ...contractForm, location: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Nilai Sewa & Periode */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="cVal">Nilai Sewa (Rupiah/Bulan) *</Label>
                                <Input
                                    id="cVal"
                                    type="number"
                                    value={contractForm.contractValue}
                                    onChange={(e) => setContractForm({ ...contractForm, contractValue: Number(e.target.value) || 0 })}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cStart">Tanggal Mulai Berlaku *</Label>
                                <Input
                                    id="cStart"
                                    type="date"
                                    value={contractForm.startDate}
                                    onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cEnd">Tanggal Berakhir *</Label>
                                <Input
                                    id="cEnd"
                                    type="date"
                                    value={contractForm.endDate}
                                    onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        {/* TOP & Pajak */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="cTop">Term of Payment (Hari)</Label>
                                <Input
                                    id="cTop"
                                    type="number"
                                    value={contractForm.topDays}
                                    onChange={(e) => setContractForm({ ...contractForm, topDays: Number(e.target.value) || 45 })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cPpn">PPN (%)</Label>
                                <Input
                                    id="cPpn"
                                    type="number"
                                    value={contractForm.ppnPercent}
                                    onChange={(e) => setContractForm({ ...contractForm, ppnPercent: Number(e.target.value) || 11 })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cPph">PPh (%)</Label>
                                <Input
                                    id="cPph"
                                    type="number"
                                    value={contractForm.pphPercent}
                                    onChange={(e) => setContractForm({ ...contractForm, pphPercent: Number(e.target.value) || 2 })}
                                />
                            </div>
                        </div>

                        {/* Rekening Bank Pembayaran */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label htmlFor="cBName">Bank</Label>
                                <Input
                                    id="cBName"
                                    value={contractForm.bankName}
                                    onChange={(e) => setContractForm({ ...contractForm, bankName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cBNum">No. Rekening</Label>
                                <Input
                                    id="cBNum"
                                    value={contractForm.bankAccountNumber}
                                    onChange={(e) => setContractForm({ ...contractForm, bankAccountNumber: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cBOwner">Atas Nama</Label>
                                <Input
                                    id="cBOwner"
                                    value={contractForm.bankAccountHolder}
                                    onChange={(e) => setContractForm({ ...contractForm, bankAccountHolder: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Berkas PDF Kontrak */}
                        <div className="space-y-1">
                            <Label>Unggah Salinan PDF Kontrak Perjanjian (Opsional)</Label>
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => setContractPdfFile(e.target.files?.[0] || null)}
                                className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-indigo-600 file:text-white cursor-pointer"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={isSavingContract}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 mt-2"
                        >
                            {isSavingContract ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                            Simpan Master Kontrak
                        </Button>
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
