﻿﻿﻿﻿﻿﻿import { NextRequest } from "next/server"

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
  visualStyle?: string
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
              visualStyle: body.visualStyle || "Modern & Clean",
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
    "Anda adalah spesialis konten Instagram perusahaan B2B dan desainer grafis senior untuk PT Chitra Paratama (Total Tire Solution).",
    "Tugas Anda: terima input singkat dari user (bisa hanya beberapa kata atau kalimat pendek), lalu kembangkan menjadi prompt gambar Instagram yang lengkap, detail, dan siap dipakai AI image generator.",
    "Warna brand resmi PT Chitra Paratama: Michelin Blue (#004C98), Sky Blue (#009EBE), Fresh Green (#8DC63F), Navy/Blue Black Tire (#002D56). Selalu gunakan palet ini dalam prompt.",
    "WAJIB: Jika prompt SECARA EKSPLISIT meminta, menampilkan, atau melibatkan sosok manusia (pekerja, mekanik, teknisi, operator, karyawan, tim lapangan), mereka HARUS memakai wearpack safety TWO-TONE resmi: lengan BIRU NAVY GELAP (#002D56), panel dada/bahu atas HIJAU NEON (#8DC63F) berada DI ATAS strip reflektif atas, dua strip reflektif silver horizontal mengelilingi badan dengan strip utama tepat di atas pusar/udel, dan area perut sampai bawah DI BAWAH strip bawah berwarna BIRU NAVY GELAP (#002D56). WAJIB: di atas saku dada kiri wearpack, tempel patch logo Chitra Paratama berbentuk persegi panjang kecil dengan BACKGROUND PUTIH SOLID di belakang logo — logo CP berwarna asli di atas kotak putih, dijahit/bordir natural ke kain wearpack, terlihat jelas dan kontras. Patch ini harus tampak seperti name tag atau label bordir resmi yang menempel di atas saku, bukan stiker mengambang. Gunakan warna brand: Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56. Komposisi profesional, pencahayaan natural. Jika prompt TIDAK meminta orang, jangan paksa ada orang dalam gambar.",
    "Format output WAJIB mengikuti struktur berikut (isi bagian dalam kurung siku berdasarkan konteks input user, jangan biarkan placeholder kosong):",
    "Content focus: [deskripsi fokus konten yang dikembangkan dari input user].",
    "Headline text: \"[teks headline yang relevan, singkat, dan kuat — untuk kategori Ucapan ulang tahun customer, buat headline ucapan seperti 'Happy Birthday, [Nama]!', 'Selamat Ulang Tahun, [Nama]!', atau 'Wishing You a Wonderful Birthday, [Nama]!' berdasarkan nama yang disebutkan user; jika tidak ada nama, gunakan 'Selamat Ulang Tahun!' saja]\"",
    "Brand/Source: \"PT Chitra Paratama\"",
    "Visual style: [gaya visual sesuai pilihan user] with Chitra Paratama brand colors (Michelin Blue #004C98, Sky Blue #009EBE, Fresh Green #8DC63F, Navy #002D56) color scheme. [deskripsi detail elemen visual, komposisi, tipografi, dan mood].",
    "Additional elements: [elemen visual tambahan yang relevan dengan topik, misal: ban, alat berat, peta distribusi, grafik, dll].",
    "Variant note: [saran foto atau ilustrasi yang cocok untuk diintegrasikan ke desain].",
    "Aturan ketat: jangan buat logo Chitra Paratama, footer, watermark, atau ikon media sosial karena ditambahkan oleh overlay template. SAFE ZONE WAJIB: berikan margin minimal 200px dari tepi ATAS (area pojok kiri atas ~320x180px tertutup logo overlay) dan minimal 180px dari tepi BAWAH (tertutup footer overlay). Posisikan semua teks headline dan elemen penting di zona tengah kanvas saja, jangan mepet tepi atas atau bawah. Jangan buat data palsu, angka palsu, atau klaim palsu. Jangan tambahkan markdown, bullet list, atau penjelasan di luar format. Balas hanya satu prompt final dalam Bahasa Inggris mengikuti format di atas.",
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
    ? `Aset/referensi yang tersedia: ${input.referenceAssets.map((asset) => `${asset.filename}`).join(", ")}. Gunakan sebagai arahan visual bila relevan, tanpa mengarang detail isi gambar yang tidak terlihat.`
    : "Tidak ada aset referensi tambahan."
  const styleInstruction = input.visualStyle === "Vector Kartun Simple"
    ? "Instruksi gaya khusus: buat prompt untuk ilustrasi flat vector cartoon sederhana, clean, outline tegas, warna solid brand PT Chitra Paratama, satu fokus visual jelas, tanpa photorealistic, tanpa 3D render, tanpa tekstur kompleks, tanpa detail kecil berlebihan."
    : input.visualStyle === "Style Retro"
      ? "Instruksi gaya khusus: Style Retro wajib terasa seperti retro poster dengan gouache illustration, fisheye perspective atau tiny planet bila cocok, heroic composition, editorial illustration, travel poster mood, grain texture, stylized environment, dan dynamic low angle. Gunakan nuansa vintage hangat yang tetap selaras dengan warna brand PT Chitra Paratama, komposisi poster penuh, tekstur hand-painted, dan teks tetap mudah dibaca."
    : ""

  return [
    `Format: ${ratio}.`,
    `Kategori: ${input.contentType}.`,
    `Gaya visual: ${input.visualStyle}.`,
    styleInstruction,
    `Ide awal: ${input.prompt}.`,
    references,
    "Kembangkan input singkat di atas menjadi prompt komprehensif mengikuti format struktur (Content focus, Headline text, Brand/Source, Visual style, Additional elements, Variant note).",
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
