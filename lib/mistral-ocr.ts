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

export async function extractStructuredFromDocument(params: {
    fileBuffer: Buffer
    filename: string
    pages?: string | number[] | null
}): Promise<OcrResult> {
    const apiKey = process.env.MISTRAL_API_KEY
    const endpoint = process.env.MISTRAL_OCR_ENDPOINT
    if (!apiKey) {
        throw new Error("MISTRAL_API_KEY is not set")
    }
    if (!endpoint) {
        throw new Error("MISTRAL_OCR_ENDPOINT is not set")
    }
    const base64 = params.fileBuffer.toString("base64")
    const body = {
        model: "mistral-ocr-latest",
        document: {
            type: "document_base64",
            document_base64: base64,
            filename: params.filename,
        },
        pages: params.pages ?? "all",
        include_image_base64: true,
        document_annotation_format: documentAnnotationSchema.toJSON(),
        bbox_annotation_format: bboxAnnotationSchema.toJSON(),
        output_format: "json",
        language_hint: "latin",
        numeric_precision_hint: "high",
        prompt: "Ekstrak data Sales Order/PO dalam JSON mengikuti schema document_annotation_format, dengan angka dan tanggal yang akurat. Kembalikan juga bbox sesuai schema.",
        max_tokens: 4000,
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
        throw new Error(`Mistral OCR error: ${res.status} ${text}`)
    }
    const json = await res.json()
    const rawText: string = json?.markdown ?? json?.text ?? ""
    const model: string = json?.model ?? "mistral-ocr-latest"
    const pagesProcessed: number = json?.usage_info?.pages_processed ?? 0
    const docAnn = documentAnnotationSchema.safeParse(json?.document_annotation ?? json?.documentAnnotations)
    if (!docAnn.success) {
        throw new Error("Document annotation parse failed")
    }
    const bboxAnn = bboxAnnotationSchema.safeParse(json?.bbox_annotation ?? json?.bboxAnnotations)
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
