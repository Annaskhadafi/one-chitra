"use client"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { uploadFile } from "@/app/actions/upload"
import { 
    FileText, 
    Upload, 
    Info, 
    CheckCircle2, 
    ArrowRight, 
    Zap, 
    Database,
    AlertCircle,
    Loader2,
    Cpu,
    Sparkles,
    FileCheck,
    Image as ImageIcon
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

    return hasItems && (hasCustomer || hasPoNumber || hasDate)
}

export type ProcessingStep = "idle" | "uploading" | "inspecting" | "structuring" | "ready"

export default function OcrUploadPage() {
    const router = useRouter()
    const [files, setFiles] = useState<File[]>([])
    const [progress, setProgress] = useState(0)
    const [statusMessage, setStatusMessage] = useState<string>("")
    const [currentStep, setCurrentStep] = useState<ProcessingStep>("idle")
    const [error, setError] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [engineUsed, setEngineUsed] = useState<string | null>(null)
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

    async function easeProgress(target: number, stepDelay = 40) {
        while (true) {
            let shouldContinue = false
            setProgress((current) => {
                if (current >= target) {
                    return current
                }
                shouldContinue = true
                const remaining = target - current
                const increment = remaining > 20 ? 6 : remaining > 10 ? 3 : remaining > 4 ? 2 : 1
                return Math.min(target, current + increment)
            })

            if (!shouldContinue) {
                break
            }

            await delay(stepDelay)
        }
    }

    function applySelectedFiles(f: File[]) {
        const allowedTypes = [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp"
        ]
        const valid = f.filter(file => {
            const okType = allowedTypes.includes(file.type) || /\.(pdf|png|jpe?g|webp)$/i.test(file.name)
            const okSize = file.size <= 15 * 1024 * 1024
            return okType && okSize
        })
        if (valid.length !== f.length) {
            setError("Format harus PDF atau Gambar (PNG/JPG/WEBP) dengan ukuran maks 15 MB")
            toast.error("Format tidak valid", { description: "Gunakan file PDF atau Gambar." })
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

    async function startProcess() {
        if (files.length === 0) return
        
        const file = files[0]
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

        setIsProcessing(true)
        setCurrentStep("uploading")
        setProgress(10)
        setStatusMessage("Tahap 1/3: Mengunggah dokumen...")
        setError(null)
        setBasicResult(null)
        setUploadedMeta(null)
        setEngineUsed(null)

        try {
            // Langkah 1: Upload File ke Persistent Storage
            const uploadFormData = new FormData()
            uploadFormData.append("file", file)

            const uploadRes = await uploadFile(uploadFormData)
            if (!uploadRes.success || !uploadRes.url) {
                throw new Error(uploadRes.error || "Gagal mengunggah file ke server.")
            }

            const uploadedFileUrl = uploadRes.url
            await easeProgress(40, 20)

            // Langkah 2: Ekstraksi Dokumen via PDF Inspector / Vision
            setCurrentStep("inspecting")
            if (isPdf) {
                setStatusMessage("Tahap 2/3: Ekstraksi cepat via PDF Inspector Microservice...")
            } else {
                setStatusMessage("Tahap 2/3: Ekstraksi gambar via Vision Engine OCR...")
            }

            await easeProgress(65, 30)

            // Langkah 3: Structured Mapping
            setCurrentStep("structuring")
            setStatusMessage("Tahap 3/3: Memetakan struktur PO ke data sistem...")

            const extractController = new AbortController()
            const extractTimeout = setTimeout(() => extractController.abort(), 20000)

            const apiResponse = await fetch("/api/ocr-extract-basic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileUrl: uploadedFileUrl, pages: "1,2,3" }),
                signal: extractController.signal,
            }).finally(() => clearTimeout(extractTimeout))

            const responseData = await apiResponse.json().catch(() => null)

            if (!apiResponse.ok || !responseData) {
                throw new Error(responseData?.error || `Ekstraksi gagal (HTTP ${apiResponse.status})`)
            }

            if (!responseData.basic || !hasMeaningfulBasicResult(responseData.basic)) {
                throw new Error("Sistem belum berhasil membaca data PO dari dokumen ini. Pastikan dokumen terbaca jelas.")
            }

            await easeProgress(100, 15)
            setCurrentStep("ready")
            setStatusMessage("Ekstraksi Berhasil!")
            setEngineUsed(responseData.model ? (responseData.model.includes("heuristic") ? "Heuristic Fast Engine" : responseData.model) : (isPdf ? "PDF Inspector Microservice" : "Vision Engine"))
            setBasicResult(responseData.basic)
            setUploadedMeta({
                fileUrl: uploadedFileUrl,
                fileName: file.name,
                fileType: file.type,
                rawText: responseData.rawText || "",
            })

            if (responseData.providerWarning) {
                toast.info("Catatan Pemrosesan", { description: responseData.providerWarning })
            }
            toast.success("Dokumen Berhasil Diekstrak", { 
                description: `Data PO (${responseData.basic.po_number || "PO Terdeteksi"}) berhasil dipetakan. Silakan lanjutkan ke Mapping MAGIC.` 
            })
        } catch (err) {
            const message = err instanceof Error ? (err.name === "AbortError" ? "Waktu ekstraksi habis (Timeout). Silakan coba lagi." : err.message) : "Gagal memproses OCR."
            setError(message)
            setCurrentStep("idle")
            toast.error("Gagal Memproses Dokumen", { description: message })
        } finally {
            setIsProcessing(false)
        }
    }

    async function continueToMagicMapping() {
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
                <div className="flex items-center gap-2">
                    <h1 className="flex items-start gap-3 text-2xl font-bold tracking-tight text-slate-900 sm:items-center sm:text-3xl">
                        <Zap className="mt-0.5 h-7 w-7 shrink-0 text-indigo-500 fill-indigo-500/10 sm:mt-0 sm:h-8 sm:w-8" />
                        Unggah PO untuk OCR
                    </h1>
                    <Badge variant="outline" className="ml-2 border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold">
                        Microservice Hybrid
                    </Badge>
                </div>
                <p className="text-sm text-slate-500 sm:text-base lg:text-lg">
                    Otomatisasi input Sales Order dengan ekstraksi instan dari file PDF / Gambar PO Anda.
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
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">(Format PDF atau Gambar, maks 15MB)</span>
                            </p>
                            
                            {files.length > 0 ? (
                                <div className="flex max-w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm sm:rounded-full sm:py-2">
                                    {files[0].type.includes("pdf") ? (
                                        <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                                    ) : (
                                        <ImageIcon className="h-4 w-4 shrink-0 text-amber-500" />
                                    )}
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
                                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                                multiple={false}
                                onChange={onSelect}
                                className="hidden"
                            />
                        </CardContent>
                    </Card>

                    {/* Multi-stage Realtime Stepper / Progress Bar */}
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
                                        Sedang Memproses...
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
                                    <div className="flex items-center gap-2 sm:justify-end">
                                        <span className="text-lg font-bold text-slate-900">{progress}%</span>
                                        {engineUsed && (
                                            <Badge variant="secondary" className="text-[10px] bg-slate-100 font-mono">
                                                {engineUsed}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">{statusMessage}</p>
                                </div>
                            )}
                        </div>

                        {(isProcessing || progress > 0) && (
                            <div className="space-y-3 rounded-xl border bg-slate-50/70 p-4">
                                <Progress value={progress} className="h-2.5 bg-slate-200 rounded-full overflow-hidden" />
                                
                                {/* Realtime Step Badges */}
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className={`flex items-center gap-1.5 p-2 rounded-lg transition-all ${
                                        progress >= 25 ? "bg-indigo-100/70 text-indigo-900 font-bold" : "text-slate-400"
                                    }`}>
                                        <FileCheck className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">1. Upload File</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 p-2 rounded-lg transition-all ${
                                        progress >= 60 ? "bg-indigo-100/70 text-indigo-900 font-bold" : progress >= 25 ? "bg-amber-50 text-amber-800 font-semibold animate-pulse" : "text-slate-400"
                                    }`}>
                                        <Cpu className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">2. Ekstraksi Dokumen</span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 p-2 rounded-lg transition-all ${
                                        progress >= 100 ? "bg-green-100/80 text-green-900 font-bold" : progress >= 60 ? "bg-indigo-50 text-indigo-800 font-semibold animate-pulse" : "text-slate-400"
                                    }`}>
                                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">3. Structured Mapping</span>
                                    </div>
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
                                Alur Pemrosesan OCR
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 pb-8">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">1</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Unggah Dokumen (PDF / Gambar)</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">PDF akan diproses via Microservice PDF Inspector yang cepat, atau Vision Engine untuk gambar.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">2</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Ekstraksi & Pemetaan Data</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">Teks dan tabel dokumen dikenali, lalu sistem memetakan Customer, No PO, dan item produk.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">3</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Mapping Produk MAGIC</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">MAGIC mencocokkan nama barang dari customer dengan katalog master produk di database.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">4</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Validasi & Simpan</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">Koreksi hasil sebelum disimpan menjadi draft Sales Order.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-100 bg-slate-50/30">
                        <CardContent className="p-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Fitur Microservice OCR
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                Menggunakan engine hybrid inspeksi PDF native + Fast Heuristic Parser untuk kecepatan maksimal (kurang dari 2 detik), meminimalkan waktu tunggu saat mengunggah Purchase Order.
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
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-lg text-green-900 flex items-center gap-2">
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        Hasil Ekstraksi Dokumen PO (Tahap 1)
                                    </CardTitle>
                                    {engineUsed && (
                                        <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800 text-[10px]">
                                            {engineUsed}
                                        </Badge>
                                    )}
                                </div>
                                <CardDescription>Data terstruktur yang berhasil diekstrak dan siap dipetakan ke master data.</CardDescription>
                            </div>
                            <Button 
                                onClick={continueToMagicMapping} 
                                disabled={isMapping}
                                className="w-full bg-indigo-600 shadow-md hover:bg-indigo-700 sm:w-auto"
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
                        <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-green-100 bg-white/70 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Customer</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-800">{basicResult.customer_name || "-"}</p>
                                </div>
                                <div className="rounded-xl border border-green-100 bg-white/70 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">No PO</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-800">{basicResult.po_number || "-"}</p>
                                </div>
                                <div className="rounded-xl border border-green-100 bg-white/70 p-4">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tanggal</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-800">{basicResult.date || "-"}</p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-green-100 bg-white/70">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-14">No</TableHead>
                                            <TableHead>Hasil Ekstraksi Item</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Harga Satuan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {basicResult.items.length > 0 ? basicResult.items.map((item, index) => (
                                            <TableRow key={`${item.product}-${index}`}>
                                                <TableCell>{index + 1}</TableCell>
                                                <TableCell className="font-medium">{item.product || "-"}</TableCell>
                                                <TableCell className="text-right">{item.qty}</TableCell>
                                                <TableCell className="text-right">{item.price.toLocaleString("id-ID")}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-sm text-slate-500">
                                                    Belum ada item yang berhasil dibaca.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
