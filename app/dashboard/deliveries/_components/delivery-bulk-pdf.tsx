"use client"

import React, { useRef, useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, Download, X, ImageIcon, Loader2, FileStack } from "lucide-react"
import type { Product, Warehouse, Customer } from "@/lib/types"
import { toPng } from "html-to-image"
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

interface DeliveryBulkPdfProps {
    deliveries: DeliveryPdfData[]
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

export function DeliveryBulkPdf({ deliveries, open, onClose }: DeliveryBulkPdfProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [withBackground, setWithBackground] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [progress, setProgress] = useState(0)

    const handleDownloadBulkPdf = async () => {
        if (!containerRef.current || deliveries.length === 0) return

        try {
            setIsGenerating(true)
            setProgress(0)

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            })

            const children = containerRef.current.children
            
            for (let i = 0; i < deliveries.length; i++) {
                setProgress(Math.round(((i) / deliveries.length) * 100))
                const element = children[i] as HTMLElement
                
                // Ensure element is visible for capture
                element.style.display = 'block'
                
                const dataUrl = await toPng(element, {
                    quality: 1,
                    pixelRatio: 2,
                    skipFonts: false,
                })

                if (i > 0) pdf.addPage()

                const imgProps = pdf.getImageProperties(dataUrl)
                const pdfWidth = pdf.internal.pageSize.getWidth()
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

                pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
                
                // Hide again if we want to keep them hidden during normal view
                // element.style.display = 'none'
            }

            setProgress(100)
            pdf.save(`Bulk_Delivery_Orders_${new Date().getTime()}.pdf`)
        } catch (error) {
            console.error('Failed to generate bulk PDF:', error)
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="w-[calc(100vw-1rem)] max-h-[90vh] max-w-[calc(100vw-1rem)] overflow-y-auto p-0 sm:w-[95vw] sm:max-w-7xl">
                <DialogHeader className="sticky top-0 z-50 border-b bg-background px-4 py-4 sm:px-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <FileStack className="h-5 w-5 text-primary" />
                            Bulk Delivery order Preview ({deliveries.length} Dokumen)
                        </DialogTitle>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <Button 
                                variant={withBackground ? "default" : "outline"} 
                                size="sm" 
                                onClick={() => setWithBackground(!withBackground)} 
                                className={`w-full gap-2 sm:w-auto ${withBackground ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                            >
                                <ImageIcon className="h-3.5 w-3.5" />
                                {withBackground ? "Pakai Kop Surat" : "Tanpa Kop Surat"}
                            </Button>
                            <Button 
                                variant="default" 
                                size="sm" 
                                onClick={handleDownloadBulkPdf} 
                                disabled={isGenerating}
                                className="w-full gap-2 sm:w-auto"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Generating ({progress}%)
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-3.5 w-3.5" />
                                        Download 1 PDF Besar
                                    </>
                                )}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="bg-zinc-100 p-4 dark:bg-zinc-800 space-y-8 flex flex-col items-center overflow-x-auto min-h-[500px]">
                    <div ref={containerRef} className="space-y-8 flex flex-col items-center w-full">
                        {deliveries.map((delivery, index) => (
                            <DeliverySingleView 
                                key={delivery.id} 
                                delivery={delivery} 
                                withBackground={withBackground} 
                                pageNumber={index + 1}
                                totalPages={deliveries.length}
                            />
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DeliverySingleView({ delivery, withBackground, pageNumber, totalPages }: { delivery: DeliveryPdfData, withBackground: boolean, pageNumber: number, totalPages: number }) {
    const customer = delivery.salesOrder?.customer
    const customerAddress = [customer?.address1, customer?.address2, customer?.address3, customer?.address4, customer?.address5]
        .filter(Boolean)
        .join(" ")
    const address = delivery.shippingAddress || customerAddress
    const isCiptaKridatama = customer?.name?.toUpperCase()?.includes("CIPTA KRIDATAMA")
    const printableItems = delivery.items.filter((item) => Number(item.deliveredQuantity) > 0)

    return (
        <div 
            className={`pdf-page relative bg-white shadow-xl transition-all duration-300 ${withBackground ? 'w-[210mm] min-h-[297mm]' : 'w-[220mm] min-h-[280mm]'}`}
            style={withBackground ? {
                backgroundImage: "url('/ChitraParatama_Stationery_Letterhead_jkt.jpg')",
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
            } : {}}
        >
            <style dangerouslySetInnerHTML={{
                __html: `
                .pdf-page { 
                    font-family: Arial, sans-serif; 
                    font-size: 10pt; 
                    color: #000; 
                    line-height: 1.2;
                    padding-bottom: 10mm;
                    box-sizing: border-box;
                }
                .pdf-page * { box-sizing: border-box; }
                .pdf-page .container { padding: 10mm 20mm; padding-top: ${withBackground ? '42mm' : '45mm'}; width: 100%; max-width: none; background-color: transparent; margin: 0; display: flex; flex-direction: column; min-height: ${withBackground ? '245mm' : '225mm'}; }
                
                .pdf-page .header-section { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 20px; }
                .pdf-page .ship-to { width: 45%; margin-top: 0mm; }
                .pdf-page .ship-to-label { font-weight: bold; text-decoration: underline; margin-bottom: 10px; display: block; font-size: 11pt; }
                .pdf-page .customer-name { font-weight: bold; font-size: 12pt; text-transform: uppercase; margin-bottom: 4px; }
                .pdf-page .site-info { font-weight: bold; margin-bottom: 5px; white-space: pre-line; font-size: 10pt; line-height: 1.4; }
                .pdf-page .address-box { margin-bottom: 10px; font-size: 10pt; }
                .pdf-page .do-box { width: 50%; border: 1px solid #000; }
                .pdf-page .do-header { background-color: #d1d5db; border-bottom: 1px solid #000; padding: 6px 10px; font-weight: bold; letter-spacing: 1px; font-size: 11pt; }
                .pdf-page .do-details { padding: 10px; font-size: 10pt; }
                .pdf-page .do-row { display: flex; margin-bottom: 4px; }
                .pdf-page .do-label { width: 120px; }
                .pdf-page .do-separator { margin-right: 5px; }
                .pdf-page .do-value { font-weight: bold; }
                
                .pdf-page .items-table { width: 100%; border-collapse: collapse; margin-top: 20px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
                .pdf-page .items-table th { text-align: left; padding: 8px 5px; font-size: 10pt; font-weight: bold; border-bottom: 1px solid #000; }
                .pdf-page .items-table td { padding: 10px 5px; font-size: 10pt; font-weight: bold; vertical-align: top; }
                .pdf-page .col-item { width: 40px; }
                .pdf-page .col-qty { width: 80px; text-align: center; }
                .pdf-page .col-part { width: 120px; }

                .pdf-page .serial-grid { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; border: 1px solid #000; }
                .pdf-page .serial-grid th { background-color: #f3f4f6; border: 1px solid #000; padding: 4px; font-size: 8pt; text-align: center; }
                .pdf-page .footer-section { margin-top: auto; padding-top: 20px; }
                .pdf-page .divider-line { border-top: 1px solid #000; margin-bottom: 15px; }
                
                .pdf-page .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 9pt; gap: 0; border-collapse: collapse; }
                .pdf-page .sig-box { display: flex; flex-direction: column; height: 180px; text-align: center; padding: 5px; }
                .pdf-page .sig-placeholder { margin-top: auto; font-size: 8pt; }
                `
            }} />

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
                                <div className="do-value">{pageNumber} / {totalPages}</div>
                            </div>
                            <div className="do-row">
                                <div className="do-label">Delivery No</div>
                                <div className="do-separator">:</div>
                                <div className="do-value">{delivery.doSap || delivery.deliveryNumber}</div>
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
                        {printableItems.map((item, idx) => (
                            <tr key={idx}>
                                <td>{(idx + 1).toString().padStart(2, '0')}</td>
                                <td style={{ textTransform: "uppercase" }}>{item.product.materialDescription}</td>
                                {isCiptaKridatama ? (
                                    <>
                                        <td style={{ textAlign: "center" }}>{item.product.materialNumber}</td>
                                        <td style={{ textAlign: "center" }}>{item.product.materialNumberCk || "-"}</td>
                                    </>
                                ) : null}
                                <td className="col-qty">{item.deliveredQuantity}</td>
                                {!isCiptaKridatama && <td className="col-part">{item.product.materialNumber}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="footer-section">
                    <div className="divider-line" />
                    <div className="signature-grid">
                        <div className="sig-box">
                            <div>Delivery by,</div>
                            <div style={{ fontWeight: 'bold' }}>PT.Chitra Paratama</div>
                            <div className="sig-placeholder">( {delivery.createdByUser?.name || "          "} )</div>
                        </div>
                        <div className="sig-box">
                            <div>Forwarder By,</div>
                            <div className="sig-placeholder">
                                ( {delivery.driverName || "-"} | {delivery.vehicleNumber || "-"})
                            </div>
                        </div>
                        <div className="sig-box">
                            <div>Received by,</div>
                            <div style={{ fontWeight: 'bold' }}>{customer?.name}</div>
                            <div className="sig-placeholder">( Name ,Sign & stamp )</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
