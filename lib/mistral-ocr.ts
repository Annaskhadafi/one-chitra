import { z } from "zod"

export type OcrBoundingBox = {
    page: number
    top_left_x: number
    top_left_y: number
    bottom_right_x: number
    bottom_right_y: number
}

export type ExtractedProduct = {
    name: string
    code?: string | null
    qty: number
    unit_price: number
    total_price?: number | null
    bbox?: OcrBoundingBox | null
}

export type ExtractedSOData = {
    customer_company_name: string
    customer_code?: string | null
    po_number: string
    document_date: string
    products: ExtractedProduct[]
    tax_total?: number | null
    grand_total?: number | null
}

export type OcrResult = {
    rawText: string
    structured: ExtractedSOData
    productBoxes: OcrBoundingBox[]
    entityBoxes: Record<string, OcrBoundingBox | undefined>
    model: string
    pagesProcessed: number
}

const documentAnnotationSchema = z.object({
    customer_company_name: z.string(),
    customer_code: z.string().optional().nullable(),
    po_number: z.string(),
    document_date: z.string(),
    products: z.array(
        z.object({
            name: z.string(),
            code: z.string().optional().nullable(),
            qty: z.number(),
            unit_price: z.number(),
            total_price: z.number().optional().nullable(),
        })
    ),
    tax_total: z.number().optional().nullable(),
    grand_total: z.number().optional().nullable(),
})

const bboxAnnotationSchema = z.object({
    product_boxes: z.array(
        z.object({
            page: z.number(),
            top_left_x: z.number(),
            top_left_y: z.number(),
            bottom_right_x: z.number(),
            bottom_right_y: z.number(),
        })
    ),
    entity_boxes: z.object({
        customer_company_name: z.object({
            page: z.number(),
            top_left_x: z.number(),
            top_left_y: z.number(),
            bottom_right_x: z.number(),
            bottom_right_y: z.number(),
        }).optional(),
        po_number: z.object({
            page: z.number(),
            top_left_x: z.number(),
            top_left_y: z.number(),
            bottom_right_x: z.number(),
            bottom_right_y: z.number(),
        }).optional(),
        document_date: z.object({
            page: z.number(),
            top_left_x: z.number(),
            top_left_y: z.number(),
            bottom_right_x: z.number(),
            bottom_right_y: z.number(),
        }).optional(),
        tax_total: z.object({
            page: z.number(),
            top_left_x: z.number(),
            top_left_y: z.number(),
            bottom_right_x: z.number(),
            bottom_right_y: z.number(),
        }).optional(),
        grand_total: z.object({
            page: z.number(),
            top_left_x: z.number(),
            top_left_y: z.number(),
            bottom_right_x: z.number(),
            bottom_right_y: z.number(),
        }).optional(),
    }),
})

const documentAnnotationFormat = {
    type: "object",
    properties: {
        customer_company_name: { type: "string" },
        customer_code: { type: ["string", "null"] },
        po_number: { type: "string" },
        document_date: { type: "string" },
        products: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    code: { type: ["string", "null"] },
                    qty: { type: "number" },
                    unit_price: { type: "number" },
                    total_price: { type: ["number", "null"] },
                },
                required: ["name", "qty", "unit_price"],
            },
        },
        tax_total: { type: ["number", "null"] },
        grand_total: { type: ["number", "null"] },
    },
    required: ["customer_company_name", "po_number", "document_date", "products"],
}

const bboxAnnotationFormat = {
    type: "object",
    properties: {
        product_boxes: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    page: { type: "number" },
                    top_left_x: { type: "number" },
                    top_left_y: { type: "number" },
                    bottom_right_x: { type: "number" },
                    bottom_right_y: { type: "number" },
                },
                required: ["page", "top_left_x", "top_left_y", "bottom_right_x", "bottom_right_y"],
            },
        },
        entity_boxes: {
            type: "object",
            properties: {
                customer_company_name: { type: "object" },
                po_number: { type: "object" },
                document_date: { type: "object" },
                tax_total: { type: "object" },
                grand_total: { type: "object" },
            },
        },
    },
    required: ["product_boxes", "entity_boxes"],
}

