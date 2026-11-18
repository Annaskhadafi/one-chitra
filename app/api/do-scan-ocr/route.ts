import { NextRequest } from "next/server"
import { readManagedUpload } from "@/lib/upload-storage"
import { extractPdfViaInspector } from "@/lib/vision-pdf-inspector"
import { structureDeliveryOrderFromMarkdown } from "@/lib/ai-document-structurer"

export const runtime = "nodejs"

type MatchSource = "label" | "pattern" | "ai" | "none"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => null)
        if (!body) {
            return Response.json({ error: "Invalid JSON" }, { status: 400 })
        }

        const { fileUrl, filename, pages } = body as {
            fileUrl?: string
            filename?: string
            pages?: string | number[]
        }

        const source = fileUrl || filename
        if (!source) {
            return Response.json({ error: "fileUrl atau filename wajib diisi" }, { status: 400 })
        }

        const uploaded = await readManagedUpload(source)
        if (!uploaded) {
            return Response.json({ error: "File tidak ditemukan" }, { status: 404 })
        }

        const inspectorResult = await extractPdfViaInspector(uploaded.buffer, uploaded.filename, {
            auto_ocr: true,
            pages: pages ?? "1",
            contentType: uploaded.contentType,
            timeoutMs: 15000,
        })

        const markdown = inspectorResult.data?.markdown || ""
        let extractedInternal = extractInternalNo(markdown)
        let deliveryNumber = extractDeliveryNumber(markdown)

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
                console.warn("[DO-OCR-API] OpenAI fallback warning:", aiErr)
            }
        }

        const fields = {
            deliveryNo: deliveryNumber,
            internalNo: extractedInternal.internalNo,
        }

        return Response.json({
            deliveryNumber,
            internalNo: extractedInternal.internalNo,
            detectionSource: extractedInternal.source,
            rawText: sanitizeText(markdown),
            fields,
            model: `vision-pdf-inspector (${inspectorResult.data?.pdf_type || "ocr"})`,
            pagesProcessed: inspectorResult.data?.page_count || 1,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "OCR scan DO gagal"
        return Response.json({ error: message }, { status: 500 })
    }
}

function sanitizeText(value: string | null | undefined): string {
    return String(value ?? "").replace(/\u0000/g, " ").trim()
}

function extractInternalNo(rawText: string): { internalNo: string | null; source: MatchSource } {
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
