"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2, Plus, Trash, Check, ChevronsUpDown, Package, CheckCircle2, XCircle } from "lucide-react"

import { getTrackingDecisionPreview } from "@/app/actions/rfid"
import { TrackingModeBadge } from "@/components/rfid/tracking-mode-badge"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { createStockTransfer, checkTransferStockAvailability } from "@/app/actions/stock-transfer"
import { toast } from "sonner"

const stockTransferItemSchema = z.object({
    productId: z.string().min(1, "Product is required"),
    quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Must be > 0",
    }),
})

const formSchema = z.object({
    sourceWarehouseId: z.string().min(1, "Source warehouse is required"),
    destinationWarehouseId: z.string().min(1, "Destination warehouse is required"),
    transferDate: z.date(),
    notes: z.string().optional(),
    items: z.array(stockTransferItemSchema).min(1, "At least one item is required"),
}).refine(data => data.sourceWarehouseId !== data.destinationWarehouseId, {
    message: "Source and destination must be different",
    path: ["destinationWarehouseId"],
})

interface CreateTransferFormProps {
    warehouses: { id: number; sloc: string; description: string | null }[]
    products: { id: number; materialNumber: string; materialDescription: string | null; sloc: string | null; slocDescription: string | null }[]
}

interface ProductSelectorProps {
    products: { id: number; materialNumber: string; materialDescription: string | null; sloc: string | null; slocDescription: string | null }[]
    value: string
    onSelect: (value: string) => void
}

type TrackingDecisionPreviewItem = Awaited<ReturnType<typeof getTrackingDecisionPreview>>[number]

