"use client"

import { useEffect, useMemo, useState } from "react"
import { useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Trash2, Plus, Loader2, PackagePlus, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createGoodReceiveManual } from "@/app/actions/good-receive-manual"
import { getTrackingDecisionPreview } from "@/app/actions/rfid"

import { Button } from "@/components/ui/button"
import { TrackingModeBadge } from "@/components/rfid/tracking-mode-badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Calendar } from "@/components/ui/calendar"
import { Separator } from "@/components/ui/separator"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
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

const formSchema = z.object({
    supplier: z.string().min(1, "Supplier is required"),
    poNumber: z.string().min(1, "PO Number is required"),
    receiveDate: z.date(),
    deliveryType: z.enum(["Partial", "Complete"]),
    referenceDocument: z.string().optional(),
    items: z.array(z.object({
        productId: z.coerce.number().min(1, "Product is required"),
        warehouseId: z.coerce.number().min(1, "Warehouse is required"),
        quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
        notes: z.string().optional(),
        rfidLines: z.string().optional(),
        manualOverrideReason: z.string().optional(),
    })).min(1, "At least one item is required"),
})

type GoodReceiveFormProps = {
    products: {
        id: number
        materialNumber: string
        materialDescription: string | null
    }[]
    warehouses: {
        id: number
        sloc: string
        description: string | null
    }[]
}

type TrackingDecisionPreviewItem = Awaited<ReturnType<typeof getTrackingDecisionPreview>>[number]

function buildTrackingDecisionKey(warehouseId: number, productId: number) {
    return `${warehouseId}:${productId}`
}

