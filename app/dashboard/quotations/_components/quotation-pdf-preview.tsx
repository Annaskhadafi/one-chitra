"use client"

import { useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, X } from "lucide-react"
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
    address: string | null
    closingStatus: string | null
    tags: string | null
    currency: string
    referenceNumber: string | null
    adminNote: string | null
    clientNote: string | null
    discountType: string
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
        longDescription: string | null
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

function formatCurrency(value: number, currency: string = "IDR") {
    if (currency === "USD") {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(value)
    }
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value)
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
}

export function QuotationPdfPreview({ quotation, open, onClose }: QuotationPdfPreviewProps) {
    const printRef = useRef<HTMLDivElement>(null)

    const itemsSubtotal = quotation.items.reduce((sum, item) => {
        return sum + (item.quantity * Number(item.unitPrice))
    }, 0)

    const discountAmount = quotation.discountType === "percent"
        ? (itemsSubtotal * Number(quotation.discount)) / 100
        : Number(quotation.discount)

    const taxAmount = Number(quotation.tax)
    const grandTotal = itemsSubtotal - discountAmount + taxAmount + Number(quotation.shipping)

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
                    body { font-family: 'Inter', 'Segoe UI', 'Arial', sans-serif; font-size: 10pt; color: #1e293b; line-height: 1.5; -webkit-print-color-adjust: exact; }
                    .pdf-wrapper { width: 100%; max-width: 210mm; margin: 0 auto; background: white; }

                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; border-bottom: 2px solid #2563eb; padding-bottom: 12px; }
                    .logo-section { display: flex; flex-direction: column; gap: 8px; }
                    .logo-container img { height: 90px; width: auto; }
                    .company-info { margin-top: 8px; }
                    .company-name { font-size: 13pt; font-weight: 800; color: #0f172a; margin-bottom: 4px; letter-spacing: -0.01em; }
                    .company-address { font-size: 9.5pt; color: #475569; width: 85%; line-height: 1.5; }

                    .doc-title-container { text-align: right; }
                    .doc-title { font-size: 24pt; font-weight: 900; color: #2563eb; margin-bottom: 0; letter-spacing: -0.03em; line-height: 1; text-transform: uppercase; }
                    .doc-number { font-size: 11pt; color: #64748b; font-weight: 600; margin-top: 4px; }

                    .meta-grid { display: flex; gap: 20px; margin-bottom: 25px; margin-top: 12px; background: #f8fafc; padding: 15px 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .meta-left { flex: 1.2; }
                    .meta-right { flex: 1; text-align: right; border-left: 1px solid #e2e8f0; padding-left: 20px; }
                    
                    .meta-row { display: flex; margin-bottom: 4px; align-items: baseline; }
                    .meta-label { width: 120px; font-weight: 700; color: #64748b; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; }
                    .meta-value { flex: 1; color: #0f172a; font-weight: 600; font-size: 9.5pt; }

                    .recipient-box { text-align: right; width: 100%; }
                    .recipient-label { font-weight: 800; font-size: 8pt; color: #2563eb; margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.05em; }
                    .recipient-name { font-weight: 800; font-size: 12pt; color: #0f172a; margin-bottom: 2px; letter-spacing: -0.01em; }
                    .recipient-address { font-size: 9.5pt; color: #475569; white-space: pre-wrap; line-height: 1.5; }

                    table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 35px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
                    th { background: #2563eb; color: white; padding: 14px 15px; font-size: 9pt; text-align: left; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; border: none; }
                    th.text-center { text-align: center; }
                    th.text-right { text-align: right; }
                    
                    td { padding: 14px 15px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-size: 10pt; }
                    tr:last-child td { border-bottom: none; }
                    .item-name { font-weight: 800; margin-bottom: 6px; text-transform: uppercase; color: #0f172a; font-size: 10.5pt; }
                    .item-desc { color: #64748b; white-space: pre-wrap; line-height: 1.5; font-size: 9.5pt; }
                    
                    .totals-section { display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 40px; }
                    .total-row { display: flex; justify-content: space-between; width: 320px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
                    .total-label { font-weight: 600; color: #64748b; font-size: 10pt; }
                    .total-value { text-align: right; color: #0f172a; font-weight: 700; font-size: 10pt; }
                    .grand-total-row { background: #2563eb; padding: 12px 15px; border-radius: 6px; margin-top: 10px; border: none; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
                    .grand-total-label { font-weight: 800; font-size: 13pt; color: white; text-transform: uppercase; letter-spacing: 0.05em; }
                    .grand-total-value { font-weight: 800; font-size: 13pt; color: white; }

                    .terms-section { margin-top: 25px; width: 100%; padding: 15px 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .terms-label { font-weight: 800; margin-bottom: 8px; color: #0f172a; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em; }
                    .terms-content { font-size: 9pt; color: #475569; white-space: pre-wrap; line-height: 1.5; }
                    
                    .bank-info { margin-top: 30px; border: none; }
                    
                    .no-print { display: none !important; }
                    @media print { 
                        body { background: white; }
                        .pdf-wrapper { padding: 0; }
                        .grand-total-row { -webkit-print-color-adjust: exact; background-color: #2563eb !important; color: white !important; }
                    }
                    
                    .no-print { display: none !important; }
                    @media print { 
                        body { background: white; }
                        .pdf-wrapper { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="pdf-wrapper">
                    ${printContent.innerHTML}
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
            printWindow.print()
        }, 800)
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-7xl max-h-[95vh] overflow-y-auto p-0 bg-slate-50">
                <DialogHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4 no-print">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg">Quotation Preview</DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={handlePrint} className="gap-2">
                                <Printer className="h-3.5 w-3.5" />
                                Print / Download PDF
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* PDF Content Area */}
                <div className="flex justify-center p-8">
                    <div className="bg-white shadow-2xl w-full max-w-[210mm] p-[15mm] min-h-[297mm] ring-1 ring-slate-200" ref={printRef}>
                        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, borderBottom: '2px solid #2563eb', paddingBottom: 12 }}>
                            <div className="logo-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div className="logo-container">
                                    <img src="/api/uploads/Chitra-Paratama.png" alt="Logo" style={{ height: 90, width: 'auto' }} />
                                </div>
                                <div className="company-info" style={{ marginTop: 8 }}>
                                    <div className="company-name" style={{ fontSize: '13pt', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>PT Chitra Paratama</div>
                                    <div className="company-address" style={{ fontSize: '9.5pt', color: '#475569', width: '85%', lineHeight: '1.5' }}>
                                        {quotation.address || "Jl. Amd No.69 Karang Joang Kec. Balikpapan Utara | Kota Balikpapan Kalimantan Timur 7612"}
                                    </div>
                                </div>
                            </div>
                            <div className="doc-title-container" style={{ textAlign: 'right' }}>
                                <div className="doc-title" style={{ fontSize: '24pt', fontWeight: 900, color: '#2563eb', letterSpacing: '-0.03em', textTransform: 'uppercase' }}>QUOTATION</div>
                                <div className="doc-number" style={{ fontSize: '11pt', color: '#64748b', fontWeight: 600 }}>{quotation.quotationNumber}</div>
                            </div>
                        </div>

                        <div className="meta-grid" style={{ display: 'flex', gap: 20, marginBottom: 25, marginTop: 12, background: '#f8fafc', padding: '15px 20px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <div className="meta-left" style={{ flex: 1.2 }}>
                                <div className="meta-row" style={{ display: 'flex', marginBottom: 4, alignItems: 'baseline' }}>
                                    <div className="meta-label" style={{ width: 120, fontWeight: 700, color: '#64748b', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quo Date:</div>
                                    <div className="meta-value" style={{ fontWeight: 600, color: '#0f172a', fontSize: '9.5pt' }}>{formatDate(quotation.quotationDate)}</div>
                                </div>
                                <div className="meta-row" style={{ display: 'flex', marginBottom: 4, alignItems: 'baseline' }}>
                                    <div className="meta-label" style={{ width: 120, fontWeight: 700, color: '#64748b', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Validity Quote:</div>
                                    <div className="meta-value" style={{ fontWeight: 600, color: '#0f172a', fontSize: '9.5pt' }}>{quotation.validUntil ? formatDate(quotation.validUntil) : "-"}</div>
                                </div>
                                <div className="meta-row" style={{ display: 'flex', marginBottom: 4, alignItems: 'baseline' }}>
                                    <div className="meta-label" style={{ width: 120, fontWeight: 700, color: '#64748b', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From:</div>
                                    <div className="meta-value" style={{ fontWeight: 600, color: '#0f172a', fontSize: '9.5pt' }}>{quotation.salesPerson?.name || "-"}</div>
                                </div>
                                <div className="meta-row" style={{ display: 'flex', marginBottom: 4, alignItems: 'baseline' }}>
                                    <div className="meta-label" style={{ width: 120, fontWeight: 700, color: '#64748b', fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attn:</div>
                                    <div className="meta-value" style={{ flex: 1, fontWeight: 600, color: '#0f172a', fontSize: '9.5pt', whiteSpace: 'pre-wrap' }}>{quotation.attn || "-"}</div>
                                </div>
                            </div>

                            <div className="meta-right" style={{ flex: 1, textAlign: 'right', borderLeft: '1px solid #e2e8f0', paddingLeft: 20 }}>
                                <div className="recipient-box" style={{ textAlign: 'right' }}>
                                    <span style={{ fontWeight: 800, fontSize: '8pt', color: '#2563eb', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</span>
                                    <div className="recipient-name" style={{ fontWeight: 800, fontSize: '12pt', color: '#0f172a', marginBottom: 2 }}>{quotation.customer.name}</div>
                                    <div className="recipient-address" style={{ fontSize: '9.5pt', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                        {quotation.customer.address1 || ""}
                                        {quotation.customer.address2 ? `\n${quotation.customer.address2}` : ""}
                                        {quotation.customer.address3 ? `\n${quotation.customer.address3}` : ""}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30, border: '1px solid #e2e8f0' }}>
                            <thead>
                                <tr>
                                    <th style={{ background: '#3b5998', color: 'white', padding: '12px 15px', fontSize: '9pt', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>#</th>
                                    <th style={{ background: '#3b5998', color: 'white', padding: '12px 15px', fontSize: '9pt', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Item</th>
                                    <th style={{ background: '#3b5998', color: 'white', padding: '12px 15px', fontSize: '9pt', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Qty</th>
                                    <th style={{ background: '#3b5998', color: 'white', padding: '12px 15px', fontSize: '9pt', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Price</th>
                                    <th style={{ background: '#3b5998', color: 'white', padding: '12px 15px', fontSize: '9pt', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotation.items.map((item, index) => {
                                    const lineAmount = item.quantity * Number(item.unitPrice)
                                    return (
                                        <tr key={item.id}>
                                            <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', fontSize: '10pt', color: '#64748b' }}>{index + 1}</td>
                                            <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', fontSize: '10pt' }}>
                                                <div className="item-name" style={{ fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', marginBottom: 4 }}>{item.product.materialDescription || item.product.materialNumber}</div>
                                                <div className="item-desc" style={{ color: '#475569', fontSize: '9pt', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                                    {item.longDescription || item.description}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', fontSize: '10pt', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                                            <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', fontSize: '10pt', textAlign: 'right', fontWeight: 600 }}>{Number(item.unitPrice).toLocaleString()}</td>
                                            <td style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', fontSize: '10pt', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{lineAmount.toLocaleString()}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        {/* Totals Section */}
                        <div className="totals-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 40 }}>
                            <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', width: 300, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <span className="total-label" style={{ fontWeight: 600, color: '#64748b' }}>Sub Total</span>
                                <span className="total-value" style={{ textAlign: 'right', color: '#1e293b', fontWeight: 600 }}>{formatCurrency(itemsSubtotal, quotation.currency)}</span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', width: 300, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                    <span className="total-label" style={{ fontWeight: 600, color: '#64748b' }}>Discount {quotation.discountType === "percent" ? `(${quotation.discount}%)` : ""}</span>
                                    <span className="total-value" style={{ textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>-{formatCurrency(discountAmount, quotation.currency)}</span>
                                </div>
                            )}
                            {taxAmount > 0 && (
                                <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', width: 300, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                    <span className="total-label" style={{ fontWeight: 600, color: '#64748b' }}>PPn (11%)</span>
                                    <span className="total-value" style={{ textAlign: 'right', color: '#1e293b', fontWeight: 600 }}>{formatCurrency(taxAmount, quotation.currency)}</span>
                                </div>
                            )}
                            <div className="total-row grand-total-row" style={{ display: 'flex', justifyContent: 'space-between', width: 320, padding: '12px 15px', background: '#2563eb', borderRadius: 6, marginTop: 10 }}>
                                <span className="grand-total-label" style={{ fontWeight: 800, fontSize: '13pt', color: 'white' }}>Total</span>
                                <span className="grand-total-value" style={{ fontWeight: 800, fontSize: '13pt', color: 'white' }}>{formatCurrency(grandTotal, quotation.currency)}</span>
                            </div>
                        </div>

                        {/* Terms section */}
                        {(quotation.termsConditions || quotation.clientNote) && (
                            <div className="terms-section" style={{ marginTop: 25, width: '100%', padding: '15px 20px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                <div className="terms-label" style={{ fontWeight: 800, marginBottom: 8, color: '#0f172a', fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Terms & Conditions:</div>
                                <div className="terms-content" style={{ fontSize: '9pt', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                    {quotation.termsConditions}
                                    {quotation.clientNote && `\n\n${quotation.clientNote}`}
                                </div>
                            </div>
                        )}

                        <div className="bank-info" style={{ marginTop: 30, paddingBottom: 20 }}>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
