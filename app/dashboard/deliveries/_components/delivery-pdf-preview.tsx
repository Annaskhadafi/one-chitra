"use client"

import React, { useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, Download, X } from "lucide-react"
import type { Product, Warehouse, Customer } from "@/lib/types"

interface DeliveryPdfData {
    id: number
    deliveryNumber: string | null
    scheduledDate: Date
    deliveryDate: Date | null
    status: string
    deliveryType: string
    driverName: string | null
    vehicleNumber: string | null
    vehicleType: string | null
    shippingAddress: string | null
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
            </head>
            <body style="margin:0; padding:0; background-color: white;">
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
        }, 500)
    }

    const customer = delivery.salesOrder?.customer
    const address = [customer?.address1, customer?.address2, customer?.address3, customer?.address4, customer?.address5]
        .filter(Boolean)
        .join(" ")

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
                <DialogHeader className="sticky top-0 z-10 bg-background border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-lg">Delivery Order Preview — {delivery.deliveryNumber}</DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                                <Download className="h-3.5 w-3.5" />
                                Download PDF
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
                    <div className="pdf-wrapper bg-white shadow-xl max-w-[210mm] w-full min-h-[297mm] relative shrink-0" ref={printRef}>
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            .pdf-wrapper { 
                                font-family: Arial, sans-serif; 
                                font-size: 10pt; 
                                color: #000; 
                                line-height: 1.2;
                                padding-bottom: 20mm;
                                box-sizing: border-box;
                            }
                            .pdf-wrapper * { box-sizing: border-box; }
                            .pdf-wrapper .container { padding: 10mm; width: 100%; max-width: none; background-color: white; margin: 0; display: flex; flex-direction: column; min-height: 277mm; }
                            
                            .pdf-wrapper .internal-info { color: #eab308; font-size: 8pt; text-align: center; margin-bottom: 60px; margin-top: 20px; }
                            .pdf-wrapper .header-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
                            .pdf-wrapper .ship-to { width: 55%; }
                            .pdf-wrapper .ship-to-label { font-weight: bold; text-decoration: underline; margin-bottom: 10px; display: block; }
                            .pdf-wrapper .customer-name { font-weight: bold; font-size: 11pt; text-transform: uppercase; margin-bottom: 2px; }
                            .pdf-wrapper .site-info { font-weight: bold; margin-bottom: 5px; }
                            .pdf-wrapper .address-box { margin-bottom: 10px; font-size: 9pt; }
                            .pdf-wrapper .contact-info { font-size: 9pt; }
                            .pdf-wrapper .do-box { width: 42%; border: 1px solid #000; }
                            .pdf-wrapper .do-header { background-color: #d1d5db; border-bottom: 1px solid #000; padding: 5px 10px; font-weight: bold; letter-spacing: 1px; }
                            .pdf-wrapper .do-details { padding: 10px; font-size: 9pt; }
                            .pdf-wrapper .do-row { display: flex; margin-bottom: 3px; }
                            .pdf-wrapper .do-label { width: 120px; }
                            .pdf-wrapper .do-separator { margin-right: 5px; }
                            .pdf-wrapper .do-value { font-weight: bold; }
                            
                            .pdf-wrapper .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
                            .pdf-wrapper .items-table th { text-align: left; padding: 8px 5px; font-size: 9pt; border-bottom: 1px solid #000; }
                            .pdf-wrapper .items-table td { padding: 10px 5px; font-size: 9pt; vertical-align: top; }
                            .pdf-wrapper .col-item { width: 40px; }
                            .pdf-wrapper .col-qty { width: 80px; text-align: center; }
                            .pdf-wrapper .col-part { width: 120px; }

                            .pdf-wrapper .serial-grid { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; border: 1px solid #000; }
                            .pdf-wrapper .serial-grid th { background-color: #f3f4f6; border: 1px solid #000; padding: 4px; font-size: 8pt; text-align: center; }
                            .pdf-wrapper .serial-grid td { border: 1px solid #000; padding: 4px; font-size: 8pt; height: 25px; text-align: center; vertical-align: middle; }
                            
                            .pdf-wrapper .footer-section { margin-top: auto; padding-top: 40px; }
                            .pdf-wrapper .note-section { margin-top: 20px; font-size: 9pt; }
                            .pdf-wrapper .note-label { font-weight: bold; margin-bottom: 5px; }
                            .pdf-wrapper .received-condition { margin-top: 15px; font-size: 9pt; border-top: 1px solid #000; padding-top: 5px; text-align: center; }
                            
                            .pdf-wrapper .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 9pt; }
                            .pdf-wrapper .sig-box { display: flex; flex-direction: column; height: 120px; justify-content: space-between; text-align: center; }
                            .pdf-wrapper .sig-label { margin-bottom: 10px; }
                            .pdf-wrapper .sig-name { margin-top: auto; }
                            
                            .pdf-wrapper .internal-info-footer { color: #eab308; font-size: 8pt; text-align: center; position: absolute; bottom: 10mm; width: 100%; left: 0; }

                            @media print {
                                @page { size: A4; margin: 10mm; }
                                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; background-color: transparent !important; }
                                .pdf-wrapper { box-shadow: none !important; margin: 0 !important; max-width: none !important; min-height: auto !important; padding-bottom: 25mm !important; }
                                .pdf-wrapper .container { padding: 0 !important; }
                                .pdf-wrapper .internal-info-footer { position: fixed; bottom: 0; }
                                .no-print { display: none !important; }
                            }
                        ` }} />

                        <div className="container">
                            <div className="internal-info">Internal information - Yellow - Mahadasha Group.</div>

                            <div className="header-section">
                                <div className="ship-to">
                                    <span className="ship-to-label">Ship To:</span>
                                    <div className="customer-name">{customer?.name}</div>
                                    <div className="site-info" style={{ fontWeight: "normal" }}>
                                        Site : {address || delivery.shippingAddress || "-"}
                                    </div>
                                    <div className="contact-info" style={{ marginTop: "10px" }}>
                                        <div>PIC: {customer?.contactName || "-"}</div>
                                        <div>Email : {customer?.email || "-"}</div>
                                        <div>HP : -</div>
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
                                            <div className="do-value">{delivery.deliveryNumber}</div>
                                        </div>
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
                                    <tr>
                                        <th className="col-item">Item</th>
                                        <th>Description</th>
                                        <th className="col-qty">Qty</th>
                                        <th className="col-part">Parts Number</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {delivery.items.map((item, idx) => {
                                        const isTyre = item.product.category?.toUpperCase() === "TYRE"

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
                                <div className="signature-grid">
                                    <div className="sig-box">
                                        <div className="sig-label">Delivery by,</div>
                                        <div className="sig-name">PT.Chitra Paratama</div>
                                        <div style={{ marginTop: "20px" }}>( {delivery.createdByUser?.name || "          "} )</div>
                                    </div>
                                    <div className="sig-box">
                                        <div className="sig-label">Forwarder / Driver,</div>
                                        <div className="sig-name">
                                            {delivery.driverName || "-"} {delivery.vehicleNumber ? ` - ${delivery.vehicleNumber}` : ""}
                                        </div>
                                        <div style={{ marginTop: "20px" }}>( Name, Sign & stamp )</div>
                                    </div>
                                    <div className="sig-box" style={{ textAlign: "right" }}>
                                        <div className="sig-label">Received by,</div>
                                        <div className="sig-name">{customer?.name}</div>
                                        <div style={{ marginTop: "20px" }}>( Name, Sign & stamp )</div>
                                    </div>
                                </div>

                                <div className="received-condition">
                                    Received in good Condition ( Materials in 100% New Condition )
                                </div>
                            </div>
                        </div>

                        <div className="internal-info-footer">Internal information - Yellow - Mahadasha Group.</div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
