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
    items: {
        id: number
        productId: number
        orderedQuantity: number
        deliveredQuantity: number
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
                <style>
                    @page { size: A4; margin: 10mm; }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: Arial, sans-serif; 
                        font-size: 10pt; 
                        color: #000; 
                        line-height: 1.2;
                    }
                    .container { max-width: 210mm; margin: 0 auto; padding: 10mm; }
                    
                    .internal-info {
                        color: #facc15;
                        font-size: 8pt;
                        text-align: center;
                        margin-bottom: 40px;
                    }
                    
                    .header-section {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                    }
                    
                    .ship-to {
                        width: 55%;
                    }
                    
                    .ship-to-label {
                        font-weight: bold;
                        text-decoration: underline;
                        margin-bottom: 10px;
                        display: block;
                    }
                    
                    .customer-name {
                        font-weight: bold;
                        font-size: 11pt;
                        text-transform: uppercase;
                        margin-bottom: 2px;
                    }
                    
                    .site-info {
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    
                    .address-box {
                        margin-bottom: 10px;
                        font-size: 9pt;
                    }
                    
                    .contact-info {
                        font-size: 9pt;
                    }
                    
                    .do-box {
                        width: 42%;
                        border: 1px solid #000;
                    }
                    
                    .do-header {
                        background-color: #d1d5db;
                        border-bottom: 1px solid #000;
                        padding: 5px 10px;
                        font-weight: bold;
                        letter-spacing: 1px;
                    }
                    
                    .do-details {
                        padding: 10px;
                        font-size: 9pt;
                    }
                    
                    .do-row {
                        display: flex;
                        margin-bottom: 3px;
                    }
                    
                    .do-label {
                        width: 120px;
                    }
                    
                    .do-separator {
                        margin-right: 5px;
                    }
                    
                    .do-value {
                        font-weight: bold;
                    }
                    
                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                        border-top: 2px solid #000;
                        border-bottom: 2px solid #000;
                    }
                    
                    .items-table th {
                        text-align: left;
                        padding: 8px 5px;
                        font-size: 9pt;
                        border-bottom: 1px solid #000;
                    }
                    
                    .items-table td {
                        padding: 10px 5px;
                        font-size: 9pt;
                        vertical-align: top;
                    }
                    
                    .col-item { width: 40px; }
                    .col-qty { width: 80px; text-align: center; }
                    .col-part { width: 120px; }
                    
                    .note-section {
                        margin-top: 60px;
                        font-size: 9pt;
                    }
                    
                    .note-label {
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    
                    .received-condition {
                        margin-top: 40px;
                        font-size: 9pt;
                        border-bottom: 1px solid #000;
                        padding-bottom: 5px;
                        margin-bottom: 20px;
                    }
                    
                    .signature-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        margin-top: 10px;
                        font-size: 9pt;
                    }
                    
                    .sig-box {
                        display: flex;
                        flex-direction: column;
                        height: 120px;
                        justify-content: space-between;
                    }
                    
                    .sig-label {
                        margin-bottom: 10px;
                    }
                    
                    .sig-name {
                        margin-top: auto;
                    }
                    
                    .internal-info-footer {
                        color: #facc15;
                        font-size: 8pt;
                        text-align: center;
                        position: fixed;
                        bottom: 10mm;
                        width: 100%;
                        left: 0;
                    }

                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
                <div class="internal-info-footer">Internal information - Yellow - Mahadasha Group.</div>
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
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

                <div className="p-8 bg-white text-black" ref={printRef}>
                    <div className="container" style={{ padding: "0" }}>
                        <div className="internal-info">Internal information - Yellow - Mahadasha Group.</div>

                        <div className="header-section">
                            <div className="ship-to">
                                <span className="ship-to-label">Ship To:</span>
                                <div className="customer-name">{customer?.name}</div>
                                <div className="site-info">Site : {delivery.warehouse?.description || "-"}</div>
                                <div className="address-box">
                                    {address || delivery.shippingAddress || "-"}
                                </div>
                                <div className="contact-info">
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
                                {delivery.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{(idx + 1).toString().padStart(2, '0')}</td>
                                        <td>
                                            <div style={{ textTransform: "uppercase" }}>
                                                {item.product.materialDescription}
                                            </div>
                                        </td>
                                        <td className="col-qty">
                                            {item.deliveredQuantity} Assy
                                        </td>
                                        <td className="col-part">
                                            {item.product.materialNumber}
                                        </td>
                                    </tr>
                                ))}
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

                        <div className="received-condition">
                            Received in good Condition ( Materials in 100% New Condition )
                        </div>

                        <div className="signature-grid">
                            <div className="sig-box">
                                <div className="sig-label">Delivery by,</div>
                                <div className="sig-name">PT.Chitra Paratama</div>
                                <div style={{ marginTop: "20px" }}>( {delivery.driverName || "          "} )</div>
                            </div>
                            <div className="sig-box">
                                <div className="sig-label">Forwarder by,</div>
                                <div className="sig-name" style={{ textAlign: "center" }}>CP</div>
                                <div style={{ marginTop: "20px", textAlign: "center" }}>( Name, Sign & stamp )</div>
                            </div>
                            <div className="sig-box" style={{ textAlign: "right" }}>
                                <div className="sig-label">Received by,</div>
                                <div className="sig-name">{customer?.name}</div>
                                <div style={{ marginTop: "20px" }}>( Name, Sign & stamp )</div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
