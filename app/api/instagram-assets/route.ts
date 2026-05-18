import { NextResponse } from "next/server"
import sharp from "sharp"

import { createManagedUploadFilename, saveManagedUpload } from "@/lib/upload-storage"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"])

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Tidak ada file gambar yang diunggah" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: "Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP" }, { status: 415 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ success: false, error: "File gambar kosong atau rusak" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "Ukuran gambar melebihi batas 8 MB" }, { status: 413 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const metadata = await sharp(bytes, { failOn: "warning" }).metadata()
    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      return NextResponse.json({ success: false, error: "Konten file bukan gambar JPG, PNG, atau WebP yang valid" }, { status: 415 })
    }

    if (!metadata.width || !metadata.height || metadata.width < 64 || metadata.height < 64) {
      return NextResponse.json({ success: false, error: "Resolusi gambar terlalu kecil. Minimal 64 × 64 px" }, { status: 400 })
    }

    const filename = createManagedUploadFilename(file.name)
    const optimized = await sharp(bytes)
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .png({ quality: 100, compressionLevel: 9 })
      .toBuffer()

    const savedFile = await saveManagedUpload({
      filename: filename.replace(/\.[^.]+$/, ".png"),
      buffer: optimized,
      contentType: "image/png",
    })

    const optimizedMetadata = await sharp(optimized).metadata()
    return NextResponse.json({
      success: true,
      url: savedFile.url,
      filename: savedFile.filename,
      contentType: "image/png",
      width: optimizedMetadata.width || metadata.width,
      height: optimizedMetadata.height || metadata.height,
      size: optimized.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload gambar gagal"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
