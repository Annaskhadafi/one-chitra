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
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { updateEvhsVoucher } from "@/app/actions/evhs"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

const editVoucherSchema = z.object({
    id: z.number(),
    woNo: z.string().optional(),
    date: z.date(),
    remark: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
})

type EditVoucherValues = z.infer<typeof editVoucherSchema>
type EditableVoucher = {
    id: number
    vhsNo: string
    woNo?: string | null
    date?: string | Date | null
    remark?: string | null
    approvedByName?: string | null
    receivedByName?: string | null
}

export function EvhsEditVoucherDialog({
    open,
    onOpenChange,
    voucher
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    voucher: EditableVoucher | null
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    const form = useForm<EditVoucherValues>({
        resolver: zodResolver(editVoucherSchema),
        defaultValues: {
            id: 0,
            woNo: "",
            date: new Date(),
            remark: "",
            approvedByName: "",
            receivedByName: ""
        }
    })

    useEffect(() => {
        if (open && voucher) {
            form.reset({
                id: voucher.id,
                woNo: voucher.woNo || "",
                date: voucher.date ? new Date(voucher.date) : new Date(),
                remark: voucher.remark || "",
                approvedByName: voucher.approvedByName || "",
                receivedByName: voucher.receivedByName || ""
            })
        }
    }, [open, voucher, form])

    const onSubmit = async (values: EditVoucherValues) => {
        setIsSubmitting(true)
        try {
            const result = await updateEvhsVoucher({
                ...values,
                date: format(values.date, "yyyy-MM-dd"),
            })

            if (result.success) {
                toast.success("Berhasil memperbarui data Voucher.")
                onOpenChange(false)
                router.refresh()
            } else {
                toast.error(result.error || "Gagal memperbarui voucher.")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!voucher) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Voucher VHS</DialogTitle>
                    <DialogDescription>
                        Ubah detail informasi referensi untuk {voucher.vhsNo}.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Tanggal Pembuatan <span className="text-red-500">*</span></Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !form.getValues("date") && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {form.getValues("date") ? format(form.getValues("date"), "PPP") : <span>Pilih tanggal</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={form.watch("date")}
                                    onSelect={(date) => date && form.setValue("date", date)}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="woNo" className="text-xs">Nomor WO Keseluruhan</Label>
                        <Input id="woNo" placeholder="Contoh: WO-CK-123" {...form.register("woNo")} className="h-8" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="remark" className="text-xs">Remark / Catatan</Label>
                        <Input id="remark" placeholder="Opsional..." {...form.register("remark")} className="h-8" />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="approvedByName" className="text-xs">Approved By (Customer)</Label>
                        <Input id="approvedByName" placeholder="Nama..." {...form.register("approvedByName")} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="receivedByName" className="text-xs">Received By (Customer)</Label>
                        <Input id="receivedByName" placeholder="Nama..." {...form.register("receivedByName")} className="h-8 text-sm" />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                            {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
