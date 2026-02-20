"use client"

import { useState, useEffect } from "react"
import { updateDoMonitoringFields } from "@/app/actions/delivery"
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
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export function EditDoDialog({
    delivery,
    open,
    onOpenChange
}: {
    delivery: any,
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
    const [saving, setSaving] = useState(false)

    // Sync state when dialog opens with selected delivery
    useEffect(() => {
        if (delivery && open) {
            setReturnDoDate(delivery.returnDoDate ? new Date(delivery.returnDoDate).toISOString().slice(0, 10) : "")
            setInvoiceNumber(delivery.invoiceNumber || "")
            setInvoiceDate(delivery.invoiceDate ? new Date(delivery.invoiceDate).toISOString().slice(0, 10) : "")
            setDoStatus(delivery.doStatus || "Pending")
        }
    }, [delivery, open])

    const handleSave = async () => {
        if (!delivery) return
        setSaving(true)
        const res = await updateDoMonitoringFields(delivery.id, {
            returnDoDate: returnDoDate ? new Date(returnDoDate) : null,
            invoiceNumber,
            invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
            doStatus
        })

        if (res.success) {
            toast.success("DO Info updated successfully")
            onOpenChange(false)
        } else {
            toast.error(res.error || "Failed to update DO Info")
        }
        setSaving(false)
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
        </Dialog>
    )
}
