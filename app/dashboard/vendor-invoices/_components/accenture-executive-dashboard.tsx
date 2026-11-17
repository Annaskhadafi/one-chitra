"use client"

import React, { useState, useMemo, useEffect } from "react"
import {
    FileText,
    TrendingUp,
    Coins,
    Clock,
    Hourglass,
    ShieldCheck,
    CheckCircle2,
    Calendar,
    Bell,
    User,
    Search,
    Filter,
    Download,
    Eye,
    Trophy,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    BarChart3,
    ArrowUp,
    ArrowDown,
    Check,
    FileSpreadsheet,
    Building2,
    FilePlus2,
    UserPlus,
    Award,
    ClipboardCheck,
    Sparkles,
    Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ExecutiveDashboardProps {
    invoices: any[]
    stats: any
    onSelectInvoice: (invoice: any) => void
    onOpenTab: (tabName: string) => void
    onOpenAddContract?: () => void
    onOpenAddVendor?: () => void
    onOpenProcurementEntry?: () => void
}

function formatCurrency(amount: number | string): string {
    const val = Number(amount) || 0
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(val)
}

function formatDateIndo(dateStr: string | Date | null | undefined): string {
    if (!dateStr) return "-"
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return "-"
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

export function AccentureExecutiveDashboard({
    invoices = [],
    stats,
    onSelectInvoice,
    onOpenTab,
    onOpenAddContract,
    onOpenAddVendor,
    onOpenProcurementEntry,
}: ExecutiveDashboardProps) {
    // Search & Sort state
    const [searchTerm, setSearchTerm] = useState("")
    const [sortField, setSortField] = useState<"invoiceDate" | "invoiceNumber" | "paymentDueDate" | "grandTotal">("invoiceDate")
    const [sortAsc, setSortAsc] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 10
    const [trendPeriod, setTrendPeriod] = useState("6 Bulan Terakhir")
    const [currentTime, setCurrentTime] = useState("17 Nov 2026  08:10:18 (UTC+8)")

    // Reset pagination to page 1 whenever search or sort changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, sortField, sortAsc])

    useEffect(() => {
        const updateClock = () => {
            const now = new Date()
            const dateStr = now.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
            })
            const timeStr = now.toLocaleTimeString("id-ID", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            })
            setCurrentTime(`${dateStr}  ${timeStr} (UTC+8)`)
        }
        updateClock()
        const timer = setInterval(updateClock, 1000)
        return () => clearInterval(timer)
    }, [])

    // Real or Default KPI Metrics
    const totalInvoiceCount = invoices.length > 0 ? invoices.length : 622
    const totalInvoiceValue = invoices.length > 0 
        ? invoices.reduce((acc, inv) => acc + (Number(inv.grandTotal) || Number(inv.netPayable) || 0), 0)
        : 10450928

    const countSubmitted = stats?.summary?.countSubmitted ?? 12
    const countVerifiedAdmin = stats?.summary?.countVerifiedAdmin ?? 8
    const countValidatedFinance = stats?.summary?.countValidatedFinance ?? 5
    const countApprovedManager = stats?.summary?.countApprovedManager ?? 2

    // Top 5 Vendors Calculation
    const topVendors = useMemo(() => {
        const vendorMap: { [name: string]: number } = {}
        invoices.forEach((inv) => {
            const name = inv.tenant?.name || inv.vendorName || "Mitra Vendor"
            const amt = Number(inv.grandTotal) || Number(inv.netPayable) || 0
            vendorMap[name] = (vendorMap[name] || 0) + amt
        })

        const sorted = Object.entries(vendorMap)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)

        if (sorted.length >= 3 && sorted[0].amount > 0) {
            const maxVal = sorted[0].amount || 1
            return sorted.map((v) => ({
                ...v,
                pct: Math.max(30, Math.min(100, Math.round((v.amount / maxVal) * 100))),
            }))
        }

        // Default exact mockup values for high-fidelity presentation
        return [
            { name: "CV. Rizky Abadi Teknik", amount: 1220000000, pct: 95 },
            { name: "PT. OGS Indonesia", amount: 1125500000, pct: 85 },
            { name: "PT. Mentari Grih Kencana", amount: 987000000, pct: 68 },
            { name: "PT. Lindra Harta Wijaya", amount: 825750000, pct: 55 },
            { name: "CV. Delta Jaya Utama", amount: 776300000, pct: 48 },
        ]
    }, [invoices])

    // Top 20 PO & Invoice Terbesar Bulan Ini
    const [top20Tab, setTop20Tab] = useState<"invoices" | "pos">("invoices")
    const [top20Period, setTop20Period] = useState<"this_month" | "all_time">("this_month")

    const top20Invoices = useMemo(() => {
        let pool = invoices && invoices.length > 0 ? [...invoices] : []
        if (pool.length === 0) return []

        if (top20Period === "this_month") {
            const thisMonthInvs = pool.filter((inv) => {
                const dateStr = inv.invoiceDate || inv.createdAt
                if (!dateStr) return false
                const d = new Date(dateStr)
                return (
                    (d.getMonth() === 10 && d.getFullYear() === 2026) ||
                    (d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear())
                )
            })
            if (thisMonthInvs.length >= 3) {
                pool = thisMonthInvs
            }
        }

        return [...pool]
            .sort((a, b) => {
                const amtA = Number(a.grandTotal) || Number(a.netPayable) || 0
                const amtB = Number(b.grandTotal) || Number(b.netPayable) || 0
                return amtB - amtA
            })
            .slice(0, 20)
    }, [invoices, top20Period])

    const top20Pos = useMemo(() => {
        let pool = invoices && invoices.length > 0 ? [...invoices] : []
        if (pool.length === 0) return []

        if (top20Period === "this_month") {
            const thisMonthInvs = pool.filter((inv) => {
                const dateStr = inv.invoiceDate || inv.createdAt
                if (!dateStr) return false
                const d = new Date(dateStr)
                return (
                    (d.getMonth() === 10 && d.getFullYear() === 2026) ||
                    (d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear())
                )
            })
            if (thisMonthInvs.length >= 3) {
                pool = thisMonthInvs
            }
        }

        const poMap: {
            [po: string]: {
                poNumber: string
                vendorName: string
                totalAmount: number
                invoicesCount: number
                latestInvoice: any
                dueDate: string
                status: string
            }
        } = {}

        pool.forEach((inv) => {
            const rawPo = inv.poNumber ? String(inv.poNumber).trim() : null
            if (!rawPo || rawPo === "-" || rawPo.toLowerCase() === "null") return
            const amt = Number(inv.grandTotal) || Number(inv.netPayable) || 0
            const vendor = inv.tenant?.name || inv.vendorName || "Mitra Vendor"

            if (!poMap[rawPo]) {
                poMap[rawPo] = {
                    poNumber: rawPo,
                    vendorName: vendor,
                    totalAmount: 0,
                    invoicesCount: 0,
                    latestInvoice: inv,
                    dueDate: inv.paymentDueDate || inv.invoiceDate,
                    status: inv.status,
                }
            }
            poMap[rawPo].totalAmount += amt
            poMap[rawPo].invoicesCount += 1
        })

        return Object.values(poMap)
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, 20)
    }, [invoices, top20Period])

    // Filtered Invoices for Table (Sorted by Latest Date by default)
    const allFilteredInvoices = useMemo(() => {
        let list = invoices && invoices.length > 0 ? [...invoices] : []

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase()
            list = list.filter((inv) => {
                const num = (inv.invoiceNumber || "").toLowerCase()
                const vend = (inv.tenant?.name || inv.vendorName || "").toLowerCase()
                const po = (inv.poNumber || "").toLowerCase()
                return num.includes(q) || vend.includes(q) || po.includes(q)
            })
        }

        const getTime = (val: any) => {
            if (!val) return 0
            const t = new Date(val).getTime()
            return isNaN(t) ? 0 : t
        }

        list.sort((a, b) => {
            if (sortField === "invoiceDate") {
                const timeA = getTime(a.invoiceDate) || getTime(a.createdAt)
                const timeB = getTime(b.invoiceDate) || getTime(b.createdAt)
                return sortAsc ? timeA - timeB : timeB - timeA
            }
            if (sortField === "paymentDueDate") {
                const timeA = getTime(a.paymentDueDate)
                const timeB = getTime(b.paymentDueDate)
                return sortAsc ? timeA - timeB : timeB - timeA
            }
            if (sortField === "grandTotal") {
                const valA = Number(a.grandTotal) || Number(a.netPayable) || 0
                const valB = Number(b.grandTotal) || Number(b.netPayable) || 0
                return sortAsc ? valA - valB : valB - valA
            }
            if (sortField === "invoiceNumber") {
                const valA = String(a.invoiceNumber || "")
                const valB = String(b.invoiceNumber || "")
                return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA)
            }
            return 0
        })

        return list
    }, [invoices, searchTerm, sortField, sortAsc])

    const totalFiltered = allFilteredInvoices.length
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return allFilteredInvoices.slice(start, start + pageSize)
    }, [allFilteredInvoices, currentPage, pageSize])

    const handleExportCsv = () => {
        const headers = ["ID", "No Invoice", "Vendor", "No PO", "Tgl Invoice", "Jatuh Tempo", "Nilai Invoice", "Status", "Aging (Hari)"]
        const rows = allFilteredInvoices.map((inv: any) => {
            const vName = inv.tenant?.name || inv.vendorName || "-"
            const amt = Number(inv.grandTotal) || Number(inv.netPayable) || 0
            const po = inv.poNumber || "-"
            const invDate = inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : "-"
            const dueDate = inv.paymentDueDate ? new Date(inv.paymentDueDate).toISOString().slice(0, 10) : "-"
            const status = inv.status || "-"
            const aging = inv.agingDays ?? 30
            return [
                `"${inv.id || ""}"`,
                `"${inv.invoiceNumber || ""}"`,
                `"${vName.replace(/"/g, '""')}"`,
                `"${po}"`,
                `"${invDate}"`,
                `"${dueDate}"`,
                amt,
                `"${status}"`,
                aging,
            ].join(",")
        })
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n")
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `daftar_invoice_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleSortToggle = (field: typeof sortField) => {
        if (sortField === field) {
            setSortAsc(!sortAsc)
        } else {
            setSortField(field)
            setSortAsc(false)
        }
    }

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case "submitted":
                return (
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-[11px] font-semibold rounded-md inline-block">
                        Menunggu Admin
                    </span>
                )
            case "verified_admin":
                return (
                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-[11px] font-semibold rounded-md inline-block">
                        Menunggu Finance
                    </span>
                )
            case "validated_finance":
                return (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[11px] font-semibold rounded-md inline-block">
                        Menunggu Manager
                    </span>
                )
            case "approved_manager":
                return (
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-[11px] font-semibold rounded-md inline-block">
                        Siap Bayar
                    </span>
                )
            case "paid":
                return (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[11px] font-semibold rounded-md inline-block">
                        Lunas (Paid)
                    </span>
                )
            default:
                return (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-md inline-block">
                        {status}
                    </span>
                )
        }
    }

    return (
        <div className="space-y-5 font-sans">
            {/* 1. TOP HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-2xs backdrop-blur-xs">
                <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                            Vendor Invoice Management &amp; Checkout
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            Kelola seluruh siklus invoice vendor: Validasi Gate Admin, Validasi Pajak Finance, Otorisasi Manager, Proyeksi Pembayaran 3 Bulan, dan Batch Payment Checkout.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
                    {/* Timestamp Badge */}
                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>{currentTime}</span>
                    </div>

                    {/* Notification Bell */}
                    <button className="relative w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-300 transition-colors shadow-2xs">
                        <Bell className="w-4 h-4" />
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                            3
                        </span>
                    </button>

                    {/* Profile Avatar */}
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                        AR
                    </div>
                </div>
            </div>

            {/* 2. SUB-NAV / TABS PILLS */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Tab: Monitoring & Proyeksi (Active) */}
                    <button
                        onClick={() => onOpenTab("monitoring")}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Monitoring &amp; Proyeksi</span>
                    </button>

                    {/* Tab: AP Aging */}
                    <button
                        onClick={() => onOpenTab("aging")}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-medium transition-all"
                    >
                        AP Aging (Umur Utang)
                    </button>

                    {/* Tab: Validation Gate Admin */}
                    <button
                        onClick={() => onOpenTab("admin")}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                        <span>Validation Gate Admin</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                            {countSubmitted}
                        </span>
                    </button>

                    {/* Tab: Validasi Finance */}
                    <button
                        onClick={() => onOpenTab("finance")}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                        <span>Validasi Finance</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                            {countVerifiedAdmin}
                        </span>
                    </button>

                    {/* Tab: Otorisasi Manager */}
                    <button
                        onClick={() => onOpenTab("manager")}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                        <span>Otorisasi Manager</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                            {countValidatedFinance}
                        </span>
                    </button>

                    {/* Tab: Batch Checkout */}
                    <button
                        onClick={() => onOpenTab("checkout")}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                        <span>Batch Checkout</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                            {countApprovedManager}
                        </span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Rta Badge */}
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        Rta: 1 Hari
                    </span>

                    {/* Dropdown Menu Master */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-xl text-xs gap-1 font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                            >
                                <span>Master</span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl p-1 shadow-lg">
                            <DropdownMenuItem
                                onClick={onOpenAddContract}
                                className="text-xs cursor-pointer py-2 gap-2"
                            >
                                <FileText className="w-4 h-4 text-blue-600" />
                                <span>Buat Master Kontrak Sewa</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={onOpenAddVendor}
                                className="text-xs cursor-pointer py-2 gap-2"
                            >
                                <Building2 className="w-4 h-4 text-purple-600" />
                                <span>Tambah Master Rekan Vendor</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={onOpenProcurementEntry}
                                className="text-xs cursor-pointer py-2 gap-2"
                            >
                                <FilePlus2 className="w-4 h-4 text-emerald-600" />
                                <span>Entry Invoice Baru (Wizard)</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* 3. ROW 1: 4 KPI CARDS (Pastel Gradient with Watermark) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CARD 1: Total Invoice */}
                <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/60 dark:from-blue-950/20 dark:to-indigo-950/30 border border-blue-100/90 dark:border-blue-900/50 shadow-2xs">
                    <div className="relative z-10 flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
                                Total Invoice
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                                    {totalInvoiceCount}
                                </span>
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                                    ▲ +12%
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                                vs bulan lalu
                            </span>
                        </div>
                    </div>
                    {/* Watermark Document */}
                    <FileText className="absolute -right-3 -bottom-3 w-24 h-24 text-blue-600/10 dark:text-blue-400/5 pointer-events-none" />
                </div>

                {/* CARD 2: Total Nilai Invoice */}
                <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/60 dark:from-emerald-950/20 dark:to-teal-950/30 border border-emerald-100/90 dark:border-emerald-900/50 shadow-2xs">
                    <div className="relative z-10 flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Coins className="w-6 h-6" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
                                Total Nilai Invoice
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                                    {formatCurrency(totalInvoiceValue)}
                                </span>
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                                    ▲ +8%
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                                akumulasi tagihan aktif
                            </span>
                        </div>
                    </div>
                    {/* Watermark Graph */}
                    <TrendingUp className="absolute -right-3 -bottom-3 w-24 h-24 text-emerald-600/10 dark:text-emerald-400/5 pointer-events-none" />
                </div>

                {/* CARD 3: On Time Payment */}
                <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50/60 dark:from-amber-950/20 dark:to-yellow-950/30 border border-amber-100/90 dark:border-amber-900/50 shadow-2xs">
                    <div className="relative z-10 flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
                                On Time Payment
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                                    96.1%
                                </span>
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                                    ▲ +1.2%
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                                kepatuhan jadwal TOP
                            </span>
                        </div>
                    </div>
                    {/* Watermark Clock */}
                    <Clock className="absolute -right-3 -bottom-3 w-24 h-24 text-amber-500/10 dark:text-amber-400/5 pointer-events-none" />
                </div>

                {/* CARD 4: Rata-rata Umur Invoice */}
                <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50/60 dark:from-purple-950/20 dark:to-violet-950/30 border border-purple-100/90 dark:border-purple-900/50 shadow-2xs">
                    <div className="relative z-10 flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Hourglass className="w-6 h-6" />
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
                                Rata-rata Umur Invoice
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                                    12.8 Hari
                                </span>
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[10px] font-bold rounded">
                                    ▼ -1.5 Hari
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                                siklus entry s/d lunas
                            </span>
                        </div>
                    </div>
                    {/* Watermark Hourglass */}
                    <Hourglass className="absolute -right-3 -bottom-3 w-24 h-24 text-purple-600/10 dark:text-purple-400/5 pointer-events-none" />
                </div>
            </div>

            {/* 4. ROW 2: CHARTS & VISUAL ANALYTICS (3 Cards) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 4.1 Card Kiri (Lebar 6/12): Tren & KPI Utama */}
                <div className="lg:col-span-6 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                Tren &amp; KPI Utama
                            </h3>
                        </div>

                        <select
                            value={trendPeriod}
                            onChange={(e) => setTrendPeriod(e.target.value)}
                            className="text-xs border rounded-lg px-2 py-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
                        >
                            <option>6 Bulan Terakhir</option>
                            <option>12 Bulan Terakhir</option>
                        </select>
                    </div>

                    {/* Chart Legend */}
                    <div className="flex items-center gap-4 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                            <span>Total Invoice</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>Nilai Invoice (Rp Juta)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-0.5 bg-amber-500 rounded" />
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 -ml-2" />
                            <span>On Time Payment (%)</span>
                        </div>
                    </div>

                    {/* SVG Chart (Combo Bar + Line) */}
                    <div className="w-full h-56 pt-2">
                        <svg viewBox="0 0 540 210" className="w-full h-full overflow-visible text-[10px]">
                            {/* Grid Horizontal Lines */}
                            <line x1="35" y1="20" x2="505" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
                            <line x1="35" y1="55" x2="505" y2="55" stroke="#f1f5f9" strokeDasharray="3 3" />
                            <line x1="35" y1="90" x2="505" y2="90" stroke="#f1f5f9" strokeDasharray="3 3" />
                            <line x1="35" y1="125" x2="505" y2="125" stroke="#f1f5f9" strokeDasharray="3 3" />
                            <line x1="35" y1="160" x2="505" y2="160" stroke="#cbd5e1" strokeWidth="1" />

                            {/* Left Y-Axis Labels */}
                            <text x="28" y="24" textAnchor="end" fill="#94a3b8" fontSize="9">800</text>
                            <text x="28" y="59" textAnchor="end" fill="#94a3b8" fontSize="9">600</text>
                            <text x="28" y="94" textAnchor="end" fill="#94a3b8" fontSize="9">400</text>
                            <text x="28" y="129" textAnchor="end" fill="#94a3b8" fontSize="9">200</text>
                            <text x="28" y="164" textAnchor="end" fill="#94a3b8" fontSize="9">0</text>

                            {/* Right Y-Axis Labels */}
                            <text x="512" y="24" textAnchor="start" fill="#94a3b8" fontSize="9">100%</text>
                            <text x="512" y="59" textAnchor="start" fill="#94a3b8" fontSize="9">95%</text>
                            <text x="512" y="94" textAnchor="start" fill="#94a3b8" fontSize="9">90%</text>
                            <text x="512" y="129" textAnchor="start" fill="#94a3b8" fontSize="9">85%</text>
                            <text x="512" y="164" textAnchor="start" fill="#94a3b8" fontSize="9">80%</text>

                            {/* MONTH BARS (6 Items) */}
                            {/* 1. Jun 26 */}
                            <g transform="translate(48, 0)">
                                <text x="18" y="178" textAnchor="middle" fill="#64748b" fontSize="10">Jun 26</text>
                                {/* Total Inv Bar (520) */}
                                <rect x="3" y="68" width="13" height="92" rx="3" fill="#3b82f6" />
                                <text x="9" y="63" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">520</text>
                                {/* Nilai Inv Bar (8.1K) */}
                                <rect x="19" y="85" width="13" height="75" rx="3" fill="#10b981" />
                                <text x="25" y="80" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">8.1K</text>
                            </g>

                            {/* 2. Jul 26 */}
                            <g transform="translate(125, 0)">
                                <text x="18" y="178" textAnchor="middle" fill="#64748b" fontSize="10">Jul 26</text>
                                <rect x="3" y="63" width="13" height="97" rx="3" fill="#3b82f6" />
                                <text x="9" y="58" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">545</text>
                                <rect x="19" y="80" width="13" height="80" rx="3" fill="#10b981" />
                                <text x="25" y="75" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">8.7K</text>
                            </g>

                            {/* 3. Agt 26 */}
                            <g transform="translate(202, 0)">
                                <text x="18" y="178" textAnchor="middle" fill="#64748b" fontSize="10">Agt 26</text>
                                <rect x="3" y="58" width="13" height="102" rx="3" fill="#3b82f6" />
                                <text x="9" y="53" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">578</text>
                                <rect x="19" y="75" width="13" height="85" rx="3" fill="#10b981" />
                                <text x="25" y="70" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">9.1K</text>
                            </g>

                            {/* 4. Sep 26 */}
                            <g transform="translate(279, 0)">
                                <text x="18" y="178" textAnchor="middle" fill="#64748b" fontSize="10">Sep 26</text>
                                <rect x="3" y="54" width="13" height="106" rx="3" fill="#3b82f6" />
                                <text x="9" y="49" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">601</text>
                                <rect x="19" y="70" width="13" height="90" rx="3" fill="#10b981" />
                                <text x="25" y="65" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">9.7K</text>
                            </g>

                            {/* 5. Okt 26 */}
                            <g transform="translate(356, 0)">
                                <text x="18" y="178" textAnchor="middle" fill="#64748b" fontSize="10">Okt 26</text>
                                <rect x="3" y="50" width="13" height="110" rx="3" fill="#3b82f6" />
                                <text x="9" y="45" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">615</text>
                                <rect x="19" y="66" width="13" height="94" rx="3" fill="#10b981" />
                                <text x="25" y="61" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">9.9K</text>
                            </g>

                            {/* 6. Nov 26 */}
                            <g transform="translate(433, 0)">
                                <text x="18" y="178" textAnchor="middle" fill="#64748b" fontSize="10">Nov 26</text>
                                <rect x="3" y="47" width="13" height="113" rx="3" fill="#3b82f6" />
                                <text x="9" y="42" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">622</text>
                                <rect x="19" y="60" width="13" height="100" rx="3" fill="#10b981" />
                                <text x="25" y="55" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">10.5K</text>
                            </g>

                            {/* On Time Payment Line (Orange Curve) */}
                            {/* Points: Jun: (66, 68), Jul: (143, 62), Agt: (220, 56), Sep: (297, 48), Okt: (374, 46), Nov: (451, 42) */}
                            <path
                                d="M 66 68 L 143 62 L 220 56 L 297 48 L 374 46 L 451 42"
                                fill="none"
                                stroke="#f97316"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />

                            {/* Dots & Percentage Labels */}
                            <circle cx="66" cy="68" r="3.5" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                            <text x="66" y="58" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">93.5%</text>

                            <circle cx="143" cy="62" r="3.5" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                            <text x="143" y="52" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">94.1%</text>

                            <circle cx="220" cy="56" r="3.5" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                            <text x="220" y="46" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">94.8%</text>

                            <circle cx="297" cy="48" r="3.5" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                            <text x="297" y="38" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">95.6%</text>

                            <circle cx="374" cy="46" r="3.5" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                            <text x="374" y="36" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">95.7%</text>

                            <circle cx="451" cy="42" r="3.5" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                            <text x="451" y="32" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="bold">96.1%</text>
                        </svg>
                    </div>
                </div>

                {/* 4.2 Card Tengah (Lebar 3/12): Aging Invoice */}
                <div className="lg:col-span-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                Aging Invoice
                            </h3>
                        </div>
                        <button
                            onClick={() => onOpenTab("aging")}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
                        >
                            <span>Lihat Detail</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        {/* Donut Chart SVG */}
                        <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                {/* Circumference = 2 * PI * 38 ≈ 238.76 */}
                                {/* 0-7 Hari (46.1%) -> 110 */}
                                <circle cx="50" cy="50" r="38" fill="none" stroke="#10b981" strokeWidth="14" strokeDasharray="110 238.76" strokeDashoffset="0" />
                                {/* 8-14 Hari (28.7%) -> 68.5 */}
                                <circle cx="50" cy="50" r="38" fill="none" stroke="#3b82f6" strokeWidth="14" strokeDasharray="68.5 238.76" strokeDashoffset="-110" />
                                {/* 15-30 Hari (16.4%) -> 39.1 */}
                                <circle cx="50" cy="50" r="38" fill="none" stroke="#f59e0b" strokeWidth="14" strokeDasharray="39.1 238.76" strokeDashoffset="-178.5" />
                                {/* >30 Hari (8.9%) -> 21.2 */}
                                <circle cx="50" cy="50" r="38" fill="none" stroke="#ef4444" strokeWidth="14" strokeDasharray="21.2 238.76" strokeDashoffset="-217.6" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-base font-black text-slate-900 dark:text-slate-100 leading-tight">
                                    622
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                    Invoice
                                </span>
                            </div>
                        </div>

                        {/* Breakdown List */}
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className="text-slate-600 dark:text-slate-400">0 - 7 Hari</span>
                                </div>
                                <div className="text-right font-medium">
                                    <span className="text-slate-900 dark:text-slate-100 font-bold mr-1.5">287</span>
                                    <span className="text-slate-400 text-[11px]">46.1%</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                                    <span className="text-slate-600 dark:text-slate-400">8 - 14 Hari</span>
                                </div>
                                <div className="text-right font-medium">
                                    <span className="text-slate-900 dark:text-slate-100 font-bold mr-1.5">178</span>
                                    <span className="text-slate-400 text-[11px]">28.7%</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                                    <span className="text-slate-600 dark:text-slate-400">15 - 30 Hari</span>
                                </div>
                                <div className="text-right font-medium">
                                    <span className="text-slate-900 dark:text-slate-100 font-bold mr-1.5">102</span>
                                    <span className="text-slate-400 text-[11px]">16.4%</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                                    <span className="text-slate-600 dark:text-slate-400">&gt; 30 Hari</span>
                                </div>
                                <div className="text-right font-medium">
                                    <span className="text-slate-900 dark:text-slate-100 font-bold mr-1.5">55</span>
                                    <span className="text-slate-400 text-[11px]">8.9%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4.3 Card Kanan (Lebar 3/12): Status Pembayaran */}
                <div className="lg:col-span-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-blue-600" />
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                Status Pembayaran
                            </h3>
                        </div>
                        <button
                            onClick={() => onOpenTab("checkout")}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
                        >
                            <span>Lihat Detail</span>
                            <span className="text-xs">&rarr;</span>
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        {/* Radial Ring Gauge */}
                        <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                {/* Track */}
                                <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                                {/* On-Time (96.1%) */}
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="38"
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="12"
                                    strokeDasharray="238.76"
                                    strokeDashoffset="9.3"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-base font-black text-slate-900 dark:text-slate-100 leading-tight">
                                    96.1%
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                    On Time
                                </span>
                            </div>
                        </div>

                        {/* Status Legend List */}
                        <div className="space-y-3 text-xs">
                            <div className="flex items-start gap-2.5">
                                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                                <div>
                                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                        On Time
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        597 Invoice
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                                <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                                    <Clock className="w-3 h-3 stroke-[2.5]" />
                                </div>
                                <div>
                                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                        Terlambat
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        25 Invoice
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. ROW 3: CASH FLOW PROJECTION & TOP VENDORS (2 Cards) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 5.1 Card Kiri (Lebar ~5/12): Ringkasan Proyeksi Pembayaran */}
                <div className="lg:col-span-5 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-blue-600" />
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                Ringkasan Proyeksi Pembayaran (Cash Flow)
                            </h3>
                        </div>
                        <span className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md border">
                            3 Bulan ke Depan ▾
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                        {/* Box 1: Bulan Ini */}
                        <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-[10px] font-semibold leading-tight">
                                    Bulan Ini (Nov 2026)
                                </span>
                            </div>
                            <div className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">
                                Rp 9.415.250
                            </div>
                        </div>

                        {/* Box 2: Des 2026 */}
                        <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/40 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-[10px] font-semibold leading-tight">
                                    Des 2026
                                </span>
                            </div>
                            <div className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">
                                Rp 133.200.000
                            </div>
                        </div>

                        {/* Box 3: Jan 2027 */}
                        <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-[10px] font-semibold leading-tight">
                                    Jan 2027
                                </span>
                            </div>
                            <div className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight">
                                Rp 0
                            </div>
                        </div>
                    </div>
                </div>

                {/* 5.2 Card Kanan (Lebar ~7/12): Kinerja Vendor (Top 5) */}
                <div className="lg:col-span-7 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                Kinerja Vendor (Top 5)
                            </h3>
                        </div>
                        <button
                            onClick={() => onOpenTab("vendors")}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
                        >
                            <span>Lihat Semua</span>
                            <span className="text-xs">&rarr;</span>
                        </button>
                    </div>

                    <div className="space-y-2 pt-0.5">
                        {topVendors.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-xs">
                                <span className="text-slate-400 font-bold w-3 text-center shrink-0">
                                    {idx + 1}
                                </span>
                                <span className="font-medium text-slate-700 dark:text-slate-300 w-44 truncate shrink-0">
                                    {item.name}
                                </span>
                                <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                    <div
                                        className="bg-blue-600 h-full rounded-full transition-all duration-500"
                                        style={{ width: `${item.pct}%` }}
                                    />
                                </div>
                                <span className="font-bold text-slate-900 dark:text-slate-100 w-32 text-right shrink-0">
                                    {formatCurrency(item.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 5.5 SECTION: TOP 20 PO & INVOICE TERBESAR BULAN INI */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
                {/* Header & Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200/50">
                            <Trophy className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                    Top 20 Nilai Terbesar
                                </h3>
                                <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 font-semibold">
                                    Prioritas Cash Flow
                                </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Pantau komitmen transaksi bernilai tinggi untuk mitigasi likuiditas dan perencanaan jadwal transfer.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                        {/* Switcher Tab: Top 20 Invoice vs Top 20 PO */}
                        <div className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center border border-slate-200/60 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setTop20Tab("invoices")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                    top20Tab === "invoices"
                                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                }`}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Top 20 Invoice</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTop20Tab("pos")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                    top20Tab === "pos"
                                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                }`}
                            >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                <span>Top 20 PO SAP</span>
                            </button>
                        </div>

                        {/* Filter Periode Dropdown */}
                        <select
                            value={top20Period}
                            onChange={(e) => setTop20Period(e.target.value as any)}
                            className="text-xs border rounded-xl px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
                        >
                            <option value="this_month">Bulan Ini (Nov 2026)</option>
                            <option value="all_time">Semua Periode (All-Time)</option>
                        </select>
                    </div>
                </div>

                {/* 3 Metric Summary Cards */}
                {(() => {
                    const currentList = top20Tab === "invoices" ? top20Invoices : top20Pos
                    const totalVal = currentList.reduce((acc, it: any) => {
                        const amt = top20Tab === "invoices"
                            ? (Number(it.grandTotal) || Number(it.netPayable) || 0)
                            : (Number(it.totalAmount) || 0)
                        return acc + amt
                    }, 0)
                    const maxItem = currentList[0] as any
                    const maxVal = maxItem
                        ? top20Tab === "invoices"
                            ? (Number(maxItem.grandTotal) || Number(maxItem.netPayable) || 0)
                            : (Number(maxItem.totalAmount) || 0)
                        : 0
                    const avgVal = currentList.length > 0 ? totalVal / currentList.length : 0

                    return (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 block">
                                        Total Akumulasi Top 20
                                    </span>
                                    <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 block mt-0.5">
                                        {formatCurrency(totalVal)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {currentList.length} entitas {top20Tab === "invoices" ? "invoice" : "nomor PO"}
                                    </span>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                                    <Coins className="w-4 h-4" />
                                </div>
                            </div>

                            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
                                <div className="truncate pr-2">
                                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 block">
                                        Nilai Tertinggi (#1 Terbesar)
                                    </span>
                                    <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 block mt-0.5 truncate">
                                        {formatCurrency(maxVal)}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono truncate block">
                                        {maxItem
                                            ? top20Tab === "invoices"
                                                ? `Inv #${maxItem.invoiceNumber}`
                                                : `PO #${maxItem.poNumber} (${maxItem.vendorName})`
                                            : "-"}
                                    </span>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                                    <Award className="w-4 h-4" />
                                </div>
                            </div>

                            <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/40 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 block">
                                        Rata-rata Nilai Transaksi
                                    </span>
                                    <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 block mt-0.5">
                                        {formatCurrency(avgVal)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        rerata per {top20Tab === "invoices" ? "faktur" : "purchase order"}
                                    </span>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center shrink-0">
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    )
                })()}

                {/* Table Content */}
                <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800">
                    {top20Tab === "invoices" ? (
                        /* TABEL TOP 20 INVOICE */
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-3.5 py-2.5 text-center w-12">Rank</th>
                                    <th className="px-3.5 py-2.5">No. Invoice</th>
                                    <th className="px-3.5 py-2.5">No. PO</th>
                                    <th className="px-3.5 py-2.5">Mitra Vendor</th>
                                    <th className="px-3.5 py-2.5">Tgl Invoice</th>
                                    <th className="px-3.5 py-2.5">Jatuh Tempo</th>
                                    <th className="px-3.5 py-2.5 text-right">Nilai Tagihan</th>
                                    <th className="px-3.5 py-2.5">Status</th>
                                    <th className="px-3.5 py-2.5 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {top20Invoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-slate-400">
                                            Tidak ada data invoice pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    top20Invoices.map((inv, idx) => {
                                        const vendorName = inv.tenant?.name || inv.vendorName || "Mitra Vendor"
                                        const amt = Number(inv.grandTotal) || Number(inv.netPayable) || 0

                                        return (
                                            <tr
                                                key={inv.id || idx}
                                                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                                            >
                                                {/* Rank Badge */}
                                                <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                    {idx === 0 && (
                                                        <span className="inline-flex items-center justify-center px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-extrabold rounded-md text-[11px]">
                                                            🥇 #1
                                                        </span>
                                                    )}
                                                    {idx === 1 && (
                                                        <span className="inline-flex items-center justify-center px-2 py-0.5 bg-slate-200 text-slate-800 border border-slate-300 font-extrabold rounded-md text-[11px]">
                                                            🥈 #2
                                                        </span>
                                                    )}
                                                    {idx === 2 && (
                                                        <span className="inline-flex items-center justify-center px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-300 font-extrabold rounded-md text-[11px]">
                                                            🥉 #3
                                                        </span>
                                                    )}
                                                    {idx > 2 && (
                                                        <span className="inline-flex items-center justify-center px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md text-[11px] border border-blue-200/60">
                                                            #{idx + 1}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                    {inv.invoiceNumber}
                                                </td>
                                                <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                    {inv.poNumber ? (
                                                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                            {inv.poNumber}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Tanpa PO</span>
                                                    )}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                    {vendorName}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                    {formatDateIndo(inv.invoiceDate || inv.createdAt)}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                    {formatDateIndo(inv.paymentDueDate)}
                                                </td>
                                                <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-100 text-right whitespace-nowrap">
                                                    {formatCurrency(amt)}
                                                </td>
                                                <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                    {renderStatusBadge(inv.status)}
                                                </td>
                                                <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => onSelectInvoice(inv)}
                                                        className="h-7 px-2.5 text-[11px] gap-1 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span>Detail</span>
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    ) : (
                        /* TABEL TOP 20 PO SAP */
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-3.5 py-2.5 text-center w-12">Rank</th>
                                    <th className="px-3.5 py-2.5">No. PO SAP</th>
                                    <th className="px-3.5 py-2.5">Mitra Vendor</th>
                                    <th className="px-3.5 py-2.5 text-center">Jml Invoice</th>
                                    <th className="px-3.5 py-2.5 text-right">Akumulasi Nilai PO</th>
                                    <th className="px-3.5 py-2.5">Invoice Terakhir</th>
                                    <th className="px-3.5 py-2.5">Status Terkini</th>
                                    <th className="px-3.5 py-2.5 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {top20Pos.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400">
                                            Tidak ada nomor PO tercatat pada periode ini.
                                        </td>
                                    </tr>
                                ) : (
                                    top20Pos.map((po, idx) => (
                                        <tr
                                            key={po.poNumber || idx}
                                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                                        >
                                            {/* Rank Badge */}
                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                {idx === 0 && (
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-extrabold rounded-md text-[11px]">
                                                        🥇 #1
                                                    </span>
                                                )}
                                                {idx === 1 && (
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 bg-slate-200 text-slate-800 border border-slate-300 font-extrabold rounded-md text-[11px]">
                                                        🥈 #2
                                                    </span>
                                                )}
                                                {idx === 2 && (
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-300 font-extrabold rounded-md text-[11px]">
                                                        🥉 #3
                                                    </span>
                                                )}
                                                {idx > 2 && (
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md text-[11px] border border-blue-200/60">
                                                        #{idx + 1}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3.5 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                                {po.poNumber}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                {po.vendorName}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-semibold text-[11px]">
                                                    {po.invoicesCount} Tagihan
                                                </span>
                                            </td>
                                            <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-100 text-right whitespace-nowrap">
                                                {formatCurrency(po.totalAmount)}
                                            </td>
                                            <td className="px-3.5 py-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                {po.latestInvoice?.invoiceNumber || "-"}
                                            </td>
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                {renderStatusBadge(po.status)}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                {po.latestInvoice ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => onSelectInvoice(po.latestInvoice)}
                                                        className="h-7 px-2.5 text-[11px] gap-1 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span>Lihat Faktur</span>
                                                    </Button>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* 6. ROW 4: DAFTAR INVOICE TERBARU (Tabel Modern & Pagination Per 10) */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                    Daftar Invoice Terbaru
                                </h3>
                                <Badge variant="secondary" className="text-[10px] font-mono px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60">
                                    {totalFiltered.toLocaleString("id-ID")} Invoice
                                </Badge>
                            </div>
                            <span className="text-[11px] text-slate-400 block">
                                Diurutkan dari tanggal penerbitan invoice paling terbaru.
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search Input */}
                        <div className="relative w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                            <Input
                                placeholder="Cari No. Invoice / Vendor / PO..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 pr-7 h-8 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Export CSV Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportCsv}
                            className="h-8 px-3 text-xs gap-1.5 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                        >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>Export CSV</span>
                        </Button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50/90 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th
                                    onClick={() => handleSortToggle("invoiceDate")}
                                    className="px-3.5 py-2.5 cursor-pointer hover:bg-slate-100/70 select-none"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Tgl Invoice</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSortToggle("invoiceNumber")}
                                    className="px-3.5 py-2.5 cursor-pointer hover:bg-slate-100/70 select-none"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>No. Invoice</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="px-3.5 py-2.5">Vendor</th>
                                <th className="px-3.5 py-2.5">No. PO</th>
                                <th
                                    onClick={() => handleSortToggle("paymentDueDate")}
                                    className="px-3.5 py-2.5 cursor-pointer hover:bg-slate-100/70 select-none"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Tgl Jatuh Tempo</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th
                                    onClick={() => handleSortToggle("grandTotal")}
                                    className="px-3.5 py-2.5 cursor-pointer hover:bg-slate-100/70 select-none"
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Nilai Invoice</span>
                                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th className="px-3.5 py-2.5">Status</th>
                                <th className="px-3.5 py-2.5">Aging</th>
                                <th className="px-3.5 py-2.5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                            {paginatedInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-slate-400">
                                        Tidak ada faktur invoice yang sesuai dengan kata kunci pencarian.
                                    </td>
                                </tr>
                            ) : (
                                paginatedInvoices.map((inv, idx) => {
                                    const vendorName = inv.tenant?.name || inv.vendorName || "Mitra Vendor"
                                    const aging = inv.agingDays ?? 30
                                    return (
                                        <tr
                                            key={inv.id || idx}
                                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                                        >
                                            <td className="px-3.5 py-2.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                {formatDateIndo(inv.invoiceDate || inv.createdAt)}
                                            </td>
                                            <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                {inv.invoiceNumber}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                                {vendorName}
                                            </td>
                                            <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {inv.poNumber ? (
                                                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                        {inv.poNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Tanpa PO</span>
                                                )}
                                            </td>
                                            <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                                {formatDateIndo(inv.paymentDueDate)}
                                            </td>
                                            <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                                {formatCurrency(inv.grandTotal || inv.netPayable)}
                                            </td>
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                {renderStatusBadge(inv.status)}
                                            </td>
                                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                                                <span className="px-2 py-0.5 bg-emerald-100/80 text-emerald-800 font-semibold rounded text-[11px]">
                                                    {aging} Hari
                                                </span>
                                            </td>
                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onSelectInvoice(inv)}
                                                    className="h-7 px-2.5 text-[11px] gap-1 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Detail</span>
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls (Tampilkan Per 10 Invoice) */}
                {totalPages > 1 && (
                    <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
                        <div className="font-medium">
                            Menampilkan <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * pageSize + 1}</span> -{" "}
                            <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * pageSize, totalFiltered)}</span> dari{" "}
                            <span className="font-bold text-slate-800 dark:text-slate-200">{totalFiltered.toLocaleString("id-ID")}</span> invoice
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 text-xs gap-1 rounded-lg"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Sebelumnya</span>
                            </Button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = i + 1
                                    if (totalPages > 5 && currentPage > 3) {
                                        pageNum = currentPage - 3 + i
                                        if (pageNum > totalPages) pageNum = totalPages - (4 - i)
                                    }
                                    if (pageNum < 1 || pageNum > totalPages) return null

                                    return (
                                        <button
                                            key={pageNum}
                                            type="button"
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${
                                                currentPage === pageNum
                                                    ? "bg-blue-600 text-white shadow-xs"
                                                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                })}
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 text-xs gap-1 rounded-lg"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                                <span>Selanjutnya</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}