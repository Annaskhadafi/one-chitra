"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { updateEvhsAdjustmentSerialNumbers } from "@/app/actions/evhs"

type AdjustmentItem = { adjustmentId?: number; materialNumberCp?: string; qty?: number; sn?: string | null; serialNumbers?: string[] }

export function EvhsEditAdjustmentSnDialog({ open, onOpenChange, trackingItem }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    trackingItem: AdjustmentItem | null
}) {
    const router = useRouter()
    const [serialNumbers, setSerialNumbers] = useState<string[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (open) setSerialNumbers(Array.from({ length: Math.max(trackingItem?.qty || 1, 1) }, (_, index) => trackingItem?.serialNumbers?.[index] || ""))
    }, [open, trackingItem])

    const submit = async () => {
        if (!trackingItem?.adjustmentId) return
        setSaving(true)
        try {
            const result = await updateEvhsAdjustmentSerialNumbers({ adjustmentId: trackingItem.adjustmentId, serialNumbers })
            if (!result.success) throw new Error(result.error)
            toast.success("SN adjustment berhasil diperbarui")
            onOpenChange(false)
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal memperbarui SN adjustment")
        } finally {
            setSaving(false)
        }
    }

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
            <DialogHeader><DialogTitle>Edit SN Adjustment</DialogTitle></DialogHeader>
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
                {serialNumbers.map((value, index) => <Input key={index} placeholder={`SN ${index + 1} (opsional)`} value={value} onChange={(event) => setSerialNumbers((current) => current.map((sn, currentIndex) => currentIndex === index ? event.target.value : sn))} />)}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
                <Button onClick={submit} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
}
