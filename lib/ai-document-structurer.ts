import { z } from "zod"

export type ExtractedSOProduct = {
    name: string
    code: string | null
    qty: number
    unit_price: number
    total_price: number
}

export type ExtractedSOData = {
    customer_company_name: string
    customer_code: string | null
    po_number: string
    document_date: string
    products: ExtractedSOProduct[]
    tax_total?: number
    grand_total?: number
}

export type ExtractedVendorQuotation = {
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

const soSchema = z.object({
    customer_company_name: z.string().default("Unknown Customer"),
    customer_code: z.string().optional().nullable().default(null),
    po_number: z.string().default("Unknown PO"),
    document_date: z.string().default(new Date().toISOString().split("T")[0]),
    products: z.array(
        z.object({
            name: z.string().default("Unknown Product"),
            code: z.string().optional().nullable().default(null),
            qty: z.any().transform(v => Number(String(v).replace(/,/g, "")) || 0),
            unit_price: z.any().transform(v => Number(String(v).replace(/,/g, "")) || 0),
            total_price: z.any().optional().nullable().transform(v => Number(String(v).replace(/,/g, "")) || 0),
        })
    ).default([]),
    tax_total: z.any().optional().nullable().transform(v => Number(String(v).replace(/,/g, "")) || 0),
    grand_total: z.any().optional().nullable().transform(v => Number(String(v).replace(/,/g, "")) || 0),
}).partial().passthrough()

const quotationSchema = z.object({
    vendor_name: z.string().optional().nullable().default(null),
    quote_number: z.string().optional().nullable().default(null),
    quote_date: z.string().optional().nullable().default(null),
    remark: z.string().optional().nullable().default(null),
    items: z.array(
        z.object({
            item_name: z.string().default("Unknown Item"),
            qty: z.any().transform(v => Number(String(v).replace(/,/g, "")) || 0),
            unit: z.string().optional().nullable().default(null),
            unit_price: z.any().transform(v => Number(String(v).replace(/,/g, "")) || 0),
            total_price: z.any().optional().nullable().transform(v => Number(String(v).replace(/,/g, "")) || 0),
            remark: z.string().optional().nullable().default(null),
        })
    ).default([]),
}).partial().passthrough()

/**
 * Call Mistral Chat completion for fast structured JSON output from text
 */
async function callMistralChat(systemPrompt: string, userText: string): Promise<string> {
    const apiKey = process.env.MISTRAL_API_KEY?.trim()
    if (!apiKey) {
        throw new Error("MISTRAL_API_KEY is not set")
    }

    const endpoint = "https://api.mistral.ai/v1/chat/completions"
    const sanitizedText = userText.length > 12000 ? userText.slice(0, 12000) : userText

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
            model: "mistral-small-latest",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: sanitizedText },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
        }),
    })

    if (!response.ok) {
        const errText = await response.text().catch(() => "")
        throw new Error(`Mistral Chat Error ${response.status}: ${errText.slice(0, 300)}`)
    }

    const json = await response.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) {
        throw new Error("Mistral Chat returned empty response content")
    }
    return content
}

/**
 * Fallback to Ollama Chat if Mistral is unavailable
 */
async function callOllamaChat(systemPrompt: string, userText: string): Promise<string> {
    const rawUrl = process.env.OLLAMA_URL || "http://localhost:11434"
    const baseUrl = rawUrl.replace(/\/$/, "")
    const endpoint = baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl}/api/chat`
    const model = process.env.OLLAMA_MODEL || "kimi-k2.5:cloud"
    const apiKey = process.env.OLLAMA_API_KEY || ""
    const sanitizedText = userText.length > 12000 ? userText.slice(0, 12000) : userText

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        signal: AbortSignal.timeout(18000),
        body: JSON.stringify({
            model,
            stream: false,
            format: "json",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: sanitizedText },
            ],
        }),
    })

    if (!response.ok) {
        const errText = await response.text().catch(() => "")
        throw new Error(`Ollama Chat Error ${response.status}: ${errText.slice(0, 300)}`)
    }

    const json = await response.json()
    return json.message?.content || "{}"
}

function extractJsonFromText(text: string): Record<string, unknown> | null {
    try {
        return JSON.parse(text)
    } catch {
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
            try {
                return JSON.parse(match[0])
            } catch {
                return null
            }
        }
        return null
    }
}

/**
 * Execute LLM chat completion with multi-provider fallback
 */
async function completeStructuredChat(systemPrompt: string, userText: string): Promise<string> {
    const errors: string[] = []

    // 1. Try Mistral (Fastest & high quality JSON)
    if (process.env.MISTRAL_API_KEY?.trim()) {
        try {
            return await callMistralChat(systemPrompt, userText)
        } catch (err) {
            console.warn("[AI-Structurer] Mistral chat failed, trying fallback:", err)
            errors.push(`Mistral: ${err instanceof Error ? err.message : String(err)}`)
        }
    }

    // 2. Try Ollama
    try {
        return await callOllamaChat(systemPrompt, userText)
    } catch (err) {
        console.warn("[AI-Structurer] Ollama chat failed:", err)
        errors.push(`Ollama: ${err instanceof Error ? err.message : String(err)}`)
    }

    throw new Error(`Semua provider AI structuring gagal: ${errors.join("; ")}`)
}

/**
 * Memetakan teks/markdown PO menjadi format JSON Sales Order terstruktur menggunakan AI
 */
export async function structurePoFromMarkdown(markdownText: string): Promise<ExtractedSOData> {
    console.log("[PO-Structurer] Parsing PO markdown structure via AI LLM...")
    const systemPrompt = `Anda adalah analisis dokumen Purchase Order (PO) tingkat tinggi.
