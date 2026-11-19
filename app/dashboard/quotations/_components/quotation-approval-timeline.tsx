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
} from "lucide-react"
import {
    submitQuotationForApproval,
    processQuotationApprovalAction,
    type QuotationMarginEvaluationSummary,
} from "@/app/actions/approval-engine"
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
}: QuotationApprovalTimelineProps) {
    const router = useRouter()
    const [submittingApproval, setSubmittingApproval] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [actionComment, setActionComment] = useState("")
    const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false)

    // Handle submit for approval
    const handleSubmitApproval = async () => {
        setSubmittingApproval(true)
        try {
            const res = await submitQuotationForApproval(quotationId)
            if (res.success) {
                toast.success(res.message || "Approval berhasil diajukan")
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
                            onClick={handleSubmitApproval}
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
                            <Label htmlFor="inlineComment" className="text-xs">
                                Catatan / Komentar (Wajib diisi jika menolak)
                            </Label>
                            <Textarea
                                id="inlineComment"
                                value={actionComment}
                                onChange={(e) => setActionComment(e.target.value)}
                                placeholder="Tuliskan catatan persetujuan atau alasan jika menolak..."
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
            </CardContent>
        </Card>
    )
}
