"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { priceListItemSchema } from "@/lib/schemas"
import {
    upsertPriceListItem, deletePriceListItem, getPriceHistory, getProductsForPricing
} from "@/app/actions/price-management"
import { getSetting } from "@/app/actions/settings"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, History, ChevronsUpDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { getPriceLists } from "@/app/actions/price-management"

type PriceList = Awaited<ReturnType<typeof getPriceLists>>[number]
type PriceListItem = PriceList["items"][number]
type Product = Awaited<ReturnType<typeof getProductsForPricing>>[number]

interface Props {
    priceList: PriceList
}

const fmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })

export function PriceListItemsView({ priceList }: Props) {
    const [addOpen, setAddOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<PriceListItem | null>(null)
    const [historyTarget, setHistoryTarget] = useState<PriceListItem | null>(null)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleDelete = (id: number) => {
        startTransition(async () => {
            await deletePriceListItem(id)
            router.refresh()
        })
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">Item Harga — {priceList.name}</p>
                    <p className="text-xs text-muted-foreground">{priceList.items.length} item terdaftar</p>
                </div>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Tambah Item
                </Button>
            </div>

            <div className="rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Produk</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Harga Satuan</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Qty Range</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Diskon %</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Harga Efektif</th>
                            <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Margin Floor</th>
                            <th className="px-4 py-2.5"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {priceList.items.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                                    Belum ada item. Klik &quot;Tambah Item&quot; untuk menambahkan harga produk.
                                </td>
                            </tr>
                        )}
                        {priceList.items.map((item) => {
                            const unitPrice = parseFloat(item.unitPrice)
                            const discountPct = parseFloat(item.discountPct)
                            const effectivePrice = unitPrice * (1 - discountPct / 100)
                            const marginFloor = parseFloat(item.marginFloor)
                            return (
                                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="font-medium text-xs">{item.product?.materialNumber ?? "-"}</p>
                                            <p className="text-muted-foreground text-xs leading-tight truncate max-w-[160px]">
                                                {item.product?.materialDescription ?? "-"}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">{fmt.format(unitPrice)}</td>
                                    <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground tabular-nums text-xs">
                                        {item.minQty}{item.maxQty ? `–${item.maxQty}` : "+"}
                                    </td>
                                    <td className="px-4 py-3 text-right hidden md:table-cell">
                                        {discountPct > 0 ? (
                                            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">{discountPct}%</Badge>
                                        ) : <span className="text-muted-foreground">-</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right hidden md:table-cell font-medium tabular-nums">
                                        {fmt.format(effectivePrice)}
                                    </td>
                                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                                        {marginFloor > 0 ? (
                                            <span className="text-xs text-muted-foreground">{marginFloor}%</span>
                                        ) : <span className="text-muted-foreground">-</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end">
                                            <Button
                                                variant="ghost" size="icon" className="h-7 w-7"
                                                onClick={() => setHistoryTarget(item)}
                                            >
                                                <History className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                            <Button
                                                variant="ghost" size="icon" className="h-7 w-7"
                                                onClick={() => setEditTarget(item)}
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
                                                        <AlertDialogTitle>Hapus item ini?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Histori perubahan harga item ini juga akan terhapus.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className="bg-red-600 hover:bg-red-700"
                                                            onClick={() => handleDelete(item.id)}
                                                            disabled={isPending}
                                                        >
                                                            Hapus
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                </div>
            </div>

            {/* Add Item Dialog */}
            <PriceItemDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                priceListId={priceList.id}
            />

            {/* Edit Item Dialog */}
            {editTarget && (
                <PriceItemDialog
                    open={!!editTarget}
                    onOpenChange={(v) => { if (!v) setEditTarget(null) }}
                    priceListId={priceList.id}
                    defaultValues={editTarget}
                />
            )}

            {/* History Dialog */}
            {historyTarget && (
                <PriceHistoryDialog
                    item={historyTarget}
                    open={!!historyTarget}
                    onOpenChange={(v) => { if (!v) setHistoryTarget(null) }}
                />
            )}
        </div>
    )
}

// ─── Add/Edit Item Dialog ─────────────────────────────────────────────────────

interface ItemDialogProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    priceListId: number
    defaultValues?: PriceListItem
}

function PriceItemDialog({ open, onOpenChange, priceListId, defaultValues }: ItemDialogProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [products, setProducts] = useState<Product[]>([])
    const [productPopoverOpen, setProductPopoverOpen] = useState(false)
    const [changeReason, setChangeReason] = useState("")
    const [manualRate, setManualRate] = useState<number>(1)

    // Load products & manual rate when dialog opens
    useEffect(() => {
        if (open) {
            if (products.length === 0) getProductsForPricing().then(setProducts)
            getSetting("manual_usd_rate").then((val) => {
                const rate = parseFloat(val || "1")
                if (!isNaN(rate) && rate > 0) setManualRate(rate)
            })
        }
    }, [open, products.length])

    const form = useForm<z.infer<typeof priceListItemSchema>>({
        resolver: zodResolver(priceListItemSchema),
        defaultValues: defaultValues
            ? {
                priceListId,
                productId: defaultValues.productId,
                unitPrice: parseFloat(defaultValues.unitPrice),
                minQty: defaultValues.minQty,
                maxQty: defaultValues.maxQty ?? null,
                discountPct: parseFloat(defaultValues.discountPct),
                marginFloor: parseFloat(defaultValues.marginFloor),
                notes: defaultValues.notes ?? "",
            }
            : {
                priceListId,
                productId: 0,
                unitPrice: 0,
                minQty: 1,
                maxQty: null,
                discountPct: 0,
                marginFloor: 0,
                notes: "",
            },
    })

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
            form.reset()
            setChangeReason("")
            setProductPopoverOpen(false)
        }
    }, [open, form])

    const onSubmit = (data: z.infer<typeof priceListItemSchema>) => {
        startTransition(async () => {
            const result = await upsertPriceListItem(data, defaultValues?.id, changeReason || undefined)
            if (result.success) {
                onOpenChange(false)
            }
            router.refresh()
        })
    }

    const selectedProduct = products.find((p) => p.id === form.watch("productId"))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{defaultValues ? "Edit" : "Tambah"} Item Harga</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

                        {/* ── Product Search ── */}
                        <FormField control={form.control} name="productId" render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Produk</FormLabel>
                                <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "justify-between font-normal",
                                                    !selectedProduct && "text-muted-foreground"
                                                )}
                                            >
                                                {selectedProduct
                                                    ? <span className="truncate text-left">{selectedProduct.materialNumber} — {selectedProduct.materialDescription}</span>
                                                    : "Cari & pilih produk..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[420px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari material number / deskripsi..." />
                                            <CommandList>
                                                <CommandEmpty>
                                                    {products.length === 0
                                                        ? "Memuat produk..."
                                                        : "Produk tidak ditemukan."}
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {products.map((p) => (
                                                        <CommandItem
                                                            key={p.id}
                                                            value={`${p.materialNumber} ${p.materialDescription ?? ""}`}
                                                            onSelect={() => {
                                                                field.onChange(p.id)
                                                                setProductPopoverOpen(false)
                                                                const cost = parseFloat(p.costSap || "0")
                                                                form.setValue("unitPrice", Math.round(cost * manualRate))
                                                            }}
                                                            className="flex items-center gap-2 cursor-pointer"
                                                        >
                                                            <Check
                                                                className={cn("h-4 w-4 shrink-0", field.value === p.id ? "opacity-100" : "opacity-0")}
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-xs">{p.materialNumber}</p>
                                                                <p className="text-muted-foreground text-xs truncate">{p.materialDescription}</p>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* ── Unit Price ── */}
                        <FormField control={form.control} name="unitPrice" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Harga Satuan (IDR)</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="100"
                                        min="0"
                                        value={field.value}
                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                </FormControl>
                                {selectedProduct && (
                                    <p className="text-xs text-muted-foreground">
                                        Cost SAP: <span className="font-medium">{fmt.format(parseFloat(selectedProduct.costSap || "0"))}</span>
                                        {" × Rate: "}<span className="font-medium">{manualRate.toLocaleString("id-ID")}</span>
                                        {" = "}<span className="font-semibold text-foreground">{fmt.format(Math.round(parseFloat(selectedProduct.costSap || "0") * manualRate))}</span>
                                    </p>
                                )}
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* ── Qty Range ── */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="minQty" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Min Qty</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={field.value}
                                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="maxQty" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Max Qty <span className="text-muted-foreground font-normal">(kosong = ∞)</span></FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={field.value ?? ""}
                                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        {/* ── Discount & Margin ── */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="discountPct" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Diskon (%)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={field.value}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="marginFloor" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Margin Floor (%)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={field.value}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        {/* ── Change Reason (edit only) ── */}
                        {defaultValues && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium">Alasan Perubahan <span className="text-muted-foreground font-normal">(opsional)</span></label>
                                <Textarea
                                    rows={2}
                                    placeholder="Alasan mengapa harga diubah..."
                                    value={changeReason}
                                    onChange={(e) => setChangeReason(e.target.value)}
                                />
                            </div>
                        )}

                        {/* ── Notes ── */}
                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Catatan <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel>
                                <FormControl>
                                    <Textarea rows={2} placeholder="Catatan tambahan..." {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
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

// ─── History Dialog ───────────────────────────────────────────────────────────

interface HistoryDialogProps {
    item: PriceListItem
    open: boolean
    onOpenChange: (v: boolean) => void
}

function PriceHistoryDialog({ item, open, onOpenChange }: HistoryDialogProps) {
    const [history, setHistory] = useState<Awaited<ReturnType<typeof getPriceHistory>> | null>(null)
    const [loading, setLoading] = useState(false)

    const load = async () => {
        if (history) return
        setLoading(true)
        const data = await getPriceHistory(item.id)
        setHistory(data)
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg" onOpenAutoFocus={load}>
                <DialogHeader>
                    <DialogTitle>Histori Perubahan Harga</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
                    {loading && <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>}
                    {!loading && history?.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">Belum ada histori perubahan.</p>
                    )}
                    {history?.map((h) => (
                        <div key={h.id} className="rounded-lg border p-3 flex flex-col gap-1 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-xs bg-muted px-2 py-0.5 rounded">{h.fieldChanged}</span>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(h.changedAt).toLocaleString("id-ID")}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-red-600 line-through">{h.oldValue ?? "-"}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-emerald-600 font-medium">{h.newValue ?? "-"}</span>
                            </div>
                            {h.reason && <p className="text-xs text-muted-foreground italic">&quot;{h.reason}&quot;</p>}
                            <p className="text-xs text-muted-foreground">oleh {h.changedBy?.name ?? h.changedBy?.email ?? "Unknown"}</p>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
