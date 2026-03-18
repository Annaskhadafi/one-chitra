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
    const inputRef = useRef<HTMLInputElement | null>(null)

    function applySelectedFiles(f: File[]) {
        const valid = f.filter(file => {
            const okType = ["application/pdf", "image/jpeg", "image/png"].includes(file.type)
            const okSize = file.size <= 10 * 1024 * 1024
            return okType && okSize
        })
        if (valid.length !== f.length) {
            setError("Format harus PDF/JPG/PNG dan ukuran maks 10 MB per file")
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
        const ocrResponse = await fetch("/api/ocr-extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileUrl: res.url }),
        })
        const ocrBodyText = await ocrResponse.text()
        let ocrRes: { error?: string; sessionId?: number } = {}
        if (ocrBodyText.trim().length > 0) {
            try {
                ocrRes = JSON.parse(ocrBodyText) as { error?: string; sessionId?: number }
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
        if (!ocrRes.sessionId) {
            setError("Session OCR tidak ditemukan")
            return
        }
        setProgress(100)
        router.push(`/dashboard/sales-orders/ocr-validate?session=${ocrRes.sessionId}`)
    }

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Unggah PO untuk OCR</h1>
            <div
                className="border rounded-lg p-8 text-center bg-muted/30"
                onDrop={onDrop}
                onDragOver={onDragOver}
            >
                <p className="mb-4">Tarik file ke sini atau pilih</p>
                <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
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
        </div>
    )
}
