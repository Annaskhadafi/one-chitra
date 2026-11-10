"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    getAccentureMasterVendorsAction,
    createAccentureMasterVendorAction,
    updateAccentureMasterVendorAction,
    deleteAccentureMasterVendorAction,
} from "@/app/actions/vendor-invoices"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Edit2,
    Trash2,
    Plus,
    ArrowLeft,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Building2,
    ShieldAlert,
    CreditCard,
    UserCheck,
} from "lucide-react"

const BUSINESS_CATEGORIES = [
    "46590 - Perdagangan Besar Mesin, Peralatan dan Perlengkapan Lainnya",
    "77322 - Aktivitas Penyewaan dan Sewa Guna Tanpa Hak Opsi Alat Berat / Transportasi",
    "84121 - Administrasi Pelayanan Pemerintah Bidang Pendidikan",
    "84126 - Administrasi Pelayanan Pemerintah Bidang Kebudayaan/Kesenian/Rekreasi/Olahraga",
    "66145 - Agen Perantara Pedagang Efek",
    "62014 - Aktivitas Pengembangan Teknologi Blockchain",
    "84122 - Aktivitas Organisasi Ilmu Pengetahuan Alam Dan Teknologi",
    "85492 - Jasa Pendidikan Komputer (Teknologi Informasi dan Komunikasi)",
    "64951 - Layanan Pinjam Meminjam Uang Berbasis Teknologi Informasi",
    "45201 - Reparasi Mobil dan Truk Berat",
    "49431 - Angkutan Bermotor Untuk Barang Umum",
    "33120 - Reparasi Peralatan Permesinan & Pabrik",
]

interface MasterVendor {
    id: number
    supplierCode: string
    vendorName: string
    address?: string | null
    street?: string | null
    city?: string | null
    country?: string | null
    npwp?: string | null
    typeOfBusiness?: string | null
    status: string
    directorName?: string | null
    directorPosition?: string | null
    directorEmail?: string | null
    directorPhone?: string | null
    salesPicName?: string | null
    salesPicPosition?: string | null
    salesPicEmail?: string | null
    salesPicPhone?: string | null
    bankName?: string | null
    bankAccountNumber?: string | null
    bankAccountHolder?: string | null
    topDays: number
    orderCurrency?: string | null
}

