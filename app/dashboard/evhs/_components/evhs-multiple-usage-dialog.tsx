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
import { Badge } from "@/components/ui/badge"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { createEvhsVoucher } from "@/app/actions/evhs"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { getEvhsMasterPrices } from "@/app/actions/evhs-master"

const batchUsageItemSchema = z.object({
    trackingId: z.string(),
    serialNumber: z.string().optional(),
    productId: z.number(),
    qty: z.number().min(1, "Qty minimal 1"),
    availableQty: z.number().optional(),
    materialNumberCk: z.string().optional(),
    sourceType: z.enum(["receipt", "legacy-stock"]).optional(),
    category: z.string().optional(),
})

const batchUsageSchema = z.object({
    woNo: z.string().min(1, "Nomor WO wajib diisi"),
    pos: z.string().optional(),
    unitId: z.string().optional(),
    remark: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
    items: z.array(batchUsageItemSchema).min(1, "Pilih minimal 1 item"),
}).superRefine((values, ctx) => {
    values.items.forEach((item, index) => {
        if (typeof item.availableQty === "number" && item.qty > item.availableQty) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["items", index, "qty"],
                message: `Qty melebihi stok tersedia (${item.availableQty}).`,
            })
        }

        const isLegacyTyre = item.sourceType === "legacy-stock" && item.category?.toUpperCase() === "TYRE"
        if (isLegacyTyre && !item.serialNumber?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["items", index, "serialNumber"],
                message: "SN wajib diisi untuk stock legacy TYRE.",
            })
        }

        if (item.serialNumber?.trim() && item.qty !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["items", index, "qty"],
                message: "Qty item dengan SN harus 1.",
            })
        }
    })
})

type BatchUsageValues = z.infer<typeof batchUsageSchema>

type EvhsMasterPriceSuggestion = {
    warehouseId: number
    materialNumberCp: string
    materialNumberCk?: string | null
    price: string
}

const EMPTY_MASTER_PRICES: EvhsMasterPriceSuggestion[] = []