export async function extractStructuredFromDocument(params: {
    fileBuffer: Buffer
    filename: string
    pages?: string | number[] | null
}): Promise<OcrResult> {
    const apiKey = process.env.MISTRAL_API_KEY
    const endpoint = process.env.MISTRAL_OCR_ENDPOINT?.trim() || "https://api.mistral.ai/v1/ocr"
    if (!apiKey) {
        throw new Error("MISTRAL_API_KEY is not set")
    }
    const { filename, fileBuffer } = await normalizeDocumentForOcr(params.filename, params.fileBuffer)
    const base64 = fileBuffer.toString("base64")
    const documentUrl = buildDataUri(filename, base64)
    const normalizedPages = normalizePages(params.pages)
    const body = {
        model: "mistral-ocr-latest",
        document: {
            type: "document_url",
            document_url: documentUrl,
        },
        ...(normalizedPages ? { pages: normalizedPages } : {}),
        include_image_base64: true,
        document_annotation_format: {
            type: "json_schema",
            json_schema: {
                name: "so_document_annotation",
                schema: documentAnnotationFormat,
            },
        },
        bbox_annotation_format: {
            type: "json_schema",
            json_schema: {
                name: "so_bbox_annotation",
                schema: bboxAnnotationFormat,
            },
        },
    }
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    })
    if (!res.ok) {
        const text = await res.text()
        let upstreamMessage = text
        try {
            const parsed = JSON.parse(text) as { detail?: Array<{ msg?: string; loc?: string[] }> }
            if (Array.isArray(parsed.detail) && parsed.detail.length > 0) {
                upstreamMessage = parsed.detail
                    .slice(0, 3)
                    .map((d) => {
                        const loc = Array.isArray(d.loc) ? d.loc.join(".") : "body"
                        return `${loc}: ${d.msg || "invalid request"}`
                    })
                    .join(" | ")
            }
        } catch {}
        if (upstreamMessage.includes("does not support image input")) {
            throw new Error("File gambar tidak didukung oleh model OCR ini. Silakan gunakan file PDF untuk hasil terbaik.")
        }
        throw new Error(`MISTRAL_UPSTREAM_ERROR ${res.status} ${upstreamMessage}`)
    }
    const json = await res.json()
    const rawText: string = getRawText(json)
    const model: string = json?.model ?? "mistral-ocr-latest"
    const pagesProcessed: number = json?.usage_info?.pages_processed ?? 0
    const documentAnnotationInput = getDocumentAnnotationInput(json, rawText)
    const docAnn = documentAnnotationSchema.safeParse(documentAnnotationInput)
    if (!docAnn.success) {
        const firstIssue = docAnn.error.issues[0]
        const path = firstIssue?.path?.join(".") || "document_annotation"
        const message = firstIssue?.message || "invalid annotation shape"
        throw new Error(`Document annotation parse failed: ${path}: ${message}`)
    }
    const bboxAnnotationInput = getBboxAnnotationInput(json)
    const bboxAnn = bboxAnnotationSchema.safeParse(bboxAnnotationInput)
    const productBoxes: OcrBoundingBox[] = bboxAnn.success ? bboxAnn.data.product_boxes : []
    const entityBoxes = bboxAnn.success ? bboxAnn.data.entity_boxes : {}
    return {
        rawText,
        structured: docAnn.data as ExtractedSOData,
        productBoxes,
        entityBoxes,
        model,
        pagesProcessed,
    }
}

async function normalizeDocumentForOcr(filename: string, fileBuffer: Buffer) {
    const lower = filename.toLowerCase()
    if (!lower.endsWith(".png") && !lower.endsWith(".jpg") && !lower.endsWith(".jpeg")) {
        return { filename, fileBuffer }
    }

    const { PDFDocument } = await import("pdf-lib")
    const pdf = await PDFDocument.create()
    const embeddedImage = lower.endsWith(".png")
        ? await pdf.embedPng(fileBuffer)
        : await pdf.embedJpg(fileBuffer)

    const pageWidth = 595.28
    const pageHeight = 841.89
    const page = pdf.addPage([pageWidth, pageHeight])
    const margin = 24
    const scale = Math.min(
        (pageWidth - margin * 2) / embeddedImage.width,
        (pageHeight - margin * 2) / embeddedImage.height,
        1,
    )
    const imageWidth = embeddedImage.width * scale
    const imageHeight = embeddedImage.height * scale

    page.drawImage(embeddedImage, {
        x: (pageWidth - imageWidth) / 2,
        y: (pageHeight - imageHeight) / 2,
        width: imageWidth,
        height: imageHeight,
    })

    return {
        filename: filename.replace(/\.(png|jpg|jpeg)$/i, ".pdf"),
        fileBuffer: Buffer.from(await pdf.save()),
    }
}

