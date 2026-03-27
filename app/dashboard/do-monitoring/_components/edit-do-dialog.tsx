"use client"

import { useState, useEffect, useCallback } from "react"
import { updateDoMonitoringFields } from "@/app/actions/delivery"
import { getInvoiceInfoByPoNo } from "@/app/actions/billing"
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
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Upload, FileText, ExternalLink, Maximize2 } from "lucide-react"
import type { SalesOrder, Customer } from "@/lib/types"
import { getDoMonitoringStatus, getStoredDoStatus, type DoMonitoringStatus } from "../status-utils"

type DeliveryWithSalesOrder = Delivery & {
    salesOrder?: (SalesOrder & { customer: Customer }) | null
}

export function EditDoDialog({
    delivery,
    open,
    onOpenChange
}: {
    delivery: DeliveryWithSalesOrder | null,
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
    const [doStatus, setDoStatus] = useState<DoMonitoringStatus>(getDoMonitoringStatus(delivery ?? {}))
    const [remark, setRemark] = useState(delivery?.remark || "")
    const [scanDoDocument, setScanDoDocument] = useState(delivery?.scanDoDocument || "")
    const [doSap, setDoSap] = useState(delivery?.doSap || "")
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [saving, setSaving] = useState(false)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)

    // SAP auto-fill state
    const [invoiceFromSap, setInvoiceFromSap] = useState(false)

    const queryClient = useQueryClient()

    // Fetch invoice info from billing by PO number + customerName
    const fetchInvoiceFromBilling = useCallback(async (poNo: string, customerName?: string, overrideExisting = false) => {
        if (!poNo) return null

        const result = await getInvoiceInfoByPoNo(poNo, customerName)
        if (!result.success || !result.data) return null

        const { noInvSap, dateInvoice } = result.data

        if (noInvSap) {
            if (overrideExisting) {
                setInvoiceNumber(noInvSap)
                setInvoiceDate(dateInvoice ? new Date(dateInvoice).toISOString().slice(0, 10) : "")
                setInvoiceFromSap(true)
                return { noInvSap, dateInvoice }
            }
            return { noInvSap, dateInvoice }
        }

        return null
    }, [])

    // Sync state when dialog opens with selected delivery
    useEffect(() => {
        if (delivery && open) {
            const currentInvoiceNumber = delivery.invoiceNumber || ""
            const currentInvoiceDate = delivery.invoiceDate
                ? new Date(delivery.invoiceDate).toISOString().slice(0, 10)
                : ""

            setReturnDoDate(delivery.returnDoDate ? new Date(delivery.returnDoDate).toISOString().slice(0, 10) : "")
            setInvoiceNumber(currentInvoiceNumber)
            setInvoiceDate(currentInvoiceDate)
            setDoStatus(getDoMonitoringStatus(delivery))
            setRemark(delivery.remark || "")
            setScanDoDocument(delivery.scanDoDocument || "")
            setDoSap(delivery.doSap || "")
            setInvoiceFromSap(false)

            // Auto-fill invoice ONLY if invoice field is currently empty
            const poNo = (delivery as DeliveryWithSalesOrder).salesOrder?.customerPo
            const customerName = (delivery as DeliveryWithSalesOrder).salesOrder?.customer?.name
            if (poNo && !currentInvoiceNumber) {
                fetchInvoiceFromBilling(poNo, customerName ?? undefined, true)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [delivery, open])

    const handleSave = async () => {
        if (!delivery) return
        setSaving(true)
        const res = await updateDoMonitoringFields(delivery.id, {
            returnDoDate: returnDoDate ? new Date(returnDoDate) : null,
            invoiceNumber,
            invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
            doStatus: getStoredDoStatus(doStatus),
            remark,
            scanDoDocument,
            doSap
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
                setDoStatus("Return")
                if (!returnDoDate) {
                    setReturnDoDate(new Date().toISOString().slice(0, 10))
                }
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
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>Edit DO Monitoring Info</DialogTitle>
                    <DialogDescription>
                        Update returned DO details for {delivery?.deliveryNumber || `Delivery #${delivery?.id}`}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">DO Status</Label>
                        <Select value={doStatus} onValueChange={(value) => setDoStatus(value as DoMonitoringStatus)}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Return">Return</SelectItem>
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
                        <Label className="text-right">DO SAP</Label>
                        <Input
                            value={doSap}
                            onChange={(e) => setDoSap(e.target.value)}
                            className="col-span-3 font-mono"
                            placeholder="Manual SAP Ref..."
                        />
                    </div>

                    {/* Invoice No */}
                    <div className="grid grid-cols-4 items-start gap-4">
                        <div className="text-right pt-2">
                            <Label>Invoice No.</Label>
                        </div>
                        <div className="col-span-3 space-y-1.5">
                            <Input
                                value={invoiceNumber}
                                onChange={(e) => {
                                    setInvoiceNumber(e.target.value)
                                    setInvoiceFromSap(false) // User edited manually
                                }}
                                placeholder="INV-..."
                            />
                            {invoiceFromSap && (
                                <div className="flex items-center gap-1.5">
                                    <Badge variant="secondary" className="text-[10px] h-5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        🔗 Dari SAP/Billing
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">Bisa diedit manual</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Invoice Date */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Invoice Date</Label>
                        <Input
                            type="date"
                            value={invoiceDate}
                            onChange={(e) => {
                                setInvoiceDate(e.target.value)
                                setInvoiceFromSap(false) // User edited manually
                            }}
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
