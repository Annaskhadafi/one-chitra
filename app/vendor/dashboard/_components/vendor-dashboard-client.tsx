"use client"

import React, { useState } from "react"
import Link from "next/link"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    AlertCircle,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    Eye,
    FileText,
    PlusCircle,
    Search,
    ShieldAlert,
    Wallet,
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
            return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">1. Menunggu Admin</Badge>
        case "verified_admin":
            return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200">2. Menunggu Finance</Badge>
        case "validated_finance":
            return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200">3. Menunggu Manager</Badge>
        case "approved_manager":
            return <Badge className="bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200">4. Siap Dibayar</Badge>
        case "paid":
            return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200">5. Lunas</Badge>
        case "rejected_admin":
        case "rejected_finance":
        case "rejected_manager":
            return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-200">Perlu Revisi</Badge>
        default:
            return <Badge variant="outline">{status}</Badge>
    }
}

export function VendorDashboardClient({
    tenant,
    initialInvoices,
}: {
    tenant: any
    initialInvoices: any[]
}) {
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")

    const filteredInvoices = initialInvoices.filter((inv) => {
        const matchesSearch =
            inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.poNumber.toLowerCase().includes(searchTerm.toLowerCase())

        if (statusFilter === "all") return matchesSearch
        if (statusFilter === "review") {
            return matchesSearch && ["submitted", "verified_admin", "validated_finance"].includes(inv.status)
        }
        if (statusFilter === "approved") {
            return matchesSearch && inv.status === "approved_manager"
        }
        if (statusFilter === "paid") {
            return matchesSearch && inv.status === "paid"
        }
        if (statusFilter === "rejected") {
            return matchesSearch && ["rejected_admin", "rejected_finance", "rejected_manager"].includes(inv.status)
        }
        return matchesSearch
    })

    // Metrics
    const totalCount = initialInvoices.length
    const pendingReviewCount = initialInvoices.filter((i) =>
        ["submitted", "verified_admin", "validated_finance"].includes(i.status)
    ).length
    const approvedCount = initialInvoices.filter((i) => i.status === "approved_manager").length
    const paidCount = initialInvoices.filter((i) => i.status === "paid").length
    const rejectedCount = initialInvoices.filter((i) =>
        ["rejected_admin", "rejected_finance", "rejected_manager"].includes(i.status)
    ).length

    const totalPaidAmount = initialInvoices
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0)

    const totalWaitingAmount = initialInvoices
        .filter((i) => i.status !== "paid" && !i.status.startsWith("rejected"))
        .reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0)

    return (
        <div className="space-y-6">
            {/* Header Profil Vendor */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-primary border border-blue-100 dark:border-blue-900">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border">
                                {tenant.code}
                            </span>
                            {tenant.isPkp ? (
                                <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                    PKP (Wajib e-Faktur)
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-xs">
                                    Non-PKP
                                </Badge>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                            {tenant.name}
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Rekening Pembayaran: <strong className="text-slate-700 dark:text-slate-300">{tenant.bankName || "-"} {tenant.bankAccountNo || "-"}</strong> a/n {tenant.bankAccountHolder || "-"} &bull; TOP Standar: <strong>{tenant.defaultTopDays || 30} Hari</strong>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/vendor/invoices/new">
                        <Button className="bg-primary hover:bg-primary/90 text-white font-semibold flex items-center gap-2 shadow-sm">
                            <PlusCircle className="w-4 h-4" />
                            Ajukan Invoice Baru
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="shadow-xs cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("all")}>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500">Total Pengajuan</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalCount}</div>
                        <p className="text-[11px] text-slate-500 mt-1">Semua dokumen invoice</p>
                    </CardContent>
                </Card>

                <Card className="shadow-xs cursor-pointer hover:border-blue-400 transition-colors" onClick={() => setStatusFilter("review")}>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium text-blue-600">Dalam Proses Review</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{pendingReviewCount}</div>
                        <p className="text-[11px] text-slate-500 mt-1">Admin / Finance / Mgr</p>
                    </CardContent>
                </Card>

                <Card className="shadow-xs cursor-pointer hover:border-purple-400 transition-colors" onClick={() => setStatusFilter("approved")}>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium text-purple-600">Disetujui Siap Bayar</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{approvedCount}</div>
                        <p className="text-[11px] text-slate-500 mt-1">Antrean jadwal transfer</p>
                    </CardContent>
                </Card>

                <Card className="shadow-xs cursor-pointer hover:border-emerald-400 transition-colors" onClick={() => setStatusFilter("paid")}>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium text-emerald-600">Telah Dibayar (Lunas)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{paidCount}</div>
                        <p className="text-[11px] text-slate-500 mt-1">{formatCurrency(totalPaidAmount)}</p>
                    </CardContent>
                </Card>

                <Card className="shadow-xs cursor-pointer hover:border-red-400 transition-colors col-span-2 md:col-span-1" onClick={() => setStatusFilter("rejected")}>
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium text-red-600">Perlu Revisi</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-red-700 dark:text-red-400">{rejectedCount}</div>
                        <p className="text-[11px] text-slate-500 mt-1">Instruksi perbaikan</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <Input
                        placeholder="Cari No. Invoice atau No. PO..."
                        className="pl-9 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <Button
                        variant={statusFilter === "all" ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => setStatusFilter("all")}
                    >
                        Semua ({totalCount})
                    </Button>
                    <Button
                        variant={statusFilter === "review" ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => setStatusFilter("review")}
                    >
                        Review ({pendingReviewCount})
                    </Button>
                    <Button
                        variant={statusFilter === "approved" ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => setStatusFilter("approved")}
                    >
                        Disetujui ({approvedCount})
                    </Button>
                    <Button
                        variant={statusFilter === "paid" ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => setStatusFilter("paid")}
                    >
                        Lunas ({paidCount})
                    </Button>
                    {rejectedCount > 0 && (
                        <Button
                            variant={statusFilter === "rejected" ? "destructive" : "outline"}
                            size="sm"
                            className="text-xs"
                            onClick={() => setStatusFilter("rejected")}
                        >
                            Revisi ({rejectedCount})
                        </Button>
                    )}
                </div>
            </div>

            {/* Invoices List Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b">
                            <tr>
                                <th className="px-4 py-3">No. Invoice & PO</th>
                                <th className="px-4 py-3">Tanggal Tagihan</th>
                                <th className="px-4 py-3">Grand Total</th>
                                <th className="px-4 py-3">Status Verifikasi</th>
                                <th className="px-4 py-3">Estimasi Jadwal Bayar</th>
                                <th className="px-4 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        Belum ada tagihan invoice yang sesuai dengan kriteria filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                                                {inv.invoiceNumber}
                                            </div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                                                PO: {inv.poNumber}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                                            {formatDate(inv.invoiceDate)}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="font-bold text-slate-900 dark:text-slate-100">
                                                {formatCurrency(inv.grandTotal)}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                Subtotal: {formatCurrency(inv.subtotal)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="space-y-1">
                                                {getStatusBadge(inv.status)}
                                                {inv.status.startsWith("rejected") && inv.rejectionReason && (
                                                    <div className="text-[11px] text-red-600 font-medium max-w-xs truncate" title={inv.rejectionReason}>
                                                        Alasan: {inv.rejectionReason}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-xs">
                                            {inv.status === "paid" ? (
                                                <div className="text-emerald-600 font-medium flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Dibayar: {formatDate(inv.paidAt)}
                                                </div>
                                            ) : inv.scheduledPaymentDate ? (
                                                <div>
                                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                        {formatDate(inv.scheduledPaymentDate)}
                                                    </div>
                                                    <span className={`inline-block text-[10px] px-1.5 py-0.2 rounded border mt-0.5 ${inv.urgency.colorClass}`}>
                                                        {inv.urgency.label}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">Menunggu validasi finance</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Link href={`/vendor/invoices/${inv.id}`}>
                                                    <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
                                                        <Eye className="w-3.5 h-3.5 mr-1" />
                                                        Detail
                                                    </Button>
                                                </Link>
                                                {inv.status === "paid" && inv.paidProofUrl && (
                                                    <a
                                                        href={resolveUploadDocumentUrl(inv.paidProofUrl) || inv.paidProofUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        <Button variant="secondary" size="sm" className="h-8 px-2 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
                                                            <Download className="w-3.5 h-3.5 mr-1" />
                                                            Bukti Transfer
                                                        </Button>
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
            </div>
        </div>
    )
}
