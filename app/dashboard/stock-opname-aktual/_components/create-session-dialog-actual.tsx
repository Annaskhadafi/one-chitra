"use client"

import { useMemo, useState } from "react"
import { useForm, useFieldArray, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Plus, Loader2, X, Check, ChevronDown } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { createStockOpnameActualSession } from "@/app/actions/stock-opname"
import type { Warehouse } from "@/lib/types"

const signatureSchema = z.object({
    name: z.string().min(1, "Nama peserta wajib diisi"),
    position: z.string().min(1, "Jabatan peserta wajib diisi"),
})

const createSessionActualSchema = z.object({
    name: z.string().min(1, "Nama sesi wajib diisi"),
    warehouseId: z.number().min(1, "Warehouse wajib dipilih"),
    notes: z.string().optional(),
    opnameDate: z.date({ message: "Tanggal opname wajib diisi" }),
    opnameTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Format waktu HH:MM"),
    location: z.string().min(1, "Lokasi wajib diisi"),
    signatures: z.array(signatureSchema).min(1, "Minimal ada 1 peserta"),
    selectedCategories: z.array(z.string()).min(1, "Pilih minimal 1 kategori produk"),
    notifyRoles: z.array(z.string()).default([]),
    notifyUserIds: z.array(z.string()).default([]),
})

type FormValues = z.infer<typeof createSessionActualSchema>

type UserOption = {
    id: string
    name: string | null
    email: string
    role: string | null
}

type MultiSelectOption = {
    value: string
    label: string
    description?: string | null
}

