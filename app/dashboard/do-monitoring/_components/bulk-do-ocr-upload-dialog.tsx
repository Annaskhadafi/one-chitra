"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getDeliveries, updateDoMonitoringFields } from "@/app/actions/delivery"
import { triggerDoScanOcrFast } from "@/app/actions/ocr-fast"
import { ScanDoPreview } from "./scan-do-preview"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Upload, ScanSearch, FileText, CheckCircle2, CircleAlert, Loader2, Eye, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

type UploadStatus = "pending" | "uploading" | "ocr" | "matched" | "unmatched" | "duplicate" | "failed"
type DetectionSource = "label" | "pattern" | "none"

type DeliveryOption = {
    id: number
    deliveryNumber: string
    customerName: string
    invoiceNumber: string
}

type DeliveryOrderBoxFields = {
    page?: string | null
    deliveryNo?: string | null
    internalNo?: string | null
    deliveryDate?: string | null
    customerPoNo?: string | null
    customerPoDate?: string | null
}

type UploadItem = {
    id: string
    file: File
    fileUrl?: string
    internalNo?: string | null
    status: UploadStatus
    message?: string
    deliveryNumber?: string
    detectionSource?: DetectionSource
    rawText?: string
    fields?: DeliveryOrderBoxFields
    ocrModel?: string
    pagesProcessed?: number
    mappedDeliveryId?: number
    mappedDeliveryLabel?: string
    saved?: boolean
}

type SaveSummary = {
    success: boolean
    updatedCount: number
    unmatchedCount: number
    duplicateCount: number
    totalReceived: number
}

