"use client"

import * as React from "react"
import Image from "next/image"
import { Download, ImagePlus, Loader2, Sparkles, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type ImageFormat = "feed" | "portrait" | "story"

type GeneratedImageResult = {
  image: string
  mimeType: string
  width: number
  height: number
  prompt: string
  enhancedPrompt: string
}

type UploadedAsset = {
  url: string
  filename: string
  contentType: string
  width: number
  height: number
  size: number
}

type Holiday = {
  date: string
  name: string
  is_national_holiday: boolean
}

const contentTypes = [
  "Ucapan ulang tahun customer",
  "Edukasi",
  "Pencapaian perusahaan",
  "Event perusahaan",
  "Promosi produk",
  "Hari Nasional",
]

function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(`${date}T00:00:00+08:00`))
}

const promptTemplates: Record<string, string> = {
  "Ucapan ulang tahun customer": "Buat visual ucapan ulang tahun yang hangat dan profesional untuk customer PT Chitra Paratama, nuansa apresiasi bisnis, elegan, tidak berlebihan.",
  Edukasi: "Buat konten edukasi Instagram tentang solusi, layanan, atau insight industri PT Chitra Paratama dengan visual profesional dan mudah dipahami.",
  "Pencapaian perusahaan": "Buat visual pencapaian perusahaan yang menunjukkan pertumbuhan, kolaborasi tim, kepercayaan customer, dan kredibilitas PT Chitra Paratama.",
  "Event perusahaan": "Buat visual dokumentasi atau pengumuman event perusahaan yang modern, dinamis, dan mencerminkan profesionalisme PT Chitra Paratama.",
  "Promosi produk": "Buat visual promosi produk yang premium, jelas, dan meyakinkan untuk audiens B2B PT Chitra Paratama.",
  "Hari Nasional": "Buat visual Hari Nasional resmi yang relevan untuk PT Chitra Paratama, bernuansa nasional, profesional, dan cocok untuk publikasi Instagram perusahaan.",
}

