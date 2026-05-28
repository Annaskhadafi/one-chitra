import { promises as fs } from "fs"
import path from "path"
import sharp from "sharp"

export const runtime = "nodejs"
export const maxDuration = 180

const API_URL = process.env.INSTAGRAM_IMAGE_API_URL || "https://9router.chitraparatama.com/v1/images/generations"
const API_MODEL = process.env.INSTAGRAM_IMAGE_MODEL || "cx/gpt-5.4-image"
const MAX_DATA_URL_LENGTH = 16 * 1024 * 1024
const PROVIDER_TIMEOUT_MS = 85_000
const MAX_PROVIDER_ATTEMPTS = 2

type LogoFixerBody = {
  sourceImage?: string
  customLogo?: string
  sourceName?: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null) as LogoFixerBody | null
    if (!body?.sourceImage) {
      return Response.json({ error: "Gambar sumber wajib diisi" }, { status: 400 })
    }

    const apiKey = process.env.INSTAGRAM_IMAGE_API_KEY
    if (!apiKey) {
      return Response.json({ error: "Konfigurasi API belum lengkap: INSTAGRAM_IMAGE_API_KEY belum diset" }, { status: 500 })
    }

    const sourceImage = await normalizeDataUrlImage(body.sourceImage, "Gambar sumber")
    const logoImage = body.customLogo
      ? await normalizeDataUrlImage(body.customLogo, "Logo custom")
      : await loadDefaultLogoDataUrl()

    const prompt = buildLogoFixerPrompt(Boolean(body.customLogo))
    const fixed = await generateLogoFix({ apiKey, prompt, sourceImage, logoImage })
    const metadata = await sharp(fixed).metadata()
    return Response.json({
      image: `data:image/png;base64,${fixed.toString("base64")}`,
      mimeType: "image/png",
      width: metadata.width || 0,
      height: metadata.height || 0,
      sourceName: body.sourceName || "instagram-generated-image.png",
      logoSource: body.customLogo ? "custom" : "cp_logo.png",
      prompt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbaiki logo"
    return Response.json({ error: message }, { status: 500 })
  }
}

async function generateLogoFix(input: { apiKey: string; prompt: string; sourceImage: string; logoImage: string }) {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_PROVIDER_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)

    try {
      const providerResponse = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          model: API_MODEL,
          prompt: input.prompt,
          image: input.sourceImage,
          images: [input.sourceImage, input.logoImage],
          reference_images: [input.sourceImage, input.logoImage],
          input_images: [input.sourceImage, input.logoImage],
          n: 1,
          size: "auto",
          output_format: "png",
        }),
        signal: controller.signal,
      })

      const rawText = await providerResponse.text()
      if (!providerResponse.ok) {
        throw new Error(`Provider gagal memperbaiki logo: ${extractProviderError(rawText)}`)
      }

      return await resolveImageBuffer(rawText)
    } catch (error) {
      lastError = error
      if (attempt === MAX_PROVIDER_ATTEMPTS) break
    } finally {
      clearTimeout(timeout)
    }
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error("Provider terlalu lama memperbaiki logo. Coba lagi dengan gambar sumber yang lebih kecil atau ulangi proses.")
  }

  throw lastError instanceof Error ? lastError : new Error("Provider gagal memperbaiki logo")
}

function buildLogoFixerPrompt(hasCustomLogo: boolean) {
  const logoSource = hasCustomLogo ? "the custom logo in reference image #2" : "the official PT Chitra Paratama logo from cp_logo.png in reference image #2"
  return [
    "Logo Fixer AI task: repair only incorrect generated logos inside the scene, not the official branding overlay.",
    `Use ${logoSource} as the only valid replacement logo for generated logos inside the scene.`,
    "ONLY edit generated logos inside the scene: the left chest pocket patch on wearpack uniforms and safety helmet logo areas.",
    "Replace every malformed, fake, blurred, unreadable, or wrong logo patch on the left chest pocket of safety wearpack uniforms.",
    "Replace every malformed, fake, blurred, unreadable, or wrong logo on safety helmets; if the helmet logo area is empty, add the logo naturally on the front/side helmet surface.",
    "If a left chest patch area is empty but clearly belongs to the uniform, add a small realistic embroidered rectangular logo patch there.",
    "Do not modify the official overlay logo in the top-left corner, do not modify the footer, and do not modify any official frame or template branding.",
    "Protect the top-left logo overlay and bottom footer exactly as-is, pixel-for-pixel when possible.",
    "Preserve the original image composition, person identity, pose, background, lighting, colors, text, framing, footer, and all non-logo elements exactly as much as possible.",
    "Do not add new people, do not redesign the poster, do not change headline text, and do not alter official overlay/footer branding outside the generated logos inside the scene.",
    "Make replacements look natural: correct perspective, scale, fabric/helmet curvature, shadows, and clean readable logo details.",
    "Keywords for target detection: left chest pocket, left chest patch, wearpack logo patch, safety helmet logo, helmet, replace.",
  ].join(" ")
}

