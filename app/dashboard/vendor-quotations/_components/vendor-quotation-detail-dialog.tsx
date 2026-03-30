"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Printer, Download, ExternalLink, Pencil, Trash2, Eye, X, AlertCircle } from "lucide-react"
import { useState } from "react"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"
import { VendorQuotationOcrBadge } from "./vendor-quotation-ocr-dialog"

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
    const isImage = quotation?.fileUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)
    const isPdf = quotation?.fileUrl.match(/\.pdf/i)
    if (!quotation) return null

    const totalAmount = quotation.items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-6xl h-[95vh] lg:h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-indigo-100">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <DialogTitle className="text-xl">Quotation Detail</DialogTitle>
                        </div>
                        <div className="flex items-center gap-2 no-print">
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

                <ScrollArea className="flex-1 p-6 pt-2">
                    <div className="pdf-wrapper space-y-8 bg-card border rounded-xl p-8 shadow-sm">
                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row justify-between gap-6">
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{quotation.vendorName || "Unknown Vendor"}</h2>
                                    <p className="text-muted-foreground text-sm">Vendor Quotation</p>
                                </div>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                    <div className="text-muted-foreground">Quote Number:</div>
                                    <div className="font-medium">{quotation.quoteNumber || "—"}</div>
                                    <div className="text-muted-foreground">Quote Date:</div>
                                    <div className="font-medium">{quotation.quoteDate || "—"}</div>
                                    <div className="text-muted-foreground">Imported At:</div>
                                    <div className="font-medium">{formatDate(quotation.createdAt)}</div>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-3 no-print">
                                <VendorQuotationOcrBadge status={quotation.ocrStatus} />
                                <div className="flex flex-wrap justify-end gap-2">
                                    {(isImage || isPdf) && (
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            onClick={() => setIsPreviewOpen(true)}
                                            className="h-8 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300"
                                        >
                                            <Eye className="h-3.5 w-3.5 mr-2" />
                                            Preview Document
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" asChild className="h-8">
                                        <a href={quotation.fileUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                            Open Original
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Items Table */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Line Items</h3>
                            <div className="border rounded-lg overflow-hidden overflow-x-auto scrollbar-thin scrollbar-thumb-accent">
                                <Table className="min-w-[700px]">
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-[40%]">Description</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead>Unit</TableHead>
                                            <TableHead className="text-right">Unit Price</TableHead>
                                            <TableHead className="text-right">Total Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {quotation.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">
                                                    <div>{item.itemName}</div>
                                                    {item.remark && <p className="text-xs text-muted-foreground mt-1">{item.remark}</p>}
                                                </TableCell>
                                                <TableCell className="text-right">{item.qty}</TableCell>
                                                <TableCell>{item.unit || "—"}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Footer Section */}
                        <div className="flex flex-col md:flex-row justify-between gap-8 pt-4">
                            <div className="md:w-1/2 space-y-3">
                                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">General Remarks</h4>
                                <p className="text-sm border p-4 rounded-lg bg-muted/20 min-h-[80px]">
                                    {quotation.remark || "No additional remarks provided."}
                                </p>
                            </div>
                            <div className="md:w-1/3">
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
                </ScrollArea>
                
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
                    <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 overflow-hidden flex flex-col border-indigo-200">
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
                        <div className="flex-1 bg-slate-900/5 overflow-auto flex items-center justify-center p-4">
                            {isPdf ? (
                                <iframe 
                                    src={`${quotation.fileUrl}#toolbar=0`} 
                                    className="w-full h-full rounded-md shadow-lg bg-white"
                                    title="PDF Preview"
                                />
                            ) : isImage ? (
                                <div className="max-w-full max-h-full overflow-auto scrollbar-thin scrollbar-thumb-indigo-200">
                                    <img 
                                        src={quotation.fileUrl} 
                                        alt="Quotation Preview" 
                                        className="max-w-none shadow-2xl rounded-sm"
                                        style={{ minWidth: "100%" }}
                                    />
                                </div>
                            ) : (
                                <div className="text-center space-y-4">
                                    <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
                                    <p>Preview tidak tersedia untuk format ini.</p>
                                    <Button asChild>
                                        <a href={quotation.fileUrl} target="_blank">Download File</a>
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
                    .pdf-wrapper { 
                        box-shadow: none !important; 
                        border: none !important; 
                        padding: 0 !important;
                    }
                    body { background: white !important; }
                }
            `}</style>
        </Dialog>
    )
}