type MultipleTrackingItem = {
    id: string
    warehouseId: number
    warehouseLabel?: string
    productId: number
    materialNumberCp: string
    materialNumberCk?: string | null
    sn: string
    qty?: number
    availableQty?: number
    defaultQty?: number
    sourceType?: "receipt" | "legacy-stock"
    product?: {
        materialNumberCk?: string | null
        materialDescription?: string | null
        category?: string | null
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
    const { data } = useQuery({
        queryKey: ["evhs-master-prices"],
        queryFn: getEvhsMasterPrices,
        enabled: open,
    })
    const masterPrices = data ?? EMPTY_MASTER_PRICES
    const firstWarehouseId = trackingItems[0]?.warehouseId

    const form = useForm<BatchUsageValues>({
        resolver: zodResolver(batchUsageSchema),
        defaultValues: {
            woNo: "",
            pos: "",
            unitId: "",
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
            form.reset({
                woNo: "",
                pos: "",
                unitId: "",
                remark: "",
                approvedByName: "",
                receivedByName: "",
                items: trackingItems.map(item => ({
                    trackingId: item.id,
                    serialNumber: item.sn !== "-" && item.sn !== "N/A" ? item.sn : "",
                    productId: item.productId,
                    qty: item.defaultQty ?? item.availableQty ?? item.qty ?? 1,
                    availableQty: item.availableQty ?? item.qty ?? 0,
                    materialNumberCk: item.materialNumberCk && item.materialNumberCk !== "-"
                        ? item.materialNumberCk
                        : (
                            masterPrices.find((price: EvhsMasterPriceSuggestion) => (
                                price.warehouseId === item.warehouseId &&
                                price.materialNumberCp === item.materialNumberCp
                            ))?.materialNumberCk ||
                            item.product?.materialNumberCk ||
                            ""
                        ),
                    sourceType: item.sourceType,
                    category: item.product?.category || undefined,
                }))
            })
        }
    }, [open, trackingItems, form, masterPrices])

    const onSubmit = async (values: BatchUsageValues) => {
        if (trackingItems.length === 0) return
        if (trackingItems.some((item) => item.warehouseId !== trackingItems[0].warehouseId)) {
            toast.error("Multiple voucher hanya bisa dibuat untuk item dalam warehouse yang sama.")
            return
        }

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
                    materialNumberCk: mapped.materialNumberCk || "",
                    qty: mapped.qty,
                    serialNumber: mapped.serialNumber || "",
                    sourceType: mapped.sourceType || "receipt",
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
                        Membuat 1 dokumen Voucher VHS untuk {trackingItems.length} item terpilih dalam 1 warehouse.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col flex-1 overflow-hidden mt-4">
                    <div className="grid grid-cols-1 gap-4 shrink-0 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="woNo" className="text-xs">Nomor WO Keseluruhan <span className="text-red-500">*</span></Label>
                            <Input id="woNo" placeholder="Contoh: WO-CK-123" {...form.register("woNo")} className="h-8 text-sm" />
                            {form.formState.errors.woNo && (
                                <p className="text-xs text-red-500">{form.formState.errors.woNo.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Warehouse</Label>
                            <div className="flex h-8 items-center rounded-md border bg-slate-50 px-3 text-sm text-slate-700">
                                {trackingItems[0]?.warehouseLabel || (firstWarehouseId ? `Warehouse ID ${firstWarehouseId}` : "-")}
                            </div>
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
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="remark" className="text-xs">Remark / Catatan</Label>
                            <Input id="remark" placeholder="Keterangan tambahan..." {...form.register("remark")} className="h-8 text-sm" />
                        </div>
                    </div>

                    <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                        Bundle voucher ini akan memakai WO, POS, Unit ID, approver, dan receiver yang sama untuk semua item terpilih.
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 mt-4">
                        <Label className="text-xs font-semibold text-slate-700">Daftar Item Terpilih ({fields.length}):</Label>
                        <div className="space-y-3">
                            {fields.map((field, index) => {
                                const originalItem = trackingItems.find(t => t.id === field.trackingId)
                                const suggestedMasterPrice = masterPrices.find((price: EvhsMasterPriceSuggestion) => (
                                    price.warehouseId === originalItem?.warehouseId &&
                                    price.materialNumberCp === originalItem?.materialNumberCp
                                ))
                                const isLegacyTyre = originalItem?.sourceType === "legacy-stock" && originalItem?.product?.category?.toUpperCase() === "TYRE"

                                return (
                                    <div key={field.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-xs">{originalItem?.materialNumberCp}</span>
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {originalItem?.product?.category || "ITEM"}
                                                    </Badge>
                                                    <Badge variant={originalItem?.sourceType === "legacy-stock" ? "secondary" : "outline"} className="text-[10px]">
                                                        {originalItem?.sourceType === "legacy-stock" ? "Legacy Stock" : "Receipt EVHS"}
                                                    </Badge>
                                                </div>
                                                <span className="block text-[10px] text-slate-500">{originalItem?.product?.materialDescription}</span>
                                                <span className="block text-[10px] text-slate-500">
                                                    Stock tersedia: {originalItem?.availableQty ?? originalItem?.qty ?? 0}
                                                </span>
                                                {suggestedMasterPrice && (
                                                    <span className="block text-[10px] text-blue-700">
                                                        Saran CK: <strong>{suggestedMasterPrice.materialNumberCk || "-"}</strong>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="rounded bg-slate-200 px-2 py-1 font-mono text-xs font-semibold">
                                                SN asal: {originalItem?.sn || "-"}
                                            </div>
                                        </div>

                                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                                            <div className="space-y-2">
                                                <Label htmlFor={`items.${index}.qty`} className="text-xs">Qty</Label>
                                                <Input
                                                    id={`items.${index}.qty`}
                                                    type="number"
                                                    min={1}
                                                    max={originalItem?.availableQty ?? originalItem?.qty ?? 1}
                                                    className="h-8 text-sm"
                                                    {...form.register(`items.${index}.qty`, { valueAsNumber: true })}
                                                />
                                                {form.formState.errors.items?.[index]?.qty && (
                                                    <p className="text-xs text-red-500">{form.formState.errors.items[index]?.qty?.message}</p>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`items.${index}.materialNumberCk`} className="text-xs">Material Number CK</Label>
                                                <Input
                                                    id={`items.${index}.materialNumberCk`}
                                                    placeholder="Opsional..."
                                                    className="h-8 text-sm"
                                                    {...form.register(`items.${index}.materialNumberCk`)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`items.${index}.serialNumber`} className="text-xs">
                                                    Serial Number {isLegacyTyre ? <span className="text-red-500">*</span> : null}
                                                </Label>
                                                <Input
                                                    id={`items.${index}.serialNumber`}
                                                    placeholder={isLegacyTyre ? "Wajib isi SN" : "Opsional..."}
                                                    className="h-8 text-sm font-mono"
                                                    {...form.register(`items.${index}.serialNumber`)}
                                                />
                                                {form.formState.errors.items?.[index]?.serialNumber && (
                                                    <p className="text-xs text-red-500">{form.formState.errors.items[index]?.serialNumber?.message}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <DialogFooter className="mt-4 border-t pt-4 shrink-0 flex-col-reverse gap-2 sm:flex-row">
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
