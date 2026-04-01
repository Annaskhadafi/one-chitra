"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { getProductCategories, upsertProduct } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { Plus, X } from "lucide-react"
import { productSchema } from "@/lib/schemas"
import { Product } from "@/lib/types"

type ProductFormValues = z.infer<typeof productSchema>

interface ProductDialogProps {
    product?: Product
    initialValues?: Partial<ProductFormValues>
    trigger?: React.ReactNode
    onSuccess?: () => void
}

const CATEGORIES = ["ACC", "FLAP", "IMT PART", "Material Consumable", "SPM", "TUBE", "TYRE", "WHEEL & RIM"]
const CUSTOM_CATEGORY_VALUE = "__custom_category__"
const DEFAULT_PLANT_CODE = "2001"
const DEFAULT_SLOC = "TRD BPN"

export function ProductDialog({ product, initialValues, trigger, onSuccess }: ProductDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [warehouses, setWarehouses] = useState<{ sloc: string, description: string | null }[]>([])
    const [categories, setCategories] = useState<string[]>(CATEGORIES)
    const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false)
    const isEdit = !!product

    useEffect(() => {
        if (isOpen) {
            const fetchDialogOptions = async () => {
                const [warehouseData, categoryData] = await Promise.all([
                    getWarehouses(),
                    getProductCategories(),
                ])
                setWarehouses(warehouseData)
                setCategories(categoryData.length > 0 ? categoryData : CATEGORIES)
            }
            fetchDialogOptions()
        }
    }, [isOpen])

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            category: product?.category ?? initialValues?.category ?? "TYRE",
            materialNumber: product?.materialNumber ?? initialValues?.materialNumber ?? "",
            oldMaterialNo: product?.oldMaterialNo ?? initialValues?.oldMaterialNo ?? "",
            materialDescription: product?.materialDescription ?? initialValues?.materialDescription ?? "",
            brand: product?.brand ?? initialValues?.brand ?? "",
            costSap: product?.costSap ?? initialValues?.costSap ?? "",
            plant: product?.plant ?? initialValues?.plant ?? DEFAULT_PLANT_CODE,
            sloc: product?.sloc ?? initialValues?.sloc ?? DEFAULT_SLOC,
            slocDescription: product?.slocDescription ?? initialValues?.slocDescription ?? "",
            typeWarehouse: product?.typeWarehouse ?? initialValues?.typeWarehouse ?? "",
            imageUrl: product?.imageUrl ?? initialValues?.imageUrl ?? "",
        },
    })

    useEffect(() => {
        if (!isOpen) return

        const nextCategory = product?.category ?? initialValues?.category ?? "TYRE"
        const normalizedCategory = nextCategory.trim()

        form.reset({
            category: nextCategory,
            materialNumber: product?.materialNumber ?? initialValues?.materialNumber ?? "",
            oldMaterialNo: product?.oldMaterialNo ?? initialValues?.oldMaterialNo ?? "",
            materialDescription: product?.materialDescription ?? initialValues?.materialDescription ?? "",
            brand: product?.brand ?? initialValues?.brand ?? "",
            costSap: product?.costSap ?? initialValues?.costSap ?? "",
            plant: product?.plant ?? initialValues?.plant ?? DEFAULT_PLANT_CODE,
            sloc: product?.sloc ?? initialValues?.sloc ?? DEFAULT_SLOC,
            slocDescription: product?.slocDescription ?? initialValues?.slocDescription ?? "",
            typeWarehouse: product?.typeWarehouse ?? initialValues?.typeWarehouse ?? "",
            imageUrl: product?.imageUrl ?? initialValues?.imageUrl ?? "",
        })
        setShowCustomCategoryInput(Boolean(normalizedCategory) && !categories.includes(normalizedCategory))
    }, [categories, form, initialValues, isOpen, product])

    const handleSubmit = async (data: ProductFormValues) => {
        setIsLoading(true)
        try {
            const result = await upsertProduct({
                ...data,
                category: data.category.trim(),
            }, product?.id)

            if (result.success) {
                toast.success(`Product ${isEdit ? "updated" : "created"} successfully`)
                setIsOpen(false)
                if (!isEdit) {
                    form.reset()
                    setShowCustomCategoryInput(false)
                }
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
                        Add Product
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[500px]">
                <DialogHeader className="shrink-0">
                    <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Update product details below." : "Enter product details to add to the system."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select
                                        value={showCustomCategoryInput ? CUSTOM_CATEGORY_VALUE : field.value}
                                        onValueChange={(value) => {
                                            if (value === CUSTOM_CATEGORY_VALUE) {
                                                setShowCustomCategoryInput(true)
                                                if (!field.value.trim()) {
                                                    field.onChange("")
                                                }
                                                return
                                            }

                                            setShowCustomCategoryInput(false)
                                            field.onChange(value)
                                        }}
                                        disabled={isLoading}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {categories.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                            <SelectItem value={CUSTOM_CATEGORY_VALUE}>Custom category...</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {showCustomCategoryInput ? (
                                        <Input
                                            value={field.value}
                                            onChange={(e) => field.onChange(e.target.value)}
                                            placeholder="Enter custom category"
                                            disabled={isLoading}
                                        />
                                    ) : null}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="brand"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Brand</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Brand Name" disabled={isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="materialNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Material Number</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="P001" disabled={isEdit || isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="oldMaterialNo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Old Material No (Optional)</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="OLD-P001" disabled={isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="materialDescription"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Material Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Type or size details" disabled={isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="plant"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Plant</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Plant code" disabled={isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sloc"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sloc</FormLabel>
                                    <Select
                                        onValueChange={(val) => {
                                            field.onChange(val)
                                            const warehouse = warehouses.find(w => w.sloc === val)
                                            if (warehouse) {
                                                form.setValue("slocDescription", warehouse.description || "")
                                            }
                                        }}
                                        defaultValue={field.value}
                                        disabled={isLoading}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Sloc" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {warehouses.map(w => (
                                                <SelectItem key={w.sloc} value={w.sloc}>
                                                    {w.sloc} {w.description ? `- ${w.description}` : ""}
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
                            name="slocDescription"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sloc Description</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Auto-filled from warehouse" disabled={true} />
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
                                    <FormLabel>Cost SAP (USD)</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="0.00" disabled={isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="space-y-2">
                            <FormLabel>Product Image</FormLabel>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                        const formData = new FormData()
                                        formData.append("file", file)
                                        setIsLoading(true)
                                        try {
                                            const { uploadFile } = await import("@/app/actions/upload")
                                            const res = await uploadFile(formData)
                                            if (res.success && res.url) {
                                                form.setValue("imageUrl", res.url)
                                                toast.success("Image uploaded")
                                            } else {
                                                toast.error(res.error || "Upload failed")
                                            }
                                        } catch (err) {
                                            toast.error("Upload error")
                                        } finally {
                                            setIsLoading(false)
                                        }
                                    }
                                }}
                                disabled={isLoading}
                            />
                            {form.watch("imageUrl") && (
                                <div className="relative w-24 h-24 border rounded overflow-hidden group">
                                    <img src={form.watch("imageUrl")} alt="Preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => form.setValue("imageUrl", "")}
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="h-6 w-6 text-white" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? "Saving..." : isEdit ? "Update Product" : "Add Product"}
                            </Button>
                        </DialogFooter>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
