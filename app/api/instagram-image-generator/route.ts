import { NextRequest } from "next/server"
import sharp from "sharp"
import fs from "fs/promises"
import path from "path"
import { headers } from "next/headers"
import { composeInstagramImage } from "@/lib/instagram-compose-engine"
import { readManagedUpload, uploadBase64Image } from "@/lib/upload-storage"
import { auth } from "@/lib/auth"
import { db } from "@/db"
import { instagramImageHistory } from "@/db/schema/instagram-history"
import { eq, count } from "drizzle-orm"

export const runtime = "nodejs"
export const maxDuration = 120

type UploadedAsset = {
  url: string
  filename: string
  contentType?: string
}

type GenerateImageBody = {
  prompt?: string
  format?: "feed" | "portrait" | "story"
  contentType?: string
  visualStyle?: string
  referenceAssets?: Array<string | UploadedAsset>
  mode?: "single" | "variations"
}

type GeneratedImageResult = {
  image: string
  mimeType: string
  width: number
  height: number
  prompt: string
  enhancedPrompt: string
}

const API_URL = process.env.INSTAGRAM_IMAGE_API_URL || "https://9router.chitraparatama.com/v1/images/generations"
const API_MODEL = process.env.INSTAGRAM_IMAGE_MODEL || "cx/gpt-5.4-image"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as GenerateImageBody | null
    if (!body) {
      return Response.json({ error: "Request tidak valid" }, { status: 400 })
    }

    const prompt = String(body.prompt || "").trim()
    if (!prompt) {
      return Response.json({ error: "Prompt wajib diisi" }, { status: 400 })
    }

    const apiKey = process.env.INSTAGRAM_IMAGE_API_KEY
    if (!apiKey) {
      return Response.json({ error: "Konfigurasi API belum lengkap: INSTAGRAM_IMAGE_API_KEY belum diset" }, { status: 500 })
    }

    const format = body.format || "feed"
    const contentType = body.contentType || "Edukasi"
    const visualStyle = body.visualStyle || "Modern & Clean"
    const referenceAssets = normalizeReferenceAssets(body.referenceAssets)

    const session = await auth.api.getSession({ headers: await headers() })
    const userId = session?.user?.id

    if (body.mode === "variations") {
      const variations = await Promise.all([
        generateOneImage({ apiKey, prompt, format, contentType, visualStyle, referenceAssets, variationInstruction: "Variasi 1: gaya visual corporate premium, clean, elegan, komposisi seimbang, warna brand tegas, wajib ada headline utama besar yang relevan." }),
        generateOneImage({ apiKey, prompt, format, contentType, visualStyle, referenceAssets, variationInstruction: "Variasi 2: gaya visual modern editorial, dinamis, depth lebih kuat, angle berbeda, wajib ada headline utama besar yang relevan agar konten tidak kosong." }),
      ])
      
      if (userId) {
        // Fire and forget history save
        Promise.all(variations.map(v => saveToHistorySafely(userId, v, format, contentType, visualStyle))).catch(console.error)
      }
      
      return Response.json({ variations })
    }

    const result = await generateOneImage({ apiKey, prompt, format, contentType, visualStyle, referenceAssets })
    
    if (userId) {
      // Fire and forget history save
      saveToHistorySafely(userId, result, format, contentType, visualStyle).catch(console.error)
    }
    
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat gambar Instagram"
    return Response.json({ error: message }, { status: 500 })
  }
}

async function generateOneImage(input: {
  apiKey: string
  prompt: string
  format: NonNullable<GenerateImageBody["format"]>
  contentType: string
  visualStyle: string
  referenceAssets: UploadedAsset[]
  variationInstruction?: string
}): Promise<GeneratedImageResult> {
  // Kirim URL langsung ke API (sesuai format curl: "image": "https://...")
  // Hanya URL upload user — wearpack/logo sudah ada di deskripsi prompt teks
  const referenceUrls: string[] = []
  input.referenceAssets.slice(0, 4).forEach((asset) => {
    if (asset.url && asset.url.startsWith("http")) referenceUrls.push(asset.url)
  })

  const referenceSummaries = await resolveReferenceSummaries(input.referenceAssets)
  
  const enhancedPrompt = buildEnhancedPrompt({
    prompt: input.variationInstruction ? `${input.prompt}. ${input.variationInstruction}` : input.prompt,
    format: input.format,
    contentType: input.contentType,
    visualStyle: input.visualStyle,
    referenceAssets: input.referenceAssets,
    referenceSummaries,
  })

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: API_MODEL,
      prompt: enhancedPrompt,
      n: 1,
      size: "auto",
      quality: "auto",
      background: "auto",
      image_detail: "high",
      output_format: "png",
      ...(referenceUrls.length > 0 ? {
        image: referenceUrls[0],
        images: referenceUrls,
        reference_images: referenceUrls,
        input_images: referenceUrls,
      } : {}),
    }),
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(`Provider gagal memproses gambar: ${extractProviderError(rawText)}`)
  }

  const sourceImage = await resolveImageBuffer(rawText)
  const branded = await composeInstagramImage({ source: sourceImage, format: input.format })
  const metadata = await sharp(branded).metadata()
  return {
    image: `data:image/png;base64,${branded.toString("base64")}`,
    mimeType: "image/png",
    width: metadata.width || 0,
    height: metadata.height || 0,
    prompt: input.prompt,
    enhancedPrompt,
  }
}



