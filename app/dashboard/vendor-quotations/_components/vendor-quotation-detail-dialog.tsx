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
import { FileText, Printer, Download, ExternalLink, Pencil, Trash2 } from "lucide-react"
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
    if (!quotation) return null

    const totalAmount = quotation.items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
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
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={quotation.fileUrl} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                            View Source File
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Items Table */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Line Items</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
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
