"use client"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { uploadFile } from "@/app/actions/upload"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function OcrUploadPage() {
    const router = useRouter()
    const [files, setFiles] = useState<File[]>([])
    const [previews, setPreviews] = useState<string[]>([])
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
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
            setError("Format harus PDF (gambar tidak didukung) dan ukuran maks 10 MB per file")
        } else {
            setError(null)
        }
        setFiles(valid)
        setPreviews(valid.map(file => URL.createObjectURL(file)))
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
        setProgress(0)
        setError(null)
        setBasicResult(null)
        setUploadedMeta(null)
        const file = files[0]
        const form = new FormData()
        form.append("file", file)
        form.append("filename", file.name)
        const total = file.size
        let uploaded = 0
        const chunkSize = Math.min(1024 * 1024, total)
        uploaded += chunkSize
        setProgress(Math.round((uploaded / total) * 100))
        const res = await uploadFile(form)
        if (!res?.url) {
            setError("Gagal mengunggah file")
            return
        }
        setProgress(80)
        const ocrResponse = await fetch("/api/ocr-extract-basic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileUrl: res.url }),
        })
        const ocrBodyText = await ocrResponse.text()
        let ocrRes: {
            error?: string
            basic?: { customer_name: string; po_number: string; items: Array<{ product: string; qty: number; price: number }> }
            rawText?: string
        } = {}
        if (ocrBodyText.trim().length > 0) {
            try {
                ocrRes = JSON.parse(ocrBodyText) as {
                    error?: string
                    basic?: { customer_name: string; po_number: string; date: string; items: Array<{ product: string; qty: number; price: number }> }
                    rawText?: string
                }
            } catch {
                setError("Respons OCR tidak valid")
                return
            }
        } else {
            setError("Respons OCR kosong")
            return
        }
        if (!ocrResponse.ok) {
            setError(ocrRes.error || "OCR gagal diproses")
            return
        }
        if (ocrRes?.error) {
            setError(ocrRes.error)
            return
        }
        if (!ocrRes.basic) {
            setError("Hasil ekstraksi OCR kosong")
            return
        }
        setProgress(100)
        setBasicResult(ocrRes.basic)
        setUploadedMeta({
            fileUrl: res.url,
            fileName: file.name,
            fileType: file.type,
            rawText: ocrRes.rawText || "",
        })
    }

    async function continueToAiMapping() {
        if (!basicResult || !uploadedMeta) {
            return
        }
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
                return
            }
            if (!body?.sessionId) {
                setError("Session hasil mapping tidak ditemukan")
                return
            }
            router.push(`/dashboard/sales-orders/ocr-validate?session=${body.sessionId}`)
        } finally {
            setIsMapping(false)
        }
    }

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Unggah PO untuk OCR</h1>
            <div
                className="border rounded-lg p-8 text-center bg-muted/30"
                onDrop={onDrop}
                onDragOver={onDragOver}
            >
                <p className="mb-4">Tarik file PDF ke sini atau pilih (format gambar tidak didukung)</p>
                <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf"
                    multiple={false}
                    onChange={onSelect}
                    className="mb-4"
                />
                <Button onClick={() => inputRef.current?.click()}>Browse</Button>
            </div>
            {error && <div className="text-red-600">{error}</div>}
            {previews.length > 0 && (
                <Card>
                    <CardContent className="p-4 flex gap-4">
                        {previews.map((src, i) => (
                            <div key={i} className="w-32 h-32 relative">
                                {files[i]?.type === "application/pdf" ? (
                                    <div className="h-full w-full rounded border bg-muted flex items-center justify-center text-xs">
                                        PDF
                                    </div>
                                ) : (
                                    <Image src={src} alt={`preview-${i}`} fill className="object-cover rounded" />
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
            <div className="flex items-center gap-4">
                <Button onClick={startProcess} disabled={files.length === 0}>Proses</Button>
                <div className="w-64 h-3 bg-muted rounded">
                    <Progress value={progress} />
                </div>
                <span>{progress}%</span>
            </div>
            {basicResult && (
                <Card>
                    <CardContent className="p-4 space-y-4">
                        <div className="text-sm font-medium">Hasil OCR Dasar (Tahap 1)</div>
                        <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(basicResult, null, 2)}</pre>
                        <div className="flex items-center gap-3">
                            <Button onClick={continueToAiMapping} disabled={isMapping}>
                                {isMapping ? "Memproses Mapping AI..." : "Lanjutkan Mapping AI (Tahap 2)"}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                Setelah ini user bisa review hasil mapping di halaman validasi
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
