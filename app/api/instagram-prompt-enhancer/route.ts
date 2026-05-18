import { NextRequest } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

type UploadedAsset = {
  url: string
  filename: string
  contentType?: string
}

type EnhancePromptBody = {
  prompt?: string
  format?: "feed" | "portrait" | "story"
  contentType?: string
  referenceAssets?: Array<string | UploadedAsset>
}

type ChatCompletionChoice = {
  message?: { content?: string | Array<{ type?: string; text?: string }> }
  delta?: { content?: string }
  text?: string
}

const DEFAULT_BASE_URL = "https://9router.chitraparatama.com/v1"
const ENHANCER_MODEL = process.env.INSTAGRAM_PROMPT_ENHANCER_MODEL || "combo"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as EnhancePromptBody | null
    if (!body) {
      return Response.json({ error: "Request tidak valid" }, { status: 400 })
    }

    const prompt = String(body.prompt || "").trim()
    if (!prompt) {
      return Response.json({ error: "Prompt wajib diisi sebelum enhancement" }, { status: 400 })
    }

    const apiKey = process.env.INSTAGRAM_IMAGE_API_KEY
    if (!apiKey) {
      return Response.json({ error: "Konfigurasi API belum lengkap: INSTAGRAM_IMAGE_API_KEY belum diset" }, { status: 500 })
    }

    const response = await fetch(getEnhancerUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        model: ENHANCER_MODEL,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          {
            role: "user",
            content: buildUserPrompt({
              prompt,
              format: body.format || "feed",
              contentType: body.contentType || "Edukasi",
              referenceAssets: normalizeReferenceAssets(body.referenceAssets),
            }),
          },
        ],
        temperature: 0.7,
        stream: false,
      }),
    })

    const rawText = await response.text()
    if (!response.ok) {
      return Response.json({ error: `Provider gagal meningkatkan prompt: ${extractProviderError(rawText)}` }, { status: 502 })
    }

    const enhancedPrompt = extractAssistantText(rawText)
    if (!enhancedPrompt) {
      return Response.json({ error: "Provider tidak mengembalikan prompt hasil enhancement" }, { status: 502 })
    }

    return Response.json({ prompt, enhancedPrompt })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal meningkatkan prompt"
    return Response.json({ error: message }, { status: 500 })
  }
}

function getEnhancerUrl() {
  const configuredUrl = process.env.INSTAGRAM_PROMPT_ENHANCER_API_URL?.trim()
  if (configuredUrl) return configuredUrl
  const baseUrl = (process.env.INSTAGRAM_PROMPT_ENHANCER_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "")
  return `${baseUrl}/chat/completions`
}

function buildSystemPrompt() {
  return [
    "Anda adalah spesialis Instagram perusahaan dan desainer grafis senior.",
    "Ubah prompt mentah menjadi prompt gambar yang sederhana, ringkas, mudah dipahami, dan tetap lengkap untuk PT Chitra Paratama.",
    "Fokus pada satu pesan utama, komposisi bersih, visual profesional, dan ruang aman karena logo/footer ditambahkan oleh template sistem.",
    "Jangan membuat data faktual palsu, angka palsu, nama customer palsu, klaim palsu, markdown, bullet list, atau penjelasan.",
    "Balas hanya satu prompt final Bahasa Indonesia.",
  ].join(" ")
}

function normalizeReferenceAssets(value: EnhancePromptBody["referenceAssets"]): UploadedAsset[] {
  if (!Array.isArray(value)) return []
  return value.map((asset) => {
    if (typeof asset === "string") return { url: asset, filename: asset }
    return asset
  }).filter((asset): asset is UploadedAsset => Boolean(asset?.url && asset.filename))
}

function buildUserPrompt(input: Omit<Required<EnhancePromptBody>, "referenceAssets"> & { referenceAssets: UploadedAsset[] }) {
  const ratio = input.format === "story" ? "Story Instagram 9:16" : input.format === "portrait" ? "Feed portrait Instagram 4:5" : "Feed Instagram 1:1"
  const references = input.referenceAssets.length > 0
    ? `Aset/referensi yang tersedia: ${input.referenceAssets.map((asset) => asset.filename).join(", ")}. Gunakan sebagai arahan visual bila relevan, tanpa mengarang detail isi gambar yang tidak terlihat.`
    : "Tidak ada aset referensi tambahan."

  return [
    `Format: ${ratio}.`,
    `Kategori: ${input.contentType}.`,
    `Ide awal: ${input.prompt}.`,
    references,
    "Buat prompt final yang singkat dan jelas: satu fokus visual utama, komposisi full-bleed memenuhi seluruh kanvas, tanpa border/margin/kartu putih/frame kosong, warna profesional, tidak ramai, tanpa membuat logo/footer/teks kecil karena template brand ditambahkan setelah generate.",
  ].join(" ")
}

function extractAssistantText(rawText: string) {
  const chunks = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.startsWith("data:") ? line.slice(5).trim() : line)
    .filter((line) => line && line !== "[DONE]")

  const texts: string[] = []
  for (const chunk of chunks.length ? chunks : [rawText]) {
    try {
      collectText(JSON.parse(chunk), texts)
    } catch {
      if (chunk.length > 20) texts.push(chunk)
    }
  }

  return texts.join(" ").replace(/```(?:[a-z]+)?|```/gi, "").trim()
}

function collectText(value: unknown, texts: string[]) {
  if (!value || typeof value !== "object") return
  const record = value as Record<string, unknown>
  const choices = record.choices
  if (Array.isArray(choices)) {
    for (const choice of choices as ChatCompletionChoice[]) {
      const messageContent = choice.message?.content
      if (typeof messageContent === "string") texts.push(messageContent)
      if (Array.isArray(messageContent)) {
        for (const part of messageContent) {
          if (typeof part.text === "string") texts.push(part.text)
        }
      }
      if (typeof choice.delta?.content === "string") texts.push(choice.delta.content)
      if (typeof choice.text === "string") texts.push(choice.text)
    }
  }

  for (const key of ["content", "text", "output", "result", "enhancedPrompt"]) {
    const text = record[key]
    if (typeof text === "string") texts.push(text)
  }
}

function extractProviderError(rawText: string) {
  try {
    const json = JSON.parse(rawText) as { error?: { message?: string } | string; message?: string }
    if (typeof json.error === "string") return json.error
    return json.error?.message || json.message || rawText.slice(0, 500)
  } catch {
    return rawText.slice(0, 500) || "response kosong dari provider"
  }
}
