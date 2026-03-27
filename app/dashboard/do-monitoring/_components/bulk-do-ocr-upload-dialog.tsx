"use client"

import { useMemo, useRef, useState } from "react"
import { uploadFile } from "@/app/actions/upload"
import { bulkAttachDoScansByInternalNo, getDeliveries, updateDoMonitoringFields } from "@/app/actions/delivery"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, ScanSearch, FileText, CheckCircle2, CircleAlert, Loader2 } from "lucide-react"

type UploadStatus = "pending" | "uploading" | "ocr" | "matched" | "unmatched" | "duplicate" | "failed"

type UploadItem = {
    id: string
    file: File
    fileUrl?: string
    internalNo?: string | null
    status: UploadStatus
    message?: string
    deliveryNumber?: string
}

type BulkResult = Awaited<ReturnType<typeof bulkAttachDoScansByInternalNo>>

export function BulkDoOcrUploadDialog() {
    const queryClient = useQueryClient()
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [open, setOpen] = useState(false)
    const [files, setFiles] = useState<UploadItem[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [manualMatchingId, setManualMatchingId] = useState<string | null>(null)
    const [manualSelections, setManualSelections] = useState<Record<string, string>>({})
    const [progress, setProgress] = useState(0)
    const [summary, setSummary] = useState<BulkResult | null>(null)

    const { data: deliveries = [] } = useQuery({
        queryKey: ["deliveries"],
        queryFn: () => getDeliveries(),
        staleTime: 60 * 1000,
    })

    const deliveryOptions = useMemo(
        () => deliveries
            .filter((delivery) => delivery.deliveryNumber)
            .map((delivery) => ({ id: delivery.id, deliveryNumber: delivery.deliveryNumber || "-" }))
            .sort((a, b) => a.deliveryNumber.localeCompare(b.deliveryNumber)),
        [deliveries],
    )

    const readyCount = useMemo(
        () => files.filter((file) => file.status === "matched" || file.status === "unmatched" || file.status === "failed").length,
        [files],
    )

    function resetState(nextOpen: boolean) {
        setOpen(nextOpen)
        if (!nextOpen && !isProcessing) {
            setFiles([])
            setManualSelections({})
            setManualMatchingId(null)
            setProgress(0)
            setSummary(null)
        }
    }

    function applyFiles(selectedFiles: File[]) {
        const valid = selectedFiles.filter((file) => file.type === "application/pdf")
        if (valid.length !== selectedFiles.length) {
            toast.error("Hanya file PDF yang bisa diproses untuk OCR DO")
        }

        setSummary(null)
        setProgress(0)
        setFiles(valid.map((file, index) => ({
            id: `${file.name}-${file.size}-${index}`,
            file,
            status: "pending",
        })))
        setManualSelections({})
    }

    async function matchManual(item: UploadItem) {
        const selectedDeliveryId = Number(manualSelections[item.id])
        if (!selectedDeliveryId || !item.fileUrl) {
            toast.error("Pilih Delivery/DO No dulu untuk matching manual")
            return
        }

        const selectedDelivery = deliveryOptions.find((delivery) => delivery.id === selectedDeliveryId)
        if (!selectedDelivery) {
            toast.error("Delivery yang dipilih tidak valid")
            return
        }

        setManualMatchingId(item.id)
        try {
            const result = await updateDoMonitoringFields(selectedDeliveryId, {
                scanDoDocument: item.fileUrl,
                returnDoDate: new Date(),
                doStatus: "Returned",
            })

            if (!result.success) {
                toast.error(result.error || "Matching manual gagal")
                return
            }

            setFiles((prev) => prev.map((entry) => entry.id === item.id
                ? {
                    ...entry,
                    internalNo: selectedDelivery.deliveryNumber,
                    deliveryNumber: selectedDelivery.deliveryNumber,
                    status: "matched",
                    message: `Matched manual ke ${selectedDelivery.deliveryNumber}`,
                }
                : entry))

            toast.success(`File ${item.file.name} berhasil di-match manual`)
            await queryClient.invalidateQueries({ queryKey: ["deliveries"] })
        } finally {
            setManualMatchingId(null)
        }
    }

    async function processFiles() {
        if (files.length === 0 || isProcessing) return

        setIsProcessing(true)
        setSummary(null)

        const nextFiles = [...files]
        const matchedEntries: Array<{ internalNo: string; fileUrl: string; originalFileName: string }> = []

        try {
            for (let index = 0; index < nextFiles.length; index++) {
                const current = nextFiles[index]
                nextFiles[index] = { ...current, status: "uploading", message: "Uploading file..." }
                setFiles([...nextFiles])
                setProgress(Math.round((index / nextFiles.length) * 40))

                const formData = new FormData()
                formData.append("file", current.file)
                const uploadResult = await uploadFile(formData)

                if (!uploadResult.success || !uploadResult.url) {
                    nextFiles[index] = { ...current, status: "failed", message: uploadResult.error || "Upload gagal" }
                    setFiles([...nextFiles])
                    continue
                }

                nextFiles[index] = {
                    ...nextFiles[index],
                    fileUrl: uploadResult.url,
                    status: "ocr",
                    message: "Membaca Internal No via OCR...",
                }
                setFiles([...nextFiles])
                setProgress(Math.round(((index + 0.5) / nextFiles.length) * 70))

                const response = await fetch("/api/do-scan-ocr", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fileUrl: uploadResult.url }),
                })
                const body = await response.json().catch(() => null) as {
                    error?: string
                    internalNo?: string | null
                } | null

                if (!response.ok || body?.error) {
                    nextFiles[index] = {
                        ...nextFiles[index],
                        status: "failed",
                        message: body?.error || "OCR gagal diproses",
                    }
                    setFiles([...nextFiles])
                    continue
                }

                if (!body?.internalNo) {
                    nextFiles[index] = {
                        ...nextFiles[index],
                        status: "unmatched",
                        message: "Internal No tidak ditemukan di dokumen",
                    }
                    setFiles([...nextFiles])
                    continue
                }

                nextFiles[index] = {
                    ...nextFiles[index],
                    internalNo: body.internalNo,
                    status: "matched",
                    message: `Internal No terdeteksi: ${body.internalNo}`,
                }
                matchedEntries.push({
                    internalNo: body.internalNo,
                    fileUrl: uploadResult.url,
                    originalFileName: current.file.name,
                })
                setFiles([...nextFiles])
            }

            setProgress(80)

            const bulkResult = await bulkAttachDoScansByInternalNo(matchedEntries)
            setSummary(bulkResult)

            if (!bulkResult.success) {
                toast.error(bulkResult.error || "Bulk update DO gagal")
                return
            }

            const unmatchedByInternalNo = new Map<string, string>(
                (bulkResult.unmatched ?? []).map((item) => [item.internalNo, item.reason]),
            )
            const duplicateByInternalNo = new Map<string, string>(
                (bulkResult.duplicates ?? []).map((item) => [item.internalNo, item.reason]),
            )
            const updatedByInternalNo = new Map<string, string>(
                (bulkResult.updated ?? []).map((item) => [item.deliveryNumber, item.deliveryNumber]),
            )

            const finalized = nextFiles.map((item) => {
                if (!item.internalNo) return item
                if (updatedByInternalNo.has(item.internalNo)) {
                    return {
                        ...item,
                        status: "matched" as const,
                        deliveryNumber: item.internalNo,
                        message: `Terpasang ke baris ${item.internalNo}`,
                    }
                }
                if (duplicateByInternalNo.has(item.internalNo)) {
                    return {
                        ...item,
                        status: "duplicate" as const,
                        message: duplicateByInternalNo.get(item.internalNo) || "Duplicate Internal No",
                    }
                }
                if (unmatchedByInternalNo.has(item.internalNo)) {
                    return {
                        ...item,
                        status: "unmatched" as const,
                        message: unmatchedByInternalNo.get(item.internalNo) || "Delivery tidak ditemukan",
                    }
                }
                return item
            })

            setFiles(finalized)
            setProgress(100)
            await queryClient.invalidateQueries({ queryKey: ["deliveries"] })

            toast.success(`${bulkResult.updatedCount} scan DO berhasil dipasang`, {
                description: (bulkResult.unmatchedCount ?? 0) > 0
                    ? `${bulkResult.unmatchedCount ?? 0} file belum menemukan baris delivery`
                    : "Semua file yang terdeteksi berhasil di-update",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={resetState}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ScanSearch className="mr-2 h-4 w-4" />
                    Bulk OCR Upload
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Bulk Upload Scan DO via OCR</DialogTitle>
                    <DialogDescription>
                        Upload banyak scan DO PDF. Sistem akan membaca <span className="font-medium">Internal No</span>, lalu otomatis mengisi file per baris delivery, set <span className="font-medium">Return Date</span> ke waktu upload, dan ubah status jadi <span className="font-medium">Returned</span>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <p className="font-medium">Pilih file scan DO</p>
                            <p className="text-sm text-muted-foreground">Format PDF, boleh banyak file sekaligus. Setiap file tetap akan dipasang ke satu baris delivery.</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                type="file"
                                accept="application/pdf"
                                multiple
                                className="hidden"
                                onChange={(event) => applyFiles(Array.from(event.target.files || []))}
                            />
                            <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={isProcessing}>
                                <Upload className="mr-2 h-4 w-4" />
                                Pilih PDF
                            </Button>
                            <Button type="button" onClick={processFiles} disabled={files.length === 0 || isProcessing}>
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}
                                {isProcessing ? "Memproses..." : "Proses OCR & Update"}
                            </Button>
                        </div>
                    </div>

                    {(isProcessing || progress > 0) && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} />
                            <p className="text-xs text-muted-foreground">{readyCount} / {files.length} file selesai dibaca</p>
                        </div>
                    )}

                    {summary?.success && (
                        <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-4">
                            <SummaryBox label="Berhasil" value={summary.updatedCount} tone="success" />
                            <SummaryBox label="Tidak Match" value={summary.unmatchedCount ?? 0} tone="warning" />
                            <SummaryBox label="Duplicate" value={summary.duplicateCount ?? 0} tone="warning" />
                            <SummaryBox label="Total File" value={summary.totalReceived ?? 0} tone="default" />
                        </div>
                    )}

                    <ScrollArea className="h-[320px] rounded-md border">
                        <div className="divide-y">
                            {files.length === 0 && (
                                <div className="p-6 text-sm text-muted-foreground">
                                    Belum ada file dipilih.
                                </div>
                            )}
                            {files.map((item) => (
                                <div key={item.id}>
                                    <div className="flex items-start justify-between gap-3 p-4">
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                <p className="truncate font-medium">{item.file.name}</p>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {item.internalNo ? `Internal No: ${item.internalNo}` : "Menunggu pembacaan Internal No"}
                                            </p>
                                            {item.message && (
                                                <p className="text-xs text-muted-foreground">{item.message}</p>
                                            )}
                                        </div>
                                        <StatusBadge status={item.status} />
                                    </div>
                                    {item.status === "unmatched" && item.fileUrl && (
                                        <div className="px-4 pb-4">
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <Select
                                                    value={manualSelections[item.id] ?? ""}
                                                    onValueChange={(value) => setManualSelections((prev) => ({ ...prev, [item.id]: value }))}
                                                    disabled={isProcessing || manualMatchingId === item.id}
                                                >
                                                    <SelectTrigger className="w-full sm:w-[250px]">
                                                        <SelectValue placeholder="Pilih Delivery/DO No untuk match manual" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {deliveryOptions.map((option) => (
                                                            <SelectItem key={option.id} value={String(option.id)}>
                                                                {option.deliveryNumber}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() => matchManual(item)}
                                                    disabled={isProcessing || manualMatchingId === item.id || !manualSelections[item.id]}
                                                >
                                                    {manualMatchingId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                    Matching Manual
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => resetState(false)} disabled={isProcessing}>
                        Tutup
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function StatusBadge({ status }: { status: UploadStatus }) {
    if (status === "matched") {
        return <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Matched</Badge>
    }
    if (status === "duplicate") {
        return <Badge variant="secondary">Duplicate</Badge>
    }
    if (status === "unmatched") {
        return <Badge variant="secondary">Unmatched</Badge>
    }
    if (status === "failed") {
        return <Badge variant="destructive" className="gap-1"><CircleAlert className="h-3 w-3" />Failed</Badge>
    }
    if (status === "uploading" || status === "ocr") {
        return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Processing</Badge>
    }
    return <Badge variant="outline">Pending</Badge>
}

function SummaryBox({
    label,
    value,
    tone,
}: {
    label: string
    value: number
    tone: "success" | "warning" | "default"
}) {
    const toneClass = tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-border bg-background text-foreground"

    return (
        <div className={`rounded-md border p-3 ${toneClass}`}>
            <p className="text-xs uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
        </div>
    )
}
