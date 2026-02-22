"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { createStockOpnameSession } from "@/app/actions/stock-opname"
import { createOpnameSessionSchema } from "@/lib/schemas"
import { z } from "zod"
import type { Warehouse } from "@/lib/types"

interface CreateSessionDialogProps {
    warehouses: Warehouse[]
}

type FormValues = z.infer<typeof createOpnameSessionSchema>

export function CreateSessionDialog({ warehouses }: CreateSessionDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const form = useForm<FormValues>({
        resolver: zodResolver(createOpnameSessionSchema),
        defaultValues: {
            name: "",
            warehouseId: 0,
            notes: "",
        },
    })

    async function onSubmit(values: FormValues) {
        setLoading(true)
        try {
            const result = await createStockOpnameSession(values)
            if (result.success && result.sessionId) {
                toast.success("Sesi stock opname berhasil dibuat")
                setOpen(false)
                form.reset()
                router.push(`/dashboard/stock-opname/${result.sessionId}`)
            } else {
                toast.error(result.error ?? "Gagal membuat sesi")
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Buat Sesi Opname
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Buat Sesi Stock Opname</DialogTitle>
                    <DialogDescription>
                        Sesi baru akan mengambil data stok saat ini sebagai referensi. Kemudian tim gudang bisa mengisi hitungan fisik.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nama Sesi</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Cth: Opname Bulanan Feb 2026"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="warehouseId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Warehouse / Lokasi</FormLabel>
                                    <Select
                                        onValueChange={(v) => field.onChange(parseInt(v))}
                                        value={field.value ? String(field.value) : ""}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih warehouse" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {warehouses.map((w) => (
                                                <SelectItem key={w.id} value={String(w.id)}>
                                                    {w.sloc}
                                                    {w.description ? ` — ${w.description}` : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Catatan (opsional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Keterangan tambahan..."
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={loading}
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Buat & Mulai
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
