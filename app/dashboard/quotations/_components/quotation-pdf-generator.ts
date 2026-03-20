import { toast } from "sonner"
import type { Customer, Product } from "@/lib/types"

interface QuotationPdfData {
    quotationNumber: string | null
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
        product: Product
        description: string | null
        longDescription: string | null
        quantity: number
        unitPrice: string
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

export async function generateQuotationPdf(quotation: QuotationPdfData) {
    try {
        const { default: jsPDF } = await import("jspdf")
        const autoTable = (await import("jspdf-autotable")).default

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        })

        // Load background image
        let base64data = ""
        try {
            const response = await fetch("/ChitraParatama_Stationery_Letterhead_jkt.jpg")
            if (response.ok) {
                const blob = await response.blob()
                base64data = await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(blob)
                })
            }
        } catch (e) {
            console.error("Failed to load letterhead image", e)
        }

        // Add background to first page
        if (base64data) {
            doc.addImage(base64data, 'JPEG', 0, 0, 210, 297)
        }

        // Override addPage to automatically add background to new pages
        const originalAddPage = doc.addPage.bind(doc)
        ;(doc as any).addPage = function(...args: any[]) {
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
        doc.text(quotation.quotationNumber || "DRAFT", 195, 56, { align: "right" })

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
            const lineTitle = item.product.materialDescription || item.product.materialNumber
            const desc = item.longDescription ? `${item.description || ""}\n${item.longDescription}` : item.description || ""
            
            // We just pass it simply to keep row data, we will wipe display and custom draw
            const combinedContent = lineTitle;

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
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 1) {
                    const item = quotation.items[data.row.index]
                    const doc = data.doc

                    let totalHeight = 8 
                    
                    doc.setFontSize(10.5)
                    const descText = item.description || item.product.materialDescription || item.product.materialNumber || ""
                    totalHeight += doc.splitTextToSize(descText, 75).length * 4.2
                    
                    if (item.longDescription) {
                        doc.setFontSize(8.5)
                        totalHeight += 2
                        totalHeight += doc.splitTextToSize(item.longDescription, 75).length * 3.4
                    }
                    
                    data.cell.styles.minCellHeight = totalHeight + 2
                }
            },
            willDrawCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 1) {
                    data.cell.text = []; // Clear text to prevent autoTable from rendering double text
                }
            },
            didDrawCell: (data: any) => {
                // Custom drawn cell text for Item column
                if (data.section === 'body' && data.column.index === 1) {
                    const item = quotation.items[data.row.index]
                    const doc = data.doc
                    const x = data.cell.x + 5
                    let y = data.cell.y + 5 + 3.5 // offset to baseline

                    const descText = item.description || item.product.materialDescription || item.product.materialNumber || ""
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
            didDrawPage: (data: any) => {
                // Optionally add footer here
            }
        })

        finalY = (doc as any).lastAutoTable.finalY + 10

        // Subtotals
        const itemsSubtotal = quotation.items.reduce((sum, item) => sum + (item.quantity * Number(item.unitPrice)), 0)
        const discountAmount = quotation.discountType === "percent"
            ? (itemsSubtotal * Number(quotation.discount)) / 100
            : Number(quotation.discount)
        const taxAmount = Number(quotation.tax)
        const grandTotal = itemsSubtotal - discountAmount + taxAmount + Number(quotation.shipping)

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
            
            const termsText = [quotation.termsConditions, quotation.clientNote].filter(Boolean).join("\n\n")
            const formattedTerms = doc.splitTextToSize(termsText, 170)
            doc.text(formattedTerms, 20, termsY)
        }

        // Generate and save
        doc.save(`Quotation_${quotation.quotationNumber || 'Draft'}.pdf`)
        toast.success("PDF Downloaded successfully")
        
    } catch (error) {
        console.error("Failed to generate PDF:", error)
        toast.error("Failed to generate PDF")
    }
}
