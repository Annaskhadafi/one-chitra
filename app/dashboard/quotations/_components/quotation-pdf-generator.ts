import { toast } from "sonner"
import type { Customer, Product } from "@/lib/types"
import { normalizeQuotationText } from "@/lib/quotation-text"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"

interface QuotationPdfData {
    quotationNumber: string | null
    currentRevision?: number
    status?: string
    quotationDate: Date
    validUntil: Date | null
    salesPerson: { name: string | null } | null
    attn: string | null
    address: string | null
    customer: Customer
    currency: string
    discountType: string
    discount: string
    tax: string
    shipping: string
    termsConditions: string | null
    clientNote: string | null
    attachmentLayoutRows?: number
    items: {
        product: Product | null
        description: string | null
        longDescription: string | null
        quantity: number
        unitPrice: string
        discount?: string
        tax?: string
        imageUrl?: string | null
    }[]
    attachments?: {
        title: string
        fileName: string
        fileUrl?: string
        mimeType?: string | null
        kind: string
        includeInPdf: boolean
        description?: string | null
        productId?: number | null
        partNumber?: string | null
        priceNote?: string | null
    }[]
}

type QuotationPdfPayloadSource = {
    quotationNumber: string | null
    currentRevision?: number
    status?: string
    quotationDate: Date
    validUntil: Date | null
    salesPerson?: { name: string | null } | null
    attn: string | null
    address: string | null
    customer: Customer
    currency: string
    discountType: string
    discount: string
    tax: string
    shipping: string
    termsConditions: string | null
    clientNote: string | null
    attachmentLayoutRows?: number
    items: {
        product: Product | null
        description: string | null
        longDescription: string | null
        quantity: number
        unitPrice: string
        discount?: string
        tax?: string
        imageUrl?: string | null
    }[]
    attachments?: {
        title: string
        fileName: string
        fileUrl?: string
        mimeType?: string | null
        kind: string
        includeInPdf: boolean
        description?: string | null
        productId?: number | null
        partNumber?: string | null
        priceNote?: string | null
    }[]
}

function formatCurrency(value: number, currency = "IDR") {
    if (currency === "USD") {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
    }
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value)
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function sanitizeFilenamePart(value: string | null | undefined) {
    return (value || "Draft").replace(/[\\/:*?"<>|]+/g, "-").trim() || "Draft"
}

function getItemLabel(item: QuotationPdfData["items"][number]) {
    return item.description || item.product?.materialDescription || item.product?.materialNumber || "Unnamed item"
}

export function buildQuotationPdfPayload(source: QuotationPdfPayloadSource): QuotationPdfData {
    return {
        quotationNumber: source.quotationNumber,
        currentRevision: source.currentRevision,
        status: source.status,
        quotationDate: source.quotationDate,
        validUntil: source.validUntil,
        salesPerson: source.salesPerson ? { name: source.salesPerson.name } : null,
        attn: source.attn,
        address: source.address,
        customer: source.customer,
        currency: source.currency,
        discountType: source.discountType,
        discount: source.discount,
        tax: source.tax,
        shipping: source.shipping,
        termsConditions: normalizeQuotationText(source.termsConditions) ?? null,
        clientNote: normalizeQuotationText(source.clientNote) ?? null,
        attachmentLayoutRows: source.attachmentLayoutRows ?? 2,
        items: source.items.map((item) => ({
            product: item.product,
            description: item.description,
            longDescription: item.longDescription,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            tax: item.tax,
            imageUrl: item.imageUrl || item.product?.imageUrl || null,
        })),
        attachments: source.attachments?.map((attachment) => ({
            title: attachment.title,
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl,
            mimeType: attachment.mimeType,
            kind: attachment.kind,
            includeInPdf: attachment.includeInPdf,
            description: normalizeQuotationText(attachment.description) ?? null,
            productId: attachment.productId ?? null,
            partNumber: attachment.partNumber ?? null,
            priceNote: attachment.priceNote ?? null,
        })),
    }
}

function inferMimeType(fileName: string, mimeType?: string | null) {
    if (mimeType) {
        return mimeType.toLowerCase()
    }

    const extension = fileName.split(".").pop()?.toLowerCase()
    switch (extension) {
        case "pdf":
            return "application/pdf"
        case "png":
            return "image/png"
        case "jpg":
        case "jpeg":
            return "image/jpeg"
        default:
            return ""
    }
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

let cachedLetterheadDataUrlPromise: Promise<string> | null = null

async function blobToDataUrl(blob: Blob) {
    return await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve((reader.result as string) || "")
        reader.readAsDataURL(blob)
    })
}

async function getLetterheadDataUrl() {
    if (!cachedLetterheadDataUrlPromise) {
        cachedLetterheadDataUrlPromise = (async () => {
            try {
                const response = await fetch("/ChitraParatama_Stationery_Letterhead_jkt.jpg", { cache: "force-cache" })
                if (!response.ok) {
                    return ""
                }

                const blob = await response.blob()
                const objectUrl = URL.createObjectURL(blob)

                try {
                    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                        const nextImage = new Image()
                        nextImage.onload = () => resolve(nextImage)
                        nextImage.onerror = () => reject(new Error("Failed to decode letterhead image"))
                        nextImage.src = objectUrl
                    })

                    const canvas = document.createElement("canvas")
                    canvas.width = Math.max(1240, Math.round(image.naturalWidth * 0.65))
                    canvas.height = Math.round((canvas.width / image.naturalWidth) * image.naturalHeight)

                    const context = canvas.getContext("2d")
                    if (!context) {
                        return await blobToDataUrl(blob)
                    }

                    context.drawImage(image, 0, 0, canvas.width, canvas.height)
                    return canvas.toDataURL("image/jpeg", 0.72)
                } finally {
                    URL.revokeObjectURL(objectUrl)
                }
            } catch (error) {
                console.error("Failed to load letterhead image", error)
                return ""
            }
        })()
    }

    return await cachedLetterheadDataUrlPromise
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
        const resolved = resolveUploadDocumentUrl(url)
        if (!resolved) return null
        const response = await fetch(resolved, { cache: "no-store" })
        if (!response.ok) return null
        const blob = await response.blob()
        return await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve((reader.result as string) || "")
            reader.readAsDataURL(blob)
        })
    } catch {
        return null
    }
}

