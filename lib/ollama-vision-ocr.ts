import sharp from "sharp"
import type { Page } from "puppeteer"

export type DeliveryOrderBoxFields = {
    page: string | null
    deliveryNo: string | null
    internalNo: string | null
    deliveryDate: string | null
    customerPoNo: string | null
    customerPoDate: string | null
}

export type RawOcrTextResult = {
    rawText: string
    focusedText: string
    fields: DeliveryOrderBoxFields
    model: string
    pagesProcessed: number
}

type PdfRenderPage = {
    pageNumber: number
    imageBase64: string
}

export async function extractRawTextFromDocumentViaOllama(params: {
    fileBuffer: Buffer
    filename: string
    pages?: string | number[] | null
}): Promise<RawOcrTextResult> {
    const rawUrl = process.env.OLLAMA_URL?.trim() || "http://localhost:11434"
    const baseUrl = rawUrl.replace(/\/$/, "")
    const endpoint = baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl}/api/chat`
    const model = process.env.OLLAMA_MODEL?.trim() || "qwen3.5:397b-cloud"
    const apiKey = process.env.OLLAMA_API_KEY?.trim() || ""

    const pages = await prepareDocumentPages({
        fileBuffer: params.fileBuffer,
        filename: params.filename,
        pages: params.pages,
    })

    if (pages.length === 0) {
        throw new Error("Dokumen tidak memiliki halaman yang bisa diproses")
    }

    const rawTextParts: string[] = []

    for (const page of pages) {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
                model,
                stream: false,
                format: "json",
                messages: [
                    {
                        role: "system",
                        content: [
                            "Anda adalah OCR vision engine untuk dokumen bisnis.",
                            "Transkripkan teks dokumen setepat mungkin dari gambar scan.",
                            "Utamakan akurasi angka, kode, nomor dokumen, dan field Internal No.",
                            "Jangan menerjemahkan, jangan meringkas, jangan menambah penjelasan.",
                            "Kembalikan JSON valid dengan shape: {\"raw_text\":\"...\"}.",
                        ].join(" "),
                    },
                    {
                        role: "user",
                        content: `Lakukan OCR halaman ${page.pageNumber}. Salin semua teks penting apa adanya.`,
                        images: [page.imageBase64],
                    },
                ],
            }),
        })

        const text = await response.text()
        let payload: Record<string, unknown> | null = null
        try {
            payload = text ? JSON.parse(text) as Record<string, unknown> : null
        } catch {
            throw new Error(`OLLAMA_UPSTREAM_ERROR Respons Ollama bukan JSON valid: ${text.slice(0, 200)}`)
        }

        if (!response.ok) {
            const message = String(payload?.error || payload?.message || `HTTP ${response.status}`).trim()
            throw new Error(`OLLAMA_UPSTREAM_ERROR ${response.status} ${message}`)
        }

        const messageContent = getMessageContent(payload)
        const pageText = extractRawText(messageContent)
        if (pageText) {
            rawTextParts.push(pageText)
        }
    }

    const rawText = rawTextParts.join("\n\n").trim()
    const fields = extractDeliveryOrderFields(rawText)
    const focusedText = buildFocusedText(fields)
    const effectiveFocusedText = countPopulatedFields(fields) <= 1
        ? rawText
        : focusedText

    return {
        rawText,
        focusedText: effectiveFocusedText,
        fields,
        model,
        pagesProcessed: pages.length,
    }
}

async function prepareDocumentPages(params: {
    fileBuffer: Buffer
    filename: string
    pages?: string | number[] | null
}): Promise<PdfRenderPage[]> {
    const lower = params.filename.toLowerCase()
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
        const imageBase64 = await normalizeImageToBase64(params.fileBuffer)
        return [{ pageNumber: 1, imageBase64 }]
    }

    if (lower.endsWith(".pdf")) {
        return renderPdfToImages(params.fileBuffer, normalizePages(params.pages))
    }

    throw new Error("Format file tidak didukung untuk OCR Ollama. Gunakan PDF atau gambar.")
}

async function normalizeImageToBase64(fileBuffer: Buffer) {
    const normalized = await sharp(fileBuffer)
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 92 })
        .toBuffer()
    return normalized.toString("base64")
}

async function renderPdfToImages(fileBuffer: Buffer, selectedPages?: number[]) {
    const puppeteerModule = await import("puppeteer")
    const puppeteer = puppeteerModule.default
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    try {
        const page = await browser.newPage()
        await page.setViewport({ width: 1400, height: 1900, deviceScaleFactor: 2 })

        const pdfDataUrl = `data:application/pdf;base64,${fileBuffer.toString("base64")}`
        await page.goto(pdfDataUrl, { waitUntil: "networkidle0", timeout: 60000 })
        await page.waitForSelector("embed, iframe, pdf-viewer, body", { timeout: 15000 })
        await sleep(1200)

        const totalPages = await detectPdfPageCount(page)
        const pageNumbers = pickRequestedPages(totalPages, selectedPages)
        const images: PdfRenderPage[] = []

        for (const pageNumber of pageNumbers) {
            await jumpToPdfPage(page, pageNumber)
            await sleep(700)

            const screenshot = await capturePdfDocumentViewport(page)

            const normalized = await normalizePdfViewerScreenshot(screenshot)

            images.push({
                pageNumber,
                imageBase64: normalized.toString("base64"),
            })
        }

        return images
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Gagal merender PDF untuk OCR Ollama: ${message}`)
    } finally {
        await browser.close()
    }
}

