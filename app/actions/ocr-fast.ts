"use server"

import { createManagedUploadFilename, saveManagedUpload } from "@/lib/upload-storage"
import { extractPdfViaInspector } from "@/lib/vision-pdf-inspector"
import { structurePoFromMarkdown, structureDeliveryOrderFromMarkdown } from "@/lib/ai-document-structurer"
import { tryHeuristicPoParse } from "@/lib/heuristic-document-parser"

type BasicOcrItem = {
    product: string
    qty: number
    price: number
}

type BasicOcrResult = {
    customer_name: string
    po_number: string
    date: string
    items: BasicOcrItem[]
}

type DeliveryOrderBoxFields = {
    page?: string | null
    deliveryNo?: string | null
    internalNo?: string | null
    deliveryDate?: string | null
    customerPoNo?: string | null
    customerPoDate?: string | null
}

type DetectionSource = "label" | "pattern" | "ai" | "none"

/**
 * Fast PO OCR Trigger menggunakan vision.chitraparatama.com + Heuristic/OpenAI Mapping
 * Target waktu ekstraksi < 5 detik.
 */
export async function triggerSalesOrderBasicOcrFast(formData: FormData) {
    try {
        const file = formData.get("file")
        if (!(file instanceof File)) {
            return { success: false as const, error: "File wajib diisi" }
        }

        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name)

        if (!isPdf && !isImage) {
            return { success: false as const, error: "Format file tidak didukung. Harap gunakan file PDF atau Gambar (PNG/JPG/WEBP)." }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = createManagedUploadFilename(file.name)
        const savedUploadPromise = saveManagedUpload({
            filename,
            buffer,
            contentType: file.type,
        })
        savedUploadPromise.catch(() => undefined)

        let basic: BasicOcrResult | null = null
        let rawText = ""
        let model = "vision-pdf-inspector-v1"
        let pagesProcessed = 1
        let providerWarning: string | undefined

        // Ekstraksi teks & markdown dokumen melalui engine vision.chitraparatama.com
        try {
            console.log(`[SO-OCR] Memproses dokumen via vision.chitraparatama.com: ${file.name}`)
            const inspectorResult = await extractPdfViaInspector(buffer, file.name, {
                auto_ocr: true,
                pages: "1,2,3",
                contentType: file.type,
                timeoutMs: 15000,
            })

            const markdown = inspectorResult.data?.markdown || ""
            rawText = markdown
            pagesProcessed = inspectorResult.data?.page_count || 1

            if (markdown.trim()) {
                // Layer 1: Coba Heuristic Fast Deterministic Table & Anchor Parser (< 5ms)
                const heuristic = tryHeuristicPoParse(markdown)
                if (heuristic.success && heuristic.data?.products && heuristic.data.products.length > 0) {
                    basic = {
                        customer_name: sanitizeText(heuristic.data.customer_company_name),
                        po_number: sanitizeText(heuristic.data.po_number),
                        date: sanitizeText(heuristic.data.document_date),
                        items: heuristic.data.products.map((p) => ({
                            product: sanitizeText(p.name),
                            qty: Number(p.qty) || 0,
                            price: Number(p.unit_price) || 0,
                        })),
                    }
                    model = `vision-pdf-inspector-heuristic (${inspectorResult.data?.pdf_type || "fast"})`
                } else {
                    // Layer 2: OpenAI API Structuring jika format dokumen non-standar
                    console.log(`[SO-OCR] Memetakan Markdown ke struktur PO via OpenAI API...`)
                    const structured = await structurePoFromMarkdown(markdown)
                    basic = {
                        customer_name: sanitizeText(structured.customer_company_name),
                        po_number: sanitizeText(structured.po_number),
                        date: sanitizeText(structured.document_date),
                        items: (structured.products || []).map((p) => ({
                            product: sanitizeText(p.name),
                            qty: Number(p.qty) || 0,
                            price: Number(p.unit_price) || 0,
                        })),
                    }
                    model = `vision-pdf-inspector-openai (${inspectorResult.data?.pdf_type || "fast"})`
                }
            }
        } catch (microserviceErr) {
            console.error("[SO-OCR] vision.chitraparatama.com failed:", microserviceErr)
            providerWarning = `Engine OCR gagal: ${getErrorMessage(microserviceErr)}`
        }

        if (!basic || !hasMeaningfulBasicResult(basic)) {
            return {
                success: false as const,
                error: providerWarning || "OCR belum berhasil membaca data PO. Pastikan dokumen terbaca jelas atau ulangi proses.",
                fileUrl: (await savedUploadPromise).url,
                rawText: sanitizeText(rawText),
            }
        }

        return {
            success: true as const,
            fileUrl: (await savedUploadPromise).url,
            fileName: file.name,
            fileType: file.type,
            basic,
            rawText: sanitizeText(rawText),
            model,
            pagesProcessed,
            providerWarning,
        }
    } catch (error) {
        return {
            success: false as const,
            error: getErrorMessage(error),
        }
    }
}

/**
 * Fast Delivery Order (DO) OCR Trigger menggunakan vision.chitraparatama.com
 */