export async function generateQuotationPdf(
    quotation: QuotationPdfData,
    options?: {
        mergeAttachments?: boolean
    },
) {
    try {
        const { default: jsPDF } = await import("jspdf")
        const autoTable = (await import("jspdf-autotable")).default
        type AutoTableHookData = {
            section: string
            column: { index: number }
            row: { index: number }
            doc: InstanceType<typeof jsPDF>
            cell: {
                styles: { minCellHeight?: number }
                text: string[]
                x: number
                y: number
            }
        }

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true,
            putOnlyUsedFonts: true,
        })

        const shouldMergeAttachments = options?.mergeAttachments === true
        const base64data = await getLetterheadDataUrl()

        // Preload item thumbnails and attachment images as Data URLs for reliable rendering
        const itemThumbnails = await Promise.all(
            quotation.items.map(async (item) => {
                const imgUrl = item.imageUrl || item.product?.imageUrl
                if (!imgUrl) return null
                return await loadImageAsDataUrl(imgUrl)
            })
        )

        const imageAttachments = quotation.attachments?.filter((att) => {
            if (!att.includeInPdf || !att.fileUrl) return false
            const ext = (att.fileName.split(".").pop() || "").toLowerCase()
            const mime = (att.mimeType || "").toLowerCase()
            return mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)
        }) || []

        const attachmentImageDataUrls = await Promise.all(
            imageAttachments.map(async (att) => {
                if (!att.fileUrl) return null
                return await loadImageAsDataUrl(att.fileUrl)
            })
        )

        const hasAnyItemImage = itemThumbnails.some((thumb) => !!thumb)

        // Helper to render Draft/Pending watermark if not fully approved
        const renderWatermark = () => {
            if (quotation.status && quotation.status !== "approved") {
                const isRejected = quotation.status === "rejected"
                const isWaiting = quotation.status === "waiting_approval"
                const watermarkText = isRejected
                    ? "REJECTED"
                    : (isWaiting ? "WAITING APPROVAL" : "DRAFT")

                doc.saveGraphicsState()

                // 1. Watermark di paling atas (Top Header)
                doc.setFont("helvetica", "bold")
                doc.setFontSize(10)
                if (isRejected) {
                    doc.setTextColor(220, 38, 38)
                } else if (isWaiting) {
                    doc.setTextColor(217, 119, 6)
                } else {
                    doc.setTextColor(100, 116, 139)
                }
                try {
                    const topGState = new (doc as any).GState({ opacity: 0.7 })
                    doc.setGState(topGState)
                } catch {}
                doc.text(`[ ${watermarkText} ]`, 105, 8.5, { align: "center" })

                // 2. Watermark di tengah halaman secara diagonal (Center Diagonal)
                doc.setFont("helvetica", "bold")
                doc.setFontSize(isWaiting ? 40 : 52)
                if (isRejected) {
                    doc.setTextColor(220, 38, 38)
                } else if (isWaiting) {
                    doc.setTextColor(217, 119, 6)
                } else {
                    doc.setTextColor(220, 38, 38)
                }
                try {
                    const centerGState = new (doc as any).GState({ opacity: 0.13 })
                    doc.setGState(centerGState)
                } catch {
                    doc.setTextColor(245, 200, 200)
                }
                doc.text(watermarkText, 105, 152, { align: "center", angle: 32 })
                doc.restoreGraphicsState()
            }
        }

        // Add background and watermark to first page
        if (base64data) {
            doc.addImage(base64data, 'JPEG', 0, 0, 210, 297)
        }
        renderWatermark()

        // Override addPage to automatically add background and watermark to new pages
        const originalAddPage = doc.addPage.bind(doc)
        const mutableDoc = doc as typeof doc & { lastAutoTable?: { finalY: number } }
        doc.addPage = (...args: Parameters<typeof originalAddPage>) => {
            originalAddPage(...args)
            if (base64data) {
                doc.addImage(base64data, 'JPEG', 0, 0, 210, 297)
            }
            renderWatermark()
            return doc
        }

        // Constants
        const brandColor: [number, number, number] = [37, 99, 235] // #2563eb
        const darkText: [number, number, number] = [15, 23, 42]
        const grayText: [number, number, number] = [71, 85, 105]

        // Company Logo / Header
        doc.setFont("helvetica", "bold")
        doc.setFontSize(24)
        doc.setTextColor(brandColor[0], brandColor[1], brandColor[2])
        doc.text("QUOTATION", 195, 50, { align: "right" })
        
        doc.setFontSize(11)
        doc.setTextColor(grayText[0], grayText[1], grayText[2])
        doc.text(
            quotation.quotationNumber || "DRAFT",
            195,
            56,
            { align: "right" },
        )

        // Company Info
        doc.setFontSize(14)
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
        doc.text("PT Chitra Paratama", 15, 50)

        doc.setFont("helvetica", "normal")
        doc.setFontSize(10)
        doc.setTextColor(grayText[0], grayText[1], grayText[2])
        const addressLines = doc.splitTextToSize(quotation.address || "Jl. Amd No.69 Karang Joang Kec. Balikpapan Utara\nKota Balikpapan Kalimantan Timur 7612", 90)
        doc.text(addressLines, 15, 57)

        // Line separator
        let currentY = 70
        doc.setDrawColor(brandColor[0], brandColor[1], brandColor[2])
        doc.setLineWidth(0.5)
        doc.line(15, currentY, 195, currentY)
        currentY += 8

        // Meta data box
        doc.setFillColor(248, 250, 252) // slate-50
        doc.setDrawColor(226, 232, 240) // slate-200
        doc.setLineWidth(0.3)
        
        let metaBoxHeight = 28
        const metaBoxY = currentY + 3
        
        // Measure TO address to adjust box height if needed
        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        const customerNameLines = doc.splitTextToSize(quotation.customer.name, 70)
        
        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        const fullAddress = [quotation.customer.address1, quotation.customer.address2, quotation.customer.address3].filter(Boolean).join("\n")
        const custAddressLines = doc.splitTextToSize(fullAddress || "-", 70)
        
        const rightColumnHeight = 8 + (customerNameLines.length * 4.5) + (custAddressLines.length * 4) + 2
        if (rightColumnHeight > metaBoxHeight) {
            metaBoxHeight = rightColumnHeight
        }
        
        doc.roundedRect(15, metaBoxY, 180, metaBoxHeight, 2, 2, 'FD')
        
        // Vertical divider line
        doc.setDrawColor(226, 232, 240)
        doc.line(105, metaBoxY + 4, 105, metaBoxY + metaBoxHeight - 4)

        // Left Meta Column
        let leftStartY = metaBoxY + 6
        const labelX = 20
        const valueX = 45
        
        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(grayText[0], grayText[1], grayText[2])
        doc.text("QUO DATE:", labelX, leftStartY)
        doc.setFontSize(9)
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
        doc.text(formatDate(quotation.quotationDate), valueX, leftStartY)
        leftStartY += 5.5

        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(grayText[0], grayText[1], grayText[2])
        doc.text("VALIDITY QUOTE:", labelX, leftStartY)
        doc.setFontSize(9)
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
        doc.text(quotation.validUntil ? formatDate(quotation.validUntil) : "-", valueX, leftStartY)
        leftStartY += 5.5

        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(grayText[0], grayText[1], grayText[2])
        doc.text("FROM:", labelX, leftStartY)
        doc.setFontSize(9)
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
        doc.text(quotation.salesPerson?.name || "-", valueX, leftStartY)
        leftStartY += 5.5

        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(grayText[0], grayText[1], grayText[2])
        doc.text("ATTN:", labelX, leftStartY)
        doc.setFontSize(9)
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
        const attnLines = doc.splitTextToSize(quotation.attn || "-", 55)
        doc.text(attnLines, valueX, leftStartY)

        // Right Meta Column (To)
        let rightStartY = metaBoxY + 6
        
        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(brandColor[0], brandColor[1], brandColor[2])
        doc.text("TO", 190, rightStartY, { align: "right" })
        rightStartY += 5
        
        doc.setFontSize(10)
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
        customerNameLines.forEach((line: string) => {
            doc.text(line, 190, rightStartY, { align: "right" })
            rightStartY += 4.5
        })

        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(grayText[0], grayText[1], grayText[2])
        custAddressLines.forEach((line: string) => {
            doc.text(line, 190, rightStartY, { align: "right" })
            rightStartY += 4
        })

        currentY = metaBoxY + metaBoxHeight + 10

        // Items Table
        const itemColIndex = hasAnyItemImage ? 2 : 1
        const itemTextWidth = hasAnyItemImage ? 64 : 75

        const tableHead = hasAnyItemImage
            ? [['#', 'IMG', 'ITEM', 'QTY', 'PRICE', 'AMOUNT']]
            : [['#', 'ITEM', 'QTY', 'PRICE', 'AMOUNT']]

        const tableBody = quotation.items.map((item, index) => {
            const lineTitle = getItemLabel(item)
            const itemDisc = Number(item.discount || 0)
            const combinedContent = itemDisc > 0
                ? `${lineTitle}\n(Disc: -${formatCurrency(itemDisc, quotation.currency)})`
                : lineTitle
            const amount = (item.quantity * Number(item.unitPrice)) - itemDisc
            
            if (hasAnyItemImage) {
                return [
                    (index + 1).toString(),
                    "", // Placeholder for image
                    combinedContent,
                    item.quantity.toString(),
                    Number(item.unitPrice).toLocaleString(),
                    amount.toLocaleString()
                ]
            }

            return [
                (index + 1).toString(),
                combinedContent,
                item.quantity.toString(),
                Number(item.unitPrice).toLocaleString(),
                amount.toLocaleString()
            ]
        })

        const columnStylesConfig: Record<number, { cellWidth?: number; halign?: "center" | "left" | "right" }> = hasAnyItemImage
            ? {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 16, halign: 'center' },
                2: { cellWidth: 71 },
                3: { cellWidth: 15, halign: 'center' },
                4: { cellWidth: 30, halign: 'right' },
                5: { cellWidth: 34, halign: 'right' },
            }
            : {
                0: { cellWidth: 15, halign: 'center' },
                1: { cellWidth: 82 },
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 30, halign: 'right' },
                4: { cellWidth: 35, halign: 'right' },
            }

        let finalY = currentY

        autoTable(doc, {
            startY: currentY,
            margin: { top: 50, bottom: 65, left: 15, right: 15 },
            head: tableHead,
            body: tableBody,
            theme: 'plain',
            headStyles: {
                fillColor: [59, 89, 152] as [number, number, number], // #3b5998
                textColor: [255, 255, 255] as [number, number, number],
                fontStyle: 'bold',
                fontSize: 9,
                cellPadding: 4,
            },
            bodyStyles: {
                fontSize: 8.5,
                cellPadding: 4,
                textColor: darkText,
            },
            columnStyles: columnStylesConfig,
            alternateRowStyles: {
                fillColor: [248, 250, 252] as [number, number, number]
            },
            pageBreak: 'auto',
            rowPageBreak: 'avoid',
            didParseCell: (data: AutoTableHookData) => {
                if (data.section === 'body' && data.column.index === itemColIndex) {
                    const item = quotation.items[data.row.index]
                    const doc = data.doc

                    let totalHeight = 8 
                    
                    doc.setFontSize(10)
                    const descText = getItemLabel(item)
                    totalHeight += doc.splitTextToSize(descText, itemTextWidth).length * 4
                    
                    if (item.longDescription) {
                        doc.setFontSize(8)
                        totalHeight += 2
                        totalHeight += doc.splitTextToSize(item.longDescription, itemTextWidth).length * 3.2
                    }
                    
                    const minRowH = (hasAnyItemImage && itemThumbnails[data.row.index]) ? 17 : totalHeight + 2
                    data.cell.styles.minCellHeight = minRowH
                }
            },
            willDrawCell: (data: AutoTableHookData) => {
                if (data.section === 'body') {
                    if (data.column.index === itemColIndex || (hasAnyItemImage && data.column.index === 1)) {
                        data.cell.text = []; // Clear text to prevent autoTable double text
                    }
                }
            },
            didDrawCell: (data: AutoTableHookData) => {
                // Draw product thumbnail if present
                if (hasAnyItemImage && data.section === 'body' && data.column.index === 1) {
                    const thumbUrl = itemThumbnails[data.row.index]
                    if (thumbUrl) {
                        try {
                            doc.addImage(thumbUrl, 'JPEG', data.cell.x + 1, data.cell.y + 1.5, 14, 14, undefined, 'FAST')
                        } catch (err) {
                            console.error("Failed to draw thumbnail in cell", err)
                        }
                    }
                }

                // Custom drawn cell text for Item column
                if (data.section === 'body' && data.column.index === itemColIndex) {
                    const item = quotation.items[data.row.index]
                    const doc = data.doc
                    const x = data.cell.x + 4
                    let y = data.cell.y + 4 + 3.2

                    const descText = getItemLabel(item)
                    doc.setFont("helvetica", "bold")
                    doc.setFontSize(10)
                    doc.setTextColor(15, 23, 42)
                    const descLines = doc.splitTextToSize(descText, itemTextWidth)
                    doc.text(descLines, x, y)
                    y += descLines.length * 4

                    if (item.longDescription) {
                        doc.setFont("helvetica", "italic")
                        doc.setFontSize(8)
                        doc.setTextColor(100, 116, 139)
                        const longDescLines = doc.splitTextToSize(item.longDescription, itemTextWidth)
                        y += 1.5
                        doc.text(longDescLines, x, y)
                    }
                }
            },
            didDrawPage: () => {
                // Optionally add footer here
            }
        })

        finalY = (mutableDoc.lastAutoTable?.finalY ?? currentY) + 10

        // Subtotals
        const grossItemsSubtotal = quotation.items.reduce((sum, item) => sum + (item.quantity * Number(item.unitPrice)), 0)
        const itemsDiscountTotal = quotation.items.reduce((sum, item) => sum + Number(item.discount || 0), 0)
        const discountAmount = itemsDiscountTotal > 0
            ? itemsDiscountTotal
            : (
                quotation.discountType === "percent"
                    ? (grossItemsSubtotal * Number(quotation.discount)) / 100
                    : Number(quotation.discount)
            )
        const subtotalAfterDiscount = grossItemsSubtotal - discountAmount
        const itemTaxTotal = quotation.items.reduce((sum, item) => sum + Number(item.tax || 0), 0)
        const taxAmount = itemTaxTotal > 0
            ? (itemTaxTotal / (grossItemsSubtotal || 1)) * subtotalAfterDiscount
            : (Number(quotation.tax) > 0 ? subtotalAfterDiscount * 0.11 : 0)
        const grandTotal = subtotalAfterDiscount + taxAmount + Number(quotation.shipping)

        // Draw Totals section immediately following table
        const totalsXLabel = 140
        const totalsXValue = 195

        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(grayText[0], grayText[1], grayText[2])
        doc.text("Sub Total", totalsXLabel, finalY)
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
        doc.text(formatCurrency(grossItemsSubtotal, quotation.currency), totalsXValue, finalY, { align: "right" })
        finalY += 7

        if (discountAmount > 0) {
            doc.setTextColor(grayText[0], grayText[1], grayText[2])
            doc.text("Discount", totalsXLabel, finalY)
            doc.setTextColor(239, 68, 68) // Red
            doc.text(`-${formatCurrency(discountAmount, quotation.currency)}`, totalsXValue, finalY, { align: "right" })
            finalY += 7
        }

        if (taxAmount > 0) {
            doc.setTextColor(grayText[0], grayText[1], grayText[2])
            doc.text("Tax (PPN)", totalsXLabel, finalY)
            doc.setTextColor(darkText[0], darkText[1], darkText[2])
            doc.text(formatCurrency(taxAmount, quotation.currency), totalsXValue, finalY, { align: "right" })
            finalY += 7
        }

        // Grand Total box with Shadow and Border
        doc.setFillColor(203, 213, 225) // shadow color slate-300
        doc.rect(totalsXLabel - 10, finalY - 4 + 1.5, 65, 10, 'F') // Drop shadow
        
        doc.setFillColor(37, 99, 235) // primary box
        doc.setDrawColor(29, 78, 216) // darker border
        doc.setLineWidth(0.5)
        doc.rect(totalsXLabel - 10, finalY - 4, 65, 10, 'FD')
        
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(11)
        doc.text("TOTAL", totalsXLabel - 5, finalY + 3)
        doc.text(formatCurrency(grandTotal, quotation.currency), totalsXValue - 2, finalY + 3, { align: "right" })
        
        finalY += 15

        // Terms and conditions
        if (quotation.termsConditions || quotation.clientNote) {
            let termsY = finalY
            if (termsY > 240) {
                doc.addPage()
                termsY = 55
            }

            doc.setFillColor(248, 250, 252)
            doc.rect(15, termsY - 5, 180, 50, 'F') // Approximation

            doc.setTextColor(darkText[0], darkText[1], darkText[2])
            doc.setFontSize(9)
            doc.text("TERMS & CONDITIONS", 20, termsY + 2)
            termsY += 8

            doc.setFont("helvetica", "normal")
            doc.setTextColor(grayText[0], grayText[1], grayText[2])
            
            const termsText = [normalizeQuotationText(quotation.termsConditions), normalizeQuotationText(quotation.clientNote)].filter(Boolean).join("\n\n")
            const formattedTerms = doc.splitTextToSize(termsText, 170)
            doc.text(formattedTerms, 20, termsY)
            finalY = termsY + (formattedTerms.length * 4) + 12
        }

        // Rendering Lampiran Gambar Terstruktur pada Halaman A4 Tambahan (1, 2, atau 3 Baris per Halaman)
        if (imageAttachments.length > 0) {
            const rowsPerPage = Math.min(Math.max(Number(quotation.attachmentLayoutRows) || 2, 1), 3)
            const attachmentPages: typeof imageAttachments[] = []
            const attachmentDataUrlPages: (string | null)[][] = []

            for (let i = 0; i < imageAttachments.length; i += rowsPerPage) {
                attachmentPages.push(imageAttachments.slice(i, i + rowsPerPage))
                attachmentDataUrlPages.push(attachmentImageDataUrls.slice(i, i + rowsPerPage))
            }

            attachmentPages.forEach((pageAtts, pageIdx) => {
                doc.addPage() // Background letterhead & watermark otomatis ditambahkan

                // Header Halaman Lampiran
                doc.setFont("helvetica", "bold")
                doc.setFontSize(11)
                doc.setTextColor(37, 99, 235) // brand blue
                doc.text("LAMPIRAN SPESIFIKASI & GAMBAR PENDUKUNG", 15, 48)

                doc.setFont("helvetica", "normal")
                doc.setFontSize(8)
                doc.setTextColor(grayText[0], grayText[1], grayText[2])
                doc.text(`Lampiran ${pageIdx + 1} dari ${attachmentPages.length} (${rowsPerPage} baris per hal)`, 195, 48, { align: "right" })

                doc.setDrawColor(37, 99, 235)
                doc.setLineWidth(0.5)
                doc.line(15, 51, 195, 51)

                // Layout baris per halaman
                const startY = 55
                const availableHeight = 220
                const gap = 4
                const rowHeight = (availableHeight - (rowsPerPage - 1) * gap) / rowsPerPage
                const imageWidth = rowsPerPage === 1 ? 90 : (rowsPerPage === 2 ? 75 : 55)

                pageAtts.forEach((att, rIdx) => {
                    const itemY = startY + rIdx * (rowHeight + gap)
                    const globalIdx = pageIdx * rowsPerPage + rIdx + 1
                    const imgDataUrl = attachmentDataUrlPages[pageIdx][rIdx]

                    // Box border luar
                    doc.setFillColor(248, 250, 252)
                    doc.setDrawColor(203, 213, 225)
                    doc.setLineWidth(0.3)
                    doc.roundedRect(15, itemY, 180, rowHeight, 2, 2, 'FD')

                    // Sisi Kiri: Box Gambar
                    doc.setFillColor(255, 255, 255)
                    doc.rect(15, itemY, imageWidth, rowHeight, 'FD')

                    if (imgDataUrl) {
                        try {
                            const pad = 2
                            const targetWidth = imageWidth - pad * 2
                            const targetHeight = rowHeight - pad * 2

                            // Hitung aspect ratio asli gambar agar selalu proporsional (contain) tanpa terdistorsi/penyet
                            const imgProps = (doc as any).getImageProperties ? (doc as any).getImageProperties(imgDataUrl) : null
                            let renderW = targetWidth
                            let renderH = targetHeight
                            let renderX = 15 + pad
                            let renderY = itemY + pad

                            if (imgProps && imgProps.width && imgProps.height) {
                                const imgRatio = imgProps.width / imgProps.height
                                const boxRatio = targetWidth / targetHeight

                                if (imgRatio > boxRatio) {
                                    // Gambar lebih lebar dari kotak -> fit to width, center vertically
                                    renderW = targetWidth
                                    renderH = targetWidth / imgRatio
                                    renderY += (targetHeight - renderH) / 2
                                } else {
                                    // Gambar lebih tinggi dari kotak (portrait) -> fit to height, center horizontally
                                    renderH = targetHeight
                                    renderW = targetHeight * imgRatio
                                    renderX += (targetWidth - renderW) / 2
                                }
                            }

                            doc.addImage(imgDataUrl, 'JPEG', renderX, renderY, renderW, renderH, undefined, 'FAST')
                        } catch (err) {
                            console.error("Failed to add image to PDF:", err)
                        }
                    }

                    // Badge nomor urut #1
                    doc.setFillColor(37, 99, 235)
                    doc.roundedRect(16, itemY + 1.5, 7, 4.5, 1, 1, 'F')
                    doc.setFont("helvetica", "bold")
                    doc.setFontSize(6.5)
                    doc.setTextColor(255, 255, 255)
                    doc.text(`#${globalIdx}`, 19.5, itemY + 4.5, { align: "center" })

                    // Sisi Kanan: Info Panel
                    const rightX = 15 + imageWidth + 4
                    const rightWidth = 180 - imageWidth - 8
                    let textY = itemY + 6

                    // Judul Barang
                    doc.setFont("helvetica", "bold")
                    doc.setFontSize(rowsPerPage === 1 ? 11 : (rowsPerPage === 2 ? 9.5 : 8.5))
                    doc.setTextColor(darkText[0], darkText[1], darkText[2])
                    const titleLines = doc.splitTextToSize(att.title || att.fileName, rightWidth)
                    doc.text(titleLines, rightX, textY)
                    textY += titleLines.length * (rowsPerPage === 1 ? 4.5 : 3.8) + 1.5

                    // Part Number & Harga Penawaran
                    let badgeLine = ""
                    if (att.partNumber) badgeLine += `PN: ${att.partNumber}   `
                    if (att.priceNote) badgeLine += `|   ${att.priceNote}`

                    if (badgeLine) {
                        doc.setFont("helvetica", "bold")
                        doc.setFontSize(rowsPerPage === 1 ? 8.5 : 7.5)
                        doc.setTextColor(22, 101, 52) // emerald-800
                        doc.text(badgeLine, rightX, textY)
                        textY += 4
                    }

                    // Divider garis tipis
                    doc.setDrawColor(226, 232, 240)
                    doc.line(rightX, textY - 1, rightX + rightWidth, textY - 1)
                    textY += 2

                    // Deskripsi / Spesifikasi Teknis
                    if (att.description) {
                        doc.setFont("helvetica", "bold")
                        doc.setFontSize(6.5)
                        doc.setTextColor(grayText[0], grayText[1], grayText[2])
                        doc.text("SPESIFIKASI / KETERANGAN:", rightX, textY)
                        textY += 3.2

                        doc.setFont("helvetica", "normal")
                        doc.setFontSize(rowsPerPage === 1 ? 8 : (rowsPerPage === 2 ? 7.5 : 7))
                        doc.setTextColor(51, 65, 85)
                        const descLines = doc.splitTextToSize(att.description, rightWidth)
                        const maxDescLines = Math.floor((itemY + rowHeight - textY - 2) / 3.2)
                        const visibleDescLines = descLines.slice(0, Math.max(maxDescLines, 1))
                        doc.text(visibleDescLines, rightX, textY)
                    }
                })
            })
        }

        // Hanya dokumen PDF eksternal yang di-merge di akhir dokumen.
        // File gambar (JPG/PNG) sudah terwakili secara terstruktur pada halaman "Lampiran Spesifikasi & Gambar Pendukung" di atas.
        const externalPdfAttachments = quotation.attachments?.filter((attachment) => {
            if (!attachment.includeInPdf || !attachment.fileUrl) return false
            const ext = (attachment.fileName || "").toLowerCase()
            return ext.endsWith(".pdf") || attachment.mimeType?.includes("pdf")
        }) ?? []

        const basePdfBytes = doc.output("arraybuffer")
        const outputFilename = `Quotation_${sanitizeFilenamePart(quotation.quotationNumber)}.pdf`

        if (!shouldMergeAttachments || externalPdfAttachments.length === 0) {
            downloadBlob(new Blob([basePdfBytes], { type: "application/pdf" }), outputFilename)
            toast.success(
                shouldMergeAttachments
                    ? "PDF quotation berhasil didownload"
                    : "PDF quotation berhasil didownload dengan ukuran lebih ringan",
            )
            return
        }

        const { PDFDocument } = await import("pdf-lib")
        const mergedPdf = await PDFDocument.load(basePdfBytes)
        const skippedAttachments: string[] = []

        for (const attachment of externalPdfAttachments) {
            const attachmentUrl = resolveUploadDocumentUrl(attachment.fileUrl)

            if (!attachmentUrl) {
                skippedAttachments.push(`${attachment.title}: file URL tidak tersedia`)
                continue
            }

            try {
                const response = await fetch(attachmentUrl, { cache: "no-store" })
                if (!response.ok) {
                    skippedAttachments.push(`${attachment.title}: file tidak bisa diakses`)
                    continue
                }

                const attachmentBytes = await response.arrayBuffer()
                const detectedMimeType = inferMimeType(
                    attachment.fileName,
                    response.headers.get("content-type") || attachment.mimeType,
                )

                if (detectedMimeType.includes("pdf")) {
                    const attachmentPdf = await PDFDocument.load(attachmentBytes)
                    const copiedPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
                    copiedPages.forEach((page) => mergedPdf.addPage(page))
                    continue
                }
            } catch (attachmentError) {
                console.error(`Failed to merge attachment ${attachment.fileName}:`, attachmentError)
                skippedAttachments.push(`${attachment.title}: gagal digabung`)
            }
        }

        const mergedBytes = await mergedPdf.save()
        const mergedBuffer = mergedBytes.buffer.slice(
            mergedBytes.byteOffset,
            mergedBytes.byteOffset + mergedBytes.byteLength,
        ) as ArrayBuffer
        downloadBlob(new Blob([mergedBuffer], { type: "application/pdf" }), outputFilename)

        if (skippedAttachments.length > 0) {
            toast.warning(`PDF quotation berhasil digabung. ${skippedAttachments.slice(0, 3).join("; ")}${skippedAttachments.length > 3 ? `; +${skippedAttachments.length - 3} lainnya` : ""}`)
        } else {
            toast.success("PDF quotation dan attachment berhasil digabung")
        }
        
    } catch (error) {
        console.error("Failed to generate PDF:", error)
        toast.error("Failed to generate PDF")
    }
}
