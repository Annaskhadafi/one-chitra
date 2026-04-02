"use client"

import Image from "next/image"
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getDeliveries, updateDoMonitoringFields } from "@/app/actions/delivery"
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
import { Upload, FileText, CheckCircle2, CircleAlert, Loader2, Eye, Check, ChevronsUpDown, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { isUploadImageFile, resolveUploadDocumentUrl } from "@/lib/upload-url"

type UploadStatus = "pending" | "uploading" | "matched" | "unmatched" | "duplicate" | "failed"

type DeliveryOption = {
    id: number
    deliveryNumber: string
    doSap?: string | null
    customerName: string
    invoiceNumber: string
}

type UploadItem = {
    id: string
    file: File
    fileUrl?: string
    status: UploadStatus
    message?: string
    deliveryNumber?: string
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
                doSap: delivery.doSap || null,
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
            setPreviewItemId(null)
        }
    }

    async function applyFiles(selectedFiles: File[]) {
        const valid = selectedFiles.filter((file) => file.type === "application/pdf")
        if (valid.length !== selectedFiles.length) {
            toast.error("Hanya file PDF yang bisa di-upload")
        }

        if (valid.length === 0) {
            setFiles([])
            setManualSelections({})
            setPreviewItemId(null)
            setProgress(0)
            setSummary(null)
            return
        }

        const preparedFiles = valid.map((file, index) => ({
            id: `${file.name}-${file.size}-${index}`,
            file,
            status: "pending" as const,
        }))

        setSummary(null)
        setProgress(0)
        setFiles(preparedFiles)
        setManualSelections({})
        setPreviewItemId(preparedFiles[0]?.id ?? null)

        await processFiles(preparedFiles)
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

    async function processFiles(inputFiles?: UploadItem[]) {
        const filesToProcess = inputFiles ?? files
        if (filesToProcess.length === 0 || isProcessing) return

        setIsProcessing(true)
        setSummary(null)

        const nextFiles = [...filesToProcess]

        try {
            for (let index = 0; index < nextFiles.length; index++) {
                const current = nextFiles[index]
                nextFiles[index] = { ...current, status: "uploading", message: "Mengunggah dokumen..." }
                setFiles([...nextFiles])
                setProgress(Math.round((index / nextFiles.length) * 40))

                const formData = new FormData()
                formData.append("file", current.file)

                const response = await fetch("/api/uploads", {
                    method: "POST",
                    body: formData,
                })

                const body = await response.json() as {
                    success?: boolean
                    error?: string
                    url?: string
                }

                if (!response.ok || !body.success || body?.error || !body.url) {
                    nextFiles[index] = {
                        ...nextFiles[index],
                        status: "failed",
                        message: body?.error || "Upload dokumen gagal",
                    }
                    setFiles([...nextFiles])
                    setProgress(Math.round(((index + 1) / nextFiles.length) * 100))
                    continue
                }

                nextFiles[index] = {
                    ...nextFiles[index],
                    fileUrl: body.url,
                    status: "unmatched",
                    message: "Dokumen siap dipreview. Pilih Delivery/DO No untuk manual matching.",
                    saved: false,
                }
                setFiles([...nextFiles])
                setPreviewItemId((current) => current ?? nextFiles[index].id)
                setProgress(Math.round(((index + 1) / nextFiles.length) * 100))
            }

            setProgress(100)
            toast.success("Upload selesai. Review preview, lakukan manual matching, lalu klik Save.")
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
        setPreviewItemId(item.id)
    }

    const previewUrl = resolveUploadDocumentUrl(previewItem?.fileUrl)
    const previewTargetDeliveryId = previewItem ? resolveTargetDeliveryId(previewItem, manualSelections) : null
    const previewTargetDelivery = previewTargetDeliveryId
        ? deliveryOptions.find((delivery) => delivery.id === previewTargetDeliveryId) || null
        : null

    return (
        <Dialog open={open} onOpenChange={resetState}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Bulk Upload
                </Button>
            </DialogTrigger>
            <DialogContent className="flex h-[92vh] w-[96vw] max-w-[96vw] flex-col overflow-hidden p-0 sm:h-[94vh] sm:w-[94vw] sm:max-w-[94vw] xl:w-[1400px] xl:max-w-[1400px]">
                <DialogHeader>
                    <div className="border-b px-6 pt-6 pb-4">
                    <DialogTitle>Bulk Upload Scan DO</DialogTitle>
                    <DialogDescription className="mt-1">
                        Upload banyak PDF scan DO, tampilkan preview dokumen, lalu lakukan <span className="font-medium">manual matching</span> di panel atas sebelum simpan.
                    </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
                    {summary?.success && (
                        <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-4">
                            <SummaryBox label="Berhasil" value={summary.updatedCount} tone="success" />
                            <SummaryBox label="Tidak Match" value={summary.unmatchedCount ?? 0} tone="warning" />
                            <SummaryBox label="Duplicate" value={summary.duplicateCount ?? 0} tone="warning" />
                            <SummaryBox label="Total File" value={summary.totalReceived ?? 0} tone="default" />
                        </div>
                    )}

                    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,2.7fr)_360px]">
                        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
                            {previewItem && (
                                <>
                                    <div className="flex items-center justify-between gap-3 border-b bg-muted/10 px-4 py-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{previewItem.file.name}</p>
                                            {previewTargetDelivery && (
                                                <p className="truncate text-[11px] font-medium text-emerald-700">
                                                    {formatDeliveryLabel(previewTargetDelivery)}
                                                </p>
                                            )}
                                        </div>
                                        {previewUrl ? (
                                            <div className="shrink-0">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => window.open(previewUrl, "_blank")}
                                                >
                                                    <ExternalLink className="mr-2 h-4 w-4" />
                                                    Buka Tab Baru
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="relative min-h-[640px] flex-1 bg-muted/20">
                                        {previewUrl ? (
                                            isUploadImageFile(previewUrl) || !previewUrl.toLowerCase().endsWith(".pdf") ? (
                                                <div className="flex h-full items-center justify-center p-4">
                                                    <Image
                                                        src={previewUrl}
                                                        alt={previewItem.file.name}
                                                        width={1200}
                                                        height={900}
                                                        unoptimized
                                                        className="max-h-full max-w-full rounded border bg-white object-contain shadow-sm"
                                                    />
                                                </div>
                                            ) : (
                                                <iframe
                                                    src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                                                    className="absolute inset-0 h-full w-full border-0"
                                                    title={`Preview ${previewItem.file.name}`}
                                                />
                                            )
                                        ) : (
                                            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                                                <Eye className="h-8 w-8 opacity-40" />
                                                <p className="text-sm font-medium">Dokumen belum siap dipreview</p>
                                                <p className="text-xs">Pilih file PDF, lalu sistem akan upload dan menampilkan preview otomatis.</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                            {!previewItem && (
                                <div className="flex h-full min-h-[640px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                                    <Eye className="h-8 w-8 opacity-40" />
                                    <p className="text-sm font-medium">Belum ada dokumen dipilih</p>
                                    <p className="text-xs">Upload PDF lalu pilih dokumen dari panel kanan untuk melihat preview.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
                            <div className="space-y-4 border-b bg-muted/10 px-4 py-4">
                                <div className="space-y-1">
                                    <p className="text-lg font-semibold">Upload Bulk DO</p>
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
                                    <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={isProcessing} className="flex-1">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Pilih PDF
                                    </Button>
                                    <Button type="button" onClick={saveMatches} disabled={isProcessing || pendingSaveCount === 0}>
                                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Save
                                    </Button>
                                </div>
                                {(isProcessing || progress > 0) && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Progress</span>
                                            <span className="font-medium">{progress}%</span>
                                        </div>
                                        <Progress value={progress} />
                                        <p className="text-xs text-muted-foreground">{readyCount} / {files.length} file selesai di-upload</p>
                                    </div>
                                )}
                            </div>
                            <div className="border-b bg-muted/20 px-4 py-3">
                                <p className="text-sm font-medium">Daftar Dokumen</p>
                            </div>
                            {previewItem && (
                                <div className="space-y-3 border-b px-4 py-4">
                                    <div className="space-y-1">
                                        <p className="truncate text-sm font-medium">{previewItem.file.name}</p>
                                    </div>
                                    <DeliveryMatchPicker
                                        value={manualSelections[previewItem.id] ?? ""}
                                        options={deliveryOptions}
                                        onValueChange={(value) => setManualSelections((prev) => ({ ...prev, [previewItem.id]: value }))}
                                        disabled={isProcessing || manualMatchingId === previewItem.id}
                                        placeholder="Cari Delivery/DO No"
                                        triggerClassName="w-full"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => matchManual(previewItem)}
                                            disabled={isProcessing || manualMatchingId === previewItem.id || !manualSelections[previewItem.id]}
                                        >
                                            {manualMatchingId === previewItem.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Matching Manual
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={saveMatches}
                                            disabled={isProcessing || pendingSaveCount === 0}
                                        >
                                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Save {pendingSaveCount > 0 ? `(${pendingSaveCount})` : ""}
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <ScrollArea className="min-h-0 flex-1">
                                <div className="divide-y">
                                    {files.length === 0 && (
                                        <div className="p-6 text-sm text-muted-foreground">
                                            Belum ada file dipilih.
                                        </div>
                                    )}
                                    {files.map((item) => (
                                        <div key={item.id}>
                                            <button
                                                type="button"
                                                onClick={() => openPreview(item)}
                                                className={cn(
                                                    "flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40",
                                                    previewItemId === item.id ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : "bg-transparent",
                                                )}
                                            >
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                                        <p className="truncate font-medium">{item.file.name}</p>
                                                    </div>
                                                    {item.mappedDeliveryLabel && (
                                                        <p className="text-xs font-medium text-emerald-700">
                                                            Mapping Delivery: {item.mappedDeliveryLabel}
                                                        </p>
                                                    )}
                                                </div>
                                                <StatusBadge status={item.status} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t px-6 py-4">
                    <Button variant="outline" onClick={() => resetState(false)} disabled={isProcessing}>
                        Tutup
                    </Button>
                </DialogFooter>
            </DialogContent>
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
                                    value={`${option.deliveryNumber} ${option.doSap || ""} ${option.customerName} ${option.invoiceNumber}`}
                                    onSelect={() => {
                                        onValueChange(String(option.id))
                                        setOpen(false)
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === String(option.id) ? "opacity-100" : "opacity-0")} />
                                    <div className="flex min-w-0 flex-col">
                                        <span className="font-medium">{option.deliveryNumber}</span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {[
                                                option.doSap ? `DO SAP ${option.doSap}` : null,
                                                option.customerName,
                                                option.invoiceNumber !== "-" ? `Inv ${option.invoiceNumber}` : null,
                                            ].filter(Boolean).join(" • ")}
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

function formatDeliveryLabel(delivery: DeliveryOption) {
    const parts = [
        delivery.deliveryNumber,
        delivery.doSap ? `DO SAP ${delivery.doSap}` : null,
        delivery.customerName !== "-" ? delivery.customerName : null,
        delivery.invoiceNumber !== "-" ? `Inv ${delivery.invoiceNumber}` : null,
    ].filter(Boolean)

    return parts.join(" • ")
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
    if (status === "uploading") {
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
