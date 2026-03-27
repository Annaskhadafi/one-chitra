import { NextRequest } from "next/server"
import { readManagedUpload } from "@/lib/upload-storage"
import { extractRawTextFromDocument } from "@/lib/mistral-ocr"

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

        const ocr = await extractRawTextFromDocument({
            fileBuffer: uploaded.buffer,
            filename: uploaded.filename,
            pages: pages ?? "all",
        })

        const extracted = extractInternalNo(ocr.rawText)

        return Response.json({
            internalNo: extracted.internalNo,
            detectionSource: extracted.source,
            rawText: sanitizeText(ocr.rawText),
            model: ocr.model,
            pagesProcessed: ocr.pagesProcessed,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : "OCR scan DO gagal"
        if (message.includes("MISTRAL_API_KEY is not set")) {
            return Response.json({ error: "Konfigurasi OCR belum lengkap: MISTRAL_API_KEY belum diset" }, { status: 500 })
        }
        if (message.includes("MISTRAL_UPSTREAM_ERROR")) {
            return Response.json({ error: `Gagal memproses OCR dari provider: ${message}` }, { status: 502 })
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
        return `${dlvMatch[1]}-${dlvMatch[2]}-${dlvMatch[3]}`
    }

    return cleaned || null
}

function sanitizeText(value: string | null | undefined): string {
    return String(value ?? "").replace(/\u0000/g, " ").trim()
}
