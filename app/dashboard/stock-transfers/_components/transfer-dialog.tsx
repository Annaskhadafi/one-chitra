"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createStockTransfer } from "@/app/actions/stock-transfer"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"

const formSchema = z.object({
    sourceWarehouseId: z.string().min(1, "Source warehouse is required"),
    destinationWarehouseId: z.string().min(1, "Destination warehouse is required"),
    productId: z.string().min(1, "Product is required"),
    quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Quantity must be a positive number",
    }),
    notes: z.string().optional(),
}).refine(data => data.sourceWarehouseId !== data.destinationWarehouseId, {
    message: "Source and destination must be different",
    path: ["destinationWarehouseId"],
})

interface TransferDialogProps {
    warehouses: { id: number; sloc: string; description: string | null }[]
    products: { id: number; materialNumber: string; materialDescription: string | null }[]
}

export function TransferDialog({ warehouses, products }: TransferDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            sourceWarehouseId: "",
            destinationWarehouseId: "",
            productId: "",
            quantity: "1",
            notes: "",
        },
    })

    const isSubmitting = form.formState.isSubmitting

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const result = await createStockTransfer({
                sourceWarehouseId: parseInt(values.sourceWarehouseId),
                destinationWarehouseId: parseInt(values.destinationWarehouseId),
                items: [
                    {
                        productId: parseInt(values.productId),
                        quantity: parseInt(values.quantity),
                    }
                ],
                transferDate: new Date(),
                notes: values.notes,
            })

            if (result.success) {
                toast.success("Stock transferred successfully")
                router.refresh()
                setOpen(false)
                form.reset()
            } else if (!result.success && 'error' in result) {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("Failed to transfer stock")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Transfer
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>New Stock Transfer</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="sourceWarehouseId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>From Warehouse</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select source" />
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
                                    <FormLabel>To Warehouse</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select destination" />
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
                            name="productId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Product</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select product" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {products.map((p) => (
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
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Quantity</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Transfer Stock
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
