import { notFound, redirect } from "next/navigation"
import { getVendorInvoiceByIdAction, getVendorTenantForCurrentUser } from "@/app/actions/vendor-invoices"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    ExternalLink,
    FileCheck,
    FileText,
    History,
    ShieldAlert,
    Wallet,
} from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

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
        month: "long",
        year: "numeric",
    })
}

export default async function VendorInvoiceDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const tenantData = await getVendorTenantForCurrentUser()

    if (!tenantData) {
        redirect("/vendor/login")
    }

    const invoice = await getVendorInvoiceByIdAction(id)
    if (!invoice || invoice.tenantId !== tenantData.id) {
        notFound()
    }

    // Step calculation
    const isSubmitted = true
    const isAdminVerified = ["verified_admin", "validated_finance", "approved_manager", "paid"].includes(invoice.status)
    const isFinanceValidated = ["validated_finance", "approved_manager", "paid"].includes(invoice.status)
    const isManagerApproved = ["approved_manager", "paid"].includes(invoice.status)
    const isPaid = invoice.status === "paid"
    const isRejected = invoice.status.startsWith("rejected")

    return (
        <div className="max-w-5xl mx-auto space-y-6 py-4">
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/vendor/dashboard"
                        className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                Invoice: {invoice.invoiceNumber}
                            </h1>
                            <Badge variant="outline" className="font-mono text-xs">
                                PO: {invoice.poNumber}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Diajukan pada {formatDate(invoice.createdAt)} &bull; Vendor: {invoice.tenant.name}
                        </p>
                    </div>
                </div>

                <div className="text-right">
                    <span className="text-xs text-slate-400 block">Grand Total Tagihan</span>
                    <span className="text-2xl font-extrabold text-primary">
                        {formatCurrency(invoice.grandTotal)}
                    </span>
                </div>
            </div>

            {/* Rejection Alert Banner */}
            {isRejected && (
                <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-2xl flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <h3 className="font-bold text-red-900 dark:text-red-200 text-sm">
                            Status Tagihan: Ditolak pada Tahap {invoice.rejectionStage || "Verifikasi"}
                        </h3>
                        <p className="text-xs text-red-800 dark:text-red-300">
                            <strong>Alasan Penolakan:</strong> {invoice.rejectionReason}
                        </p>
                        {invoice.rejectionNotes && (
                            <p className="text-xs text-red-700 dark:text-red-400">
                                <strong>Catatan Revisi:</strong> {invoice.rejectionNotes}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Paid Banner with Payment Proof */}
            {isPaid && (
                <div className="p-5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <div>
                            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                                Pembayaran Berhasil (Lunas)
                            </span>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                Ditransfer pada {formatDate(invoice.paidAt)}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                Batch: <strong className="font-mono">{invoice.batch?.batchCode || "-"}</strong> &bull; Rekening: {invoice.batch?.bankSource || "-"} {invoice.paidReferenceNo ? `(Ref: ${invoice.paidReferenceNo})` : ""}
                            </p>
                        </div>
                    </div>

                    {invoice.paidProofUrl && (
                        <a
                            href={resolveUploadDocumentUrl(invoice.paidProofUrl) || invoice.paidProofUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 shadow-sm">
                                <Download className="w-4 h-4" />
                                Unduh Bukti Transfer Bank
                            </Button>
                        </a>
                    )}
                </div>
            )}

            {/* Stepper Progress Indicator */}
            <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        Alur Status Penagihan & Validasi
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                        {/* Step 1 */}
                        <div className="p-3 rounded-xl border bg-blue-50/50 border-blue-200 dark:bg-blue-950/20">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 block">1. Diajukan</span>
                            <span className="text-[11px] text-slate-500 mt-1 block">
                                {formatDate(invoice.createdAt)}
                            </span>
                        </div>

                        {/* Step 2 */}
                        <div className={`p-3 rounded-xl border ${isAdminVerified ? "bg-emerald-50/50 border-emerald-200 text-emerald-800" : isRejected && invoice.rejectionStage?.includes("Admin") ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                            <span className="text-xs font-bold block">2. Ceklist Admin</span>
                            <span className="text-[11px] mt-1 block">
                                {isAdminVerified ? "Lolos 5 Ceklist" : isRejected && invoice.rejectionStage?.includes("Admin") ? "Ditolak" : "Menunggu"}
                            </span>
                        </div>

                        {/* Step 3 */}
                        <div className={`p-3 rounded-xl border ${isFinanceValidated ? "bg-emerald-50/50 border-emerald-200 text-emerald-800" : isRejected && invoice.rejectionStage?.includes("Finance") ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                            <span className="text-xs font-bold block">3. Validasi Finance</span>
                            <span className="text-[11px] mt-1 block">
                                {isFinanceValidated ? `Buku: ${formatDate(invoice.bookReceivedDate)}` : "Menunggu"}
                            </span>
                        </div>

                        {/* Step 4 */}
                        <div className={`p-3 rounded-xl border ${isManagerApproved ? "bg-emerald-50/50 border-emerald-200 text-emerald-800" : isRejected && invoice.rejectionStage?.includes("Manager") ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                            <span className="text-xs font-bold block">4. Otorisasi Manager</span>
                            <span className="text-[11px] mt-1 block">
                                {isManagerApproved ? "Disetujui" : "Menunggu"}
                            </span>
                        </div>

                        {/* Step 5 */}
                        <div className={`p-3 rounded-xl border col-span-2 md:col-span-1 ${isPaid ? "bg-emerald-100 border-emerald-300 text-emerald-900 font-bold" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                            <span className="text-xs font-bold block">5. Selesai (Paid)</span>
                            <span className="text-[11px] mt-1 block">
                                {isPaid ? formatDate(invoice.paidAt) : invoice.scheduledPaymentDate ? `Jadwal: ${formatDate(invoice.scheduledPaymentDate)}` : "Belum Dijadwalkan"}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Dokumen & Rincian Tagihan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Rincian Finansial */}
                <Card className="shadow-xs border-slate-200 dark:border-slate-800 md:col-span-1">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-primary" />
                            Rincian Pembayaran
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                        <div className="flex justify-between py-1 border-b">
                            <span className="text-slate-500">Subtotal (DPP):</span>
                            <span className="font-semibold">{formatCurrency(invoice.subtotal)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b">
                            <span className="text-slate-500">PPN ({invoice.ppnPercent}%):</span>
                            <span>+ {formatCurrency(invoice.ppnAmount)}</span>
                        </div>
                        {Number(invoice.pphAmount) > 0 && (
                            <div className="flex justify-between py-1 border-b">
                                <span className="text-slate-500">PPh ({invoice.pphPercent}%):</span>
                                <span>- {formatCurrency(invoice.pphAmount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between py-1.5 font-bold text-sm text-slate-900 dark:text-slate-100 border-b">
                            <span>Grand Total:</span>
                            <span className="text-primary">{formatCurrency(invoice.grandTotal)}</span>
                        </div>
                        <div className="pt-2 space-y-1.5 text-slate-600 dark:text-slate-400">
                            <div>TOP: <strong>{invoice.topDays} Hari</strong></div>
                            <div>Jatuh Tempo: <strong>{formatDate(invoice.paymentDueDate)}</strong></div>
                            <div>Estimasi Pembayaran: <strong className="text-blue-600 dark:text-blue-400">{formatDate(invoice.scheduledPaymentDate)}</strong></div>
                        </div>
                    </CardContent>
                </Card>

                {/* Dokumen Terlampir */}
                <Card className="shadow-xs border-slate-200 dark:border-slate-800 md:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            Dokumen Lampiran Tagihan
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Invoice Fisik */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    <div>
                                        <div className="text-xs font-semibold">Berkas Invoice Fisik</div>
                                        <div className="text-[10px] text-slate-400">Dokumen Utama</div>
                                    </div>
                                </div>
                                <a
                                    href={resolveUploadDocumentUrl(invoice.invoiceFileUrl) || invoice.invoiceFileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <Button size="sm" variant="outline" className="h-7 text-xs">
                                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                        Lihat
                                    </Button>
                                </a>
                            </div>

                            {/* e-Faktur Pajak */}
                            {invoice.taxInvoiceFileUrl && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileCheck className="w-4 h-4 text-emerald-600" />
                                        <div>
                                            <div className="text-xs font-semibold">e-Faktur Pajak</div>
                                            <div className="text-[10px] text-slate-400">Lampiran Pajak</div>
                                        </div>
                                    </div>
                                    <a
                                        href={resolveUploadDocumentUrl(invoice.taxInvoiceFileUrl) || invoice.taxInvoiceFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <Button size="sm" variant="outline" className="h-7 text-xs">
                                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                            Lihat
                                        </Button>
                                    </a>
                                </div>
                            )}

                            {/* Surat Jalan / BAP */}
                            {invoice.deliveryReceiptFileUrl && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileCheck className="w-4 h-4 text-purple-600" />
                                        <div>
                                            <div className="text-xs font-semibold">Surat Jalan / BAP</div>
                                            <div className="text-[10px] text-slate-400">Bukti Pengiriman</div>
                                        </div>
                                    </div>
                                    <a
                                        href={resolveUploadDocumentUrl(invoice.deliveryReceiptFileUrl) || invoice.deliveryReceiptFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <Button size="sm" variant="outline" className="h-7 text-xs">
                                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                            Lihat
                                        </Button>
                                    </a>
                                </div>
                            )}

                            {/* Salinan PO */}
                            {invoice.poFileUrl && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-600" />
                                        <div>
                                            <div className="text-xs font-semibold">Salinan PO</div>
                                            <div className="text-[10px] text-slate-400">Purchase Order</div>
                                        </div>
                                    </div>
                                    <a
                                        href={resolveUploadDocumentUrl(invoice.poFileUrl) || invoice.poFileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <Button size="sm" variant="outline" className="h-7 text-xs">
                                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                            Lihat
                                        </Button>
                                    </a>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Riwayat Audit Log Timeline */}
            <Card className="shadow-xs border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <History className="w-4 h-4 text-primary" />
                        Riwayat Aktivitas & Catatan Peninjau
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {invoice.logs?.map((log: any, idx: number) => (
                            <div key={log.id || idx} className="flex items-start gap-3 text-xs border-l-2 border-primary/40 pl-3">
                                <div>
                                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                                        {log.actorName || "Sistem"} ({log.actorRole || "Sistem"}) &bull; <span className="font-normal uppercase text-slate-400">{log.action}</span>
                                    </div>
                                    <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                                        {log.notes || "-"}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        {formatDate(log.createdAt)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
