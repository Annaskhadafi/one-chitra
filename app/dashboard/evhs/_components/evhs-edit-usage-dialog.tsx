"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { updateEvhsUsage } from "@/app/actions/evhs"
import { useRouter } from "next/navigation"

const editSchema = z.object({
    woNo: z.string().min(1, "Nomor WO wajib diisi"),
    materialNumberCk: z.string().optional(),
    pos: z.string().optional(),
    unitId: z.string().optional(),
})

type EditValues = z.infer<typeof editSchema>

type EvhsTrackingUsageItem = {
    voucherId?: number | null
    voucherItemId?: number | null
    woNo?: string | null
    materialNumberCk?: string | null
    pos?: string | null
    unitId?: string | null
    materialNumberCp?: string | null
    voucherNo?: string | null
    sn?: string | null
    product?: {
        materialDescription?: string | null
    } | null
}

export function EvhsEditUsageDialog({
    open,
    onOpenChange,
    trackingItem
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    trackingItem: EvhsTrackingUsageItem | null
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    const form = useForm<EditValues>({
        resolver: zodResolver(editSchema),
        defaultValues: {
            woNo: "",
            materialNumberCk: "",
            pos: "",
            unitId: "",
        }
    })

    useEffect(() => {
        if (trackingItem && open) {
            form.reset({
                woNo: trackingItem.woNo || "",
                materialNumberCk: trackingItem.materialNumberCk !== "-" ? trackingItem.materialNumberCk : "",
                pos: trackingItem.pos || "",
                unitId: trackingItem.unitId || "",
            })
        }
    }, [trackingItem, open, form])

    const onSubmit = async (values: EditValues) => {
        if (!trackingItem || !trackingItem.voucherId || !trackingItem.voucherItemId) {
            toast.error("Data voucher tidak lengkap untuk di-edit")
            return
        }
        
        setIsSubmitting(true)
        try {
            const data = {
                voucherId: trackingItem.voucherId,
                voucherItemId: trackingItem.voucherItemId,
                woNo: values.woNo,
                materialNumberCk: values.materialNumberCk || "",
                pos: values.pos,
                unitId: values.unitId,
            }
            
            const result = await updateEvhsUsage(data)
            
            if (result.success) {
                toast.success("Data penggunaan stok berhasil diperbarui")
                onOpenChange(false)
                router.refresh()
            } else {
                toast.error("error" in result ? result.error : "Gagal memperbarui data")
            }
        } catch (_error) {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Penggunaan Barang (WO)</DialogTitle>
                </DialogHeader>
                
                {trackingItem && (
                    <div className="bg-slate-50 p-3 rounded-md border text-sm space-y-2 mb-2 mt-2">
                        <div className="font-bold text-slate-800">{trackingItem.materialNumberCp}</div>
                        <div className="text-slate-600 line-clamp-1 text-xs">{trackingItem.product?.materialDescription}</div>
                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200">
                            <div>
                                <span className="text-muted-foreground mr-2 text-xs">Voucher:</span>
                                <span className="font-bold font-mono text-xs">{trackingItem.voucherNo}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground mr-2 text-xs">S/N:</span>
                                <span className="font-bold font-mono text-xs text-emerald-700">{trackingItem.sn}</span>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label htmlFor="woNo" className="text-xs">Nomor WO (Customer)</Label>
                        <Input id="woNo" placeholder="Contoh: WO-CK-123" {...form.register("woNo")} className="h-8 text-sm" />
                        {form.formState.errors.woNo && (
                            <p className="text-xs text-red-500">{form.formState.errors.woNo.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="materialNumberCk" className="text-xs">Material Number Customer (CK)</Label>
                        <Input 
                            id="materialNumberCk" 
                            placeholder="Opsional..." 
                            {...form.register("materialNumberCk")}
                            className="h-8 text-sm" 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="pos" className="text-xs">POS (Posisi Install)</Label>
                            <Input 
                                id="pos" 
                                placeholder="Contoh: #1, #2..." 
                                {...form.register("pos")}
                                className="h-8 text-sm"  
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unitId" className="text-xs">Unit / Equipment ID</Label>
                            <Input 
                                id="unitId" 
                                placeholder="Contoh: EX-101..." 
                                {...form.register("unitId")}
                                className="h-8 text-sm"  
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-6 pt-4 border-t">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={isSubmitting}>
                            {isSubmitting ? "Menyimpan..." : "Update Data"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
