"use client"

import { useEffect, useMemo } from "react"
import { useForm, useFieldArray, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2, PackagePlus, FileText } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createGoodReceiveManual, type ManualGoodReceivePoLineOption, type ManualGoodReceivePoOption } from "@/app/actions/good-receive-manual"

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
    poNumber: z.string().min(1, "PO Number is required"),
    warehouseId: z.coerce.number().min(1, "Warehouse is required"),
    receiveDate: z.date(),
    deliveryType: z.enum(["Partial", "Complete"]),
    referenceDocument: z.string().optional(),
    items: z.array(z.object({
        poItem: z.coerce.number().min(1),
        materialNumber: z.string().min(1),
        productId: z.coerce.number().min(1, "Internal product mapping is required"),
        openQty: z.coerce.number().min(0),
        quantity: z.coerce.number().min(0, "Quantity cannot be negative"),
        notes: z.string().optional(),
    })).min(1, "No open PO items available"),
})

type GoodReceiveFormProps = {
    warehouses: {
        id: number
        sloc: string
        description: string | null
    }[]
    poOptions: ManualGoodReceivePoOption[]
    poLineOptions: ManualGoodReceivePoLineOption[]
}

export function GoodReceiveForm({ warehouses, poOptions, poLineOptions }: GoodReceiveFormProps) {
    const router = useRouter()
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as Resolver<z.infer<typeof formSchema>>,
        defaultValues: {
            poNumber: "",
            warehouseId: 0,
            receiveDate: new Date(),
            deliveryType: "Complete",
            referenceDocument: "",
            items: [],
        },
    })

    const { fields, replace } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const selectedPoNumber = form.watch("poNumber")

    const selectedPo = useMemo(() => {
        return poOptions.find((po) => po.poNumber === selectedPoNumber) ?? null
    }, [poOptions, selectedPoNumber])

    useEffect(() => {
        if (!selectedPoNumber) {
            replace([])
            return
        }

        const items = poLineOptions
            .filter((line) => line.poNumber === selectedPoNumber)
            .map((line) => ({
                poItem: line.poItem,
                materialNumber: line.materialNumber,
                productId: line.productId ?? 0,
                openQty: line.openQty,
                quantity: line.openQty,
                notes: "",
            }))

        replace(items)
    }, [selectedPoNumber, poLineOptions, replace])

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
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select PO" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {poOptions.map((po) => (
                                                    <SelectItem key={po.poNumber} value={po.poNumber}>
                                                        {po.poNumber} - {po.vendorName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
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

                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base">PO Items</CardTitle>
                        <CardDescription className="text-xs">Adjust received quantity per PO item (0 allowed to skip item).</CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PO Item</TableHead>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Open Qty</TableHead>
                                    <TableHead>Receive Qty</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((item, index) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.poItem}</TableCell>
                                        <TableCell className="font-mono text-xs">{item.materialNumber}</TableCell>
                                        <TableCell>{item.openQty}</TableCell>
                                        <TableCell>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.quantity`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={item.openQty}
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
                                                    <FormItem>
                                                        <FormControl>
                                                            <Input placeholder="Optional notes" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px]">
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
