"use client"

import { useMemo, useState } from "react"
import { Plus, Upload, FileText, X } from "lucide-react"
import { ProgressLoading } from "@/components/ui/progress-loading"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createSalesDocument } from "@/app/actions/sales-document"
import { toast } from "sonner"

interface UploadDialogProps {
    onSuccess?: () => void
}

type PendingUploadItem = {
    id: string
    file: File
    title: string
    description: string
}

function getDefaultTitle(fileName: string) {
    const lastDotIndex = fileName.lastIndexOf(".")
    return lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName
}

export function UploadDialog({ onSuccess }: UploadDialogProps = {}) {
    const [open, setOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [items, setItems] = useState<PendingUploadItem[]>([])

    const selectedCount = items.length

    const canSubmit = useMemo(() => {
        if (items.length === 0) return false
        return items.every((item) => item.title.trim().length > 0)
    }, [items])

    function resetState() {
        setItems([])
        setIsUploading(false)
    }

    function upsertFiles(fileList: FileList | null) {
        if (!fileList?.length) return

        const nextItems = Array.from(fileList).map((file) => ({
            id: crypto.randomUUID(),
            file,
            title: getDefaultTitle(file.name),
            description: "",
        }))

        setItems((current) => [...current, ...nextItems])
    }

    function updateItem(id: string, patch: Partial<Pick<PendingUploadItem, "title" | "description">>) {
        setItems((current) =>
            current.map((item) => (item.id === id ? { ...item, ...patch } : item))
        )
    }

    function removeItem(id: string) {
        setItems((current) => current.filter((item) => item.id !== id))
    }

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen)
        if (!nextOpen && !isUploading) {
            resetState()
        }
    }

    async function onSubmit() {
        if (!canSubmit) {
            toast.error("Pastikan semua file punya title")
            return
        }

        setIsUploading(true)
        try {
            let successCount = 0
            const failures: string[] = []

            for (const item of items) {
                const formData = new FormData()
                formData.append("file", item.file)

                const uploadResponse = await fetch("/api/sales-documents/upload", {
                    method: "POST",
                    body: formData,
                })

                const uploadResult = await uploadResponse.json() as {
                    success: boolean
                    url?: string
                    error?: string
                }

                if (!uploadResult.success || !uploadResult.url) {
                    failures.push(`${item.file.name}: ${uploadResult.error || "Upload failed"}`)
                    continue
                }

                const docResult = await createSalesDocument({
                    title: item.title.trim(),
                    description: item.description.trim() || null,
                    fileUrl: uploadResult.url,
                    fileName: item.file.name,
                    fileType: item.file.type,
                })

                if (!docResult.success) {
                    failures.push(`${item.file.name}: ${docResult.error || "Failed to save document info"}`)
                    continue
                }

                successCount++
            }

            if (successCount > 0) {
                toast.success(
                    failures.length > 0
                        ? `${successCount} document berhasil diupload. ${failures.slice(0, 2).join("; ")}${failures.length > 2 ? `; +${failures.length - 2} lainnya` : ""}`
                        : `${successCount} document berhasil diupload`
                )
                setOpen(false)
                resetState()
                onSuccess?.()
                return
            }

            throw new Error(failures[0] || "Upload failed")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="font-bold">
                    <Plus className="w-4 h-4 mr-2" />
                    Upload Document
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px]">
                <DialogHeader>
                    <DialogTitle>Upload Sales Document</DialogTitle>
                    <DialogDescription>
                        Upload multiple files sekaligus. Title otomatis mengikuti nama file dan bisa Anda edit sebelum disimpan.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {isUploading ? (
                        <div className="py-2">
                            <ProgressLoading message={`Uploading ${selectedCount} file...`} />
                        </div>
                    ) : (
                        <div
                            className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => document.getElementById("file-upload")?.click()}
                        >
                            <Upload className="w-8 h-8 text-muted-foreground" />
                            <span className="text-sm font-medium">Click untuk pilih satu atau banyak file</span>
                            <span className="text-xs text-muted-foreground">PDF, Excel, CSV, DOC, DOCX</span>
                            <Input
                                id="file-upload"
                                type="file"
                                className="hidden"
                                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                                multiple
                                onChange={(e) => {
                                    upsertFiles(e.target.files)
                                    e.currentTarget.value = ""
                                }}
                            />
                        </div>
                    )}

                    {items.length > 0 && (
                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                            {items.map((item, index) => (
                                <div key={item.id} className="rounded-lg border p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                <FileText className="w-4 h-4 shrink-0" />
                                                <span className="truncate">{item.file.name}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                File {index + 1} dari {items.length}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() => removeItem(item.id)}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Title</label>
                                        <Input
                                            value={item.title}
                                            onChange={(e) => updateItem(item.id, { title: e.target.value })}
                                            placeholder="Masukkan title document"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Description (Optional)</label>
                                        <Textarea
                                            value={item.description}
                                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                                            placeholder="Briefly describe the contents of this document..."
                                            className="resize-none"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-2">
                        <p className="text-sm text-muted-foreground">
                            {selectedCount > 0 ? `${selectedCount} file siap diupload` : "Belum ada file dipilih"}
                        </p>
                        <Button type="button" disabled={isUploading || !canSubmit} onClick={onSubmit}>
                            {isUploading ? "Uploading..." : `Save ${selectedCount > 1 ? `${selectedCount} Documents` : "Document"}`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
