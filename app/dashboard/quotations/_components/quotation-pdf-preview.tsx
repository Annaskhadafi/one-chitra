"use client"

import { useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, Download, X } from "lucide-react"
import type { Customer, Product } from "@/lib/types"
import { user } from "@/db/schema"

type User = typeof user.$inferSelect

interface QuotationPdfData {
    id: number
    quotationNumber: string | null
    customerId: number
    quotationDate: Date
    validUntil: Date | null
    subject: string | null
    salesPersonId: string | null
    attn: string | null
    salesPerson: User | null
    status: string
    paymentTerms: string | null
    termsConditions: string | null
    notes: string | null
    discount: string
    tax: string
    shipping: string
    customer: Customer
    items: {
        id: number
        productId: number
        description: string | null
        quantity: number
        unitPrice: string
        discount: string
        tax: string
        product: Product
    }[]
}

interface QuotationPdfPreviewProps {
    quotation: QuotationPdfData
    open: boolean
    onClose: () => void
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}

export function QuotationPdfPreview({ quotation, open, onClose }: QuotationPdfPreviewProps) {
    const printRef = useRef<HTMLDivElement>(null)

    const itemsSubtotal = quotation.items.reduce((sum, item) => {
        return sum + (item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax))
    }, 0)
    const grandTotal = itemsSubtotal - Number(quotation.discount) + Number(quotation.tax) + Number(quotation.shipping)

    const handlePrint = () => {
        const printContent = printRef.current
        if (!printContent) return

        const printWindow = window.open("", "_blank")
        if (!printWindow) return

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Quotation ${quotation.quotationNumber}</title>
                <style>
                    @page { size: A4; margin: 15mm; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
                    .container { max-width: 210mm; margin: 0 auto; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #2563eb; }
                    .company-name { font-size: 22px; font-weight: 700; color: #2563eb; letter-spacing: -0.5px; }
                    .company-subtitle { font-size: 10px; color: #6b7280; margin-top: 2px; }
                    .doc-title { text-align: right; }
                    .doc-title h1 { font-size: 24px; font-weight: 700; color: #1a1a1a; text-transform: uppercase; letter-spacing: 2px; }
                    .doc-title .qt-number { font-size: 13px; color: #2563eb; font-weight: 600; margin-top: 2px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
                    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; }
                    .info-box-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600; margin-bottom: 8px; }
                    .info-row { display: flex; justify-content: space-between; padding: 3px 0; }
                    .info-label { color: #6b7280; font-size: 10px; }
                    .info-value { font-weight: 600; font-size: 10px; }
                    .customer-name { font-size: 13px; font-weight: 700; color: #1a1a1a; }
                    .subject-bar { background: #eff6ff; border-left: 4px solid #2563eb; padding: 10px 14px; margin-bottom: 20px; border-radius: 0 6px 6px 0; }
                    .subject-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
                    .subject-text { font-size: 12px; font-weight: 600; color: #1e40af; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    thead th { background: #1e293b; color: white; padding: 8px 10px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: left; }
                    thead th:first-child { border-radius: 6px 0 0 0; }
                    thead th:last-child { border-radius: 0 6px 0 0; text-align: right; }
                    thead th.text-right { text-align: right; }
                    thead th.text-center { text-align: center; }
                    tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
                    tbody tr:nth-child(even) { background: #f8fafc; }
                    .desc-cell { color: #6b7280; font-size: 9px; font-style: italic; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .totals-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
                    .totals-box { width: 280px; }
                    .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 10px; }
                    .total-row.discount { color: #dc2626; }
                    .total-line { border-top: 1px solid #e2e8f0; margin: 4px 0; }
                    .grand-total { display: flex; justify-content: space-between; padding: 10px 14px; background: #1e293b; color: white; border-radius: 6px; font-size: 13px; font-weight: 700; margin-top: 4px; }
                    .terms-section { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
                    .terms-box { }
                    .terms-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 600; margin-bottom: 6px; }
                    .terms-content { font-size: 10px; color: #4b5563; white-space: pre-line; line-height: 1.6; }
                    .footer { text-align: center; font-size: 9px; color: #9ca3af; padding-top: 16px; border-top: 1px solid #e2e8f0; }
                    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                    .status-draft { background: #f1f5f9; color: #64748b; }
                    .status-sent { background: #dbeafe; color: #2563eb; }
                    .status-approved { background: #dcfce7; color: #16a34a; }
                    .status-rejected { background: #fee2e2; color: #dc2626; }
                    .status-expired { background: #fef3c7; color: #d97706; }
                    .status-converted { background: #f3e8ff; color: #9333ea; }
                    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
            printWindow.print()
        }, 500)
    }

    const handleDownloadPdf = () => {
        handlePrint()
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                <DialogHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg">Quotation Preview — {quotation.quotationNumber}</DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-2">
                                <Download className="h-3.5 w-3.5" />
                                Download
                            </Button>
                            <Button size="sm" onClick={handlePrint} className="gap-2">
                                <Printer className="h-3.5 w-3.5" />
                                Print
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* PDF Preview Content */}
                <div className="p-8 bg-white" ref={printRef}>
                    <div className="container">
                        {/* Header */}
                        <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 16, borderBottom: "3px solid #2563eb" }}>
                            <div>
                                <div className="company-name" style={{ fontSize: 22, fontWeight: 700, color: "#2563eb" }}>ONE CHITRA</div>
                                <div className="company-subtitle" style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>Quotation Document</div>
                            </div>
                            <div className="doc-title" style={{ textAlign: "right" }}>
                                <h1 style={{ fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>QUOTATION</h1>
                                <div className="qt-number" style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, marginTop: 2 }}>{quotation.quotationNumber}</div>
                                <span className={`status-badge status-${quotation.status}`} style={{ display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 9, fontWeight: 600, textTransform: "uppercase", marginTop: 4 }}>
                                    {quotation.status}
                                </span>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="info-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                            <div className="info-box" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 14 }}>
                                <div className="info-box-title" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#6b7280", fontWeight: 600, marginBottom: 8 }}>Bill To</div>
                                <div className="customer-name" style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{quotation.customer.name}</div>
                                <div style={{ fontSize: 10, color: "#6b7280" }}>{quotation.customer.customerCode}</div>
                                {quotation.customer.email && <div style={{ fontSize: 10, color: "#6b7280" }}>{quotation.customer.email}</div>}
                                {quotation.customer.address1 && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>{quotation.customer.address1}</div>}
                                {quotation.attn && (
                                    <div style={{ fontSize: 10, color: "#1a1a1a", marginTop: 8, fontWeight: 600 }}>
                                        <span style={{ color: "#6b7280", textTransform: "uppercase", fontSize: 9, marginRight: 4 }}>ATTN:</span>
                                        {quotation.attn}
                                    </div>
                                )}
                            </div>
                            <div className="info-box" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 14 }}>
                                <div className="info-box-title" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#6b7280", fontWeight: 600, marginBottom: 8 }}>Quotation Details</div>
                                <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                                    <span className="info-label" style={{ color: "#6b7280", fontSize: 10 }}>Date</span>
                                    <span className="info-value" style={{ fontWeight: 600, fontSize: 10 }}>{formatDate(quotation.quotationDate)}</span>
                                </div>
                                {quotation.validUntil && (
                                    <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                                        <span className="info-label" style={{ color: "#6b7280", fontSize: 10 }}>Valid Until</span>
                                        <span className="info-value" style={{ fontWeight: 600, fontSize: 10 }}>{formatDate(quotation.validUntil)}</span>
                                    </div>
                                )}
                                {quotation.paymentTerms && (
                                    <div className="info-row" style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                                        <span className="info-label" style={{ color: "#6b7280", fontSize: 10 }}>Payment Terms</span>
                                        <span className="info-value" style={{ fontWeight: 600, fontSize: 10 }}>{quotation.paymentTerms}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Subject */}
                        {quotation.subject && (
                            <div className="subject-bar" style={{ background: "#eff6ff", borderLeft: "4px solid #2563eb", padding: "10px 14px", marginBottom: 20, borderRadius: "0 6px 6px 0" }}>
                                <div className="subject-label" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#6b7280" }}>Subject</div>
                                <div className="subject-text" style={{ fontSize: 12, fontWeight: 600, color: "#1e40af" }}>{quotation.subject}</div>
                            </div>
                        )}

                        {/* Items Table */}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
                            <thead>
                                <tr>
                                    <th style={{ background: "#1e293b", color: "white", padding: "8px 10px", fontSize: 9, textTransform: "uppercase", textAlign: "left", borderRadius: "6px 0 0 0" }}>#</th>
                                    <th style={{ background: "#1e293b", color: "white", padding: "8px 10px", fontSize: 9, textTransform: "uppercase", textAlign: "left" }}>Description</th>
                                    <th style={{ background: "#1e293b", color: "white", padding: "8px 10px", fontSize: 9, textTransform: "uppercase", textAlign: "center" }}>Qty</th>
                                    <th style={{ background: "#1e293b", color: "white", padding: "8px 10px", fontSize: 9, textTransform: "uppercase", textAlign: "right" }}>Unit Price</th>
                                    <th style={{ background: "#1e293b", color: "white", padding: "8px 10px", fontSize: 9, textTransform: "uppercase", textAlign: "right" }}>Disc.</th>
                                    <th style={{ background: "#1e293b", color: "white", padding: "8px 10px", fontSize: 9, textTransform: "uppercase", textAlign: "right" }}>Tax</th>
                                    <th style={{ background: "#1e293b", color: "white", padding: "8px 10px", fontSize: 9, textTransform: "uppercase", textAlign: "right", borderRadius: "0 6px 0 0" }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotation.items.map((item, index) => {
                                    const lineAmount = item.quantity * Number(item.unitPrice) - Number(item.discount) + Number(item.tax)
                                    return (
                                        <tr key={item.id} style={{ background: index % 2 === 1 ? "#f8fafc" : "white" }}>
                                            <td style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", fontSize: 10 }}>{index + 1}</td>
                                            <td style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", fontSize: 10 }}>
                                                <div style={{ fontWeight: 600 }}>{item.product.materialNumber}</div>
                                                {item.product.materialDescription && (
                                                    <div style={{ fontSize: 9, color: "#6b7280" }}>{item.product.materialDescription}</div>
                                                )}
                                                {item.description && (
                                                    <div style={{ fontSize: 9, color: "#6b7280", fontStyle: "italic", marginTop: 2 }}>{item.description}</div>
                                                )}
                                            </td>
                                            <td style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", fontSize: 10, textAlign: "center" }}>{item.quantity}</td>
                                            <td style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", fontSize: 10, textAlign: "right" }}>{formatCurrency(Number(item.unitPrice))}</td>
                                            <td style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", fontSize: 10, textAlign: "right", color: Number(item.discount) > 0 ? "#dc2626" : "inherit" }}>
                                                {Number(item.discount) > 0 ? `-${formatCurrency(Number(item.discount))}` : "-"}
                                            </td>
                                            <td style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", fontSize: 10, textAlign: "right" }}>
                                                {Number(item.tax) > 0 ? formatCurrency(Number(item.tax)) : "-"}
                                            </td>
                                            <td style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", fontSize: 10, textAlign: "right", fontWeight: 600 }}>
                                                {formatCurrency(lineAmount)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="totals-section" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
                            <div className="totals-box" style={{ width: 280 }}>
                                <div className="total-row" style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 10 }}>
                                    <span>SubTotal</span>
                                    <span style={{ fontWeight: 600 }}>{formatCurrency(itemsSubtotal)}</span>
                                </div>
                                {Number(quotation.discount) > 0 && (
                                    <div className="total-row discount" style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 10, color: "#dc2626" }}>
                                        <span>Discount</span>
                                        <span>-{formatCurrency(Number(quotation.discount))}</span>
                                    </div>
                                )}
                                {Number(quotation.tax) > 0 && (
                                    <div className="total-row" style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 10 }}>
                                        <span>Tax (PPN)</span>
                                        <span>{formatCurrency(Number(quotation.tax))}</span>
                                    </div>
                                )}
                                {Number(quotation.shipping) > 0 && (
                                    <div className="total-row" style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 10 }}>
                                        <span>Shipping</span>
                                        <span>{formatCurrency(Number(quotation.shipping))}</span>
                                    </div>
                                )}
                                <div style={{ borderTop: "1px solid #e2e8f0", margin: "4px 0" }}></div>
                                <div className="grand-total" style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#1e293b", color: "white", borderRadius: 6, fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                                    <span>GRAND TOTAL</span>
                                    <span>{formatCurrency(grandTotal)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Terms & Notes */}
                        {(quotation.termsConditions || quotation.notes) && (
                            <div className="terms-section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                                {quotation.termsConditions && (
                                    <div className="terms-box">
                                        <div className="terms-title" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#6b7280", fontWeight: 600, marginBottom: 6 }}>Terms & Conditions</div>
                                        <div className="terms-content" style={{ fontSize: 10, color: "#4b5563", whiteSpace: "pre-line", lineHeight: 1.6 }}>{quotation.termsConditions}</div>
                                    </div>
                                )}
                                {quotation.notes && (
                                    <div className="terms-box">
                                        <div className="terms-title" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#6b7280", fontWeight: 600, marginBottom: 6 }}>Notes</div>
                                        <div className="terms-content" style={{ fontSize: 10, color: "#4b5563", whiteSpace: "pre-line", lineHeight: 1.6 }}>{quotation.notes}</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="footer" style={{ textAlign: "center", fontSize: 9, color: "#9ca3af", paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
                            This is a computer-generated document. No signature is required.
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
