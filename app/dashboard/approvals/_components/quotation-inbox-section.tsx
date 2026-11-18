"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { FileText, CheckCircle, XCircle, ArrowUpRight, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { processQuotationApprovalAction } from "@/app/actions/approval-engine"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export interface QuotationInboxItem {
    stepId: number
    stepOrder: number
    stepLabel: string
    stepRole: string
    requiredByMargin: number | null
    createdAt: Date
    quotation: {
        id: number
        quotationNumber: string | null
        subject: string | null
        createdAt: Date
        customer?: { name: string } | null
        salesPerson?: { name: string | null } | null
        createdByUser?: { name: string | null } | null
    }
}

interface QuotationInboxSectionProps {
    items: QuotationInboxItem[]
}

export function QuotationInboxSection({ items }: QuotationInboxSectionProps) {
    const router = useRouter()
    const [actionItem, setActionItem] = useState<{ item: QuotationInboxItem; action: "approve" | "reject" } | null>(null)
    const [comment, setComment] = useState("")
    const [loading, setLoading] = useState(false)

    const handleConfirmAction = async () => {
        if (!actionItem) return

        setLoading(true)
        try {
            const res = await processQuotationApprovalAction({
                quotationId: actionItem.item.quotation.id,
                action: actionItem.action,
                comment: comment || undefined,
            })

            if (res.success) {
                toast.success(res.message || "Tindakan berhasil diproses")
                setActionItem(null)
                setComment("")
                router.refresh()
            } else {
                toast.error(res.error || "Gagal memproses tindakan")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setLoading(false)
        }
    }

    if (items.length === 0) {
        return null
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-sm font-semibold text-foreground">
                        Quotation Margin Approvals ({items.length})
                    </h3>
                </div>
                <span className="text-xs text-muted-foreground">
                    Membutuhkan persetujuan karena margin di bawah standard 11%
                </span>
            </div>

            <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
                <Table className="text-xs">
                    <TableHeader className="bg-muted/40">
                        <TableRow>
                            <TableHead className="font-bold">No. Quotation</TableHead>
                            <TableHead className="font-bold">Customer</TableHead>
                            <TableHead className="font-bold">Sales Person</TableHead>
                            <TableHead className="font-bold">Tahap Approval</TableHead>
                            <TableHead className="font-bold text-center">Margin Terendah</TableHead>
                            <TableHead className="font-bold">Tanggal Masuk</TableHead>
                            <TableHead className="text-right font-bold pr-4">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((it) => (
                            <TableRow key={it.stepId} className="hover:bg-muted/30">
                                <TableCell className="font-mono font-semibold text-primary">
                                    <Link
                                        href={`/dashboard/quotations/${it.quotation.id}`}
                                        className="hover:underline flex items-center gap-1"
                                    >
                                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                        {it.quotation.quotationNumber || `Quote #${it.quotation.id}`}
                                    </Link>
                                    {it.quotation.subject && (
                                        <div className="text-[10px] text-muted-foreground font-normal line-clamp-1">
                                            {it.quotation.subject}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">
                                    {it.quotation.customer?.name || "-"}
                                </TableCell>
                                <TableCell>
                                    {it.quotation.salesPerson?.name || it.quotation.createdByUser?.name || "-"}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10px]">
                                        {it.stepLabel}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center font-mono font-bold text-red-600 dark:text-red-400">
                                    {it.requiredByMargin != null ? `${it.requiredByMargin}%` : "< 11%"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {new Date(it.createdAt).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    })}
                                </TableCell>
                                <TableCell className="text-right pr-4">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <Link href={`/dashboard/quotations/${it.quotation.id}`}>
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
                                                Review
                                                <ArrowUpRight className="h-3 w-3" />
                                            </Button>
                                        </Link>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/40 gap-1"
                                            onClick={() => {
                                                setActionItem({ item: it, action: "reject" })
                                                setComment("")
                                            }}
                                        >
                                            <XCircle className="h-3.5 w-3.5" />
                                            Reject
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                            onClick={() => {
                                                setActionItem({ item: it, action: "approve" })
                                                setComment("")
                                            }}
                                        >
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            Approve
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Modal Konfirmasi Approve / Reject */}
            <Dialog open={!!actionItem} onOpenChange={(open) => !open && setActionItem(null)}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {actionItem?.action === "approve" ? (
                                <>
                                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                                    <span>Setujui Quotation</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-5 w-5 text-red-600" />
                                    <span>Tolak Quotation</span>
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Quotation: <strong className="text-foreground">{actionItem?.item.quotation.quotationNumber}</strong> untuk customer <strong className="text-foreground">{actionItem?.item.quotation.customer?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        <div className="grid gap-1.5">
                            <Label htmlFor="actionComment" className="text-xs">
                                Catatan / Alasan {actionItem?.action === "reject" ? "(Wajib)" : "(Opsional)"}
                            </Label>
                            <Textarea
                                id="actionComment"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder={actionItem?.action === "reject" ? "Tuliskan alasan penolakan..." : "Tuliskan catatan persetujuan..."}
                                rows={3}
                                className="text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActionItem(null)} disabled={loading}>
                            Batal
                        </Button>
                        <Button
                            variant={actionItem?.action === "reject" ? "destructive" : "default"}
                            className={actionItem?.action === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                            onClick={handleConfirmAction}
                            disabled={loading || (actionItem?.action === "reject" && !comment.trim())}
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {actionItem?.action === "approve" ? "Setujui Dokumen" : "Tolak Dokumen"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
