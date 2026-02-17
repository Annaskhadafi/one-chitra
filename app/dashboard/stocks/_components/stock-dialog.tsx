"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { upsertStock } from "@/app/actions/stock"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"

const stockSchema = z.object({
    productId: z.string().min(1, "Product is required"),
    warehouseId: z.string().min(1, "Warehouse is required"),
    valuationValue: z.string().min(1, "Valuation value is required"),
    totalStock: z.number().min(0, "Total stock cannot be negative"),
    minStock: z.number().min(0, "Min stock cannot be negative"),
})

type StockFormValues = z.infer<typeof stockSchema>

interface StockDialogProps {
    stock?: any
    trigger?: React.ReactNode
}

export function StockDialog({ stock, trigger }: StockDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<any[]>([])
    const isEdit = !!stock

    useEffect(() => {
        if (isOpen) {
            loadData()
        }
    }, [isOpen])

    async function loadData() {
        const [p, w] = await Promise.all([getProducts(), getWarehouses()])
        setProducts(p)
        setWarehouses(w)
    }

    const form = useForm<StockFormValues>({
        resolver: zodResolver(stockSchema),
        defaultValues: {
            productId: stock?.productId?.toString() || "",
            warehouseId: stock?.warehouseId?.toString() || "",
            valuationValue: stock?.valuationValue?.toString() || "0",
            totalStock: stock?.totalStock || 0,
            minStock: stock?.minStock || 0,
        },
    })

    const handleSubmit = async (data: StockFormValues) => {
        setIsLoading(true)
        try {
            const result = await upsertStock({
                productId: parseInt(data.productId),
                warehouseId: parseInt(data.warehouseId),
                valuationValue: data.valuationValue,
                totalStock: data.totalStock,
                minStock: data.minStock,
            })

            if (result.success) {
                toast.success(`Stock level ${isEdit ? "updated" : "saved"}`)
                setIsOpen(false)
                if (!isEdit) form.reset()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("Something went wrong")
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
                        Add Stock
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Stock Level" : "Add Stock Level"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Update valuation and stock counts" : "Register stock levels for a product in a warehouse"}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="productId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Product (Item)</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        disabled={isLoading || isEdit}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Product" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {products.map(p => (
                                                <SelectItem key={p.id} value={p.id.toString()}>
                                                    [{p.materialNumber}] {p.materialDescription}
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
                            name="warehouseId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Warehouse (Store Loc)</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        disabled={isLoading || isEdit}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Warehouse" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {warehouses.map(w => (
                                                <SelectItem key={w.id} value={w.id.toString()}>
                                                    [{w.sloc}] {w.description}
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
                            name="valuationValue"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valuation Value</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.value)}
                                            disabled={isLoading}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="totalStock"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Total Stock</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                            disabled={isLoading}
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
                                    <FormLabel>Min Stock</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            {...field}
                                            onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                            disabled={isLoading}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                                {isLoading ? (
                                    <>
                                        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
