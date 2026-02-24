"use client"

import { useState, useEffect } from "react"
import { updateDoMonitoringFields } from "@/app/actions/delivery"
import { uploadFile } from "@/app/actions/upload"
import { useQueryClient } from "@tanstack/react-query"
import { ScanDoPreview } from "./scan-do-preview"
import type { Delivery } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Upload, FileText, ExternalLink, Maximize2 } from "lucide-react"

export function EditDoDialog({
    delivery,
    open,
    onOpenChange
}: {
    delivery: Delivery | null,
    open: boolean,
    onOpenChange: (open: boolean) => void
}) {
    const [returnDoDate, setReturnDoDate] = useState(
        delivery?.returnDoDate ? new Date(delivery.returnDoDate).toISOString().slice(0, 10) : ""
    )
    const [invoiceNumber, setInvoiceNumber] = useState(delivery?.invoiceNumber || "")
    const [invoiceDate, setInvoiceDate] = useState(
        delivery?.invoiceDate ? new Date(delivery.invoiceDate).toISOString().slice(0, 10) : ""
    )
    const [doStatus, setDoStatus] = useState(delivery?.doStatus || "Pending")
    const [remark, setRemark] = useState(delivery?.remark || "")
    const [scanDoDocument, setScanDoDocument] = useState(delivery?.scanDoDocument || "")
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [saving, setSaving] = useState(false)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const queryClient = useQueryClient()

    // Sync state when dialog opens with selected delivery
    useEffect(() => {
        if (delivery && open) {
            setReturnDoDate(delivery.returnDoDate ? new Date(delivery.returnDoDate).toISOString().slice(0, 10) : "")
            setInvoiceNumber(delivery.invoiceNumber || "")
            setInvoiceDate(delivery.invoiceDate ? new Date(delivery.invoiceDate).toISOString().slice(0, 10) : "")
            setDoStatus(delivery.doStatus || "Pending")
            setRemark(delivery.remark || "")
            setScanDoDocument(delivery.scanDoDocument || "")
        }
    }, [delivery, open])

    const handleSave = async () => {
        if (!delivery) return
        setSaving(true)
        const res = await updateDoMonitoringFields(delivery.id, {
            returnDoDate: returnDoDate ? new Date(returnDoDate) : null,
            invoiceNumber,
            invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
            doStatus,
            remark,
            scanDoDocument
        })

        if (res.success) {
            toast.success("DO Info updated successfully")
            queryClient.invalidateQueries({ queryKey: ["deliveries"] })
            onOpenChange(false)
        } else {
            toast.error(res.error || "Failed to update DO Info")
        }
        setSaving(false)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size should be less than 5MB")
            return
        }

        setIsUploading(true)
        setUploadProgress(0)
        const formData = new FormData()
        formData.append('file', file)

        try {
            // Start progress animation
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 85) {
                        clearInterval(progressInterval)
                        return 85 // Stop at 85% until actual upload completes
                    }
                    return prev + 15
                })
            }, 150)

            const result = await uploadFile(formData)
            
            // Clear interval and complete progress
            clearInterval(progressInterval)

            if (result.success && result.url) {
                setUploadProgress(100)
                setScanDoDocument(result.url)
                toast.success("Document berhasil diupload")
            } else {
                setUploadProgress(0)
                toast.error(result.error || "Gagal upload dokumen")
            }
        } catch (_error) {
            setUploadProgress(0)
            toast.error("Terjadi kesalahan saat upload")
        } finally {
            setTimeout(() => {
                setIsUploading(false)
                setUploadProgress(0)
            }, 1000) // Give user time to see 100%
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit DO Monitoring Info</DialogTitle>
                    <DialogDescription>
                        Update returned DO details for {delivery?.deliveryNumber || `Delivery #${delivery?.id}`}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">DO Status</Label>
                        <Select value={doStatus} onValueChange={setDoStatus}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Returned">Returned</SelectItem>
                                <SelectItem value="Lost">Lost</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Return Date</Label>
                        <Input
                            type="date"
                            value={returnDoDate}
                            onChange={(e) => setReturnDoDate(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Invoice No.</Label>
                        <Input
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            className="col-span-3"
                            placeholder="INV-..."
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Invoice Date</Label>
                        <Input
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => setInvoiceDate(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right mt-3">Remark</Label>
                        <Textarea
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            className="col-span-3 min-h-[80px]"
                            placeholder="Add any remarks or notes..."
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Scan DO</Label>
                        <div className="col-span-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <Input
                                    id="scan-do-upload"
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={isUploading || saving}
                                />
                                <Label
                                    htmlFor="scan-do-upload"
                                    className={`flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md cursor-pointer transition-colors text-sm font-medium w-full ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isUploading ? (
                                        <span className="animate-spin">⏳</span>
                                    ) : (
                                        <Upload className="h-4 w-4" />
                                    )}
                                    {isUploading ? `Uploading... ${uploadProgress}%` : "Upload Scan DO"}
                                </Label>
                            </div>
                            {isUploading && (
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div 
                                        className="bg-blue-600 h-2 transition-all duration-300 ease-out"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            )}
                            {scanDoDocument && !isUploading && (
                                <div className="flex items-center justify-between p-2 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 text-sm">
                                    <div className="flex items-center gap-2 truncate text-blue-700 dark:text-blue-300">
                                        <FileText className="h-4 w-4 flex-shrink-0" />
                                        <span className="truncate flex-1">Document Attached</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-blue-700 dark:text-blue-300 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 ml-2 flex-shrink-0"
                                        onClick={() => setIsPreviewOpen(true)}
                                    >
                                        <Maximize2 className="h-3 w-3 mr-1" />
                                        Preview
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-blue-700 dark:text-blue-300 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 ml-2 flex-shrink-0"
                                        onClick={() => window.open(scanDoDocument, '_blank')}
                                    >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Open
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>

            <ScanDoPreview
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                url={scanDoDocument}
                deliveryNumber={delivery?.deliveryNumber}
            />
        </Dialog>
    )
}
