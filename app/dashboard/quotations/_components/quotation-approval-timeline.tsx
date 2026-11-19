"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    ShieldCheck,
    ArrowRight,
    Loader2,
    Send,
    UserCheck,
    FastForward,
    TrendingDown,
    MessageSquare,
    FileText,
    Pencil,
    History,
} from "lucide-react"
import {
    submitQuotationForApproval,
    processQuotationApprovalAction,
    updateQuotationJustification,
    type QuotationMarginEvaluationSummary,
} from "@/app/actions/approval-engine"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export interface QuotationProgressStep {
    id: number
    quotationId: number
    stepOrder: number
    stepRole: string
    stepLabel: string
    assignedUserId: string
    status: string // 'pending' | 'approved' | 'rejected' | 'skipped'
    actedAt: Date | null
    comment: string | null
    requiredByMargin: string | null
    createdAt: Date
    assignedUser?: {
        id: string
        name: string | null
        email: string | null
    } | null
}

interface QuotationApprovalTimelineProps {
    quotationId: number
    quotationStatus: string
    rejectionReason?: string | null
    progressSteps: QuotationProgressStep[]
    activeStep: QuotationProgressStep | null
    evaluation: QuotationMarginEvaluationSummary
    canActOnCurrentStep: boolean
    currentUserId: string | null
    salesPersonName?: string | null
    adminNote?: string | null
    creatorNotes?: string | null
    creatorName?: string | null
    createdAt?: Date | string | null
    isCreatorOrSales?: boolean
}

function formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return "-"
    const d = new Date(date)
    if (isNaN(d.getTime())) return "-"
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).format(d)
}