async function resolveReferenceImages(assets: UploadedAsset[]) {
  const images = await Promise.all(assets.slice(0, 4).map(async (asset) => {
    const read = await readManagedUpload(asset.url)
    if (!read) {
      throw new Error(`Aset referensi tidak ditemukan: ${asset.filename}`)
    }
    const normalized = await sharp(read.buffer)
      .rotate()
      .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
      .png({ quality: 100, compressionLevel: 9 })
      .toBuffer()
    return `data:image/png;base64,${normalized.toString("base64")}`
  }))
  return images
}

async function resolveReferenceSummaries(assets: UploadedAsset[]) {
  return Promise.all(assets.slice(0, 4).map(async (asset) => {
    const read = await readManagedUpload(asset.url)
    if (!read) {
      throw new Error(`Aset referensi tidak ditemukan: ${asset.filename}`)
    }
    const metadata = await sharp(read.buffer).metadata()
    const stats = await sharp(read.buffer)
      .resize(1, 1, { fit: "cover" })
      .raw()
      .toBuffer()
    const color = `rgb(${stats[0]}, ${stats[1]}, ${stats[2]})`
    return `${asset.filename}: gambar referensi ${metadata.width || 0}x${metadata.height || 0}px, warna dominan sekitar ${color}`
  }))
}

function normalizeReferenceAssets(value: GenerateImageBody["referenceAssets"]): UploadedAsset[] {
  if (!Array.isArray(value)) return []
  return value.map((asset) => {
    if (typeof asset === "string") {
      return { url: asset, filename: asset }
    }
    return asset
  }).filter((asset): asset is UploadedAsset => Boolean(asset?.url && asset.filename))
}

async function saveToHistorySafely(
  userId: string,
  result: GeneratedImageResult,
  format: string,
  contentType: string,
  visualStyle: string
) {
  try {
    const filename = `instagram-gen-${userId}-${Date.now()}.png`
    const uploadResult = await uploadBase64Image(result.image, filename)
    if (!uploadResult?.url) return

    const base64Data = result.image.split(",")[1] || result.image
    const sizeBytes = Math.round(base64Data.length * 0.75)

    // Transaction for enforcing limit and inserting new entry
    await db.transaction(async (tx) => {
      const userHistoryCount = await tx
        .select({ value: count() })
        .from(instagramImageHistory)
        .where(eq(instagramImageHistory.userId, userId))

      if (userHistoryCount[0].value >= 50) {
        const oldestEntries = await tx
          .select({ id: instagramImageHistory.id })
          .from(instagramImageHistory)
          .where(eq(instagramImageHistory.userId, userId))
          .orderBy(instagramImageHistory.createdAt)
          .limit(userHistoryCount[0].value - 49)

        if (oldestEntries.length > 0) {
          for (const entry of oldestEntries) {
            await tx.delete(instagramImageHistory).where(eq(instagramImageHistory.id, entry.id))
          }
        }
      }

      await tx.insert(instagramImageHistory).values({
        userId,
        prompt: result.prompt,
        enhancedPrompt: result.enhancedPrompt,
        format,
        contentType,
        visualStyle,
        width: result.width,
        height: result.height,
        mimeType: result.mimeType,
        sizeBytes,
        imageUrl: uploadResult.url,
      })
    })
  } catch (err) {
    console.error("Failed to save instagram generation history:", err)
  }
}

