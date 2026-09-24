"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm, useFieldArray, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2, PackagePlus, FileText, Check, ChevronsUpDown, ImageIcon, Mail, ExternalLink, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createGoodReceiveManual, getManualGoodReceiveEmailCcMap } from "@/app/actions/good-receive-manual"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { ProductDialog } from "@/app/dashboard/products/_components/product-dialog"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { optimizeImageForUpload, uploadFileToObjectStorage } from "@/lib/client-upload"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const formSchema = z.object({
    poNumber: z.string().min(1, "PO Number is required"),
    warehouseId: z.coerce.number().min(1, "Warehouse is required"),
    receiveDate: z.date(),
    deliveryType: z.enum(["Partial", "Complete"]),
    referenceDocument: z.string().optional(),
    vendorDoUrl: z.string().optional(),
    emailCc: z.string().optional(),
    notifyRoles: z.array(z.string()).optional(),
    notifyUserIds: z.array(z.string()).optional(),
    items: z.array(z.object({
        poItem: z.coerce.number().min(1, "PO item is required"),
        materialNumber: z.string().min(1, "Material number is required"),
        productId: z.coerce.number().min(0),
        openQty: z.coerce.number().min(0),
        poQty: z.coerce.number().min(0),
        quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
        notes: z.string().optional(),
    })).min(1, "At least one item is required"),
}).superRefine((data, ctx) => {
    data.items.forEach((item, index) => {
        if (item.quantity > item.openQty) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Quantity tidak boleh melebihi open qty (${item.openQty})`,
                path: ["items", index, "quantity"],
            })
        }
    })
})

type GoodReceiveFormProps = {
    warehouses?: { id: number; sloc: string; description: string | null }[]
    poOptions?: { poNumber: string; vendorName: string; poDate: string | null; totalPoQty: number; itemCount: number }[]
    poLineOptions?: { poNumber: string; vendorName: string; poItem: number; materialNumber: string; materialDescription: string; poQty: number; openQty: number; productId: number | null }[]
    productOptions?: { id: number; materialNumber: string; materialDescription: string | null; oldMaterialNo: string | null; materialNumberCk: string | null; sloc: string | null }[]
    eprEmailCcByPo?: Record<string, string>
    notificationRoles?: string[]
    notificationUsers?: { id: string; name: string | null; email: string | null; role: string | null }[]
}

export function GoodReceiveForm({
    warehouses = [],
    poOptions = [],
    poLineOptions = [],
    productOptions = [],
    eprEmailCcByPo = {},
    notificationRoles = [],
    notificationUsers = [],
}: GoodReceiveFormProps) {
    const router = useRouter()
    const [poOpen, setPoOpen] = useState(false)
    const [poSearch, setPoSearch] = useState("")
    const [isMobileLayout, setIsMobileLayout] = useState(false)
    const [isUploadingVendorDo, setIsUploadingVendorDo] = useState(false)
    const [vendorDoUploadProgress, setVendorDoUploadProgress] = useState(0)
    const defaultNotifyRoles = notificationRoles.filter((role) => {
        const normalizedRole = role.trim().toLowerCase()
        return normalizedRole === "admin" || normalizedRole === "billing"
    })
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as Resolver<z.infer<typeof formSchema>>,
        defaultValues: {
            poNumber: "",
            warehouseId: 0,
            receiveDate: new Date(),
            deliveryType: "Complete",
            referenceDocument: "",
            vendorDoUrl: "",
            emailCc: "",
            notifyRoles: defaultNotifyRoles,
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
    const selectedPo = useMemo(
        () => poOptions.find((po) => po.poNumber === selectedPoNumber),
        [poOptions, selectedPoNumber],
    )
    const selectedWarehouse = useMemo(
        () => warehouses.find((warehouse) => warehouse.id === selectedWarehouseId),
        [warehouses, selectedWarehouseId],
    )
    const availableLines = useMemo(
        () => poLineOptions.filter((line) => line.poNumber === selectedPoNumber),
        [poLineOptions, selectedPoNumber],
    )
    const availableLineByItem = useMemo(
        () => new Map(availableLines.map((line) => [line.poItem, line])),
        [availableLines],
    )
    const productMap = useMemo(
        () => new Map(productOptions.map((product) => [product.id, product])),
        [productOptions],
    )
    const filteredPoOptions = useMemo(() => {
        const query = poSearch.trim().toLowerCase()
        if (!query) return poOptions.slice(0, 100)

        return poOptions
            .filter((po) => `${po.poNumber} ${po.vendorName} ${po.poDate ?? ""}`.toLowerCase().includes(query))
            .slice(0, 100)
    }, [poOptions, poSearch])
    const vendorDoUrl = form.watch("vendorDoUrl")
    const selectedNotifyRoles = form.watch("notifyRoles") ?? []
    const selectedNotifyUserIds = form.watch("notifyUserIds") ?? []

    useEffect(() => {
        const media = window.matchMedia("(max-width: 767px)")
        const updateLayout = () => setIsMobileLayout(media.matches)
        updateLayout()
        media.addEventListener("change", updateLayout)
        return () => media.removeEventListener("change", updateLayout)
    }, [])

    useEffect(() => {
        if (!selectedPoNumber) {
            if (form.getValues("items").length > 0) {
                replace([])
            }
            if (form.getValues("emailCc")) {
                form.setValue("emailCc", "", { shouldDirty: true })
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
                poQty: line.poQty,
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
                || item.poQty !== nextItem.poQty
                || item.openQty !== nextItem.openQty
                || item.quantity !== nextItem.quantity
                || (item.notes ?? "") !== (nextItem.notes ?? "")
        })

        if (hasChanged) {
            replace(nextItems)
        }

        const nextEmailCc = eprEmailCcByPo[selectedPoNumber]
        form.setValue("emailCc", nextEmailCc ?? "", { shouldDirty: false })
        if (nextEmailCc !== undefined) return

        let cancelled = false
        void getManualGoodReceiveEmailCcMap([selectedPoNumber]).then((emailMap) => {
            if (!cancelled && !form.getFieldState("emailCc").isDirty && form.getValues("poNumber") === selectedPoNumber) {
                form.setValue("emailCc", emailMap[selectedPoNumber] ?? "", { shouldDirty: false })
            }
        }).catch(() => undefined)

        return () => {
            cancelled = true
        }
    }, [availableLines, eprEmailCcByPo, form, replace, selectedPoNumber])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const result = await createGoodReceiveManual(values)
            if (result.success) {
                if (result.notification?.queued) {
                    toast.success("Good receive created successfully. Email notification is being processed in the background.")
                } else if (result.notification?.sent) {
                    toast.success(`Good receive created successfully and email sent to ${result.notification.recipientCount ?? 0} recipient(s)`)
                } else if (result.notification && !result.notification.sent) {
                    toast.warning(`Good receive saved, but email was not sent${result.notification.reason ? `: ${result.notification.reason}` : ""}`)
                } else {
                    toast.success("Good receive created successfully")
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
    const vendorDoIsPdf = /\.pdf($|\?)/i.test(vendorDoUrl || "")

    const toggleSelection = (fieldName: "notifyRoles" | "notifyUserIds", value: string, checked: boolean) => {
        const current = form.getValues(fieldName) ?? []
        const next = checked ? Array.from(new Set([...current, value])) : current.filter((entry) => entry !== value)
        form.setValue(fieldName, next, { shouldDirty: true })
    }

    const handleVendorDoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setIsUploadingVendorDo(true)
        setVendorDoUploadProgress(0)
        try {
            const optimizedFile = await optimizeImageForUpload(file)
            const result = await uploadFileToObjectStorage(optimizedFile, setVendorDoUploadProgress)
            if (!result.success || !result.url) {
                toast.error(result.error || "Failed to upload Foto DO Vendor")
                return
            }

            form.setValue("vendorDoUrl", result.url, { shouldDirty: true, shouldValidate: true })
            toast.success(
                optimizedFile !== file
                    ? "Foto DO Vendor uploaded dengan optimasi ukuran"
                    : "Foto DO Vendor uploaded",
            )
        } catch {
            toast.error("An error occurred while uploading Foto DO Vendor")
        } finally {
            setTimeout(() => {
                setIsUploadingVendorDo(false)
                setVendorDoUploadProgress(0)
                event.target.value = ""
            }, 400)
        }
    }

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
                                            <Popover
                                                open={poOpen}
                                                onOpenChange={(open) => {
                                                    setPoOpen(open)
                                                    if (!open) setPoSearch("")
                                                }}
                                            >
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            role="combobox"
                                                            aria-expanded={poOpen}
                                                            className={cn(
                                                                "h-auto min-h-10 w-full justify-between gap-2 whitespace-normal text-left font-normal focus-visible:ring-indigo-500",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            <span className="min-w-0 break-words">
                                                                {field.value
                                                                    ? `${field.value} - ${selectedPo?.vendorName ?? ""}`
                                                                    : "Search PO number"}
                                                            </span>
                                                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                    <Command shouldFilter={false}>
                                                        <CommandInput
                                                            placeholder="Search PO number or supplier..."
                                                            value={poSearch}
                                                            onValueChange={setPoSearch}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>No PO found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {filteredPoOptions.map((po) => (
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
                                                                                {po.itemCount} items, PO Qty {po.totalPoQty}
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

                                <FormField
                                    control={form.control}
                                    name="vendorDoUrl"
                                    render={() => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Foto DO Vendor</FormLabel>
                                            <div className="rounded-lg border border-dashed p-4 space-y-3">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium">Upload foto atau PDF DO vendor</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            File ini akan tampil di tabel GR Manual dan ikut dikirim sebagai attachment email jika notifikasi dipilih.
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="file"
                                                            accept="image/*,application/pdf"
                                                            onChange={handleVendorDoUpload}
                                                            disabled={isUploadingVendorDo || isSubmitting}
                                                            className="max-w-[280px] text-xs"
                                                        />
                                                        {isUploadingVendorDo && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                                    </div>
                                                </div>

                                                {isUploadingVendorDo && (
                                                    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="font-medium text-foreground">Uploading ke object storage...</span>
                                                            <span className="font-semibold tabular-nums">{vendorDoUploadProgress}%</span>
                                                        </div>
                                                        <Progress value={vendorDoUploadProgress} className="h-2" />
                                                        <p className="text-[11px] text-muted-foreground">
                                                            Gambar akan dioptimasi dulu di browser agar upload lebih cepat. PDF tetap dikirim apa adanya.
                                                        </p>
                                                    </div>
                                                )}

                                                {vendorDoUrl ? (
                                                    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                                                        <div className="flex flex-wrap items-center gap-2 justify-between">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <ImageIcon className="h-4 w-4 text-indigo-500" />
                                                                <span className="text-sm font-medium truncate">DO Vendor uploaded</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button type="button" variant="outline" size="sm" asChild>
                                                                    <a href={vendorDoUrl} target="_blank" rel="noreferrer">
                                                                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                                                        View File
                                                                    </a>
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => form.setValue("vendorDoUrl", "", { shouldDirty: true, shouldValidate: true })}
                                                                >
                                                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                                    Remove
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        {vendorDoIsPdf ? (
                                                            <iframe
                                                                src={vendorDoUrl}
                                                                title="Vendor DO Preview"
                                                                className="w-full h-[320px] rounded-md border bg-white"
                                                            />
                                                        ) : (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={vendorDoUrl}
                                                                alt="Foto DO Vendor"
                                                                className="max-h-[320px] rounded-md border object-contain bg-white"
                                                            />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">
                                                        Belum ada file DO vendor yang diunggah.
                                                    </p>
                                                )}
                                            </div>
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
                                Pilih quantity sesuai open qty masing-masing item.
                            </CardDescription>
                        </CardHeader>
                        <Separator />
                        <CardContent className="pt-0 px-0 pb-0">
                            <div className="rounded-b-lg overflow-hidden">
                                 {isMobileLayout && <div className="divide-y">
                                    {fields.map((field, index) => {
                                        const selectedPoItem = form.watch(`items.${index}.poItem`)
                                        const selectedLine = availableLineByItem.get(selectedPoItem)
                                        const selectedProduct = productMap.get(form.watch(`items.${index}.productId`))

                                        return (
                                            <div key={field.id} className="space-y-4 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 space-y-1">
                                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                            Item {index + 1}
                                                        </p>
                                                        <p className="font-mono text-sm font-semibold break-all">
                                                            {selectedLine?.materialNumber ?? "-"}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                                                        PO Item {selectedPoItem || "-"}
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                            Description
                                                        </p>
                                                        <p className="mt-1 text-sm break-words">
                                                            {selectedLine?.materialDescription ?? "-"}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                            Internal Product
                                                        </p>
                                                        <div className="mt-1 text-sm text-muted-foreground break-words">
                                                            {selectedProduct
                                                                ? `${selectedProduct.materialNumber} - ${selectedProduct.materialDescription ?? "-"}`
                                                                : selectedLine
                                                                    ? (
                                                                        <div className="space-y-2">
                                                                            <p>No internal product mapping</p>
                                                                            <Select
                                                                                onValueChange={(value) => {
                                                                                    const productId = Number(value)
                                                                                    const product = productMap.get(productId)
                                                                                    form.setValue(`items.${index}.productId`, productId, { shouldDirty: true, shouldValidate: true })
                                                                                    if (product?.materialNumber) {
                                                                                        form.setValue(`items.${index}.materialNumber`, product.materialNumber, { shouldDirty: true, shouldValidate: true })
                                                                                    }
                                                                                }}
                                                                                value={form.watch(`items.${index}.productId`) > 0 ? String(form.watch(`items.${index}.productId`)) : ""}
                                                                            >
                                                                                <SelectTrigger className="focus:ring-indigo-500">
                                                                                    <SelectValue placeholder="Pilih product internal" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {productOptions.map((product) => (
                                                                                        <SelectItem key={product.id} value={product.id.toString()}>
                                                                                            {product.materialNumber} - {product.materialDescription ?? "-"}
                                                                                        </SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                            <ProductDialog
                                                                                initialValues={{
                                                                                    materialNumber: selectedLine.materialNumber,
                                                                                    materialDescription: selectedLine.materialDescription,
                                                                                    sloc: selectedWarehouse?.sloc ?? "",
                                                                                    slocDescription: selectedWarehouse?.description ?? "",
                                                                                }}
                                                                                onSuccess={() => router.refresh()}
                                                                                trigger={
                                                                                    <Button type="button" variant="outline" size="sm" className="w-full">
                                                                                        Register Product
                                                                                    </Button>
                                                                                }
                                                                            />
                                                                        </div>
                                                                    )
                                                                    : "-"}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3">
                                                        <div>
                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                                PO Qty
                                                            </p>
                                                            <p className="mt-1 text-sm font-medium">
                                                                {selectedLine?.poQty ?? 0}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                                Open Qty
                                                            </p>
                                                            <p className="mt-1 text-sm font-medium">
                                                                {selectedLine?.openQty ?? 0}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <FormField
                                                            control={form.control}
                                                            name={`items.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <FormItem className="space-y-2">
                                                                    <FormLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                                        Quantity
                                                                    </FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            max={selectedLine?.openQty ?? 0}
                                                                            className="focus-visible:ring-indigo-500"
                                                                            {...field}
                                                                            onChange={(e) => {
                                                                                const nextQty = Number(e.target.value)
                                                                                const maxQty = selectedLine?.openQty ?? 0
                                                                                field.onChange(Math.min(Math.max(0, nextQty), maxQty))
                                                                            }}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>

                                                    <FormField
                                                        control={form.control}
                                                        name={`items.${index}.notes`}
                                                        render={({ field }) => (
                                                            <FormItem className="space-y-2">
                                                                <FormLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                                    Notes
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="Optional notes..." className="focus-visible:ring-indigo-500" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>}

                                {!isMobileLayout && <div>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead className="w-[40px] text-xs font-semibold text-muted-foreground pl-4">#</TableHead>
                                            <TableHead className="w-[320px] text-xs font-semibold text-muted-foreground">PO Item</TableHead>
                                            <TableHead className="text-xs font-semibold text-muted-foreground">Internal Product</TableHead>
                                            <TableHead className="w-[100px] text-xs font-semibold text-muted-foreground">PO Qty</TableHead>
                                            <TableHead className="w-[100px] text-xs font-semibold text-muted-foreground">Open Qty</TableHead>
                                            <TableHead className="w-[100px] text-xs font-semibold text-muted-foreground">Quantity</TableHead>
                                            <TableHead className="text-xs font-semibold text-muted-foreground">Notes</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fields.map((field, index) => {
                                            const selectedPoItem = form.watch(`items.${index}.poItem`)
                                            const selectedLine = availableLineByItem.get(selectedPoItem)
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
                                                                        <Select
                                                                            onValueChange={(value) => {
                                                                                const productId = Number(value)
                                                                                const product = productMap.get(productId)
                                                                                form.setValue(`items.${index}.productId`, productId, { shouldDirty: true, shouldValidate: true })
                                                                                if (product?.materialNumber) {
                                                                                    form.setValue(`items.${index}.materialNumber`, product.materialNumber, { shouldDirty: true, shouldValidate: true })
                                                                                }
                                                                            }}
                                                                            value={form.watch(`items.${index}.productId`) > 0 ? String(form.watch(`items.${index}.productId`)) : ""}
                                                                        >
                                                                            <SelectTrigger className="focus:ring-indigo-500">
                                                                                <SelectValue placeholder="Pilih product internal" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {productOptions.map((product) => (
                                                                                    <SelectItem key={product.id} value={product.id.toString()}>
                                                                                        {product.materialNumber} - {product.materialDescription ?? "-"}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
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
                                                        {selectedLine?.poQty ?? 0}
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
                                                                            onChange={(e) => {
                                                                                const nextQty = Number(e.target.value)
                                                                                const maxQty = selectedLine?.openQty ?? 0
                                                                                field.onChange(Math.min(Math.max(0, nextQty), maxQty))
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
                                </div>}
                            </div>
                            {!selectedPoNumber && (
                                <p className="px-4 py-3 text-sm text-muted-foreground">
                                    Select a PO number first to load all PO items automatically.
                                </p>
                            )}
                            {selectedPoNumber && fields.length === 0 && (
                                <p className="px-4 py-3 text-sm text-muted-foreground">
                                    Tidak ada sisa item untuk PO ini.
                                </p>
                            )}
                            {form.formState.errors.items?.root && (
                                <p className="text-sm font-medium text-destructive px-4 pb-4">
                                    {form.formState.errors.items.root.message}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="email-notification" className="border-b-0">
                                <CardHeader className="pb-0">
                                    <AccordionTrigger className="py-0 hover:no-underline">
                                        <div className="text-left">
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-indigo-500" />
                                                <CardTitle className="text-base">Email Notification</CardTitle>
                                            </div>
                                            <CardDescription className="mt-2 text-xs">
                                                Pilih penerima email. Ringkasan hasil GR manual dan file Foto DO Vendor akan ikut dikirim saat submit.
                                            </CardDescription>
                                        </div>
                                    </AccordionTrigger>
                                </CardHeader>
                                <AccordionContent>
                                    <Separator className="mt-4" />
                                    <CardContent className="pt-5 space-y-5">
                                        <div className="grid gap-5 lg:grid-cols-2">
                                            <FormField
                                                control={form.control}
                                                name="emailCc"
                                                render={({ field }) => (
                                                    <FormItem className="lg:col-span-2">
                                                        <FormLabel className="text-sm font-medium">Email CC</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                {...field}
                                                                placeholder="Terisi otomatis dari Email-BC EPR berdasarkan PO Number"
                                                                className="focus-visible:ring-indigo-500"
                                                            />
                                                        </FormControl>
                                                        <p className="text-xs text-muted-foreground">
                                                            Otomatis mengambil `Email-BC` dari EPR Integrasi yang match dengan `PO NO`. Jika perlu, Anda tetap bisa ubah manual dan pisahkan beberapa email dengan koma.
                                                        </p>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-sm font-medium">Notify Roles</p>
                                                    <p className="text-xs text-muted-foreground">Semua user dengan role yang dipilih akan menerima email.</p>
                                                </div>
                                                <div className="rounded-lg border p-3 space-y-3">
                                                    {notificationRoles.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">Tidak ada role yang tersedia.</p>
                                                    ) : (
                                                        notificationRoles.map((role) => (
                                                            <label key={role} className="flex items-start gap-3 text-sm">
                                                                <Checkbox
                                                                    checked={selectedNotifyRoles.includes(role)}
                                                                    onCheckedChange={(checked) => toggleSelection("notifyRoles", role, checked === true)}
                                                                />
                                                                <span>{role}</span>
                                                            </label>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-sm font-medium">Notify Users</p>
                                                    <p className="text-xs text-muted-foreground">Tambahkan penerima spesifik di luar atau di samping role di atas.</p>
                                                </div>
                                                <div className="rounded-lg border p-3 space-y-3 max-h-[240px] overflow-y-auto">
                                                    {notificationUsers.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">Tidak ada user yang tersedia.</p>
                                                    ) : (
                                                        notificationUsers.map((user) => (
                                                            <label key={user.id} className="flex items-start gap-3 text-sm">
                                                                <Checkbox
                                                                    checked={selectedNotifyUserIds.includes(user.id)}
                                                                    onCheckedChange={(checked) => toggleSelection("notifyUserIds", user.id, checked === true)}
                                                                />
                                                                <span className="flex flex-col">
                                                                    <span>{user.name || user.email || user.id}</span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {user.email || "Tanpa email"}{user.role ? ` • ${user.role}` : ""}
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
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