async function normalizeDataUrlImage(value: string, label: string) {
  if (!value.startsWith("data:image/")) throw new Error(`${label} harus berupa data URL gambar`)
  if (value.length > MAX_DATA_URL_LENGTH) throw new Error(`${label} terlalu besar`)
  const base64 = value.split(",")[1]
  if (!base64) throw new Error(`${label} tidak valid`)
  const buffer = Buffer.from(base64, "base64")
  const metadata = await sharp(buffer, { failOn: "warning" }).metadata()
  if (!metadata.width || !metadata.height) throw new Error(`${label} bukan gambar valid`)
  const normalized = await sharp(buffer)
    .rotate()
    .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer()
  return `data:image/png;base64,${normalized.toString("base64")}`
}

async function loadDefaultLogoDataUrl() {
  const logoPath = path.join(process.cwd(), "public", "cp_logo.png")
  const logo = await fs.readFile(logoPath)
  const normalized = await sharp(logo)
    .rotate()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer()
  return `data:image/png;base64,${normalized.toString("base64")}`
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
  let lastError: unknown

  for (const candidate of candidates) {
    try {
      const buffer = await resolveOneImageCandidate(candidate)
      await sharp(buffer, { failOn: "warning" }).metadata()
      return buffer
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error) throw lastError
  throw new Error("Provider tidak mengembalikan URL atau base64 gambar")
}

async function resolveOneImageCandidate(candidate: string) {
  if (candidate.startsWith("data:image/")) return Buffer.from(candidate.split(",")[1] || "", "base64")
  if (/^[A-Za-z0-9+/=\r\n]+$/.test(candidate) && candidate.length > 500) return Buffer.from(candidate.replace(/\s/g, ""), "base64")

  const imageResponse = await fetch(candidate)
  if (!imageResponse.ok) throw new Error(`Gagal mengambil gambar dari provider: HTTP ${imageResponse.status}`)
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
    collectStringCandidates(payload, candidates)
    try {
      collectCandidates(JSON.parse(payload), candidates)
    } catch {
      if (payload.startsWith("http") || payload.startsWith("data:image/")) candidates.push(payload)
    }
  }
  return Array.from(new Set(candidates))
}

function collectCandidates(value: unknown, candidates: string[]) {
  if (typeof value === "string") {
    collectStringCandidates(value, candidates)
    return
  }

  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((item) => collectCandidates(item, candidates))
    return
  }

  const record = value as Record<string, unknown>
  for (const key of ["url", "b64_json", "base64", "image", "data_url", "image_url", "imageUrl", "image_base64", "output_image"]) {
    const candidate = record[key]
    if (typeof candidate === "string" && candidate.length > 20) collectStringCandidates(candidate, candidates)
  }

  Object.values(record).forEach((nested) => collectCandidates(nested, candidates))
}

function collectStringCandidates(value: string, candidates: string[]) {
  const trimmed = value.trim()
  if (trimmed.startsWith("http") || trimmed.startsWith("data:image/") || (/^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length > 500)) {
    candidates.push(trimmed)
  }

  for (const match of trimmed.matchAll(/https?:\/\/[^\s"')]+/g)) {
    candidates.push(match[0])
  }

  for (const match of trimmed.matchAll(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g)) {
    candidates.push(match[0])
  }
}

