import { toast } from "sonner"
import type { Customer, Product } from "@/lib/types"
import { normalizeQuotationText } from "@/lib/quotation-text"
import { resolveUploadDocumentUrl } from "@/lib/upload-url"

interface QuotationPdfData {
    quotationNumber: string | null
    currentRevision?: number
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
    items: {
        product: Product | null
        description: string | null
        longDescription: string | null
        quantity: number
        unitPrice: string
        discount?: string
        tax?: string
    }[]
    attachments?: {
        title: string
        fileName: string
        fileUrl?: string
        mimeType?: string | null
        kind: string
        includeInPdf: boolean
        description?: string | null
    }[]
}

type QuotationPdfPayloadSource = {
    quotationNumber: string | null
    currentRevision?: number
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
    items: {
        product: Product | null
        description: string | null
        longDescription: string | null
        quantity: number
        unitPrice: string
        discount?: string
        tax?: string
    }[]
    attachments?: {
        title: string
        fileName: string
        fileUrl?: string
        mimeType?: string | null
        kind: string
        includeInPdf: boolean
        description?: string | null
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
        items: source.items.map((item) => ({
            product: item.product,
            description: item.description,
            longDescription: item.longDescription,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            tax: item.tax,
        })),
        attachments: source.attachments?.map((attachment) => ({
            title: attachment.title,
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl,
            mimeType: attachment.mimeType,
            kind: attachment.kind,
            includeInPdf: attachment.includeInPdf,
            description: (attachment as any).description ?? null,
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

function isImageAttachment(attachment: NonNullable<QuotationPdfData["attachments"]>[number]) {
    const mimeType = attachment.mimeType?.toLowerCase() ?? ""
    const extension = attachment.fileName.split(".").pop()?.toLowerCase() ?? ""

    return mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(extension)
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

async function fetchArrayBufferWithTimeout(url: string, timeoutMs = 4_000) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        const contentLength = Number(response.headers.get("content-length") || 0)
        if (contentLength > 2_000_000) {
            throw new Error("IMAGE_TOO_LARGE")
        }

        const bytes = await response.arrayBuffer()
        if (bytes.byteLength > 2_000_000) {
            throw new Error("IMAGE_TOO_LARGE")
        }

        return {
            bytes,
            contentType: response.headers.get("content-type"),
        }
    } finally {
        window.clearTimeout(timeout)
    }
}

async function resizeImageAttachmentForPdf(bytes: ArrayBuffer, mimeType: string) {
    const blob = new Blob([bytes], { type: mimeType })
    const objectUrl = URL.createObjectURL(blob)

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const nextImage = new Image()
            nextImage.onload = () => resolve(nextImage)
            nextImage.onerror = () => reject(new Error("Failed to decode attachment image"))
            nextImage.src = objectUrl
        })

        const maxSide = 700
        const scale = Math.min(maxSide / image.naturalWidth, maxSide / image.naturalHeight, 1)
        const width = Math.max(1, Math.round(image.naturalWidth * scale))
        const height = Math.max(1, Math.round(image.naturalHeight * scale))

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext("2d")
        if (!context) {
            return { dataUrl: await blobToDataUrl(blob), width: image.naturalWidth, height: image.naturalHeight, format: mimeType.includes("png") ? "PNG" : "JPEG" }
        }

        context.drawImage(image, 0, 0, width, height)

        const outputMimeType = "image/jpeg"
        const resizedBlob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, outputMimeType, 0.5)
        })

        if (!resizedBlob) {
            return { dataUrl: canvas.toDataURL(outputMimeType, 0.5), width, height, format: "JPEG" }
        }

        return {
            dataUrl: await blobToDataUrl(resizedBlob),
            width,
            height,
            format: "JPEG",
        }
    } finally {
        URL.revokeObjectURL(objectUrl)
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

        // Add background to first page
        if (base64data) {
            doc.addImage(base64data, 'JPEG', 0, 0, 210, 297)
        }

        // Override addPage to automatically add background to new pages
        const originalAddPage = doc.addPage.bind(doc)
        const mutableDoc = doc as typeof doc & { lastAutoTable?: { finalY: number } }
        doc.addPage = (...args: Parameters<typeof originalAddPage>) => {
            originalAddPage(...args)
            if (base64data) {
                doc.addImage(base64data, 'JPEG', 0, 0, 210, 297)
            }
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
            `${quotation.quotationNumber || "DRAFT"}${quotation.currentRevision ? `  |  Rev.${quotation.currentRevision}` : ""}`,
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
        const tableBody = quotation.items.map((item, index) => {
            const lineTitle = getItemLabel(item)
            // We just pass it simply to keep row data, we will wipe display and custom draw
            const combinedContent = lineTitle

            const amount = item.quantity * Number(item.unitPrice)
            
            return [
                (index + 1).toString(),
                combinedContent,
                item.quantity.toString(),
                Number(item.unitPrice).toLocaleString(),
                amount.toLocaleString()
            ]
        })

        let finalY = currentY

        autoTable(doc, {
            startY: currentY,
            margin: { top: 50, bottom: 65, left: 15, right: 15 },
            head: [['#', 'ITEM', 'QTY', 'PRICE', 'AMOUNT']],
            body: tableBody,
            theme: 'plain',
            headStyles: {
                fillColor: [59, 89, 152] as [number, number, number], // #3b5998
                textColor: [255, 255, 255] as [number, number, number],
                fontStyle: 'bold',
                fontSize: 9,
                cellPadding: 5,
            },
            bodyStyles: {
                fontSize: 9,
                cellPadding: 5,
                textColor: darkText,
            },
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' },
                1: { cellWidth: 82 }, // dynamic custom drawn
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 30, halign: 'right' },
                4: { cellWidth: 35, halign: 'right' },
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252] as [number, number, number]
            },
            // The critical part to avoid page cuts for descriptions
            pageBreak: 'auto',
            rowPageBreak: 'avoid', // Keep items together
            didParseCell: (data: AutoTableHookData) => {
                if (data.section === 'body' && data.column.index === 1) {
                    const item = quotation.items[data.row.index]
                    const doc = data.doc

                    let totalHeight = 8 
                    
                    doc.setFontSize(10.5)
                    const descText = getItemLabel(item)
                    totalHeight += doc.splitTextToSize(descText, 75).length * 4.2
                    
                    if (item.longDescription) {
                        doc.setFontSize(8.5)
                        totalHeight += 2
                        totalHeight += doc.splitTextToSize(item.longDescription, 75).length * 3.4
                    }
                    
                    data.cell.styles.minCellHeight = totalHeight + 2
                }
            },
            willDrawCell: (data: AutoTableHookData) => {
                if (data.section === 'body' && data.column.index === 1) {
                    data.cell.text = []; // Clear text to prevent autoTable from rendering double text
                }
            },
            didDrawCell: (data: AutoTableHookData) => {
                // Custom drawn cell text for Item column
                if (data.section === 'body' && data.column.index === 1) {
                    const item = quotation.items[data.row.index]
                    const doc = data.doc
                    const x = data.cell.x + 5
                    let y = data.cell.y + 5 + 3.5 // offset to baseline

                    const descText = getItemLabel(item)
                    doc.setFont("helvetica", "bold")
                    doc.setFontSize(10.5)
                    doc.setTextColor(15, 23, 42)
                    const descLines = doc.splitTextToSize(descText, 75)
                    doc.text(descLines, x, y)
                    y += descLines.length * 4.2

                    if (item.longDescription) {
                        doc.setFont("helvetica", "italic")
                        doc.setFontSize(8.5)
                        doc.setTextColor(100, 116, 139)
                        const longDescLines = doc.splitTextToSize(item.longDescription, 75)
                        y += 2
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
        const itemsSubtotal = quotation.items.reduce((sum, item) => sum + (item.quantity * Number(item.unitPrice) - Number(item.discount || 0)), 0)
        const discountAmount = quotation.discountType === "percent"
            ? (itemsSubtotal * Number(quotation.discount)) / 100
            : Number(quotation.discount)
        const subtotalAfterDiscount = itemsSubtotal - discountAmount
        const itemTaxTotal = quotation.items.reduce((sum, item) => sum + Number(item.tax || 0), 0)
        const taxAmount = itemTaxTotal > 0
            ? (itemTaxTotal / itemsSubtotal) * subtotalAfterDiscount
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
        doc.text(formatCurrency(itemsSubtotal, quotation.currency), totalsXValue, finalY, { align: "right" })
        finalY += 7

        if (discountAmount > 0) {
            doc.setTextColor(grayText[0], grayText[1], grayText[2])
            doc.text(`Discount ${quotation.discountType === "percent" ? `(${quotation.discount}%)` : ""}`, totalsXLabel, finalY)
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
            
            const termsText = [normalizeQuotationText(quotation.clientNote), normalizeQuotationText(quotation.termsConditions)].filter(Boolean).join("\n\n")
            const formattedTerms = doc.splitTextToSize(termsText, 170)
            doc.text(formattedTerms, 20, termsY)
            finalY = termsY + (formattedTerms.length * 4) + 12
        }

        const includedAttachments = quotation.attachments
            ?.filter((attachment) => attachment.includeInPdf && isImageAttachment(attachment))
            .slice(0, 4) ?? []
        if (includedAttachments.length > 0) {
            let attachmentY = finalY
            if (attachmentY > 235) {
                doc.addPage()
                attachmentY = 55
            }

            doc.setFillColor(248, 250, 252)
            doc.rect(15, attachmentY - 5, 180, Math.max(18, includedAttachments.length * 7 + 12), 'F')
            doc.setFont("helvetica", "bold")
            doc.setFontSize(9)
            doc.setTextColor(darkText[0], darkText[1], darkText[2])
            doc.text("ATTACHMENT PACKAGE", 20, attachmentY + 2)

            let lineY = attachmentY + 9
            doc.setFont("helvetica", "normal")
            doc.setFontSize(8.5)
            doc.setTextColor(grayText[0], grayText[1], grayText[2])
            includedAttachments.forEach((attachment, index) => {
                doc.text(`${index + 1}. ${attachment.title} (${attachment.fileName})`, 20, lineY)
                lineY += 6
            })
        }

        const outputFilename = `Quotation_${sanitizeFilenamePart(quotation.quotationNumber)}.pdf`

        if (!shouldMergeAttachments || includedAttachments.length === 0 || includedAttachments.every((attachment) => !attachment.fileUrl)) {
            downloadBlob(new Blob([doc.output("arraybuffer")], { type: "application/pdf" }), outputFilename)
            toast.success(
                shouldMergeAttachments
                    ? "PDF quotation berhasil didownload"
                    : "PDF quotation berhasil didownload dengan ukuran lebih ringan",
            )
            return
        }

        const skippedAttachments: string[] = []

        const wrapText = (text: string, maxCharsPerLine: number): string[] => {
            const lines: string[] = []
            const rawLines = text.split("\n")
            for (const rawLine of rawLines) {
                if (rawLine.trim() === "") {
                    lines.push("")
                    continue
                }
                let currentLine = ""
                const words = rawLine.split(" ")
                for (const word of words) {
                    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
                        currentLine = (currentLine + " " + word).trim()
                    } else {
                        if (currentLine !== "") {
                            lines.push(currentLine)
                        }
                        currentLine = word
                    }
                }
                if (currentLine !== "") {
                    lines.push(currentLine)
                }
            }
            return lines
        }

        type ImageAttachment = {
            attachment: typeof includedAttachments[number]
            dataUrl: string
            width: number
            height: number
            format: string
            globalIdx: number
        }
        const imageAttachments: ImageAttachment[] = []

        for (const attachment of includedAttachments) {
            const attachmentUrl = resolveUploadDocumentUrl(attachment.fileUrl)

            if (!attachmentUrl) {
                skippedAttachments.push(`${attachment.title}: file URL tidak tersedia`)
                continue
            }

            try {
                const fetchedAttachment = await fetchArrayBufferWithTimeout(attachmentUrl)
                const detectedMimeType = inferMimeType(
                    attachment.fileName,
                    fetchedAttachment.contentType || attachment.mimeType,
                )

                if (detectedMimeType.includes("png") || detectedMimeType.includes("jpeg") || detectedMimeType.includes("jpg")) {
                    const resizedAttachment = await resizeImageAttachmentForPdf(fetchedAttachment.bytes, detectedMimeType)
                    imageAttachments.push({
                        attachment,
                        dataUrl: resizedAttachment.dataUrl,
                        width: resizedAttachment.width,
                        height: resizedAttachment.height,
                        format: resizedAttachment.format,
                        globalIdx: imageAttachments.length,
                    })
                    continue
                }

                skippedAttachments.push(`${attachment.title}: format ${attachment.fileName.split(".").pop()?.toUpperCase() || "file"} belum didukung untuk merge`)
            } catch (attachmentError) {
                console.error(`Failed to merge attachment ${attachment.fileName}:`, attachmentError)
                const isTimeout = attachmentError instanceof DOMException && attachmentError.name === "AbortError"
                const isTooLarge = attachmentError instanceof Error && attachmentError.message === "IMAGE_TOO_LARGE"
                skippedAttachments.push(`${attachment.title}: ${isTimeout ? "timeout saat diambil" : isTooLarge ? "gambar terlalu besar" : "gagal digabung"}`)
            }
        }

        const LEFT_MARGIN = 15
        const RIGHT_MARGIN = 15
        const TOP_MARGIN = 14
        const BOTTOM_MARGIN = 18
        const HEADER_SPACING = 32
        const A4_WIDTH = 210
        const A4_HEIGHT = 297
        const contentWidth = A4_WIDTH - LEFT_MARGIN - RIGHT_MARGIN
        const CARD_GAP = 5
        const ROW_GAP = 5
        const cardWidth = (contentWidth - CARD_GAP) / 2

        for (let pageStart = 0; pageStart < imageAttachments.length; pageStart += 4) {
            const pageItems = imageAttachments.slice(pageStart, pageStart + 4)
            const pageNum = Math.floor(pageStart / 4)
            const totalPages = Math.ceil(imageAttachments.length / 4)

            doc.addPage()

            if (base64data) {
                doc.addImage(base64data, "JPEG", 0, 0, A4_WIDTH, A4_HEIGHT)
            }

            const headerY = TOP_MARGIN + HEADER_SPACING
            doc.setFont("helvetica", "bold")
            doc.setFontSize(12)
            doc.setTextColor(37, 99, 235)
            doc.text("LAMPIRAN PENDUKUNG", LEFT_MARGIN, headerY)

            const pageLabel = `Halaman ${pageNum + 1} dari ${totalPages}`
            doc.setFont("helvetica", "normal")
            doc.setFontSize(8)
            doc.setTextColor(100, 116, 139)
            doc.text(pageLabel, A4_WIDTH - RIGHT_MARGIN, headerY, { align: "right" })
            doc.setDrawColor(37, 99, 235)
            doc.setLineWidth(0.7)
            doc.line(LEFT_MARGIN, headerY + 4, A4_WIDTH - RIGHT_MARGIN, headerY + 4)

            const gridStartY = headerY + 8
            const gridHeight = A4_HEIGHT - gridStartY - BOTTOM_MARGIN
            const cardH = (gridHeight - ROW_GAP) / 2

            for (let itemIndex = 0; itemIndex < pageItems.length; itemIndex++) {
                const { attachment, dataUrl, width, height, format, globalIdx } = pageItems[itemIndex]
                const col = itemIndex % 2
                const row = Math.floor(itemIndex / 2)
                const cardX = LEFT_MARGIN + col * (cardWidth + CARD_GAP)
                const cardY = gridStartY + row * (cardH + ROW_GAP)

                doc.setFillColor(248, 250, 252)
                doc.setDrawColor(221, 230, 240)
                doc.setLineWidth(0.3)
                doc.rect(cardX, cardY, cardWidth, cardH, "FD")

                const headerBarH = 7
                doc.setFillColor(37, 99, 235)
                doc.rect(cardX, cardY, cardWidth, headerBarH, "F")

                doc.setFont("helvetica", "bold")
                doc.setFontSize(7)
                doc.setTextColor(255, 255, 255)
                doc.text(String(globalIdx + 1), cardX + 3, cardY + 4.7)

                const maxTitleChars = Math.floor((cardWidth - 14) / 2.2)
                const rawTitle = (attachment.title || attachment.fileName).toUpperCase()
                const titleText = rawTitle.length > maxTitleChars ? rawTitle.slice(0, maxTitleChars - 1) + "…" : rawTitle
                doc.text(titleText, cardX + 9, cardY + 4.7)

                let descBoxH = 0
                const descPad = 3
                const descFontSize = 7.5
                const descLineH = 4
                const descMaxChars = Math.floor((cardWidth - descPad * 2) / 1.9)
                let descLines: string[] = []
                if (attachment.description) {
                    descLines = wrapText(attachment.description, descMaxChars).slice(0, 3)
                    descBoxH = 6 + descLines.length * descLineH
                }

                const imgAreaY = cardY + headerBarH + 3
                const imgAreaH = cardH - headerBarH - descBoxH - 6
                if (imgAreaH > 20) {
                    const maxImgW = cardWidth - 6
                    const maxImgH = imgAreaH
                    const imgScale = Math.min(maxImgW / width, maxImgH / height)
                    const imgW = width * imgScale
                    const imgH = height * imgScale
                    const imgX = cardX + 3 + (maxImgW - imgW) / 2
                    const imgY = imgAreaY + (maxImgH - imgH) / 2

                    doc.addImage(dataUrl, format, imgX, imgY, imgW, imgH)
                }

                if (attachment.description && descBoxH > 0) {
                    const descY = cardY + cardH - descBoxH
                    doc.setDrawColor(226, 232, 240)
                    doc.line(cardX, descY, cardX + cardWidth, descY)
                    doc.setFont("helvetica", "bold")
                    doc.setFontSize(descFontSize)
                    doc.setTextColor(30, 41, 59)
                    doc.text("Ket:", cardX + descPad, descY + 4)

                    doc.setFont("helvetica", "normal")
                    doc.setTextColor(71, 85, 105)
                    let textY = descY + 8
                    for (const line of descLines) {
                        doc.text(line, cardX + descPad, textY)
                        textY += descLineH
                    }
                }
            }
        }

        downloadBlob(new Blob([doc.output("arraybuffer")], { type: "application/pdf" }), outputFilename)

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