export function AccentureMasterVendorsView() {
    const [viewMode, setViewMode] = useState<"LIST" | "FORM">("LIST")
    const [isEditMode, setIsEditMode] = useState(false)
    const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null)

    // Filter & Pagination States (Slide 1)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("All Status")
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    // Data States
    const [vendors, setVendors] = useState<MasterVendor[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [isLoading, setIsLoading] = useState(false)

    // Form State (Slide 2)
    const [formError, setFormError] = useState<string | null>(null)
    const [formSuccess, setFormSuccess] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        vendorName: "",
        supplierCode: "",
        address: "",
        npwp: "",
        typeOfBusiness: BUSINESS_CATEGORIES[0],
        status: "Active",
        directorName: "",
        directorPosition: "",
        directorEmail: "",
        directorPhone: "",
        salesPicName: "",
        salesPicPosition: "",
        salesPicEmail: "",
        salesPicPhone: "",
        bankName: "BCA",
        bankAccountNumber: "",
        bankAccountHolder: "",
        topDays: 30,
        orderCurrency: "IDR",
    })

    // Fetch data from action
    const fetchVendors = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await getAccentureMasterVendorsAction({
                search: searchQuery,
                status: statusFilter,
                page: currentPage,
                pageSize,
            })
            setVendors(res.vendors as any)
            setTotalCount(res.totalCount)
            setTotalPages(res.totalPages)
        } catch (err) {
            console.error("Gagal mengambil master vendor:", err)
        } finally {
            setIsLoading(false)
        }
    }, [searchQuery, statusFilter, currentPage, pageSize])

    useEffect(() => {
        const timer = setTimeout(() => {
            void fetchVendors()
        }, 200)
        return () => clearTimeout(timer)
    }, [fetchVendors])

    // Open Form for Adding Vendor
    const handleOpenAdd = () => {
        setIsEditMode(false)
        setSelectedVendorId(null)
        setFormError(null)
        setFormSuccess(null)
        setFormData({
            vendorName: "",
            supplierCode: `9000${Math.floor(100 + Math.random() * 900)}`,
            address: "",
            npwp: "",
            typeOfBusiness: BUSINESS_CATEGORIES[0],
            status: "Active",
            directorName: "",
            directorPosition: "Direktur Utama",
            directorEmail: "",
            directorPhone: "",
            salesPicName: "",
            salesPicPosition: "Sales Account Executive",
            salesPicEmail: "",
            salesPicPhone: "",
            bankName: "BCA",
            bankAccountNumber: "",
            bankAccountHolder: "",
            topDays: 30,
            orderCurrency: "IDR",
        })
        setViewMode("FORM")
    }

    // Open Form for Editing Vendor (Persis Slide 2)
    const handleOpenEdit = (v: MasterVendor) => {
        setIsEditMode(true)
        setSelectedVendorId(v.id)
        setFormError(null)
        setFormSuccess(null)
        setFormData({
            vendorName: v.vendorName || "",
            supplierCode: v.supplierCode || "",
            address: v.address || v.street || "",
            npwp: v.npwp || "",
            typeOfBusiness: v.typeOfBusiness || BUSINESS_CATEGORIES[0],
            status: v.status || "Active",
            directorName: v.directorName || "",
            directorPosition: v.directorPosition || "Direktur Utama",
            directorEmail: v.directorEmail || "",
            directorPhone: v.directorPhone || "",
            salesPicName: v.salesPicName || "",
            salesPicPosition: v.salesPicPosition || "Sales PIC",
            salesPicEmail: v.salesPicEmail || "",
            salesPicPhone: v.salesPicPhone || "",
            bankName: v.bankName || "BCA",
            bankAccountNumber: v.bankAccountNumber || "",
            bankAccountHolder: v.bankAccountHolder || v.vendorName || "",
            topDays: v.topDays || 30,
            orderCurrency: v.orderCurrency || "IDR",
        })
        setViewMode("FORM")
    }

    // Handle Toggle Status / Delete Vendor
    const handleDeleteOrToggle = async (v: MasterVendor) => {
        const actionLabel = v.status === "Active" ? "menonaktifkan" : "mengaktifkan kembali"
        if (!confirm(`Apakah Anda yakin ingin ${actionLabel} vendor "${v.vendorName}" (${v.supplierCode})?`)) {
            return
        }

        try {
            await deleteAccentureMasterVendorAction(v.id)
            void fetchVendors()
        } catch (err) {
            console.error(err)
        }
    }

    // Save Vendor (Create or Update)
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormError(null)
        setFormSuccess(null)

        if (!formData.vendorName.trim()) {
            setFormError("Vendor Name wajib diisi.")
            return
        }

        setIsSaving(true)
        try {
            if (isEditMode && selectedVendorId) {
                const res = await updateAccentureMasterVendorAction(selectedVendorId, {
                    vendorName: formData.vendorName,
                    address: formData.address,
                    npwp: formData.npwp,
                    typeOfBusiness: formData.typeOfBusiness,
                    status: formData.status,
                    directorName: formData.directorName,
                    directorPosition: formData.directorPosition,
                    directorEmail: formData.directorEmail,
                    directorPhone: formData.directorPhone,
                    salesPicName: formData.salesPicName,
                    salesPicPosition: formData.salesPicPosition,
                    salesPicEmail: formData.salesPicEmail,
                    salesPicPhone: formData.salesPicPhone,
                    bankName: formData.bankName,
                    bankAccountNumber: formData.bankAccountNumber,
                    bankAccountHolder: formData.bankAccountHolder,
                    topDays: Number(formData.topDays) || 30,
                    orderCurrency: formData.orderCurrency,
                })

                if (!res.success) throw new Error(res.error)
                setFormSuccess("Vendor detail successfully updated.")
            } else {
                const res = await createAccentureMasterVendorAction({
                    vendorName: formData.vendorName,
                    supplierCode: formData.supplierCode,
                    address: formData.address,
                    npwp: formData.npwp,
                    typeOfBusiness: formData.typeOfBusiness,
                    status: formData.status,
                    directorName: formData.directorName,
                    directorPosition: formData.directorPosition,
                    directorEmail: formData.directorEmail,
                    directorPhone: formData.directorPhone,
                    salesPicName: formData.salesPicName,
                    salesPicPosition: formData.salesPicPosition,
                    salesPicEmail: formData.salesPicEmail,
                    salesPicPhone: formData.salesPicPhone,
                    bankName: formData.bankName,
                    bankAccountNumber: formData.bankAccountNumber,
                    bankAccountHolder: formData.bankAccountHolder,
                    topDays: Number(formData.topDays) || 30,
                    orderCurrency: formData.orderCurrency,
                })

                if (!res.success) throw new Error(res.error)
                setFormSuccess("Vendor successfully created.")
            }

            void fetchVendors()
            setTimeout(() => {
                setViewMode("LIST")
            }, 800)
        } catch (err: any) {
            setFormError(err.message || "Failed to save vendor data.")
        } finally {
            setIsSaving(false)
        }
    }

    // ==========================================
    // VIEW 1: TABEL DAFTAR (Persis Slide 1 Accenture)
    // ==========================================
    if (viewMode === "LIST") {
        const fromItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
        const toItem = Math.min(currentPage * pageSize, totalCount)

        return (
            <div className="space-y-4 font-sans text-slate-800 dark:text-slate-200">
                {/* Header Title & Accenture Note */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span className="w-3 h-3 bg-cyan-500 rounded-sm inline-block"></span>
                            Master Data Vendors
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-4xl leading-relaxed">
                            List of vendor that already registered in VPMS Apps, due VPMS integrate the data vendor to SAP System, then vendor who previously registered in SAP will automatically appear here. VPMS also accommodate add vendor in system.
                        </p>
                    </div>

                    <Button
                        size="sm"
                        onClick={handleOpenAdd}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs shrink-0 self-start sm:self-center"
                    >
                        <Plus className="w-4 h-4" />
                        Add Vendor
                    </Button>
                </div>

                {/* Filter & Search Bar (Persis Slide 1) */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <Input
                            placeholder="Search vendors by Vendor Code, Name..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentPage(1)
                            }}
                            className="pl-9 text-xs h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-md"
                        />
                    </div>

                    <div className="w-44">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value)
                                setCurrentPage(1)
                            }}
                            className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-700 dark:text-slate-300 focus:outline-hidden"
                        >
                            <option value="All Status">All Status</option>
                            <option value="Active">Active</option>
                            <option value="Blacklisted">Blacklisted</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                {/* Table Vendors (Persis Slide 1) */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-4 py-3 whitespace-nowrap">Vendor Code</th>
                                    <th className="px-4 py-3 min-w-[200px]">Vendor Name</th>
                                    <th className="px-4 py-3 whitespace-nowrap">NPWP / Tax ID</th>
                                    <th className="px-4 py-3 min-w-[340px]">Type of Business</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Status</th>
                                    <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                                                <span>Loading Master Data Vendors...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : vendors.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                            Tidak ditemukan vendor yang sesuai dengan pencarian &quot;{searchQuery}&quot;.
                                        </td>
                                    </tr>
                                ) : (
                                    vendors.map((v) => (
                                        <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-4 py-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                                                {v.supplierCode}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                                                {v.vendorName}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                                                {v.npwp || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 leading-snug">
                                                {v.typeOfBusiness || "-"}
                                            </td>
                                            <td className="px-4 py-3">
                                                {v.status === "Active" ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                        Active
                                                    </span>
                                                ) : v.status === "Blacklisted" ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800">
                                                        Blacklisted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200">
                                                        {v.status || "Inactive"}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Tombol Edit Pensil Oranye (Persis Slide 1) */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(v)}
                                                        title="Edit Vendor"
                                                        className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-md transition-colors"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    {/* Tombol Hapus/Status Toggle Oranye (Persis Slide 1) */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteOrToggle(v)}
                                                        title={v.status === "Active" ? "Nonaktifkan / Blacklist" : "Aktifkan"}
                                                        className="p-1.5 text-amber-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Bar (Persis Slide 1: Displaying X of Y Results & Page Z of W) */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <span>Displaying</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value))
                                    setCurrentPage(1)
                                }}
                                className="h-7 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                            <span>of {totalCount.toLocaleString("id-ID")} Results</span>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                            <span>Page {currentPage} of {totalPages}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    disabled={currentPage <= 1 || isLoading}
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    disabled={currentPage >= totalPages || isLoading}
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ==========================================
    // VIEW 2: FORM EDIT / ADD VENDOR (Persis Slide 2 Accenture)
    // ==========================================
    return (
        <div className="space-y-4 font-sans text-slate-800 dark:text-slate-200 max-w-5xl mx-auto">
            {/* Header with < Back button & Breadcrumb */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setViewMode("LIST")}
                        className="text-cyan-600 hover:text-cyan-700 text-xs font-semibold flex items-center gap-1 p-1 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 rounded transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {isEditMode ? "Edit Vendor" : "Add Vendor"}
                    </h2>
                </div>

                <div className="text-[11px] text-slate-400 font-medium">
                    Master Data &gt; Vendors &gt; <span className="text-slate-700 dark:text-slate-300 font-semibold">{formData.vendorName || "New"}</span>
                </div>
            </div>

            {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                </div>
            )}

            {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{formSuccess}</span>
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-5 text-xs bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                {/* Row 1: Vendor Name & Vendor Code (Slide 2) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="vName" className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                            Vendor Name *
                        </Label>
                        <Input
                            id="vName"
                            value={formData.vendorName}
                            onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                            placeholder="CANVA PTY LTD"
                            required
                            className="text-xs h-9 bg-slate-50 dark:bg-slate-800/60"
                        />
                        <span className="text-[10px] text-slate-400 italic block">
                            {isEditMode ? "Vendor Name cannot be changes while editing" : "Enter registered company name"}
                        </span>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="vCode" className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                            Vendor Code
                        </Label>
                        <Input
                            id="vCode"
                            value={formData.supplierCode}
                            onChange={(e) => setFormData({ ...formData, supplierCode: e.target.value })}
                            placeholder="2012328"
                            readOnly={isEditMode}
                            className={`text-xs h-9 font-mono ${isEditMode ? "bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-slate-50"}`}
                        />
                        <span className="text-[10px] text-slate-400 italic block">Auto generated / SAP Vendor Code</span>
                    </div>
                </div>

                {/* Row 2: Address (Slide 2) */}
                <div className="space-y-1">
                    <Label htmlFor="vAddress" className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                        Address
                    </Label>
                    <Textarea
                        id="vAddress"
                        rows={2}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Enter vendor head office address..."
                        className="text-xs bg-slate-50 dark:bg-slate-800/60"
                    />
                </div>

                {/* Row 3: NPWP / Tax ID & Type of Business (Slide 2) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="vNpwp" className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                            NPWP / Tax ID
                        </Label>
                        <Input
                            id="vNpwp"
                            value={formData.npwp}
                            onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                            placeholder="Enter NPWP / Tax ID"
                            className="text-xs h-9 bg-slate-50 dark:bg-slate-800/60"
                        />
                        <span className="text-[10px] text-slate-400 italic block">Insert NPWP / Tax ID if available</span>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="vType" className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                            Type of Business
                        </Label>
                        <select
                            id="vType"
                            value={formData.typeOfBusiness}
                            onChange={(e) => setFormData({ ...formData, typeOfBusiness: e.target.value })}
                            className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
                        >
                            {BUSINESS_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                        <span className="text-[10px] text-slate-400 italic block">Select one or more business categories</span>
                    </div>
                </div>

                {/* Section 1: Vendor Director Detail (Persis Slide 2) */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <UserCheck className="w-4 h-4 text-cyan-600" />
                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Vendor Director Detail</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="vDirName">Name *</Label>
                            <Input
                                id="vDirName"
                                value={formData.directorName}
                                onChange={(e) => setFormData({ ...formData, directorName: e.target.value })}
                                placeholder="Enter director name"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="vDirPos">Position Name/Title *</Label>
                            <Input
                                id="vDirPos"
                                value={formData.directorPosition}
                                onChange={(e) => setFormData({ ...formData, directorPosition: e.target.value })}
                                placeholder="Enter position title"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="vDirEmail">Email Address *</Label>
                            <Input
                                id="vDirEmail"
                                type="email"
                                value={formData.directorEmail}
                                onChange={(e) => setFormData({ ...formData, directorEmail: e.target.value })}
                                placeholder="director@email.com"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="vDirPhone">Phone Number *</Label>
                            <Input
                                id="vDirPhone"
                                value={formData.directorPhone}
                                onChange={(e) => setFormData({ ...formData, directorPhone: e.target.value })}
                                placeholder="Enter phone number"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 2: Vendor Sales PIC Detail (Persis Slide 2) */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <Building2 className="w-4 h-4 text-cyan-600" />
                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Vendor Sales PIC Detail</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="vPicName">Name *</Label>
                            <Input
                                id="vPicName"
                                value={formData.salesPicName}
                                onChange={(e) => setFormData({ ...formData, salesPicName: e.target.value })}
                                placeholder="Enter contact person name"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="vPicPos">Position Name/Title *</Label>
                            <Input
                                id="vPicPos"
                                value={formData.salesPicPosition}
                                onChange={(e) => setFormData({ ...formData, salesPicPosition: e.target.value })}
                                placeholder="Enter position title"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="vPicEmail">Email Address *</Label>
                            <Input
                                id="vPicEmail"
                                type="email"
                                value={formData.salesPicEmail}
                                onChange={(e) => setFormData({ ...formData, salesPicEmail: e.target.value })}
                                placeholder="sales@email.com"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="vPicPhone">Phone Number *</Label>
                            <Input
                                id="vPicPhone"
                                value={formData.salesPicPhone}
                                onChange={(e) => setFormData({ ...formData, salesPicPhone: e.target.value })}
                                placeholder="Enter phone number"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 3: Bank & Payment Terms (One Chitra Integration) */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-cyan-600" />
                            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                Bank Account &amp; Term of Payment
                            </h4>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="vStatus" className="text-[11px] text-slate-500">Status Vendor:</Label>
                            <select
                                id="vStatus"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="h-7 px-2 text-xs bg-white dark:bg-slate-800 border rounded font-semibold text-cyan-700"
                            >
                                <option value="Active">Active</option>
                                <option value="Blacklisted">Blacklisted</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="vBankName">Bank Name</Label>
                            <Input
                                id="vBankName"
                                value={formData.bankName}
                                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                placeholder="BCA / BRI / Mandiri"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="vAccNo">Bank Account Number</Label>
                            <Input
                                id="vAccNo"
                                value={formData.bankAccountNumber}
                                onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                                placeholder="1234567890"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="vAccHolder">Account Holder (a/n)</Label>
                            <Input
                                id="vAccHolder"
                                value={formData.bankAccountHolder}
                                onChange={(e) => setFormData({ ...formData, bankAccountHolder: e.target.value })}
                                placeholder="CANVA PTY LTD"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="vTopDays">Term of Payment (TOP Hari)</Label>
                            <Input
                                id="vTopDays"
                                type="number"
                                value={formData.topDays}
                                onChange={(e) => setFormData({ ...formData, topDays: Number(e.target.value) || 30 })}
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="vCurrency">Order Currency</Label>
                            <Input
                                id="vCurrency"
                                value={formData.orderCurrency}
                                onChange={(e) => setFormData({ ...formData, orderCurrency: e.target.value })}
                                placeholder="IDR / USD"
                                className="text-xs h-8 bg-white dark:bg-slate-800"
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom Action: Save Button (Persis Slide 2) */}
                <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setViewMode("LIST")}
                        className="text-xs h-9 px-4"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSaving}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs h-9 px-6 rounded-md shadow-xs transition-colors"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                Saving...
                            </>
                        ) : (
                            "Save"
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}
