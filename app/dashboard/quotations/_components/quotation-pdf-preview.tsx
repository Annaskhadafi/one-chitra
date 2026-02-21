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
    }).format(value).replace("Rp", "Rp")
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
                    @page { size: A4; margin: 10mm; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Arial', sans-serif; font-size: 10pt; color: #333; line-height: 1.3; }
                    .pdf-wrapper { width: 100%; max-width: 210mm; margin: 0 auto; padding: 10mm; background: white; }
                    
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
                    .logo-container img { height: 80px; width: auto; }
                    
                    .doc-title-container { text-align: right; }
                    .doc-title { font-size: 20pt; font-weight: bold; color: #3b5998; margin-bottom: 2px; }
                    .doc-number { font-size: 11pt; color: #666; font-weight: bold; }

                    .company-info { margin-bottom: 20px; }
                    .company-name { font-size: 11pt; font-weight: bold; margin-bottom: 8px; }
                    .company-address { font-size: 10pt; color: #444; width: 60%; }
                    .address-blue { color: #3b5998; font-weight: bold; }

                    .meta-grid { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .meta-left { width: 45%; }
                    .meta-right { width: 45%; text-align: right; }
                    
                    .meta-row { display: flex; margin-bottom: 2px; }
                    .meta-label { width: 120px; font-weight: bold; color: #444; }
                    .meta-value { flex: 1; }

                    .recipient-container { display: flex; flex-direction: column; align-items: flex-end; }
                    .recipient-box { text-align: right; width: 100%; margin-bottom: 15px; }
                    .recipient-label { font-weight: bold; font-size: 11pt; color: #333; margin-bottom: 2px; display: block; }
                    .recipient-name { font-weight: bold; font-size: 11pt; }
                    .recipient-address { font-size: 9.5pt; color: #555; white-space: pre-wrap; }

                    .ship-to-box { text-align: right; width: 100%; margin-bottom: 20px; }
                    .ship-to-label { font-weight: bold; font-size: 11pt; color: #333; margin-bottom: 2px; display: block; }

                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th { background: #3b5998; color: white; padding: 6px 10px; font-size: 10pt; text-align: left; }
                    th.text-center { text-align: center; }
                    th.text-right { text-align: right; }
                    
                    td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 9.5pt; }
                    .item-name { font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
                    .item-desc { color: #555; white-space: pre-wrap; line-height: 1.2; }
                    
                    .totals-section { display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 30px; }
                    .total-row { display: flex; justify-content: space-between; width: 250px; padding: 4px 0; }
                    .total-label { font-weight: bold; color: #333; }
                    .total-value { text-align: right; }
                    .grand-total-row { background: #f8f8f8; padding: 8px; border-top: 2px solid #3b5998; margin-top: 4px; }
                    .grand-total-label { font-weight: bold; font-size: 11pt; }
                    .grand-total-value { font-weight: bold; font-size: 11pt; }

                    .terms-section { margin-top: 20px; width: 100%; }
                    .terms-label { font-weight: bold; margin-bottom: 6px; }
                    .terms-content { font-size: 9.5pt; color: #333; white-space: pre-wrap; line-height: 1.4; }
                    
                    .bank-info { margin-top: 30px; padding-top: 15px; border-top: 1px solid #000; boarder-bottom: 1px solid #000; }
                    .bank-line { border-bottom: 1px solid #000; padding-bottom: 10px; }
                    
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

    const handleDownloadPdf = () => {
        handlePrint()
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0 bg-slate-100">
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
                    <div className="bg-white shadow-2xl w-full max-w-[210mm] p-[15mm] min-h-[297mm]" ref={printRef}>
                        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }}>
                            <div className="logo-container">
                                <img src="/api/uploads/Chitra-Paratama.png" alt="Logo" style={{ height: 80, width: 'auto' }} />
                            </div>
                            <div className="doc-title-container" style={{ textAlign: 'right' }}>
                                <div className="doc-title" style={{ fontSize: '20pt', fontWeight: 'bold', color: '#3b5998' }}>QUOTATION</div>
                                <div className="doc-number" style={{ fontSize: '11pt', color: '#666', fontWeight: 'bold' }}># {quotation.quotationNumber}</div>
                            </div>
                        </div>

                        <div className="company-info" style={{ marginBottom: 20 }}>
                            <div className="company-name" style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: 8 }}>PT Chitra Paratama</div>
                            <div className="company-address" style={{ fontSize: '10pt', color: '#444', width: '70%' }}>
                                Alamat: Jl. Amd No.69 Karang Joang Kec. Balikpapan Utara | <span style={{ color: '#3b5998', fontWeight: 'bold' }}>Kota Balikpapan Kalimantan Timur 7612</span>
                            </div>
                        </div>

                        <div className="meta-grid" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div className="meta-left" style={{ width: '45%' }}>
                                <div className="meta-row" style={{ display: 'flex', marginBottom: 2 }}>
                                    <div className="meta-label" style={{ width: 120, fontWeight: 'bold', color: '#444' }}>Quo Date:</div>
                                    <div className="meta-value">{formatDate(quotation.quotationDate)}</div>
                                </div>
                                <div className="meta-row" style={{ display: 'flex', marginBottom: 2 }}>
                                    <div className="meta-label" style={{ width: 120, fontWeight: 'bold', color: '#444' }}>Validity Quote:</div>
                                    <div className="meta-value">{quotation.validUntil ? formatDate(quotation.validUntil) : "-"}</div>
                                </div>
                                <div className="meta-row" style={{ display: 'flex', marginBottom: 2 }}>
                                    <div className="meta-label" style={{ width: 120, fontWeight: 'bold', color: '#444' }}>From:</div>
                                    <div className="meta-value">{quotation.salesPerson?.name || "-"}</div>
                                </div>
                                {quotation.attn && (
                                    <div className="meta-row" style={{ display: 'flex', marginBottom: 2 }}>
                                        <div className="meta-label" style={{ width: 120, fontWeight: 'bold', color: '#444' }}>Attn:</div>
                                        <div className="meta-value">{quotation.attn}</div>
                                    </div>
                                )}
                            </div>

                            <div className="meta-right" style={{ width: '50%', textAlign: 'right' }}>
                                <div className="recipient-box" style={{ textAlign: 'right', marginBottom: 15 }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '11pt', color: '#333', marginBottom: 2, display: 'block' }}>To</span>
                                    <div className="recipient-name" style={{ fontWeight: 'bold', fontSize: '11pt' }}>{quotation.customer.name}</div>
                                    <div className="recipient-address" style={{ fontSize: '9.5pt', color: '#555', whiteSpace: 'pre-wrap' }}>
                                        {quotation.customer.address1 || ""}
                                        {quotation.customer.address2 ? `\n${quotation.customer.address2}` : ""}
                                    </div>
                                </div>

                                <div className="ship-to-box" style={{ textAlign: 'right' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '11pt', color: '#333', marginBottom: 2, display: 'block' }}>Ship to</span>
                                    <div className="recipient-address" style={{ fontSize: '9.5pt', color: '#555', whiteSpace: 'pre-wrap' }}>
                                        {quotation.address || "-"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
                            <thead>
                                <tr>
                                    <th style={{ background: '#3b5998', color: 'white', padding: '6px 10px', fontSize: '10pt', textAlign: 'left' }}>#</th>
                                    <th style={{ background: '#3b5998', color: 'white', padding: '6px 10px', fontSize: '10pt', textAlign: 'left' }}>Item</th>
                                    <th style={{ background: '#3b5998', color: 'white', padding: '6px 10px', fontSize: '10pt', textAlign: 'center' }}>Qty</th>
                                    <th style={{ background: '#3b5998', color: 'white', padding: '6px 10px', fontSize: '10pt', textAlign: 'right' }}>Price</th>
                                    <th style={{ background: '#3b5998', color: 'white', padding: '6px 10px', fontSize: '10pt', textAlign: 'right' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quotation.items.map((item, index) => {
                                    const lineAmount = item.quantity * Number(item.unitPrice)
                                    return (
                                        <>
                                            <tr key={item.id}>
                                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee', verticalAlign: 'top', fontSize: '9.5pt' }}>{index + 1}</td>
                                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee', verticalAlign: 'top', fontSize: '9.5pt' }}>
                                                    <div className="item-name" style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{item.product.materialDescription || item.product.materialNumber}</div>
                                                    <div className="item-desc" style={{ color: '#555', fontSize: '9pt', whiteSpace: 'pre-wrap', lineHeight: 1.2 }}>
                                                        {item.description}
                                                        {item.longDescription && `\n${item.longDescription}`}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee', verticalAlign: 'top', fontSize: '9.5pt', textAlign: 'center' }}>{item.quantity}</td>
                                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee', verticalAlign: 'top', fontSize: '9.5pt', textAlign: 'right' }}>{Number(item.unitPrice).toLocaleString()}</td>
                                                <td style={{ padding: '8px 10px', borderBottom: '1px solid #eee', verticalAlign: 'top', fontSize: '9.5pt', textAlign: 'right' }}>{lineAmount.toLocaleString()}</td>
                                            </tr>
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>

                        {/* Totals Section */}
                        <div className="totals-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 30 }}>
                            <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', width: 250, padding: '4px 0' }}>
                                <span className="total-label" style={{ fontWeight: 'bold' }}>Sub Total</span>
                                <span className="total-value">{formatCurrency(itemsSubtotal, quotation.currency)}</span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', width: 250, padding: '4px 0' }}>
                                    <span className="total-label" style={{ fontWeight: 'bold' }}>Discount {quotation.discountType === "percent" ? `(${quotation.discount}%)` : ""}</span>
                                    <span className="total-value">-{formatCurrency(discountAmount, quotation.currency)}</span>
                                </div>
                            )}
                            <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', width: 250, padding: '4px 0' }}>
                                <span className="total-label" style={{ fontWeight: 'bold' }}>PPn (11%)</span>
                                <span className="total-value">{formatCurrency(taxAmount, quotation.currency)}</span>
                            </div>
                            <div className="total-row grand-total-row" style={{ display: 'flex', justifyContent: 'space-between', width: 250, padding: '8px', background: '#f8f8f8', borderTop: '2px solid #3b5998', marginTop: 4 }}>
                                <span className="grand-total-label" style={{ fontWeight: 'bold', fontSize: '11pt' }}>Total</span>
                                <span className="grand-total-value" style={{ fontWeight: 'bold', fontSize: '11pt' }}>{formatCurrency(grandTotal, quotation.currency)}</span>
                            </div>
                        </div>

                        {/* Terms section */}
                        {(quotation.termsConditions || quotation.clientNote) && (
                            <div className="terms-section" style={{ marginTop: 20, width: '100%' }}>
                                <div className="terms-label" style={{ fontWeight: 'bold', marginBottom: 6 }}>Terms & Conditions:</div>
                                <div className="terms-content" style={{ fontSize: '9.5pt', color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                    {quotation.termsConditions}
                                    {quotation.clientNote && `\n\n${quotation.clientNote}`}
                                </div>
                            </div>
                        )}

                        <div className="bank-info" style={{ marginTop: 30, paddingTop: 15, borderTop: '1px solid #000' }}>
                            {/* Empty space or additional bank info if needed as per mockup lines */}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
