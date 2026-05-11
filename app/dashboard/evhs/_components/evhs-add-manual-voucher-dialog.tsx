"use client"

import { useState, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Plus, Trash2, PackagePlus, ChevronsUpDown, Check } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { createEvhsDraftVoucher } from "@/app/actions/evhs"

type WarehouseOption = {
    id: number
    sloc?: string | null
    description?: string | null
    type?: string | null
}

type ProductOption = {
    id: number
    materialNumber: string
    materialNumberCk?: string | null
    materialDescription?: string | null
    category?: string | null
}

type DraftItem = {
    id: string // local key
    materialNumberCk: string      // yang dikirim ke server
    materialNumberDisplay: string  // label tampilan di UI (CP + CK)
    qty: number
    productId?: number
}

function ProductCombobox({
    products,
    value,
    onChange,
}: {
    products: ProductOption[]
    value: string
    onChange: (materialNumberCk: string, display: string, productId?: number) => void
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        return products
            .filter((p) =>
                p.materialNumber.toLowerCase().includes(q) ||
                p.materialNumberCk?.toLowerCase().includes(q) ||
                p.materialDescription?.toLowerCase().includes(q)
            )
            .slice(0, 60)
    }, [products, search])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between h-7 text-xs font-mono truncate",
                        !value && "text-muted-foreground font-sans"
                    )}
                >
                    <span className="truncate">
                        {value || "Pilih material..."}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Cari material number atau deskripsi..."
                        value={search}
                        onValueChange={setSearch}
                        className="text-xs"
                    />
                    <CommandList className="max-h-[250px]">
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                            Material tidak ditemukan.
                        </CommandEmpty>
                        <CommandGroup>
                            {filtered.map((p) => {
                                const displayLabel = p.materialNumberCk
                                    ? `${p.materialNumberCk}`
                                    : p.materialNumber
                                const isSelected = value === displayLabel
                                return (
                                    <CommandItem
                                        key={p.id}
                                        value={`${p.materialNumber}|${p.materialNumberCk}`}
                                        onSelect={() => {
                                            const ckNum = p.materialNumberCk || p.materialNumber
                                            onChange(ckNum, displayLabel, p.id)
                                            setSearch("")
                                            setOpen(false)
                                        }}
                                        className="text-xs py-2"
                                    >
                                        <Check className={cn("mr-2 h-3 w-3", isSelected ? "opacity-100" : "opacity-0")} />
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                                                    CK: {p.materialNumberCk || "—"}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    CP: {p.materialNumber}
                                                </span>
                                            </div>
                                            {p.materialDescription && (
                                                <span className="text-[10px] text-muted-foreground italic truncate">
                                                    {p.materialDescription}
                                                </span>
                                            )}
                                        </div>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export function EvhsAddManualVoucherDialog({
    open,
    onOpenChange,
    warehouses,
    products,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    warehouses: WarehouseOption[]
    products: ProductOption[]
}) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form state
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [warehouseId, setWarehouseId] = useState<number | null>(null)
    const [woNo, setWoNo] = useState("")
    const [remark, setRemark] = useState("")
    const [items, setItems] = useState<DraftItem[]>([
        { id: crypto.randomUUID(), materialNumberCk: "", materialNumberDisplay: "", qty: 1 },
    ])

    // Filter hanya Warehouse VHS CK
    const vhsWarehouses = warehouses.filter((w) => {
        const type = (w.type || "").trim().toUpperCase()
        const label = `${(w.sloc || "")} ${(w.description || "")}`.toUpperCase()
        return type === "WAREHOUSE VHS" && label.includes("CK")
    })

    // Filter products yang punya materialNumberCk (relevan untuk EVHS)
    const evhsProducts = useMemo(() =>
        products.filter((p) => p.materialNumberCk && p.materialNumberCk.trim()),
        [products]
    )

    const addItem = () => {
        setItems((prev) => [
            ...prev,
            { id: crypto.randomUUID(), materialNumberCk: "", materialNumberDisplay: "", qty: 1 },
        ])
    }

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id))
    }

    const updateItemProduct = (id: string, materialNumberCk: string, display: string, productId?: number) => {
        setItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? { ...item, materialNumberCk, materialNumberDisplay: display, productId }
                    : item
            )
        )
    }

    const updateItemQty = (id: string, qty: number) => {
        setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, qty } : item))
        )
    }

    const handleReset = () => {
        setSelectedDate(new Date())
        setWarehouseId(null)
        setWoNo("")
        setRemark("")
        setItems([{ id: crypto.randomUUID(), materialNumberCk: "", materialNumberDisplay: "", qty: 1 }])
    }

    const handleSubmit = async () => {
        if (!warehouseId) {
            toast.error("Pilih warehouse terlebih dahulu.")
            return
        }

        const validItems = items.filter((i) => i.materialNumberCk.trim())
        if (validItems.length === 0) {
            toast.error("Minimal satu item material harus dipilih.")
            return
        }

        const invalidQty = validItems.find((i) => i.qty < 1)
        if (invalidQty) {
            toast.error("Qty harus minimal 1 untuk semua item.")
            return
        }

        setIsSubmitting(true)
        try {
            const result = await createEvhsDraftVoucher({
                date: format(selectedDate, "yyyy-MM-dd"),
                warehouseId,
                woNo: woNo || undefined,
                remark: remark || undefined,
                items: validItems.map((i) => ({
                    materialNumberCk: i.materialNumberCk.trim(),
                    qty: i.qty,
                })),
            })

            if (result.success) {
                toast.success(
                    `Voucher Draft berhasil dibuat: ${result.vhsNo}`,
                    { description: "Silakan isi SN dan detail unit setelah barang tiba." }
                )
                handleReset()
                onOpenChange(false)
                router.refresh()
            } else {
                toast.error("error" in result ? result.error : "Gagal membuat voucher draft.")
            }
        } catch {
            toast.error("Terjadi kesalahan sistem.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v) }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PackagePlus className="h-5 w-5 text-amber-500" />
                        Tambah Voucher Manual (Draft)
                    </DialogTitle>
                    <DialogDescription>
                        Buat nomor Voucher VHS sebelum barang tiba. Isi SN, POS, dan Unit ID setelah barang datang.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Row 1: Tanggal + Warehouse */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tanggal <span className="text-red-500">*</span></Label>
                            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-9",
                                            !selectedDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? format(selectedDate, "dd MMM yyyy") : "Pilih tanggal"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={(d) => { if (d) { setSelectedDate(d); setCalendarOpen(false) } }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Warehouse VHS <span className="text-red-500">*</span></Label>
                            <Select
                                value={warehouseId?.toString() ?? ""}
                                onValueChange={(v) => setWarehouseId(Number(v))}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Pilih warehouse..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {vhsWarehouses.length === 0 ? (
                                        <SelectItem value="-" disabled>
                                            Tidak ada warehouse VHS CK
                                        </SelectItem>
                                    ) : (
                                        vhsWarehouses.map((w) => (
                                            <SelectItem key={w.id} value={w.id.toString()}>
                                                {w.sloc} {w.description ? `— ${w.description}` : ""}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 2: WO + Remark */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="draft-wo" className="text-xs">WO Number (opsional)</Label>
                            <Input
                                id="draft-wo"
                                placeholder="Contoh: WO-CK-MHU-001"
                                value={woNo}
                                onChange={(e) => setWoNo(e.target.value)}
                                className="h-8 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="draft-remark" className="text-xs">Remark (opsional)</Label>
                            <Input
                                id="draft-remark"
                                placeholder="Catatan..."
                                value={remark}
                                onChange={(e) => setRemark(e.target.value)}
                                className="h-8 text-sm"
                            />
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">Item Material</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addItem}
                                className="h-7 text-xs gap-1"
                            >
                                <Plus className="h-3 w-3" />
                                Tambah Baris
                            </Button>
                        </div>

                        <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground w-8">#</th>
                                        <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">
                                            Material Number CK <span className="text-red-500">*</span>
                                        </th>
                                        <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground w-24">Qty</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {items.map((item, idx) => (
                                        <tr key={item.id} className="bg-background">
                                            <td className="py-2 px-3 text-xs text-muted-foreground">{idx + 1}</td>
                                            <td className="py-2 px-3">
                                                <ProductCombobox
                                                    products={evhsProducts}
                                                    value={item.materialNumberDisplay || item.materialNumberCk}
                                                    onChange={(ck, display, pid) =>
                                                        updateItemProduct(item.id, ck, display, pid)
                                                    }
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={item.qty}
                                                    onChange={(e) => updateItemQty(item.id, Math.max(1, Number(e.target.value)))}
                                                    className="h-7 text-xs text-center"
                                                />
                                            </td>
                                            <td className="py-2 px-2">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => removeItem(item.id)}
                                                    disabled={items.length <= 1}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            💡 Serial Number, POS, dan Unit ID akan diisi setelah barang tiba melalui aksi{" "}
                            <span className="font-semibold text-amber-600">"Isi Detail / SN"</span>.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => { handleReset(); onOpenChange(false) }} disabled={isSubmitting}>
                        Batal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                        {isSubmitting ? "Menyimpan..." : "Buat Voucher Draft"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
