import { z } from "zod"
import { renderPdfToImages } from "./ollama-vision-ocr"
import sharp from "sharp"

export type ExtractedBusinessCardData = {
    name: string
    company?: string | null
    jobTitle?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
    businessCategory?: string | null
}

const businessCardSchema = z.object({
    name: z.string().default("Unknown"),
    company: z.string().nullable().optional(),
    jobTitle: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    businessCategory: z.string().nullable().optional(),
})

async function normalizeImageToBase64(fileBuffer: Buffer) {
    const normalized = await sharp(fileBuffer)
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 92 })
        .toBuffer()
    return normalized.toString("base64")
}

async function extractBusinessCardViaOpenAi(imageBase64: string): Promise<{ data: ExtractedBusinessCardData; rawText: string }> {
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
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: "Anda adalah OCR vision engine khusus untuk mengekstrak informasi dari Business Card (Kartu Nama). Kembalikan JSON dengan format persis: name, company, jobTitle, phone, email, address, businessCategory.",
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Ekstrak data kartu nama ini ke format JSON." },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                    ]
                }
            ]
        })
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`OpenAI Vision Error ${response.status}: ${text}`)
    }

    const payload = await response.json()
    const content = payload.choices?.[0]?.message?.content || "{}"
    let extracted: any = {}
    try {
        extracted = JSON.parse(content)
    } catch {}

    const parsed = businessCardSchema.safeParse(extracted)
    return {
        data: parsed.success ? parsed.data : { name: "Unknown" },
        rawText: content,
    }
}

export async function extractBusinessCardViaOllama(params: {
    fileBuffer: Buffer
    filename: string
}): Promise<{ data: ExtractedBusinessCardData; rawText: string }> {
    let imageBase64 = ""
    const lower = params.filename.toLowerCase()
    
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
        imageBase64 = await normalizeImageToBase64(params.fileBuffer)
    } else if (lower.endsWith(".pdf")) {
        const pages = await renderPdfToImages(params.fileBuffer, [1])
        if (pages.length === 0) throw new Error("PDF tidak memiliki halaman yang bisa diproses")
        imageBase64 = pages[0].imageBase64
    } else {
        throw new Error("Format file tidak didukung untuk OCR. Gunakan PDF atau gambar.")
    }

    // Prioritaskan OpenAI Vision jika tersedia
    if (Boolean(process.env.OPENAI_API_KEY?.trim()) || process.env.LLM_PROVIDER === "openai") {
        try {
            return await extractBusinessCardViaOpenAi(imageBase64)
        } catch (openAiErr) {
            console.warn("[Business-Card] OpenAI Vision failed, falling back to Ollama:", openAiErr)
        }
    }

    const rawUrl = process.env.OLLAMA_URL?.trim() || "http://localhost:11434"
    const baseUrl = rawUrl.replace(/\/$/, "")
    const endpoint = baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl}/api/chat`
    const model = process.env.OLLAMA_MODEL?.trim() || "glm-5.3-flash:cloud"
    const apiKey = process.env.OLLAMA_API_KEY?.trim() || ""

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
                        "Anda adalah OCR vision engine khusus untuk mengekstrak informasi dari Business Card (Kartu Nama).",
                        "Kembalikan JSON dengan properti persis seperti berikut (null jika tidak ditemukan):",
                        "name, company, jobTitle, phone, email, address, businessCategory.",
                        "businessCategory diisi perkiraan kategori bisnis perusahaan (contoh: IT, Automotive, Tambang, Retail).",
                        "Jangan menerjemahkan, jangan menambah penjelasan."
                    ].join(" "),
                },
                {
                    role: "user",
                    content: `Ekstrak data kartu nama ini ke format JSON.`,
                    images: [imageBase64],
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
    
    let extracted: any = {}
    if (pageText) {
        try {
            extracted = JSON.parse(pageText)
        } catch {}
    }

    const parsed = businessCardSchema.safeParse(extracted)
    if (!parsed.success) {
        console.error("Failed to parse business card", parsed.error)
        return {
            data: { name: "Unknown" },
            rawText: pageText
        }
    }

    return {
        data: parsed.data,
        rawText: pageText
    }
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

    return ""
}

function extractRawText(messageContent: string) {
    if (!messageContent) return ""
    return messageContent
}
