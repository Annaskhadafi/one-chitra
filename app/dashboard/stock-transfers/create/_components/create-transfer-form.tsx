"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2, Plus, Trash, Check, ChevronsUpDown } from "lucide-react"

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
import { createStockTransfer } from "@/app/actions/stock-transfer"
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

    const isSubmitting = form.formState.isSubmitting

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
                toast.error(result.error)
            }
        } catch (error) {
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
                        <h3 className="text-lg font-medium">Products</h3>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="w-[150px]">Quantity</TableHead>
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