export function InstagramImageGeneratorClient() {
  const [prompt, setPrompt] = React.useState(promptTemplates.Edukasi)
  const [contentType, setContentType] = React.useState("Edukasi")
  const [format, setFormat] = React.useState<ImageFormat>("portrait")
  const [uploadedAssets, setUploadedAssets] = React.useState<UploadedAsset[]>([])
  const [nearestHoliday, setNearestHoliday] = React.useState<Holiday | null>(null)
  const [isLoadingHoliday, setIsLoadingHoliday] = React.useState(false)
  const [result, setResult] = React.useState<GeneratedImageResult | null>(null)
  const [variationResults, setVariationResults] = React.useState<GeneratedImageResult[]>([])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isEnhancing, setIsEnhancing] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (contentType !== "Hari Nasional") return
    let mounted = true
    queueMicrotask(() => {
      if (mounted) setIsLoadingHoliday(true)
    })
    fetch("/api/national-holidays")
      .then((response) => response.json())
      .then((data: { nearestHoliday?: Holiday; error?: string }) => {
        if (!mounted) return
        if (!data.nearestHoliday) throw new Error(data.error || "Data Hari Nasional tidak tersedia")
        setNearestHoliday(data.nearestHoliday)
        setPrompt(`Buat konten Instagram resmi PT Chitra Paratama untuk ${data.nearestHoliday.name} tanggal ${formatDate(data.nearestHoliday.date)}. Visual harus relevan dengan momentum nasional tersebut, profesional, berkelas, menghormati konteks hari nasional, dan tetap sesuai identitas perusahaan.`)
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Gagal mengambil Hari Nasional terdekat"
        setError(message)
        toast.error(message)
      })
      .finally(() => {
        if (mounted) setIsLoadingHoliday(false)
      })
    return () => {
      mounted = false
    }
  }, [contentType])

  const generateImage = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      setError("Prompt wajib diisi sebelum generate gambar")
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)
    setVariationResults([])

    try {
      const response = await fetch("/api/instagram-image-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          format,
          contentType,
          referenceAssets: uploadedAssets,
        }),
      })
      const data = await response.json().catch(() => null) as GeneratedImageResult & { error?: string } | null
      if (!response.ok || !data) {
        throw new Error(data?.error || "Gagal generate gambar")
      }
      setResult(data)
      toast.success("Gambar Instagram berhasil dibuat")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal generate gambar"
      setError(message)
      toast.error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const generateVariations = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      setError("Prompt wajib diisi sebelum membuat variasi")
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)
    setVariationResults([])

    try {
      const response = await fetch("/api/instagram-image-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          format,
          contentType,
          referenceAssets: uploadedAssets,
          mode: "variations",
        }),
      })
      const data = await response.json().catch(() => null) as { variations?: GeneratedImageResult[]; error?: string } | null
      if (!response.ok || data?.variations?.length !== 2) {
        throw new Error(data?.error || "Gagal membuat tepat 2 variasi gambar")
      }
      setVariationResults(data.variations)
      toast.success("2 variasi gambar berhasil dibuat")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal membuat variasi gambar"
      setError(message)
      toast.error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const enhancePrompt = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt) {
      setError("Prompt wajib diisi sebelum enhancement")
      return
    }

    setIsEnhancing(true)
    setError(null)

    try {
      const response = await fetch("/api/instagram-prompt-enhancer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          format,
          contentType,
          referenceAssets: uploadedAssets,
        }),
      })
      const data = await response.json().catch(() => null) as { enhancedPrompt?: string; error?: string } | null
      if (!response.ok || !data?.enhancedPrompt) {
        throw new Error(data?.error || "Gagal meningkatkan prompt")
      }
      setPrompt(data.enhancedPrompt)
      toast.success("Prompt berhasil ditingkatkan oleh spesialis Instagram")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal meningkatkan prompt"
      setError(message)
      toast.error(message)
    } finally {
      setIsEnhancing(false)
    }
  }

  const onFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ""
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"])
    const maxSize = 8 * 1024 * 1024
    const validFiles = selectedFiles.filter((file) => {
      if (!allowedTypes.has(file.type)) {
        toast.error(`${file.name}: format tidak didukung. Gunakan JPG, PNG, atau WebP`)
        return false
      }
      if (file.size > maxSize) {
        toast.error(`${file.name}: ukuran melebihi 8 MB`)
        return false
      }
      return true
    }).slice(0, Math.max(0, 8 - uploadedAssets.length))

    if (validFiles.length === 0) return

    setIsUploading(true)
    setError(null)

    try {
      const uploaded = await Promise.all(validFiles.map(async (file) => {
        const formData = new FormData()
        formData.append("file", file)
        const response = await fetch("/api/instagram-assets", {
          method: "POST",
          body: formData,
        })
        const data = await response.json().catch(() => null) as UploadedAsset & { success?: boolean; error?: string } | null
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || `${file.name}: upload gagal`)
        }
        return {
          url: data.url,
          filename: data.filename,
          contentType: data.contentType,
          width: data.width,
          height: data.height,
          size: data.size,
        }
      }))
      setUploadedAssets((current) => [...current, ...uploaded].slice(0, 8))
      toast.success(`${uploaded.length} gambar berhasil diunggah`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload gambar gagal"
      setError(message)
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }

  const removeAsset = (url: string) => {
    setUploadedAssets((current) => current.filter((asset) => asset.url !== url))
  }

  const downloadImage = (image = result?.image, suffix: string = format) => {
    if (!image) return
    const link = document.createElement("a")
    link.href = image
    link.download = `pt-chitra-paratama-instagram-${suffix}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 px-4 py-4 lg:px-6 lg:py-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Sparkles className="size-4" />
          Instagram Content Generator
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Generate Image Instagram PT Chitra Paratama</h1>
          <p className="text-muted-foreground">Buat visual feed, portrait, atau story dengan logo dan footer perusahaan otomatis.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Konfigurasi Konten</CardTitle>
            <CardDescription>Isi prompt, pilih kebutuhan konten, dan unggah referensi visual bila ada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <Label>Kategori konten</Label>
              <Select
                value={contentType}
                onValueChange={(value) => {
                  setContentType(value)
                  setPrompt(promptTemplates[value] || prompt)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {contentTypes.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contentType === "Hari Nasional" && (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {isLoadingHoliday ? "Mengambil Hari Nasional terdekat..." : nearestHoliday ? `Hari Nasional terdekat: ${nearestHoliday.name} (${formatDate(nearestHoliday.date)})` : "Hari Nasional belum tersedia"}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Ukuran desain</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={format === "portrait" ? "default" : "outline"} onClick={() => setFormat("portrait")} className="h-auto flex-col gap-1 py-3">
                  <span>Feed 4:5</span>
                  <span className="text-xs font-normal opacity-80">1080 × 1350</span>
                </Button>
                <Button type="button" variant={format === "story" ? "default" : "outline"} onClick={() => setFormat("story")} className="h-auto flex-col gap-1 py-3">
                  <span>Story 9:16</span>
                  <span className="text-xs font-normal opacity-80">1080 × 1920</span>
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Prompt</Label>
                <Button type="button" variant="outline" size="sm" onClick={enhancePrompt} disabled={isEnhancing || isGenerating || isUploading}>
                  {isEnhancing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {isEnhancing ? "Enhancing..." : "Enhance Prompt"}
                </Button>
              </div>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-40"
                placeholder="Tulis tema konten Instagram yang ingin dibuat"
              />
              <p className="text-xs text-muted-foreground">Prompt bisa ditingkatkan memakai spesialis Instagram dan ahli grafik desain, lalu dipakai untuk generate gambar final.</p>
            </div>

            <div className="grid gap-2">
              <Label>Upload gambar referensi atau aset</Label>
              <div className="rounded-xl border border-dashed p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <UploadCloud className="size-5" />
                  </div>
                  <div className="flex-1">
                    <Input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFilesChange} disabled={isUploading || uploadedAssets.length >= 8} />
                    <p className="mt-2 text-xs text-muted-foreground">Maksimal 8 gambar, JPG/PNG/WebP, ukuran maksimal 8 MB per file. File dipakai sebagai image reference untuk proses generate, bukan ditempel manual di atas hasil.</p>
                  </div>
                </div>
                {isUploading && <p className="mt-3 text-xs text-muted-foreground">Sedang mengunggah dan memvalidasi gambar...</p>}
                {uploadedAssets.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {uploadedAssets.map((asset) => (
                      <div key={asset.url} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                        <Image src={asset.url} alt={asset.filename} fill className="object-cover" unoptimized />
                        <button type="button" onClick={() => removeAsset(asset.url)} className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">Hapus</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={generateImage} disabled={isGenerating || isEnhancing || isUploading} className="w-full">
                {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                {isGenerating ? "Sedang generate gambar..." : "Generate Gambar"}
              </Button>
              <Button onClick={generateVariations} disabled={isGenerating || isEnhancing || isUploading} variant="secondary" className="w-full">
                {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Buat 2 Variasi
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview Final</CardTitle>
            <CardDescription>Gambar final sudah berisi logo, footer informasi perusahaan, dan resolusi siap unggah.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-h-[520px] items-center justify-center rounded-xl border bg-muted/40 p-4">
              {variationResults.length === 2 ? (
                <div className="grid w-full gap-4 lg:grid-cols-2">
                  {variationResults.map((variation, index) => (
                    <div key={`${variation.prompt}-${index}`} className="space-y-2">
                      <div className="text-center text-sm font-medium">Variasi {index + 1}</div>
                      <Image
                        src={variation.image}
                        alt={`Variasi ${index + 1} gambar Instagram PT Chitra Paratama`}
                        width={variation.width || 1080}
                        height={variation.height || 1080}
                        className="max-h-[560px] w-auto rounded-lg object-contain shadow-xl"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              ) : result ? (
                <Image
                  src={result.image}
                  alt="Preview gambar Instagram PT Chitra Paratama"
                  width={result.width || 1080}
                  height={result.height || 1080}
                  className="max-h-[720px] w-auto rounded-lg object-contain shadow-xl"
                  unoptimized
                />
              ) : (
                <div className="flex max-w-md flex-col items-center gap-3 text-center text-muted-foreground">
                  <ImagePlus className="size-12" />
                  <div>
                    <p className="font-medium text-foreground">Belum ada gambar</p>
                    <p className="text-sm">Isi prompt dan tekan generate untuk melihat preview hasil akhir.</p>
                  </div>
                </div>
              )}
            </div>

            {variationResults.length === 2 && (
              <div className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="grid gap-1 text-sm">
                  <p><span className="font-medium">Output:</span> 2 variasi gambar</p>
                  <p><span className="font-medium">Resolusi:</span> {variationResults[0]?.width} × {variationResults[0]?.height}px</p>
                  <p><span className="font-medium">Format:</span> PNG</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variationResults.map((variation, index) => (
                    <Button key={`download-${index}`} onClick={() => downloadImage(variation.image, `${format}-variasi-${index + 1}`)} variant="secondary" className="w-full sm:w-fit">
                      <Download className="size-4" />
                      Download Variasi {index + 1}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="grid gap-1 text-sm">
                  <p><span className="font-medium">Resolusi:</span> {result.width} × {result.height}px</p>
                  <p><span className="font-medium">Format:</span> PNG</p>
                </div>
                <Button onClick={() => downloadImage()} variant="secondary" className="w-full sm:w-fit">
                  <Download className="size-4" />
                  Download PNG
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
