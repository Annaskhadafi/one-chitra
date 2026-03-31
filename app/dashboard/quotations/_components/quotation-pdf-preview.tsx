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
import { user } from "@/db/schema"
import { buildQuotationPdfPayload } from "./quotation-pdf-generator"

type User = typeof user.$inferSelect

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

export function QuotationPdfPreview({ quotation, open, onClose }: QuotationPdfPreviewProps) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const printRef = useRef<HTMLDivElement>(null)
    const [isMobilePreview, setIsMobilePreview] = useState(false)
    const [mobileScale, setMobileScale] = useState(1)
    const [mobileScaledHeight, setMobileScaledHeight] = useState<number | null>(null)
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
    const A4_PAGE_WIDTH = 794
    const A4_PAGE_HEIGHT = 1123

    const itemsSubtotal = quotation.items.reduce((sum, item) => {
        return sum + (item.quantity * Number(item.unitPrice))
    }, 0)

    const discountAmount = quotation.discountType === "percent"
        ? (itemsSubtotal * Number(quotation.discount)) / 100
        : Number(quotation.discount)

    const taxAmount = Number(quotation.tax)
    const grandTotal = itemsSubtotal - discountAmount + taxAmount + Number(quotation.shipping)
    const recipientAddressLines = [
        quotation.customer.address1,
        quotation.customer.address2,
        quotation.customer.address3,
    ].filter(Boolean)
    const visibleAttachments = quotation.attachments?.filter((attachment) => attachment.includeInPdf) ?? []

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
                    .print-shell { width: 210mm; min-height: 297mm; margin: 0 auto; }
                </style>
            </head>
            <body>
                <div class="print-shell">${printContent.innerHTML}</div>
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
            await generateQuotationPdf(buildQuotationPdfPayload(quotation))
            toast.success("PDF A4 berhasil dibuat")
        } catch (error) {
            console.error("Failed to download quotation preview PDF:", error)
            toast.error(error instanceof Error ? error.message : "Download PDF A4 gagal")
        } finally {
            setIsDownloadingPdf(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-h-[95vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto bg-slate-50 p-0 sm:max-w-7xl">
                <DialogHeader className="no-print sticky top-0 z-10 border-b bg-background px-4 py-4 sm:px-6">
                    <DialogDescription className="sr-only">
                        Preview quotation PDF with the same layout used by the downloadable file.
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

                <div ref={viewportRef} className="h-[calc(100vh-12.5rem)] overflow-y-auto bg-slate-50 p-2 sm:h-auto sm:overflow-x-auto sm:overflow-y-visible sm:p-8">
                    <div
                        className={isMobilePreview ? "mx-auto overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-200" : "relative mx-auto w-full max-w-[210mm] shadow-2xl"}
                        style={isMobilePreview && mobileScaledHeight ? { height: `${mobileScaledHeight}px` } : undefined}
                    >
                        <div
                            ref={printRef}
                            className={isMobilePreview ? "origin-top-left" : "relative mx-auto w-full max-w-[210mm]"}
                            style={{
                                width: isMobilePreview ? `${A4_PAGE_WIDTH}px` : undefined,
                                minHeight: `${A4_PAGE_HEIGHT}px`,
                                transform: isMobilePreview ? `scale(${mobileScale})` : undefined,
                                background: "#ffffff",
                                color: "#163153",
                                boxShadow: isMobilePreview ? "none" : "0 25px 50px -12px rgba(15, 23, 42, 0.18)",
                                border: isMobilePreview ? "none" : "1px solid #e2e8f0",
                                fontFamily: "Arial, Helvetica, sans-serif",
                                lineHeight: "1.35",
                                position: "relative",
                                overflow: "hidden",
                            }}
                        >
                            <img
                                src="/ChitraParatama_Stationery_Letterhead_jkt.jpg"
                                alt=""
                                className="pointer-events-none absolute inset-0 h-full w-full select-none"
                                style={{ objectFit: "cover" }}
                            />
                            <div className="relative z-10 px-[15mm] pb-[22mm] pt-[14mm]">
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
                                        marginTop: "8mm",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "2mm",
                                        background: "#f8fafc",
                                        padding: "5mm",
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        columnGap: "8mm",
                                    }}
                                >
                                    <div style={{ borderRight: "1px solid #e2e8f0", paddingRight: "6mm" }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "24mm 1fr", rowGap: "2.2mm", fontSize: "8pt" }}>
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
                                        <div style={{ fontSize: "8pt", color: "#2563eb", fontWeight: 700, marginBottom: "2mm" }}>TO</div>
                                        <div style={{ fontSize: "10pt", color: "#0f172a", fontWeight: 700, marginBottom: "2mm" }}>
                                            <div style={{ textTransform: "uppercase" }}>{quotation.customer.name}</div>
                                        </div>
                                        <div style={{ fontSize: "9pt", color: "#475569", whiteSpace: "pre-line" }}>
                                            {recipientAddressLines.length > 0 ? (
                                                recipientAddressLines.join("\n")
                                            ) : (
                                                "-"
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "5mm" }}>
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
                                        {quotation.items.map((item, index) => {
                                            const lineAmount = item.quantity * Number(item.unitPrice)

                                            return (
                                                <tr key={item.id} style={{ verticalAlign: "top", background: index % 2 === 1 ? "#f8fafc" : "#ffffff" }}>
                                                    <td style={{ padding: "5mm 3mm", fontSize: "9pt", color: "#475569", textAlign: "center" }}>{index + 1}</td>
                                                    <td style={{ padding: "5mm 4mm", fontSize: "9pt", color: "#0f172a" }}>
                                                        <div style={{ fontWeight: 700 }}>{getItemLabel(item)}</div>
                                                        {item.longDescription ? (
                                                            <div style={{ fontStyle: "italic", color: "#64748b", fontSize: "8.5pt", marginTop: "2mm", whiteSpace: "pre-wrap" }}>
                                                                {item.longDescription}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td style={{ padding: "5mm 3mm", fontSize: "9pt", color: "#0f172a", textAlign: "center" }}>{item.quantity}</td>
                                                    <td style={{ padding: "5mm 4mm", fontSize: "9pt", color: "#0f172a", textAlign: "right" }}>{formatNumber(Number(item.unitPrice))}</td>
                                                    <td style={{ padding: "5mm 4mm", fontSize: "9pt", color: "#0f172a", textAlign: "right" }}>{formatNumber(lineAmount)}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>

                                <div style={{ marginTop: "8mm", display: "flex", justifyContent: "flex-end" }}>
                                    <div style={{ width: "65mm" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10pt", fontWeight: 700, color: "#475569", marginBottom: "3mm" }}>
                                            <span>Sub Total</span>
                                            <span>{formatCurrency(itemsSubtotal, quotation.currency)}</span>
                                        </div>
                                        {discountAmount > 0 ? (
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10pt", color: "#475569", marginBottom: "3mm" }}>
                                                <span>Discount {quotation.discountType === "percent" ? `(${quotation.discount}%)` : ""}</span>
                                                <span style={{ color: "#ef4444" }}>-{formatCurrency(discountAmount, quotation.currency)}</span>
                                            </div>
                                        ) : null}
                                        {taxAmount > 0 ? (
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10pt", color: "#475569", marginBottom: "3mm" }}>
                                                <span>Tax (PPN)</span>
                                                <span>{formatCurrency(taxAmount, quotation.currency)}</span>
                                            </div>
                                        ) : null}
                                        <div
                                            style={{
                                                marginTop: "4mm",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                background: "#2563eb",
                                                color: "#ffffff",
                                                border: "1px solid #1d4ed8",
                                                boxShadow: "2px 2px 0 rgba(203,213,225,0.95)",
                                                padding: "3.2mm 4.5mm",
                                                fontSize: "11pt",
                                                fontWeight: 700,
                                            }}
                                        >
                                            <span>TOTAL</span>
                                            <span>{formatCurrency(grandTotal, quotation.currency)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginTop: "12mm", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10mm" }}>
                                    <div
                                        style={{
                                            width: "100%",
                                            maxWidth: "128mm",
                                            background: "rgba(248,250,252,0.95)",
                                            border: "1px solid #dde6f0",
                                            padding: "5mm",
                                            minHeight: "40mm",
                                        }}
                                    >
                                        <div style={{ fontSize: "9pt", fontWeight: 700, color: "#0f172a", marginBottom: "3mm" }}>TERMS & CONDITIONS</div>
                                        <div style={{ fontSize: "8.5pt", color: "#475569", lineHeight: 1.45, whiteSpace: "pre-line" }}>
                                            {[quotation.termsConditions, quotation.clientNote].filter(Boolean).join("\n\n") || "-"}
                                        </div>
                                    </div>
                                    <div style={{ width: "50mm" }} />
                                </div>

                                {visibleAttachments.length > 0 ? (
                                    <div
                                        style={{
                                            marginTop: "10mm",
                                            background: "#f8fafc",
                                            border: "1px solid #e2e8f0",
                                            padding: "5mm",
                                        }}
                                    >
                                        <div style={{ fontSize: "9pt", fontWeight: 700, color: "#0f172a", marginBottom: "3mm" }}>
                                            ATTACHMENT PACKAGE
                                        </div>
                                        <div style={{ fontSize: "8.5pt", color: "#475569", lineHeight: 1.5 }}>
                                            {visibleAttachments.map((attachment, index) => (
                                                <div key={attachment.id}>{index + 1}. {attachment.title} ({attachment.fileName})</div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
