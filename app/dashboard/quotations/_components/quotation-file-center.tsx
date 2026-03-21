"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createQuotationAttachment, deleteQuotationAttachment, uploadQuotationCustomerPo } from "@/app/actions/quotation"
import { uploadFile } from "@/app/actions/upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { FileStack, Loader2, Paperclip, Trash2, UploadCloud } from "lucide-react"

type AttachmentEntry = {
    id: number
    kind: string
    title: string
    fileUrl: string
    fileName: string
    mimeType: string | null
    fileSize: number
    description: string | null
    includeInPdf: boolean
    createdAt: Date
    uploadedByUser?: {
        name?: string | null
        email?: string | null
    } | null
}

interface QuotationFileCenterProps {
    quotationId: number
    quotationNumber: string | null
    salesOrderId: number | null
    customerPoNumber: string | null
    customerPoDocument: string | null
    attachments: AttachmentEntry[]
}

function formatFileSize(size: number) {
    if (!size) {
        return "0 B"
    }
    const units = ["B", "KB", "MB", "GB"]
    let value = size
    let unitIndex = 0
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024
        unitIndex += 1
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function QuotationFileCenter({
    quotationId,
    quotationNumber,
    salesOrderId,
    customerPoNumber,
    customerPoDocument,
    attachments,
}: QuotationFileCenterProps) {
    const router = useRouter()
    const [attachmentTitle, setAttachmentTitle] = useState("")
    const [attachmentDescription, setAttachmentDescription] = useState("")
    const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
    const [includeInPdf, setIncludeInPdf] = useState(true)
    const [poNumber, setPoNumber] = useState(customerPoNumber || "")
    const [poFile, setPoFile] = useState<File | null>(null)
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
    const [isUploadingPo, setIsUploadingPo] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)

    const supportingAttachments = attachments.filter((attachment) => attachment.kind !== "customer_po")
    const poAttachments = attachments.filter((attachment) => attachment.kind === "customer_po")

    const handleUploadAttachment = async () => {
        if (!attachmentFile) {
            toast.error("Pilih file attachment terlebih dahulu")
            return
        }

        setIsUploadingAttachment(true)
        try {
            const formData = new FormData()
            formData.append("file", attachmentFile)

            const uploadResult = await uploadFile(formData)
            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.error || "Upload attachment gagal")
            }

            const saveResult = await createQuotationAttachment({
                quotationId,
                title: attachmentTitle.trim() || attachmentFile.name,
                fileUrl: uploadResult.url,
                fileName: attachmentFile.name,
                mimeType: attachmentFile.type || null,
                fileSize: attachmentFile.size,
                description: attachmentDescription.trim() || null,
                includeInPdf,
                kind: "supporting",
            })

            if (!saveResult.success) {
                throw new Error(saveResult.error || "Attachment gagal disimpan")
            }

            toast.success("Attachment quotation berhasil ditambahkan")
            setAttachmentTitle("")
            setAttachmentDescription("")
            setAttachmentFile(null)
            setIncludeInPdf(true)
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Attachment gagal diupload")
        } finally {
            setIsUploadingAttachment(false)
        }
    }

    const handleUploadPo = async () => {
        if (!poNumber.trim()) {
            toast.error("Nomor PO wajib diisi")
            return
        }
        if (!poFile) {
            toast.error("File PO wajib diupload")
            return
        }

        setIsUploadingPo(true)
        try {
            const formData = new FormData()
            formData.append("file", poFile)

            const uploadResult = await uploadFile(formData)
            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.error || "Upload PO gagal")
            }

            const result = await uploadQuotationCustomerPo({
                quotationId,
                poNumber: poNumber.trim(),
                fileUrl: uploadResult.url,
                fileName: poFile.name,
                mimeType: poFile.type || null,
                fileSize: poFile.size,
            })

            if (!result.success) {
                throw new Error(result.error || "PO gagal disimpan")
            }

            toast.success(("autoConverted" in result && result.autoConverted) ? "PO tersimpan dan quotation otomatis dikonversi ke Sales Order" : "PO berhasil diupload")
            setPoFile(null)
            router.refresh()

            if (result.salesOrderId) {
                router.push(`/dashboard/sales-orders/${result.salesOrderId}/edit`)
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Upload PO gagal")
        } finally {
            setIsUploadingPo(false)
        }
    }

    const handleDeleteAttachment = async (attachmentId: number) => {
        setDeletingId(attachmentId)
        try {
            const result = await deleteQuotationAttachment(attachmentId)
            if (!result.success) {
                throw new Error(result.error || "Attachment gagal dihapus")
            }
            toast.success("Attachment berhasil dihapus")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Attachment gagal dihapus")
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <Card>
            <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <FileStack className="h-4 w-4 text-primary" />
                    Attachment & Customer PO
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Upload attachment pendukung quotation, lalu upload PO customer untuk auto-convert ke Sales Order.
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <div className="space-y-4 rounded-xl border p-4">
                        <div>
                            <p className="font-medium">Supporting Attachment</p>
                            <p className="text-sm text-muted-foreground">Spesifikasi, drawing, brosur, atau lampiran tender.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Judul Attachment</Label>
                            <Input value={attachmentTitle} onChange={(e) => setAttachmentTitle(e.target.value)} placeholder="Mis. Drawing pump assembly" />
                        </div>
                        <div className="space-y-2">
                            <Label>Deskripsi</Label>
                            <Textarea value={attachmentDescription} onChange={(e) => setAttachmentDescription(e.target.value)} rows={3} placeholder="Catatan singkat attachment" />
                        </div>
                        <div className="space-y-2">
                            <Label>File</Label>
                            <Input type="file" onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)} />
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                            <div>
                                <p className="text-sm font-medium">Masukkan ke paket quotation</p>
                                <p className="text-xs text-muted-foreground">Dipakai saat quotation ditinjau bersama attachment.</p>
                            </div>
                            <Switch checked={includeInPdf} onCheckedChange={setIncludeInPdf} />
                        </div>
                        <Button onClick={handleUploadAttachment} disabled={isUploadingAttachment} className="w-full gap-2">
                            {isUploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                            Upload Attachment
                        </Button>
                    </div>

                    <div className="space-y-4 rounded-xl border p-4">
                        <div>
                            <p className="font-medium">Customer PO</p>
                            <p className="text-sm text-muted-foreground">
                                Upload PO customer untuk quotation {quotationNumber || `#${quotationId}`}. Sistem akan otomatis membuat Sales Order jika belum ada.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Nomor PO Customer</Label>
                            <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Mis. PO-2026-0012" />
                        </div>
                        <div className="space-y-2">
                            <Label>File PO</Label>
                            <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={(e) => setPoFile(e.target.files?.[0] || null)} />
                        </div>
                        <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                            {salesOrderId ? (
                                <span>Quotation ini sudah punya Sales Order. Upload PO akan mensinkronkan data PO ke Sales Order yang sudah ada.</span>
                            ) : (
                                <span>Setelah PO masuk, quotation akan auto-convert ke Sales Order draft dengan konteks komersial dari quotation.</span>
                            )}
                        </div>
                        <Button onClick={handleUploadPo} disabled={isUploadingPo} className="w-full gap-2">
                            {isUploadingPo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                            Upload PO & Auto Convert
                        </Button>
                        {(customerPoNumber || customerPoDocument) && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                                <p className="font-medium">PO customer aktif</p>
                                {customerPoNumber && <p>Nomor PO: {customerPoNumber}</p>}
                                {customerPoDocument && (
                                    <Link href={customerPoDocument} target="_blank" className="underline underline-offset-4">
                                        Buka file PO terbaru
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-medium">Daftar File Quotation</p>
                            <p className="text-sm text-muted-foreground">Semua lampiran yang menempel pada quotation ini.</p>
                        </div>
                        <Badge variant="outline">{attachments.length} file</Badge>
                    </div>

                    {attachments.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            Belum ada file quotation.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {[...poAttachments, ...supportingAttachments].map((attachment) => (
                                <div key={attachment.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="truncate font-medium">{attachment.title}</p>
                                            <Badge variant={attachment.kind === "customer_po" ? "default" : "secondary"}>
                                                {attachment.kind === "customer_po" ? "Customer PO" : "Attachment"}
                                            </Badge>
                                            {attachment.includeInPdf && <Badge variant="outline">Include</Badge>}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{attachment.fileName} • {formatFileSize(attachment.fileSize)}</p>
                                        {attachment.description && <p className="text-sm text-muted-foreground">{attachment.description}</p>}
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(attachment.createdAt).toLocaleString("id-ID")} • {attachment.uploadedByUser?.name || attachment.uploadedByUser?.email || "System"}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Link href={attachment.fileUrl} target="_blank">
                                            <Button variant="outline" size="sm">Open</Button>
                                        </Link>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2 text-destructive"
                                            disabled={deletingId === attachment.id}
                                            onClick={() => handleDeleteAttachment(attachment.id)}
                                        >
                                            {deletingId === attachment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
