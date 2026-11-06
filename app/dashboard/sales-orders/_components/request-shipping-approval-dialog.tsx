"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Send, UserCheck, PackageCheck, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { requestShippingApproval } from "@/app/actions/sales-order-shipping-approval"
import type { SalesOrderListItem } from "./types"

interface RequestShippingApprovalDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedOrders: SalesOrderListItem[]
    onSuccess?: () => void
}

export function RequestShippingApprovalDialog({
    open,
    onOpenChange,
    selectedOrders,
    onSuccess,
}: RequestShippingApprovalDialogProps) {
    const [comment, setComment] = React.useState("")
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    // Reset comment saat dialog terbuka/tutup
    React.useEffect(() => {
        if (!open) {
            setComment("")
        }
    }, [open])

    const totalItemsCount = React.useMemo(() => {
        return selectedOrders.reduce((sum, order) => {
            const orderQty = order.items.reduce((itemSum, it) => itemSum + (Number(it.quantity) || 0), 0)
            return sum + orderQty
        }, 0)
    }, [selectedOrders])

    const handleSubmit = async () => {
        if (selectedOrders.length === 0) return

        setIsSubmitting(true)
        try {
            const orderIds = selectedOrders.map((o) => o.id)
            const result = await requestShippingApproval({
                salesOrderIds: orderIds,
                userComment: comment,
            })

            if (result.success) {
                toast.success(
                    `Permintaan approval pengiriman untuk ${selectedOrders.length} Sales Order berhasil dikirim ke Ali Rahman.`
                )
                onOpenChange(false)
                onSuccess?.()
            } else {
                toast.error(result.error || "Gagal mengajukan approval pengiriman.")
            }
        } catch (error) {
            console.error("Submit error:", error)
            toast.error("Terjadi kesalahan saat memproses permintaan.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                            <Send className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                Minta Approval Pengiriman SCM
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                Mengajukan {selectedOrders.length} Sales Order terpilih untuk verifikasi pengiriman oleh SCM Leader.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    {/* Approver Target Banner */}
                    <div className="flex items-start sm:items-center justify-between gap-4 p-3.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800 rounded-lg text-sm">
                        <div className="flex items-center gap-3">
                            <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                            <div>
                                <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 block uppercase tracking-wider">
                                    Target Approver SCM
                                </span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                    Ali Rahman <span className="text-muted-foreground font-normal text-xs">(SCM Leader Balikpapan)</span>
                                </span>
                            </div>
                        </div>
                        <Badge variant="outline" className="bg-white dark:bg-slate-900 border-blue-200 text-blue-700 dark:text-blue-300">
                            ali.rahman@chitraparatama.co.id
                        </Badge>
                    </div>

                    {/* Ringkasan Sales Order Table */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Daftar Sales Order & Barang ({selectedOrders.length} SO • Total {totalItemsCount} Qty)
                            </Label>
                        </div>

                        <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-950">
                            <ScrollArea className="max-h-64">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead className="w-[120px] text-xs font-semibold">No SO</TableHead>
                                            <TableHead className="w-[130px] text-xs font-semibold">No PO Customer</TableHead>
                                            <TableHead className="min-w-[150px] text-xs font-semibold">Customer</TableHead>
                                            <TableHead className="min-w-[200px] text-xs font-semibold">Rincian Barang & Qty</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedOrders.map((order) => (
                                            <TableRow key={order.id} className="text-xs">
                                                <TableCell className="font-mono font-medium text-blue-600">
                                                    {order.invoiceNumber || "-"}
                                                </TableCell>
                                                <TableCell className="font-medium text-slate-700 dark:text-slate-300">
                                                    {order.customerPo || "-"}
                                                </TableCell>
                                                <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                                                    {order.customer?.name || "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1 py-1">
                                                        {order.items.map((it, idx) => (
                                                            <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                                                                <span className="text-slate-700 dark:text-slate-300 truncate max-w-[240px]">
                                                                    {it.product?.materialDescription || it.description || "Material"}
                                                                </span>
                                                                <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                                                                    {it.quantity} pcs
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </div>

                    {/* Box Comment dari Sisi User */}
                    <div className="space-y-2">
                        <Label htmlFor="requester-comment" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                            <span>Comment / Catatan Pemohon</span>
                            <span className="text-[10px] lowercase text-muted-foreground font-normal">(opsional)</span>
                        </Label>
                        <Textarea
                            id="requester-comment"
                            placeholder="Contoh: Mohon arahan pengiriman untuk customer ini, rencana dikirim awal pekan depan dengan armada tronton..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                            className="resize-none text-sm"
                        />
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span>Approver akan menerima notifikasi email & inbox, serta dapat memberikan arahan respon pengiriman.</span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 py-3 border-t bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between sm:justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || selectedOrders.length === 0}
                        className="bg-sky-600 hover:bg-sky-700 text-white min-w-[170px]"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Mengirim...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4 mr-2" />
                                Kirim Minta Approval
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