async function normalizePdfViewerScreenshot(screenshot: Buffer) {
    const image = sharp(screenshot)
    const metadata = await image.metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0

    if (width <= 0 || height <= 0) {
        return image
    }

    // Trim a little padding only; the main toolbar is already excluded in capturePdfDocumentViewport
    const topCrop = Math.min(Math.max(Math.floor(height * 0.01), 8), Math.floor(height * 0.04))
    const sideCrop = Math.min(Math.max(Math.floor(width * 0.01), 8), Math.floor(width * 0.03))
    const cropWidth = Math.max(1, width - (sideCrop * 2))
    const cropHeight = Math.max(1, height - topCrop - sideCrop)

    return image.extract({
        left: sideCrop,
        top: topCrop,
        width: cropWidth,
        height: cropHeight,
    })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 90 })
        .toBuffer()
}

async function capturePdfDocumentViewport(page: Page) {
    const viewport = page.viewport()
    const viewportWidth = viewport?.width || 1400
    const viewportHeight = viewport?.height || 1900

    const clip = {
        x: 12,
        y: 96,
        width: Math.max(1, viewportWidth - 24),
        height: Math.max(1, viewportHeight - 120),
    }

    return page.screenshot({
        clip,
        type: "png",
    }) as Promise<Buffer>
}

async function detectPdfPageCount(page: Page) {
    const total = await page.evaluate(() => {
        const bodyText = document.body?.innerText || ""
        const matches = [
            bodyText.match(/(\d+)\s*\/\s*(\d+)/),
            bodyText.match(/of\s+(\d+)/i),
        ]

        for (const match of matches) {
            if (!match) continue
            const candidate = Number(match[2] || match[1])
            if (Number.isInteger(candidate) && candidate > 0) {
                return candidate
            }
        }

        const pageCountFromViewer = Number(
            (document.querySelector('[aria-label*="page" i]') as HTMLElement | null)?.getAttribute("data-page-count") || 0,
        )
        return Number.isInteger(pageCountFromViewer) && pageCountFromViewer > 0 ? pageCountFromViewer : 1
    })

    return Number.isInteger(total) && total > 0 ? total : 1
}

