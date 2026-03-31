"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Printer, ExternalLink, Pencil, Trash2, Eye, X, AlertCircle } from "lucide-react"
import { useState } from "react"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"
import { VendorQuotationOcrBadge } from "./vendor-quotation-ocr-dialog"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"

type Props = {
    quotation: VendorQuotationWithItems | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onEdit?: (quotation: VendorQuotationWithItems) => void
    onDelete?: (id: number) => void
}

function formatCurrency(value: string | number) {
    const val = typeof value === "string" ? parseFloat(value) : value
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(val)
}

function formatDate(date: Date | string | null) {
    if (!date) return "—"
    const d = new Date(date)
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(d)
}

export function VendorQuotationDetailDialog({ quotation, open, onOpenChange, onEdit, onDelete }: Props) {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const documentUrl = resolveUploadDocumentUrl(quotation?.fileUrl) ?? quotation?.fileUrl ?? ""
    const isPreviewable = /\.(pdf|jpg|jpeg|png|webp|gif)(?:[?#].*)?$/i.test(documentUrl)

    if (!quotation) return null
    const totalAmount = quotation.items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[96vh] w-[98vw] max-w-[98vw] flex-col overflow-hidden border-indigo-100 p-0 shadow-2xl xl:max-w-[1800px]">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <DialogTitle className="text-xl">Quotation Detail</DialogTitle>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 no-print">
                            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8">
                                <Printer className="h-4 w-4 mr-2" />
                                Print
                            </Button>
                            {onEdit && (
                                <Button variant="outline" size="sm" onClick={() => onEdit(quotation)} className="h-8">
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto px-4 pb-4 sm:px-6">
                    <div className="space-y-8 rounded-xl border bg-card p-4 shadow-sm sm:p-6 xl:p-8">
                        {/* Header Section */}
                        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 space-y-4">
                                <div>
                                    <h2 className="break-words text-2xl font-bold tracking-tight text-foreground">
                                        {quotation.vendorName || "Unknown Vendor"}
                                    </h2>
                                    <p className="text-muted-foreground text-sm">Vendor Quotation</p>
                                </div>
                                <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
                                    <div className="text-muted-foreground">Quote Number:</div>
                                    <div className="font-medium break-words">{quotation.quoteNumber || "—"}</div>
                                    <div className="text-muted-foreground">Quote Date:</div>
                                    <div className="font-medium">{quotation.quoteDate || "—"}</div>
                                    <div className="text-muted-foreground">Imported At:</div>
                                    <div className="font-medium">{formatDate(quotation.createdAt)}</div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 no-print xl:items-end">
                                <VendorQuotationOcrBadge status={quotation.ocrStatus} />
                                <div className="flex flex-wrap gap-2 xl:justify-end">
                                    {isPreviewable && (
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            onClick={() => setIsPreviewOpen(true)}
                                            className="h-8 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300"
                                        >
                                            <Eye className="h-3.5 w-3.5 mr-2" />
                                            View Detail Dokumen Asli
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" asChild className="h-8">
                                        <a href={documentUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                            Open Original
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="font-semibold text-lg">Line Items</h3>
                                <div className="text-sm text-muted-foreground">
                                    {quotation.items.length} item
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-lg border">
                                <div className="max-h-[48vh] overflow-auto">
                                <Table className="table-fixed min-w-[760px]">
                                    <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                                        <TableRow>
                                            <TableHead className="w-[42%] min-w-[280px]">Description</TableHead>
                                            <TableHead className="w-[10%] text-right">Qty</TableHead>
                                            <TableHead className="w-[12%] min-w-[90px]">Unit</TableHead>
                                            <TableHead className="w-[18%] text-right">Unit Price</TableHead>
                                            <TableHead className="w-[18%] text-right">Total Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {quotation.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="align-top font-medium">
                                                    <div className="break-words whitespace-normal">{item.itemName}</div>
                                                    {item.remark && (
                                                        <p className="mt-1 break-words text-xs text-muted-foreground whitespace-normal">
                                                            {item.remark}
                                                        </p>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right align-top whitespace-nowrap">{item.qty}</TableCell>
                                                <TableCell className="align-top break-words">{item.unit || "—"}</TableCell>
                                                <TableCell className="text-right align-top whitespace-nowrap">{formatCurrency(item.unitPrice)}</TableCell>
                                                <TableCell className="text-right align-top font-medium whitespace-nowrap">{formatCurrency(item.totalPrice)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                </div>
                            </div>
                        </div>

                        {/* Footer Section */}
                        <div className="grid gap-8 pt-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                            <div className="min-w-0 space-y-3">
                                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">General Remarks</h4>
                                <p className="min-h-[80px] rounded-lg border bg-muted/20 p-4 text-sm break-words whitespace-pre-wrap">
                                    {quotation.remark || "No additional remarks provided."}
                                </p>
                            </div>
                            <div className="xl:justify-self-end xl:w-full">
                                <div className="bg-muted/30 p-6 rounded-xl space-y-3 border">
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(totalAmount)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="font-bold text-lg">Total Amount</span>
                                        <span className="font-bold text-xl text-primary">{formatCurrency(totalAmount)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="p-4 border-t bg-muted/20 flex justify-end gap-2 no-print">
                    {onDelete && (
                         <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(quotation.id)}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Permanent
                         </Button>
                    )}
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </div>

                {/* Internal Preview Dialog */}
                <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                    <DialogContent className="w-[98vw] max-w-[98vw] xl:max-w-[1850px] h-[96vh] p-0 overflow-hidden flex flex-col border-indigo-200">
                        <DialogHeader className="p-4 border-b bg-muted/30 flex flex-row items-center justify-between space-y-0">
                            <DialogTitle className="text-sm font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4 text-indigo-500" />
                                Document Preview: {quotation.fileName || "Quotation"}
                            </DialogTitle>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8" 
                                onClick={() => setIsPreviewOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogHeader>
                        <div className="flex-1 overflow-auto bg-slate-900/5 p-4">
                            {isPreviewable ? (
                                <div className="h-full min-w-[1100px] min-h-[720px] overflow-auto rounded-lg border bg-white shadow-lg">
                                    <iframe
                                        src={documentUrl}
                                        className="h-full w-full min-w-[1100px] min-h-[720px] bg-white"
                                        title="Original Document Preview"
                                    />
                                </div>
                            ) : (
                                <div className="text-center space-y-4">
                                    <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
                                    <p>Preview tidak tersedia untuk format ini.</p>
                                    <Button asChild>
                                        <a href={documentUrl} target="_blank" rel="noopener noreferrer">Download File</a>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </DialogContent>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                }
            `}</style>
        </Dialog>
    )
}
