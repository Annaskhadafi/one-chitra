import { toast } from "sonner"
import type { Customer, Product } from "@/lib/types"
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
    }[]
    attachments?: {
        title: string
        fileName: string
        fileUrl?: string
        mimeType?: string | null
        kind: string
        includeInPdf: boolean
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
    }[]
    attachments?: {
        title: string
        fileName: string
        fileUrl?: string
        mimeType?: string | null
        kind: string
        includeInPdf: boolean
    }[]
}

function formatCurrency(value: number, currency = "IDR") {
    if (currency === "USD") {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
    }
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function sanitizeFilenamePart(value: string | null | undefined) {
    return (value || "Draft").replace(/[\\/:*?"<>|]+/g, "-").trim() || "Draft"
}

function getItemTitle(item: QuotationPdfData["items"][number]) {
    return item.description || item.product?.materialDescription || item.product?.materialNumber || "Unnamed item"
}

function getItemSubtitle(item: QuotationPdfData["items"][number]) {
    return item.longDescription || item.product?.materialNumber || ""
}

function buildMultilineText(value: string | null | undefined, fallback?: string) {
    const lines = (value || fallback || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

    return lines.length > 0 ? lines : fallback ? [fallback] : []
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
        termsConditions: source.termsConditions,
        clientNote: source.clientNote,
        items: source.items.map((item) => ({
            product: item.product,
            description: item.description,
            longDescription: item.longDescription,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
        })),
        attachments: source.attachments?.map((attachment) => ({
            title: attachment.title,
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl,
            mimeType: attachment.mimeType,
            kind: attachment.kind,
            includeInPdf: attachment.includeInPdf,
        })),
    }
}

function inferMimeType(fileName: string, mimeType?: string | null) {
    const normalizedMimeType = mimeType?.toLowerCase().trim()
    if (normalizedMimeType && normalizedMimeType !== "application/octet-stream" && normalizedMimeType !== "binary/octet-stream") {
        return normalizedMimeType
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

async function convertImageBlobToPdfPngBytes(blob: Blob) {
    if (blob.type === "image/png") {
        return await blob.arrayBuffer()
    }

    const imageUrl = URL.createObjectURL(blob)

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image()
            element.onload = () => resolve(element)
            element.onerror = () => reject(new Error("Image failed to load for PDF merge"))
            element.src = imageUrl
        })

        const canvas = document.createElement("canvas")
        canvas.width = image.naturalWidth || image.width
        canvas.height = image.naturalHeight || image.height

        const context = canvas.getContext("2d")
        if (!context) {
            throw new Error("Canvas context unavailable for image merge")
        }

        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        const convertedBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((result) => {
                if (!result) {
                    reject(new Error("Failed to convert image attachment"))
                    return
                }
                resolve(result)
            }, "image/png")
        })

        return await convertedBlob.arrayBuffer()
    } finally {
        URL.revokeObjectURL(imageUrl)
    }
}

type MergeReadyAttachment =
    | {
        status: "ready"
        attachment: NonNullable<QuotationPdfData["attachments"]>[number]
        detectedMimeType: string
        blob: Blob
        bytes: ArrayBuffer
    }
    | {
        status: "skipped"
        attachmentTitle: string
        reason: string
    }

async function prepareAttachmentForMerge(
    attachment: NonNullable<QuotationPdfData["attachments"]>[number],
): Promise<MergeReadyAttachment> {
    const resolvedAttachmentUrl = resolveUploadDocumentUrl(attachment.fileUrl)

    if (!resolvedAttachmentUrl) {
        return {
            status: "skipped",
            attachmentTitle: attachment.title,
            reason: "file URL tidak tersedia",
        }
    }

    try {
        const response = await fetch(resolvedAttachmentUrl, { cache: "no-store" })
        if (!response.ok) {
            return {
                status: "skipped",
                attachmentTitle: attachment.title,
                reason: "file tidak bisa diakses",
            }
        }

        const attachmentBlob = await response.blob()
        const attachmentBytes = await attachmentBlob.arrayBuffer()
        const detectedMimeType = inferMimeType(
            attachment.fileName,
            attachmentBlob.type || response.headers.get("content-type") || attachment.mimeType,
        )

        return {
            status: "ready",
            attachment,
            detectedMimeType,
            blob: attachmentBlob,
            bytes: attachmentBytes,
        }
    } catch (error) {
        console.error(`Failed to prepare attachment ${attachment.fileName}:`, error)
        return {
            status: "skipped",
            attachmentTitle: attachment.title,
            reason: "gagal diambil",
        }
    }
}

