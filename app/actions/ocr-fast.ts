"use server"

import { createManagedUploadFilename, saveManagedUpload } from "@/lib/upload-storage"
import { extractStructuredFromPoViaOllama } from "@/lib/ollama-so-ocr"
import { extractStructuredFromDocument } from "@/lib/mistral-ocr"
import { extractRawTextFromDocumentViaOllama } from "@/lib/ollama-vision-ocr"

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

type DetectionSource = "label" | "pattern" | "none"

export async function triggerSalesOrderBasicOcrFast(formData: FormData) {
    try {
        const file = formData.get("file")
        if (!(file instanceof File)) {
            return { success: false as const, error: "File wajib diisi" }
        }

        const allowedTypes = new Set(["application/pdf"])
        if (!allowedTypes.has(file.type)) {
            return { success: false as const, error: "Hanya file PDF yang didukung untuk Sales Order OCR" }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = createManagedUploadFilename(file.name)
        const savedUpload = await saveManagedUpload({
            filename,
            buffer,
            contentType: file.type,
        })

        const hasMistralKey = Boolean(process.env.MISTRAL_API_KEY?.trim())
        let providerWarning: string | undefined
        let ocr = await extractStructuredFromPoViaOllama({
            fileBuffer: buffer,
            filename: file.name,
            pages: [1],
        }).catch(async (error) => {
            if (!hasMistralKey) {
                throw error
            }

            providerWarning = `OCR utama gagal, dialihkan ke fallback: ${getErrorMessage(error)}`
            return extractStructuredFromDocument({
                fileBuffer: buffer,
                filename: file.name,
                pages: [1],
            })
        })

        let basic = toBasicPayload(ocr)
        if (!hasMeaningfulBasicResult(basic) && hasMistralKey && !providerWarning) {
            const fallbackOcr = await extractStructuredFromDocument({
                fileBuffer: buffer,
                filename: file.name,
                pages: [1],
            })
            ocr = fallbackOcr
            basic = toBasicPayload(fallbackOcr)
        }

        if (!hasMeaningfulBasicResult(basic)) {
            return {
                success: false as const,
                error: "OCR belum berhasil membaca data PO. Coba file yang lebih jelas atau ulangi proses.",
                fileUrl: savedUpload.url,
                rawText: sanitizeText(ocr.rawText),
            }
        }

        return {
            success: true as const,
            fileUrl: savedUpload.url,
            fileName: file.name,
            fileType: file.type,
            basic,
            rawText: sanitizeText(ocr.rawText),
            model: ocr.model,
            pagesProcessed: ocr.pagesProcessed,
            providerWarning,
        }
    } catch (error) {
        return {
            success: false as const,
            error: getErrorMessage(error),
        }
    }
}

export async function triggerDoScanOcrFast(formData: FormData) {
    try {
        const file = formData.get("file")
        if (!(file instanceof File)) {
            return { success: false as const, error: "File wajib diisi" }
        }

        const allowedTypes = new Set(["application/pdf"])
        if (!allowedTypes.has(file.type)) {
            return { success: false as const, error: "Hanya file PDF yang didukung untuk OCR DO" }
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = createManagedUploadFilename(file.name)
        const savedUpload = await saveManagedUpload({
            filename,
            buffer,
            contentType: file.type,
        })

        const ocr = await extractRawTextFromDocumentViaOllama({
            fileBuffer: buffer,
            filename: file.name,
            pages: [1],
        })

        const directInternalNo = normalizeInternalNo(ocr.fields.internalNo)
        const extracted = directInternalNo
            ? { internalNo: directInternalNo, source: "label" as DetectionSource }
            : extractInternalNo(ocr.focusedText || ocr.rawText)

        return {
            success: true as const,
            fileUrl: savedUpload.url,
            internalNo: extracted.internalNo,
            detectionSource: extracted.source,
            rawText: sanitizeText(selectDisplayText(ocr.focusedText, ocr.rawText)),
            fields: ocr.fields as DeliveryOrderBoxFields,
            model: ocr.model,
            pagesProcessed: ocr.pagesProcessed,
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

function toBasicPayload(ocr: {
    structured: {
        customer_company_name: string
        po_number: string
        document_date: string
        products: Array<{ name: string; qty: number; unit_price: number }>
    }
}) {
    return {
        customer_name: sanitizeText(ocr.structured.customer_company_name),
        po_number: sanitizeText(ocr.structured.po_number),
        date: sanitizeText(ocr.structured.document_date),
        items: ocr.structured.products
            .map((item) => ({
                product: sanitizeText(item.name),
                qty: Number.isFinite(item.qty) ? item.qty : 0,
                price: Number.isFinite(item.unit_price) ? item.unit_price : 0,
            }))
            .filter((item) => item.product || item.qty > 0 || item.price > 0),
    } satisfies BasicOcrResult
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

    return hasCustomer || hasPoNumber || hasDate || hasItems
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

function selectDisplayText(focusedText: string | null | undefined, rawText: string | null | undefined) {
    const focused = sanitizeText(focusedText)
    const raw = sanitizeText(rawText)
    return focused || raw
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message
    }
    return String(error)
}
