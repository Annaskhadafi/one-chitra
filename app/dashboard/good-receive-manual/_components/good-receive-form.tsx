"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2, PackagePlus, FileText, Check, ChevronsUpDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createGoodReceiveManual } from "@/app/actions/good-receive-manual"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ProductDialog } from "@/app/dashboard/products/_components/product-dialog"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const formSchema = z.object({
    poNumber: z.string().min(1, "PO Number is required"),
    warehouseId: z.coerce.number().min(1, "Warehouse is required"),
    receiveDate: z.date(),
    deliveryType: z.enum(["Partial", "Complete"]),
    referenceDocument: z.string().optional(),
    notifyRoles: z.array(z.string()).optional(),
    notifyUserIds: z.array(z.string()).optional(),
    items: z.array(z.object({
        poItem: z.coerce.number().min(1, "PO item is required"),
        materialNumber: z.string().min(1, "Material number is required"),
        productId: z.coerce.number().min(0),
        openQty: z.coerce.number().min(0),
        quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
        notes: z.string().optional(),
    })).min(1, "At least one item is required"),
})

type GoodReceiveFormProps = {
    warehouses?: { id: number; sloc: string; description: string | null }[]
    poOptions?: { poNumber: string; vendorName: string; poDate: string | null; totalOpenQty: number; itemCount: number }[]
    poLineOptions?: { poNumber: string; vendorName: string; poItem: number; materialNumber: string; materialDescription: string; openQty: number; productId: number | null }[]
    productOptions?: { id: number; materialNumber: string; materialDescription: string | null; oldMaterialNo: string | null; materialNumberCk: string | null; sloc: string | null }[]
    notificationRoles?: string[]
    notificationUsers?: { id: string; name: string | null; email: string | null; role: string | null }[]
}