Tugas Anda adalah membaca teks/markdown dari dokumen PO pelanggan dan mengekstrak informasi terstruktur ke dalam format JSON yang valid.
Balas HANYA dengan JSON murni tanpa penjelasan tambahan.

Format JSON yang diwajibkan:
{
  "customer_company_name": "Nama Perusahaan Pelanggan / Buyer (contoh: PT HASNUR RIUNG SINERGI)",
  "customer_code": null,
  "po_number": "Nomor Purchase Order (contoh: PO-HRS-2026-0889)",
  "document_date": "Tanggal Dokumen PO format YYYY-MM-DD (contoh: 2026-08-10)",
  "products": [
    {
      "name": "Nama lengkap/deskripsi barang yang dipesan",
      "code": "Kode part/material jika ada",
      "qty": 1,
      "unit_price": 150000000,
      "total_price": 150000000
    }
  ],
  "tax_total": 0,
  "grand_total": 0
}`

    const rawJson = await completeStructuredChat(systemPrompt, markdownText)
    const parsed = extractJsonFromText(rawJson)
    if (!parsed) {
        throw new Error("Gagal mengurai respons JSON untuk PO")
    }

    const validated = soSchema.parse(parsed) as ExtractedSOData

    // Hitung total_price jika 0
    if (validated.products) {
        validated.products = validated.products.map(p => ({
            ...p,
            total_price: p.total_price || (p.qty * p.unit_price) || 0,
        }))
    }

    return validated
}

/**
 * Memetakan teks/markdown Vendor Quotation menjadi format JSON Quotation terstruktur menggunakan AI
 */
export async function structureVendorQuotationFromMarkdown(markdownText: string): Promise<ExtractedVendorQuotation> {
    console.log("[Quotation-Structurer] Parsing Vendor Quotation structure via AI LLM...")
    const systemPrompt = `Anda adalah AI analisis dokumen penawaran harga (Vendor Quotation).
Tugas Anda adalah membaca teks/markdown dari dokumen Quotation Vendor dan mengekstrak informasi terstruktur ke dalam format JSON.
Fokus ekstrak:
- Nama perusahaan Vendor / Supplier yang menerbitkan quotation
- Nomor Quotation / Penawaran
- Tanggal Quotation
- Remark / Syarat pembayaran / Catatan
- Daftar item barang/jasa (Nama item, Satuan/UOM, Qty, Harga Satuan, Total Harga)

Balas HANYA dengan JSON murni tanpa teks pengantar.

Format JSON yang diwajibkan:
{
  "vendor_name": "Nama perusahaan vendor / supplier yang menerbitkan quotation",
  "quote_number": "Nomor quotation / penawaran",
  "quote_date": "Tanggal quotation format YYYY-MM-DD jika memungkinkan",
  "remark": "Catatan umum, masa berlaku penawaran, payment terms, atau keterangan lainnya",
  "items": [
    {
      "item_name": "Nama lengkap deskripsi barang atau jasa",
      "qty": 1,
      "unit": "Pcs/Unit/Set/dll",
      "unit_price": 1000000,
      "total_price": 1000000,
      "remark": "Keterangan spesifik item jika ada"
    }
  ]
}`

    const rawJson = await completeStructuredChat(systemPrompt, markdownText)
    const parsed = extractJsonFromText(rawJson)
    if (!parsed) {
        throw new Error("Gagal mengurai respons JSON untuk Vendor Quotation")
    }

    const validated = quotationSchema.parse(parsed) as ExtractedVendorQuotation

    // Hitung total_price jika 0
    if (validated.items) {
        validated.items = validated.items.map(item => ({
            ...item,
            total_price: item.total_price || (item.qty * item.unit_price) || 0,
        }))
    }

    return validated
}
