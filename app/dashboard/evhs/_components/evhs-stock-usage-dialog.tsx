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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createEvhsVoucher } from "@/app/actions/evhs"
import { useQuery } from "@tanstack/react-query"
import { getEvhsMasterPrices } from "@/app/actions/evhs-master"
import { useRouter } from "next/navigation"

const usageSchema = z.object({
    woNo: z.string().min(1, "Nomor WO wajib diisi"),
    qty: z.number().min(1, "Qty harus minimal 1"),
    materialNumberCk: z.string().optional(),
    serialNumber: z.string().optional(),
    pos: z.string().optional(),
    unitId: z.string().optional(),
    remark: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
})

type UsageValues = z.infer<typeof usageSchema>

type EvhsMasterPriceSuggestion = {
    warehouseId: number
    materialNumberCp: string
    materialNumberCk?: string | null
    price: string
}

type TrackingDialogItem = {
    warehouseId: number
    productId: number
    materialNumberCp: string
    materialNumberCk?: string | null
    sn: string
    qty?: number
    availableQty?: number
    cpDo?: string | null
    sourceType?: "receipt" | "legacy-stock"
    product: {
        materialDescription?: string | null
        materialNumberCk?: string | null
        category?: string | null
    }
}

export function EvhsStockUsageDialog({
    open,
    onOpenChange,
    trackingItem
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    trackingItem: TrackingDialogItem | null
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()
    const { data: masterPrices = [] } = useQuery({
        queryKey: ["evhs-master-prices"],
        queryFn: getEvhsMasterPrices,
        enabled: open,
    })

    const suggestedMasterPrice = trackingItem
        ? masterPrices.find((price: EvhsMasterPriceSuggestion) => (
            price.warehouseId === trackingItem.warehouseId &&
            price.materialNumberCp === trackingItem.materialNumberCp
        ))
        : null
    const suggestedMaterialCk = suggestedMasterPrice?.materialNumberCk || ""

    const form = useForm<UsageValues>({
        resolver: zodResolver(usageSchema),
        defaultValues: {
            woNo: "",
            qty: 1,
            materialNumberCk: "",
            serialNumber: "",
            pos: "",
            unitId: "",
            remark: "",
            approvedByName: "",
            receivedByName: "",
        }
    })

    // Update form when tracking item changes
    // Update form when tracking item changes
    useEffect(() => {
        if (trackingItem) {
            const availableQty = trackingItem.availableQty ?? trackingItem.qty ?? 1
            const isLegacyTyre = trackingItem.sourceType === "legacy-stock" && trackingItem.product.category?.toUpperCase() === "TYRE"

            form.reset({
                woNo: "",
                qty: isLegacyTyre ? 1 : availableQty,
                materialNumberCk: trackingItem.materialNumberCk && trackingItem.materialNumberCk !== "-"
                    ? trackingItem.materialNumberCk
                    : (suggestedMaterialCk || trackingItem.product.materialNumberCk || ""),
                serialNumber: trackingItem.sn !== "-" && trackingItem.sn !== "N/A" ? trackingItem.sn : "",
                pos: "",
                unitId: "",
                remark: "",
                approvedByName: "",
                receivedByName: "",
            })
        }
    }, [trackingItem, form, suggestedMaterialCk])

    const onSubmit = async (values: UsageValues) => {
        if (!trackingItem) return

        const availableQty = trackingItem.availableQty ?? trackingItem.qty ?? 0

        if (values.qty > availableQty) {
            toast.error(`Qty melebihi stok tersedia. Tersedia ${availableQty}.`)
            return
        }
        
        setIsSubmitting(true)
        try {
            const voucherData = {
                woNo: values.woNo,
                date: new Date(),
                warehouseId: trackingItem.warehouseId,
                remark: values.remark,
                approvedByName: values.approvedByName,
                receivedByName: values.receivedByName,
                items: [{
                    productId: trackingItem.productId,
                    qty: values.qty,
                    serialNumber: values.serialNumber,
                    sourceType: trackingItem.sourceType || "receipt",
                    materialNumberCk: values.materialNumberCk || "",
                    pos: values.pos,
                    unitId: values.unitId,
                    stockBalance: 0, // No longer strictly needed or calculated properly here
                }]
            }

            const result = await createEvhsVoucher(voucherData)
            if (result.success) {
                toast.success(`Voucher ${result.vhsNo} berhasil dibuat`)
                onOpenChange(false)
                form.reset()
                router.refresh()
            } else {
                toast.error(result.error || "Gagal membuat voucher")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!trackingItem) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Input Penggunaan Barang (WO)</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="p-3 bg-muted rounded-md space-y-1">
                        <p className="text-sm font-bold">{trackingItem.materialNumberCp}</p>
                        <p className="text-xs text-muted-foreground">{trackingItem.product.materialDescription}</p>
                        <p className="text-xs font-mono">Diterima dari DO: <span className="font-bold">{trackingItem.cpDo || "N/A"}</span></p>
                        <p className="text-xs font-mono">Stok tersedia: <span className="font-bold">{trackingItem.availableQty ?? trackingItem.qty ?? 0}</span></p>
                        {suggestedMasterPrice && (
                            <p className="text-xs font-mono">
                                Saran Master CK: <span className="font-bold text-blue-700">{suggestedMasterPrice.materialNumberCk || "-"}</span>
                                {" "} | Harga: <span className="font-bold text-emerald-700">{Number(suggestedMasterPrice.price).toLocaleString("id-ID", { minimumFractionDigits: 2 })}</span>
                            </p>
                        )}
                        {trackingItem.sn !== "-" && trackingItem.sn !== "N/A" && (
                            <p className="text-xs font-mono mt-2">Serial Number Asal: <Badge variant="secondary">{trackingItem.sn}</Badge></p>
                        )}
                        {trackingItem.sourceType === "legacy-stock" && trackingItem.product.category?.toUpperCase() === "TYRE" && (
                            <p className="text-xs font-mono mt-2 text-indigo-700">
                                Stock legacy TYRE: input 1 SN per voucher dari tab Stock All VHS.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="woNo">Nomor WO (Customer)</Label>
                            <Input id="woNo" placeholder="Contoh: WO-CK-123" {...form.register("woNo")} />
                            {form.formState.errors.woNo && (
                                <p className="text-xs text-red-500">{form.formState.errors.woNo.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="qty">Quantity Terpakai</Label>
                            <Input 
                                id="qty" 
                                type="number" 
                                max={trackingItem.availableQty ?? trackingItem.qty ?? 1}
                                disabled={trackingItem.sn !== "-" && trackingItem.sn !== "N/A"}
                                {...form.register("qty", { valueAsNumber: true })} 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="serialNumber">Serial Number (jika Ban)</Label>
                            <Input 
                                id="serialNumber" 
                                placeholder="Masukan SN..." 
                                {...form.register("serialNumber")} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="materialNumberCk">Material Number Customer (CK)</Label>
                            <Input 
                                id="materialNumberCk" 
                                placeholder="Opsional..." 
                                {...form.register("materialNumberCk")} 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="pos">POS (Posisi Install)</Label>
                            <Input 
                                id="pos" 
                                placeholder="Contoh: #1, #2..." 
                                {...form.register("pos")} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unitId">Unit / Equipment ID</Label>
                            <Input 
                                id="unitId" 
                                placeholder="Contoh: EX-101..." 
                                {...form.register("unitId")} 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="approvedByName">Approved By (Customer)</Label>
                            <Input id="approvedByName" placeholder="Nama..." {...form.register("approvedByName")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="receivedByName">Received By (Customer)</Label>
                            <Input id="receivedByName" placeholder="Nama..." {...form.register("receivedByName")} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="remark">Remark</Label>
                        <Textarea id="remark" placeholder="Keterangan tambahan..." {...form.register("remark")} />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Memproses..." : "Generate Voucher VHS"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
