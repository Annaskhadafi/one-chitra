"use client"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { 
    FileText, 
    Upload, 
    Info, 
    CheckCircle2, 
    ArrowRight, 
    Zap, 
    Database,
    AlertCircle,
    Loader2
} from "lucide-react"
import { toast } from "sonner"

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function hasMeaningfulBasicResult(result: {
    customer_name: string
    po_number: string
    date?: string
    items: Array<{ product: string; qty: number; price: number }>
}) {
    const blockedValues = new Set(["", "unknown customer", "unknown po", "unknown product", "-", "n/a"])

    const hasCustomer = !blockedValues.has(result.customer_name.trim().toLowerCase())
    const hasPoNumber = !blockedValues.has(result.po_number.trim().toLowerCase())
    const hasDate = !blockedValues.has((result.date || "").trim().toLowerCase())
    const hasItems = result.items.some((item) => {
        const name = item.product.trim().toLowerCase()
        return !blockedValues.has(name) || item.qty > 0 || item.price > 0
    })

    return hasCustomer || hasPoNumber || hasDate || hasItems
}

export default function OcrUploadPage() {
    const router = useRouter()
    const [files, setFiles] = useState<File[]>([])
    const [progress, setProgress] = useState(0)
    const [statusMessage, setStatusMessage] = useState<string>("")
    const [error, setError] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [basicResult, setBasicResult] = useState<{
        customer_name: string
        po_number: string
        date?: string
        items: Array<{ product: string; qty: number; price: number }>
    } | null>(null)
    const [uploadedMeta, setUploadedMeta] = useState<{
        fileUrl: string
        fileName: string
        fileType: string
        rawText: string
    } | null>(null)
    const [isMapping, setIsMapping] = useState(false)
    const inputRef = useRef<HTMLInputElement | null>(null)

    async function easeProgress(target: number, stepDelay = 90) {
        setProgress((current) => {
            if (current >= target) {
                return current
            }
            return current
        })

        while (true) {
            let shouldContinue = false
            setProgress((current) => {
                if (current >= target) {
                    return current
                }
                shouldContinue = true
                const remaining = target - current
                const increment = remaining > 20 ? 4 : remaining > 10 ? 3 : remaining > 4 ? 2 : 1
                return Math.min(target, current + increment)
            })

            if (!shouldContinue) {
                break
            }

            await delay(stepDelay)
        }
    }

    function applySelectedFiles(f: File[]) {
        const valid = f.filter(file => {
            const okType = ["application/pdf"].includes(file.type)
            const okSize = file.size <= 10 * 1024 * 1024
            return okType && okSize
        })
        if (valid.length !== f.length) {
            setError("Format harus PDF dan ukuran maks 10 MB per file")
            toast.error("Format tidak valid", { description: "Hanya file PDF yang didukung saat ini." })
        } else {
            setError(null)
        }
        setFiles(valid)
        if (valid.length > 0) {
            toast.info(`File ${valid[0].name} terpilih`)
        }
    }

    function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const selectedFiles = Array.from(e.target.files || [])
        applySelectedFiles(selectedFiles)
    }

    function onDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()
        const droppedFiles = Array.from(e.dataTransfer.files || [])
        applySelectedFiles(droppedFiles)
    }

    function onDragOver(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault()
    }

    async function uploadViaApi(file: File) {
        const formData = new FormData()
        formData.append("file", file)

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000)

        try {
            const response = await fetch("/api/uploads", {
                method: "POST",
                body: formData,
                signal: controller.signal,
            })
            const body = await response.json().catch(() => ({}))

            if (!response.ok || !body?.url) {
                return { success: false as const, error: body?.error || "Gagal mengunggah file" }
            }

            return { success: true as const, url: body.url as string }
        } finally {
            clearTimeout(timeout)
        }
    }

    async function startProcess() {
        if (files.length === 0) return
        
        setIsProcessing(true)
        setProgress(10)
        setStatusMessage("Mengunggah dokumen...")
        setError(null)
        setBasicResult(null)
        setUploadedMeta(null)
        
        const file = files[0]
        await easeProgress(18, 80)

        // Stage 1: Upload (0-30%)
        const res = await uploadViaApi(file)
        if (!res?.url) {
            setError(res.error || "Gagal mengunggah file")
            setIsProcessing(false)
            setProgress(0)
            toast.error("Upload Gagal", { description: res.error || "Terjadi kesalahan saat mengunggah file ke server." })
            return
        }
        
        setProgress(30)
        setStatusMessage("Mengekstrak data dari dokumen...")
        await easeProgress(42, 70)
        
        // Stage 2: OCR Extraction (30-80%)
        try {
            const ocrController = new AbortController()
            const ocrTimeout = setTimeout(() => ocrController.abort(), 90000)
            const ocrResponse = await fetch("/api/ocr-extract-basic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileUrl: res.url }),
                signal: ocrController.signal,
            }).finally(() => clearTimeout(ocrTimeout))
            
            setProgress(60)
            setStatusMessage("Menganalisis hasil ekstraksi...")
            await easeProgress(82, 60)
            
            const ocrBodyText = await ocrResponse.text()
            let ocrRes: {
                error?: string
                basic?: { customer_name: string; po_number: string; items: Array<{ product: string; qty: number; price: number }> }
                rawText?: string
            } = {}
            
            if (ocrBodyText.trim().length > 0) {
                try {
                    ocrRes = JSON.parse(ocrBodyText)
                } catch {
                    setError("Respons OCR tidak valid")
                    setIsProcessing(false)
                    return
                }
            } else {
                setError("Respons OCR kosong")
                setIsProcessing(false)
                return
            }
            
            if (!ocrResponse.ok || ocrRes.error) {
                setError(ocrRes.error || "OCR gagal diproses")
                setIsProcessing(false)
                return
            }
            
            if (!ocrRes.basic) {
                setError("Hasil ekstraksi OCR tidak ditemukan")
                setIsProcessing(false)
                return
            }

            if (!hasMeaningfulBasicResult(ocrRes.basic)) {
                setError("OCR belum berhasil membaca data PO. Coba file yang lebih jelas atau ulangi proses.")
                setIsProcessing(false)
                return
            }
            
            // Stage 3: Complete (100%)
            setProgress(100)
            setStatusMessage("Ekstraksi Berhasil!")
            setBasicResult(ocrRes.basic)
            setUploadedMeta({
                fileUrl: res.url,
                fileName: file.name,
                fileType: file.type,
                rawText: ocrRes.rawText || "",
            })
            toast.success("Dokumen Berhasil Diekstrak", { 
                description: "Data dasar PO telah teridentifikasi. Silakan lanjutkan ke Mapping MAGIC." 
            })
        } catch {
            setError("OCR timeout / server terlalu lama. Coba ulangi atau gunakan file PDF lebih kecil.")
            toast.error("Kesalahan Sistem", { description: "Gagal menghubungi layanan OCR dalam batas waktu." })
        } finally {
            setIsProcessing(false)
        }
    }

    async function continueToAiMapping() {
        if (!basicResult || !uploadedMeta) return
        
        setIsMapping(true)
        setError(null)
        try {
            const mapController = new AbortController()
            const mapTimeout = setTimeout(() => mapController.abort(), 60000)
            const response = await fetch("/api/ocr-map-ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileUrl: uploadedMeta.fileUrl,
                    fileName: uploadedMeta.fileName,
                    fileType: uploadedMeta.fileType,
                    rawText: uploadedMeta.rawText,
                    basic: basicResult,
                }),
                signal: mapController.signal,
            }).finally(() => clearTimeout(mapTimeout))
            const body = await response.json().catch(() => null)
            if (!response.ok) {
                setError(body?.error || "Gagal proses mapping MAGIC")
                toast.error("Mapping Gagal", { description: body?.error || "MAGIC gagal memetakan produk." })
                return
            }
            if (!body?.sessionId) {
                setError("Session hasil mapping tidak ditemukan")
                return
            }
            toast.success("Mapping MAGIC Selesai", { description: "Mengalihkan ke halaman validasi..." })
            router.push(`/dashboard/sales-orders/ocr-validate?session=${body.sessionId}`)
        } catch {
            setError("Mapping MAGIC timeout / service lambat. Silakan coba lagi.")
        } finally {
            setIsMapping(false)
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-4 sm:space-y-8 sm:p-6 lg:space-y-10 lg:p-8">
            {/* Header Section */}
            <div className="space-y-2">
                <h1 className="flex items-start gap-3 text-2xl font-bold tracking-tight text-slate-900 sm:items-center sm:text-3xl">
                    <Zap className="mt-0.5 h-7 w-7 shrink-0 text-indigo-500 fill-indigo-500/10 sm:mt-0 sm:h-8 sm:w-8" />
                    Unggah PO untuk OCR
                </h1>
                <p className="text-sm text-slate-500 sm:text-base lg:text-lg">
                    Otomatisasi input Sales Order dengan mengekstrak data langsung dari file PO Anda.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-8">
                {/* Left Column: Upload & Progress */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition-all group overflow-hidden relative">
                        <CardContent 
                             className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center p-6 text-center sm:min-h-[280px] sm:p-10 lg:min-h-[300px] lg:p-12"
                             onClick={() => inputRef.current?.click()}
                             onDrop={onDrop}
                             onDragOver={onDragOver}
                        >
                            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 transition-transform duration-300 group-hover:scale-110 sm:mb-6 sm:h-16 sm:w-16">
                                <Upload className="h-7 w-7 text-indigo-600 sm:h-8 sm:w-8" />
                            </div>
                            <h3 className="mb-2 text-lg font-bold text-slate-800 sm:text-xl">Tarik & Lepas File PO</h3>
                            <p className="mx-auto mb-5 max-w-xs text-sm text-slate-500 sm:mb-6 sm:text-base">
                                atau klik untuk memilih file dari komputer Anda. <br/>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">(Hanya format PDF, maks 10MB)</span>
                            </p>
                            
                            {files.length > 0 ? (
                                <div className="flex max-w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm sm:rounded-full sm:py-2">
                                    <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                                    <span className="max-w-[180px] truncate text-sm font-bold text-slate-700 sm:max-w-[260px]">{files[0].name}</span>
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                                </div>
                            ) : (
                                <Button variant="secondary" className="w-full rounded-xl px-6 shadow-sm sm:w-auto sm:rounded-full sm:px-8">
                                    Pilih File
                                </Button>
                            )}

                            <input
                                ref={inputRef}
                                type="file"
                                accept="application/pdf"
                                multiple={false}
                                onChange={onSelect}
                                className="hidden"
                            />
                        </CardContent>
                    </Card>

                    {/* Progress Bar & Actions */}
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <Button 
                                size="lg" 
                                onClick={startProcess} 
                                disabled={files.length === 0 || isProcessing}
                                className="w-full rounded-xl bg-indigo-600 px-6 shadow-lg shadow-indigo-200 hover:bg-indigo-700 sm:w-auto sm:px-10"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        Mulai Proses OCR
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </>
                                )}
                            </Button>
                            
                            {(isProcessing || progress > 0) && (
                                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left sm:text-right">
                                    <span className="text-lg font-bold text-slate-900">{progress}%</span>
                                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{statusMessage}</p>
                                </div>
                            )}
                        </div>

                        {(isProcessing || progress > 0) && (
                            <div className="space-y-2">
                                <Progress value={progress} className="h-3 bg-slate-100 rounded-full overflow-hidden" />
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    <span>Upload</span>
                                    <span>Extraction</span>
                                    <span>Ready</span>
                                </div>
                            </div>
                        )}
                        
                        {error && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Instructions */}
                <div className="space-y-6">
                    <Card className="bg-indigo-900 text-white border-none shadow-xl shadow-indigo-200 overflow-hidden relative">
                        <div className="absolute right-0 top-0 p-4 opacity-10">
                            <Info className="h-24 w-24" />
                        </div>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-indigo-200 uppercase tracking-[0.2em] text-xs font-bold">
                                <Info className="h-4 w-4" />
                                Instruksi Fitur
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pb-8">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">1</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Unggah Dokumen PO</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">Pastikan file dalam format PDF yang jelas dan terbaca untuk hasil terbaik.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">2</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Ekstraksi Data Dasar</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">Sistem akan mengidentifikasi Nama Customer, No PO, dan daftar barang.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">3</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Mapping Produk MAGIC</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">MAGIC akan mencocokkan nama barang dari customer dengan produk di database kami.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">4</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Validasi & Simpan</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">Anda dapat mengoreksi hasil sebelum menyimpannya sebagai Sales Order baru.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-100 bg-slate-50/30">
                        <CardContent className="p-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Kegunaan
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                Mempercepat pendaftaran pesanan dari pelanggan besar (Hasnur, Cipta Krida, dll) yang memiliki PO dalam format PDF. Menghindari kesalahan pengetikan manual.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Results Section */}
            {basicResult && (
                <Card className="border-green-100 bg-green-50/20 overflow-hidden shadow-sm animate-in zoom-in-95 duration-500">
                    <CardHeader className="bg-white border-b border-green-50">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg text-green-900 flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    Hasil Ekstraksi Dasar (Tahap 1)
                                </CardTitle>
                                <CardDescription>Data mentah yang berhasil dikenali dari dokumen.</CardDescription>
                            </div>
                            <Button 
                                onClick={continueToAiMapping} 
                                disabled={isMapping}
                                className="w-full bg-indigo-600 shadow-md hover:bg-indogo-700 sm:w-auto"
                            >
                                {isMapping ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Mapping MAGIC...
                                    </>
                                ) : (
                                    <>
                                        Lanjutkan ke Mapping MAGIC
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                        <pre className="max-h-[320px] overflow-auto rounded-xl border border-green-100 bg-white/50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 sm:max-h-[400px] sm:p-4 sm:text-xs">
                            {JSON.stringify(basicResult, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
