import { NextResponse } from "next/server"
import sharp from "sharp"

import { composeInstagramImage, getInstagramComposeSize, getInstagramTemplateName, type InstagramComposeFormat, type InstagramOverlayVariant } from "@/lib/instagram-compose-engine"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 12 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"])
const OVERLAY_FORMATS = new Set<InstagramComposeFormat>(["feed", "story"])
const OVERLAY_VARIANTS = new Set<InstagramOverlayVariant>(["standard", "white"])

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const formatValue = String(formData.get("format") || "feed") as InstagramComposeFormat
    const overlayVariant = String(formData.get("overlayVariant") || "standard") as InstagramOverlayVariant

    if (!OVERLAY_FORMATS.has(formatValue)) {
      return NextResponse.json({ success: false, error: "Pilih format Feed atau Story" }, { status: 400 })
    }

    if (!OVERLAY_VARIANTS.has(overlayVariant)) {
      return NextResponse.json({ success: false, error: "Pilih overlay Standar atau Putih" }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Tidak ada gambar yang diunggah" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: "Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP" }, { status: 415 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ success: false, error: "File gambar kosong atau rusak" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "Ukuran gambar melebihi batas 12 MB" }, { status: 413 })
    }

    const source = Buffer.from(await file.arrayBuffer())
    const metadata = await sharp(source, { failOn: "warning" }).metadata()
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      return NextResponse.json({ success: false, error: "Konten file bukan gambar JPG, PNG, atau WebP yang valid" }, { status: 415 })
    }

    if (!metadata.width || !metadata.height || metadata.width < 64 || metadata.height < 64) {
      return NextResponse.json({ success: false, error: "Resolusi gambar terlalu kecil. Minimal 64 × 64 px" }, { status: 400 })
    }

    const output = await composeInstagramImage({ source, format: formatValue, overlayVariant })
    const size = getInstagramComposeSize(formatValue)

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${output.toString("base64")}`,
      mimeType: "image/png",
      width: size.width,
      height: size.height,
      format: formatValue,
      overlayVariant,
      template: getInstagramTemplateName(formatValue, overlayVariant),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat gambar overlay"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
