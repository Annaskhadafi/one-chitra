"use client"

import { useState, useEffect, useRef } from "react"
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
import { Loader2 } from "lucide-react"
import type { BillingRecordDisplay } from "@/lib/types"

interface BillingSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    record: BillingRecordDisplay | null
    onSuccess?: () => void
}

type BillingSheetFormData = Partial<BillingRecordDisplay> & {
    [key: string]: unknown
    poNo?: string
    dateInvoice?: Date | string | null
    noInvSap?: string | null
    eFaktur?: string | null
    ddpAddress?: string | null
    paymentType?: string | null
    custId?: string | null
    dateSendInvoice?: Date | string | null
    tglDoFaktur?: Date | string | null
    nomorDoSap?: string | null
    modeDelivery?: string | null
    noResi?: string | null
    statusDelivery?: string | null
    receiverDate?: Date | string | null
    scanInvUrl?: string | null
}

export function BillingSheet({ open, onOpenChange, record, onSuccess }: BillingSheetProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isTracking, setIsTracking] = useState(false)
    const [formData, setFormData] = useState<BillingSheetFormData>({})
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (record) {
            setFormData(record)
        }
    }, [record])

    // Auto-track JNE resi saat noResi berubah (debounce 1.5 detik)
    useEffect(() => {
        const noResi = typeof formData.noResi === "string" ? formData.noResi.trim() : ""
        if (formData.modeDelivery !== 'JNE' || noResi.length < 10) return

        if (debounceRef.current) clearTimeout(debounceRef.current)

        debounceRef.current = setTimeout(async () => {
            setIsTracking(true)
            try {
                const result = await trackJneResi(noResi)
                if (result.success && result.data) {
                    setFormData((prev) => ({
                        ...prev,
                        statusDelivery: typeof result.data.statusAction === "string" ? result.data.statusAction : prev.statusDelivery,
                        receiverDate: result.data.receiverDate || prev.receiverDate
                    }) as BillingSheetFormData)
                }
            } catch {
                // Gagal silent — user tidak perlu tahu gagal auto-track
            } finally {
                setIsTracking(false)
            }
        }, 1500)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [formData.noResi, formData.modeDelivery])

    const handleChange = (key: string, value: unknown) => {
        setFormData((prev) => ({ ...prev, [key]: value }))
    }

    const handleSubmit = async () => {
        if (!record?.poNo) return

        setIsLoading(true)
        try {
            // Hanya ekstrak properties yang diperbolehkan di skema Drizzle UpdateBillingRecord
            const allowedFields = [
                "dateInvoice", "noInvSap", "eFaktur", "ddpAddress", "paymentType", "custId",
                "dateSendInvoice", "tglDoFaktur", "nomorDoSap", "modeDelivery", "noResi",
                "statusDelivery", "receiverDate", "scanInvUrl"
            ]

            const updatePayload: Record<string, unknown> = {}
            for (const key of allowedFields) {
                if (formData[key] !== undefined) {
                    updatePayload[key] = formData[key] // Ambil nilai state terakhir
                }
            }

            const result = await updateBillingRecord({
                billingRecordId: formData.billingRecordId,
                poNo: formData.poNo || record.poNo,
                currentNoInvSap: record.noInvSap,
                ...updatePayload
            })

            // Jika API merespons success: false, lempar Error spesifik
            if (!result || !result.success) throw new Error(result?.error || "Gagal memperbarui row DB")

            toast.success("Record updated successfully")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to update record")
        } finally {
            setIsLoading(false)
        }
    }


    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !record?.poNo) return

        setIsLoading(true)
        try {
            const FormPayload = new FormData()
            FormPayload.append("file", file)

            const result = await uploadFile(FormPayload)
            if (result.success && result.url) {
                handleChange("scanInvUrl", result.url)

                // AUTO SAVE langsung ke DB tanpa harus klik tombol Save
                const saveResult = await updateBillingRecord({
                    billingRecordId: record.billingRecordId,
                    poNo: record.poNo as string,
                    currentNoInvSap: record.noInvSap,
                    scanInvUrl: result.url
                })

                if (saveResult && saveResult.success) {
                    toast.success("Dokumen Scan Inv terunggah dan tersimpan otomatis")
                    onSuccess?.()
                } else {
                    toast.error(saveResult?.error || "Berhasil unggah tapi gagal simpan ke DB")
                }
            } else {
                toast.error(result.error || "Failed to upload file")
            }
        } catch (_error) {
            toast.error("An error occurred while uploading")
        } finally {
            setIsLoading(false)
        }
    }

    if (!record) return null

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-3xl sm:w-[800px] p-6 sm:p-10">
                <SheetHeader>
                    <SheetTitle>Billing Details</SheetTitle>
                    <SheetDescription>
                        View and edit billing details for DO: {record.actualNoDo || record.deliveryNumber}
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-120px)] pr-4">
                    <div className="grid gap-6 py-4 px-1 sm:px-4">
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
                                    <div className="relative">
                                        <Input value={formData.noResi || ""} onChange={e => handleChange("noResi", e.target.value)} placeholder={formData.modeDelivery === 'JNE' ? "Input resi → auto track..." : ""} />
                                        {isTracking && (
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    {formData.modeDelivery === 'JNE' && (
                                        <p className="text-xs text-muted-foreground">Status & receiver date akan terisi otomatis setelah input resi.</p>
                                    )}
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