export function BulkDoOcrUploadDialog() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [open, setOpen] = useState(false)
    const [files, setFiles] = useState<UploadItem[]>([])
    const [isProcessing, setIsProcessing] = useState(false)
    const [manualMatchingId, setManualMatchingId] = useState<string | null>(null)
    const [manualSelections, setManualSelections] = useState<Record<string, string>>({})
    const [progress, setProgress] = useState(0)
    const [summary, setSummary] = useState<SaveSummary | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewLabel, setPreviewLabel] = useState<string | null>(null)
    const [previewItemId, setPreviewItemId] = useState<string | null>(null)

    const { data: deliveries = [] } = useQuery({
        queryKey: ["deliveries"],
        queryFn: () => getDeliveries(),
        staleTime: 60 * 1000,
    })

    const deliveryOptions = useMemo(
        () => deliveries
            .filter((delivery) => delivery.deliveryNumber)
            .map((delivery) => ({
                id: delivery.id,
                deliveryNumber: delivery.deliveryNumber || "-",
                customerName: delivery.salesOrder?.customer?.name || "-",
                invoiceNumber: delivery.invoiceNumber || "-",
            }))
            .sort((a, b) => a.deliveryNumber.localeCompare(b.deliveryNumber)),
        [deliveries],
    )

    const readyCount = useMemo(
        () => files.filter((file) => file.status === "matched" || file.status === "unmatched" || file.status === "failed").length,
        [files],
    )

    const pendingSaveCount = useMemo(
        () => files.filter((file) => file.fileUrl && !file.saved && resolveTargetDeliveryId(file, manualSelections)).length,
        [files, manualSelections],
    )

    function resetState(nextOpen: boolean) {
        setOpen(nextOpen)
        if (!nextOpen && !isProcessing) {
            setFiles([])
            setManualSelections({})
            setManualMatchingId(null)
            setProgress(0)
            setSummary(null)
            setPreviewUrl(null)
            setPreviewLabel(null)
            setPreviewItemId(null)
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
            setFiles((prev) => prev.map((entry) => entry.id === item.id
                ? {
                    ...entry,
                    mappedDeliveryId: selectedDelivery.id,
                    mappedDeliveryLabel: formatDeliveryLabel(selectedDelivery),
                    deliveryNumber: selectedDelivery.deliveryNumber,
                    status: "matched",
                    saved: false,
                    message: `Matched manual ke ${selectedDelivery.deliveryNumber}. Klik Save untuk menyimpan.`,
                }
                : entry))

            toast.success(`Matching manual untuk ${item.file.name} sudah disiapkan`)
        } finally {
            setManualMatchingId(null)
        }
    }

    async function processFiles() {
        if (files.length === 0 || isProcessing) return

        setIsProcessing(true)
        setSummary(null)

        const nextFiles = [...files]

        try {
            for (let index = 0; index < nextFiles.length; index++) {
                const current = nextFiles[index]
                nextFiles[index] = { ...current, status: "uploading", message: "Upload & OCR cepat..." }
                setFiles([...nextFiles])
                setProgress(Math.round((index / nextFiles.length) * 40))

                const formData = new FormData()
                formData.append("file", current.file)

                const body = await triggerDoScanOcrFast(formData) as {
                    success?: boolean
                    error?: string
                    fileUrl?: string
                    internalNo?: string | null
                    detectionSource?: DetectionSource
                    rawText?: string
                    fields?: DeliveryOrderBoxFields
                    model?: string
                    pagesProcessed?: number
                }

                if (!body.success || body?.error || !body.fileUrl) {
                    nextFiles[index] = {
                        ...nextFiles[index],
                        status: "failed",
                        message: body?.error || "OCR gagal diproses / timeout",
                        rawText: body?.rawText,
                        fields: body?.fields,
                        ocrModel: body?.model,
                        pagesProcessed: body?.pagesProcessed,
                    }
                    setFiles([...nextFiles])
                    setProgress(Math.round(((index + 1) / nextFiles.length) * 100))
                    continue
                }

                const mappedDelivery = body?.internalNo
                    ? findDeliveryMatch(deliveryOptions, body.internalNo)
                    : null

                if (!body?.internalNo) {
                    nextFiles[index] = {
                        ...nextFiles[index],
                        fileUrl: body.fileUrl,
                        status: "unmatched",
                        message: "Internal No tidak ditemukan di dokumen",
                        rawText: body?.rawText,
                        fields: body?.fields,
                        detectionSource: body?.detectionSource,
                        ocrModel: body?.model,
                        pagesProcessed: body?.pagesProcessed,
                    }
                    setFiles([...nextFiles])
                    setProgress(Math.round(((index + 1) / nextFiles.length) * 100))
                    continue
                }

                nextFiles[index] = {
                    ...nextFiles[index],
                    fileUrl: body.fileUrl,
                    internalNo: body.internalNo,
                    status: "matched",
                    message: mappedDelivery
                        ? `Internal No terdeteksi: ${body.internalNo}. Match ke ${mappedDelivery.deliveryNumber}. Klik Save untuk menyimpan.`
                        : `Internal No terdeteksi: ${body.internalNo}`,
                    detectionSource: body?.detectionSource,
                    rawText: body?.rawText,
                    fields: body?.fields,
                    ocrModel: body?.model,
                    pagesProcessed: body?.pagesProcessed,
                    mappedDeliveryId: mappedDelivery?.id,
                    mappedDeliveryLabel: mappedDelivery ? formatDeliveryLabel(mappedDelivery) : undefined,
                    saved: false,
                }
                if (mappedDelivery) {
                    setManualSelections((prev) => ({ ...prev, [current.id]: String(mappedDelivery.id) }))
                }
                setFiles([...nextFiles])
                setProgress(Math.round(((index + 1) / nextFiles.length) * 100))
            }

            setProgress(100)
            toast.success("OCR selesai. Review hasil match lalu klik Save untuk menyimpan.")
        } finally {
            setIsProcessing(false)
        }
    }

    async function saveMatches() {
        const candidateFiles = files.filter((item) => item.fileUrl && !item.saved)
        if (candidateFiles.length === 0) {
            toast.error("Tidak ada hasil matching yang perlu disimpan")
            return
        }

        setSummary(null)
        setIsProcessing(true)

        let updatedCount = 0
        let unmatchedCount = 0
        let duplicateCount = 0
        const usedDeliveryIds = new Set<number>()
        let nextFiles = [...files]

        try {
            for (const item of candidateFiles) {
                const selectedDeliveryId = resolveTargetDeliveryId(item, manualSelections)
                if (!selectedDeliveryId) {
                    unmatchedCount += 1
                    nextFiles = nextFiles.map((entry) => entry.id === item.id
                        ? { ...entry, status: "unmatched", message: "Pilih Delivery/DO No dulu sebelum Save." }
                        : entry)
                    setFiles(nextFiles)
                    continue
                }

                if (usedDeliveryIds.has(selectedDeliveryId)) {
                    duplicateCount += 1
                    nextFiles = nextFiles.map((entry) => entry.id === item.id
                        ? { ...entry, status: "duplicate", message: "Duplicate target delivery pada batch Save ini." }
                        : entry)
                    setFiles(nextFiles)
                    continue
                }

                usedDeliveryIds.add(selectedDeliveryId)
                const selectedDelivery = deliveryOptions.find((delivery) => delivery.id === selectedDeliveryId) || null
                const result = await updateDoMonitoringFields(selectedDeliveryId, {
                    scanDoDocument: item.fileUrl || null,
                    returnDoDate: new Date(),
                    doStatus: "Returned",
                })

                if (!result.success) {
                    unmatchedCount += 1
                    nextFiles = nextFiles.map((entry) => entry.id === item.id
                        ? { ...entry, status: "failed", message: result.error || "Gagal menyimpan matching." }
                        : entry)
                    setFiles(nextFiles)
                    continue
                }

                updatedCount += 1
                nextFiles = nextFiles.map((entry) => entry.id === item.id
                    ? {
                        ...entry,
                        status: "matched",
                        saved: true,
                        mappedDeliveryId: selectedDeliveryId,
                        mappedDeliveryLabel: selectedDelivery ? formatDeliveryLabel(selectedDelivery) : entry.mappedDeliveryLabel,
                        deliveryNumber: selectedDelivery?.deliveryNumber || entry.deliveryNumber,
                        message: selectedDelivery
                            ? `Tersimpan ke ${formatDeliveryLabel(selectedDelivery)}`
                            : "Matching berhasil disimpan",
                    }
                    : entry)
                setFiles(nextFiles)
            }

            setSummary({
                success: true,
                updatedCount,
                unmatchedCount,
                duplicateCount,
                totalReceived: candidateFiles.length,
            })

            await queryClient.invalidateQueries({ queryKey: ["deliveries"] })

            toast.success(`${updatedCount} file berhasil disimpan`, {
                description: unmatchedCount > 0 || duplicateCount > 0
                    ? `${unmatchedCount} belum tersimpan, ${duplicateCount} duplicate`
                    : "Semua matching pada batch ini sudah tersimpan",
            })

            if (updatedCount > 0) {
                resetState(false)
                router.push("/dashboard/do-monitoring")
                router.refresh()
            }
        } finally {
            setIsProcessing(false)
        }
    }

    const previewItem = useMemo(
        () => files.find((item) => item.id === previewItemId) || null,
        [files, previewItemId],
    )

    function openPreview(item: UploadItem) {
        setPreviewUrl(item.fileUrl || null)
        setPreviewLabel(item.mappedDeliveryLabel || item.internalNo || item.file.name)
        setPreviewItemId(item.id)
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
                                {isProcessing ? "Memproses..." : "Proses OCR"}
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
                                            {item.mappedDeliveryLabel && (
                                                <p className="text-xs font-medium text-emerald-700">
                                                    Mapping Delivery: {item.mappedDeliveryLabel}
                                                </p>
                                            )}
                                            {(item.ocrModel || item.pagesProcessed || item.detectionSource) && (
                                                <p className="text-[11px] text-muted-foreground">
                                                    {[
                                                        item.ocrModel ? `Model: ${item.ocrModel}` : null,
                                                        typeof item.pagesProcessed === "number" ? `Halaman: ${item.pagesProcessed}` : null,
                                                        item.detectionSource ? `Deteksi: ${item.detectionSource}` : null,
                                                    ].filter(Boolean).join(" • ")}
                                                </p>
                                            )}
                                            {item.message && (
                                                <p className="text-xs text-muted-foreground">{item.message}</p>
                                            )}
                                            {item.fields && hasAnyField(item.fields) && (
                                                <div className="rounded-md border bg-emerald-50/50 p-2 text-[11px]">
                                                    <p className="mb-1 font-medium text-emerald-800">Extract Delivery Order Box</p>
                                                    <div className="grid gap-1 sm:grid-cols-2">
                                                        {renderField("Page", item.fields.page)}
                                                        {renderField("Delivery No", item.fields.deliveryNo)}
                                                        {renderField("Internal No", item.fields.internalNo)}
                                                        {renderField("Delivery Date", item.fields.deliveryDate)}
                                                        {renderField("Customer PO No", item.fields.customerPoNo)}
                                                        {renderField("Customer PO Date", item.fields.customerPoDate)}
                                                    </div>
                                                </div>
                                            )}
                                            {item.rawText && (
                                                <details className="rounded-md border bg-muted/20 p-2 text-xs">
                                                    <summary className="cursor-pointer font-medium text-foreground">
                                                        Lihat hasil extract OCR box
                                                    </summary>
                                                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
                                                        {item.rawText}
                                                    </pre>
                                                </details>
                                            )}
                                        </div>
                                        <StatusBadge status={item.status} />
                                    </div>
                                    {item.fileUrl && (
                                        <div className="px-4 pb-4">
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => openPreview(item)}
                                                    disabled={isProcessing && !item.fileUrl}
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    View
                                                </Button>
                                                <DeliveryMatchPicker
                                                    value={manualSelections[item.id] ?? ""}
                                                    options={deliveryOptions}
                                                    onValueChange={(value) => setManualSelections((prev) => ({ ...prev, [item.id]: value }))}
                                                    disabled={isProcessing || manualMatchingId === item.id}
                                                    placeholder="Cari Delivery/DO No"
                                                />
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
                    {pendingSaveCount > 0 && (
                        <Button onClick={saveMatches} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save {pendingSaveCount > 0 ? `(${pendingSaveCount})` : ""}
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => resetState(false)} disabled={isProcessing}>
                        Tutup
                    </Button>
                </DialogFooter>
            </DialogContent>

            <ScanDoPreview
                open={Boolean(previewUrl)}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setPreviewUrl(null)
                        setPreviewLabel(null)
                        setPreviewItemId(null)
                    }
                }}
                url={previewUrl}
                deliveryNumber={previewLabel}
                headerActions={previewItem?.fileUrl ? (
                    <div className="flex items-center gap-2">
                        <DeliveryMatchPicker
                            value={manualSelections[previewItem.id] ?? ""}
                            options={deliveryOptions}
                            onValueChange={(value) => setManualSelections((prev) => ({ ...prev, [previewItem.id]: value }))}
                            disabled={isProcessing || manualMatchingId === previewItem.id}
                            placeholder="Cari Delivery/DO No"
                            triggerClassName="w-[280px]"
                        />
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => matchManual(previewItem)}
                            disabled={isProcessing || manualMatchingId === previewItem.id || !manualSelections[previewItem.id]}
                        >
                            {manualMatchingId === previewItem.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Matching Manual
                        </Button>
                    </div>
                ) : null}
            />
        </Dialog>
    )
}

