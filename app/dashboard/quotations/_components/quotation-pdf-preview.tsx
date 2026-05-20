"use client"

import { useEffect, useRef, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer, X, FileDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Customer, Product } from "@/lib/types"
import type { user } from "@/db/schema"
import type { InferSelectModel } from "drizzle-orm"
import { normalizeQuotationText } from "@/lib/quotation-text"
import { buildQuotationPdfPayload } from "./quotation-pdf-generator"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"

type User = InferSelectModel<typeof user>

interface QuotationPdfData {
    id: number
    quotationNumber: string | null
    currentRevision: number
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
        product: Product | null
    }[]
    attachments?: {
        id: number
        title: string
        fileName: string
        fileUrl: string
        mimeType: string | null
        kind: string
        includeInPdf: boolean
        description?: string | null
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

function formatNumber(value: number) {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
}

function getItemLabel(item: QuotationPdfData["items"][number]) {
    return item.description || item.product?.materialDescription || item.product?.materialNumber || "Unnamed item"
}

function isImageAttachment(attachment: NonNullable<QuotationPdfData["attachments"]>[number]) {
    const mimeType = attachment.mimeType?.toLowerCase() ?? ""
    const extension = attachment.fileName.split(".").pop()?.toLowerCase() ?? ""

    return mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension)
}

