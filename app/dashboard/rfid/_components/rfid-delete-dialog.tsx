"use client"

import { useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { bulkDeleteRfidScansAction, deleteRfidScanAction } from "@/app/actions/rfid"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface RfidDeleteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    targetId?: number | null
    targetIds?: number[]
    targetLabel?: string
    onSuccess?: () => void
}

export function RfidDeleteDialog({
    open,
    onOpenChange,
    targetId,
    targetIds = [],
    targetLabel,
    onSuccess,
}: RfidDeleteDialogProps) {
    const [loading, setLoading] = useState(false)

    const isBulk = targetIds.length > 0 && !targetId
    const itemCount = isBulk ? targetIds.length : 1

    const handleDelete = async () => {
        setLoading(true)

        try {
            if (isBulk) {
                const res = await bulkDeleteRfidScansAction(targetIds)
                if (res.success) {
                    toast.success(`Berhasil menghapus ${res.count} data RFID`)
                    onOpenChange(false)
                    onSuccess?.()
                } else {
                    toast.error(res.error || "Gagal menghapus data RFID")
                }
            } else if (targetId) {
                const res = await deleteRfidScanAction(targetId)
                if (res.success) {
                    toast.success("Data RFID berhasil dihapus")
                    onOpenChange(false)
                    onSuccess?.()
                } else {
                    toast.error(res.error || "Gagal menghapus data RFID")
                }
            }
        } catch (err) {
            console.error(err)
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="size-5" />
                        Konfirmasi Hapus Data RFID
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2 text-sm text-muted-foreground">
                        <span>
                            Apakah Anda yakin ingin menghapus{" "}
                            <strong className="text-foreground">
                                {isBulk
                                    ? `${itemCount} record RFID terpilih`
                                    : targetLabel
                                    ? `RFID ${targetLabel}`
                                    : `Record RFID #${targetId}`}
                            </strong>
                            ?
                        </span>
                        <p className="text-xs text-destructive/90 font-medium">
                            Tindakan ini akan menghapus data dari database secara permanen dan tidak dapat dikembalikan.
                        </p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault()
                            handleDelete()
                        }}
                        disabled={loading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                        {isBulk ? `Hapus ${itemCount} Record` : "Hapus Data"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
