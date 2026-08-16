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
}

const DEFAULT_BASE_URL = "https://vision.chitraparatama.com/api/v1"
const DEFAULT_API_KEY = "rv_e7c911a9b54a60f9904531b8c1fb216f"

/**
 * Mengirim file PDF ke Microservice PDF Inspector untuk diekstrak menjadi Markdown & Teks terstruktur.
 */
export async function extractPdfViaInspector(
    fileBuffer: Buffer,
    filename: string,
    options?: PdfInspectorOptions
): Promise<PdfInspectorProcessResult> {
    const rawBaseUrl = process.env.VISION_API_BASE_URL || DEFAULT_BASE_URL
    const baseUrl = rawBaseUrl.replace(/\/$/, "")
    const endpoint = `${baseUrl}/pdf-inspector/process`
    const apiKey = process.env.VISION_API_KEY || DEFAULT_API_KEY
    const timeoutMs = options?.timeoutMs ?? 30000

    const form = new FormData()
    const uint8Array = new Uint8Array(fileBuffer)
    const blob = new Blob([uint8Array], { type: "application/pdf" })
    form.append("file", blob, filename || "document.pdf")

    if (options?.pages) {
        const pagesStr = Array.isArray(options.pages) ? options.pages.join(",") : String(options.pages)
        form.append("pages", pagesStr)
    }

    form.append("auto_ocr", options?.auto_ocr !== false ? "true" : "false")

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
        console.log(`[PDF-Inspector] Sending ${filename} (${fileBuffer.length} bytes) to ${endpoint}...`)
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: apiKey,
            },
            body: form,
            signal: controller.signal,
        })

        if (!response.ok) {
            const errorText = await response.text().catch(() => "")
            throw new Error(`PDF Inspector Error ${response.status}: ${errorText.slice(0, 300)}`)
        }

        const json = await response.json() as PdfInspectorProcessResult
        console.log(`[PDF-Inspector] Success: ${filename} (time: ${json.data?.processing_time_ms ?? "?"}ms, type: ${json.data?.pdf_type})`)
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
