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
import { updateBillingRecord } from "@/app/actions/billing"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface BillingSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    record: any
}

export function BillingSheet({ open, onOpenChange, record }: BillingSheetProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState<any>({})

    useEffect(() => {
        if (record) {
            setFormData(record)
        }
    }, [record])

    const handleChange = (key: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }))
    }

    const handleSubmit = async () => {
        if (!record?.deliveryItemId) return

        setIsLoading(true)
        try {
            const { deliveryItemId, ...data } = formData

            await updateBillingRecord({
                deliveryItemId: record.deliveryItemId,
                ...formData
            })

            toast.success("Record updated successfully")
            onOpenChange(false)
        } catch (error) {
            toast.error("Failed to update record")
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
                                    <Label>No</Label>
                                    <Input value={formData.no || ""} onChange={e => handleChange("no", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Year</Label>
                                    <Input type="number" value={formData.year || ""} onChange={e => handleChange("year", parseInt(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Month</Label>
                                    <Input value={formData.month || ""} onChange={e => handleChange("month", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>PO No</Label>
                                    <Input value={formData.poNo || ""} onChange={e => handleChange("poNo", e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="font-medium">Product & Price</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-2">
                                    <Label>Material</Label>
                                    <Input value={formData.materialDescription || ""} disabled className="bg-muted" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Qty</Label>
                                    <Input value={formData.qty || ""} onChange={e => handleChange("qty", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Curr</Label>
                                    <Input value={formData.curr || ""} onChange={e => handleChange("curr", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Price/Pcs</Label>
                                    <Input type="number" value={formData.pricePerPcsIdr || ""} onChange={e => handleChange("pricePerPcsIdr", parseFloat(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Total Price</Label>
                                    <Input type="number" value={formData.totalPriceIdr || ""} onChange={e => handleChange("totalPriceIdr", parseFloat(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="font-medium">Tax & Invoice</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>PPN</Label>
                                    <Input type="number" value={formData.ppn || ""} onChange={e => handleChange("ppn", parseFloat(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>No INV SAP</Label>
                                    <Input value={formData.noInvSap || ""} onChange={e => handleChange("noInvSap", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Date Invoice</Label>
                                    <Input type="date" value={formData.dateInvoice ? new Date(formData.dateInvoice).toISOString().split('T')[0] : ""} onChange={e => handleChange("dateInvoice", new Date(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>e-Faktur</Label>
                                    <Input value={formData.eFaktur || ""} onChange={e => handleChange("eFaktur", e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="font-medium">Status & Logistics</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nomor DO SAP</Label>
                                    <Input value={formData.nomorDoSap || ""} onChange={e => handleChange("nomorDoSap", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tgl DO Faktur</Label>
                                    <Input type="date" value={formData.tglDoFaktur ? new Date(formData.tglDoFaktur).toISOString().split('T')[0] : ""} onChange={e => handleChange("tglDoFaktur", new Date(e.target.value))} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Remarks</Label>
                                <Textarea value={formData.remaks || ""} onChange={e => handleChange("remaks", e.target.value)} />
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
