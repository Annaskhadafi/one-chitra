"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createEvhsVoucher } from "@/app/actions/evhs"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { getEvhsMasterPrices } from "@/app/actions/evhs-master"

const batchUsageSchema = z.object({
    woNo: z.string().min(1, "Nomor WO wajib diisi"),
    pos: z.string().optional(),
    unitId: z.string().optional(),
    materialNumberCk: z.string().optional(),
    remark: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
    items: z.array(z.object({
        trackingId: z.string(),
        serialNumber: z.string(),
        productId: z.number(),
        qty: z.number()
    }))
})

type BatchUsageValues = z.infer<typeof batchUsageSchema>

type EvhsMasterPriceSuggestion = {
    warehouseId: number
    materialNumberCp: string
    materialNumberCk?: string | null
    price: string
}

type MultipleTrackingItem = {
    id: string
    warehouseId: number
    productId: number
    materialNumberCp: string
    materialNumberCk?: string | null
    sn: string
    qty?: number
    availableQty?: number
    product?: {
        materialNumberCk?: string | null
        materialDescription?: string | null
    }
}

export function EvhsMultipleUsageDialog({
    open,
    onOpenChange,
    trackingItems,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    trackingItems: MultipleTrackingItem[]
    onSuccess?: () => void
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()
    const { data: masterPrices = [] } = useQuery({
        queryKey: ["evhs-master-prices"],
        queryFn: getEvhsMasterPrices,
        enabled: open,
    })

    const suggestedMasterPrice = trackingItems.length > 0
        ? masterPrices.find((price: EvhsMasterPriceSuggestion) => (
            price.warehouseId === trackingItems[0].warehouseId &&
            price.materialNumberCp === trackingItems[0].materialNumberCp
        ))
        : null

    const form = useForm<BatchUsageValues>({
        resolver: zodResolver(batchUsageSchema),
        defaultValues: {
            woNo: "",
            pos: "",
            unitId: "",
            materialNumberCk: "",
            remark: "",
            approvedByName: "",
            receivedByName: "",
            items: []
        }
    })

    const { fields } = useFieldArray({
        control: form.control,
        name: "items"
    })

    useEffect(() => {
        if (open && trackingItems.length > 0) {
            const firstItem = trackingItems[0];
            const defaultMatCk = firstItem?.materialNumberCk && firstItem.materialNumberCk !== "-" 
                ? firstItem.materialNumberCk 
                : (suggestedMasterPrice?.materialNumberCk || firstItem?.product?.materialNumberCk || "");

            form.reset({
                woNo: "",
                pos: "",
                unitId: "",
                materialNumberCk: defaultMatCk,
                remark: "",
                approvedByName: "",
                receivedByName: "",
                items: trackingItems.map(item => ({
                    trackingId: item.id,
                    serialNumber: item.sn !== "-" && item.sn !== "N/A" ? item.sn : "",
                    productId: item.productId,
                    qty: item.availableQty ?? item.qty ?? 1
                }))
            })
        }
    }, [open, trackingItems, form, suggestedMasterPrice])

    const onSubmit = async (values: BatchUsageValues) => {
        if (trackingItems.length === 0) return
        
        setIsSubmitting(true)
        try {
            const voucherData = {
                woNo: values.woNo,
                date: new Date(),
                warehouseId: trackingItems[0].warehouseId,
                remark: values.remark,
                approvedByName: values.approvedByName,
                receivedByName: values.receivedByName,
                items: values.items.map(mapped => ({
                    productId: mapped.productId,
                    materialNumberCk: values.materialNumberCk || "",
                    qty: mapped.qty,
                    serialNumber: mapped.serialNumber || "",
                    pos: values.pos,
                    unitId: values.unitId,
                }))
            }
            
            const result = await createEvhsVoucher(voucherData)
            
            if (result.success) {
                toast.success(`Berhasil membuat 1 Voucher untuk ${trackingItems.length} item.`)
                onOpenChange(false)
                onSuccess?.()
                router.refresh()
            } else {
                toast.error(result.error || "Gagal membuat voucher batch.")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0">
                    <DialogTitle>Generate Multiple Voucher</DialogTitle>
                    <DialogDescription>
                        Membuat 1 dokumen Voucher VHS untuk {trackingItems.length} item yang dipilih dengan WO yang sama.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col flex-1 overflow-hidden mt-4">
                    <div className="grid grid-cols-2 gap-4 shrink-0">
                        <div className="space-y-2">
                            <Label htmlFor="woNo" className="text-xs">Nomor WO Keseluruhan <span className="text-red-500">*</span></Label>
                            <Input id="woNo" placeholder="Contoh: WO-CK-123" {...form.register("woNo")} className="h-8 text-sm" />
                            {form.formState.errors.woNo && (
                                <p className="text-xs text-red-500">{form.formState.errors.woNo.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="materialNumberCk" className="text-xs">Material Number Customer (CK)</Label>
                            <Input id="materialNumberCk" placeholder="Opsional..." {...form.register("materialNumberCk")} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pos" className="text-xs">POS (Posisi Install)</Label>
                            <Input id="pos" placeholder="Contoh: #1, #2..." {...form.register("pos")} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unitId" className="text-xs">Unit / Equipment ID</Label>
                            <Input id="unitId" placeholder="Contoh: EX-101..." {...form.register("unitId")} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="approvedByName" className="text-xs">Approved By (Customer)</Label>
                            <Input id="approvedByName" placeholder="Nama..." {...form.register("approvedByName")} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="receivedByName" className="text-xs">Received By (Customer)</Label>
                            <Input id="receivedByName" placeholder="Nama..." {...form.register("receivedByName")} className="h-8 text-sm" />
                        </div>
                        <div className="col-span-2 space-y-2">
                            <Label htmlFor="remark" className="text-xs">Remark / Catatan</Label>
                            <Input id="remark" placeholder="Keterangan tambahan..." {...form.register("remark")} className="h-8 text-sm" />
                        </div>
                    </div>

                    {suggestedMasterPrice && (
                        <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                            Saran master price untuk item pertama:
                            {" "}
                            CK <span className="font-bold">{suggestedMasterPrice.materialNumberCk || "-"}</span>
                            {" "} | Harga <span className="font-bold">{Number(suggestedMasterPrice.price).toLocaleString("id-ID", { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 mt-4">
                        <Label className="text-xs font-semibold text-slate-700">Daftar Item Terpilih ({fields.length}):</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {fields.map((field) => {
                                const originalItem = trackingItems.find(t => t.id === field.trackingId)
                                return (
                                    <div key={field.id} className="bg-slate-50 border border-slate-200 rounded-md p-3 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-xs">{originalItem?.materialNumberCp}</span>
                                            <span className="text-[10px] text-slate-500">{originalItem?.product?.materialDescription}</span>
                                        </div>
                                        <div className="font-mono text-xs font-semibold px-2 py-1 bg-slate-200 rounded shrink-0">{originalItem?.sn}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <DialogFooter className="mt-4 pt-4 border-t shrink-0">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={isSubmitting}>
                            {isSubmitting ? "Menyimpan..." : "Generate & Simpan"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
