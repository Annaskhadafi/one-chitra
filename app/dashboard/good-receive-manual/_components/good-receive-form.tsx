"use client"

import * as React from "react"
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
    SelectTrigger, SelectValue,
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
    poItem: z.coerce.number().min(1, "PO Item is required"),
    materialNumber: z.string().min(1, "Material is required"),
    materialDescription: z.string().optional(),
    openQty: z.coerce.number().min(0, "Open Qty is required"),
    productId: z.coerce.number().min(0),
    quantity: z.coerce.number().min(0, "Quantity tidak boleh negatif"),
    notes: z.string().optional(),
})

const formSchema = z.object({
    supplier: z.string().min(1, "Vendor is required"),
    poNumber: z.string().min(1, "PO Number is required"),
    warehouseId: z.coerce.number().min(1, "Warehouse is required"),
    receiveDate: z.date(),
    deliveryType: z.enum(["Partial", "Complete"]),
    referenceDocument: z.string().optional(),
    items: z.array(itemSchema).min(1, "At least one item is required"),
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

        if (item.productId < 1 && item.quantity > 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["items", idx, "quantity"],
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
}

function createEmptyItem(): FormValues["items"][number] {
    return {
        poItem: 0,
        materialNumber: "",
        materialDescription: "",
        openQty: 0,
        productId: 0,
        quantity: 0,
        notes: "",
    }
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
    const [open, setOpen] = React.useState(false)
    const selectedProduct = React.useMemo(
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

export function GoodReceiveForm({ warehouses, poOptions, poLineOptions, productOptions }: GoodReceiveFormProps) {
    const router = useRouter()
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as Resolver<FormValues>,
        defaultValues: {
            supplier: "",
            poNumber: "",
            warehouseId: 0,
            receiveDate: new Date(),
            deliveryType: "Complete",
            referenceDocument: "",
            items: [createEmptyItem()],
        },
    })

    const { fields, replace } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const [poComboboxOpen, setPoComboboxOpen] = React.useState(false)
    const [productCatalog, setProductCatalog] = React.useState<ProductOption[]>(productOptions)
    const [isRefreshingProducts, setIsRefreshingProducts] = React.useState(false)

    const selectedPoNumber = form.watch("poNumber")
    const selectedWarehouseId = form.watch("warehouseId")
    const watchedItems = form.watch("items")

    React.useEffect(() => {
        setProductCatalog(productOptions)
    }, [productOptions])

    const selectedPoLines = React.useMemo(
        () => poLineOptions.filter((line) => line.poNumber === selectedPoNumber),
        [poLineOptions, selectedPoNumber]
    )

    const poVendorMap = React.useMemo(
        () => new Map(poOptions.map((po) => [po.poNumber, po.vendorName])),
        [poOptions]
    )

    const selectedPoMeta = React.useMemo(
        () => poOptions.find((po) => po.poNumber === selectedPoNumber) || null,
        [poOptions, selectedPoNumber]
    )

    const selectedWarehouse = React.useMemo(
        () => warehouses.find((warehouse) => warehouse.id === Number(selectedWarehouseId)) || null,
        [warehouses, selectedWarehouseId]
    )

    const sortedProductOptions = React.useMemo(
        () => [...productCatalog].sort((a, b) => a.materialNumber.localeCompare(b.materialNumber)),
        [productCatalog]
    )

    const productById = React.useMemo(
        () => new Map(sortedProductOptions.map((product) => [product.id, product])),
        [sortedProductOptions]
    )

    const refreshProductCatalog = React.useCallback(async () => {
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
    }, [])

    React.useEffect(() => {
        const vendorName = poVendorMap.get(selectedPoNumber) || ""
        form.setValue("supplier", vendorName, { shouldValidate: true, shouldDirty: false })

        if (!selectedPoNumber) {
            replace([createEmptyItem()])
            return
        }

        const existingItems = form.getValues("items")
        const existingByPoItem = new Map(existingItems.map((item) => [item.poItem, item]))

        const mappedItems = selectedPoLines.map((line) => {
            const prev = existingByPoItem.get(line.poItem)
            const prevQtyRaw = Number(prev?.quantity ?? 0)
            const prevQty = Number.isFinite(prevQtyRaw) ? prevQtyRaw : 0
            const quantity = Math.min(Math.max(prevQty, 0), line.openQty)
            const prevProductId = Number(prev?.productId || 0)
            const autoMatchedProductId = line.productId ?? findMatchedProductId(line.materialNumber, productCatalog)

            return {
                poItem: line.poItem,
                materialNumber: line.materialNumber,
                materialDescription: line.materialDescription,
                openQty: line.openQty,
                productId: prevProductId > 0 ? prevProductId : autoMatchedProductId,
                quantity,
                notes: prev?.notes || "",
            }
        })

        replace(mappedItems.length ? mappedItems : [createEmptyItem()])
    }, [selectedPoNumber, selectedPoLines, poVendorMap, replace, form, productCatalog])

    async function onSubmit(values: FormValues) {
        try {
            const result = await createGoodReceiveManual(values)
            if (result.success) {
                toast.success("Good receive created successfully")
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-500" />
                            <CardTitle className="text-base">Header Information</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            Pilih PO Number dari daftar SAP. Vendor terisi otomatis. Warehouse dipilih sekali di header.
                        </CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-5">
                        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                            <FormField
                                control={form.control}
                                name="supplier"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vendor (Auto)</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Akan terisi otomatis setelah pilih PO"
                                                className="focus-visible:ring-indigo-500 bg-muted/40"
                                                readOnly
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="poNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PO Number</FormLabel>
                                        <Popover open={poComboboxOpen} onOpenChange={setPoComboboxOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        role="combobox"
                                                        aria-expanded={poComboboxOpen}
                                                        className={cn(
                                                            "w-full justify-between font-normal focus-visible:ring-indigo-500",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            <span className="min-w-0 text-left truncate">
                                                                <span className="font-mono">{field.value}</span>
                                                                {selectedPoMeta && (
                                                                    <span className="ml-2 text-xs text-muted-foreground">
                                                                        {formatPoDate(selectedPoMeta.poDate)} | Open {selectedPoMeta.totalOpenQty}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <span>{poOptions.length > 0 ? "Pilih PO Number..." : "Tidak ada PO open"}</span>
                                                        )}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Cari PO Number, vendor, tanggal..." />
                                                    <CommandList>
                                                        <CommandEmpty>PO tidak ditemukan.</CommandEmpty>
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
                                                                            Tanggal PO: {formatPoDate(po.poDate)} | Open Qty: {po.totalOpenQty} | {po.itemCount} item
                                                                        </p>
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        {selectedPoMeta && (
                                            <p className="text-[11px] text-muted-foreground">
                                                Tanggal PO: {formatPoDate(selectedPoMeta.poDate)} | Tinggal/Open PO: {selectedPoMeta.totalOpenQty} | {selectedPoMeta.itemCount} item
                                            </p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="warehouseId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Warehouse</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(Number(val))}
                                            value={field.value && field.value > 0 ? String(field.value) : ""}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="focus:ring-indigo-500">
                                                    <SelectValue placeholder="Pilih warehouse" />
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
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receive Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal focus-visible:ring-indigo-500",
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
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="focus:ring-indigo-500">
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

                            <FormField
                                control={form.control}
                                name="referenceDocument"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference Document <span className="normal-case font-normal">(Optional)</span></FormLabel>
                                        <FormControl>
                                            <Input placeholder="DO-12345" className="font-mono focus-visible:ring-indigo-500" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                            <PackagePlus className="h-4 w-4 text-indigo-500" />
                            <CardTitle className="text-base">
                                Items
                                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold w-5 h-5">
                                    {selectedPoNumber ? selectedPoLines.length : 0}
                                </span>
                            </CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            Semua item dari PO akan tampil otomatis. Isi Qty oleh gudang, dan boleh 0 untuk item yang belum datang.
                        </CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-0 px-0 pb-0">
                        <div className="rounded-b-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableHead className="w-[40px] text-xs font-semibold text-muted-foreground pl-4">#</TableHead>
                                        <TableHead className="w-[130px] text-xs font-semibold text-muted-foreground">PO Item</TableHead>
                                        <TableHead className="w-[300px] text-xs font-semibold text-muted-foreground">Material</TableHead>
                                        <TableHead className="w-[300px] text-xs font-semibold text-muted-foreground">Material Internal</TableHead>
                                        <TableHead className="w-[120px] text-xs font-semibold text-muted-foreground">Open Qty</TableHead>
                                        <TableHead className="w-[130px] text-xs font-semibold text-muted-foreground">Quantity</TableHead>
                                        <TableHead className="text-xs font-semibold text-muted-foreground">Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!selectedPoNumber && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                                                Pilih PO Number terlebih dahulu untuk menampilkan item.
                                            </TableCell>
                                        </TableRow>
                                    )}

                                    {selectedPoNumber && fields.map((field, index) => {
                                        const watchedRow = watchedItems?.[index]
                                        const currentProductId = Number(watchedRow?.productId ?? field.productId ?? 0)
                                        const selectedInternalProduct = productById.get(currentProductId)
                                        const isMapped = currentProductId > 0

                                        return (
                                            <TableRow key={field.id} className={cn("hover:bg-muted/30 transition-colors", !isMapped && "bg-amber-50/30 dark:bg-amber-950/10")}>
                                                <TableCell className="pl-4 text-sm text-muted-foreground font-medium">
                                                    <input type="hidden" {...form.register(`items.${index}.poItem`, { valueAsNumber: true })} />
                                                    <input type="hidden" {...form.register(`items.${index}.materialNumber`)} />
                                                    <input type="hidden" {...form.register(`items.${index}.materialDescription`)} />
                                                    <input type="hidden" {...form.register(`items.${index}.openQty`, { valueAsNumber: true })} />
                                                    {index + 1}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {field.poItem > 0 ? `Item ${field.poItem}` : "-"}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        <p className="font-mono text-[11px]">{field.materialNumber || "-"}</p>
                                                        <p className="text-xs text-muted-foreground">{field.materialDescription || "-"}</p>
                                                        {!isMapped && (
                                                            <p className="text-[11px] text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                                                                <AlertTriangle className="h-3 w-3" />
                                                                Material belum ter-mapping ke produk internal
                                                            </p>
                                                        )}
                                                    </div>
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
                                                                                materialNumber: field.materialNumber || "",
                                                                                oldMaterialNo: field.materialNumber || "",
                                                                                materialDescription: field.materialDescription || "",
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
                                                                    <p className="text-[10px] text-muted-foreground truncate">
                                                                        {selectedInternalProduct.materialDescription || "-"}
                                                                    </p>
                                                                )}
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-sm font-semibold">{field.openQty}</TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`items.${index}.quantity`}
                                                        render={({ field: qtyField }) => (
                                                            <FormItem className="space-y-1">
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        step={1}
                                                                        className="focus-visible:ring-indigo-500"
                                                                        value={qtyField.value}
                                                                        disabled={!isMapped}
                                                                        onChange={(e) => {
                                                                            const value = Number(e.target.value)
                                                                            qtyField.onChange(Number.isFinite(value) ? value : 0)
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            const openQty = Number(form.getValues(`items.${index}.openQty`) || 0)
                                                                            const value = Number(e.target.value)
                                                                            const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), openQty) : 0
                                                                            qtyField.onChange(normalized)
                                                                        }}
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
                                                            <FormItem className="space-y-0">
                                                                <FormControl>
                                                                    <Input placeholder="Optional notes..." className="focus-visible:ring-indigo-500" {...notesField} />
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

                        {itemsErrorMessage && (
                            <p className="text-sm font-medium text-destructive px-4 py-3">{itemsErrorMessage}</p>
                        )}
                    </CardContent>
                </Card>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px]"
                    >
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
