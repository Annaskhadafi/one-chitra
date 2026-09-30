"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, Download, X, ImageIcon, Loader2, FileText } from "lucide-react"
import { toJpeg } from "html-to-image"
import jsPDF from "jspdf"
import {
    type DeliveryPdfData,
    type PaperSize,
    paginateDeliveryOrder,
    formatDate,
} from "./delivery-pdf-utils"

interface DeliveryPdfPreviewProps {
    delivery: DeliveryPdfData
    open: boolean
    onClose: () => void
}

export function DeliveryPdfPreview({ delivery, open, onClose }: DeliveryPdfPreviewProps) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const printContainerRef = useRef<HTMLDivElement>(null)
    const pageRefs = useRef<(HTMLDivElement | null)[]>([])

    const [withBackground, setWithBackground] = useState(false)
    const [paperSize, setPaperSize] = useState<PaperSize>("a4")
    const [isGenerating, setIsGenerating] = useState(false)
    const [downloadProgress, setDownloadProgress] = useState(0)
    const [isMobilePreview, setIsMobilePreview] = useState(false)
    const [mobileScale, setMobileScale] = useState(1)

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

    // Calculate pages with accurate capacity & footer fitting
    const pages = useMemo(() => {
        return paginateDeliveryOrder(delivery, {
            paperSize,
            withBackground,
            hasNotes: Boolean(delivery.notes),
            notesLength: delivery.notes?.length || 0,
        })
    }, [delivery, paperSize, withBackground])

    const pageWidthMm = paperSize === "continuous" ? 215 : 210
    const pageHeightMm = paperSize === "continuous" ? 280 : 297
    const A4_PAGE_WIDTH = 794

    useEffect(() => {
        if (!open) {
            setIsMobilePreview(false)
            setMobileScale(1)
            return
        }

        const updateMobilePreview = () => {
            const mobile = window.innerWidth < 640
            setIsMobilePreview(mobile)

            if (!mobile) {
                setMobileScale(1)
                return
            }

            const viewport = viewportRef.current
            if (!viewport) return

            const nextScale = Math.min(Math.max((viewport.clientWidth - 16) / A4_PAGE_WIDTH, 0.1), 1)
            setMobileScale(nextScale)
        }

        const frame = window.requestAnimationFrame(updateMobilePreview)
        const handleResize = () => {
            window.requestAnimationFrame(updateMobilePreview)
        }

        window.addEventListener("resize", handleResize)
        return () => {
            window.cancelAnimationFrame(frame)
            window.removeEventListener("resize", handleResize)
        }
    }, [open])

    const handleDownloadPdf = async () => {
        if (pages.length === 0) return

        try {
            setIsGenerating(true)
            setDownloadProgress(0)

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: paperSize === "continuous" ? [215, 280] : "a4",
            })

            for (let i = 0; i < pages.length; i++) {
                setDownloadProgress(Math.round(((i + 1) / pages.length) * 100))
                const pageEl = pageRefs.current[i]
                if (!pageEl) continue

                const prevShadow = pageEl.style.boxShadow
                pageEl.style.boxShadow = "none"

                const width = pageEl.offsetWidth || (paperSize === "continuous" ? 813 : 794)
                const height = pageEl.offsetHeight || (paperSize === "continuous" ? 1058 : 1123)

                const dataUrl = await toJpeg(pageEl, {
                    quality: 0.88,
                    pixelRatio: 1.5,
                    cacheBust: true,
                    skipFonts: false,
                    backgroundColor: "#ffffff",
                    canvasWidth: Math.round(width * 1.5),
                    canvasHeight: Math.round(height * 1.5),
                    width,
                    height,
                })

                pageEl.style.boxShadow = prevShadow

                if (i > 0) {
                    pdf.addPage(paperSize === "continuous" ? [215, 280] : "a4")
                }

                pdf.addImage(dataUrl, "JPEG", 0, 0, pageWidthMm, pageHeightMm, undefined, "FAST")
            }

            pdf.save(`Delivery_Order_${delivery.deliveryNumber || "Document"}.pdf`)
        } catch (error) {
            console.error("Failed to generate PDF:", error)
        } finally {
            setIsGenerating(false)
            setDownloadProgress(0)
        }
    }

    const handlePrint = () => {
        const printContainer = printContainerRef.current
        if (!printContainer) return

        const printWindow = window.open("", "_blank")
        if (!printWindow) return

        const origin = window.location.origin
        const letterheadUrl = `${origin}/ChitraParatama_Stationery_Letterhead_jkt.jpg`

        const pagesHtml = pages.map((page, idx) => {
            const pageEl = pageRefs.current[idx]
            if (!pageEl) return ""
            return `<div class="print-page">${pageEl.innerHTML}</div>`
        }).join("\n")

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Delivery Order ${delivery.deliveryNumber || ""}</title>
                <style>
                    @page { 
                        size: ${paperSize === "continuous" ? "215mm 280mm" : "A4"}; 
                        margin: 0; 
                    }
                    * { box-sizing: border-box; }
                    html, body { 
                        margin: 0; 
                        padding: 0; 
                        background-color: white; 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                    }
                    .print-page { 
                        width: ${pageWidthMm}mm;
                        height: ${pageHeightMm}mm;
                        min-height: ${pageHeightMm}mm;
                        max-height: ${pageHeightMm}mm;
                        box-sizing: border-box;
                        background-color: white;
                        position: relative;
                        overflow: hidden;
                        page-break-after: always;
                        break-after: page;
                        margin: 0 auto;
                        font-family: Arial, sans-serif;
                        font-size: 10pt;
                        color: #000;
                        line-height: 1.2;
                        ${withBackground ? `
                            background-image: url('${letterheadUrl}') !important;
                            background-size: 100% 100% !important;
                            background-repeat: no-repeat !important;
                        ` : ""}
                    }
                    .print-page:last-child {
                        page-break-after: auto;
                        break-after: auto;
                    }
                    .container { 
                        padding: 0 20mm; 
                        padding-top: ${withBackground ? "42mm" : "35mm"}; 
                        padding-bottom: 24mm;
                        width: 100%; 
                        display: flex; 
                        flex-direction: column; 
                        height: 100%;
                        box-sizing: border-box; 
                    }
                    .header-section { display: flex; justify-content: space-between; margin-bottom: 12px; gap: 16px; }
                    .ship-to { width: 48%; }
                    .ship-to-label { font-weight: bold; text-decoration: underline; margin-bottom: 6px; display: block; font-size: 11pt; }
                    .customer-name { font-weight: bold; font-size: 11.5pt; text-transform: uppercase; margin-bottom: 4px; }
                    .site-info { font-weight: normal; margin-bottom: 5px; white-space: pre-line; font-size: 9.5pt; line-height: 1.3; }
                    .do-box { width: 48%; border: 1px solid #000; }
                    .do-header { background-color: #d1d5db; border-bottom: 1px solid #000; padding: 5px 8px; font-weight: bold; letter-spacing: 1px; font-size: 10.5pt; text-align: left; }
                    .do-details { padding: 6px 8px; font-size: 9.5pt; }
                    .do-row { display: flex; margin-bottom: 3px; }
                    .do-label { width: 115px; }
                    .do-separator { margin-right: 5px; }
                    .do-value { font-weight: bold; }
                    .items-table { width: 100%; border-collapse: collapse; margin-top: 8px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
                    .items-table th { text-align: left; padding: 6px 4px; font-size: 9.5pt; font-weight: bold; border-bottom: 1px solid #000; }
                    .items-table td { padding: 6px 4px; font-size: 9.5pt; font-weight: bold; vertical-align: top; }
                    .col-item { width: 35px; }
                    .col-qty { width: 65px; text-align: center; }
                    .col-part { width: 115px; }
                    .serial-grid { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 8px; border: 1px solid #000; }
                    .serial-grid th { background-color: #f3f4f6; border: 1px solid #000; padding: 2px 4px; font-size: 7.5pt; text-align: center; }
                    .serial-grid td { text-align: center; font-size: 7.5pt; padding: 2px 4px; border: 1px solid #000; }
                    .footer-section { margin-top: 18px; padding-top: 4px; }
                    .note-section { margin-top: 8px; margin-bottom: 12px; font-size: 8.5pt; }
                    .note-label { font-weight: bold; margin-bottom: 2px; }
                    .received-condition { font-size: 8pt; line-height: 1.35; margin-bottom: 8px; }
                    .divider-line { border-top: 1px solid #000; margin-bottom: 8px; }
                    .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 10pt; gap: 0; border-collapse: collapse; }
                    .sig-box { display: flex; flex-direction: column; height: 155px; text-align: center; border: 0px solid transparent; padding: 4px; }
                    .sig-label { margin-bottom: 2px; font-weight: normal; font-size: 9.5pt; }
                    .sig-name { font-weight: normal; margin-bottom: 0px; font-size: 9.5pt; }
                    .sig-placeholder { margin-top: auto; }
                    .sig-bottom-name { margin-top: 4px; font-size: 9.5pt; }
                    .page-corner-indicator {
                        position: absolute;
                        left: 20mm;
                        bottom: 12mm;
                        font-size: 9pt;
                        font-weight: bold;
                        color: #000;
                    }
                    @media print {
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                ${pagesHtml}
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

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-h-[96vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto bg-zinc-100 p-0 sm:w-[95vw] sm:max-w-7xl">
                <DialogHeader className="sticky top-0 z-20 border-b bg-background px-4 py-3 sm:px-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-2">
                            <DialogTitle className="text-base sm:text-lg">
                                Delivery Order Preview — {delivery.doSap || delivery.deliveryNumber}
                            </DialogTitle>
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                {pages.length} Halaman
                            </span>
                        </div>

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

                            {/* Letterhead Kop Surat Toggle */}
                            <Button
                                variant={withBackground ? "default" : "outline"}
                                size="sm"
                                onClick={() => setWithBackground(!withBackground)}
                                className={`gap-1.5 h-8 ${withBackground ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                            >
                                <ImageIcon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Kop Surat:</span> {withBackground ? "On" : "Off"}
                            </Button>

                            {/* Download PDF Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadPdf}
                                disabled={isGenerating}
                                className="gap-1.5 h-8"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        <span>PDF ({downloadProgress}%)</span>
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-3.5 w-3.5" />
                                        <span>Download PDF</span>
                                    </>
                                )}
                            </Button>

                            {/* Print Button */}
                            <Button size="sm" onClick={handlePrint} className="gap-1.5 h-8">
                                <Printer className="h-3.5 w-3.5" />
                                <span>Print</span>
                            </Button>

                            <Button variant="ghost" size="icon" className="h-8 w-8 ml-1" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div
                    ref={viewportRef}
                    className="h-[calc(100vh-8.5rem)] overflow-y-auto overflow-x-hidden bg-zinc-200/80 p-2 text-black dark:bg-zinc-900 sm:p-6"
                >
                    <div
                        ref={printContainerRef}
                        className={isMobilePreview ? "origin-top mx-auto flex flex-col items-center" : "mx-auto flex flex-col items-center gap-8"}
                        style={{
                            transform: isMobilePreview ? `scale(${mobileScale})` : undefined,
                            width: isMobilePreview ? `${A4_PAGE_WIDTH}px` : undefined,
                        }}
                    >
                        {pages.map((page, pageIdx) => (
                            <div key={page.pageNumber} className="flex flex-col items-center w-full">
                                {pages.length > 1 && (
                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 no-print">
                                        <FileText className="h-3.5 w-3.5" />
                                        <span>Halaman {page.pageNumber} dari {page.totalPages}</span>
                                    </div>
                                )}

                                <div
                                    ref={(el) => {
                                        pageRefs.current[pageIdx] = el
                                    }}
                                    className={`pdf-wrapper relative bg-white shadow-xl transition-all duration-300 ${
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
                                            .pdf-wrapper { 
                                                font-family: Arial, sans-serif; 
                                                font-size: 10pt; 
                                                color: #000; 
                                                line-height: 1.2;
                                                box-sizing: border-box;
                                            }
                                            .pdf-wrapper * { box-sizing: border-box; }
                                            .pdf-wrapper .container { 
                                                padding: 0 20mm; 
                                                padding-top: ${withBackground ? "42mm" : "35mm"}; 
                                                padding-bottom: 24mm;
                                                width: 100%; 
                                                max-width: none; 
                                                background-color: transparent; 
                                                margin: 0; 
                                                display: flex; 
                                                flex-direction: column; 
                                                height: 100%;
                                                box-sizing: border-box;
                                            }
                                            
                                            .pdf-wrapper .header-section { display: flex; justify-content: space-between; margin-bottom: 12px; gap: 16px; }
                                            .pdf-wrapper .ship-to { width: 48%; }
                                            .pdf-wrapper .ship-to-label { font-weight: bold; text-decoration: underline; margin-bottom: 6px; display: block; font-size: 11pt; }
                                            .pdf-wrapper .customer-name { font-weight: bold; font-size: 11.5pt; text-transform: uppercase; margin-bottom: 4px; }
                                            .pdf-wrapper .site-info { font-weight: normal; margin-bottom: 5px; white-space: pre-line; font-size: 9.5pt; line-height: 1.3; }
                                            
                                            .pdf-wrapper .do-box { width: 48%; border: 1px solid #000; }
                                            .pdf-wrapper .do-header { background-color: #d1d5db; border-bottom: 1px solid #000; padding: 5px 8px; font-weight: bold; letter-spacing: 1px; font-size: 10.5pt; text-align: left; }
                                            .pdf-wrapper .do-details { padding: 6px 8px; font-size: 9.5pt; }
                                            .pdf-wrapper .do-row { display: flex; margin-bottom: 3px; }
                                            .pdf-wrapper .do-label { width: 115px; }
                                            .pdf-wrapper .do-separator { margin-right: 5px; }
                                            .pdf-wrapper .do-value { font-weight: bold; }
                                            
                                            .pdf-wrapper .items-table { width: 100%; border-collapse: collapse; margin-top: 8px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
                                            .pdf-wrapper .items-table th { text-align: left; padding: 6px 4px; font-size: 9.5pt; font-weight: bold; border-bottom: 1px solid #000; }
                                            .pdf-wrapper .items-table td { padding: 6px 4px; font-size: 9.5pt; font-weight: bold; vertical-align: top; }
                                            .pdf-wrapper .col-item { width: 35px; }
                                            .pdf-wrapper .col-qty { width: 65px; text-align: center; }
                                            .pdf-wrapper .col-part { width: 115px; }

                                            .pdf-wrapper .serial-grid { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 8px; border: 1px solid #000; }
                                            .pdf-wrapper .serial-grid th { background-color: #f3f4f6; border: 1px solid #000; padding: 2px 4px; font-size: 7.5pt; text-align: center; }
                                            .pdf-wrapper .serial-grid td { text-align: center; font-size: 7.5pt; padding: 2px 4px; border: 1px solid #000; }
                                            
                                            .pdf-wrapper .footer-section { margin-top: 18px; padding-top: 4px; }
                                            .pdf-wrapper .note-section { margin-top: 8px; margin-bottom: 12px; font-size: 8.5pt; }
                                            .pdf-wrapper .note-label { font-weight: bold; margin-bottom: 2px; }
                                            .pdf-wrapper .received-condition { font-size: 8pt; line-height: 1.35; margin-bottom: 8px; }
                                            .pdf-wrapper .divider-line { border-top: 1px solid #000; margin-bottom: 8px; }
                                            
                                            .pdf-wrapper .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 10pt; gap: 0; border-collapse: collapse; }
                                            .pdf-wrapper .sig-box { display: flex; flex-direction: column; height: 155px; text-align: center; border: 0px solid transparent; padding: 4px; }
                                            .pdf-wrapper .sig-label { margin-bottom: 2px; font-weight: normal; font-size: 9.5pt; }
                                            .pdf-wrapper .sig-name { font-weight: normal; margin-bottom: 0px; font-size: 9.5pt; }
                                            .pdf-wrapper .sig-placeholder { margin-top: auto; }
                                            .pdf-wrapper .sig-bottom-name { margin-top: 4px; font-size: 9.5pt; }

                                            .pdf-wrapper .page-corner-indicator {
                                                position: absolute;
                                                left: 20mm;
                                                bottom: 12mm;
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

                                        {/* Items Table */}
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

                                        {/* Footer Section (Signatures & Notes) */}
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
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