export function GoodReceiveForm({ warehouses = [], poOptions = [], poLineOptions = [], productOptions = [] }: GoodReceiveFormProps) {
    const router = useRouter()
    const [poOpen, setPoOpen] = useState(false)
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as Resolver<z.infer<typeof formSchema>>,
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
    const selectedPo = poOptions.find((po) => po.poNumber === selectedPoNumber)
    const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId)
    const availableLines = poLineOptions.filter((line) => line.poNumber === selectedPoNumber)
    const productMap = new Map(productOptions.map((product) => [product.id, product]))

    useEffect(() => {
        if (!selectedPoNumber) {
            if (form.getValues("items").length > 0) {
                replace([])
            }
            return
        }

        const currentItems = form.getValues("items")
        const currentItemMap = new Map(currentItems.map((item) => [item.poItem, item]))
        const nextItems = availableLines.map((line) => {
            const currentItem = currentItemMap.get(line.poItem)
            return {
                poItem: line.poItem,
                materialNumber: line.materialNumber,
                productId: line.productId ?? 0,
                openQty: line.openQty,
                quantity: currentItem?.quantity ?? 0,
                notes: currentItem?.notes ?? "",
            }
        })

        const hasChanged = currentItems.length !== nextItems.length || currentItems.some((item, index) => {
            const nextItem = nextItems[index]
            return !nextItem
                || item.poItem !== nextItem.poItem
                || item.materialNumber !== nextItem.materialNumber
                || item.productId !== nextItem.productId
                || item.openQty !== nextItem.openQty
                || item.quantity !== nextItem.quantity
                || (item.notes ?? "") !== (nextItem.notes ?? "")
        })

        if (hasChanged) {
            replace(nextItems)
        }
    }, [availableLines, form, replace, selectedPoNumber])

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
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-indigo-500" />
                                <CardTitle className="text-base">Header Information</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Choose the PO, receipt warehouse, and document details.
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
                                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PO Number</FormLabel>
                                            <Popover open={poOpen} onOpenChange={setPoOpen}>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            role="combobox"
                                                            aria-expanded={poOpen}
                                                            className={cn(
                                                                "w-full justify-between font-normal focus-visible:ring-indigo-500",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value
                                                                ? `${field.value} - ${selectedPo?.vendorName ?? ""}`
                                                                : "Search PO number"}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search PO number or supplier..." />
                                                        <CommandList>
                                                            <CommandEmpty>No PO found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {poOptions.map((po) => (
                                                                    <CommandItem
                                                                        key={po.poNumber}
                                                                        value={`${po.poNumber} ${po.vendorName} ${po.poDate ?? ""}`}
                                                                        onSelect={() => {
                                                                            field.onChange(po.poNumber)
                                                                            setPoOpen(false)
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                field.value === po.poNumber ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <div className="flex min-w-0 flex-col">
                                                                            <span className="truncate">{po.poNumber} - {po.vendorName}</span>
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {po.itemCount} items, open qty {po.totalOpenQty}
                                                                            </span>
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
                                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</FormLabel>
                                    <FormControl>
                                        <Input
                                            value={selectedPo?.vendorName ?? ""}
                                            placeholder="Supplier will follow selected PO"
                                            disabled
                                            className="focus-visible:ring-indigo-500"
                                        />
                                    </FormControl>
                                </FormItem>

                                <FormField
                                    control={form.control}
                                    name="warehouseId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Warehouse</FormLabel>
                                            <Select
                                                onValueChange={(val) => field.onChange(parseInt(val, 10))}
                                                value={field.value > 0 ? field.value.toString() : ""}
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

                    <Card className="shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <PackagePlus className="h-4 w-4 text-indigo-500" />
                                <CardTitle className="text-base">
                                    Items
                                    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold w-5 h-5">{fields.length}</span>
                                </CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Semua open item dari PO terpilih akan muncul otomatis di sini.
                            </CardDescription>
                        </CardHeader>
                        <Separator />
                        <CardContent className="pt-0 px-0 pb-0">
                            <div className="rounded-b-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead className="w-[40px] text-xs font-semibold text-muted-foreground pl-4">#</TableHead>
                                            <TableHead className="w-[320px] text-xs font-semibold text-muted-foreground">PO Item</TableHead>
                                            <TableHead className="text-xs font-semibold text-muted-foreground">Internal Product</TableHead>
                                            <TableHead className="w-[100px] text-xs font-semibold text-muted-foreground">Open Qty</TableHead>
                                            <TableHead className="w-[100px] text-xs font-semibold text-muted-foreground">Quantity</TableHead>
                                            <TableHead className="text-xs font-semibold text-muted-foreground">Notes</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => {
                                            const selectedPoItem = form.watch(`items.${index}.poItem`)
                                            const selectedLine = availableLines.find((line) => line.poItem === selectedPoItem)
                                            const selectedProduct = productMap.get(form.watch(`items.${index}.productId`))

                                            return (
                                                <TableRow key={field.id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="pl-4 text-sm text-muted-foreground font-medium">{index + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="text-sm font-medium">
                                                            {selectedLine?.materialNumber ?? "-"}
                                                        </div>
                                                        {selectedLine && (
                                                            <p className="mt-2 text-xs text-muted-foreground">
                                                                {selectedLine.materialDescription}
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {selectedProduct
                                                            ? `${selectedProduct.materialNumber} - ${selectedProduct.materialDescription ?? "-"}`
                                                            : selectedLine
                                                                ? (
                                                                    <div className="space-y-2">
                                                                        <p>No internal product mapping</p>
                                                                        <ProductDialog
                                                                            initialValues={{
                                                                                materialNumber: selectedLine.materialNumber,
                                                                                materialDescription: selectedLine.materialDescription,
                                                                                sloc: selectedWarehouse?.sloc ?? "",
                                                                                slocDescription: selectedWarehouse?.description ?? "",
                                                                            }}
                                                                            onSuccess={() => router.refresh()}
                                                                            trigger={
                                                                                <Button type="button" variant="outline" size="sm">
                                                                                    Register Product
                                                                                </Button>
                                                                            }
                                                                        />
                                                                    </div>
                                                                )
                                                                : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium">
                                                        {selectedLine?.openQty ?? 0}
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
                                                                            min={0}
                                                                            max={selectedLine?.openQty ?? 0}
                                                                            className="focus-visible:ring-indigo-500"
                                                                            {...field}
                                                                            onChange={(e) => field.onChange(Number(e.target.value))}
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
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            {!selectedPoNumber && (
                                <p className="px-4 py-3 text-sm text-muted-foreground">
                                    Select a PO number first to load all PO items automatically.
                                </p>
                            )}
                            {selectedPoNumber && fields.length === 0 && (
                                <p className="px-4 py-3 text-sm text-muted-foreground">
                                    Tidak ada open item untuk PO ini.
                                </p>
                            )}
                            {form.formState.errors.items?.root && (
                                <p className="text-sm font-medium text-destructive px-4 pb-4">
                                    {form.formState.errors.items.root.message}
                                </p>
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
