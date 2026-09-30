"use client"

import React, { useMemo, useRef, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X, ImageIcon, Loader2, FileStack } from "lucide-react"
import { toPng } from "html-to-image"
import jsPDF from "jspdf"
import {
    type DeliveryPdfData,
    type PaperSize,
    paginateDeliveryOrder,
    formatDate,
} from "./delivery-pdf-utils"

interface DeliveryBulkPdfProps {
    deliveries: DeliveryPdfData[]
    open: boolean
    onClose: () => void
}

export function DeliveryBulkPdf({ deliveries, open, onClose }: DeliveryBulkPdfProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const pageRefs = useRef<(HTMLDivElement | null)[]>([])
    const [withBackground, setWithBackground] = useState(false)
    const [paperSize, setPaperSize] = useState<PaperSize>("a4")
    const [isGenerating, setIsGenerating] = useState(false)
    const [progress, setProgress] = useState(0)

    // Paginate all deliveries
    const allPages = useMemo(() => {
        const result: Array<{
            delivery: DeliveryPdfData
            page: ReturnType<typeof paginateDeliveryOrder>[0]
            uniqueKey: string
        }> = []

        deliveries.forEach((delivery) => {
            const pages = paginateDeliveryOrder(delivery, {
                paperSize,
                withBackground,
                hasNotes: Boolean(delivery.notes),
                notesLength: delivery.notes?.length || 0,
            })

            pages.forEach((page) => {
                result.push({
                    delivery,
                    page,
                    uniqueKey: `${delivery.id}-p${page.pageNumber}`,
                })
            })
        })

        return result
    }, [deliveries, paperSize, withBackground])

    const pageWidthMm = paperSize === "continuous" ? 215 : 210
    const pageHeightMm = paperSize === "continuous" ? 280 : 297

    const handleDownloadBulkPdf = async () => {
        if (allPages.length === 0) return

        try {
            setIsGenerating(true)
            setProgress(0)

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: paperSize === "continuous" ? [215, 280] : "a4",
            })

            for (let i = 0; i < allPages.length; i++) {
                setProgress(Math.round(((i + 1) / allPages.length) * 100))
                const element = pageRefs.current[i]
                if (!element) continue

                element.style.display = "block"

                const dataUrl = await toPng(element, {
                    quality: 0.9,
                    pixelRatio: 1.5,
                    skipFonts: false,
                    backgroundColor: "#ffffff",
                    width: element.offsetWidth || (paperSize === "continuous" ? 813 : 794),
                    height: element.offsetHeight || (paperSize === "continuous" ? 1058 : 1123),
                })

                if (i > 0) {
                    pdf.addPage(paperSize === "continuous" ? [215, 280] : "a4")
                }

                pdf.addImage(dataUrl, "PNG", 0, 0, pageWidthMm, pageHeightMm)
            }

            setProgress(100)
            pdf.save(`Bulk_Delivery_Orders_${new Date().getTime()}.pdf`)
        } catch (error) {
            console.error("Failed to generate bulk PDF:", error)
        } finally {
            setIsGenerating(false)
            setProgress(0)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="w-[calc(100vw-1rem)] max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto p-0 sm:w-[95vw] sm:max-w-7xl">
                <DialogHeader className="sticky top-0 z-50 border-b bg-background px-4 py-3 sm:px-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <FileStack className="h-5 w-5 text-primary" />
                            Bulk Delivery Orders Preview ({deliveries.length} Dokumen, {allPages.length} Halaman)
                        </DialogTitle>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Paper Format Selector */}
                            <div className="flex items-center rounded-md border bg-muted/40 p-0.5">
                                <Button
                                    variant={paperSize === "a4" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setPaperSize("a4")}
                                    className="h-7 text-xs px-2.5"
                                >
                                    A4 Biasa
                                </Button>
                                <Button
                                    variant={paperSize === "continuous" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setPaperSize("continuous")}
                                    className="h-7 text-xs px-2.5"
                                    title="Kertas Continuous Form / Rangkap 11 Inci"
                                >
                                    Rangkap (11&quot;)
                                </Button>
                            </div>

                            <Button
                                variant={withBackground ? "default" : "outline"}
                                size="sm"
                                onClick={() => setWithBackground(!withBackground)}
                                className={`gap-1.5 h-8 ${withBackground ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                            >
                                <ImageIcon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Kop Surat:</span> {withBackground ? "On" : "Off"}
                            </Button>

                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleDownloadBulkPdf}
                                disabled={isGenerating}
                                className="gap-1.5 h-8"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>Generating ({progress}%)</span>
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-3.5 w-3.5" />
                                        <span>Download PDF Gabungan</span>
                                    </>
                                )}
                            </Button>

                            <Button variant="ghost" size="icon" className="h-8 w-8 ml-1" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="bg-zinc-200/80 p-4 dark:bg-zinc-900 flex flex-col items-center overflow-x-auto min-h-[500px]">
                    <div ref={containerRef} className="space-y-8 flex flex-col items-center w-full">
                        {allPages.map(({ delivery, page, uniqueKey }, idx) => (
                            <div key={uniqueKey} className="flex flex-col items-center w-full">
                                <div className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                                    DO: {delivery.doSap || delivery.deliveryNumber} — Halaman {page.pageNumber} dari {page.totalPages}
                                </div>
                                <div
                                    ref={(el) => {
                                        pageRefs.current[idx] = el
                                    }}
                                    className="w-full flex justify-center"
                                >
                                    <DeliverySinglePageView
                                        delivery={delivery}
                                        page={page}
                                        withBackground={withBackground}
                                        paperSize={paperSize}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DeliverySinglePageView({
    delivery,
    page,
    withBackground,
    paperSize,
}: {
    delivery: DeliveryPdfData
    page: ReturnType<typeof paginateDeliveryOrder>[0]
    withBackground: boolean
    paperSize: PaperSize
}) {
    const customer = delivery.salesOrder?.customer
    const customerAddress = [
        customer?.address1,
        customer?.address2,
        customer?.address3,
        customer?.address4,
        customer?.address5,
    ]
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
            className={`pdf-page relative bg-white shadow-xl transition-all duration-300 ${
                paperSize === "continuous"
                    ? "w-[215mm] h-[280mm] min-h-[280mm] max-h-[280mm]"
                    : "w-[210mm] h-[297mm] min-h-[297mm] max-h-[297mm]"
            }`}
            style={
                withBackground
                    ? {
                          backgroundImage: "url('/ChitraParatama_Stationery_Letterhead_jkt.jpg')",
                          backgroundSize: "cover",
                          backgroundRepeat: "no-repeat",
                      }
                    : {}
            }
        >
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                    .pdf-page { 
                        font-family: Arial, sans-serif; 
                        font-size: 10pt; 
                        color: #000; 
                        line-height: 1.2;
                        box-sizing: border-box;
                    }
                    .pdf-page * { box-sizing: border-box; }
                    .pdf-page .container { 
                        padding: 10mm 20mm; 
                        padding-top: ${withBackground ? "42mm" : "35mm"}; 
                        width: 100%; 
                        max-width: none; 
                        background-color: transparent; 
                        margin: 0; 
                        display: flex; 
                        flex-direction: column; 
                        height: 100%;
                        box-sizing: border-box;
                    }
                    
                    .pdf-page .header-section { display: flex; justify-content: space-between; margin-bottom: 12px; gap: 16px; }
                    .pdf-page .ship-to { width: 48%; }
                    .pdf-page .ship-to-label { font-weight: bold; text-decoration: underline; margin-bottom: 6px; display: block; font-size: 11pt; }
                    .pdf-page .customer-name { font-weight: bold; font-size: 11.5pt; text-transform: uppercase; margin-bottom: 4px; }
                    .pdf-page .site-info { font-weight: normal; margin-bottom: 5px; white-space: pre-line; font-size: 9.5pt; line-height: 1.3; }
                    .pdf-page .do-box { width: 48%; border: 1px solid #000; }
                    .pdf-page .do-header { background-color: #d1d5db; border-bottom: 1px solid #000; padding: 5px 8px; font-weight: bold; letter-spacing: 1px; font-size: 10.5pt; text-align: left; }
                    .pdf-page .do-details { padding: 6px 8px; font-size: 9.5pt; }
                    .pdf-page .do-row { display: flex; margin-bottom: 3px; }
                    .pdf-page .do-label { width: 115px; }
                    .pdf-page .do-separator { margin-right: 5px; }
                    .pdf-page .do-value { font-weight: bold; }
                    
                    .pdf-page .items-table { width: 100%; border-collapse: collapse; margin-top: 8px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
                    .pdf-page .items-table th { text-align: left; padding: 6px 4px; font-size: 9.5pt; font-weight: bold; border-bottom: 1px solid #000; }
                    .pdf-page .items-table td { padding: 6px 4px; font-size: 9.5pt; font-weight: bold; vertical-align: top; }
                    .pdf-page .col-item { width: 35px; }
                    .pdf-page .col-qty { width: 65px; text-align: center; }
                    .pdf-page .col-part { width: 115px; }

                    .pdf-page .serial-grid { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 8px; border: 1px solid #000; }
                    .pdf-page .serial-grid th { background-color: #f3f4f6; border: 1px solid #000; padding: 2px 4px; font-size: 7.5pt; text-align: center; }
                    .pdf-page .serial-grid td { text-align: center; font-size: 7.5pt; padding: 2px 4px; border: 1px solid #000; }
                    .pdf-page .footer-section { margin-top: auto; padding-top: 8px; }
                    .pdf-page .note-section { margin-top: 8px; font-size: 8.5pt; }
                    .pdf-page .note-label { font-weight: bold; margin-bottom: 2px; }
                    .pdf-page .received-condition { font-size: 8pt; line-height: 1.35; margin-bottom: 8px; }
                    .pdf-page .divider-line { border-top: 1px solid #000; margin-bottom: 8px; }
                    
                    .pdf-page .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 10pt; gap: 0; border-collapse: collapse; }
                    .pdf-page .sig-box { display: flex; flex-direction: column; height: 155px; text-align: center; padding: 4px; }
                    .pdf-page .sig-label { margin-bottom: 2px; font-weight: normal; font-size: 9.5pt; }
                    .pdf-page .sig-name { font-weight: normal; margin-bottom: 0px; font-size: 9.5pt; }
                    .pdf-page .sig-placeholder { margin-top: auto; }
                    .pdf-page .sig-bottom-name { margin-top: 4px; font-size: 9.5pt; }
                    .pdf-page .page-corner-indicator {
                        position: absolute;
                        left: 20mm;
                        bottom: 8mm;
                        font-size: 9pt;
                        font-weight: bold;
                        color: #000;
                    }
                    `,
                }}
            />

            <div className="container">
                {/* Header Section */}
                <div className="header-section">
                    <div className="ship-to">
                        <span className="ship-to-label">Ship To:</span>
                        <div className="customer-name">{customer?.name}</div>
                        <div className="site-info">
                            ATTN : {address || "-"}
                        </div>
                    </div>

                    <div className="do-box">
                        <div className="do-header">DELIVERY ORDER</div>
                        <div className="do-details">
                            <div className="do-row">
                                <div className="do-label">Page</div>
                                <div className="do-separator">:</div>
                                <div className="do-value">
                                    {page.pageNumber}/{page.totalPages}
                                </div>
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
                                <div className="do-label">Customer PO</div>
                                <div className="do-separator">:</div>
                                <div className="do-value">{delivery.salesOrder?.customerPo || "-"}</div>
                            </div>
                            <div className="do-row">
                                <div className="do-label">PO Date</div>
                                <div className="do-separator">:</div>
                                <div className="do-value">{formatDate(delivery.salesOrder?.poReceive)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table of items */}
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
                        ) : isPetrosea ? (
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
                                    <th style={{ textAlign: "center", width: "100px" }}>PTRO</th>
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
                        {page.items.length === 0 && (
                            <tr>
                                <td
                                    colSpan={isCiptaKridatama || isPetrosea ? 6 : showCaiColumn ? 5 : 4}
                                    style={{ textAlign: "center", padding: "16px 8px", fontWeight: 600 }}
                                >
                                    {page.pageNumber === 1
                                        ? "Tidak ada item terkirim (Qty 0 tidak ditampilkan)"
                                        : "Kelanjutan dokumen dari halaman sebelumnya"}
                                </td>
                            </tr>
                        )}

                        {page.items.map((slice) => {
                            const item = slice.item
                            const isTyre = slice.isTyre

                            if (isPetrosea) {
                                return (
                                    <React.Fragment key={slice.itemIndex}>
                                        <tr>
                                            <td>{slice.itemIndex.toString().padStart(2, "0")}</td>
                                            <td>
                                                <div style={{ textTransform: "uppercase" }}>
                                                    {item.product.materialDescription}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: "center" }}>
                                                {item.product.materialNumber}
                                            </td>
                                            <td style={{ textAlign: "center" }}>
                                                {item.product.materialNumberPtro || "-"}
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
                                                <td colSpan={6} style={{ padding: "0 4px 10px 35px" }}>
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

                            if (isCiptaKridatama) {
                                return (
                                    <React.Fragment key={slice.itemIndex}>
                                        <tr>
                                            <td>{slice.itemIndex.toString().padStart(2, "0")}</td>
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
                                                <td colSpan={6} style={{ padding: "0 4px 10px 35px" }}>
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
                                <React.Fragment key={slice.itemIndex}>
                                    <tr>
                                        <td>{slice.itemIndex.toString().padStart(2, "0")}</td>
                                        <td>
                                            <div style={{ textTransform: "uppercase" }}>
                                                {item.product.materialDescription}
                                            </div>
                                        </td>
                                        {showCaiColumn && (
                                            <td className="col-part">
                                                {isTyre ? "-" : item.product.oldMaterialNo || "-"}
                                            </td>
                                        )}
                                        <td className="col-qty">
                                            {item.deliveredQuantity}
                                        </td>
                                        <td className="col-part">
                                            {item.product.materialNumber}
                                        </td>
                                    </tr>
                                    {isTyre && (
                                        <tr>
                                            <td colSpan={showCaiColumn ? 5 : 4} style={{ padding: "0 4px 10px 35px" }}>
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

                {/* Continuation Notice for Multi-page documents */}
                {!page.isLastPage && (
                    <div className="mt-2 text-right text-[8.5pt] italic text-zinc-500">
                        -- Bersambung ke Halaman {page.pageNumber + 1} --
                    </div>
                )}

                {/* Footer Section */}
                {page.showSignatures && (
                    <div className="footer-section">
                        <div className="note-section">
                            <div className="note-label">NOTE:</div>
                            {delivery.notes ? (
                                <div style={{ whiteSpace: "pre-line" }}>{delivery.notes}</div>
                            ) : (
                                <div>-</div>
                            )}
                        </div>

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
                                        <div style={{ fontSize: isExternalJne ? "20pt" : "11pt", fontWeight: "bold", marginBottom: "8px" }}>
                                            {delivery.awbNumber || "-"}
                                        </div>
                                    ) : (
                                        <div className="sig-name">
                                            ( {delivery.driverName || "-"} | {delivery.vehicleNumber || "-"} )
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
                )}
            </div>

            {/* Pojok Kiri Bottom-Left Page Indicator */}
            <div className="page-corner-indicator">
                Page {page.pageNumber}/{page.totalPages}
            </div>
        </div>
    )
}
