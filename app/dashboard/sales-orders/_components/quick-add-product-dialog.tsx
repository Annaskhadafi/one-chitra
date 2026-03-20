"use client"

import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

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
import { Checkbox } from "@/components/ui/checkbox"

import { Product, Warehouse } from "@/lib/types"
import { createProduct } from "@/app/actions/product"
import { upsertStock } from "@/app/actions/stock"
import { productSchema } from "@/lib/schemas"

const quickAddSchema = productSchema.extend({
    // Additional fields for stock
    addStock: z.boolean().default(false),
    warehouseId: z.number().optional(), // Used if addStock is true
    initialStock: z.number().min(0).optional(),
})

type QuickAddFormValues = z.infer<typeof quickAddSchema>

interface QuickAddProductDialogProps {
    warehouses: Warehouse[]
    onProductCreated: (product: Product) => void
}

export function QuickAddProductDialog({ warehouses, onProductCreated }: QuickAddProductDialogProps) {
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<QuickAddFormValues>({
        resolver: zodResolver(quickAddSchema) as Resolver<QuickAddFormValues>,
        defaultValues: {
            category: "",
            materialNumber: "",
            materialDescription: "",
            addStock: false,
            initialStock: 0,
        },
    })

    const watchAddStock = form.watch("addStock")

    async function onSubmit(data: QuickAddFormValues) {
        setIsSubmitting(true)
        try {
            // 1. Create Product
            const productResult = await createProduct({
                category: data.category,
                materialNumber: data.materialNumber,
                materialDescription: data.materialDescription,
                oldMaterialNo: data.oldMaterialNo,
                brand: data.brand,
                costSap: data.costSap,
                plant: data.plant,
                sloc: data.sloc,
                slocDescription: data.slocDescription,
                typeWarehouse: data.typeWarehouse,
                imageUrl: data.imageUrl,
            })

            if (!productResult.success || !("id" in productResult)) {
                toast.error(productResult.error || "Failed to create product")
                return
            }

            const createdProductId = Number(productResult.id)

            // 2. Add Stock if requested
            if (data.addStock && data.warehouseId && data.initialStock !== undefined) {
                const stockResult = await upsertStock({
                    productId: createdProductId,
                    warehouseId: data.warehouseId,
                    totalStock: data.initialStock,
                    minStock: 0,
                    valuationValue: 0,
                })

                if (!stockResult.success) {
                    toast.warning("Product created, but failed to add initial stock")
                }
            }

            // 3. Construct the product object to return
            // We need to fetch it or construct it. For now, construct a basic one.
            // Ideally we should fetch the full product, but we have enough info.
            const newProduct: Product = {
                id: createdProductId,
                category: data.category,
                materialNumber: data.materialNumber,
                materialNumberCk: null,
                materialDescription: data.materialDescription ?? null,
                oldMaterialNo: data.oldMaterialNo ?? null,
                brand: data.brand ?? null,
                costSap: data.costSap ?? null,
                plant: data.plant ?? null,
                sloc: data.sloc ?? null,
                slocDescription: data.slocDescription ?? null,
                typeWarehouse: data.typeWarehouse ?? null,
                imageUrl: data.imageUrl ?? null,
                isConsignment: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            }

            onProductCreated(newProduct)
            toast.success("Product added successfully")
            setOpen(false)
            form.reset()
        } catch (error) {
            console.error(error)
            toast.error("An error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Quick Add Product</DialogTitle>
                    <DialogDescription>
                        Add a new product to the system immediately.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="materialNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Material Number *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Material Number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Category" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="materialDescription"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Product Description" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="brand"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Brand</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Brand" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="costSap"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cost SAP</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Cost SAP" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Stock Section */}
                        <div className="space-y-4 pt-4 border-t">
                            <FormField
                                control={form.control}
                                name="addStock"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>
                                                Add Initial Stock
                                            </FormLabel>
                                            <DialogDescription>
                                                Add this product to a warehouse immediately.
                                            </DialogDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            {watchAddStock && (
                                <div className="grid grid-cols-2 gap-4 pl-6">
                                    <FormField
                                        control={form.control}
                                        name="warehouseId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Warehouse *</FormLabel>
                                                <Select
                                                    onValueChange={(val) => field.onChange(Number(val))}
                                                    defaultValue={field.value?.toString()}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Warehouse" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {warehouses.map((wh) => (
                                                            <SelectItem key={wh.id} value={wh.id.toString()}>
                                                                {wh.sloc} - {wh.description}
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
                                        name="initialStock"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Initial Stock *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Product
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
