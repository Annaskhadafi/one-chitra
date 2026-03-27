import { NextRequest } from "next/server"
import { readManagedUpload } from "@/lib/upload-storage"
import { extractRawTextFromDocumentViaOllama } from "@/lib/ollama-vision-ocr"

export const runtime = "nodejs"

type MatchSource = "label" | "pattern" | "none"

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

        const ocr = await extractRawTextFromDocumentViaOllama({
            fileBuffer: uploaded.buffer,
            filename: uploaded.filename,
            pages: pages ?? "all",
        })

        const directInternalNo = normalizeInternalNo(ocr.fields.internalNo)
        const extracted = directInternalNo
            ? { internalNo: directInternalNo, source: "label" as MatchSource }
            : extractInternalNo(ocr.focusedText || ocr.rawText)

        return Response.json({
            internalNo: extracted.internalNo,
            detectionSource: extracted.source,
            rawText: sanitizeText(selectDisplayText(ocr.focusedText, ocr.rawText)),
            fields: ocr.fields,
            model: ocr.model,
            pagesProcessed: ocr.pagesProcessed,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "OCR scan DO gagal"
        if (message.includes("OLLAMA_UPSTREAM_ERROR")) {
            return Response.json({ error: `Gagal memproses OCR dari Ollama: ${message}` }, { status: 502 })
        }
        return Response.json({ error: message }, { status: 500 })
    }
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

function sanitizeText(value: string | null | undefined): string {
    return String(value ?? "").replace(/\u0000/g, " ").trim()
}

function selectDisplayText(focusedText: string | null | undefined, rawText: string | null | undefined) {
    const focused = sanitizeText(focusedText)
    const raw = sanitizeText(rawText)
    return focused || raw
}
