import sharp from "sharp"
import { VendorQuotationWithItems } from "@/types/vendor-quotation"

type OllamaQuotationResult = {
    vendor_name: string | null
    quote_number: string | null
    quote_date: string | null
    remark: string | null
    items: {
        item_name: string
        qty: number
        unit: string | null
        unit_price: number
        total_price: number
        remark: string | null
    }[]
}

import { extractJsonFromText } from "./ocr-utils"

async function extractVendorQuotationViaOpenAi(imageBase64: string): Promise<OllamaQuotationResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set")

    const rawBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://9router.chitraparatama.com/v1"
    const baseUrl = rawBaseUrl.replace(/\/$/, "")
    const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
    const model = process.env.OPENAI_MODEL?.trim() || "cx/gpt-5.6-luna"

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(35000),
        body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `Anda adalah AI ekstraksi data dokumen profesional. 
Tugas Anda adalah mengekstrak data dari dokumen Vendor Quotation (Penawaran Harga) ke dalam format JSON.
Fokus pada akurasi item, kuantitas, dan harga.

Kembalikan JSON dengan format:
{
  "vendor_name": "Nama Vendor",
  "quote_number": "Nomor Quote",
  "quote_date": "Tanggal Quote (YYYY-MM-DD)",
  "remark": "Catatan umum",
  "items": [
    {
      "item_name": "Nama Barang",
      "qty": 1,
      "unit": "Pcs/Unit/dll",
      "unit_price": 1000,
      "total_price": 1000,
      "remark": "Keterangan item"
    }
  ]
}`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Ekstrak semua informasi penting dari quotation ini ke dalam JSON." },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                    ]
                }
            ]
        })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI Vision Error ${response.status}: ${errorText}`)
    }

    const json = await response.json()
    const content = json.choices?.[0]?.message?.content || "{}"

    const extracted = extractJsonFromText(content)
    if (!extracted) throw new Error("(OpenAI JSON malformed)")

    return {
        rawText: content,
        structured: extracted as ExtractedVendorQuotation,
        model: `9router-vision (${model})`,
    }
}

export async function extractVendorQuotationViaOllama(params: {
    fileBuffer: Buffer
    filename: string
}): Promise<OllamaQuotationResult> {
    // 1. Prepare image (Vision needs images)
    const imageBase64 = await prepareImageForOllama(params.fileBuffer, params.filename)

    // 2. Prioritaskan OpenAI Vision jika tersedia
    if (Boolean(process.env.OPENAI_API_KEY?.trim()) || process.env.LLM_PROVIDER === "openai") {
        try {
            return await extractVendorQuotationViaOpenAi(imageBase64)
        } catch (openAiErr) {
            console.warn("[Vendor-Quotation] OpenAI Vision failed, falling back to Ollama:", openAiErr)
        }
    }

    const rawUrl = process.env.OLLAMA_URL?.trim() || "http://localhost:11434"
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
                    content: `Anda adalah AI ekstraksi data dokumen profesional. 
Tugas Anda adalah mengekstrak data dari dokumen Vendor Quotation (Penawaran Harga) ke dalam format JSON.
Fokus pada akurasi item, kuantitas, dan harga.

Kembalikan JSON dengan format:
{
  "vendor_name": "Nama Vendor",
  "quote_number": "Nomor Quote",
  "quote_date": "Tanggal Quote (YYYY-MM-DD)",
  "remark": "Catatan umum",
  "items": [
    {
      "item_name": "Nama Barang",
      "qty": 1,
      "unit": "Pcs/Unit/dll",
      "unit_price": 1000,
      "total_price": 1000,
      "remark": "Keterangan item"
    }
  ]
}`
                },
                {
                    role: "user",
                    content: "Ekstrak semua informasi penting dari quotation ini.",
                    images: [imageBase64],
                },
            ],
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama Error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const content = data.message?.content || ""
    
    try {
        const extracted = extractJsonFromText(content)
        if (!extracted) {
            throw new Error("(Ollama JSON malformed)")
        }
        return extracted as OllamaQuotationResult
    } catch (e) {
        console.error("Gagal parse JSON dari Ollama:", content, e)
        throw new Error(`Gagal mengekstrak data terstruktur dari Vendor Quotation ${e instanceof Error ? e.message : "(Ollama JSON malformed)"}`)
    }
}

async function prepareImageForOllama(fileBuffer: Buffer, filename: string): Promise<string> {
    const lower = filename.toLowerCase()
    
    // Jika sudah gambar, tinggal resize/normalize
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
        const normalized = await sharp(fileBuffer)
            .resize(1200, 1600, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer()
        return normalized.toString("base64")
    }

    // Jika PDF, gunakan Puppeteer (pinjam logika dari lib/ollama-vision-ocr.ts tapi disederhanakan)
    if (lower.endsWith(".pdf")) {
        const { renderPdfToImages } = await import("./ollama-vision-ocr")
        const pages = await renderPdfToImages(fileBuffer, [1]) // Proses halaman pertama saja untuk kecepatan
        if (pages.length > 0) {
            return pages[0].imageBase64
        }
    }

    throw new Error("Format file tidak didukung: " + filename)
}
