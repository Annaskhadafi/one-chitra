"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { updateEvhsReceiptSerialNumber } from "@/app/actions/evhs"

type BulkItem = { id: string; receiptItemId?: number; sn?: string | null; materialNumberCp: string }

export function EvhsBulkEditReceiptSnDialog({ open, onOpenChange, items, onSuccess }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    items: BulkItem[]
    onSuccess: () => void
}) {
    const [values, setValues] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (open) setValues(Object.fromEntries(items.map((item) => [item.id, item.sn && item.sn !== "-" ? item.sn : ""])))
    }, [open, items])

    const submit = async () => {
        const changes = items.filter((item) => item.receiptItemId && values[item.id]?.trim())
        if (!changes.length) return
        setSaving(true)
        try {
            for (const item of changes) {
                const result = await updateEvhsReceiptSerialNumber({
                    receiptItemId: item.receiptItemId!,
                    currentSerialNumber: item.sn && item.sn !== "-" ? item.sn : "",
                    serialNumber: values[item.id].trim(),
                })
                if (!result.success) throw new Error(result.error)
            }
            toast.success(`${changes.length} SN berhasil diperbarui`)
            onOpenChange(false)
            onSuccess()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal memperbarui SN")
        } finally {
            setSaving(false)
        }
    }

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
            <DialogHeader><DialogTitle>Bulk Edit SN Receipt</DialogTitle></DialogHeader>
            <div className="max-h-[420px] space-y-3 overflow-y-auto">
                {items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_1fr] items-center gap-3">
                    <span className="truncate text-sm">{item.materialNumberCp} <span className="text-muted-foreground">({item.sn || "-"})</span></span>
                    <Input value={values[item.id] || ""} onChange={(event) => setValues((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Input SN" />
                </div>)}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
                <Button onClick={submit} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
}
