"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useForm, useFieldArray, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2, PackagePlus, FileText, AlertTriangle, Check, ChevronsUpDown, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createGoodReceiveManual, type ManualGoodReceivePoLineOption, type ManualGoodReceivePoOption } from "@/app/actions/good-receive-manual"
import { getProducts } from "@/app/actions/product"
import { ProductDialog } from "@/app/dashboard/products/_components/product-dialog"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const itemSchema = z.object({
    poItem: z.coerce.number().min(1),
    materialNumber: z.string().min(1),
    materialDescription: z.string().optional(),
    productId: z.coerce.number().min(0),
    openQty: z.coerce.number().min(0),
    quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
    notes: z.string().optional(),
})

const formSchema = z.object({
    poNumber: z.string().min(1, "PO Number is required"),
    warehouseId: z.coerce.number().min(1, "Warehouse is required"),
    receiveDate: z.date(),
    deliveryType: z.enum(["Partial", "Complete"]),
    referenceDocument: z.string().optional(),
    notifyRoles: z.array(z.string()).default([]),
    notifyUserIds: z.array(z.string()).default([]),
    items: z.array(itemSchema).min(1, "No open PO items available"),
}).superRefine((data, ctx) => {
    const selectedItems = new Set<number>()
    let hasPositiveQty = false

    data.items.forEach((item, idx) => {
        if (selectedItems.has(item.poItem)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["items", idx, "poItem"],
                message: "PO Item sudah dipilih di baris lain",
            })
        } else {
            selectedItems.add(item.poItem)
        }

        if (item.quantity > item.openQty) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["items", idx, "quantity"],
                message: `Quantity melebihi Open Qty (${item.openQty})`,
            })
        }

        if (item.quantity > 0 && item.productId < 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["items", idx, "productId"],
                message: "Material belum ter-mapping ke produk internal",
            })
        }

        if (item.quantity > 0) {
            hasPositiveQty = true
        }
    })

    if (!hasPositiveQty) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["items"],
            message: "Minimal satu item harus memiliki Quantity > 0",
        })
    }
})

type FormValues = z.infer<typeof formSchema>

type ProductOption = {
    id: number
    materialNumber: string
    materialDescription: string | null
    oldMaterialNo: string | null
    materialNumberCk: string | null
    sloc: string | null
}

type GoodReceiveFormProps = {
    warehouses: {
        id: number
        sloc: string
        description: string | null
    }[]
    poOptions: ManualGoodReceivePoOption[]
    poLineOptions: ManualGoodReceivePoLineOption[]
    productOptions: ProductOption[]
    notificationRoles: string[]
    notificationUsers: Array<{
        id: string
        name: string | null
        email: string
        role: string | null
    }>
}

function normalizeCode(value: string | null | undefined) {
    return (value || "").trim().toUpperCase()
}

function findMatchedProductId(materialNumber: string, options: ProductOption[]) {
    const normalizedMaterial = normalizeCode(materialNumber)
    if (!normalizedMaterial) return 0

    const matched = options.find((product) => (
        normalizeCode(product.materialNumber) === normalizedMaterial
        || normalizeCode(product.oldMaterialNo) === normalizedMaterial
        || normalizeCode(product.materialNumberCk) === normalizedMaterial
    ))

    return matched?.id ?? 0
}

function formatPoDate(poDate: string | null) {
    if (!poDate) return "-"
    const parsed = new Date(poDate)
    if (Number.isNaN(parsed.getTime())) return poDate
    return format(parsed, "dd MMM yyyy")
}

type ProductComboboxProps = {
    value: number
    options: ProductOption[]
    onSelect: (id: number) => void
}

