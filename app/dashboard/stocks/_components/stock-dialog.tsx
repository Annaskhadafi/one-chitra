"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
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
import { Plus } from "lucide-react"

import { stockSchema } from "@/lib/schemas"

type StockFormValues = {
    productId: number
    warehouseId: number
    totalStock: number
    minStock?: number
    valuationValue?: number
}

interface StockDialogProps {
    stock?: {
        id: number
        productId: number
        warehouseId: number
        totalStock: number
        minStock: number
        valuationValue: string
    }
    products: { id: number; materialNumber: string; materialDescription: string | null }[]
    warehouses: { id: number; sloc: string; description: string | null }[]
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function StockDialog({ stock, products, warehouses, trigger, onSuccess }: StockDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const isEdit = !!stock

    const form = useForm<StockFormValues>({
        resolver: zodResolver(stockSchema),
        defaultValues: {
            productId: stock?.productId || 0,
            warehouseId: stock?.warehouseId || 0,
            totalStock: stock?.totalStock || 0,
            minStock: stock?.minStock || 0,
            valuationValue: stock?.valuationValue ? Number(stock.valuationValue) : 0,
        },
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
            <DialogContent className="sm:max-w-[500px]">
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
