"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { updateEvhsReceiptSerialNumber } from "@/app/actions/evhs"

type TrackingItem = {
    receiptItemId?: number
    sn?: string | null
    materialNumberCp?: string
}

export function EvhsEditReceiptSnDialog({
    open,
    onOpenChange,
    trackingItem,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    trackingItem: TrackingItem | null
}) {
    const router = useRouter()
    const [serialNumber, setSerialNumber] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (open) setSerialNumber(trackingItem?.sn && trackingItem.sn !== "-" ? trackingItem.sn : "")
    }, [open, trackingItem])

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        if (!trackingItem?.receiptItemId || !serialNumber.trim()) return

        setIsSubmitting(true)
        try {
            const result = await updateEvhsReceiptSerialNumber({
                receiptItemId: trackingItem.receiptItemId,
                currentSerialNumber: trackingItem.sn && trackingItem.sn !== "-" ? trackingItem.sn : "",
                serialNumber: serialNumber.trim(),
            })
            if (!result.success) {
                toast.error(result.error)
                return
            }
            toast.success("SN receipt berhasil diperbarui")
            onOpenChange(false)
            router.refresh()
        } catch (_error) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>{trackingItem?.sn && trackingItem.sn !== "-" ? "Edit SN Receipt" : "Input SN Receipt"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="text-sm text-muted-foreground">Material: {trackingItem?.materialNumberCp || "-"}</div>
                    <div className="space-y-2">
                        <Label htmlFor="receipt-sn">Serial Number (SN)</Label>
                        <Input id="receipt-sn" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} autoFocus />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Batal</Button>
                        <Button type="submit" disabled={isSubmitting || !serialNumber.trim()}>{isSubmitting ? "Menyimpan..." : "Simpan"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
