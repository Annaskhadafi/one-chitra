"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger,
    DialogFooter
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
import { Button } from "@/components/ui/button"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
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
import { 
    productBundleSchema, 
    ProductBundleInput 
} from "@/lib/schemas"
import { saveBundle } from "@/app/actions/product-bundle"
import { toast } from "sonner"
import { Plus, Trash2, Search, Check, ChevronsUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface BundleDialogProps {
    bundle?: any
    allProducts: any[]
    onSuccess?: () => void
    trigger?: React.ReactNode
}

export function BundleDialog({ bundle, allProducts, onSuccess, trigger }: BundleDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<ProductBundleInput>({
        resolver: zodResolver(productBundleSchema),
        defaultValues: {
            materialNumber: bundle?.materialNumber || "",
            materialDescription: bundle?.materialDescription || "",
            category: bundle?.category || "TYRE",
            items: bundle?.bundleItems?.map((bi: any) => ({
                childProductId: bi.childProductId,
                quantity: bi.quantity
            })) || [{ childProductId: 0, quantity: 1 }]
        }
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    })

    const uniqueProducts = useMemo(() => {
        const seen = new Set()
        return allProducts
            .filter(p => !p.isBundle)
            .filter(p => {
                if (seen.has(p.materialNumber)) return false
                seen.add(p.materialNumber)
                return true
            })
            .sort((a, b) => (a.materialDescription || "").localeCompare(b.materialDescription || ""))
    }, [allProducts])

    const productMap = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts])


    useEffect(() => {
        if (isOpen && bundle) {
            form.reset({
                materialNumber: bundle.materialNumber,
                materialDescription: bundle.materialDescription,
                category: bundle.category,
                items: bundle.bundleItems.map((bi: any) => ({
                    childProductId: bi.childProductId,
                    quantity: bi.quantity
                }))
            })
        } else if (isOpen && !bundle) {
            form.reset({
                materialNumber: "",
                materialDescription: "",
                category: "TYRE",
                items: [{ childProductId: 0, quantity: 1 }]
            })
        }
    }, [isOpen, bundle, form])

    const onSubmit = async (data: ProductBundleInput) => {
        setIsSubmitting(true)
        try {
            const res = await saveBundle(data, bundle?.id)
            if (res.success) {
                toast.success(bundle ? "Bundle updated" : "Bundle created")
                setIsOpen(false)
                onSuccess?.()
            } else {
                toast.error(res.error || "Failed to save bundle")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setIsSubmitting(false)
        }
    }

    const CATEGORIES = ["ACC", "FLAP", "IMT PART", "Material Consumable", "SPM", "TUBE", "TYRE", "WHEEL & RIM"]

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline">Edit Bundle</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{bundle ? "Edit" : "Create"} Product Bundle</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="materialNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bundle Material Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. BNDL-TYRE-001" {...field} />
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
                                        <FormLabel>Category</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Category" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {CATEGORIES.map(cat => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
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
                                    <FormLabel>Bundle Description</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Starter Pack Tyre A" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <h3 className="text-sm font-semibold">Bundle Components</h3>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => append({ childProductId: 0, quantity: 1 })}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Item
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {fields.map((itemField, index) => (
                                    <div key={itemField.id} className="flex gap-4 items-end bg-muted/30 p-3 rounded-lg border border-dashed">
                                        <div className="flex-1 space-y-1">
                                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Product</FormLabel>
                                            <ProductSelectRow 
                                                form={form} 
                                                index={index} 
                                                uniqueProducts={uniqueProducts} 
                                                productMap={productMap} 
                                            />
                                        </div>
                                        <div className="w-24 space-y-1">
                                            <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">QTY</FormLabel>
                                            <FormField
                                                control={form.control}
                                                name={`items.${index}.quantity`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Input 
                                                                type="number" 
                                                                min="1"
                                                                {...field} 
                                                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => remove(index)}
                                            disabled={fields.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : (bundle ? "Update Bundle" : "Create Bundle")}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

function ProductSelectRow({ form, index, uniqueProducts, productMap }: { 
    form: any, 
    index: number, 
    uniqueProducts: any[], 
    productMap: Map<number, any> 
}) {
    const [open, setOpen] = useState(false)

    return (
        <FormField
            control={form.control}
            name={`items.${index}.childProductId`}
            render={({ field }) => (
                <FormItem className="flex flex-col">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "w-full justify-between font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value && field.value !== 0
                                        ? `${productMap.get(field.value)?.materialNumber || ""} - ${productMap.get(field.value)?.materialDescription || ""}`
                                        : "Select Product..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search product..." />
                                <CommandList>
                                    <CommandEmpty>No product found.</CommandEmpty>
                                    <CommandGroup>
                                        {uniqueProducts.map((p) => (
                                            <CommandItem
                                                value={`${p.materialNumber} ${p.materialDescription}`}
                                                key={p.id}
                                                onSelect={() => {
                                                    form.setValue(`items.${index}.childProductId`, p.id)
                                                    setOpen(false)
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        p.id === field.value ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-blue-700">{p.materialNumber}</span>
                                                    <span className="text-xs text-muted-foreground line-clamp-1">{p.materialDescription}</span>
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
    )
}
