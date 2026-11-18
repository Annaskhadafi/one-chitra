import { PDFDocument } from "pdf-lib"
import { tryHeuristicPoParse } from "./heuristic-document-parser"
import { structurePoFromMarkdown, ExtractedSOData } from "./ai-document-structurer"

export interface PdfInspectorProcessResult {
    status: "success" | "error"
    filename: string
    data: {
        pdf_type: "text_based" | "scanned" | "hybrid" | string
        confidence?: number
        page_count?: number
        title?: string | null
        markdown: string
        has_encoding_issues?: boolean
        is_complex_layout?: boolean
        pages_needing_ocr?: number[]
        ocr_applied_pages?: number[]
        pages_with_columns?: number[]
        pages_with_tables?: number[]
        ocr_reasons_by_page?: Record<string, unknown>
        processing_time_ms?: number
    }
}

export interface PdfInspectorOptions {
    pages?: string | number[] | null
    auto_ocr?: boolean
    timeoutMs?: number
    contentType?: string
}

const DEFAULT_BASE_URL = "https://vision.chitraparatama.com/api/v1"

/**
 * Membungkus image buffer (JPEG/PNG/WEBP) menjadi dokumen PDF 1 halaman
 * agar kompatibel dengan endpoint /api/v1/pdf-inspector/process.
 */
async function ensurePdfBuffer(fileBuffer: Buffer, filename: string, contentType?: string): Promise<{ buffer: Buffer; filename: string }> {
    const lowerName = filename.toLowerCase()
    const isImage = (
        contentType?.startsWith("image/") ||
        /\.(jpe?g|png|webp|gif|bmp)$/i.test(lowerName)
    )

    if (!isImage) {
        return { buffer: fileBuffer, filename }
    }

    try {
        const pdfDoc = await PDFDocument.create()
        let embeddedImage
        if (/\.png$/i.test(lowerName) || contentType === "image/png") {
            embeddedImage = await pdfDoc.embedPng(fileBuffer)
        } else {
            // Default to JPG for jpg/jpeg/webp fallback
            embeddedImage = await pdfDoc.embedJpg(fileBuffer)
        }

        const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height])
        page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: embeddedImage.width,
            height: embeddedImage.height,
        })

        const pdfBytes = await pdfDoc.save()
        const convertedFilename = filename.replace(/\.[^.]+$/, "") + ".pdf"
        return {
            buffer: Buffer.from(pdfBytes),
            filename: convertedFilename,
        }
    } catch (err) {
        console.warn(`[PDF-Inspector] Gagal membungkus gambar ke PDF (${filename}), mengirim buffer asli:`, err)
        return { buffer: fileBuffer, filename }
    }
}

/**
 * Mengirim file PDF/Gambar ke Microservice PDF Inspector vision.chitraparatama.com
 * untuk diekstrak menjadi Markdown & Teks terstruktur (Target < 5 detik).
 */
export async function extractPdfViaInspector(
    fileBuffer: Buffer,
    filename: string,
    options?: PdfInspectorOptions
): Promise<PdfInspectorProcessResult> {
    const rawBaseUrl = process.env.RARAY_VISION_API_BASE_URL || DEFAULT_BASE_URL
    const baseUrl = rawBaseUrl.replace(/\/$/, "")
    const endpoint = `${baseUrl}/pdf-inspector/process`
    const apiKey = process.env.RARAY_VISION_API_KEY || ""
    const timeoutMs = options?.timeoutMs ?? 20000

    // Auto-convert image to single-page PDF if needed (<15ms)
    const { buffer: readyBuffer, filename: readyFilename } = await ensurePdfBuffer(
        fileBuffer,
        filename,
        options?.contentType
    )

    const form = new FormData()
    const uint8Array = new Uint8Array(readyBuffer)
    const blob = new Blob([uint8Array], { type: "application/pdf" })
    form.append("file", blob, readyFilename || "document.pdf")

    if (options?.pages) {
        const pagesStr = Array.isArray(options.pages) ? options.pages.join(",") : String(options.pages)
        form.append("pages", pagesStr)
    }

    form.append("auto_ocr", options?.auto_ocr !== false ? "true" : "false")

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const startTime = Date.now()
    try {
        console.log(`[PDF-Inspector] Mengirim ${readyFilename} (${readyBuffer.length} bytes) ke ${endpoint}...`)
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: apiKey,
            },
            body: form,
            signal: controller.signal,
        })

        const elapsed = Date.now() - startTime

        if (!response.ok) {
            const errorText = await response.text().catch(() => "")
            throw new Error(`PDF Inspector Error ${response.status}: ${errorText.slice(0, 300)}`)
        }

        const json = await response.json() as PdfInspectorProcessResult
        console.log(`[PDF-Inspector] Sukses: ${readyFilename} (${elapsed}ms, type: ${json.data?.pdf_type}, chars: ${json.data?.markdown?.length ?? 0})`)
        return json
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error(`PDF Inspector request timed out after ${timeoutMs / 1000}s`)
        }
        console.error(`[PDF-Inspector] Request failed:`, error)
        throw error
    } finally {
        clearTimeout(timer)
    }
}

export type StructuredPoOcrResult = {
    rawText: string
    structured: ExtractedSOData
    model: string
    pagesProcessed: number
}

/**
 * Pipeline Terpadu: Ekstraksi OCR Cepat via vision.chitraparatama.com (< 5s)
 * dilanjutkan dengan Fast Heuristic Parser (< 5ms) dan OpenAI API Structuring.
 */
export async function extractStructuredPoViaVision(
    fileBuffer: Buffer,
    filename: string,
    options?: {
        contentType?: string
        pages?: string | number[] | null
        timeoutMs?: number
    }
): Promise<StructuredPoOcrResult> {
    const inspectorResult = await extractPdfViaInspector(fileBuffer, filename, {
        auto_ocr: true,
        pages: options?.pages ?? "1,2,3",
        contentType: options?.contentType,
        timeoutMs: options?.timeoutMs ?? 15000,
    })

    const markdown = inspectorResult.data?.markdown || ""
    const pagesProcessed = inspectorResult.data?.page_count || 1

    if (!markdown.trim()) {
        throw new Error("Hasil ekstraksi OCR kosong. Pastikan dokumen dapat terbaca.")
    }

    // 1. Coba Fast Deterministic Heuristic Parser (< 5ms)
    const heuristic = tryHeuristicPoParse(markdown)
    if (heuristic.success && heuristic.data && heuristic.data.products && heuristic.data.products.length > 0) {
        return {
            rawText: markdown,
            structured: heuristic.data,
            model: `vision-pdf-inspector-heuristic (${inspectorResult.data?.pdf_type || "hybrid"})`,
            pagesProcessed,
        }
    }

    // 2. Eskalasi ke OpenAI API Structuring
    console.log(`[Vision-OCR] Struktur tabel non-standar, memetakan PO via OpenAI API...`)
    const structured = await structurePoFromMarkdown(markdown)

    return {
        rawText: markdown,
        structured,
        model: `vision-pdf-inspector-openai (${inspectorResult.data?.pdf_type || "hybrid"})`,
        pagesProcessed,
    }
}
