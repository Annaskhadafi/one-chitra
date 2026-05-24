import { z } from "zod"
import { extractRawTextFromDocument } from "./mistral-ocr"

export type ExtractedBusinessCardData = {
    name: string
    company?: string | null
    jobTitle?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    businessCategory?: string | null
}

const businessCardAnnotationSchema = z.object({
    name: z.string(),
    company: z.string().optional().nullable(),
    jobTitle: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    businessCategory: z.string().optional().nullable(),
})

const businessCardAnnotationFormat = {
    type: "object",
    properties: {
        name: { type: "string" },
        company: { type: ["string", "null"] },
        jobTitle: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        businessCategory: { type: ["string", "null"], description: "Kategori bisnis dari perusahaan, misal: IT, Konstruksi, Tambang, Otomotif, dll" },
    },
    required: ["name"],
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

export async function extractBusinessCardFromDocument(params: {
    fileBuffer: Buffer
    filename: string
}): Promise<{ data: ExtractedBusinessCardData; rawText: string }> {
    const apiKey = process.env.MISTRAL_API_KEY
    const endpoint = process.env.MISTRAL_OCR_ENDPOINT?.trim() || "https://api.mistral.ai/v1/ocr"
    if (!apiKey) {
        throw new Error("MISTRAL_API_KEY is not set")
    }
    const { filename, fileBuffer } = await normalizeDocumentForOcr(params.filename, params.fileBuffer)
    const base64 = fileBuffer.toString("base64")
    const documentUrl = buildDataUri(filename, base64)
    
    const body = {
        model: "mistral-ocr-latest",
        document: {
            type: "document_url",
            document_url: documentUrl,
        },
        include_image_base64: false,
        document_annotation_format: {
            type: "json_schema",
            json_schema: {
                name: "business_card_annotation",
                schema: businessCardAnnotationFormat,
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
        throw new Error(`MISTRAL_UPSTREAM_ERROR ${res.status}`)
    }
    
    const json = await res.json()
    
    let rawText = ""
    if (json.pages && json.pages[0]) {
        rawText = json.pages[0].markdown || ""
    }
    
    let extracted: any = {}
    const root = json as any
    const candidates = [
        root.document_annotation,
        root.documentAnnotations,
        root.structured,
        (root.result as any)?.document_annotation,
    ]
    for (const candidate of candidates) {
        const normalized = parseJsonLike(candidate)
        if (normalized && typeof normalized === "object") {
            extracted = normalized
            break
        }
    }
    
    if (Object.keys(extracted).length === 0) {
       const fromText = extractJsonFromText(rawText)
       if (fromText) extracted = fromText
    }
    
    const parsed = businessCardAnnotationSchema.safeParse(extracted)
    if (!parsed.success) {
        console.error("Failed to parse business card", parsed.error)
        return {
            data: { name: "Unknown" },
            rawText
        }
    }
    
    return {
        data: parsed.data,
        rawText
    }
}
