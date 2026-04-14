"use client"

import { useState } from "react"
import { useFieldArray, useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { toast } from "sonner"
import { upsertStock } from "@/app/actions/stock"
import { Plus, Trash2 } from "lucide-react"
import { z } from "zod"

import { stockSchema } from "@/lib/schemas"

type StockFormValues = z.infer<typeof stockSchema>

interface StockDialogProps {
    stock?: {
        id: number
        productId: number
        warehouseId: number
        totalStock: number
        minStock: number
        valuationValue: string
        stockBookings?: {
            id: number
            customerId: number
            quantity: number
            remark: string | null
            customer?: {
                id: number
                customerCode: string
                name: string
            } | null
        }[]
    }
    products: {
        id: number;
        materialNumber: string;
        materialDescription: string | null;
        plant: string | null;
        category: string;
        oldMaterialNo: string | null;
    }[]
    customers: {
        id: number
        customerCode: string
        name: string
    }[]
    warehouses: { id: number; sloc: string; description: string | null; type: string | null }[]
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function StockDialog({ stock, products, customers, warehouses, trigger, onSuccess }: StockDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const isEdit = !!stock

    const form = useForm<StockFormValues>({
        resolver: zodResolver(stockSchema) as Resolver<StockFormValues>,
        defaultValues: {
            productId: stock?.productId || 0,
            warehouseId: stock?.warehouseId || 0,
            totalStock: stock?.totalStock || 0,
            minStock: stock?.minStock || 0,
            valuationValue: stock?.valuationValue ? Number(stock.valuationValue) : 0,
            stockBookings: stock?.stockBookings?.map((booking) => ({
                id: booking.id,
                customerId: booking.customerId,
                quantity: booking.quantity,
                remark: booking.remark || "",
            })) || [],
        },
    })
    const { fields: bookingFields, append: appendBooking, remove: removeBooking } = useFieldArray({
        control: form.control,
        name: "stockBookings",
    })

    const handleSubmit = async (data: StockFormValues) => {
        setIsLoading(true)
        try {
            const result = await upsertStock(data, stock?.id)

            if (result.success) {
                toast.success(`Stock level ${isEdit ? "updated" : "saved"} successfully`)
                setIsOpen(false)
                if (!isEdit) form.reset()
                onSuccess?.()
            } else {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Adjust Stock
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[780px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Stock Level" : "Add Stock Level"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Update stock quantity and valuation below." : "Manually set stock level for a product/warehouse."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="productId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Product</FormLabel>
                                    <Select
                                        onValueChange={(v) => field.onChange(Number(v))}
                                        defaultValue={field.value !== 0 ? field.value.toString() : undefined}
                                        disabled={isEdit || isLoading}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Product" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {products.map(p => (
                                                <SelectItem key={p.id} value={p.id.toString()}>
                                                    {p.materialNumber} - {p.materialDescription}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {form.watch("productId") ? (
                            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="font-semibold">Plant:</span>{" "}
                                        {products.find(p => p.id === form.watch("productId"))?.plant || "-"}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Category:</span>{" "}
                                        {products.find(p => p.id === form.watch("productId"))?.category || "-"}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Old Mat No:</span>{" "}
                                        {products.find(p => p.id === form.watch("productId"))?.oldMaterialNo || "-"}
                                    </div>
                                    <div className="col-span-2">
                                        <span className="font-semibold">Desc:</span>{" "}
                                        {products.find(p => p.id === form.watch("productId"))?.materialDescription || "-"}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <FormField
                            control={form.control}
                            name="warehouseId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Warehouse (Sloc)</FormLabel>
                                    <Select
                                        onValueChange={(v) => field.onChange(Number(v))}
                                        defaultValue={field.value !== 0 ? field.value.toString() : undefined}
                                        disabled={isEdit || isLoading}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Warehouse" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {warehouses.map(w => (
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

                        {form.watch("warehouseId") ? (
                            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="col-span-2">
                                        <span className="font-semibold">Description:</span>{" "}
                                        {warehouses.find(w => w.id === form.watch("warehouseId"))?.description || "-"}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Type:</span>{" "}
                                        {warehouses.find(w => w.id === form.watch("warehouseId"))?.type || "-"}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="totalStock"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Total Stock</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="number"
                                                step="0.01"
                                                disabled={isLoading}
                                                onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="minStock"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Min Stock Level</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="number"
                                                step="0.01"
                                                disabled={isLoading}
                                                onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-3 rounded-lg border p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-sm font-semibold">Stock Booking</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Tambahkan booking stok per customer beserta remark-nya.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isLoading}
                                    onClick={() => appendBooking({
                                        customerId: 0,
                                        quantity: 0,
                                        remark: "",
                                    })}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Tambah Booking
                                </Button>
                            </div>

                            {bookingFields.length === 0 ? (
                                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                    Belum ada booking customer untuk stock ini.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {bookingFields.map((field, index) => (
                                        <div key={field.id} className="grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-[1.3fr_0.7fr_1.4fr_auto]">
                                            <FormField
                                                control={form.control}
                                                name={`stockBookings.${index}.customerId`}
                                                render={({ field: customerField }) => (
                                                    <FormItem>
                                                        <FormLabel>Customer</FormLabel>
                                                        <Select
                                                            onValueChange={(value) => customerField.onChange(Number(value))}
                                                            value={customerField.value ? customerField.value.toString() : undefined}
                                                            disabled={isLoading}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Pilih customer" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {customers.map((customer) => (
                                                                    <SelectItem key={customer.id} value={customer.id.toString()}>
                                                                        {customer.customerCode} - {customer.name}
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
                                                name={`stockBookings.${index}.quantity`}
                                                render={({ field: quantityField }) => (
                                                    <FormItem>
                                                        <FormLabel>Qty Booking</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                {...quantityField}
                                                                type="number"
                                                                min={0}
                                                                disabled={isLoading}
                                                                onChange={(event) => quantityField.onChange(event.target.value === "" ? 0 : Number(event.target.value))}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name={`stockBookings.${index}.remark`}
                                                render={({ field: remarkField }) => (
                                                    <FormItem>
                                                        <FormLabel>Remark (Customer)</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                {...remarkField}
                                                                value={remarkField.value ?? ""}
                                                                disabled={isLoading}
                                                                placeholder="Contoh: booking urgent / ambil minggu ini"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="flex items-end">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={isLoading}
                                                    onClick={() => removeBooking(index)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <FormField
                            control={form.control}
                            name="valuationValue"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valuation Value (Total)</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="number"
                                            step="0.01"
                                            disabled={isLoading}
                                            onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? "Saving..." : isEdit ? "Update Stock" : "Create Entry"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
