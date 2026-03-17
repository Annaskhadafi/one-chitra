"use client"

import React, { useRef, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, Download, X, ImageIcon, Loader2 } from "lucide-react"
import type { Product, Warehouse, Customer } from "@/lib/types"
import { toPng, toJpeg } from "html-to-image"
import jsPDF from "jspdf"

interface DeliveryPdfData {
    id: number
    deliveryNumber: string | null
    doSap: string | null
    scheduledDate: Date
    deliveryDate: Date | null
    status: string
    deliveryType: string
    driverName: string | null
    vehicleNumber: string | null
    vehicleType: string | null
    shippingAddress: string | null
    isExternal?: boolean
    awbNumber?: string | null
    vendorName?: string | null
    notes: string | null
    salesOrder: {
        id: number
        invoiceNumber: string | null
        customerPo: string | null
        poReceive?: Date | null
        customer: Customer
    }
    warehouse: Warehouse | null
    createdByUser: { id: string; name: string; email: string } | null
    items: {
        id: number
        productId: number
        orderedQuantity: number
        deliveredQuantity: number
        serialNumbers: string[] | null
        product: Product
    }[]
}

interface DeliveryPdfPreviewProps {
    delivery: DeliveryPdfData
    open: boolean
    onClose: () => void
}

function formatDate(date: Date | null | undefined) {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).replace(/\//g, ".")
}