function ProductCombobox({ value, options, onSelect }: ProductComboboxProps) {
    const [open, setOpen] = useState(false)
    const selectedProduct = useMemo(
        () => options.find((option) => option.id === value),
        [options, value]
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between h-9 px-3 font-normal",
                        !selectedProduct && "text-muted-foreground"
                    )}
                >
                    {selectedProduct ? (
                        <span className="truncate text-left font-mono text-xs">{selectedProduct.materialNumber}</span>
                    ) : (
                        <span>Pilih produk internal...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Cari produk internal..." />
                    <CommandList>
                        <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.id}
                                    value={[
                                        option.materialNumber,
                                        option.materialDescription || "",
                                        option.oldMaterialNo || "",
                                        option.materialNumberCk || "",
                                        option.sloc || "",
                                    ].join(" ")}
                                    onSelect={() => {
                                        onSelect(option.id)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            value === option.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="min-w-0">
                                        <p className="font-mono text-xs truncate">{option.materialNumber}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">{option.materialDescription || "-"}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                            Old: {option.oldMaterialNo || "-"} | CK: {option.materialNumberCk || "-"} | SLoc: {option.sloc || "-"}
                                        </p>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

type MultiSelectOption = {
    value: string
    label: string
    description?: string | null
}

function MultiSelectPopover({
    value,
    options,
    placeholder,
    onChange,
}: {
    value: string[]
    options: MultiSelectOption[]
    placeholder: string
    onChange: (nextValue: string[]) => void
}) {
    const [open, setOpen] = useState(false)
    const selectedSet = useMemo(() => new Set(value), [value])
    const selectedLabels = options
        .filter((option) => selectedSet.has(option.value))
        .map((option) => option.label)

    const summary = selectedLabels.length === 0
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
                    <span className="truncate text-left">{summary}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                        <CommandEmpty>Tidak ada data.</CommandEmpty>
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
                                            <p className="text-sm truncate">{option.label}</p>
                                            {option.description && (
                                                <p className="text-xs text-muted-foreground truncate">{option.description}</p>
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

export function GoodReceiveForm({
    warehouses,
    poOptions,
    poLineOptions,
    productOptions,
    notificationRoles,
    notificationUsers,
}: GoodReceiveFormProps) {
    const router = useRouter()
    const [poComboboxOpen, setPoComboboxOpen] = useState(false)
    const [productCatalog, setProductCatalog] = useState<ProductOption[]>(productOptions)
    const [isRefreshingProducts, setIsRefreshingProducts] = useState(false)
    const [isMobileLayout, setIsMobileLayout] = useState(false)
    const lastSelectedPoRef = useRef("")

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: {
            poNumber: "",
            warehouseId: 0,
            receiveDate: new Date(),
            deliveryType: "Complete",
            referenceDocument: "",
            notifyRoles: [],
            notifyUserIds: [],
            items: [],
        },
    })

    const { fields, replace } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const selectedPoNumber = form.watch("poNumber")
    const selectedWarehouseId = form.watch("warehouseId")
    const watchedItems = form.watch("items")

    const selectedPo = useMemo(
        () => poOptions.find((po) => po.poNumber === selectedPoNumber) ?? null,
        [poOptions, selectedPoNumber]
    )

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 767px)")
        const updateLayout = () => setIsMobileLayout(mediaQuery.matches)
        updateLayout()
        mediaQuery.addEventListener("change", updateLayout)
        return () => mediaQuery.removeEventListener("change", updateLayout)
    }, [])

    const selectedPoLines = useMemo(
        () => poLineOptions.filter((line) => line.poNumber === selectedPoNumber),
        [poLineOptions, selectedPoNumber]
    )

    const selectedWarehouse = useMemo(
        () => warehouses.find((warehouse) => warehouse.id === Number(selectedWarehouseId)) || null,
        [warehouses, selectedWarehouseId]
    )

    const sortedProductOptions = useMemo(
        () => [...productCatalog].sort((a, b) => a.materialNumber.localeCompare(b.materialNumber)),
        [productCatalog]
    )

    const productById = useMemo(
        () => new Map(sortedProductOptions.map((product) => [product.id, product])),
        [sortedProductOptions]
    )

    const notificationRoleOptions = useMemo<MultiSelectOption[]>(
        () => notificationRoles.map((role) => ({ value: role, label: role })),
        [notificationRoles]
    )

    const notificationUserOptions = useMemo<MultiSelectOption[]>(
        () =>
            notificationUsers.map((entry) => ({
                value: entry.id,
                label: entry.name?.trim() || entry.email,
                description: `${entry.email}${entry.role ? ` - ${entry.role}` : ""}`,
            })),
        [notificationUsers]
    )

    const refreshProductCatalog = async () => {
        setIsRefreshingProducts(true)
        try {
            const latestProducts = await getProducts()
            const mappedProducts: ProductOption[] = latestProducts.map((product) => ({
                id: product.id,
                materialNumber: product.materialNumber,
                materialDescription: product.materialDescription,
                oldMaterialNo: product.oldMaterialNo,
                materialNumberCk: product.materialNumberCk,
                sloc: product.sloc,
            }))
            setProductCatalog(mappedProducts)
            toast.success("Daftar produk internal diperbarui")
        } catch (_error) {
            toast.error("Gagal memuat daftar produk internal")
        } finally {
            setIsRefreshingProducts(false)
        }
    }

    useEffect(() => {
        if (!selectedPoNumber) {
            lastSelectedPoRef.current = ""
            replace([])
            return
        }

        const poChanged = lastSelectedPoRef.current !== selectedPoNumber
        const existingItems = poChanged ? [] : form.getValues("items")
        const existingByPoItem = new Map(existingItems.map((item) => [item.poItem, item]))

        const items = selectedPoLines.map((line) => {
            const prev = existingByPoItem.get(line.poItem)
            const prevQtyRaw = Number(prev?.quantity ?? 0)
            const prevQty = Number.isFinite(prevQtyRaw) ? prevQtyRaw : 0
            const prevProductId = Number(prev?.productId || 0)

            return {
                poItem: line.poItem,
                materialNumber: line.materialNumber,
                materialDescription: line.materialDescription || "",
                productId: (!poChanged && prevProductId > 0)
                    ? prevProductId
                    : (line.productId ?? findMatchedProductId(line.materialNumber, productCatalog)),
                openQty: line.openQty,
                quantity: poChanged ? 0 : Math.min(Math.max(prevQty, 0), line.openQty),
                notes: poChanged ? "" : (prev?.notes || ""),
            }
        })

        replace(items)
        lastSelectedPoRef.current = selectedPoNumber
    }, [selectedPoNumber, selectedPoLines, productCatalog, replace, form])

    async function onSubmit(values: FormValues) {
        try {
            const result = await createGoodReceiveManual(values)
            if (result.success) {
                toast.success("Good receive created successfully")
                if (result.notification && !result.notification.sent) {
                    toast.warning(`Email notifikasi belum terkirim: ${result.notification.reason || "cek konfigurasi SMTP / penerima"}`)
                }
                if (result.notification?.sent) {
                    toast.success(`Email notifikasi terkirim ke ${result.notification.recipientCount ?? 0} penerima`)
                }
                router.refresh()
                router.push("/dashboard/good-receive-manual")
            } else {
                toast.error(result.error || "Failed to create good receive")
            }
        } catch (_error) {
            toast.error("Something went wrong")
        }
    }

    const isSubmitting = form.formState.isSubmitting
    const itemsErrorMessage = typeof (form.formState.errors.items as { message?: string } | undefined)?.message === "string"
        ? (form.formState.errors.items as { message: string }).message
        : null

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6">
                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-500" />
                            <CardTitle className="text-base">Header Information</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            Select PO and target warehouse for this manual GR.
                        </CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-5">
                        <div className="grid gap-5 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="poNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>PO Number</FormLabel>
                                        <Popover open={poComboboxOpen} onOpenChange={setPoComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={poComboboxOpen}
                                                        className={cn(
                                                            "w-full justify-between font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            <span className="min-w-0 text-left truncate">
                                                                <span className="font-mono">{field.value}</span>
                                                                {selectedPo && (
                                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                                        {formatPoDate(selectedPo.poDate)} | Open {selectedPo.totalOpenQty}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span>{poOptions.length > 0 ? "Select PO..." : "No open PO"}</span>
                                                        )}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search PO number, vendor, date..." />
                                                    <CommandList>
                                                        <CommandEmpty>PO not found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {poOptions.map((po) => (
                                                                <CommandItem
                                                                    key={po.poNumber}
                                                                    value={`${po.poNumber} ${po.vendorName} ${po.poDate || ""} ${po.totalOpenQty} ${po.itemCount}`}
                                                                    onSelect={() => {
                                                                        field.onChange(po.poNumber)
                                                                        setPoComboboxOpen(false)
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4 shrink-0",
                                                                            field.value === po.poNumber ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <div className="min-w-0">
                                                                        <p className="font-mono text-xs">{po.poNumber}</p>
                                                                        <p className="text-[11px] text-muted-foreground truncate">{po.vendorName}</p>
                                                                        <p className="text-[10px] text-muted-foreground">
                                                                            PO Date: {formatPoDate(po.poDate)} | Open Qty: {po.totalOpenQty} | {po.itemCount} item
                                                                        </p>
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
                                )}
                            />

                            <FormItem>
                                <FormLabel>Supplier</FormLabel>
                                <Input value={selectedPo?.vendorName ?? "-"} disabled />
                            </FormItem>

                            <FormField
                                control={form.control}
                                name="warehouseId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Warehouse</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(parseInt(val))}
                                            value={field.value?.toString() === "0" ? "" : field.value?.toString()}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select warehouse" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {warehouses.map((warehouse) => (
                                                    <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                                                        {warehouse.sloc} - {warehouse.description}
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
                                name="receiveDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Receive Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="deliveryType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Delivery Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Complete">Complete</SelectItem>
                                                <SelectItem value="Partial">Partial</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-blue-200/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Notifikasi GR Manual</CardTitle>
                        <CardDescription className="text-xs">
                            Pilih role dan/atau user yang akan menerima email notifikasi bahwa barang sudah datang dan mohon tim Procurement melakukan GR SAP.
                        </CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-4 space-y-4">
                        <FormField
                            control={form.control}
                            name="notifyRoles"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notifikasi ke Role</FormLabel>
                                    <FormControl>
                                        <MultiSelectPopover
                                            placeholder="Pilih role..."
                                            options={notificationRoleOptions}
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
                                    <FormLabel>Notifikasi ke User</FormLabel>
                                    <FormControl>
                                        <MultiSelectPopover
                                            placeholder="Pilih user..."
                                            options={notificationUserOptions}
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Jika role/user dikosongkan, notifikasi email GR Manual tidak akan dikirim.
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">PO Items</CardTitle>
                        <CardDescription className="text-xs">Adjust received quantity per PO item (0 allowed to skip item).</CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-4">
                        {fields.map((field, index) => (
                            <div key={`hidden-${field.id}`} className="hidden">
                                <input type="hidden" {...form.register(`items.${index}.poItem`, { valueAsNumber: true })} />
                                <input type="hidden" {...form.register(`items.${index}.materialNumber`)} />
                                <input type="hidden" {...form.register(`items.${index}.materialDescription`)} />
                                <input type="hidden" {...form.register(`items.${index}.openQty`, { valueAsNumber: true })} />
                            </div>
                        ))}

                        {fields.length === 0 ? (
                            <div className="h-24 flex items-center justify-center text-sm text-muted-foreground text-center">
                                Pilih PO Number terlebih dahulu.
                            </div>
                        ) : isMobileLayout ? (
                            <div className="space-y-3">
                                {fields.map((field, index) => {
                                    const watchedRow = watchedItems?.[index]
                                    const poItemValue = Number(watchedRow?.poItem ?? field.poItem ?? 0)
                                    const materialNumberValue = watchedRow?.materialNumber ?? field.materialNumber
                                    const materialDescriptionValue = watchedRow?.materialDescription ?? ""
                                    const openQtyValue = Number(watchedRow?.openQty ?? field.openQty ?? 0)
                                    const currentProductId = Number(watchedRow?.productId ?? field.productId ?? 0)
                                    const selectedInternalProduct = productById.get(currentProductId)
                                    const isMapped = currentProductId > 0

                                    return (
                                        <Card key={field.id} className={cn("shadow-none border", !isMapped && "border-amber-300 bg-amber-50/40 dark:bg-amber-950/10")}>
                                            <CardContent className="p-3 space-y-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">PO Item</p>
                                                        <p className="font-mono text-xs">{poItemValue}</p>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px]">Open Qty: {openQtyValue}</Badge>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] text-muted-foreground">Material</p>
                                                    <p className="font-mono text-xs break-all">{materialNumberValue || "-"}</p>
                                                    <p className="text-xs text-muted-foreground break-words">{materialDescriptionValue || "-"}</p>
                                                </div>
                                                <FormField
                                                    control={form.control}
                                                    name={`items.${index}.productId`}
                                                    render={({ field: productField }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-xs">Material Internal</FormLabel>
                                                            <FormControl>
                                                                <ProductCombobox
                                                                    value={Number(productField.value || 0)}
                                                                    options={sortedProductOptions}
                                                                    onSelect={(id) => productField.onChange(id)}
                                                                />
                                                            </FormControl>
                                                            {!isMapped && (
                                                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                                                    <ProductDialog
                                                                        initialValues={{
                                                                            category: "Material Consumable",
                                                                            materialNumber: materialNumberValue || "",
                                                                            oldMaterialNo: materialNumberValue || "",
                                                                            materialDescription: materialDescriptionValue || "",
                                                                            sloc: selectedWarehouse?.sloc || "",
                                                                            slocDescription: selectedWarehouse?.description || "",
                                                                        }}
                                                                        trigger={(
                                                                            <Button type="button" variant="outline" size="sm" className="h-8 text-[11px]">
                                                                                <Plus className="mr-1 h-3 w-3" />
                                                                                Tambah Produk
                                                                            </Button>
                                                                        )}
                                                                        onSuccess={refreshProductCatalog}
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 text-[11px]"
                                                                        onClick={refreshProductCatalog}
                                                                        disabled={isRefreshingProducts}
                                                                    >
                                                                        {isRefreshingProducts ? "Memuat..." : "Refresh List"}
                                                                    </Button>
                                                                </div>
                                                            )}
                                                            {selectedInternalProduct && (
                                                                <p className="text-[10px] text-muted-foreground">{selectedInternalProduct.materialDescription || "-"}</p>
                                                            )}
                                                            {!isMapped && (
                                                                <p className="text-[11px] text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                                                                    <AlertTriangle className="h-3 w-3" />
                                                                    Material belum ter-mapping ke produk internal
                                                                </p>
                                                            )}
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`items.${index}.quantity`}
                                                    render={({ field: qtyField }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-xs">Receive Qty</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    max={openQtyValue}
                                                                    inputMode="numeric"
                                                                    className="h-10"
                                                                    value={qtyField.value}
                                                                    disabled={!isMapped}
                                                                    onChange={(e) => qtyField.onChange(Number(e.target.value))}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`items.${index}.notes`}
                                                    render={({ field: notesField }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-xs">Notes</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Optional notes" className="h-10" {...notesField} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table className="min-w-[1180px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>#</TableHead>
                                            <TableHead>PO Item</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Material Internal</TableHead>
                                            <TableHead>Open Qty</TableHead>
                                            <TableHead>Receive Qty</TableHead>
                                            <TableHead>Notes</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => {
                                            const watchedRow = watchedItems?.[index]
                                            const poItemValue = Number(watchedRow?.poItem ?? field.poItem ?? 0)
                                            const materialNumberValue = watchedRow?.materialNumber ?? field.materialNumber
                                            const materialDescriptionValue = watchedRow?.materialDescription ?? ""
                                            const openQtyValue = Number(watchedRow?.openQty ?? field.openQty ?? 0)
                                            const currentProductId = Number(watchedRow?.productId ?? field.productId ?? 0)
                                            const selectedInternalProduct = productById.get(currentProductId)
                                            const isMapped = currentProductId > 0

                                            return (
                                                <TableRow key={field.id} className={cn(!isMapped && "bg-amber-50/30 dark:bg-amber-950/10")}>
                                                    <TableCell>{index + 1}</TableCell>
                                                    <TableCell className="font-mono text-xs">{poItemValue}</TableCell>
                                                    <TableCell>
                                                        <p className="font-mono text-xs">{materialNumberValue || "-"}</p>
                                                        <p className="text-xs text-muted-foreground">{materialDescriptionValue || "-"}</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.productId`}
                                                            render={({ field: productField }) => (
                                                                <FormItem className="space-y-1">
                                                                    <FormControl>
                                                                        <ProductCombobox
                                                                            value={Number(productField.value || 0)}
                                                                            options={sortedProductOptions}
                                                                            onSelect={(id) => productField.onChange(id)}
                                                                        />
                                                                    </FormControl>
                                                                    {!isMapped && (
                                                                        <div className="flex items-center gap-2 pt-1">
                                                                            <ProductDialog
                                                                                initialValues={{
                                                                                    category: "Material Consumable",
                                                                                    materialNumber: materialNumberValue || "",
                                                                                    oldMaterialNo: materialNumberValue || "",
                                                                                    materialDescription: materialDescriptionValue || "",
                                                                                    sloc: selectedWarehouse?.sloc || "",
                                                                                    slocDescription: selectedWarehouse?.description || "",
                                                                                }}
                                                                                trigger={(
                                                                                    <Button type="button" variant="outline" size="sm" className="h-8 text-[11px]">
                                                                                        <Plus className="mr-1 h-3 w-3" />
                                                                                        Tambah Produk
                                                                                    </Button>
                                                                                )}
                                                                                onSuccess={refreshProductCatalog}
                                                                            />
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 text-[11px]"
                                                                                onClick={refreshProductCatalog}
                                                                                disabled={isRefreshingProducts}
                                                                            >
                                                                                {isRefreshingProducts ? "Memuat..." : "Refresh List"}
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                    {selectedInternalProduct && (
                                                                        <p className="text-[10px] text-muted-foreground truncate">{selectedInternalProduct.materialDescription || "-"}</p>
                                                                    )}
                                                                    {!isMapped && (
                                                                        <p className="text-[11px] text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                                                                            <AlertTriangle className="h-3 w-3" />
                                                                            Material belum ter-mapping ke produk internal
                                                                        </p>
                                                                    )}
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>{openQtyValue}</TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.quantity`}
                                                            render={({ field: qtyField }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            max={openQtyValue}
                                                                            value={qtyField.value}
                                                                            disabled={!isMapped}
                                                                            onChange={(e) => qtyField.onChange(Number(e.target.value))}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.notes`}
                                                            render={({ field: notesField }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input placeholder="Optional notes" {...notesField} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {itemsErrorMessage && (
                            <p className="text-sm font-medium text-destructive px-1 pt-3">{itemsErrorMessage}</p>
                        )}
                    </CardContent>
                </Card>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2">
                    <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting} className="w-full sm:w-auto">
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white sm:min-w-[160px]">
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <PackagePlus className="mr-2 h-4 w-4" />
                                Submit Good Receive
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
