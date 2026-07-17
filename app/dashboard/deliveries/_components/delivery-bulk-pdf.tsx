"use client"

import React, { useRef, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X, ImageIcon, Loader2, FileStack } from "lucide-react"
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
                        {deliveries.map((delivery) => (
                            <DeliverySingleView 
                                key={delivery.id} 
                                delivery={delivery} 
                                withBackground={withBackground}
                            />
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DeliverySingleView({ delivery, withBackground }: { delivery: DeliveryPdfData, withBackground: boolean }) {
    const customer = delivery.salesOrder?.customer
    const customerAddress = [customer?.address1, customer?.address2, customer?.address3, customer?.address4, customer?.address5]
        .filter(Boolean)
        .join(" ")
    const address = delivery.shippingAddress || customerAddress
    const isCiptaKridatama = customer?.name?.toUpperCase()?.includes("CIPTA KRIDATAMA")
    const isPetrosea = customer?.name?.toUpperCase()?.includes("PETROSEA")
    const printableItems = delivery.items.filter((item) => Number(item.deliveredQuantity) > 0)
    const showCaiColumn = !isCiptaKridatama && !isPetrosea && printableItems.some((item) => item.product.category?.toUpperCase() !== "TYRE")
    const isExternalJne = delivery.isExternal && delivery.vendorName?.toUpperCase().includes("JNE")

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
                .pdf-page .note-section { margin-top: 20px; font-size: 9pt; }
                .pdf-page .note-label { font-weight: bold; margin-bottom: 5px; }
                .pdf-page .received-condition { font-size: 9pt; line-height: 1.5; margin-bottom: 10px; }
                .pdf-page .divider-line { border-top: 1px solid #000; margin-bottom: 15px; }
                
                .pdf-page .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 9pt; gap: 0; border-collapse: collapse; }
                .pdf-page .sig-box { display: flex; flex-direction: column; height: 180px; text-align: center; padding: 5px; }
                .pdf-page .sig-label { margin-bottom: 5px; font-weight: normal; }
                .pdf-page .sig-name { font-weight: normal; margin-bottom: 0px; font-size: 14pt; }
                .pdf-page .sig-placeholder { margin-top: auto; font-size: 8pt; }
                .pdf-page .sig-bottom-name { margin-top: 5px; }
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
                                <div className="do-value" style={{ fontSize: "15pt" }}>{delivery.salesOrder?.customerPo || "-"}</div>
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
                                {showCaiColumn && <th className="col-part">CAI</th>}
                                <th className="col-qty">Qty</th>
                                <th className="col-part">Parts Number</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {printableItems.map((item, idx) => {
                            const isTyre = item.product.category?.toUpperCase() === "TYRE"

                            if (isCiptaKridatama) {
                                return (
                                    <React.Fragment key={idx}>
                                        <tr>
                                            <td>{(idx + 1).toString().padStart(2, '0')}</td>
                                            <td style={{ textTransform: "uppercase" }}>{item.product.materialDescription}</td>
                                            <td style={{ textAlign: "center" }}>{item.product.materialNumber}</td>
                                            <td style={{ textAlign: "center" }}>{item.product.materialNumberCk || "-"}</td>
                                            <td className="col-qty">{item.deliveredQuantity}</td>
                                            <td style={{ textAlign: "center" }}>{item.product.oldMaterialNo || "-"}</td>
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
                                        <td style={{ textTransform: "uppercase" }}>{item.product.materialDescription}</td>
                                        {showCaiColumn && <td className="col-part">{isTyre ? "-" : item.product.oldMaterialNo || "-"}</td>}
                                        <td className="col-qty">{item.deliveredQuantity}</td>
                                        <td className="col-part">{item.product.materialNumber}</td>
                                    </tr>
                                    {isTyre && (
                                        <tr>
                                            <td colSpan={showCaiColumn ? 5 : 4} style={{ padding: "0 5px 15px 45px" }}>
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
                                    <div style={{ fontSize: isExternalJne ? "24pt" : "12pt", fontWeight: "black", marginBottom: "10px" }}>
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
    )
}
