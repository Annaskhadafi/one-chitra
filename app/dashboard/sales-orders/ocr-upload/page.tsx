"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { triggerSalesOrderBasicOcrFast } from "@/app/actions/ocr-fast"
import { optimizeImageForUpload } from "@/lib/client-upload"
import { 
    FileText, 
    Upload, 
    CheckCircle2, 
    ArrowRight, 
    Zap, 
    AlertCircle, 
    Loader2, 
    Cpu, 
    Sparkles, 
    FileCheck, 
    Image as ImageIcon,
    Trash2,
    Building2,
    Calendar,
    Hash,
    Layers,
    FileSpreadsheet,
    Clock,
    Timer
} from "lucide-react"
import { toast } from "sonner"

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
    const [extractDurationMs, setExtractDurationMs] = useState<number | null>(null)
    const [extractElapsedSec, setExtractElapsedSec] = useState(0)
    const [mappingDurationMs, setMappingDurationMs] = useState<number | null>(null)
    const [mappingElapsedSec, setMappingElapsedSec] = useState(0)
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
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const extractTimerRef = useRef<NodeJS.Timeout | null>(null)
    const mappingTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
            if (extractTimerRef.current) clearInterval(extractTimerRef.current)
            if (mappingTimerRef.current) clearInterval(mappingTimerRef.current)
        }
    }, [])

    function setSmoothProgress(target: number, speedMs = 25) {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
        }
        progressIntervalRef.current = setInterval(() => {
            setProgress((prev) => {
                if (prev >= target) {
                    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
                    return target
                }
                const diff = target - prev
                const increment = diff > 20 ? 4 : diff > 10 ? 2 : 1
                const next = prev + increment
                if (next >= target) {
                    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
                    return target
                }
                return next
            })
        }, speedMs)
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
            toast.error("Format tidak valid", { description: "Gunakan file PDF atau Gambar (maks. 15MB)." })
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

    function clearSelectedFile(e?: React.MouseEvent) {
        if (e) e.stopPropagation()
        setFiles([])
        setError(null)
        if (inputRef.current) {
            inputRef.current.value = ""
        }
    }

    async function startProcess() {
        if (files.length === 0) return
        
        const file = files[0]
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
        if (extractTimerRef.current) clearInterval(extractTimerRef.current)
        if (mappingTimerRef.current) clearInterval(mappingTimerRef.current)

        const startTime = performance.now()
        const startTimeStamp = Date.now()
        setExtractDurationMs(null)
        setExtractElapsedSec(0)
        setMappingDurationMs(null)
        setMappingElapsedSec(0)

        extractTimerRef.current = setInterval(() => {
            setExtractElapsedSec(Number(((Date.now() - startTimeStamp) / 1000).toFixed(1)))
        }, 100)

        setIsProcessing(true)
        setCurrentStep("uploading")
        setProgress(15)
        setSmoothProgress(35, 30)
        setStatusMessage("Tahap 1/3: Mengunggah dokumen...")
        setError(null)
        setBasicResult(null)
        setUploadedMeta(null)
        setEngineUsed(null)

        try {
            // Upload and extraction share one server action and one request.
            setCurrentStep("inspecting")
            setSmoothProgress(70, 25)
            if (isPdf) {
                setStatusMessage("Tahap 2/3: Ekstraksi cepat via PDF Inspector Microservice...")
            } else {
                setStatusMessage("Tahap 2/3: Ekstraksi gambar via Vision Engine OCR...")
            }

            setCurrentStep("structuring")
            setSmoothProgress(90, 30)
            setStatusMessage("Tahap 3/3: Memetakan struktur PO ke data sistem...")

            const extractFormData = new FormData()
            const uploadFile = await optimizeImageForUpload(file)
            extractFormData.append("file", uploadFile)
            let timeoutId: ReturnType<typeof setTimeout> | undefined
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("Waktu OCR habis (45 detik). Silakan coba lagi.")), 45_000)
            })
            const responseData = await Promise.race([
                triggerSalesOrderBasicOcrFast(extractFormData),
                timeoutPromise,
            ]).finally(() => {
                if (timeoutId) clearTimeout(timeoutId)
            })

            if (!responseData.success) {
                throw new Error(responseData.error || "Ekstraksi gagal")
            }

            if (!responseData.basic || !hasMeaningfulBasicResult(responseData.basic)) {
                throw new Error("Sistem belum berhasil membaca data PO dari dokumen ini. Pastikan dokumen terbaca jelas.")
            }

            // Selesai dengan sukses -> Set progress ke 100% dan catat durasi
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
            if (extractTimerRef.current) clearInterval(extractTimerRef.current)
            
            const durationMs = Math.max(100, Math.round(performance.now() - startTime))
            setExtractDurationMs(durationMs)
            
            setProgress(100)
            setCurrentStep("ready")
            setStatusMessage("Ekstraksi Berhasil!")
            setEngineUsed(responseData.model ? (responseData.model.includes("heuristic") ? "Heuristic Fast Engine" : responseData.model) : (isPdf ? "PDF Inspector Microservice" : "Vision Engine"))
            setBasicResult(responseData.basic)
            setUploadedMeta({
                fileUrl: responseData.fileUrl,
                fileName: responseData.fileName || file.name,
                fileType: responseData.fileType || file.type,
                rawText: responseData.rawText || "",
            })

            if (responseData.providerWarning) {
                toast.info("Catatan Pemrosesan", { description: responseData.providerWarning })
            }
            toast.success("Dokumen Berhasil Diekstrak", { 
                description: `Data PO (${responseData.basic.po_number || "PO Terdeteksi"}) diekstrak dalam ${(durationMs / 1000).toFixed(1)} detik. Silakan periksa hasil di sebelah kanan.` 
            })
        } catch (err) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
            if (extractTimerRef.current) clearInterval(extractTimerRef.current)
            const message = err instanceof Error ? (err.name === "AbortError" ? "Waktu ekstraksi habis (Timeout). Silakan coba lagi." : err.message) : "Gagal memproses OCR."
            setError(message)
            setCurrentStep("idle")
            setProgress(0)
            setStatusMessage("")
            toast.error("Gagal Memproses Dokumen", { description: message })
        } finally {
            setIsProcessing(false)
        }
    }

    async function continueToMagicMapping() {
        if (!basicResult || !uploadedMeta) return
        
        const mapStartTime = performance.now()
        const mapStartTimeStamp = Date.now()
        setMappingElapsedSec(0)
        
        if (mappingTimerRef.current) clearInterval(mappingTimerRef.current)
        mappingTimerRef.current = setInterval(() => {
            setMappingElapsedSec(Number(((Date.now() - mapStartTimeStamp) / 1000).toFixed(1)))
        }, 100)

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
            
            if (mappingTimerRef.current) clearInterval(mappingTimerRef.current)
            const mapDurationMs = Math.max(100, Math.round(performance.now() - mapStartTime))
            setMappingDurationMs(mapDurationMs)
            
            if (!response.ok) {
                setError(body?.error || "Gagal proses mapping MAGIC")
                toast.error("Mapping Gagal", { description: body?.error || "MAGIC gagal memetakan produk." })
                return
            }
            if (!body?.sessionId) {
                setError("Session hasil mapping tidak ditemukan")
                return
            }
            const totalSec = (((extractDurationMs || 0) + mapDurationMs) / 1000).toFixed(1)
            toast.success("Mapping MAGIC Selesai", { 
                description: `Mapping selesai dalam ${(mapDurationMs / 1000).toFixed(1)}s (Total Waktu: ${totalSec}s). Mengalihkan...` 
            })
            router.push(`/dashboard/sales-orders/ocr-validate?session=${body.sessionId}`)
        } catch {
            if (mappingTimerRef.current) clearInterval(mappingTimerRef.current)
            setError("Mapping MAGIC timeout / service lambat. Silakan coba lagi.")
        } finally {
            setIsMapping(false)
        }
    }

    const totalCalculated = basicResult?.items?.reduce((acc, item) => acc + (item.qty * item.price), 0) || 0

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
            {/* Header Section */}
            <div className="flex flex-col gap-2 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                            <Zap className="h-5 w-5 fill-indigo-500/20 text-indigo-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                                    Unggah PO untuk OCR
                                </h1>
                                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-semibold">
                                    Microservice Hybrid
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-500 sm:text-sm">
                                Ekstraksi otomatis dokumen Purchase Order (PDF/Gambar) langsung ke Sales Order.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main 2-Grid Side-by-Side Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                
                {/* ================= LEFT GRID: Upload & Processing ================= */}
                <div className="space-y-5 lg:col-span-5">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">1</span>
                                Upload Dokumen PO
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Pilih atau jatuhkan file Purchase Order Anda di bawah.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Dropzone Area */}
                            <div 
                                onClick={() => inputRef.current?.click()}
                                onDrop={onDrop}
                                onDragOver={onDragOver}
                                className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
                                    files.length > 0 
                                        ? "border-indigo-300 bg-indigo-50/20 hover:bg-indigo-50/40" 
                                        : "border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-white"
                                }`}
                            >
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-transform group-hover:scale-105">
                                    <Upload className="h-6 w-6" />
                                </div>
                                <p className="text-sm font-semibold text-slate-800">
                                    Klik untuk memilih atau seret file ke sini
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    Mendukung PDF, PNG, JPG, JPEG, WEBP (Maks. 15 MB)
                                </p>

                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                                    multiple={false}
                                    onChange={onSelect}
                                    className="hidden"
                                />
                            </div>

                            {/* Selected File Box */}
                            {files.length > 0 && (
                                <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs border border-indigo-100">
                                            {files[0].type.includes("pdf") ? (
                                                <FileText className="h-5 w-5 text-indigo-600" />
                                            ) : (
                                                <ImageIcon className="h-5 w-5 text-amber-500" />
                                            )}
                                        </div>
                                        <div className="truncate">
                                            <p className="truncate text-xs font-semibold text-slate-800">{files[0].name}</p>
                                            <p className="text-[10px] text-slate-500">{(files[0].size / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="sm" 
                                        disabled={isProcessing}
                                        onClick={clearSelectedFile}
                                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                                        title="Hapus file"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {/* Action Button */}
                            <Button 
                                size="lg" 
                                onClick={startProcess} 
                                disabled={files.length === 0 || isProcessing}
                                className="w-full rounded-xl bg-indigo-600 py-5 font-semibold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sedang Memproses Dokumen...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="mr-2 h-4 w-4" />
                                        Mulai Proses OCR
                                    </>
                                )}
                            </Button>

                            {/* Synchronized Progress & Step Indicator */}
                            {(isProcessing || progress > 0) && (
                                <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition-all">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                                            {statusMessage || "Memproses..."}
                                            {isProcessing && (
                                                <span className="font-mono text-[11px] text-indigo-600 font-normal">
                                                    ({extractElapsedSec.toFixed(1)}s)
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {extractDurationMs && !isProcessing && (
                                                <span className="font-mono text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {(extractDurationMs / 1000).toFixed(1)}s
                                                </span>
                                            )}
                                            <span className="font-mono font-bold text-indigo-600">
                                                {progress}%
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <Progress value={progress} className="h-2 rounded-full bg-slate-200" />
                                    
                                    {/* 3 Step Badges */}
                                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px]">
                                        <div className={`flex items-center gap-1 rounded-md p-1.5 transition-colors ${
                                            progress >= 30 ? "bg-indigo-100/80 font-bold text-indigo-900" : "text-slate-400"
                                        }`}>
                                            <FileCheck className="h-3 w-3 shrink-0" />
                                            <span className="truncate">1. Upload</span>
                                        </div>
                                        <div className={`flex items-center gap-1 rounded-md p-1.5 transition-colors ${
                                            progress >= 70 ? "bg-indigo-100/80 font-bold text-indigo-900" : progress >= 30 ? "bg-amber-100 text-amber-800 font-semibold animate-pulse" : "text-slate-400"
                                        }`}>
                                            <Cpu className="h-3 w-3 shrink-0" />
                                            <span className="truncate">2. Ekstraksi</span>
                                        </div>
                                        <div className={`flex items-center gap-1 rounded-md p-1.5 transition-colors ${
                                            progress >= 100 ? "bg-emerald-100 font-bold text-emerald-900" : progress >= 70 ? "bg-indigo-50 text-indigo-800 font-semibold animate-pulse" : "text-slate-400"
                                        }`}>
                                            <Sparkles className="h-3 w-3 shrink-0" />
                                            <span className="truncate">
                                                3. Selesai {extractDurationMs ? `(${(extractDurationMs / 1000).toFixed(1)}s)` : ""}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Error Alert */}
                            {error && (
                                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-700">
                                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Proses Gagal</p>
                                        <p className="mt-0.5 text-rose-600 leading-relaxed">{error}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Microservice Quick Info */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 text-xs text-slate-500 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                            <Layers className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Engine OCR Cepat & Otomatis</span>
                        </div>
                        <p className="leading-relaxed text-[11px]">
                            Dokumen PDF diproses secara deterministik via PDF Inspector Microservice (&lt; 2 detik), sedangkan foto/scan diproses menggunakan Vision Engine.
                        </p>
                    </div>
                </div>

                {/* ================= RIGHT GRID: Extraction Result ================= */}
                <div className="space-y-5 lg:col-span-7">
                    {/* State 1: Belum ada proses (Empty State) */}
                    {!basicResult && !isProcessing && (
                        <Card className="flex min-h-[440px] flex-col items-center justify-center border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-4">
                                <FileSpreadsheet className="h-8 w-8" />
                            </div>
                            <h3 className="text-base font-bold text-slate-700">
                                Hasil Ekstraksi Dokumen PO
                            </h3>
                            <p className="mt-1.5 max-w-sm text-xs text-slate-400 leading-relaxed">
                                Unggah dokumen Purchase Order di panel sebelah kiri dan klik <b>Mulai Proses OCR</b>. Hasil pengenalan data Customer, No PO, dan item produk akan langsung tampil di sini.
                            </p>
                        </Card>
                    )}

                    {/* State 2: Sedang memproses (Loading State) */}
                    {isProcessing && !basicResult && (
                        <Card className="flex min-h-[440px] flex-col items-center justify-center border-slate-200 bg-white p-8 text-center shadow-xs">
                            <div className="relative mb-4">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                                </div>
                            </div>
                            <h3 className="text-base font-bold text-slate-800">
                                Membaca & Menyusun Data PO
                            </h3>
                            <p className="mt-1 max-w-xs text-xs text-slate-400 leading-relaxed">
                                {statusMessage || "Mohon tunggu sebentar, sistem sedang mengekstrak teks dan tabel produk..."}
                            </p>
                        </Card>
                    )}

                    {/* State 3: Hasil Berhasil (Ready State) */}
                    {basicResult && (
                        <Card className="border-emerald-200 bg-white shadow-sm overflow-hidden animate-in fade-in-50 duration-300">
                            <CardHeader className="border-b border-slate-100 bg-emerald-50/30 pb-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px] font-semibold py-0.5">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                Ekstraksi Berhasil
                                            </Badge>
                                            {engineUsed && (
                                                <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-800 text-[10px] font-mono">
                                                    {engineUsed}
                                                </Badge>
                                            )}
                                            {extractDurationMs && (
                                                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-mono font-semibold flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-indigo-500" />
                                                    Ekstrak: {(extractDurationMs / 1000).toFixed(1)}s
                                                </Badge>
                                            )}
                                        </div>
                                        <CardTitle className="text-base font-bold text-slate-900 mt-1.5">
                                            Data Purchase Order Terbaca
                                        </CardTitle>
                                    </div>
                                    <Button 
                                        onClick={continueToMagicMapping} 
                                        disabled={isMapping}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm text-xs py-2 px-4 h-9 rounded-lg shrink-0"
                                    >
                                        {isMapping ? (
                                            <>
                                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                Mapping MAGIC ({mappingElapsedSec.toFixed(1)}s)...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                                                Lanjut ke Mapping MAGIC
                                                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>

                            <CardContent className="p-4 sm:p-5 space-y-4">
                                {/* Metadata Cards (Customer, No PO, Date) */}
                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            <Building2 className="h-3 w-3 text-slate-500" />
                                            <span>Customer</span>
                                        </div>
                                        <p className="mt-1 text-xs font-bold text-slate-800 truncate" title={basicResult.customer_name}>
                                            {basicResult.customer_name || "-"}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            <Hash className="h-3 w-3 text-slate-500" />
                                            <span>No. PO</span>
                                        </div>
                                        <p className="mt-1 text-xs font-bold text-slate-800 truncate" title={basicResult.po_number}>
                                            {basicResult.po_number || "-"}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            <Calendar className="h-3 w-3 text-slate-500" />
                                            <span>Tanggal PO</span>
                                        </div>
                                        <p className="mt-1 text-xs font-bold text-slate-800 truncate">
                                            {basicResult.date || "-"}
                                        </p>
                                    </div>
                                </div>

                                {/* Timeline & Duration Metric Banner */}
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3.5 py-2.5 text-xs text-indigo-950">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                                            <Timer className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-900">Durasi Pemrosesan:</span>
                                            <span className="ml-1.5 text-slate-600">
                                                Ekstraksi OCR <b>{extractDurationMs ? `${(extractDurationMs / 1000).toFixed(2)}s` : "-"}</b>
                                                {mappingDurationMs ? (
                                                    <> &bull; Mapping MAGIC <b>{(mappingDurationMs / 1000).toFixed(2)}s</b> (Total: <b>{(((extractDurationMs || 0) + mappingDurationMs) / 1000).toFixed(2)}s</b>)</>
                                                ) : isMapping ? (
                                                    <> &bull; Sedang Mapping MAGIC (<b>{mappingElapsedSec.toFixed(1)}s</b>...)</>
                                                ) : (
                                                    <> &bull; Klik tombol di atas untuk melanjutkan mapping</>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    {extractDurationMs && (
                                        <span className="text-[11px] font-medium text-indigo-700 bg-white border border-indigo-200/80 px-2 py-0.5 rounded-md shadow-2xs font-mono">
                                            {extractDurationMs < 2000 ? "⚡ Ekstraksi Cepat (< 2s)" : "⏱️ Selesai"}
                                        </span>
                                    )}
                                </div>

                                {/* Table of Extracted Items */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-700">
                                            Daftar Item PO ({basicResult.items.length} item)
                                        </span>
                                        {totalCalculated > 0 && (
                                            <span className="text-[11px] font-medium text-slate-500">
                                                Estimasi Total: <b className="text-slate-800">Rp {totalCalculated.toLocaleString("id-ID")}</b>
                                            </span>
                                        )}
                                    </div>

                                    <div className="max-h-[340px] overflow-y-auto rounded-xl border border-slate-200 bg-white scrollbar-thin">
                                        <Table>
                                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="w-10 text-[11px] font-bold">#</TableHead>
                                                    <TableHead className="text-[11px] font-bold">Nama Item / Produk PO</TableHead>
                                                    <TableHead className="w-20 text-right text-[11px] font-bold">Qty</TableHead>
                                                    <TableHead className="w-32 text-right text-[11px] font-bold">Harga Satuan</TableHead>
                                                    <TableHead className="w-32 text-right text-[11px] font-bold">Subtotal</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {basicResult.items.length > 0 ? (
                                                    basicResult.items.map((item, index) => {
                                                        const subtotal = (item.qty || 0) * (item.price || 0)
                                                        return (
                                                            <TableRow key={`${item.product}-${index}`} className="hover:bg-slate-50/70 text-xs">
                                                                <TableCell className="font-mono text-slate-400 py-2.5">{index + 1}</TableCell>
                                                                <TableCell className="font-medium text-slate-800 py-2.5">
                                                                    {item.product || "-"}
                                                                </TableCell>
                                                                <TableCell className="text-right font-semibold text-slate-700 py-2.5">
                                                                    {item.qty}
                                                                </TableCell>
                                                                <TableCell className="text-right text-slate-600 py-2.5">
                                                                    {item.price > 0 ? `Rp ${item.price.toLocaleString("id-ID")}` : "-"}
                                                                </TableCell>
                                                                <TableCell className="text-right font-semibold text-slate-900 py-2.5">
                                                                    {subtotal > 0 ? `Rp ${subtotal.toLocaleString("id-ID")}` : "-"}
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="py-6 text-center text-xs text-slate-400">
                                                            Tidak ada baris item yang berhasil diekstrak.
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

            </div>
        </div>
    )
}
