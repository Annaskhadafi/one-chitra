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
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { confirmEvhsReceipt } from "@/app/actions/evhs"

const confirmSchema = z.object({
    receivedDate: z.string().min(1, "Tanggal datang wajib diisi"),
    doChitraNo: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        productId: z.number(),
        materialNumber: z.string(),
        materialDescription: z.string().optional(),
        productCategory: z.string().optional(),
        requiresSerialNumber: z.boolean().optional(),
        confirmedQty: z.number().min(0),
        serialNumbers: z.string().optional(), // String of SNs separated by comma/newline
    }))
})

type ConfirmValues = z.infer<typeof confirmSchema>
type TransferDeliveryItem = {
    productId: number
    serialNumbers?: string[] | null
    product?: {
        category?: string | null
        materialNumber?: string | null
        materialDescription?: string | null
    } | null
}
type TransferItem = {
    productId: number
    quantity: number
    product: {
        category?: string | null
        materialNumber: string
        materialDescription: string | null
    }
}
type PendingReceiptTransfer = {
    id: number
    delivery?: {
        deliveryNumber?: string | null
        items?: TransferDeliveryItem[]
    } | null
    items: TransferItem[]
}

function isTyreCategory(category?: string | null) {
    const normalizedCategory = category?.trim().toUpperCase() ?? ""
    return normalizedCategory === "TYRE" || normalizedCategory === "TIRE" || normalizedCategory.includes("TYRE") || normalizedCategory.includes("TIRE")
}

function shouldRequireSerialNumber(input: {
    productCategory?: string | null
    materialNumber?: string | null
    materialDescription?: string | null
    deliveryCategory?: string | null
    existingSerialNumbers?: string[] | null
}) {
    if (input.existingSerialNumbers?.length) {
        return true
    }

    if (isTyreCategory(input.productCategory) || isTyreCategory(input.deliveryCategory)) {
        return true
    }

    const searchableText = [
        input.materialNumber,
        input.materialDescription,
    ]
        .filter(Boolean)
        .join(" ")
        .toUpperCase()

    return /\bTYRE\b|\bTIRE\b/.test(searchableText)
}

export function EvhsReceiptConfirmDialog({
    open,
    onOpenChange,
    transfer
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    transfer: PendingReceiptTransfer | null
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<ConfirmValues>({
        resolver: zodResolver(confirmSchema),
        defaultValues: {
            receivedDate: new Date().toISOString().slice(0, 10),
            doChitraNo: "",
            notes: "",
            items: []
        }
    })

    useEffect(() => {
        if (transfer) {
            form.reset({
                receivedDate: new Date().toISOString().slice(0, 10),
                doChitraNo: transfer.delivery?.deliveryNumber || "",
                notes: "",
                items: transfer.items.map((item) => {
                    // Try to find matching delivery item to get pre-populated serial numbers
                    const deliveryItem = transfer.delivery?.items?.find(
                        (deliveryEntry) => deliveryEntry.productId === item.productId
                    )
                    const existingSn = deliveryItem?.serialNumbers?.join("\n") || ""
                    const requiresSerialNumber = shouldRequireSerialNumber({
                        productCategory: item.product.category,
                        materialNumber: item.product.materialNumber,
                        materialDescription: item.product.materialDescription,
                        deliveryCategory: deliveryItem?.product?.category,
                        existingSerialNumbers: deliveryItem?.serialNumbers,
                    })

                    return {
                        productId: item.productId,
                        materialNumber: item.product.materialNumber,
                        materialDescription: item.product.materialDescription ?? undefined,
                        productCategory: item.product.category ?? undefined,
                        requiresSerialNumber,
                        confirmedQty: item.quantity,
                        serialNumbers: requiresSerialNumber ? existingSn : ""
                    }
                })
            })
        }
    }, [transfer, form])

    const onSubmit = async (values: ConfirmValues) => {
        if (!transfer) {
            toast.error("Data transfer tidak tersedia")
            return
        }

        setIsSubmitting(true)
        try {
            const formattedData = {
                transferId: transfer.id,
                receivedDate: new Date(values.receivedDate),
                doChitraNo: values.doChitraNo,
                notes: values.notes,
                items: values.items.map(item => ({
                    productId: item.productId,
                    confirmedQty: item.confirmedQty,
                    serialNumbers: item.requiresSerialNumber
                        ? item.serialNumbers
                        ? item.serialNumbers.split(/[\n,]+/).map(sn => sn.trim()).filter(Boolean)
                        : []
                        : []
                }))
            }

            const result = await confirmEvhsReceipt(formattedData)
            if (result.success) {
                toast.success("Penerimaan barang berhasil dikonfirmasi")
                onOpenChange(false)
            } else {
                toast.error("error" in result ? result.error || "Gagal mengkonfirmasi penerimaan" : "Gagal mengkonfirmasi penerimaan")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!transfer) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90dvh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle>Konfirmasi Penerimaan Barang</DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-24">
                        <div className="space-y-6 py-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="receivedDate">Tanggal Datang</Label>
                                    <Input
                                        id="receivedDate"
                                        type="date"
                                        {...form.register("receivedDate")}
                                    />
                                    {form.formState.errors.receivedDate && (
                                        <p className="text-xs text-red-500">{form.formState.errors.receivedDate.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="doChitraNo">No DO Chitra</Label>
                                    <Input
                                        id="doChitraNo"
                                        placeholder="Contoh: DO-2024-001"
                                        {...form.register("doChitraNo")}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-base font-bold">Item & Validasi Serial Number</Label>
                                {form.watch("items").map((item, index) => (
                                    <div key={item.productId} className="space-y-3 rounded-lg border bg-muted/30 p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-bold">{item.materialNumber}</p>
                                                <p className="text-xs text-muted-foreground">{item.materialDescription}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-muted-foreground uppercase">Target Qty</p>
                                                <p className="text-sm font-mono font-bold">{item.confirmedQty}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Ubah Qty Diterima (jika berbeda)</Label>
                                                <Input
                                                    type="number"
                                                    className="h-8 w-24"
                                                    {...form.register(`items.${index}.confirmedQty`, { valueAsNumber: true })}
                                                />
                                            </div>
                                            {item.requiresSerialNumber ? (
                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold">Serial Numbers (Pisahkan dengan Baris Baru/Koma)</Label>
                                                    <Textarea
                                                        placeholder="Input SN tyre di sini..."
                                                        className="h-32 resize-y overflow-y-auto text-xs font-mono"
                                                        {...form.register(`items.${index}.serialNumbers`)}
                                                    />
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Catatan (Opsional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Tambahkan catatan tambahan jika perlu..."
                                    className="min-h-24"
                                    {...form.register("notes")}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="relative z-10 shrink-0 border-t bg-background p-6 pt-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Menyimpan..." : "Konfirmasi & Simpan"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
