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

export async function extractBusinessCardViaOllama(params: {
    fileBuffer: Buffer
    filename: string
}): Promise<{ data: ExtractedBusinessCardData; rawText: string }> {
    const rawUrl = process.env.OLLAMA_URL?.trim() || "http://localhost:11434"
    const baseUrl = rawUrl.replace(/\/$/, "")
    const endpoint = baseUrl.endsWith("/api/chat") ? baseUrl : `${baseUrl}/api/chat`
    const model = process.env.OLLAMA_MODEL?.trim() || "qwen3.5:397b-cloud"
    const apiKey = process.env.OLLAMA_API_KEY?.trim() || ""

    let imageBase64 = ""
    const lower = params.filename.toLowerCase()
    
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
        imageBase64 = await normalizeImageToBase64(params.fileBuffer)
    } else if (lower.endsWith(".pdf")) {
        const pages = await renderPdfToImages(params.fileBuffer, [1])
        if (pages.length === 0) throw new Error("PDF tidak memiliki halaman yang bisa diproses")
        imageBase64 = pages[0].imageBase64
    } else {
        throw new Error("Format file tidak didukung untuk OCR Ollama. Gunakan PDF atau gambar.")
    }

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
