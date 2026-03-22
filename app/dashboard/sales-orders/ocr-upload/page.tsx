"use client"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { uploadFile } from "@/app/actions/upload"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { 
    FileText, 
    Upload, 
    Info, 
    CheckCircle2, 
    ArrowRight, 
    Zap, 
    Search, 
    Database,
    AlertCircle,
    Loader2
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function OcrUploadPage() {
    const router = useRouter()
    const [files, setFiles] = useState<File[]>([])
    const [previews, setPreviews] = useState<string[]>([])
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
        setPreviews(valid.map(file => URL.createObjectURL(file)))
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
        
        setIsProcessing(true)
        setProgress(5)
        setStatusMessage("Mengunggah dokumen...")
        setError(null)
        setBasicResult(null)
        setUploadedMeta(null)
        
        const file = files[0]
        const form = new FormData()
        form.append("file", file)
        form.append("filename", file.name)
        
        // Stage 1: Upload (0-30%)
        const res = await uploadFile(form)
        if (!res?.url) {
            setError("Gagal mengunggah file")
            setIsProcessing(false)
            setProgress(0)
            toast.error("Upload Gagal", { description: "Terjadi kesalahan saat mengunggah file ke server." })
            return
        }
        
        setProgress(30)
        setStatusMessage("Mengekstrak data dari dokumen...")
        
        // Stage 2: OCR Extraction (30-80%)
        try {
            const ocrResponse = await fetch("/api/ocr-extract-basic", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileUrl: res.url }),
            })
            
            setProgress(60)
            setStatusMessage("Menganalisis hasil ekstraksi...")
            
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
                description: "Data dasar PO telah teridentifikasi. Silakan lanjutkan ke Mapping AI." 
            })
        } catch (err) {
            setError("Terjadi kesalahan jaringan atau server")
            toast.error("Kesalahan Sistem", { description: "Gagal menghubungi layanan OCR." })
        } finally {
            setIsProcessing(false)
        }
    }

    async function continueToAiMapping() {
        if (!basicResult || !uploadedMeta) return
        
        setIsMapping(true)
        setError(null)
        try {
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
            })
            const body = await response.json().catch(() => null)
            if (!response.ok) {
                setError(body?.error || "Gagal proses mapping AI")
                toast.error("Mapping Gagal", { description: body?.error || "AI gagal memetakan produk." })
                return
            }
            if (!body?.sessionId) {
                setError("Session hasil mapping tidak ditemukan")
                return
            }
            toast.success("Mapping AI Selesai", { description: "Mengalihkan ke halaman validasi..." })
            router.push(`/dashboard/sales-orders/ocr-validate?session=${body.sessionId}`)
        } catch (err) {
            setError("Gagal menghubungi AI mapping service")
        } finally {
            setIsMapping(false)
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-10">
            {/* Header Section */}
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                    <Zap className="h-8 w-8 text-indigo-500 fill-indigo-500/10" />
                    Unggah PO untuk OCR
                </h1>
                <p className="text-slate-500 text-lg">
                    Otomatisasi input Sales Order dengan mengekstrak data langsung dari file PO Anda.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Upload & Progress */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition-all group overflow-hidden relative">
                        <CardContent 
                             className="p-12 text-center flex flex-col items-center justify-center min-h-[300px] cursor-pointer"
                             onClick={() => inputRef.current?.click()}
                             onDrop={onDrop}
                             onDragOver={onDragOver}
                        >
                            <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Upload className="h-8 w-8 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Tarik & Lepas File PO</h3>
                            <p className="text-slate-500 mb-6 max-w-xs mx-auto">
                                atau klik untuk memilih file dari komputer Anda. <br/>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">(Hanya format PDF, maks 10MB)</span>
                            </p>
                            
                            {files.length > 0 ? (
                                <div className="flex items-center gap-3 py-2 px-4 bg-white border rounded-full shadow-sm">
                                    <FileText className="h-4 w-4 text-indigo-500" />
                                    <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{files[0].name}</span>
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </div>
                            ) : (
                                <Button variant="secondary" className="rounded-full px-8 shadow-sm">
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
                        <div className="flex items-center justify-between">
                            <Button 
                                size="lg" 
                                onClick={startProcess} 
                                disabled={files.length === 0 || isProcessing}
                                className="px-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 shadow-lg"
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
                                <div className="text-right">
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
                        <div className="absolute top-0 right-0 p-4 opacity-10">
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
                                <div className="flex gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">1</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Unggah Dokumen PO</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">Pastikan file dalam format PDF yang jelas dan terbaca untuk hasil terbaik.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">2</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Ekstraksi Data Dasar</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">Sistem akan mengidentifikasi Nama Customer, No PO, dan daftar barang.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="h-8 w-8 rounded-full bg-indigo-800 flex items-center justify-center shrink-0 font-bold text-sm">3</div>
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm">Mapping Produk AI</p>
                                        <p className="text-indigo-300 text-xs leading-relaxed">AI akan mencocokkan nama barang dari customer dengan produk di database kami.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
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
                        <div className="flex items-center justify-between">
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
                                className="bg-indigo-600 hover:bg-indogo-700 shadow-md"
                            >
                                {isMapping ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Mapping AI...
                                    </>
                                ) : (
                                    <>
                                        Lanjutkan ke Mapping AI
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <pre className="text-xs bg-white/50 p-4 rounded-xl border border-green-100 overflow-auto font-mono text-slate-700 leading-relaxed max-h-[400px]">
                            {JSON.stringify(basicResult, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