function buildEnhancedPrompt(input: {
  prompt: string
  format: NonNullable<GenerateImageBody["format"]>
  contentType: string
  visualStyle: string
  referenceAssets: UploadedAsset[]
  referenceSummaries: string[]
}) {
  const ratio = input.format === "story" ? "Instagram Story 9:16 vertical" : input.format === "portrait" ? "Instagram feed portrait 4:5" : "Instagram feed square 1:1"
  const references = input.referenceAssets.length > 0
    ? ` Gunakan aset upload sebagai referensi visual, bukan ditempel mentah: ${input.referenceSummaries.length > 0 ? input.referenceSummaries.join("; ") : input.referenceAssets.map((asset) => `${asset.filename}`).join(", ")}. Adaptasi warna, objek, dan identitas visualnya secara natural ke desain.`
    : ""
  const vectorCartoonInstruction = input.visualStyle === "Vector Kartun Simple"
    ? "Mode Vector Kartun Simple: hasil harus berupa ilustrasi flat vector cartoon sederhana, clean, ramah, outline tegas, bentuk objek/karakter sederhana, warna solid brand PT Chitra Paratama, tanpa photorealistic, tanpa 3D render, tanpa tekstur kompleks, tanpa detail kecil berlebihan. Cocok untuk konten Instagram edukatif dan mudah dibaca."
    : ""

  return [
    `Buat visual Instagram PT Chitra Paratama format ${ratio}.`,
    `Kategori: ${input.contentType}.`,
    `Gaya visual: ${input.visualStyle}.`,
    vectorCartoonInstruction,
    `Tema: ${input.prompt}.`,
    "Desain sederhana, profesional, rapi, mudah dipahami, satu fokus utama, dan komposisi full-bleed yang mengisi seluruh kanvas tanpa border, margin, kartu putih, atau frame kosong.",
    "WAJIB: Jika prompt SECARA EKSPLISIT meminta atau menampilkan sosok manusia (pekerja, mekanik, tim, operator, karyawan), mereka HARUS memakai wearpack safety resmi PT Chitra Paratama dengan spesifikasi PRESISI: kemeja kerja lengan panjang TWO-TONE (BUKAN rompi/vest terpisah), SELURUH LENGAN (atas dan bawah) berwarna BIRU NAVY GELAP (#002D56), area DADA dan BAHU berwarna HIJAU NEON TERANG/Lime Green (#8DC63F), ada STRIP REFLEKTIF SILVER di PUNDAK KANAN dan KIRI (horizontal di bahu), ada SATU GARIS REFLEKTIF HORIZONTAL di TENGAH PERUT tepat di batas antara area hijau atas dan biru navy bawah, kerah kancing penuh, dua saku dada di area hijau, logo kecil Chitra Paratama di saku dada kiri (logo: https://www.chitraparatama.co.id/wp-content/uploads/2025/11/cp_logo-removebg-preview-e1767678002905.png) sebagai patch bordir/jahitan kecil natural di dada kiri, bukan logo besar. Jika prompt TIDAK meminta orang, jangan paksa ada orang dalam gambar.",
    "PENTING: Hindari menempatkan teks, headline, atau elemen penting di pojok kiri atas (area 300x300px dari sudut kiri atas) karena area tersebut akan tertutup logo perusahaan. Hindari juga menempatkan teks atau elemen penting di bagian BAWAH gambar (area 150px dari tepi bawah) karena area tersebut akan tertutup footer overlay. Posisikan teks utama di tengah atau sepertiga atas gambar dengan ruang aman yang cukup.",
    "Jangan buat logo Chitra Paratama, logo perusahaan, logo brand apa pun, footer, watermark, ikon media sosial, atau teks kecil; semua elemen brand resmi hanya berasal dari overlay template feed.png atau Story.png setelah gambar dibuat.",
    references,
  ].join(" ").trim()
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

async function resolveImageBuffer(rawText: string) {
  const candidates = parseImageCandidates(rawText)
  const first = candidates[0]
  if (!first) {
    throw new Error("Provider tidak mengembalikan URL atau base64 gambar")
  }

  if (first.startsWith("data:image/")) {
    return Buffer.from(first.split(",")[1] || "", "base64")
  }

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(first) && first.length > 500) {
    return Buffer.from(first.replace(/\s/g, ""), "base64")
  }

  const imageResponse = await fetch(first)
  if (!imageResponse.ok) {
    throw new Error(`Gagal mengambil gambar dari provider: HTTP ${imageResponse.status}`)
  }
  return Buffer.from(await imageResponse.arrayBuffer())
}

function parseImageCandidates(rawText: string) {
  const candidates: string[] = []
  const payloads = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.startsWith("data:") ? line.slice(5).trim() : line)
    .filter((line) => line && line !== "[DONE]")

  if (payloads.length === 0) payloads.push(rawText)

  for (const payload of payloads) {
    try {
      collectCandidates(JSON.parse(payload), candidates)
    } catch {
      if (payload.startsWith("http") || payload.startsWith("data:image/")) candidates.push(payload)
    }
  }

  return candidates
}

function collectCandidates(value: unknown, candidates: string[]) {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((item) => collectCandidates(item, candidates))
    return
  }

  const record = value as Record<string, unknown>
  for (const key of ["url", "b64_json", "base64", "image", "data_url"]) {
    const candidate = record[key]
    if (typeof candidate === "string" && candidate.length > 20) candidates.push(candidate)
  }

  for (const nestedKey of ["data", "images", "output", "result"]) {
    collectCandidates(record[nestedKey], candidates)
  }
}
