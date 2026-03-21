"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createQuotationAttachment, deleteQuotationAttachment, uploadQuotationCustomerPo } from "@/app/actions/quotation"
import { createSalesDocument, getSalesDocuments } from "@/app/actions/sales-document"
import { uploadFile } from "@/app/actions/upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { BookOpen, FileStack, Loader2, Paperclip, Trash2, UploadCloud, X } from "lucide-react"
import type { QuotationPoValidationSummary } from "@/db/schema/quotations"

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

type SalesDocumentEntry = Awaited<ReturnType<typeof getSalesDocuments>>[number]

interface QuotationFileCenterProps {
    quotationId: number
    quotationNumber: string | null
    salesOrderId: number | null
    customerPoNumber: string | null
    customerPoDocument: string | null
    poValidationStatus?: string | null
    poValidationSummary?: QuotationPoValidationSummary | null
    poValidationOcrSessionId?: number | null
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

function inferSalesDocumentFileType(fileName: string, fileType?: string | null) {
    const normalizedType = (fileType || "").toLowerCase()
    const extension = fileName.split(".").pop()?.toLowerCase()

    if (normalizedType.includes("pdf") || extension === "pdf") return "PDF"
    if (
        normalizedType.includes("sheet") ||
        normalizedType.includes("excel") ||
        extension === "xls" ||
        extension === "xlsx" ||
        extension === "csv"
    ) {
        return "Excel"
    }
    if (
        normalizedType.includes("image") ||
        extension === "png" ||
        extension === "jpg" ||
        extension === "jpeg"
    ) {
        return "Image"
    }
    return "Document"
}

export function QuotationFileCenter({
    quotationId,
    quotationNumber,
    salesOrderId,
    customerPoNumber,
    customerPoDocument,
    poValidationStatus,
    poValidationSummary,
    poValidationOcrSessionId,
    attachments,
}: QuotationFileCenterProps) {
    const router = useRouter()
    const [attachmentTitle, setAttachmentTitle] = useState("")
    const [attachmentDescription, setAttachmentDescription] = useState("")
    const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
    const [attachmentInputKey, setAttachmentInputKey] = useState(0)
    const [includeInPdf, setIncludeInPdf] = useState(true)
    const [saveToSalesDocument, setSaveToSalesDocument] = useState(false)
    const [poNumber, setPoNumber] = useState(customerPoNumber || "")
    const [poFile, setPoFile] = useState<File | null>(null)
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
    const [isUploadingPo, setIsUploadingPo] = useState(false)
    const [isLoadingSalesDocuments, setIsLoadingSalesDocuments] = useState(true)
    const [isAddingFromSalesDocument, setIsAddingFromSalesDocument] = useState(false)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [salesDocuments, setSalesDocuments] = useState<SalesDocumentEntry[]>([])
    const [selectedSalesDocumentIds, setSelectedSalesDocumentIds] = useState<string[]>([])
    const [salesDocumentSearch, setSalesDocumentSearch] = useState("")

    const supportingAttachments = attachments.filter((attachment) => attachment.kind !== "customer_po")
    const poAttachments = attachments.filter((attachment) => attachment.kind === "customer_po")
    const selectedSalesDocuments = useMemo(
        () => salesDocuments.filter((document) => selectedSalesDocumentIds.includes(document.id)),
        [salesDocuments, selectedSalesDocumentIds]
    )
    const filteredSalesDocuments = useMemo(() => {
        const query = salesDocumentSearch.trim().toLowerCase()
        if (!query) {
            return salesDocuments
        }

        return salesDocuments.filter((document) =>
            document.title.toLowerCase().includes(query) ||
            document.fileName.toLowerCase().includes(query) ||
            (document.description || "").toLowerCase().includes(query)
        )
    }, [salesDocuments, salesDocumentSearch])
    useEffect(() => {
        let isMounted = true

        const loadSalesDocuments = async () => {
            try {
                const documents = await getSalesDocuments()
                if (!isMounted) {
                    return
                }
                setSalesDocuments(documents)
            } catch (error) {
                console.error("Failed to load sales documents", error)
                if (isMounted) {
                    toast.error("Sales Document gagal dimuat")
                }
            } finally {
                if (isMounted) {
                    setIsLoadingSalesDocuments(false)
                }
            }
        }

        void loadSalesDocuments()

        return () => {
            isMounted = false
        }
    }, [])

    const resetAttachmentSelection = () => {
        setAttachmentFiles([])
        setAttachmentInputKey((current) => current + 1)
    }

    const handlePickAttachmentFiles = (files: FileList | null) => {
        if (!files?.length) {
            return
        }

        setAttachmentFiles((currentFiles) => {
            const nextFiles = [...currentFiles]
            const existingKeys = new Set(currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`))

            for (const file of Array.from(files)) {
                const fileKey = `${file.name}-${file.size}-${file.lastModified}`
                if (!existingKeys.has(fileKey)) {
                    nextFiles.push(file)
                    existingKeys.add(fileKey)
                }
            }

            return nextFiles
        })
        setAttachmentInputKey((current) => current + 1)
    }

    const handleRemoveAttachmentFile = (fileToRemove: File) => {
        setAttachmentFiles((currentFiles) =>
            currentFiles.filter(
                (file) =>
                    !(file.name === fileToRemove.name && file.size === fileToRemove.size && file.lastModified === fileToRemove.lastModified)
            )
        )
    }

    const handleUploadAttachment = async () => {
        if (attachmentFiles.length === 0) {
            toast.error("Pilih minimal satu file attachment terlebih dahulu")
            return
        }

        setIsUploadingAttachment(true)
        try {
            for (const file of attachmentFiles) {
                const formData = new FormData()
                formData.append("file", file)

                const uploadResult = await uploadFile(formData)
                if (!uploadResult.success || !uploadResult.url) {
                    throw new Error(uploadResult.error || `Upload attachment ${file.name} gagal`)
                }

                const attachmentLabel = attachmentTitle.trim()
                const resolvedTitle = attachmentFiles.length === 1
                    ? (attachmentLabel || file.name)
                    : (attachmentLabel ? `${attachmentLabel} - ${file.name}` : file.name)

                const saveResult = await createQuotationAttachment({
                    quotationId,
                    title: resolvedTitle,
                    fileUrl: uploadResult.url,
                    fileName: file.name,
                    mimeType: file.type || null,
                    fileSize: file.size,
                    description: attachmentDescription.trim() || null,
                    includeInPdf,
                    kind: "supporting",
                })

                if (!saveResult.success) {
                    throw new Error(saveResult.error || `Attachment ${file.name} gagal disimpan`)
                }

                if (saveToSalesDocument) {
                    const salesDocResult = await createSalesDocument({
                        title: resolvedTitle,
                        description: attachmentDescription.trim() || null,
                        fileUrl: uploadResult.url,
                        fileName: file.name,
                        fileType: file.type || "application/octet-stream",
                    })

                    if (!salesDocResult.success) {
                        throw new Error(salesDocResult.error || `Attachment ${file.name} gagal disimpan ke Sales Document`)
                    }
                }
            }

            toast.success(`${attachmentFiles.length} attachment quotation berhasil ditambahkan`)
            setAttachmentTitle("")
            setAttachmentDescription("")
            resetAttachmentSelection()
            setIncludeInPdf(true)
            setSaveToSalesDocument(false)
            setSalesDocumentSearch("")
            const documents = await getSalesDocuments()
            setSalesDocuments(documents)
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

            setPoFile(null)
            router.refresh()

            if ("autoConverted" in result && result.autoConverted && result.salesOrderId) {
                toast.success("PO tervalidasi OCR dan quotation otomatis dikonversi ke Sales Order")
                router.push(`/dashboard/sales-orders/${result.salesOrderId}/edit`)
                return
            }

            if ("requiresManualReview" in result && result.requiresManualReview) {
                const validationStatus = "validationStatus" in result ? result.validationStatus : null
                toast.warning(
                    validationStatus === "partial_match"
                        ? "PO hanya mengambil sebagian item quotation. Lanjutkan ke validasi OCR."
                        : validationStatus === "mismatch"
                            ? "PO customer tidak sama dengan quotation. Validasi OCR wajib dilakukan."
                            : "OCR PO gagal diverifikasi otomatis. Silakan validasi manual."
                )

                if ("ocrSessionId" in result && result.ocrSessionId) {
                    router.push(`/dashboard/sales-orders/ocr-validate?session=${result.ocrSessionId}&quotation=${quotationId}`)
                    return
                }
            }

            if (result.salesOrderId) {
                toast.success("PO berhasil diupload")
                router.push(`/dashboard/sales-orders/${result.salesOrderId}/edit`)
                return
            }

            toast.success("PO berhasil diupload")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Upload PO gagal")
        } finally {
            setIsUploadingPo(false)
        }
    }

    const handleAttachSalesDocument = async () => {
        if (selectedSalesDocuments.length === 0) {
            toast.error("Pilih minimal satu Sales Document terlebih dahulu")
            return
        }

        const duplicatedDocuments = selectedSalesDocuments.filter((document) =>
            supportingAttachments.some((attachment) => attachment.fileUrl === document.fileUrl)
        )
        if (duplicatedDocuments.length > 0) {
            toast.error(`Sudah terpasang: ${duplicatedDocuments.map((document) => document.title).join(", ")}`)
            return
        }

        setIsAddingFromSalesDocument(true)
        try {
            for (const document of selectedSalesDocuments) {
                const result = await createQuotationAttachment({
                    quotationId,
                    title: attachmentTitle.trim() || document.title,
                    fileUrl: document.fileUrl,
                    fileName: document.fileName,
                    mimeType: document.fileType || null,
                    fileSize: 0,
                    description: attachmentDescription.trim() || document.description || null,
                    includeInPdf,
                    kind: "supporting",
                })

                if (!result.success) {
                    throw new Error(result.error || `Sales Document ${document.title} gagal ditambahkan`)
                }
            }

            toast.success(`${selectedSalesDocuments.length} Sales Document berhasil ditambahkan ke quotation`)
            setAttachmentTitle("")
            setAttachmentDescription("")
            setSelectedSalesDocumentIds([])
            setSalesDocumentSearch("")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Sales Document gagal ditambahkan")
        } finally {
            setIsAddingFromSalesDocument(false)
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

    const toggleSalesDocumentSelection = (documentId: string, checked: boolean) => {
        setSelectedSalesDocumentIds((currentIds) => {
            if (checked) {
                return currentIds.includes(documentId) ? currentIds : [...currentIds, documentId]
            }
            return currentIds.filter((id) => id !== documentId)
        })
    }

    const clearSalesDocumentSelection = () => {
        setSelectedSalesDocumentIds([])
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
                            <p className="text-sm text-muted-foreground">Spesifikasi, drawing, brosur, atau lampiran tender. Bisa upload multi attachment sekaligus atau pilih dari Sales Document yang sudah ada.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Judul Attachment</Label>
                            <Input value={attachmentTitle} onChange={(e) => setAttachmentTitle(e.target.value)} placeholder="Opsional. Mis. Drawing pump assembly" />
                        </div>
                        <div className="space-y-2">
                            <Label>Deskripsi</Label>
                            <Textarea value={attachmentDescription} onChange={(e) => setAttachmentDescription(e.target.value)} rows={3} placeholder="Catatan singkat attachment" />
                        </div>
                        <div className="space-y-2">
                            <Label>File</Label>
                            <Input
                                key={attachmentInputKey}
                                type="file"
                                multiple
                                onChange={(e) => handlePickAttachmentFiles(e.target.files)}
                            />
                            {attachmentFiles.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs text-muted-foreground">
                                            {attachmentFiles.length} file dipilih
                                        </p>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetAttachmentSelection}>
                                            Pilih Ulang
                                        </Button>
                                    </div>
                                    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                                        {attachmentFiles.map((file) => (
                                            <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium">{file.name}</p>
                                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => handleRemoveAttachmentFile(file)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                            <div>
                                <p className="text-sm font-medium">Masukkan ke paket quotation</p>
                                <p className="text-xs text-muted-foreground">Dipakai saat quotation ditinjau bersama attachment.</p>
                            </div>
                            <Switch checked={includeInPdf} onCheckedChange={setIncludeInPdf} />
                        </div>
                        <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
                            <Checkbox
                                id={`save-to-sales-document-${quotationId}`}
                                checked={saveToSalesDocument}
                                onCheckedChange={(checked) => setSaveToSalesDocument(checked === true)}
                            />
                            <div>
                                <Label htmlFor={`save-to-sales-document-${quotationId}`} className="text-sm font-medium">
                                    Simpan juga ke Sales Document
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    File upload quotation ini juga akan masuk ke library Sales Document.
                                </p>
                            </div>
                        </div>
                        <Button onClick={handleUploadAttachment} disabled={isUploadingAttachment} className="w-full gap-2">
                            {isUploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                            Upload Attachment
                        </Button>

                        <div className="space-y-4 rounded-xl border border-dashed bg-muted/20 p-4">
                            <div>
                                <p className="font-medium">Pilih dari Sales Document</p>
                                <p className="text-sm text-muted-foreground">
                                    Pakai satu atau beberapa file yang sudah tersimpan di library sales tanpa upload ulang.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Cari Sales Document</Label>
                                <Input
                                    value={salesDocumentSearch}
                                    onChange={(e) => setSalesDocumentSearch(e.target.value)}
                                    placeholder={isLoadingSalesDocuments ? "Memuat Sales Document..." : "Cari title, deskripsi, atau filename"}
                                    disabled={isLoadingSalesDocuments || salesDocuments.length === 0}
                                />
                            </div>
                            {selectedSalesDocuments.length > 0 && (
                                <div className="space-y-2 rounded-lg border bg-background p-3 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="font-medium">{selectedSalesDocuments.length} Sales Document dipilih</p>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearSalesDocumentSelection}>
                                            Pilih Ulang
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {selectedSalesDocuments.map((document) => (
                                            <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium">{document.title}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {document.fileName} • {inferSalesDocumentFileType(document.fileName, document.fileType)}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => toggleSalesDocumentSelection(document.id, false)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {salesDocuments.length === 0 && !isLoadingSalesDocuments && (
                                <p className="text-sm text-muted-foreground">
                                    Belum ada Sales Document yang bisa dipilih.
                                </p>
                            )}
                            {filteredSalesDocuments.length > 0 && (
                                <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border bg-background p-3">
                                    {filteredSalesDocuments.map((document) => {
                                        const checked = selectedSalesDocumentIds.includes(document.id)
                                        const isAttached = supportingAttachments.some((attachment) => attachment.fileUrl === document.fileUrl)

                                        return (
                                            <div key={document.id} className="rounded-lg border p-3">
                                                <div className="flex items-start gap-3">
                                                    <Checkbox
                                                        checked={checked}
                                                        disabled={isAttached}
                                                        onCheckedChange={(value) => toggleSalesDocumentSelection(document.id, value === true)}
                                                        className="mt-0.5"
                                                    />
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="truncate font-medium">{document.title}</p>
                                                            <Badge variant="outline">{inferSalesDocumentFileType(document.fileName, document.fileType)}</Badge>
                                                            {isAttached && <Badge variant="secondary">Sudah Dipasang</Badge>}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            {document.description || document.fileName}
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                            <span>{document.fileName}</span>
                                                            <span>•</span>
                                                            <span>{document.uploadedBy?.name || "Unknown"}</span>
                                                        </div>
                                                        <Link href={document.fileUrl} target="_blank" className="inline-flex">
                                                            <Button type="button" variant="link" className="h-auto p-0 text-xs">
                                                                Open Document
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    onClick={handleAttachSalesDocument}
                                    disabled={isLoadingSalesDocuments || salesDocuments.length === 0 || selectedSalesDocuments.length === 0 || isAddingFromSalesDocument}
                                    className="w-full gap-2 sm:flex-1"
                                    variant="secondary"
                                >
                                    {isAddingFromSalesDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                                    Tambahkan Sales Document Terpilih
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-xl border p-4">
                        <div>
                            <p className="font-medium">Customer PO</p>
                            <p className="text-sm text-muted-foreground">
                                Upload PO customer untuk quotation {quotationNumber || `#${quotationId}`}. Sistem akan memvalidasi PO dengan OCR sebelum auto-convert ke Sales Order.
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
                                <span>Setelah PO masuk, sistem akan cek OCR PO vs quotation. Hanya full match yang auto-convert; partial atau mismatch akan diarahkan ke validasi OCR.</span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            File PO customer tidak ikut digabung ke paket attachment quotation.
                        </p>
                        <Button onClick={handleUploadPo} disabled={isUploadingPo} className="w-full gap-2">
                            {isUploadingPo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                            Upload PO & Validate OCR
                        </Button>
                        {(customerPoNumber || customerPoDocument) && (
                            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                                <p className="font-medium">PO customer aktif</p>
                                {customerPoNumber && <p>Nomor PO: {customerPoNumber}</p>}
                                {customerPoDocument && (
                                    <Link href={customerPoDocument} target="_blank" className="underline underline-offset-4">
                                        Buka file PO terbaru
                                    </Link>
                                )}
                                {poValidationStatus && (
                                    <div className="rounded-lg border border-emerald-200/70 bg-white/70 p-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant={poValidationStatus === "full_match" ? "default" : poValidationStatus === "partial_match" ? "secondary" : "destructive"}>
                                                {poValidationStatus === "full_match"
                                                    ? "Full Match"
                                                    : poValidationStatus === "partial_match"
                                                        ? "Partial Match"
                                                        : poValidationStatus === "mismatch"
                                                            ? "Mismatch"
                                                            : "OCR Failed"}
                                            </Badge>
                                            {poValidationSummary?.checkedAt && (
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(poValidationSummary.checkedAt).toLocaleString("id-ID")}
                                                </span>
                                            )}
                                        </div>
                                        {poValidationSummary?.reasons?.length ? (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                {poValidationSummary.reasons[0]}
                                            </p>
                                        ) : null}
                                        {(poValidationOcrSessionId || poValidationSummary?.ocrSessionId) && (
                                            <Link
                                                href={`/dashboard/sales-orders/ocr-validate?session=${poValidationOcrSessionId || poValidationSummary?.ocrSessionId}&quotation=${quotationId}`}
                                                className="mt-2 inline-flex text-xs font-medium text-primary underline underline-offset-4"
                                            >
                                                Buka validasi OCR PO
                                            </Link>
                                        )}
                                    </div>
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