function DeliveryMatchPicker({
    value,
    options,
    onValueChange,
    disabled,
    placeholder,
    triggerClassName,
}: {
    value: string
    options: DeliveryOption[]
    onValueChange: (value: string) => void
    disabled?: boolean
    placeholder?: string
    triggerClassName?: string
}) {
    const [open, setOpen] = useState(false)
    const selected = options.find((option) => String(option.id) === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn("w-full justify-between sm:w-[280px]", triggerClassName)}
                >
                    <span className="truncate">
                        {selected ? formatDeliveryLabel(selected) : (placeholder || "Cari Delivery/DO No")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search DO Number / Customer..." />
                    <CommandList>
                        <CommandEmpty>Delivery tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.id}
                                    value={`${option.deliveryNumber} ${option.customerName} ${option.invoiceNumber}`}
                                    onSelect={() => {
                                        onValueChange(String(option.id))
                                        setOpen(false)
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === String(option.id) ? "opacity-100" : "opacity-0")} />
                                    <div className="flex min-w-0 flex-col">
                                        <span className="font-medium">{option.deliveryNumber}</span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {option.customerName}{option.invoiceNumber !== "-" ? ` • Inv ${option.invoiceNumber}` : ""}
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function resolveTargetDeliveryId(item: UploadItem, manualSelections: Record<string, string>) {
    const manualSelection = Number(manualSelections[item.id] || "")
    if (manualSelection) {
        return manualSelection
    }
    return item.mappedDeliveryId || null
}

function findDeliveryMatch(deliveryOptions: DeliveryOption[], internalNo: string) {
    const normalizedTarget = normalizeDeliveryNumber(internalNo)
    return deliveryOptions.find((delivery) => normalizeDeliveryNumber(delivery.deliveryNumber) === normalizedTarget) || null
}

function normalizeDeliveryNumber(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function formatDeliveryLabel(delivery: DeliveryOption) {
    const parts = [
        delivery.deliveryNumber,
        delivery.customerName !== "-" ? delivery.customerName : null,
        delivery.invoiceNumber !== "-" ? `Inv ${delivery.invoiceNumber}` : null,
    ].filter(Boolean)

    return parts.join(" • ")
}

function hasAnyField(fields: DeliveryOrderBoxFields) {
    return Boolean(
        fields.page ||
        fields.deliveryNo ||
        fields.internalNo ||
        fields.deliveryDate ||
        fields.customerPoNo ||
        fields.customerPoDate,
    )
}

function renderField(label: string, value: string | null | undefined) {
    return (
        <div key={label} className="rounded border bg-white/80 px-2 py-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="font-mono text-[11px] text-foreground">{value || "-"}</p>
        </div>
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