function ProductSelector({ products, value, onSelect }: ProductSelectorProps) {
    const [open, setOpen] = useState(false)

    // Group products by materialDescription
    const groupedProducts = useMemo(() => {
        const groups: Record<string, typeof products> = {}
        products.forEach(p => {
            const key = p.materialDescription || "Other"
            if (!groups[key]) groups[key] = []
            groups[key].push(p)
        })
        return groups
    }, [products])

    const selectedProduct = products.find(p => p.id.toString() === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <FormControl>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between",
                            !value && "text-muted-foreground"
                        )}
                    >
                        {selectedProduct
                            ? `${selectedProduct.materialNumber} - ${selectedProduct.materialDescription || ""}`
                            : "Select product..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0">
                <Command>
                    <CommandInput placeholder="Search product..." />
                    <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        {Object.entries(groupedProducts).map(([groupName, items]) => (
                            <CommandGroup key={groupName} heading={groupName}>
                                {items.map((product) => (
                                    <CommandItem
                                        key={product.id}
                                        value={`${product.materialDescription || ""} ${product.materialNumber} ${product.sloc || ""}`}
                                        onSelect={() => {
                                            onSelect(product.id.toString())
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === product.id.toString()
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{product.materialNumber}</span>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{product.materialDescription}</span>
                                                {product.sloc && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{product.sloc}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export function CreateTransferForm({ warehouses, products }: CreateTransferFormProps) {
    const router = useRouter()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            sourceWarehouseId: "",
            destinationWarehouseId: "",
            transferDate: new Date(),
            notes: "",
            items: [{ productId: "", quantity: "1" }],
        },
    })

    const { fields, append, remove } = useFieldArray({
        // Casting to any to satisfy TypeScript's strict type expectations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        control: form.control as any,
        name: "items",
    })

    const [stockResults, setStockResults] = useState<{ productId: number; available: number; sufficient: boolean }[]>([])
    const [checkingStock, setCheckingStock] = useState(false)
    const [trackingDecisions, setTrackingDecisions] = useState<Record<number, TrackingDecisionPreviewItem>>({})
    const [loadingTrackingDecisions, setLoadingTrackingDecisions] = useState(false)

    const isSubmitting = form.formState.isSubmitting
    const watchedSourceWarehouseId = useWatch({
        control: form.control,
        name: "sourceWarehouseId",
    })
    const watchedItems = useWatch({
        control: form.control,
        name: "items",
    })
    const trackedProductIds = useMemo(
        () => Array.from(new Set((watchedItems ?? []).map((item) => Number(item?.productId)).filter((productId) => Number.isInteger(productId) && productId > 0))).sort((a, b) => a - b),
        [watchedItems],
    )
    const trackedProductIdsKey = useMemo(() => trackedProductIds.join(","), [trackedProductIds])
    const trackedItemCount = useMemo(
        () => Object.values(trackingDecisions).filter((decision) => decision.trackingMode !== "manual_only").length,
        [trackingDecisions],
    )

    useEffect(() => {
        let cancelled = false
        const productIds = trackedProductIdsKey
            .split(",")
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)

        if (!watchedSourceWarehouseId || productIds.length === 0) {
            setTrackingDecisions({})
            setLoadingTrackingDecisions(false)
            return
        }

        setLoadingTrackingDecisions(true)

        getTrackingDecisionPreview(Number(watchedSourceWarehouseId), productIds)
            .then((decisions) => {
                if (cancelled) {
                    return
                }

                setTrackingDecisions(
                    Object.fromEntries(decisions.map((decision) => [decision.productId, decision])),
                )
            })
            .catch((error) => {
                if (cancelled) {
                    return
                }

                console.error("Failed to load transfer tracking decisions:", error)
                setTrackingDecisions({})
                toast.error("Failed to load tracking policy for source warehouse")
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingTrackingDecisions(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [trackedProductIdsKey, watchedSourceWarehouseId])

    async function handleCheckStock() {
        const sourceWhId = form.getValues("sourceWarehouseId")
        const items = form.getValues("items")

        if (!sourceWhId) {
            toast.error("Please select a source warehouse first")
            return
        }

        if (items.length === 0 || !items[0].productId) {
            toast.error("Please add at least one product")
            return
        }

        setCheckingStock(true)
        try {
            const results = await checkTransferStockAvailability(
                parseInt(sourceWhId),
                items.map(i => ({ productId: parseInt(i.productId), quantity: parseInt(i.quantity) }))
            )
            setStockResults(results)
        } catch {
            toast.error("Failed to check stock")
        } finally {
            setCheckingStock(false)
        }
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const result = await createStockTransfer({
                sourceWarehouseId: parseInt(values.sourceWarehouseId),
                destinationWarehouseId: parseInt(values.destinationWarehouseId),
                transferDate: values.transferDate,
                notes: values.notes,
                items: values.items.map(item => ({
                    productId: parseInt(item.productId),
                    quantity: parseInt(item.quantity),
                })),
            })

            if (result.success) {
                toast.success("Stock transferred successfully")
                router.push("/dashboard/stock-transfers")
            } else {
                toast.error("error" in result ? result.error : "Failed to transfer")
            }
        } catch {
            toast.error("An unexpected error occurred")
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <FormField
                        control={form.control}
                        name="sourceWarehouseId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>From Warehouse <span className="text-red-500">*</span></FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Source Warehouse" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {warehouses.map((w) => (
                                            <SelectItem key={w.id} value={w.id.toString()}>
                                                {w.sloc} - {w.description}
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
                        name="destinationWarehouseId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>To Warehouse <span className="text-red-500">*</span></FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Destination Warehouse" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {warehouses.map((w) => (
                                            <SelectItem key={w.id} value={w.id.toString()}>
                                                {w.sloc} - {w.description}
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
                        name="transferDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Stock Transfer Date <span className="text-red-500">*</span></FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? (
                                                    format(field.value, "PPP")
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={(date) =>
                                                date > new Date() || date < new Date("1900-01-01")
                                            }
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-medium">Products</h3>
                            <p className="text-sm text-muted-foreground">
                                Tracking mengikuti policy gudang asal per item. Transfer manual tetap tersedia untuk warehouse pilot.
                            </p>
                        </div>
                        {loadingTrackingDecisions && watchedSourceWarehouseId ? (
                            <span className="text-xs text-muted-foreground">Loading tracking rules...</span>
                        ) : null}
                    </div>

                    {trackedItemCount > 0 && (
                        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                            {trackedItemCount} item pada transfer ini ikut pilot RFID di warehouse asal. Transfer manual tetap bisa disimpan; jika serial atau tag belum dicatat, sistem akan membuat follow-up exception RFID tanpa mengganggu proses transfer yang berjalan sekarang.
                        </div>
                    )}

                    <div className="rounded-md border">
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="w-[150px]">Quantity</TableHead>
                                    <TableHead className="w-[200px] text-right">Availability (Source)</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.productId`}
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <ProductSelector
                                                            products={products}
                                                            value={field.value}
                                                            onSelect={field.onChange}
                                                        />
                                                        {field.value ? (
                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                <TrackingModeBadge
                                                                    mode={trackingDecisions[Number(field.value)]?.trackingMode ?? "manual_only"}
                                                                />
                                                                {trackingDecisions[Number(field.value)]?.serialRequired && (
                                                                    <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">
                                                                        Serial Required
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : null}
                                                        {field.value && trackingDecisions[Number(field.value)]?.trackingMode !== "manual_only" ? (
                                                            <p className="mt-2 text-xs text-muted-foreground">
                                                                {trackingDecisions[Number(field.value)]?.reason}
                                                            </p>
                                                        ) : null}
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.quantity`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                {...field}
                                                                min="1"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {stockResults.find(r => r.productId === parseInt(form.getValues(`items.${index}.productId`))) ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className={cn(
                                                        "flex items-center gap-1.5 font-medium text-xs",
                                                        stockResults.find(r => r.productId === parseInt(form.getValues(`items.${index}.productId`)))?.sufficient ? "text-green-600" : "text-red-600"
                                                    )}>
                                                        {stockResults.find(r => r.productId === parseInt(form.getValues(`items.${index}.productId`)))?.sufficient ? (
                                                            <>
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                <span>Available</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <XCircle className="h-3 w-3" />
                                                                <span>Insufficient</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {stockResults.find(r => r.productId === parseInt(form.getValues(`items.${index}.productId`)))?.available} in stock
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground italic">Check stock...</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => remove(index)}
                                                disabled={fields.length === 1}
                                            >
                                                <Trash className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => append({ productId: "", quantity: "1" })}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Product
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-2"
                            onClick={handleCheckStock}
                            disabled={checkingStock || !form.getValues("sourceWarehouseId")}
                        >
                            {checkingStock ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Package className="mr-2 h-4 w-4" />
                            )}
                            Check Stock
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4">
                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Add notes..."
                                        className="resize-none"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Transfer
                    </Button>
                </div>
            </form>
        </Form>
    )
}