export function DeliveryPdfPreview({ delivery, open, onClose }: DeliveryPdfPreviewProps) {
    const printRef = useRef<HTMLDivElement>(null)
    const [withBackground, setWithBackground] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)

    const handleDownloadPdf = async () => {
        const element = printRef.current
        if (!element) return

        try {
            setIsGenerating(true)
            
            // Temporary hide box shadows and borders that shouldn't be in PDF
            const originalShadow = element.style.boxShadow
            element.style.boxShadow = 'none'

            const dataUrl = await toPng(element, {
                quality: 1,
                pixelRatio: 2, // High quality
                skipFonts: false,
            })

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            })

            const imgProps = pdf.getImageProperties(dataUrl)
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
            pdf.save(`Delivery_Order_${delivery.deliveryNumber || 'Document'}.pdf`)
            
            element.style.boxShadow = originalShadow
        } catch (error) {
            console.error('Failed to generate PDF:', error)
        } finally {
            setIsGenerating(false)
        }
    }

    const handlePrint = () => {
        const printContent = printRef.current
        if (!printContent) return

        const printWindow = window.open("", "_blank")
        if (!printWindow) return

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Delivery Order ${delivery.deliveryNumber || ""}</title>
                <style>
                    @page { size: A4; margin: 0; }
                    body { margin: 0; padding: 0; background-color: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .pdf-wrapper { 
                        font-family: Arial, sans-serif; 
                        font-size: 10pt; 
                        color: #000; 
                        line-height: 1.2;
                        width: 210mm;
                        min-height: 297mm;
                        background-color: white;
                        margin: 0 auto;
                        ${withBackground ? `
                        background-image: url('/ChitraParatama_Stationery_Letterhead_jkt.jpg') !important;
                        background-size: 100% 100% !important;
                        background-repeat: no-repeat !important;
                        background-attachment: fixed !important;` : ""}
                    }
                    .pdf-wrapper * { box-sizing: border-box; }
                    .pdf-wrapper .container { padding: 10mm 20mm; padding-top: ${withBackground ? '48mm' : '35mm'}; width: 100%; display: flex; flex-direction: column; min-height: ${withBackground ? '297mm' : 'auto'}; box-sizing: border-box; }
                    .pdf-wrapper .header-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
                    .pdf-wrapper .ship-to { width: 55%; margin-top: 10mm; }
                    .pdf-wrapper .ship-to-label { font-weight: bold; text-decoration: underline; margin-bottom: 10px; display: block; font-size: 11pt; }
                    .pdf-wrapper .customer-name { font-weight: bold; font-size: 12pt; text-transform: uppercase; margin-bottom: 4px; }
                    .pdf-wrapper .site-info { font-weight: bold; margin-bottom: 5px; white-space: pre-line; font-size: 10pt; line-height: 1.4; }
                    .pdf-wrapper .address-box { margin-bottom: 10px; font-size: 10pt; }
                    .pdf-wrapper .contact-info { font-size: 9pt; }
                    .pdf-wrapper .do-box { width: 42%; border: 1px solid #000; }
                    .pdf-wrapper .do-header { background-color: #d1d5db; border-bottom: 1px solid #000; padding: 6px 10px; font-weight: bold; letter-spacing: 1px; font-size: 11pt; }
                    .pdf-wrapper .do-details { padding: 10px; font-size: 10pt; }
                    .pdf-wrapper .do-row { display: flex; margin-bottom: 4px; }
                    .pdf-wrapper .do-label { width: 120px; }
                    .pdf-wrapper .do-separator { margin-right: 5px; }
                    .pdf-wrapper .do-value { font-weight: bold; }
                    .pdf-wrapper .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
                    .pdf-wrapper .items-table th { text-align: left; padding: 8px 5px; font-size: 10pt; font-weight: bold; border-bottom: 1px solid #000; }
                    .pdf-wrapper .items-table td { padding: 10px 5px; font-size: 10pt; font-weight: bold; vertical-align: top; }
                    .pdf-wrapper .col-item { width: 40px; }
                    .pdf-wrapper .col-qty { width: 80px; text-align: center; }
                    .pdf-wrapper .col-part { width: 120px; }
                    .pdf-wrapper .serial-grid { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; border: 1px solid #000; }
                    .pdf-wrapper .serial-grid th { background-color: #f3f4f6; border: 1px solid #000; padding: 4px; font-size: 8pt; text-align: center; }
                    .pdf-wrapper .footer-section { margin-top: auto; padding-top: 20px; }
                    .pdf-wrapper .note-section { margin-top: 20px; font-size: 9pt; }
                    .pdf-wrapper .note-label { font-weight: bold; margin-bottom: 5px; }
                    .pdf-wrapper .received-condition { font-size: 9pt; line-height: 1.5; margin-bottom: 10px; }
                    .pdf-wrapper .divider-line { border-top: 1px solid #000; margin-bottom: 15px; }
                    .pdf-wrapper .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 9pt; gap: 0; border-collapse: collapse; }
                    .pdf-wrapper .sig-box { display: flex; flex-direction: column; height: 180px; text-align: center; border: 0px solid transparent; padding: 5px; }
                    .pdf-wrapper .sig-label { margin-bottom: 5px; font-weight: normal; }
                    .pdf-wrapper .sig-name { font-weight: normal; margin-bottom: 0px; }
                    .pdf-wrapper .sig-placeholder { margin-top: auto; font-size: 8pt; }
                    .pdf-wrapper .sig-bottom-name { margin-top: 5px; }
                    @media print {
                        .no-print { display: none !important; }
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
            printWindow.close()
        }, 500)
    }

    const customer = delivery.salesOrder?.customer
    // Use shippingAddress if available, otherwise fallback to customer address
    const customerAddress = [customer?.address1, customer?.address2, customer?.address3, customer?.address4, customer?.address5]
        .filter(Boolean)
        .join(" ")
    const address = delivery.shippingAddress || customerAddress
    const isCiptaKridatama = customer?.name?.toUpperCase()?.includes("CIPTA KRIDATAMA")
    const printableItems = delivery.items.filter((item) => Number(item.deliveredQuantity) > 0)

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
                <DialogHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg">Delivery Order Preview — {delivery.deliveryNumber}</DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant={withBackground ? "default" : "outline"} 
                                size="sm" 
                                onClick={() => setWithBackground(!withBackground)} 
                                className={`gap-2 ${withBackground ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                            >
                                <ImageIcon className="h-3.5 w-3.5" />
                                {withBackground ? "Kop Surat: On" : "Kop Surat: Off"}
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleDownloadPdf} 
                                disabled={isGenerating}
                                className="gap-2"
                            >
                                {isGenerating ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Download className="h-3.5 w-3.5" />
                                )}
                                {isGenerating ? 'Generating...' : 'Download PDF'}
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

                <div className="p-4 sm:p-8 bg-zinc-100 dark:bg-zinc-800 text-black flex justify-center w-full min-h-full">
                    <div 
                        className={`pdf-wrapper bg-white shadow-xl relative shrink-0 transition-all duration-300 ${withBackground ? 'w-[210mm] min-h-[297mm]' : 'w-[220mm] min-h-[280mm]'}`} 
                        ref={printRef}
                        style={withBackground ? {
                            backgroundImage: "url('/ChitraParatama_Stationery_Letterhead_jkt.jpg')",
                            backgroundSize: "cover",
                            backgroundRepeat: "no-repeat",
                        } : {}}
                    >
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            .pdf-wrapper { 
                                font-family: Arial, sans-serif; 
                                font-size: 10pt; 
                                color: #000; 
                                line-height: 1.2;
                                padding-bottom: 10mm;
                                box-sizing: border-box;
                            }
                            .pdf-wrapper * { box-sizing: border-box; }
                            .pdf-wrapper .container { padding: 10mm 20mm; padding-top: ${withBackground ? '42mm' : '45mm'}; width: 100%; max-width: none; background-color: transparent; margin: 0; display: flex; flex-direction: column; min-height: ${withBackground ? '245mm' : '225mm'}; }
                            
                            .pdf-wrapper .header-section { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 20px; }
                            .pdf-wrapper .ship-to { width: 45%; margin-top: 0mm; }
                            .pdf-wrapper .ship-to-label { font-weight: bold; text-decoration: underline; margin-bottom: 10px; display: block; font-size: 11pt; }
                            .pdf-wrapper .customer-name { font-weight: bold; font-size: 12pt; text-transform: uppercase; margin-bottom: 4px; }
                            .pdf-wrapper .site-info { font-weight: bold; margin-bottom: 5px; white-space: pre-line; font-size: 10pt; line-height: 1.4; }
                            .pdf-wrapper .address-box { margin-bottom: 10px; font-size: 10pt; }
                            .pdf-wrapper .contact-info { font-size: 9pt; }
                            .pdf-wrapper .do-box { width: 50%; border: 1px solid #000; }
                            .pdf-wrapper .do-header { background-color: #d1d5db; border-bottom: 1px solid #000; padding: 6px 10px; font-weight: bold; letter-spacing: 1px; font-size: 11pt; }
                            .pdf-wrapper .do-details { padding: 10px; font-size: 10pt; }
                            .pdf-wrapper .do-row { display: flex; margin-bottom: 4px; }
                            .pdf-wrapper .do-label { width: 120px; }
                            .pdf-wrapper .do-separator { margin-right: 5px; }
                            .pdf-wrapper .do-value { font-weight: bold; }
                            
                            .pdf-wrapper .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
                            .pdf-wrapper .items-table th { text-align: left; padding: 8px 5px; font-size: 10pt; font-weight: bold; border-bottom: 1px solid #000; }
                            .pdf-wrapper .items-table td { padding: 10px 5px; font-size: 10pt; font-weight: bold; vertical-align: top; }
                            .pdf-wrapper .col-item { width: 40px; }
                            .pdf-wrapper .col-qty { width: 80px; text-align: center; }
                            .pdf-wrapper .col-part { width: 120px; }

                            .pdf-wrapper .serial-grid { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; border: 1px solid #000; }
                            .pdf-wrapper .serial-grid th { background-color: #f3f4f6; border: 1px solid #000; padding: 4px; font-size: 8pt; text-align: center; }
                            .pdf-wrapper .footer-section { margin-top: auto; padding-top: 20px; }
                            .pdf-wrapper .note-section { margin-top: 20px; font-size: 9pt; }
                            .pdf-wrapper .note-label { font-weight: bold; margin-bottom: 5px; }
                            .pdf-wrapper .received-condition { font-size: 9pt; line-height: 1.5; margin-bottom: 10px; }
                            .pdf-wrapper .divider-line { border-top: 1px solid #000; margin-bottom: 15px; }
                            
                            .pdf-wrapper .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 9pt; gap: 0; border-collapse: collapse; }
                            .pdf-wrapper .sig-box { display: flex; flex-direction: column; height: 180px; text-align: center; border: 0px solid transparent; padding: 5px; }
                            .pdf-wrapper .sig-label { margin-bottom: 5px; font-weight: normal; }
                            .pdf-wrapper .sig-name { font-weight: normal; margin-bottom: 0px; }
                            .pdf-wrapper .sig-placeholder { margin-top: auto; font-size: 8pt; }
                            .pdf-wrapper .sig-bottom-name { margin-top: 5px; }

                            @media print {
                                @page { size: A4; margin: 0; }
                                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; background-color: transparent !important; }
                                .pdf-wrapper { 
                                    box-shadow: none !important; 
                                    margin: 0 !important; 
                                    max-width: none !important; 
                                    min-height: 100vh !important; 
                                    padding-bottom: 0 !important;
                                    ${withBackground ? `
                                        background-image: url('/ChitraParatama_Stationery_Letterhead_jkt.jpg') !important;
                                        background-size: cover !important;
                                        background-repeat: no-repeat !important;
                                        background-attachment: fixed !important;
                                    ` : ""}
                                }
                                .pdf-wrapper .container { 
                                    padding: 10mm 20mm !important; 
                                    padding-top: ${withBackground ? '42mm' : '45mm'} !important; 
                                    min-height: ${withBackground ? '245mm' : '225mm'} !important; 
                                }
                                .no-print { display: none !important; }
                            }
                        ` }} />

                        <div className="container">
                            <div className="header-section">
                                <div className="ship-to">
                                    <span className="ship-to-label">Ship To:</span>
                                    <div className="customer-name">{customer?.name}</div>
                                    <div className="site-info" style={{ fontWeight: "normal", whiteSpace: "pre-line" }}>
                                        ATTN : {address || "-"}
                                    </div>
                                </div>

                                <div className="do-box">
                                    <div className="do-header">DELIVERY ORDER</div>
                                    <div className="do-details">
                                        <div className="do-row">
                                            <div className="do-label">Page</div>
                                            <div className="do-separator">:</div>
                                            <div className="do-value">1/1</div>
                                        </div>
                                        <div className="do-row">
                                            <div className="do-label">Delivery No</div>
                                            <div className="do-separator">:</div>
                                            <div className="do-value">{delivery.doSap || delivery.deliveryNumber}</div>
                                        </div>
                                        {delivery.doSap && (
                                            <div className="do-row">
                                                <div className="do-label">Internal No</div>
                                                <div className="do-separator">:</div>
                                                <div className="do-value">{delivery.deliveryNumber}</div>
                                            </div>
                                        )}
                                        <div className="do-row">
                                            <div className="do-label">Delivery Date</div>
                                            <div className="do-separator">:</div>
                                            <div className="do-value">{formatDate(delivery.deliveryDate || delivery.scheduledDate)}</div>
                                        </div>
                                        <div className="do-row">
                                            <div className="do-label">Customer PO No</div>
                                            <div className="do-separator">:</div>
                                            <div className="do-value">{delivery.salesOrder?.customerPo || "-"}</div>
                                        </div>
                                        <div className="do-row">
                                            <div className="do-label">Customer PO Date</div>
                                            <div className="do-separator">:</div>
                                            <div className="do-value">{formatDate(delivery.salesOrder?.poReceive)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <table className="items-table">
                                <thead>
                                    {isCiptaKridatama ? (
                                        <>
                                            <tr>
                                                <th className="col-item" rowSpan={2} style={{ verticalAlign: "middle" }}>Item</th>
                                                <th rowSpan={2} style={{ verticalAlign: "middle" }}>Description</th>
                                                <th colSpan={2} style={{ textAlign: "center" }}>MATERIAL NUMBER</th>
                                                <th className="col-qty" rowSpan={2} style={{ verticalAlign: "middle", textAlign: "center" }}>Qty</th>
                                                <th rowSpan={2} style={{ verticalAlign: "middle", textAlign: "center" }}>Serial Number</th>
                                            </tr>
                                            <tr>
                                                <th style={{ textAlign: "center", width: "100px" }}>CP</th>
                                                <th style={{ textAlign: "center", width: "100px" }}>CK</th>
                                            </tr>
                                        </>
                                    ) : (
                                        <tr>
                                            <th className="col-item">Item</th>
                                            <th>Description</th>
                                            <th className="col-qty">Qty</th>
                                            <th className="col-part">Parts Number</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {printableItems.length === 0 && (
                                        <tr>
                                            <td colSpan={isCiptaKridatama ? 6 : 4} style={{ textAlign: "center", padding: "16px 8px", fontWeight: 600 }}>
                                                Tidak ada item terkirim (Qty 0 tidak ditampilkan)
                                            </td>
                                        </tr>
                                    )}

                                    {printableItems.map((item, idx) => {
                                        const isTyre = item.product.category?.toUpperCase() === "TYRE"

                                        if (isCiptaKridatama) {
                                            return (
                                                <React.Fragment key={idx}>
                                                    <tr>
                                                        <td>{(idx + 1).toString().padStart(2, '0')}</td>
                                                        <td>
                                                            <div style={{ textTransform: "uppercase" }}>
                                                                {item.product.materialDescription}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: "center" }}>
                                                            {item.product.materialNumber}
                                                        </td>
                                                        <td style={{ textAlign: "center" }}>
                                                            {item.product.materialNumberCk || "-"}
                                                        </td>
                                                        <td className="col-qty">
                                                            {item.deliveredQuantity}
                                                        </td>
                                                        <td style={{ textAlign: "center" }}>
                                                            {item.product.oldMaterialNo || "-"}
                                                        </td>
                                                    </tr>
                                                    {isTyre && (
                                                        <tr>
                                                            <td colSpan={6} style={{ padding: "0 5px 15px 45px" }}>
                                                                <table className="serial-grid">
                                                                    <thead>
                                                                        <tr>
                                                                            <th colSpan={5}>SERIAL NUMBER</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {Array.from({ length: Math.ceil(item.deliveredQuantity / 5) }).map((_, rowIdx) => (
                                                                            <tr key={rowIdx}>
                                                                                {Array.from({ length: 5 }).map((_, colIdx) => {
                                                                                    const snIdx = rowIdx * 5 + colIdx
                                                                                    const sn = item.serialNumbers?.[snIdx]
                                                                                    const isVisible = snIdx < item.deliveredQuantity

                                                                                    return (
                                                                                        <td key={colIdx} style={{ border: isVisible ? "1px solid #000" : "none" }}>
                                                                                            {isVisible ? (sn || item.product.materialNumber) : ""}
                                                                                        </td>
                                                                                    )
                                                                                })}
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            )
                                        }

                                        return (
                                            <React.Fragment key={idx}>
                                                <tr>
                                                    <td>{(idx + 1).toString().padStart(2, '0')}</td>
                                                    <td>
                                                        <div style={{ textTransform: "uppercase" }}>
                                                            {item.product.materialDescription}
                                                        </div>
                                                    </td>
                                                    <td className="col-qty">
                                                        {item.deliveredQuantity}
                                                    </td>
                                                    <td className="col-part">
                                                        {item.product.materialNumber}
                                                    </td>
                                                </tr>
                                                {isTyre && (
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: "0 5px 15px 45px" }}>
                                                            <table className="serial-grid">
                                                                <thead>
                                                                    <tr>
                                                                        <th colSpan={5}>SERIAL NUMBER</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {Array.from({ length: Math.ceil(item.deliveredQuantity / 5) }).map((_, rowIdx) => (
                                                                        <tr key={rowIdx}>
                                                                            {Array.from({ length: 5 }).map((_, colIdx) => {
                                                                                const snIdx = rowIdx * 5 + colIdx
                                                                                const sn = item.serialNumbers?.[snIdx]
                                                                                const isVisible = snIdx < item.deliveredQuantity

                                                                                return (
                                                                                    <td key={colIdx} style={{ border: isVisible ? "1px solid #000" : "none" }}>
                                                                                        {isVisible ? (sn || item.product.materialNumber) : ""}
                                                                                    </td>
                                                                                )
                                                                            })}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>

                            <div className="note-section">
                                <div className="note-label">NOTE:</div>
                                {delivery.notes ? (
                                    <div style={{ whiteSpace: "pre-line" }}>{delivery.notes}</div>
                                ) : (
                                    <div>-</div>
                                )}
                            </div>

                            <div className="footer-section">
                                <div className="received-condition">
                                    <div>Received in good Condition ( Materials in 100%New Condition )</div>
                                    <div>Return requests must be submitted within 14 days of the delivery date.we are unable to process any returns beyond this period</div>
                                </div>

                                <div className="divider-line" />

                                <div className="signature-grid">
                                    <div className="sig-box">
                                        <div className="sig-label">Delivery by,</div>
                                        <div className="sig-name">PT.Chitra Paratama</div>
                                        <div className="sig-placeholder">
                                            <div className="sig-bottom-name">( {delivery.createdByUser?.name || "          "} )</div>
                                        </div>
                                    </div>
                                    <div className="sig-box">
                                        <div className="sig-label">
                                            Forwarder By,
                                            {delivery.isExternal && delivery.vendorName && (
                                                <div style={{ fontWeight: "bold", marginTop: "2px" }}>{delivery.vendorName}</div>
                                            )}
                                        </div>
                                        <div className="sig-placeholder">
                                            {delivery.isExternal ? (
                                                <div style={{ fontSize: "24pt", fontWeight: "black", marginBottom: "10px" }}>
                                                    {delivery.awbNumber || "-"}
                                                </div>
                                            ) : (
                                                <div className="sig-name">
                                                    ( {delivery.driverName || "-"} | {delivery.vehicleNumber || "-"})
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="sig-box">
                                        <div className="sig-label">Received by,</div>
                                        <div className="sig-name">{customer?.name}</div>
                                        <div className="sig-placeholder">
                                            <div className="sig-bottom-name">( Name ,Sign & stamp )</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
