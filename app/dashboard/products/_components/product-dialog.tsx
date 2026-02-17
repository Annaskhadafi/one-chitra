"use client"

import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { createProduct, updateProduct, Product } from "@/app/actions/product"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"

const categories = ["ACC", "FLAP", "IMT PART", "TUBE", "TYRE", "WHEEL & RIM"] as const

const productSchema = z.object({
    category: z.enum(categories),
    materialNumber: z.string().min(1, "Material Number is required"),
    oldMaterialNo: z.string().optional(),
    materialDescription: z.string().optional(),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductDialogProps {
    product?: Product
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function ProductDialog({ product, trigger, open, onOpenChange }: ProductDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const isEdit = !!product

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            category: (product?.category as any) || "TYRE",
            materialNumber: product?.materialNumber || "",
            oldMaterialNo: product?.oldMaterialNo || "",
            materialDescription: product?.materialDescription || "",
        },
    })

    const handleSubmit = async (data: ProductFormValues) => {
        setIsLoading(true)
        try {
            const result = isEdit
                ? await updateProduct(product!.id, data)
                : await createProduct(data)

            if (result.success) {
                toast.success(`Product ${isEdit ? "updated" : "created"}`)
                setIsOpen(false)
                onOpenChange?.(false)
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
        <Dialog open={open ?? isOpen} onOpenChange={onOpenChange ?? setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Product
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Update product details" : "Register a new product to the system"}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        disabled={isLoading}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Category" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {categories.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                        <Input placeholder="e.g. 116120F202" {...field} disabled={isLoading} />
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
                                    <FormLabel>Old Material No.</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. 226-10.00-20 GT" {...field} disabled={isLoading} />
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
                                    <FormLabel>Material Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="10.00 - 20 GT MILLER" {...field} disabled={isLoading} />
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