export function QuotationApprovalTimeline({
    quotationId,
    quotationStatus,
    rejectionReason,
    progressSteps,
    activeStep,
    evaluation,
    canActOnCurrentStep,
    currentUserId,
    salesPersonName,
    adminNote: initialAdminNote,
    creatorNotes,
    creatorName,
    createdAt,
    isCreatorOrSales,
}: QuotationApprovalTimelineProps) {
    const router = useRouter()
    const [submittingApproval, setSubmittingApproval] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [actionComment, setActionComment] = useState("")
    const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false)

    // Justification Note State (Alasan Margin Minus Pembuat)
    const [currentAdminNote, setCurrentAdminNote] = useState(initialAdminNote || "")
    const [isEditingJustification, setIsEditingJustification] = useState(false)
    const [justificationInput, setJustificationInput] = useState(initialAdminNote || "")
    const [savingJustification, setSavingJustification] = useState(false)

    // Submit dialog state (Prompt alasan minus jika submit)
    const [submitModalOpen, setSubmitModalOpen] = useState(false)
    const [submitJustification, setSubmitJustification] = useState(initialAdminNote || "")

    // Handle save justification note
    const handleSaveJustification = async () => {
        setSavingJustification(true)
        try {
            const res = await updateQuotationJustification({
                quotationId,
                justification: justificationInput,
            })
            if (res.success) {
                toast.success(res.message || "Catatan alasan margin berhasil disimpan")
                setCurrentAdminNote(justificationInput)
                setIsEditingJustification(false)
                router.refresh()
            } else {
                toast.error(res.error || "Gagal menyimpan catatan alasan")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setSavingJustification(false)
        }
    }

    // Handle submit for approval
    const handleSubmitApproval = async () => {
        setSubmittingApproval(true)
        try {
            const res = await submitQuotationForApproval(quotationId, submitJustification)
            if (res.success) {
                toast.success(res.message || "Approval berhasil diajukan")
                setSubmitModalOpen(false)
                setCurrentAdminNote(submitJustification)
                router.refresh()
            } else {
                toast.error(res.error || "Gagal mengajukan approval")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setSubmittingApproval(false)
        }
    }

    // Handle approve / reject action
    const handleAction = async (action: "approve" | "reject") => {
        setActionLoading(true)
        try {
            const res = await processQuotationApprovalAction({
                quotationId,
                action,
                comment: actionComment || undefined,
            })
            if (res.success) {
                toast.success(res.message || "Tindakan berhasil diproses")
                setActionComment("")
                setRejectConfirmOpen(false)
                router.refresh()
            } else {
                toast.error(res.error || "Gagal memproses tindakan")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setActionLoading(false)
        }
    }

    const isWaiting = quotationStatus === "waiting_approval"
    const isApproved = quotationStatus === "approved"
    const isRejected = quotationStatus === "rejected"
    const isDraft = quotationStatus === "draft"

    // If margin is standard (>= 11%) and no steps, show clear notice
    if (!evaluation.requiresApproval && progressSteps.length === 0) {
        return (
            <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-950 dark:bg-emerald-950/10">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                                Margin Memenuhi Standar ({evaluation.minItemMargin}%)
                                <Badge className="bg-emerald-600 text-white text-[10px]">Auto Approved</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Seluruh item memenuhi batas minimal margin standar 11.00%. Tidak memerlukan persetujuan berjenjang.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={`border shadow-sm overflow-hidden ${isWaiting ? "border-amber-300 dark:border-amber-900" : isRejected ? "border-red-300 dark:border-red-900" : ""}`}>
            <CardHeader className="pb-3 bg-muted/20 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className={`rounded-md p-1.5 ${isApproved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : isRejected ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"}`}>
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base font-semibold">Alur Persetujuan Margin (Approval Chain)</CardTitle>
                                {isWaiting && (
                                    <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] animate-pulse">
                                        Menunggu Persetujuan
                                    </Badge>
                                )}
                                {isApproved && (
                                    <Badge className="bg-emerald-600 text-white text-[10px]">
                                        Full Approved
                                    </Badge>
                                )}
                                {isRejected && (
                                    <Badge variant="destructive" className="text-[10px]">
                                        Ditolak (Rejected)
                                    </Badge>
                                )}
                            </div>
                            <CardDescription className="text-xs mt-0.5">
                                Margin Terendah:{" "}
                                <strong className={`font-mono ${evaluation.minItemMargin < (evaluation.standardMargin || 11) ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                    {evaluation.minItemMargin >= 9999 ? "≥ 11.00%" : `${evaluation.minItemMargin}%`}
                                </strong>
                                {typeof evaluation.averageMargin === "number" && (
                                    <span className="text-muted-foreground ml-1.5">
                                        (Rata-rata: <strong className="font-mono text-foreground">{evaluation.averageMargin}%</strong>)
                                    </span>
                                )}
                                {" "}
                                {evaluation.requiresApproval ? (
                                    <span>
                                        (Di bawah batas standard {evaluation.standardMargin || 11}%) — Memerlukan persetujuan hingga:{" "}
                                        <strong className="text-foreground">{evaluation.worstCasePosition}</strong>
                                    </span>
                                ) : (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        (Memenuhi batas standard {evaluation.standardMargin || 11}% — Disetujui Otomatis)
                                    </span>
                                )}
                            </CardDescription>
                        </div>
                    </div>

                    {/* Action button for Requester (Submit / Re-submit) */}
                    {(isDraft || isRejected) && (
                        <Button
                            size="sm"
                            className="h-8 gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                            onClick={() => {
                                if (evaluation.requiresApproval) {
                                    setSubmitJustification(currentAdminNote || "")
                                    setSubmitModalOpen(true)
                                } else {
                                    handleSubmitApproval()
                                }
                            }}
                            disabled={submittingApproval}
                        >
                            {submittingApproval ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            {isRejected ? "Ajukan Ulang Approval" : "Ajukan Persetujuan"}
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
                {/* Rejection Alert Banner */}
                {isRejected && rejectionReason && (
                    <div className="rounded-lg border border-red-200 bg-red-50/60 p-3.5 dark:border-red-900/60 dark:bg-red-950/20 text-xs flex items-start gap-2.5">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <div>
                            <span className="font-semibold text-red-900 dark:text-red-300">Alasan Penolakan:</span>
                            <p className="text-red-800 dark:text-red-400 mt-0.5">{rejectionReason}</p>
                            <p className="text-muted-foreground text-[11px] mt-1">
                                Silakan gunakan tombol &quot;Edit&quot; untuk merevisi harga atau margin pada quotation, kemudian ajukan ulang persetujuan.
                            </p>
                        </div>
                    </div>
                )}

                {/* Interactive Stepper */}
                <div className="relative">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {progressSteps.map((step, idx) => {
                            const isStepPending = step.status === "pending"
                            const isStepApproved = step.status === "approved"
                            const isStepRejected = step.status === "rejected"
                            const isStepSkipped = step.status === "skipped"

                            let borderStyle = "border-muted bg-card"
                            let badgeStyle = "bg-muted text-muted-foreground"

                            if (isStepApproved) {
                                borderStyle = "border-emerald-300 bg-emerald-50/30 dark:border-emerald-900/60 dark:bg-emerald-950/10"
                                badgeStyle = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            } else if (isStepRejected) {
                                borderStyle = "border-red-300 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/10"
                                badgeStyle = "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            } else if (isStepSkipped) {
                                borderStyle = "border-blue-200 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-950/10"
                                badgeStyle = "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            } else if (isStepPending) {
                                borderStyle = "border-amber-400 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20 ring-2 ring-amber-400/20"
                                badgeStyle = "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                            }

                            return (
                                <div
                                    key={step.id}
                                    className={`rounded-xl border p-3.5 transition-all shadow-sm flex flex-col justify-between ${borderStyle}`}
                                >
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                                Tahap {step.stepOrder}
                                            </span>
                                            {isStepApproved && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                                            {isStepRejected && <XCircle className="h-4 w-4 text-red-600" />}
                                            {isStepSkipped && <FastForward className="h-4 w-4 text-blue-600" />}
                                            {isStepPending && <Clock className="h-4 w-4 text-amber-600 animate-pulse" />}
                                        </div>

                                        <div className="font-semibold text-xs text-foreground">
                                            {step.stepLabel}
                                        </div>

                                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            <UserCheck className="h-3 w-3 shrink-0" />
                                            <span className="truncate">
                                                {isStepSkipped && step.comment?.includes("Tidak ada")
                                                    ? <span className="italic text-muted-foreground/70">- (Dilewati)</span>
                                                    : (step.assignedUser?.name || "Belum Ditugaskan")}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pt-2 mt-2 border-t border-muted/60 text-[10px]">
                                        {isStepApproved && (
                                            <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                                                ✓ Disetujui
                                                {step.actedAt && ` • ${new Date(step.actedAt).toLocaleDateString("id-ID")}`}
                                            </div>
                                        )}
                                        {isStepRejected && (
                                            <div className="text-red-700 dark:text-red-400 font-medium">
                                                ✕ Ditolak
                                                {step.comment && <div className="truncate mt-0.5 text-muted-foreground">&quot;{step.comment}&quot;</div>}
                                            </div>
                                        )}
                                        {isStepSkipped && (
                                            <div className="text-blue-700 dark:text-blue-400 font-medium">
                                                ⏩ Auto-skip (PIC Sama)
                                            </div>
                                        )}
                                        {isStepPending && (
                                            <div className="text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                                                Menunggu Tindakan
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Rincian Evaluasi Margin Tiap Produk */}
                {evaluation.itemResults && evaluation.itemResults.length > 0 && (
                    <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
                                Rincian Margin Tiap Item ({evaluation.itemResults.length} Item)
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                                Baseline: {evaluation.standardMargin || 11}%
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {evaluation.itemResults.map((r, idx) => {
                                const isBelow = r.marginPercent < (evaluation.standardMargin || 11)
                                return (
                                    <div key={idx} className="rounded-lg border bg-card p-2.5 text-xs flex flex-col justify-between gap-1.5 shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="font-medium truncate text-foreground text-xs" title={r.productName}>{r.productName}</span>
                                            <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] shrink-0 ${isBelow ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                                                {r.marginPercent > 0 ? `+${r.marginPercent}%` : `${r.marginPercent}%`}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-1.5">
                                            <span>Kategori: <strong className="uppercase">{r.productCategory === "prime_tyre" ? "Prime Tyre" : "PAS"}</strong></span>
                                            <span>Limit: <strong className="text-foreground">{r.positionName}</strong></span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* INLINE ACTION PANEL FOR THE ACTIVE APPROVER */}
                {isWaiting && canActOnCurrentStep && activeStep && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                                <span className="text-sm font-semibold text-foreground">
                                    Persetujuan Diperlukan dari Anda ({activeStep.stepLabel})
                                </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                Anda ditugaskan untuk memproses tahap ini
                            </span>
                        </div>

                        <div className="grid gap-1.5">
                            <Label htmlFor="inlineComment" className="text-xs font-semibold">
                                Catatan / Komentar Approver (Tercatat di riwayat untuk pembuat &amp; approver selanjutnya):
                            </Label>
                            <Textarea
                                id="inlineComment"
                                value={actionComment}
                                onChange={(e) => setActionComment(e.target.value)}
                                placeholder="Tuliskan catatan persetujuan atau alasan/instruksi jika menolak agar diketahui oleh pembuat dan approver selanjutnya..."
                                rows={2}
                                className="text-xs bg-background"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900"
                                onClick={() => handleAction("reject")}
                                disabled={actionLoading || !actionComment.trim()}
                            >
                                {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                <XCircle className="h-3.5 w-3.5" />
                                Tolak Quotation
                            </Button>
                            <Button
                                size="sm"
                                className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleAction("approve")}
                                disabled={actionLoading}
                            >
                                {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Setujui Dokumen
                            </Button>
                        </div>
                    </div>
                )}

                {/* READ-ONLY STATUS PANEL FOR NON-APPROVER / WAITING FOR ASSIGNED PIC */}
                {isWaiting && !canActOnCurrentStep && activeStep && (
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>
                                Tahap saat ini (<strong>{activeStep.stepLabel}</strong>) sedang menunggu tindakan persetujuan dari{" "}
                                <strong className="underline underline-offset-2">{activeStep.assignedUser?.name || "Pejabat Terkait"}</strong>.
                            </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                            Hanya approver yang ditugaskan yang dapat memproses tahap ini
                        </span>
                    </div>
                )}

                {/* 1. CATATAN / ALASAN MARGIN MINUS DARI PEMBUAT QUOTATION */}
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 dark:border-amber-950/50 dark:bg-amber-950/10 p-4 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                                <FileText className="h-4 w-4" />
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    Catatan / Alasan Margin Minus Pembuat Quotation
                                    <Badge variant="outline" className="text-[10px] bg-background">
                                        Pembuat (Maker)
                                    </Badge>
                                </span>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Oleh: <strong className="text-foreground">{creatorName || salesPersonName || "Pembuat Quotation"}</strong>
                                    {createdAt && <span> • {formatDateTime(createdAt)}</span>}
                                </p>
                            </div>
                        </div>

                        {(isCreatorOrSales || canActOnCurrentStep || !currentAdminNote) && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground self-start sm:self-auto"
                                onClick={() => {
                                    setIsEditingJustification(!isEditingJustification)
                                    setJustificationInput(currentAdminNote)
                                }}
                            >
                                <Pencil className="h-3 w-3" />
                                {isEditingJustification ? "Batal" : currentAdminNote ? "Ubah Catatan Alasan" : "Tambah Catatan Alasan"}
                            </Button>
                        )}
                    </div>

                    {isEditingJustification ? (
                        <div className="space-y-2 pt-1">
                            <Textarea
                                value={justificationInput}
                                onChange={(e) => setJustificationInput(e.target.value)}
                                placeholder="Tuliskan alasan mengapa quotation ini memiliki margin minus/di bawah standar (contoh: kesepakatan volume tender, promo strategis, bundling servis, dsb)..."
                                rows={3}
                                className="text-xs bg-background"
                            />
                            <div className="flex items-center justify-end gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => setIsEditingJustification(false)}
                                    disabled={savingJustification}
                                >
                                    Batal
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1"
                                    onClick={handleSaveJustification}
                                    disabled={savingJustification}
                                >
                                    {savingJustification && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Simpan Catatan Alasan
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-amber-200/60 bg-background/80 p-3 text-xs shadow-xs">
                            {currentAdminNote || creatorNotes ? (
                                <p className="whitespace-pre-line text-foreground leading-relaxed">
                                    &quot;{currentAdminNote || creatorNotes}&quot;
                                </p>
                            ) : (
                                <p className="text-muted-foreground italic text-[11px]">
                                    Belum ada catatan alasan margin minus yang disertakan oleh pembuat quotation.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* 2. RIWAYAT CATATAN APPROVAL (NOTES APPROVER BERJENJANG DENGAN TIMESTAMP) */}
                <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b pb-2.5">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <History className="h-4 w-4" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-foreground">
                                        Riwayat Catatan Persetujuan (Approval Notes History)
                                    </span>
                                    <Badge variant="secondary" className="text-[10px] h-5">
                                        {progressSteps.filter(s => s.status === "approved" || s.status === "rejected").length} dari {progressSteps.length} Tahap Selesai
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Daftar catatan &amp; alasan tindakan dari para approver beserta timestamp, dapat dilihat oleh pembuat dan approver tahapan selanjutnya.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Progress Steps Feed */}
                    <div className="space-y-2.5 pt-1">
                        {progressSteps.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground space-y-1">
                                <Clock className="h-4 w-4 mx-auto text-amber-500 animate-pulse" />
                                <p className="font-medium">Belum ada catatan alur persetujuan.</p>
                            </div>
                        ) : (
                            progressSteps.map((step) => {
                                const isStepApproved = step.status === "approved"
                                const isStepRejected = step.status === "rejected"
                                const isStepSkipped = step.status === "skipped"
                                const isStepPending = step.status === "pending"

                                let stepCardBg = "border-muted/80 bg-muted/10"
                                if (isStepApproved) {
                                    stepCardBg = "border-emerald-200/90 bg-emerald-50/20 dark:border-emerald-950 dark:bg-emerald-950/10"
                                } else if (isStepRejected) {
                                    stepCardBg = "border-red-200/90 bg-red-50/30 dark:border-red-950 dark:bg-red-950/20"
                                } else if (isStepSkipped) {
                                    stepCardBg = "border-blue-200/80 bg-blue-50/20 dark:border-blue-950 dark:bg-blue-950/10"
                                } else if (isStepPending) {
                                    stepCardBg = "border-amber-300/80 bg-amber-50/30 dark:border-amber-950 dark:bg-amber-950/10"
                                }

                                return (
                                    <div
                                        key={step.id}
                                        className={`rounded-lg border p-3 text-xs transition-colors space-y-2 ${stepCardBg}`}
                                    >
                                        {/* Header Row */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="font-bold text-[11px] bg-background">
                                                    Tahap {step.stepOrder}: {step.stepLabel}
                                                </Badge>
                                                <span className="text-muted-foreground">•</span>
                                                <div className="flex items-center gap-1 font-medium text-foreground">
                                                    <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span>
                                                        {isStepSkipped && step.comment?.includes("Tidak ada")
                                                            ? "(Dilewati - Tidak ada pejabat)"
                                                            : (step.assignedUser?.name || "Pejabat Terkait")}
                                                    </span>
                                                    {step.assignedUser?.email && (
                                                        <span className="text-[10px] text-muted-foreground hidden md:inline">
                                                            ({step.assignedUser.email})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {isStepApproved && (
                                                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] gap-1 h-5">
                                                        <CheckCircle2 className="h-3 w-3" /> Disetujui
                                                    </Badge>
                                                )}
                                                {isStepRejected && (
                                                    <Badge variant="destructive" className="text-[10px] gap-1 h-5">
                                                        <XCircle className="h-3 w-3" /> Ditolak
                                                    </Badge>
                                                )}
                                                {isStepSkipped && (
                                                    <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300 text-[10px] gap-1 h-5">
                                                        <FastForward className="h-3 w-3" /> Dilewati (Auto-skip)
                                                    </Badge>
                                                )}
                                                {isStepPending && (
                                                    <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] gap-1 h-5 animate-pulse">
                                                        <Clock className="h-3 w-3" /> Menunggu Tindakan
                                                    </Badge>
                                                )}

                                                {step.actedAt && (
                                                    <span className="text-[11px] text-muted-foreground font-mono">
                                                        {formatDateTime(step.actedAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Comment / Note Box */}
                                        <div className="pt-0.5">
                                            {step.comment ? (
                                                <div className={`rounded-md border p-2.5 text-xs text-foreground bg-background shadow-2xs ${isStepRejected ? "border-red-200" : isStepApproved ? "border-emerald-100" : ""}`}>
                                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                                        Catatan Approver:
                                                    </span>
                                                    <p className="whitespace-pre-line leading-relaxed font-normal">
                                                        &quot;{step.comment}&quot;
                                                    </p>
                                                </div>
                                            ) : isStepApproved ? (
                                                <p className="text-[11px] text-muted-foreground italic">
                                                    Disetujui tanpa catatan khusus.
                                                </p>
                                            ) : isStepPending ? (
                                                <p className="text-[11px] text-muted-foreground italic">
                                                    Menunggu catatan dan tindakan dari approver tahap ini.
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* MODAL KONFIRMASI SUBMIT APPROVAL DENGAN ALASAN MINUS */}
                <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Send className="h-4 w-4 text-amber-600" />
                                Pengajuan Persetujuan Margin Quotation
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Quotation ini memerlukan persetujuan berjenjang karena memiliki margin di bawah standar baseline ({evaluation.minItemMargin}%).
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-2 text-xs">
                            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                                <strong>Target Approval:</strong> Memerlukan persetujuan hingga <strong>{evaluation.worstCasePosition}</strong>.
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="submitJustification" className="text-xs font-semibold">
                                    Catatan / Alasan Margin Minus (Untuk Approver):
                                </Label>
                                <Textarea
                                    id="submitJustification"
                                    value={submitJustification}
                                    onChange={(e) => setSubmitJustification(e.target.value)}
                                    placeholder="Tuliskan alasan mengapa quotation memiliki margin di bawah standar/minus untuk dipertimbangkan oleh para approver..."
                                    rows={3}
                                    className="text-xs"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Catatan ini akan langsung terlihat oleh seluruh approver dalam riwayat approval.
                                </p>
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => setSubmitModalOpen(false)}
                                disabled={submittingApproval}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                                onClick={handleSubmitApproval}
                                disabled={submittingApproval}
                            >
                                {submittingApproval && <Loader2 className="h-3 w-3 animate-spin" />}
                                Ajukan Sekarang
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}