function buildDataUri(filename: string, base64: string) {
    const lower = filename.toLowerCase()
    if (lower.endsWith(".pdf")) {
        return `data:application/pdf;base64,${base64}`
    }
    if (lower.endsWith(".png")) {
        return `data:image/png;base64,${base64}`
    }
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        return `data:image/jpeg;base64,${base64}`
    }
    return `data:application/octet-stream;base64,${base64}`
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

function getRawText(json: unknown): string {
    if (!json || typeof json !== "object") {
        return ""
    }
    const root = json as Record<string, unknown>
    if (typeof root.markdown === "string" && root.markdown.trim().length > 0) {
        return root.markdown
    }
    if (typeof root.text === "string" && root.text.trim().length > 0) {
        return root.text
    }
    if (Array.isArray(root.pages)) {
        const parts = root.pages
            .map((page) => {
                if (!page || typeof page !== "object") {
                    return ""
                }
                const markdown = (page as Record<string, unknown>).markdown
                return typeof markdown === "string" ? markdown : ""
            })
            .filter((part) => part.length > 0)
        if (parts.length > 0) {
            return parts.join("\n")
        }
    }
    return ""
}

function getDocumentAnnotationInput(json: unknown, rawText: string): unknown {
    if (!json || typeof json !== "object") {
        return extractJsonFromText(rawText) ?? {}
    }
    const root = json as Record<string, unknown>
    const candidates = [
        root.document_annotation,
        root.documentAnnotations,
        root.documentAnnotation,
        root.structured,
        root.extracted,
        (root.result as Record<string, unknown> | undefined)?.document_annotation,
        (root.output as Record<string, unknown> | undefined)?.document_annotation,
        (root.data as Record<string, unknown> | undefined)?.document_annotation,
    ]
    for (const candidate of candidates) {
        const normalized = parseJsonLike(candidate)
        if (normalized && typeof normalized === "object") {
            return normalized
        }
    }
    const fromText = extractJsonFromText(rawText)
    if (fromText) {
        return fromText
    }
    return root
}

function getBboxAnnotationInput(json: unknown): unknown {
    if (!json || typeof json !== "object") {
        return undefined
    }
    const root = json as Record<string, unknown>
    const candidates = [
        root.bbox_annotation,
        root.bboxAnnotations,
        root.bboxAnnotation,
        (root.result as Record<string, unknown> | undefined)?.bbox_annotation,
        (root.output as Record<string, unknown> | undefined)?.bbox_annotation,
        (root.data as Record<string, unknown> | undefined)?.bbox_annotation,
    ]
    for (const candidate of candidates) {
        const normalized = parseJsonLike(candidate)
        if (normalized && typeof normalized === "object") {
            return normalized
        }
    }
    return undefined
}

function parseJsonLike(value: unknown): unknown {
    if (!value) {
        return undefined
    }
    if (typeof value === "string") {
        try {
            return JSON.parse(value)
        } catch {
            return undefined
        }
    }
    return value
}

function extractJsonFromText(text: string): unknown {
    if (!text) {
        return undefined
    }
    const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi
    for (const match of text.matchAll(fenceRegex)) {
        const candidate = match[1]?.trim()
        if (!candidate) {
            continue
        }
        try {
            return JSON.parse(candidate)
        } catch {}
    }
    const firstBrace = text.indexOf("{")
    const lastBrace = text.lastIndexOf("}")
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        const slice = text.slice(firstBrace, lastBrace + 1)
        try {
            return JSON.parse(slice)
        } catch {}
    }
    return undefined
}