export function GoodReceiveForm({ products, warehouses }: GoodReceiveFormProps) {
    const router = useRouter()
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as Resolver<z.infer<typeof formSchema>>,
        defaultValues: {
            receiveDate: new Date(),
            deliveryType: "Complete",
            items: [{ productId: 0, warehouseId: 0, quantity: 0, notes: "", rfidLines: "", manualOverrideReason: "" }],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })
    const watchedItems = useWatch({
        control: form.control,
        name: "items",
    })
    const [trackingDecisions, setTrackingDecisions] = useState<Record<string, TrackingDecisionPreviewItem>>({})
    const [loadingTrackingDecisions, setLoadingTrackingDecisions] = useState(false)
    const groupedTrackingQueries = useMemo(() => {
        const grouped = new Map<number, Set<number>>()

        for (const item of watchedItems ?? []) {
            const warehouseId = Number(item?.warehouseId)
            const productId = Number(item?.productId)

            if (!Number.isInteger(warehouseId) || warehouseId <= 0 || !Number.isInteger(productId) || productId <= 0) {
                continue
            }

            if (!grouped.has(warehouseId)) {
                grouped.set(warehouseId, new Set<number>())
            }

            grouped.get(warehouseId)?.add(productId)
        }

        return Array.from(grouped.entries())
            .map(([warehouseId, productIds]) => ({
                warehouseId,
                productIds: Array.from(productIds).sort((a, b) => a - b),
            }))
            .sort((a, b) => a.warehouseId - b.warehouseId)
    }, [watchedItems])
    const groupedTrackingQueriesKey = useMemo(
        () => groupedTrackingQueries.map((group) => `${group.warehouseId}:${group.productIds.join(",")}`).join("|"),
        [groupedTrackingQueries],
    )
    const trackedItemCount = useMemo(
        () => Object.values(trackingDecisions).filter((decision) => decision.trackingMode !== "manual_only").length,
        [trackingDecisions],
    )

    useEffect(() => {
        let cancelled = false
        const requestMatrix = groupedTrackingQueriesKey
            .split("|")
            .filter(Boolean)
            .map((entry) => {
                const [warehouseIdPart, productIdsPart = ""] = entry.split(":")

                return {
                    warehouseId: Number(warehouseIdPart),
                    productIds: productIdsPart
                        .split(",")
                        .map((value) => Number(value))
                        .filter((value) => Number.isInteger(value) && value > 0),
                }
            })
            .filter((entry) => Number.isInteger(entry.warehouseId) && entry.warehouseId > 0 && entry.productIds.length > 0)

        if (requestMatrix.length === 0) {
            setTrackingDecisions({})
            setLoadingTrackingDecisions(false)
            return
        }

        setLoadingTrackingDecisions(true)

        Promise.all(
            requestMatrix.map(async (entry) => {
                const decisions = await getTrackingDecisionPreview(entry.warehouseId, entry.productIds)
                return decisions.map((decision) => [buildTrackingDecisionKey(entry.warehouseId, decision.productId), decision] as const)
            }),
        )
            .then((decisionGroups) => {
                if (cancelled) {
                    return
                }

                setTrackingDecisions(Object.fromEntries(decisionGroups.flat()))
            })
            .catch((error) => {
                if (cancelled) {
                    return
                }

                console.error("Failed to load good receive tracking decisions:", error)
                setTrackingDecisions({})
                toast.error("Gagal memuat aturan tracking untuk item GR")
            })
            .finally(() => {
                if (!cancelled) {
                    setLoadingTrackingDecisions(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [groupedTrackingQueriesKey])

    async function onSubmit(values: z.infer<typeof formSchema>) {
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

    return (
        <TooltipProvider>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                    {/* Section 1: Header Information */}
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-indigo-500" />
                                <CardTitle className="text-base">Header Information</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Fill in the supplier and document details for this receipt.
                            </CardDescription>
                        </CardHeader>
                        <Separator />
                        <CardContent className="pt-5">
                            <div className="grid gap-5 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="supplier"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Supplier Name" className="focus-visible:ring-indigo-500" {...field} />
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
                                            <FormControl>
                                                <Input placeholder="PO-12345" className="font-mono focus-visible:ring-indigo-500" {...field} />
                                            </FormControl>
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
                                <FormField
                                    control={form.control}
                                    name="deliveryType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                    {/* Section 2: Items */}
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PackagePlus className="h-4 w-4 text-indigo-500" />
                                    <CardTitle className="text-base">
                                        Items
                                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold w-5 h-5">{fields.length}</span>
                                    </CardTitle>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ productId: 0, warehouseId: 0, quantity: 1, notes: "", rfidLines: "", manualOverrideReason: "" })}
                                    className="border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Item
                                </Button>
                            </div>
                            <CardDescription className="text-xs">
                                Add products with their target warehouse and quantity.
                            </CardDescription>
                        </CardHeader>
                        <Separator />
                        <CardContent className="pt-0 px-0 pb-0">
                            {trackedItemCount > 0 && (
                                <div className="mx-6 mt-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                    {trackedItemCount} kombinasi item-gudang di penerimaan ini ikut pilot RFID. GR manual tetap boleh diproses, lalu lanjutkan tagging/registrasi material sesuai badge tiap baris.
                                </div>
                            )}
                            {loadingTrackingDecisions && (
                                <div className="mx-6 mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    Menyelaraskan aturan tracking warehouse...
                                </div>
                            )}
                            <div className="rounded-b-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead className="w-[40px] text-xs font-semibold text-muted-foreground pl-4">#</TableHead>
                                            <TableHead className="w-[300px] text-xs font-semibold text-muted-foreground">Product</TableHead>
                                            <TableHead className="w-[200px] text-xs font-semibold text-muted-foreground">Warehouse</TableHead>
                                            <TableHead className="w-[100px] text-xs font-semibold text-muted-foreground">Quantity</TableHead>
                                            <TableHead className="w-[320px] text-xs font-semibold text-muted-foreground">RFID / Serial</TableHead>
                                            <TableHead className="text-xs font-semibold text-muted-foreground">Notes</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => (
                                            <TableRow key={field.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="pl-4 text-sm text-muted-foreground font-medium">{index + 1}</TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`items.${index}.productId`}
                                                        render={({ field }) => (
                                                            <FormItem className="space-y-0">
                                                                {(() => {
                                                                    const selectedWarehouseId = Number(form.getValues(`items.${index}.warehouseId`) || 0)
                                                                    const selectedProductId = Number(field.value || 0)
                                                                    const trackingDecision = trackingDecisions[buildTrackingDecisionKey(selectedWarehouseId, selectedProductId)]

                                                                    return (
                                                                        <>
                                                                        <Select
                                                                            onValueChange={(val) => field.onChange(parseInt(val))}
                                                                            value={field.value?.toString() === "0" ? "" : field.value?.toString()}
                                                                        >
                                                                            <FormControl>
                                                                        <SelectTrigger className="focus:ring-indigo-500">
                                                                            <SelectValue placeholder="Select product" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {products.map((product) => (
                                                                            <SelectItem key={product.id} value={product.id.toString()}>
                                                                                {product.materialNumber} - {product.materialDescription}
                                                                            </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                            {trackingDecision ? (
                                                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                                    <TrackingModeBadge mode={trackingDecision.trackingMode} />
                                                                                    {trackingDecision.serialRequired && (
                                                                                        <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-700">
                                                                                            Serial / Tag Follow-up
                                                                                        </span>
                                                                                    )}
                                                                                    {trackingDecision.trackingMode === "required_rfid" && trackingDecision.allowManualFallback && (
                                                                                        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                                                                                            Manual OK
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            ) : null}
                                                                            {trackingDecision?.trackingMode !== "manual_only" && (
                                                                                <p className="mt-2 text-xs text-muted-foreground">
                                                                                    {trackingDecision.reason}
                                                                                </p>
                                                                            )}
                                                                        </>
                                                                    )
                                                                })()}
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`items.${index}.warehouseId`}
                                                        render={({ field }) => (
                                                            <FormItem className="space-y-0">
                                                                <Select
                                                                    onValueChange={(val) => field.onChange(parseInt(val))}
                                                                    value={field.value?.toString() === "0" ? "" : field.value?.toString()}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger className="focus:ring-indigo-500">
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
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`items.${index}.quantity`}
                                                        render={({ field }) => (
                                                            <FormItem className="space-y-0">
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        className="focus-visible:ring-indigo-500"
                                                                        {...field}
                                                                        onChange={e => field.onChange(Number(e.target.value))}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        const selectedWarehouseId = Number(form.getValues(`items.${index}.warehouseId`) || 0)
                                                        const selectedProductId = Number(form.getValues(`items.${index}.productId`) || 0)
                                                        const trackingDecision = trackingDecisions[buildTrackingDecisionKey(selectedWarehouseId, selectedProductId)]

                                                        if (!trackingDecision || trackingDecision.trackingMode === "manual_only") {
                                                            return (
                                                                <div className="text-xs text-muted-foreground">
                                                                    Item ini masih manual-only, jadi serial/EPC RFID belum diperlukan.
                                                                </div>
                                                            )
                                                        }

                                                        return (
                                                            <div className="space-y-3">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`items.${index}.rfidLines`}
                                                                    render={({ field }) => (
                                                                        <FormItem className="space-y-1">
                                                                            <FormControl>
                                                                                <Textarea
                                                                                    {...field}
                                                                                    rows={4}
                                                                                    className="text-xs font-mono focus-visible:ring-indigo-500"
                                                                                    placeholder={"Format per line:\nSERIAL-001|E280...\nSERIAL-002|E280...|TID-OPTIONAL"}
                                                                                />
                                                                            </FormControl>
                                                                            <p className="text-[11px] text-muted-foreground">
                                                                                Satu baris = satu unit. Pakai format <span className="font-mono">SERIAL|EPC</span> atau <span className="font-mono">SERIAL|EPC|TID</span>.
                                                                            </p>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                <FormField
                                                                    control={form.control}
                                                                    name={`items.${index}.manualOverrideReason`}
                                                                    render={({ field }) => (
                                                                        <FormItem className="space-y-1">
                                                                            <FormControl>
                                                                                <Input
                                                                                    {...field}
                                                                                    placeholder="Alasan jika tagging ditunda / manual override"
                                                                                    className="h-8 text-xs focus-visible:ring-indigo-500"
                                                                                />
                                                                            </FormControl>
                                                                            {trackingDecision.trackingMode === "required_rfid" ? (
                                                                                <p className="text-[11px] text-muted-foreground">
                                                                                    Untuk item pilot RFID, isi alasan ini jika barang diterima dulu dan tagging menyusul.
                                                                                </p>
                                                                            ) : null}
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </div>
                                                        )
                                                    })()}
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name={`items.${index}.notes`}
                                                        render={({ field }) => (
                                                            <FormItem className="space-y-0">
                                                                <FormControl>
                                                                    <Input placeholder="Optional notes..." className="focus-visible:ring-indigo-500" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => remove(index)}
                                                                disabled={fields.length === 1}
                                                                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="left">
                                                            <p>Remove item</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {form.formState.errors.items?.root && (
                                <p className="text-sm font-medium text-destructive px-4 pb-4">
                                    {form.formState.errors.items.root.message}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Form Actions */}
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
        </TooltipProvider>
    )
}