async function jumpToPdfPage(page: Page, pageNumber: number) {
    await page.evaluate((targetPage: number) => {
        location.hash = `page=${targetPage}`
    }, pageNumber)
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function pickRequestedPages(totalPages: number, selectedPages?: number[]) {
    if (!selectedPages || selectedPages.length === 0) {
        return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    return selectedPages.filter((page) => Number.isInteger(page) && page > 0 && page <= totalPages)
}

function normalizePages(pages?: string | number[] | null): number[] | undefined {
    if (!pages || pages === "all") {
        return undefined
    }
    if (Array.isArray(pages)) {
        const validPages = pages.filter((page) => Number.isInteger(page) && page > 0)
        return validPages.length > 0 ? validPages : undefined
    }
    const parsed = Number(pages)
    if (Number.isInteger(parsed) && parsed > 0) {
        return [parsed]
    }
    return undefined
}

function getMessageContent(payload: Record<string, unknown> | null) {
    const message = payload?.message
    if (!message || typeof message !== "object") {
        return ""
    }

    const content = (message as Record<string, unknown>).content
    if (typeof content === "string") {
        return content
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === "string") return part
                if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
                    return String((part as { text: string }).text)
                }
                return ""
            })
            .join("\n")
            .trim()
    }

    return ""
}

function extractRawText(messageContent: string) {
    if (!messageContent) {
        return ""
    }

    try {
        const parsed = JSON.parse(messageContent) as { raw_text?: unknown }
        if (typeof parsed.raw_text === "string") {
            return sanitizeText(parsed.raw_text)
        }
    } catch {}

    const fenced = messageContent.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
    if (fenced) {
        try {
            const parsed = JSON.parse(fenced) as { raw_text?: unknown }
            if (typeof parsed.raw_text === "string") {
                return sanitizeText(parsed.raw_text)
            }
        } catch {}
    }

    return sanitizeText(messageContent)
}

function extractDeliveryOrderFields(rawText: string): DeliveryOrderBoxFields {
    const text = sanitizeText(rawText)
    const section = extractDeliveryOrderSection(text)

    return {
        page: findField(section, [
            /page\s*[:.;-]?\s*([0-9]+(?:\s*\/\s*[0-9]+)?)/i,
        ]),
        deliveryNo: findField(section, [
            /delivery\s*(?:no|number)\s*[:.;-]?\s*([a-z0-9./_-]+)/i,
        ]),
        internalNo: normalizeInternalNo(findField(section, [
            /internal\s*(?:no|number|#)\s*[:.;-]?\s*([a-z0-9./_-]+)/i,
            /\b(DLV[\s\-\/]*\d{8}[\s\-\/]*\d{4})\b/i,
        ])),
        deliveryDate: findField(section, [
            /delivery\s*date\s*[:.;-]?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})/i,
        ]),
        customerPoNo: findField(section, [
            /customer\s*po\s*no\s*[:.;-]?\s*([a-z0-9./_-]+)/i,
        ]),
        customerPoDate: findField(section, [
            /customer\s*po\s*date\s*[:.;-]?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})/i,
        ]),
    }
}

function extractDeliveryOrderSection(text: string) {
    const normalizedLines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

    const startIndex = normalizedLines.findIndex((line) => /delivery\s+order/i.test(line))
    if (startIndex < 0) {
        return text
    }

    return normalizedLines.slice(startIndex, startIndex + 12).join("\n")
}

function findField(text: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
        const match = text.match(pattern)
        const candidate = sanitizeText(match?.[1])
        if (candidate) {
            return candidate
        }
    }
    return null
}

function buildFocusedText(fields: DeliveryOrderBoxFields) {
    return [
        fields.page ? `Page: ${fields.page}` : null,
        fields.deliveryNo ? `Delivery No: ${fields.deliveryNo}` : null,
        fields.internalNo ? `Internal No: ${fields.internalNo}` : null,
        fields.deliveryDate ? `Delivery Date: ${fields.deliveryDate}` : null,
        fields.customerPoNo ? `Customer PO No: ${fields.customerPoNo}` : null,
        fields.customerPoDate ? `Customer PO Date: ${fields.customerPoDate}` : null,
    ].filter(Boolean).join("\n")
}

function countPopulatedFields(fields: DeliveryOrderBoxFields) {
    return [
        fields.page,
        fields.deliveryNo,
        fields.internalNo,
        fields.deliveryDate,
        fields.customerPoNo,
        fields.customerPoDate,
    ].filter(Boolean).length
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

function sanitizeText(value: string | null | undefined) {
    return String(value ?? "").replace(/\u0000/g, " ").trim()
}