export async function generateQuotationPdf(quotation: QuotationPdfData) {
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
            format: "a4"
        })

        const loadImageAsDataUrl = async (path: string) => {
            try {
                const response = await fetch(path)
                if (!response.ok) return ""
                const blob = await response.blob()
                return await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(blob)
                })
            } catch {
                return ""
            }
        }

        const logoData = await loadImageAsDataUrl("/brand/Chitra-Paratama.png")
        const originalAddPage = doc.addPage.bind(doc)
        const mutableDoc = doc as typeof doc & { lastAutoTable?: { finalY: number } }
        const senderAddressLines = buildMultilineText(
            quotation.address,
            "Gedung TMT 1, Lt. 5, Jl. Cilandak KKO No. 1, Jakarta 12560 Indonesia",
        )
        const recipientAddressLines = [
            quotation.customer.address1,
            quotation.customer.address2,
            quotation.customer.address3,
            quotation.customer.address4,
            quotation.customer.address5,
        ].filter(Boolean) as string[]
        const termsLines = buildMultilineText(quotation.termsConditions, "Payment Terms: 30 days after Date Invoice")
        const noteLines = buildMultilineText(quotation.clientNote)
        const brandColor: [number, number, number] = [54, 87, 157]
        const titleColor: [number, number, number] = [45, 91, 178]
        const darkText: [number, number, number] = [22, 49, 83]
        const mutedText: [number, number, number] = [98, 115, 138]

        const drawPageChrome = () => {
            doc.setFillColor(255, 255, 255)
            doc.rect(0, 0, 210, 297, "F")

            doc.setFillColor(246, 249, 253)
            doc.circle(-12, -10, 46, "F")

            if (logoData) {
                doc.setGState?.(new (jsPDF as unknown as { GState: new (opts: { opacity: number }) => unknown }).GState({ opacity: 0.08 }) as never)
                doc.addImage(logoData, "PNG", 126, 208, 92, 92)
                doc.setGState?.(new (jsPDF as unknown as { GState: new (opts: { opacity: number }) => unknown }).GState({ opacity: 1 }) as never)
            }

            doc.setFont("helvetica", "bold")
            doc.setFontSize(6.4)
            doc.setTextColor(95, 110, 132)
            doc.text("PT Chitra Paratama", 14, 286)
            doc.setFont("helvetica", "normal")
            doc.setTextColor(122, 135, 153)
            doc.text("Gedung TMT 1, Lt. 5, Jl. Cilandak KKO No. 1, Jakarta 12560 Indonesia", 14, 289.5)
            doc.text("P +62 21 2997 6661 | F +62 21 2997 6660", 14, 293)
            doc.setTextColor(54, 87, 157)
            doc.setFont("helvetica", "bold")
            doc.text("www.chitraparatama.co.id", 14, 296.5)
        }

        doc.addPage = (...args: Parameters<typeof originalAddPage>) => {
            originalAddPage(...args)
            drawPageChrome()
            return doc
        }

        drawPageChrome()

        if (logoData) {
            doc.addImage(logoData, "PNG", 14, 10, 42, 18)
        }

        doc.setFont("helvetica", "bold")
        doc.setFontSize(8.6)
        doc.setTextColor(15, 28, 56)
        doc.text("PT Chitra Paratama", 14, 34)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(7.5)
        doc.setTextColor(mutedText[0], mutedText[1], mutedText[2])
        let senderY = 39
        senderAddressLines.forEach((line) => {
            doc.text(line, 14, senderY)
            senderY += 3.4
        })

        doc.setFont("helvetica", "bold")
        doc.setFontSize(23)
        doc.setTextColor(titleColor[0], titleColor[1], titleColor[2])
        doc.text("QUOTATION", 196, 18, { align: "right" })
        doc.setFontSize(7.4)
        doc.setTextColor(65, 84, 111)
        doc.text(`${quotation.quotationNumber || "DRAFT"} | Rev.${quotation.currentRevision ?? 0}`, 196, 24, { align: "right" })

        doc.setFontSize(7)
        doc.setTextColor(61, 91, 134)
        doc.text("TO", 196, 34, { align: "right" })
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8)
        doc.setTextColor(darkText[0], darkText[1], darkText[2])
        const customerNameLines = doc.splitTextToSize(quotation.customer.name.toUpperCase(), 72)
        let recipientY = 38
        customerNameLines.forEach((line: string) => {
            doc.text(line, 196, recipientY, { align: "right" })
            recipientY += 3.6
        })
        doc.setFont("helvetica", "normal")
        doc.setFontSize(7.2)
        doc.setTextColor(mutedText[0], mutedText[1], mutedText[2])
        const customerAddressLines = doc.splitTextToSize(recipientAddressLines.join("\n").toUpperCase() || "-", 72)
        customerAddressLines.forEach((line: string) => {
            doc.text(line, 196, recipientY, { align: "right" })
            recipientY += 3.2
        })

        doc.setDrawColor(135, 164, 218)
        doc.setLineWidth(0.4)
        doc.line(14, 54, 196, 54)
        doc.setFillColor(240, 244, 251)
        doc.rect(14, 54.4, 182, 13.6, "F")
        doc.setDrawColor(220, 230, 244)
        doc.line(105, 54.4, 105, 68)

        doc.setFont("helvetica", "bold")
        doc.setFontSize(7.1)
        doc.setTextColor(83, 112, 149)
        doc.text("QUO DATE:", 18, 59.2)
        doc.text("VALIDITY QUOTE:", 18, 63.9)
        doc.text("FROM:", 109, 59.2)
        doc.text("ATTN:", 109, 63.9)

        doc.setTextColor(15, 28, 56)
        doc.text(formatDate(quotation.quotationDate), 42, 59.2)
        doc.text(quotation.validUntil ? formatDate(quotation.validUntil) : "-", 42, 63.9)
        doc.text(quotation.salesPerson?.name || "-", 122, 59.2)
        doc.text(quotation.attn || "-", 122, 63.9)

        const tableStartY = 73
        const tableBody = quotation.items.map((item, index) => {
            const amount = item.quantity * Number(item.unitPrice)
            return [
                String(index + 1),
                getItemTitle(item),
                String(item.quantity),
                formatNumber(Number(item.unitPrice)),
                formatNumber(amount),
            ]
        })

        autoTable(doc, {
            startY: tableStartY,
            margin: { left: 14, right: 14, bottom: 55, top: 10 },
            head: [["#", "ITEM", "QTY", "PRICE", "AMOUNT"]],
            body: tableBody,
            theme: "plain",
            headStyles: {
                fillColor: brandColor,
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 7,
                cellPadding: { top: 3.4, right: 3, bottom: 3.2, left: 3 },
            },
            bodyStyles: {
                fontSize: 7.4,
                textColor: darkText,
                cellPadding: { top: 4.2, right: 3, bottom: 4.2, left: 3 },
                lineWidth: 0,
            },
            columnStyles: {
                0: { cellWidth: 10, halign: "center" },
                1: { cellWidth: 98 },
                2: { cellWidth: 16, halign: "center" },
                3: { cellWidth: 28, halign: "right" },
                4: { cellWidth: 30, halign: "right" },
            },
            didParseCell: (data: AutoTableHookData) => {
                if (data.section === "body" && data.column.index === 1) {
                    const item = quotation.items[data.row.index]
                    const titleLines = data.doc.splitTextToSize(getItemTitle(item), 90)
                    const subtitle = getItemSubtitle(item)
                    const subtitleLines = subtitle ? data.doc.splitTextToSize(subtitle, 90) : []
                    data.cell.styles.minCellHeight = 8 + titleLines.length * 3.2 + subtitleLines.length * 3
                }
            },
            willDrawCell: (data: AutoTableHookData) => {
                if (data.section === "body" && data.column.index === 1) {
                    data.cell.text = []
                }
            },
            didDrawCell: (data: AutoTableHookData) => {
                if (data.section !== "body" || data.column.index !== 1) return
                const item = quotation.items[data.row.index]
                const x = data.cell.x + 3
                let y = data.cell.y + 4.6

                doc.setFont("helvetica", "bold")
                doc.setFontSize(7.5)
                doc.setTextColor(darkText[0], darkText[1], darkText[2])
                const titleLines = doc.splitTextToSize(getItemTitle(item), 90)
                doc.text(titleLines, x, y)
                y += titleLines.length * 3.2

                const subtitle = getItemSubtitle(item)
                if (subtitle) {
                    doc.setFont("helvetica", "italic")
                    doc.setFontSize(6.8)
                    doc.setTextColor(106, 125, 149)
                    const subtitleLines = doc.splitTextToSize(subtitle, 90)
                    doc.text(subtitleLines, x, y + 0.3)
                }
            },
            didDrawPage: () => {
                drawPageChrome()
            },
        })

        let finalY = (mutableDoc.lastAutoTable?.finalY ?? tableStartY) + 9
        const itemsSubtotal = quotation.items.reduce((sum, item) => sum + (item.quantity * Number(item.unitPrice)), 0)
        const discountAmount = quotation.discountType === "percent"
            ? (itemsSubtotal * Number(quotation.discount)) / 100
            : Number(quotation.discount)
        const taxAmount = Number(quotation.tax)
        const grandTotal = itemsSubtotal - discountAmount + taxAmount + Number(quotation.shipping)

        const totalsX = 135
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8)
        doc.setTextColor(29, 51, 88)
        doc.text("Sub Total", totalsX, finalY)
        doc.text(formatCurrency(itemsSubtotal, quotation.currency), 196, finalY, { align: "right" })
        finalY += 4.8

        if (discountAmount > 0) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(7.5)
            doc.setTextColor(81, 103, 133)
            doc.text("Discount", totalsX, finalY)
            doc.text(`-${formatCurrency(discountAmount, quotation.currency)}`, 196, finalY, { align: "right" })
            finalY += 4.3
        }

        if (taxAmount > 0) {
            doc.text("Tax", totalsX, finalY)
            doc.text(formatCurrency(taxAmount, quotation.currency), 196, finalY, { align: "right" })
            finalY += 4.3
        }

        doc.setFillColor(54, 87, 157)
        doc.roundedRect(132, finalY - 1.8, 64, 9.4, 2.3, 2.3, "F")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8.8)
        doc.setTextColor(255, 255, 255)
        doc.text("TOTAL", 140, finalY + 3.4)
        doc.text(formatCurrency(grandTotal, quotation.currency), 192.5, finalY + 3.4, { align: "right" })
        finalY += 16

        if (finalY > 226) {
            doc.addPage()
            finalY = 72
        }

        doc.setFillColor(255, 243, 230)
        doc.roundedRect(14, finalY, 82, 36, 3, 3, "F")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(7.2)
        doc.setTextColor(61, 79, 116)
        doc.text("TERMS & CONDITIONS", 20, finalY + 6)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(6.9)
        doc.setTextColor(107, 111, 139)
        let termsY = finalY + 10
        ;[...termsLines, ...noteLines].forEach((line) => {
            doc.text(line, 20, termsY)
            termsY += 3.3
        })
        doc.text("PT. CHITRA PARATAMA", 20, termsY + 2)
        doc.text("BANK MANDIRI", 20, termsY + 5.3)
        doc.text("Branch Cilandak KKO, Jakarta Selatan 12560", 20, termsY + 8.6)
        doc.text("IDR A/C NO:127 - 000 - 00 - 17416", 20, termsY + 11.9)

        const includedAttachments = quotation.attachments?.filter((attachment) => attachment.includeInPdf && attachment.kind !== "customer_po") ?? []
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

        const basePdfBytes = doc.output("arraybuffer")
        const outputFilename = `Quotation_${sanitizeFilenamePart(quotation.quotationNumber)}.pdf`

        if (includedAttachments.length === 0 || includedAttachments.every((attachment) => !attachment.fileUrl)) {
            downloadBlob(new Blob([basePdfBytes], { type: "application/pdf" }), outputFilename)
            toast.success("PDF quotation berhasil didownload")
            return
        }

        const { PDFDocument } = await import("pdf-lib")
        const mergedPdf = await PDFDocument.load(basePdfBytes)
        const skippedAttachments: string[] = []
        const A4_WIDTH = 595.28
        const A4_HEIGHT = 841.89
        const PAGE_MARGIN = 24
        const TITLE_SPACE = 24

        const preparedAttachments = await Promise.all(
            includedAttachments.map((attachment) => prepareAttachmentForMerge(attachment)),
        )

        for (const preparedAttachment of preparedAttachments) {
            if (preparedAttachment.status === "skipped") {
                skippedAttachments.push(`${preparedAttachment.attachmentTitle}: ${preparedAttachment.reason}`)
                continue
            }

            const { attachment, detectedMimeType, blob, bytes } = preparedAttachment

            try {
                if (detectedMimeType.includes("pdf")) {
                    const attachmentPdf = await PDFDocument.load(bytes)
                    const copiedPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
                    copiedPages.forEach((page) => mergedPdf.addPage(page))
                    continue
                }

                if (detectedMimeType.startsWith("image/")) {
                    const convertedImageBytes = await convertImageBlobToPdfPngBytes(blob)
                    const image = await mergedPdf.embedPng(convertedImageBytes)

                    const page = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT])
                    const availableWidth = A4_WIDTH - PAGE_MARGIN * 2
                    const availableHeight = A4_HEIGHT - PAGE_MARGIN * 2 - TITLE_SPACE
                    const scale = Math.min(availableWidth / image.width, availableHeight / image.height, 1)
                    const imageWidth = image.width * scale
                    const imageHeight = image.height * scale
                    const x = (A4_WIDTH - imageWidth) / 2
                    const y = PAGE_MARGIN + Math.max((availableHeight - imageHeight) / 2, 0)

                    page.drawText(attachment.title || attachment.fileName, {
                        x: PAGE_MARGIN,
                        y: A4_HEIGHT - PAGE_MARGIN - 4,
                        size: 12,
                    })
                    page.drawImage(image, {
                        x,
                        y,
                        width: imageWidth,
                        height: imageHeight,
                    })
                    continue
                }

                skippedAttachments.push(`${attachment.title}: format ${attachment.fileName.split(".").pop()?.toUpperCase() || "file"} belum didukung untuk merge`)
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
