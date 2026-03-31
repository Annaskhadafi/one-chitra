import sharp from "sharp"
import { z } from "zod"
import { extractJsonFromText } from "./ocr-utils"

export type ExtractedProduct = {
    name: string
    code?: string | null
    qty: number
    unit_price: number
    total_price?: number | null
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
    model: string
    pagesProcessed: number
}

const documentAnnotationSchema = z.object({
    customer_company_name: z.string().default("Unknown Customer"),
    customer_code: z.string().optional().nullable(),
    po_number: z.string().default("Unknown PO"),
    document_date: z.string().default(""),
    products: z.array(
        z.object({
            name: z.string().default("Unknown Product"),
            code: z.string().optional().nullable(),
            qty: z.any().transform(v => Number(v) || 0),
            unit_price: z.any().transform(v => Number(v) || 0),
            total_price: z.any().optional().nullable().transform(v => Number(v) || 0),
        })
    ).default([]),
    tax_total: z.any().optional().nullable().transform(v => Number(v) || 0),
    grand_total: z.any().optional().nullable().transform(v => Number(v) || 0),
}).partial().passthrough() // Allow partial and extra fields for robustness

export async function extractStructuredFromPoViaOllama(params: {
    fileBuffer: Buffer
    filename: string
    pages?: string | number[] | null
}): Promise<OcrResult> {
    const rawUrl = process.env.OLLAMA_URL?.trim() || "http://localhost:11434"
    const baseUrl = rawUrl.replace(/\/$/, "")
    const endpoint = baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl}/api/chat`
    const model = process.env.OLLAMA_MODEL_VISION?.trim() || "qwen3.5:397b-cloud"
    const apiKey = process.env.OLLAMA_API_KEY?.trim() || ""

    // 1. Prepare image (Focusing on 1st page for speed, consistent with vendor-quotation)
    const imageBase64 = await prepareImageForOllama(params.fileBuffer, params.filename)

    // 2. Call Ollama
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
                    content: `Anda adalah AI OCR profesional untuk dokumen Purchase Order (PO).
Tugas Anda adalah mengekstrak data dari PO pelanggan ke dalam format JSON yang valid.
Pusatkan pencarian pada: Nama Customer (Pemberi Pesanan), Nomor PO, Tanggal Dokumen, dan Daftar Produk/Barang beserta Kuantitas dan Harga Satuan.

Kembalikan EXPLAINED JSON dengan field:
{
  "customer_company_name": "Nama Perusahaan Pelanggan",
  "po_number": "Nomor Purchase Order",
  "document_date": "Tanggal PO (YYYY-MM-DD)",
  "products": [
    {
      "name": "Nama Lengkap/Deskripsi Barang",
      "qty": 1,
      "unit_price": 1000,
      "total_price": 1000
    }
  ],
  "tax_total": 0,
  "grand_total": 0
}`
                },
                {
                    role: "user",
                    content: "Lakukan OCR pada Purchase Order ini.",
                    images: [imageBase64],
                },
            ],
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama Upstream Error ${response.status}: ${errorText}`)
    }

    const json = await response.json()
    const content = json.message?.content || "{}"
    
    let structured: ExtractedSOData
    try {
        const extracted = extractJsonFromText(content)
        if (!extracted) {
            throw new Error("(Ollama JSON malformed)")
        }
        const validated = documentAnnotationSchema.parse(extracted)
        structured = validated as ExtractedSOData
    } catch (e) {
        console.error("Ollama SO OCR Parse Error:", content, e)
        throw new Error(`Gagal mengekstrak data terstruktur dari PO ${e instanceof Error ? e.message : "(Ollama JSON malformed)"}`)
    }

    return {
        rawText: content, // We use the JSON as raw text for debugging or fallback
        structured,
        model,
        pagesProcessed: 1,
    }
}

async function prepareImageForOllama(fileBuffer: Buffer, filename: string): Promise<string> {
    const lower = filename.toLowerCase()
    
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
        const normalized = await sharp(fileBuffer)
            .flatten({ background: "#ffffff" })
            .resize(1600, 2000, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toBuffer()
        return normalized.toString("base64")
    }

    if (lower.endsWith(".pdf")) {
        const { renderPdfToImages } = await import("./ollama-vision-ocr")
        const pages = await renderPdfToImages(fileBuffer, [1]) 
        if (pages.length > 0) {
            return pages[0].imageBase64
        }
    }

    throw new Error("Format file tidak didukung untuk OCR Ollama: " + filename)
}