export function QuotationPdfPreview({ quotation, open, onClose }: QuotationPdfPreviewProps) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const printRef = useRef<HTMLDivElement>(null)
    const [isMobilePreview, setIsMobilePreview] = useState(false)
    const [mobileScale, setMobileScale] = useState(1)
    const [mobileScaledHeight, setMobileScaledHeight] = useState<number | null>(null)
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
    const A4_PAGE_WIDTH = 794
    const A4_PAGE_HEIGHT = 1123

    const ITEMS_FIRST_PAGE = 5
    const ITEMS_SUBSEQUENT_PAGES = 5

    const itemsSubtotal = quotation.items.reduce((sum, item) => {
        return sum + (item.quantity * Number(item.unitPrice) - Number(item.discount || 0))
    }, 0)


    const discountAmount = quotation.discountType === "percent"
        ? (itemsSubtotal * Number(quotation.discount)) / 100
        : Number(quotation.discount)


    const subtotalAfterDiscount = itemsSubtotal - discountAmount
    const itemTaxTotal = quotation.items.reduce((sum, item) => sum + Number(item.tax || 0), 0)
    const taxAmount = itemTaxTotal > 0
        ? (itemTaxTotal / itemsSubtotal) * subtotalAfterDiscount
        : (Number(quotation.tax) > 0 ? subtotalAfterDiscount * 0.11 : 0)
    const grandTotal = subtotalAfterDiscount + taxAmount + Number(quotation.shipping)
    const recipientAddressLines = [
        quotation.customer.address1,
        quotation.customer.address2,
        quotation.customer.address3,
    ].filter(Boolean)
    const visibleAttachments = quotation.attachments
        ?.filter((attachment) => attachment.includeInPdf && isImageAttachment(attachment))
        .slice(0, 4) ?? []

    // Helper to paginate items
    const paginateItems = () => {
        const pages = []
        let currentItems = [...quotation.items]

        // First page
        pages.push(currentItems.slice(0, ITEMS_FIRST_PAGE))
        currentItems = currentItems.slice(ITEMS_FIRST_PAGE)

        // Subsequent pages
        while (currentItems.length > 0) {
            pages.push(currentItems.slice(0, ITEMS_SUBSEQUENT_PAGES))
            currentItems = currentItems.slice(ITEMS_SUBSEQUENT_PAGES)
        }

        // If no items at all, still need at least one page for header/meta
        if (pages.length === 0) pages.push([])

        return pages
    }

    const pages = paginateItems()

    useEffect(() => {
        if (!open) {
            setMobileScale(1)
            setMobileScaledHeight(null)
            return
        }

        const updateMobilePreview = () => {
            const mobile = window.innerWidth < 640
            setIsMobilePreview(mobile)

            if (!mobile) {
                setMobileScale(1)
                setMobileScaledHeight(null)
                return
            }

            const source = printRef.current
            const viewport = viewportRef.current
            if (!source || !viewport) return

            const nextScale = Math.min(Math.max((viewport.clientWidth - 8) / A4_PAGE_WIDTH, 0.1), 1)
            const sourceHeight = Math.max(source.scrollHeight, A4_PAGE_HEIGHT)

            setMobileScale(nextScale)
            setMobileScaledHeight(sourceHeight * nextScale)
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
    }, [open, quotation])

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
                    @page { size: A4; margin: 0; }
                    * { box-sizing: border-box; }
                    html, body { margin: 0; padding: 0; background: #ffffff; }
                    body { font-family: Arial, Helvetica, sans-serif; color: #163153; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .print-pages-container { width: 100%; display: flex; flex-direction: column; align-items: center; }
                    .print-page { width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always; background: white; }
                    @media print {
                        .print-page { page-break-after: always; }
                        .print-page:last-child { page-break-after: auto; }
                    }
                    .bg-letterhead { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; pointer-events: none; }
                    .page-content { position: relative; z-index: 10; padding: 14mm 15mm 22mm 15mm; height: 100%; display: flex; flex-direction: column; }
                </style>
            </head>
            <body>
                <div class="print-pages-container">${printContent.innerHTML}</div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.focus()

        const images = Array.from(printWindow.document.images)
        const waitForImages = Promise.all(
            images.map((img) => {
                if (img.complete) {
                    return Promise.resolve()
                }

                return new Promise<void>((resolve) => {
                    const done = () => resolve()
                    img.addEventListener("load", done, { once: true })
                    img.addEventListener("error", done, { once: true })
                })
            })
        )

        Promise.race([
            waitForImages,
            new Promise((resolve) => setTimeout(resolve, 1500)),
        ]).finally(() => {
            printWindow.print()
        })
    }

    const handleDownloadPdf = async () => {
        if (isDownloadingPdf) {
            return
        }

        setIsDownloadingPdf(true)
        toast.info("Sedang menyiapkan PDF A4...")

        try {
            const { generateQuotationPdf } = await import("./quotation-pdf-generator")
            await generateQuotationPdf(buildQuotationPdfPayload(quotation), { mergeAttachments: visibleAttachments.length > 0 })
        } catch (error) {
            console.error("Failed to download quotation preview PDF:", error)
            toast.error(error instanceof Error ? error.message : "Download PDF A4 gagal")
        } finally {
            setIsDownloadingPdf(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-h-[95vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto bg-slate-100 p-0 sm:max-w-7xl">
                <DialogHeader className="no-print sticky top-0 z-50 border-b bg-background px-4 py-4 sm:px-6">
                    <DialogDescription className="sr-only">
                        Preview quotation PDF with multi-page A4 layout.
                    </DialogDescription>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <DialogTitle className="pr-10 text-base sm:text-lg">Quotation Preview</DialogTitle>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <Button size="sm" onClick={handlePrint} className="w-full gap-2 bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
                                <Printer className="h-3.5 w-3.5" />
                                Browser Print
                            </Button>
                            <Button size="sm" onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="w-full gap-2 sm:w-auto" variant="outline">
                                {isDownloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                                {isDownloadingPdf ? "Preparing PDF..." : "Download PDF A4"}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div 
                    ref={viewportRef} 
                    className="flex flex-col items-center gap-8 bg-slate-100 p-4 sm:p-8 overflow-y-auto h-[calc(100vh-10rem)] scrollbar-thin scrollbar-thumb-slate-300"
                >
                    <div
                        ref={printRef}
                        className={isMobilePreview ? "origin-top flex flex-col items-center gap-6" : "flex flex-col items-center gap-8"}
                        style={{
                            transform: isMobilePreview ? `scale(${mobileScale})` : undefined,
                            width: isMobilePreview ? `${A4_PAGE_WIDTH}px` : "100%",
                        }}
                    >
                        {pages.map((pageItems, pageIndex) => {
                            const isFirstPage = pageIndex === 0
                            const isLastPage = pageIndex === pages.length - 1
                            const itemStartIndex = pages.slice(0, pageIndex).reduce((acc, p) => acc + p.length, 0)

                            return (
                                <div
                                    key={pageIndex}
                                    className="print-page relative bg-white shadow-2xl ring-1 ring-slate-200"
                                    style={{
                                        width: "210mm",
                                        height: "297mm",
                                        minWidth: "210mm",
                                        minHeight: "297mm",
                                        position: "relative",
                                        overflow: "hidden",
                                        background: "#ffffff",
                                        color: "#163153",
                                        fontFamily: "Arial, Helvetica, sans-serif",
                                        lineHeight: "1.35",
                                        pageBreakAfter: isLastPage ? "auto" : "always",
                                        flexShrink: 0
                                    }}
                                >
                                    {/* Letterhead Background on EVERY page */}
                                    <img
                                        src="/ChitraParatama_Stationery_Letterhead_jkt.jpg"
                                        alt=""
                                        className="bg-letterhead pointer-events-none absolute inset-0 h-full w-full select-none"
                                        style={{ objectFit: "cover", zIndex: 0 }}
                                    />

                                    <div className="page-content relative z-10 px-[15mm] pb-[25mm] pt-[14mm] flex flex-col h-full">
                                        {/* HEADER - Only on Page 1 */}
                                        {isFirstPage && (
                                            <>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: "12mm", alignItems: "flex-start" }}>
                                                    <div style={{ width: "92mm" }}>
                                                        <div style={{ height: "28mm" }} />
                                                        <div style={{ fontSize: "14pt", fontWeight: 700, color: "#0f172a", marginBottom: "2.5mm" }}>
                                                            PT Chitra Paratama
                                                        </div>
                                                        <div style={{ fontSize: "9pt", color: "#64748b", maxWidth: "82mm", whiteSpace: "pre-line", lineHeight: 1.35 }}>
                                                            {quotation.address || "Jl. Amd No.69 Karang Joang Kec. Balikpapan Utara\nKota Balikpapan Kalimantan Timur 7612"}
                                                        </div>
                                                    </div>

                                                    <div style={{ width: "74mm", textAlign: "right" }}>
                                                        <div style={{ fontSize: "24pt", fontWeight: 700, color: "#2563eb", marginBottom: "2mm" }}>
                                                            QUOTATION
                                                        </div>
                                                        <div style={{ fontSize: "11pt", color: "#334155", fontWeight: 700, marginBottom: "7mm" }}>
                                                            {quotation.quotationNumber || "DRAFT"}{quotation.currentRevision ? ` | Rev.${quotation.currentRevision}` : ""}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: "4mm", borderTop: "1px solid #2563eb" }} />

                                                <div
                                                    style={{
                                                        marginTop: "6mm",
                                                        border: "1px solid #e2e8f0",
                                                        borderRadius: "1.5mm",
                                                        background: "rgba(248, 250, 252, 0.8)",
                                                        padding: "3.5mm 4mm",
                                                        display: "grid",
                                                        gridTemplateColumns: "1fr 1fr",
                                                        columnGap: "8mm",
                                                    }}
                                                >
                                                    <div style={{ borderRight: "1px solid #e2e8f0", paddingRight: "4mm" }}>
                                                        <div style={{ display: "grid", gridTemplateColumns: "24mm 1fr", rowGap: "1.5mm", fontSize: "7.5pt" }}>
                                                            <div style={{ color: "#64748b", fontWeight: 700 }}>QUO DATE:</div>
                                                            <div style={{ color: "#0f172a", fontWeight: 700 }}>{formatDate(quotation.quotationDate)}</div>
                                                            <div style={{ color: "#64748b", fontWeight: 700 }}>VALIDITY QUOTE:</div>
                                                            <div style={{ color: "#0f172a", fontWeight: 700 }}>{quotation.validUntil ? formatDate(quotation.validUntil) : "-"}</div>
                                                            <div style={{ color: "#64748b", fontWeight: 700 }}>FROM:</div>
                                                            <div style={{ color: "#0f172a", fontWeight: 700 }}>{quotation.salesPerson?.name || "-"}</div>
                                                            <div style={{ color: "#64748b", fontWeight: 700 }}>ATTN:</div>
                                                            <div style={{ color: "#0f172a", fontWeight: 700 }}>{quotation.attn || "-"}</div>
                                                        </div>
                                                    </div>

                                                    <div style={{ textAlign: "right" }}>
                                                        <div style={{ fontSize: "7.5pt", color: "#2563eb", fontWeight: 700, marginBottom: "1.5mm" }}>TO</div>
                                                        <div style={{ fontSize: "9pt", color: "#0f172a", fontWeight: 700, marginBottom: "1mm" }}>
                                                            <div style={{ textTransform: "uppercase" }}>{quotation.customer.name}</div>
                                                        </div>
                                                        <div style={{ fontSize: "8pt", color: "#475569", whiteSpace: "pre-line", lineHeight: 1.25 }}>
                                                            {recipientAddressLines.length > 0 ? (
                                                                recipientAddressLines.join("\n")
                                                            ) : (
                                                                "-"
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* TABLE HEADER CONTINUITY - On Page 2+ added padding if needed */}
                                        {!isFirstPage && (
                                            <div style={{ height: "32mm" }} /> 
                                        )}

                                        {/* ITEMS TABLE */}
                                        <div style={{ flexGrow: 1, marginTop: isFirstPage ? "5mm" : "0mm" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                <thead>
                                                    <tr style={{ background: "#3b5998", color: "#ffffff" }}>
                                                        <th style={{ width: "15mm", padding: "3.5mm 3mm", fontSize: "9pt", fontWeight: 700, textAlign: "center" }}>#</th>
                                                        <th style={{ padding: "3.5mm 4mm", fontSize: "9pt", fontWeight: 700, textAlign: "left" }}>ITEM</th>
                                                        <th style={{ width: "18mm", padding: "3.5mm 3mm", fontSize: "9pt", fontWeight: 700, textAlign: "center" }}>QTY</th>
                                                        <th style={{ width: "30mm", padding: "3.5mm 4mm", fontSize: "9pt", fontWeight: 700, textAlign: "right" }}>PRICE</th>
                                                        <th style={{ width: "35mm", padding: "3.5mm 4mm", fontSize: "9pt", fontWeight: 700, textAlign: "right" }}>AMOUNT</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pageItems.map((item, idx) => {
                                                        const lineAmount = item.quantity * Number(item.unitPrice)
                                                        const globalIndex = itemStartIndex + idx + 1

                                                        return (
                                                            <tr key={item.id || idx} style={{ verticalAlign: "top", background: idx % 2 === 1 ? "#f8fafc" : "#ffffff" }}>
                                                                <td style={{ padding: "2.5mm 3mm", fontSize: "8.5pt", color: "#475569", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>{globalIndex}</td>
                                                                <td style={{ padding: "2.5mm 4mm", fontSize: "8.5pt", color: "#0f172a", borderBottom: "1px solid #e2e8f0" }}>
                                                                    <div style={{ fontWeight: 700 }}>{getItemLabel(item)}</div>
                                                                    {item.longDescription ? (
                                                                        <div style={{ fontStyle: "italic", color: "#64748b", fontSize: "7.5pt", marginTop: "0.5mm", whiteSpace: "pre-wrap", maxWidth: "80mm", lineHeight: 1.2 }}>
                                                                            {item.longDescription}
                                                                        </div>
                                                                    ) : null}
                                                                </td>
                                                                <td style={{ padding: "2.5mm 3mm", fontSize: "8.5pt", color: "#0f172a", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>{item.quantity}</td>
                                                                <td style={{ padding: "2.5mm 4mm", fontSize: "8.5pt", color: "#0f172a", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>{formatNumber(Number(item.unitPrice))}</td>
                                                                <td style={{ padding: "2.5mm 4mm", fontSize: "8.5pt", color: "#0f172a", textAlign: "right", borderBottom: "1px solid #e2e8f0" }}>{formatNumber(lineAmount)}</td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* TOTALS & TERMS - Only on Last Page */}
                                        {isLastPage && (
                                            <div style={{ marginTop: "auto", paddingBottom: "10mm" }}>
                                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4mm" }}>
                                                    <div style={{ width: "65mm" }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8.5pt", fontWeight: 700, color: "#475569", marginBottom: "1.5mm" }}>
                                                            <span>Sub Total</span>
                                                            <span>{formatCurrency(itemsSubtotal, quotation.currency)}</span>
                                                        </div>
                                                        {discountAmount > 0 ? (
                                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8.5pt", color: "#475569", marginBottom: "1.5mm" }}>
                                                                <span>Discount {quotation.discountType === "percent" ? `(${quotation.discount}%)` : ""}</span>
                                                                <span style={{ color: "#ef4444" }}>-{formatCurrency(discountAmount, quotation.currency)}</span>
                                                            </div>
                                                        ) : null}
                                                        {taxAmount > 0 ? (
                                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8.5pt", color: "#475569", marginBottom: "1.5mm" }}>
                                                                <span>Tax (PPN)</span>
                                                                <span>{formatCurrency(taxAmount, quotation.currency)}</span>
                                                            </div>
                                                        ) : null}
                                                        <div
                                                            style={{
                                                                marginTop: "2mm",
                                                                display: "flex",
                                                                justifyContent: "space-between",
                                                                alignItems: "center",
                                                                background: "#2563eb",
                                                                color: "#ffffff",
                                                                padding: "2.5mm 3.5mm",
                                                                fontSize: "10pt",
                                                                fontWeight: 700,
                                                                borderRadius: "1mm"
                                                            }}
                                                        >
                                                            <span>TOTAL</span>
                                                            <span>{formatCurrency(grandTotal, quotation.currency)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: "4mm", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10mm" }}>
                                                    <div
                                                        style={{
                                                            width: "100%",
                                                            maxWidth: "135mm",
                                                            background: "rgba(248, 250, 252, 0.7)",
                                                            border: "1px solid #dde6f0",
                                                            padding: "3mm",
                                                            borderRadius: "1mm"
                                                        }}
                                                    >
                                                        <div style={{ fontSize: "8pt", fontWeight: 700, color: "#1e293b", marginBottom: "1.5mm", borderBottom: "1px solid #e2e8f0", paddingBottom: "1mm" }}>TERMS & CONDITIONS</div>
                                                        <div style={{ fontSize: "7pt", color: "#475569", lineHeight: 1.35, whiteSpace: "pre-line" }}>
                                                            {[normalizeQuotationText(quotation.clientNote), normalizeQuotationText(quotation.termsConditions)].filter(Boolean).join("\n\n") || "-"}
                                                        </div>
                                                    </div>
                                                </div>

                                                {visibleAttachments.length > 0 && (
                                                    <div
                                                        style={{
                                                            marginTop: "6mm",
                                                            background: "#f8fafc",
                                                            border: "1px solid #e2e8f0",
                                                            padding: "3mm 4mm",
                                                            borderRadius: "1mm"
                                                        }}
                                                    >
                                                        <div style={{ fontSize: "8.5pt", fontWeight: 700, color: "#1e293b", marginBottom: "1mm" }}>
                                                            ATTACHMENT PACKAGE
                                                        </div>
                                                        <div style={{ fontSize: "8pt", color: "#64748b" }}>
                                                            {visibleAttachments.map((attachment, idx) => (
                                                                <span key={attachment.id}>{idx + 1}. {attachment.title}{idx < visibleAttachments.length - 1 ? ", " : ""}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}

                        {/* Rendering Lampiran sebagai Halaman A4 Tambahan dengan Grid 2x2 */}
                        {(() => {
                            // Group attachments into pages of 4 per page
                            const pages: typeof visibleAttachments[] = []
                            for (let i = 0; i < visibleAttachments.length; i += 4) {
                                pages.push(visibleAttachments.slice(i, i + 4))
                            }
                            return pages.map((pageAttachments, pageIdx) => (
                                <div
                                    key={`attachment-page-${pageIdx}`}
                                    className="print-page relative bg-white shadow-2xl ring-1 ring-slate-200"
                                    style={{
                                        width: "210mm",
                                        height: "297mm",
                                        minWidth: "210mm",
                                        minHeight: "297mm",
                                        position: "relative",
                                        overflow: "hidden",
                                        background: "#ffffff",
                                        color: "#163153",
                                        fontFamily: "Arial, Helvetica, sans-serif",
                                        lineHeight: "1.35",
                                        pageBreakBefore: "always",
                                        flexShrink: 0
                                    }}
                                >
                                    {/* Letterhead Background */}
                                    <img
                                        src="/ChitraParatama_Stationery_Letterhead_jkt.jpg"
                                        alt=""
                                        className="bg-letterhead pointer-events-none absolute inset-0 h-full w-full select-none"
                                        style={{ objectFit: "cover", zIndex: 0 }}
                                    />

                                    <div className="page-content relative z-10 px-[15mm] pb-[18mm] pt-[14mm] flex flex-col h-full">
                                        {/* Spacing A4 Header */}
                                        <div style={{ height: "32mm" }} />

                                        {/* Header Halaman Lampiran */}
                                        <div style={{ marginBottom: "5mm", borderBottom: "2px solid #2563eb", paddingBottom: "2mm", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <div style={{ fontSize: "11pt", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
                                                LAMPIRAN PENDUKUNG
                                            </div>
                                            <div style={{ fontSize: "8pt", color: "#64748b" }}>
                                                Halaman {pageIdx + 1} dari {pages.length}
                                            </div>
                                        </div>

                                        {/* Grid 2-kolom x 2-baris attachment */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "4mm", flex: 1, minHeight: 0 }}>
                                            {pageAttachments.map((attachment, itemIdx) => {
                                                const globalIdx = pageIdx * 4 + itemIdx
                                                const resolvedUrl = resolveUploadDocumentUrl(attachment.fileUrl)
                                                return (
                                                    <div
                                                        key={`att-${globalIdx}`}
                                                        style={{
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            background: "#f8fafc",
                                                            border: "1px solid #dde6f0",
                                                            borderRadius: "2mm",
                                                            overflow: "hidden",
                                                            minHeight: 0,
                                                        }}
                                                    >
                                                        {/* Card Header: Judul */}
                                                        <div style={{
                                                            background: "#2563eb",
                                                            padding: "2.5mm 3.5mm",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "2mm"
                                                        }}>
                                                            <div style={{
                                                                background: "rgba(255,255,255,0.25)",
                                                                borderRadius: "50%",
                                                                width: "5mm",
                                                                height: "5mm",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                fontSize: "7pt",
                                                                color: "#fff",
                                                                fontWeight: 700,
                                                                flexShrink: 0
                                                            }}>{globalIdx + 1}</div>
                                                            <div style={{ fontSize: "8.5pt", fontWeight: 700, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                {attachment.title}
                                                            </div>
                                                        </div>

                                                        {/* Gambar */}
                                                        <div style={{
                                                            flex: 1,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            padding: "2mm",
                                                            background: "#fff",
                                                            minHeight: 0,
                                                            overflow: "hidden"
                                                        }}>
                                                            {resolvedUrl ? (
                                                                <img
                                                                    src={resolvedUrl}
                                                                    alt={attachment.title}
                                                                    style={{
                                                                        width: "100%",
                                                                        height: "100%",
                                                                        objectFit: "contain"
                                                                    }}
                                                                    onError={(e) => {
                                                                        // fallback: try original fileUrl
                                                                        const el = e.currentTarget
                                                                        if (el.src !== attachment.fileUrl) {
                                                                            el.src = attachment.fileUrl
                                                                        }
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div style={{ fontSize: "8pt", color: "#94a3b8" }}>Gambar tidak tersedia</div>
                                                            )}
                                                        </div>

                                                        {/* Keterangan */}
                                                        {attachment.description && (
                                                            <div style={{
                                                                padding: "2mm 3mm",
                                                                borderTop: "1px solid #e2e8f0",
                                                                fontSize: "7.5pt",
                                                                color: "#475569",
                                                                lineHeight: 1.25,
                                                                whiteSpace: "pre-line"
                                                            }}>
                                                                <span style={{ fontWeight: 700, color: "#1e293b" }}>Ket: </span>
                                                                {attachment.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        })()}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
