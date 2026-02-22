"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { priceListSchema } from "@/lib/schemas"
import { upsertPriceList, deletePriceList } from "@/app/actions/price-management"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, ChevronRight, Tags, Clock, Users, Zap } from "lucide-react"
import { PriceListItemsView } from "./price-list-items-view"
import type { getPriceLists } from "@/app/actions/price-management"

type PriceList = Awaited<ReturnType<typeof getPriceLists>>[number]

const typeConfig = {
    tier: { label: "Tier", icon: Zap, color: "bg-blue-100 text-blue-700 border-blue-200" },
    customer: { label: "Customer", icon: Users, color: "bg-violet-100 text-violet-700 border-violet-200" },
    promotional: { label: "Promo", icon: Tags, color: "bg-orange-100 text-orange-700 border-orange-200" },
} as const

interface Props {
    priceLists: PriceList[]
}

export function PriceListsTab({ priceLists }: Props) {
    const router = useRouter()
    const [selected, setSelected] = useState<PriceList | null>(null)
    const [editTarget, setEditTarget] = useState<PriceList | null>(null)
    const [createOpen, setCreateOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleDelete = (id: number) => {
        startTransition(async () => {
            await deletePriceList(id)
            if (selected?.id === id) setSelected(null)
            router.refresh()
        })
    }

    if (selected) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSelected(null)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Price Lists
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{selected.name}</span>
                </div>
                <PriceListItemsView priceList={selected} />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Pilih price list untuk melihat & mengelola item harga.</p>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Buat Price List
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {priceLists.length === 0 && (
                    <div className="col-span-full text-center py-16 text-muted-foreground">
                        <Tags className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p>Belum ada price list. Buat yang pertama!</p>
                    </div>
                )}
                {priceLists.map((pl) => {
                    const typeInfo = typeConfig[pl.type]
                    const TypeIcon = typeInfo.icon
                    const isExpired = pl.validUntil && new Date(pl.validUntil) < new Date()
                    return (
                        <div
                            key={pl.id}
                            className={`rounded-xl border bg-card p-5 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow ${isExpired ? 'opacity-60' : ''}`}
                            onClick={() => setSelected(pl)}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col gap-1 min-w-0">
                                    <p className="font-semibold text-sm leading-tight truncate">{pl.name}</p>
                                    {pl.customer && (
                                        <p className="text-xs text-muted-foreground truncate">{pl.customer.name}</p>
                                    )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeInfo.color}`}>
                                        <TypeIcon className="h-3 w-3 mr-0.5" />
                                        {typeInfo.label}
                                    </Badge>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                        {new Date(pl.validFrom).toLocaleDateString("id-ID")}
                                        {" — "}
                                        {pl.validUntil ? new Date(pl.validUntil).toLocaleDateString("id-ID") : "Permanent"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>{pl.items.length} item(s)</span>
                                    <span className={`font-medium ${pl.isActive && !isExpired ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {isExpired ? 'Expired' : pl.isActive ? 'Aktif' : 'Non-aktif'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setEditTarget(pl)}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Hapus Price List?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Tindakan ini akan menghapus &quot;{pl.name}&quot; beserta semua item dan histori harga. Tidak dapat dibatalkan.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction
                                                className="bg-red-600 hover:bg-red-700"
                                                onClick={() => handleDelete(pl.id)}
                                                disabled={isPending}
                                            >
                                                Hapus
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Create Dialog */}
            <PriceListDialog open={createOpen} onOpenChange={setCreateOpen} />
            {/* Edit Dialog */}
            {editTarget && (
                <PriceListDialog
                    open={!!editTarget}
                    onOpenChange={(v) => { if (!v) setEditTarget(null) }}
                    defaultValues={editTarget}
                />
            )}
        </div>
    )
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

interface DialogProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    defaultValues?: PriceList
}

function PriceListDialog({ open, onOpenChange, defaultValues }: DialogProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const form = useForm<z.infer<typeof priceListSchema>>({
        resolver: zodResolver(priceListSchema),
        defaultValues: defaultValues
            ? {
                name: defaultValues.name,
                type: defaultValues.type,
                customerId: defaultValues.customerId ?? undefined,
                currency: defaultValues.currency,
                validFrom: new Date(defaultValues.validFrom),
                validUntil: defaultValues.validUntil ? new Date(defaultValues.validUntil) : undefined,
                isActive: defaultValues.isActive,
                notes: defaultValues.notes ?? "",
            }
            : { name: "", type: "tier", currency: "IDR", isActive: true, validFrom: new Date() },
    })

    const onSubmit = (data: z.infer<typeof priceListSchema>) => {
        startTransition(async () => {
            const result = await upsertPriceList(data, defaultValues?.id)
            if (result.success) {
                onOpenChange(false)
                form.reset()
                router.refresh()
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{defaultValues ? "Edit" : "Buat"} Price List</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nama Price List</FormLabel>
                                <FormControl>
                                    <Input placeholder="mis. PL Tier A 2025" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="type" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipe</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih tipe" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="tier">Tier</SelectItem>
                                            <SelectItem value="customer">Customer</SelectItem>
                                            <SelectItem value="promotional">Promotional</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="currency" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mata Uang</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="IDR">IDR</SelectItem>
                                            <SelectItem value="USD">USD</SelectItem>
                                            <SelectItem value="EUR">EUR</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="validFrom" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Berlaku Dari</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                                            onChange={(e) => field.onChange(new Date(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="validUntil" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Berlaku Hingga</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Catatan (opsional)</FormLabel>
                                <FormControl>
                                    <Textarea rows={2} placeholder="Catatan tambahan..." {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="isActive" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                <FormLabel>Aktif</FormLabel>
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                        )} />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? "Menyimpan..." : "Simpan"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