function MultiSelectPopover({
    placeholder,
    options,
    value,
    onChange,
}: {
    placeholder: string
    options: MultiSelectOption[]
    value: string[]
    onChange: (nextValue: string[]) => void
}) {
    const [open, setOpen] = useState(false)
    const selectedSet = useMemo(() => new Set(value), [value])

    const selectedLabels = options
        .filter((option) => selectedSet.has(option.value))
        .map((option) => option.label)

    const summaryText = selectedLabels.length === 0
        ? placeholder
        : selectedLabels.length <= 2
            ? selectedLabels.join(", ")
            : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-between font-normal", selectedLabels.length === 0 && "text-muted-foreground")}
                >
                    <span className="truncate text-left">{summaryText}</span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Cari..." />
                    <div className="flex items-center justify-between border-b px-2 py-1.5">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onChange(options.map((option) => option.value))}
                        >
                            Pilih Semua
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onChange([])}
                        >
                            Kosongkan
                        </Button>
                    </div>
                    <CommandList>
                        <CommandEmpty>Data tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const isSelected = selectedSet.has(option.value)
                                return (
                                    <CommandItem
                                        key={option.value}
                                        value={`${option.label} ${option.description ?? ""}`}
                                    onSelect={() => {
                                        const next = new Set(value)
                                        if (next.has(option.value)) {
                                            next.delete(option.value)
                                        } else {
                                            next.add(option.value)
                                        }
                                        onChange(Array.from(next))
                                    }}
                                >
                                        <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm">{option.label}</p>
                                            {option.description && (
                                                <p className="truncate text-xs text-muted-foreground">{option.description}</p>
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

interface CreateSessionDialogActualProps {
    warehouses: Warehouse[]
    categories: string[]
    roleOptions: string[]
    users: UserOption[]
}

export function CreateSessionDialogActual({
    warehouses,
    categories,
    roleOptions,
    users,
}: CreateSessionDialogActualProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const categoryOptions = useMemo<MultiSelectOption[]>(
        () => categories.map((category) => ({ value: category, label: category })),
        [categories]
    )

    const roleSelectOptions = useMemo<MultiSelectOption[]>(
        () => roleOptions.map((role) => ({ value: role, label: role })),
        [roleOptions]
    )

    const userSelectOptions = useMemo<MultiSelectOption[]>(
        () =>
            users.map((entry) => ({
                value: entry.id,
                label: entry.name?.trim() || entry.email,
                description: `${entry.email}${entry.role ? ` - ${entry.role}` : ""}`,
            })),
        [users]
    )

    const form = useForm<FormValues>({
        resolver: zodResolver(createSessionActualSchema) as Resolver<FormValues>,
        defaultValues: {
            name: "",
            warehouseId: 0,
            notes: "",
            opnameDate: new Date(),
            opnameTime: new Date().toTimeString().slice(0, 5),
            location: "",
            signatures: [{ name: "", position: "" }],
            selectedCategories: [],
            notifyRoles: [],
            notifyUserIds: [],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "signatures",
    })

    async function onSubmit(values: FormValues) {
        setLoading(true)
        try {
            const result = await createStockOpnameActualSession(values)
            if (result.success && result.sessionId) {
                toast.success("Sesi stock opname aktual berhasil dibuat")
                setOpen(false)
                form.reset()
                router.push(`/dashboard/stock-opname-aktual/${result.sessionId}`)
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
                <Button className="w-full bg-teal-600 text-white hover:bg-teal-700 sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Buat Sesi Aktual
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl p-0 sm:max-w-[720px]">
                <DialogHeader className="px-4 pt-5 sm:px-6">
                    <DialogTitle>Buat Sesi Stock Opname Aktual</DialogTitle>
                    <DialogDescription>
                        Data sistem diambil dari stock aktual internal, lalu difilter berdasarkan kategori produk yang dipilih.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 py-2 sm:px-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nama Sesi</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Cth: Opname Aktual Mingguan" {...field} />
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
                                        onValueChange={(value) => field.onChange(parseInt(value))}
                                        value={field.value ? String(field.value) : ""}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih warehouse" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {warehouses.map((warehouse) => (
                                                <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                                                    {warehouse.sloc}
                                                    {warehouse.description ? ` — ${warehouse.description}` : ""}
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
                            name="selectedCategories"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Filter Kategori Produk (Multi Select)</FormLabel>
                                    <FormControl>
                                        <MultiSelectPopover
                                            placeholder="Pilih kategori produk..."
                                            options={categoryOptions}
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {field.value.map((category) => (
                                            <Badge key={category} variant="secondary" className="text-xs">
                                                {category}
                                            </Badge>
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="opnameDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tanggal Opname</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                value={field.value instanceof Date ? field.value.toISOString().split("T")[0] : ""}
                                                onChange={(event) => field.onChange(new Date(event.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="opnameTime"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Waktu</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="location"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Lokasi</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Cth: Gudang Utama" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <FormLabel>Peserta / Tanda Tangan</FormLabel>
                                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => append({ name: "", position: "" })}>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Tambah
                                </Button>
                            </div>
                            {fields.map((entry, index) => (
                                <div key={entry.id} className="flex items-start gap-2 rounded-xl border p-3">
                                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                                        <FormField
                                            control={form.control}
                                            name={`signatures.${index}.name`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input placeholder="Nama" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`signatures.${index}.position`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input placeholder="Jabatan" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    {fields.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => remove(index)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <FormField
                            control={form.control}
                            name="notifyRoles"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notifikasi Email ke Role (Opsional)</FormLabel>
                                    <FormControl>
                                        <MultiSelectPopover
                                            placeholder="Pilih role penerima..."
                                            options={roleSelectOptions}
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notifyUserIds"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notifikasi Email ke User (Opsional)</FormLabel>
                                    <FormControl>
                                        <MultiSelectPopover
                                            placeholder="Pilih user penerima..."
                                            options={userSelectOptions}
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
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
                                        <Textarea placeholder="Keterangan tambahan..." rows={3} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="sticky bottom-0 -mx-4 border-t bg-background px-4 py-4 sm:-mx-6 sm:px-6">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading} className="w-full sm:w-auto">
                                Batal
                            </Button>
                            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
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