export async function triggerDoScanOcrFast(formData: FormData) {
    try {
        const file = formData.get("file")
        if (!(file instanceof File)) {
            return { success: false as const, error: "File wajib diisi" }
        }

        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
        const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name)

        if (!isPdf && !isImage) {
            return { success: false as const, error: "Hanya file PDF atau Gambar yang didukung untuk OCR DO" }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = createManagedUploadFilename(file.name)
        const savedUpload = await saveManagedUpload({
            filename,
            buffer,
            contentType: file.type,
        })

        // Ekstraksi markdown via vision.chitraparatama.com
        const inspectorResult = await extractPdfViaInspector(buffer, file.name, {
            auto_ocr: true,
            pages: "1",
            contentType: file.type,
            timeoutMs: 15000,
        })

        const markdown = inspectorResult.data?.markdown || ""
        let extractedInternal = extractInternalNo(markdown)
        let deliveryNumber = extractDeliveryNumber(markdown)

        // Jika pola regex belum menemukan internal no atau delivery no, gunakan OpenAI
        if (!extractedInternal.internalNo || !deliveryNumber) {
            try {
                const structured = await structureDeliveryOrderFromMarkdown(markdown)
                if (!extractedInternal.internalNo && structured.internal_no) {
                    extractedInternal = {
                        internalNo: normalizeInternalNo(structured.internal_no),
                        source: "ai",
                    }
                }
                if (!deliveryNumber && structured.delivery_number) {
                    deliveryNumber = structured.delivery_number
                }
            } catch (aiErr) {
                console.warn("[DO-OCR] OpenAI DO fallback warning:", aiErr)
            }
        }

        const fields: DeliveryOrderBoxFields = {
            deliveryNo: deliveryNumber,
            internalNo: extractedInternal.internalNo,
        }

        return {
            success: true as const,
            fileUrl: savedUpload.url,
            deliveryNumber,
            internalNo: extractedInternal.internalNo,
            detectionSource: extractedInternal.source,
            rawText: sanitizeText(markdown),
            fields,
            model: `vision-pdf-inspector (${inspectorResult.data?.pdf_type || "ocr"})`,
            pagesProcessed: inspectorResult.data?.page_count || 1,
        }
    } catch (error) {
        return {
            success: false as const,
            error: getErrorMessage(error),
        }
    }
}

function sanitizeText(value: string | null | undefined): string {
    return String(value ?? "").replace(/\u0000/g, " ").trim()
}

function hasMeaningfulBasicResult(result: BasicOcrResult) {
    const blockedValues = new Set(["", "unknown customer", "unknown po", "unknown product", "-", "n/a"])

    const hasCustomer = !blockedValues.has(result.customer_name.trim().toLowerCase())
    const hasPoNumber = !blockedValues.has(result.po_number.trim().toLowerCase())
    const hasDate = !blockedValues.has(result.date.trim().toLowerCase())
    const hasItems = result.items.some((item) => {
        const name = item.product.trim().toLowerCase()
        return !blockedValues.has(name) || item.qty > 0 || item.price > 0
    })

    return hasItems && (hasCustomer || hasPoNumber || hasDate)
}

function extractInternalNo(rawText: string): { internalNo: string | null; source: DetectionSource } {
    const normalizedText = sanitizeText(rawText)

    const labelPatterns = [
        /internal\s*(?:number|no|#)?\s*[:.;-]?\s*([a-z0-9][a-z0-9\-/]*)/i,
        /internal\s*no\s*[:.;-]?\s*([a-z0-9][a-z0-9\-/]*)/i,
    ]

    for (const pattern of labelPatterns) {
        const match = normalizedText.match(pattern)
        const candidate = normalizeInternalNo(match?.[1])
        if (candidate) {
            return { internalNo: candidate, source: "label" }
        }
    }

    const genericMatch = normalizedText.match(/\bDLV[\s\-\/]*\d{8}[\s\-\/]*\d{4}\b/i)
    const genericCandidate = normalizeInternalNo(genericMatch?.[0])
    if (genericCandidate) {
        return { internalNo: genericCandidate, source: "pattern" }
    }

    return { internalNo: null, source: "none" }
}

function extractDeliveryNumber(rawText: string): string | null {
    const normalizedText = sanitizeText(rawText)
    const patterns = [
        /delivery\s*(?:no|order|number|#)\s*[:.;-]?\s*([a-z0-9\-\/]+)/i,
        /surat\s*jalan\s*(?:no|#)?\s*[:.;-]?\s*([a-z0-9\-\/]+)/i,
        /\b(CP\/SCD\/\d{4}\/\d{3,4})\b/i,
    ]

    for (const pattern of patterns) {
        const match = normalizedText.match(pattern)
        if (match?.[1]) {
            return match[1].trim()
        }
    }
    return null
}

function normalizeInternalNo(value: string | null | undefined): string | null {
    if (!value) return null

    const cleaned = value
        .toUpperCase()
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, "")
        .replace(/[^A-Z0-9/-]/g, "")
        .replace(/\//g, "-")

    const compact = cleaned.replace(/[^A-Z0-9]/g, "")
    const dlvMatch = compact.match(/(DLV)(\d{8})(\d{4})/)
    if (dlvMatch) {
        const normalizedDate = forceDeliveryYear2026(dlvMatch[2])
        return `${dlvMatch[1]}-${normalizedDate}-${dlvMatch[3]}`
    }

    return cleaned || null
}

function forceDeliveryYear2026(dateToken: string) {
    if (/^\d{8}$/.test(dateToken)) {
        return `2026${dateToken.slice(4)}`
    }
    return dateToken
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message
    }
    return String(error)
}
