"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateBillingRecord, trackJneResi } from "@/app/actions/billing"
import { uploadFile } from "@/app/actions/upload"
import { toast } from "sonner"
import { Loader2, Search, UploadCloud } from "lucide-react"
import type { BillingRecordDisplay } from "@/lib/types"

interface BillingSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    record: BillingRecordDisplay | null
}

export function BillingSheet({ open, onOpenChange, record }: BillingSheetProps) {
    const [isLoading, setIsLoading] = useState(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [formData, setFormData] = useState<any>({})

    useEffect(() => {
        if (record) {
            setFormData(record)
        }
    }, [record])

    const handleChange = (key: string, value: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFormData((prev: any) => ({ ...prev, [key]: value }))
    }

    const handleSubmit = async () => {
        if (!record?.poNo) return

        setIsLoading(true)
        try {
            // Exclude properties that are not part of BillingRecordUpdate (e.g. items)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { items, ...updatePayload } = formData as any

            await updateBillingRecord({
                poNo: record.poNo as string,
                ...updatePayload
            })

            toast.success("Record updated successfully")
            onOpenChange(false)
        } catch (_error) {
            toast.error("Failed to update record")
        } finally {
            setIsLoading(false)
        }
    }

    const handleTrackJne = async () => {
        if (formData.modeDelivery !== 'JNE' || !formData.noResi) {
            toast.error("Please fill Mode Delivery as JNE and enter No. Resi")
            return
        }

        setIsLoading(true)
        try {
            const result = await trackJneResi(formData.noResi)
            if (result.success && result.data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setFormData((prev: any) => ({
                    ...prev,
                    statusDelivery: result.data.statusAction,
                    receiverDate: result.data.receiverDate || prev.receiverDate
                }))
                toast.success("Tracking data received")
            } else {
                toast.error(result.error || "Failed to track AWB")
            }
        } catch (error) {
            toast.error("An error occurred while tracking")
        } finally {
            setIsLoading(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsLoading(true)
        try {
            const FormPayload = new FormData()
            FormPayload.append("file", file)

            const result = await uploadFile(FormPayload)
            if (result.success) {
                handleChange("scanInvUrl", result.url)
                toast.success("File uploaded successfully")
            } else {
                toast.error(result.error || "Failed to upload file")
            }
        } catch (error) {
            toast.error("An error occurred while uploading")
        } finally {
            setIsLoading(false)
        }
    }

    if (!record) return null

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle>Billing Details</SheetTitle>
                    <SheetDescription>
                        View and edit billing details for DO: {record.actualNoDo || record.deliveryNumber}
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-120px)] pr-4">
                    <div className="grid gap-4 py-4">
                        <div className="space-y-4">
                            <h3 className="font-medium">Basic Info</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>PO No</Label>
                                    <Input value={formData.poNo || ""} onChange={e => handleChange("poNo", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Date Invoice</Label>
                                    <Input type="date" value={formData.dateInvoice ? new Date(formData.dateInvoice).toISOString().split('T')[0] : ""} onChange={e => handleChange("dateInvoice", new Date(e.target.value))} />
                                    <p className="text-xs text-muted-foreground mt-1 text-green-600">Year and Month will be automated from Date Invoice.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>No INV SAP</Label>
                                    <Input value={formData.noInvSap || ""} onChange={e => handleChange("noInvSap", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>e-Faktur</Label>
                                    <Input value={formData.eFaktur || ""} onChange={e => handleChange("eFaktur", e.target.value)} />
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <Label>DDP Address</Label>
                                    <Textarea value={formData.ddpAddress || ""} onChange={e => handleChange("ddpAddress", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Payment Type</Label>
                                    <Input value={formData.paymentType || ""} onChange={e => handleChange("paymentType", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cust ID</Label>
                                    <Input value={formData.custId || ""} onChange={e => handleChange("custId", e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="font-medium">Status & Logistics</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Date Send Invoice</Label>
                                    <Input type="date" value={formData.dateSendInvoice ? new Date(formData.dateSendInvoice).toISOString().split('T')[0] : ""} onChange={e => handleChange("dateSendInvoice", new Date(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tgl DO Faktur</Label>
                                    <Input type="date" value={formData.tglDoFaktur ? new Date(formData.tglDoFaktur).toISOString().split('T')[0] : ""} onChange={e => handleChange("tglDoFaktur", new Date(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nomor DO SAP</Label>
                                    <Input value={formData.nomorDoSap || ""} onChange={e => handleChange("nomorDoSap", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Mode Delivery</Label>
                                    <Select value={formData.modeDelivery || ""} onValueChange={val => handleChange("modeDelivery", val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="JNE">JNE</SelectItem>
                                            <SelectItem value="PORTAL">PORTAL</SelectItem>
                                            <SelectItem value="HANDCARRY">HANDCARRY</SelectItem>
                                            <SelectItem value="PANDUSIWI">PANDUSIWI</SelectItem>
                                            <SelectItem value="CENDANA">CENDANA</SelectItem>
                                            <SelectItem value="BYEMAIL">BYEMAIL</SelectItem>
                                            <SelectItem value="TIKI">TIKI</SelectItem>
                                            <SelectItem value="WAHANA">WAHANA</SelectItem>
                                            <SelectItem value="POS">POS</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>No. Resi</Label>
                                    <div className="flex gap-2">
                                        <Input value={formData.noResi || ""} onChange={e => handleChange("noResi", e.target.value)} />
                                        {formData.modeDelivery === 'JNE' && (
                                            <Button type="button" variant="outline" size="icon" onClick={handleTrackJne} disabled={isLoading || !formData.noResi}>
                                                <Search className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Status Delivery</Label>
                                    <Input value={formData.statusDelivery || ""} onChange={e => handleChange("statusDelivery", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Receiver Date</Label>
                                    <Input type="date" value={formData.receiverDate ? new Date(formData.receiverDate).toISOString().split('T')[0] : ""} onChange={e => handleChange("receiverDate", new Date(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Upload Scan INV</Label>
                                    <div className="flex items-center gap-2">
                                        <Input type="file" onChange={handleFileUpload} accept="image/*,application/pdf" className="text-xs" />
                                        {formData.scanInvUrl && (
                                            <a href={formData.scanInvUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                <SheetFooter className="mt-4">
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
