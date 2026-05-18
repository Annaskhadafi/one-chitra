import { NextRequest } from "next/server"
import path from "path"
import { promises as fs } from "fs"
import sharp from "sharp"
import { readManagedUpload } from "@/lib/upload-storage"

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
const ENABLE_PROVIDER_IMAGE_REFERENCES = process.env.INSTAGRAM_ENABLE_PROVIDER_IMAGE_REFERENCES === "true"

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
    const referenceAssets = normalizeReferenceAssets(body.referenceAssets)

    if (body.mode === "variations") {
      const variations = await Promise.all([
        generateOneImage({ apiKey, prompt, format, contentType, referenceAssets, variationInstruction: "Variasi 1: gaya visual corporate premium, clean, elegan, komposisi seimbang, warna brand tegas, wajib ada headline utama besar yang relevan." }),
        generateOneImage({ apiKey, prompt, format, contentType, referenceAssets, variationInstruction: "Variasi 2: gaya visual modern editorial, dinamis, depth lebih kuat, angle berbeda, wajib ada headline utama besar yang relevan agar konten tidak kosong." }),
      ])
      return Response.json({ variations })
    }

    const result = await generateOneImage({ apiKey, prompt, format, contentType, referenceAssets })
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
  referenceAssets: UploadedAsset[]
  variationInstruction?: string
}): Promise<GeneratedImageResult> {
  const referenceImages = ENABLE_PROVIDER_IMAGE_REFERENCES ? await resolveReferenceImages(input.referenceAssets) : []
  const referenceSummaries = ENABLE_PROVIDER_IMAGE_REFERENCES ? [] : await resolveReferenceSummaries(input.referenceAssets)
  const enhancedPrompt = buildEnhancedPrompt({
    prompt: input.variationInstruction ? `${input.prompt}. ${input.variationInstruction}` : input.prompt,
    format: input.format,
    contentType: input.contentType,
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
      ...(referenceImages.length > 0 ? {
        image: referenceImages[0],
        images: referenceImages,
        reference_images: referenceImages,
        input_images: referenceImages,
      } : {}),
    }),
  })

  const rawText = await response.text()
  if (!response.ok) {
    throw new Error(`Provider gagal memproses gambar: ${extractProviderError(rawText)}`)
  }

  const sourceImage = await resolveImageBuffer(rawText)
  const branded = await addBranding(sourceImage, input.format)
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

function buildEnhancedPrompt(input: {
  prompt: string
  format: NonNullable<GenerateImageBody["format"]>
  contentType: string
  referenceAssets: UploadedAsset[]
  referenceSummaries: string[]
}) {
  const ratio = input.format === "story" ? "Instagram Story 9:16 vertical" : input.format === "portrait" ? "Instagram feed portrait 4:5" : "Instagram feed square 1:1"
  const references = input.referenceAssets.length > 0
    ? ` Gunakan aset upload sebagai referensi visual, bukan ditempel mentah: ${input.referenceSummaries.length > 0 ? input.referenceSummaries.join("; ") : input.referenceAssets.map((asset) => asset.filename).join(", ")}. Adaptasi warna, objek, dan identitas visualnya secara natural ke desain.`
    : ""

  return [
    `Buat visual Instagram PT Chitra Paratama format ${ratio}.`,
    `Kategori: ${input.contentType}.`,
    `Tema: ${input.prompt}.`,
    "Desain sederhana, profesional, rapi, mudah dipahami, satu fokus utama, dan komposisi full-bleed yang mengisi seluruh kanvas tanpa border, margin, kartu putih, atau frame kosong.",
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

async function addBranding(source: Buffer, format: GenerateImageBody["format"]) {
  const target = getTargetSize(format || "feed")
  const templatePath = await resolveTemplatePath(format === "story" ? ["story.png", "Story.png"] : ["feed.png"])
  await fs.access(templatePath)
  const base = await normalizeGeneratedCanvas(source, target.width, target.height)
  const template = await makeTemplateOverlay(templatePath, target.width, target.height)

  return sharp(base)
    .composite([{ input: template, top: 0, left: 0 }])
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer()
}

async function normalizeGeneratedCanvas(source: Buffer, width: number, height: number) {
  const trimmed = await sharp(source)
    .rotate()
    .trim({ background: "#ffffff", threshold: 18 })
    .resize(width, height, { fit: "cover", position: "center" })
    .png()
    .toBuffer()

  return sharp(trimmed)
    .resize(width, height, { fit: "cover", position: "center" })
    .png()
    .toBuffer()
}

async function makeTemplateOverlay(templatePath: string, width: number, height: number) {
  const metadata = await sharp(templatePath).metadata()
  if (metadata.hasAlpha) {
    return sharp(templatePath)
      .resize(width, height, { fit: "fill" })
      .png()
      .toBuffer()
  }

  const template = await sharp(templatePath)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha(1)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const data = template.data
  const footerStart = Math.floor(height * 0.9)
  for (let index = 0; index < data.length; index += 4) {
    const pixel = index / 4
    const x = pixel % width
    const y = Math.floor(pixel / width)
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const isNearWhite = red > 242 && green > 242 && blue > 242
    const keepFooterText = y >= footerStart && isNearWhite && hasColoredNeighbor(data, width, height, x, y)
    if (isNearWhite && !keepFooterText) {
      data[index + 3] = 0
    }
  }

  return sharp(data, { raw: template.info })
    .png()
    .toBuffer()
}

function hasColoredNeighbor(data: Buffer, width: number, height: number, x: number, y: number) {
  const radius = 3
  for (let offsetY = -radius; offsetY <= radius; offsetY++) {
    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
      const nx = x + offsetX
      const ny = y + offsetY
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const index = (ny * width + nx) * 4
      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]
      const isNearWhite = red > 242 && green > 242 && blue > 242
      const isDark = red < 80 && green < 80 && blue < 80
      if (!isNearWhite && !isDark) return true
    }
  }
  return false
}

function getTargetSize(format: NonNullable<GenerateImageBody["format"]>) {
  if (format === "story") return { width: 1080, height: 1920 }
  return { width: 1080, height: 1350 }
}

async function resolveTemplatePath(candidates: string[]) {
  for (const candidate of candidates) {
    const templatePath = path.join(process.cwd(), "public", candidate)
    try {
      await fs.access(templatePath)
      return templatePath
    } catch {
      continue
    }
  }
  throw new Error(`Template branding tidak ditemukan: ${candidates.join(" atau ")}`)
}

