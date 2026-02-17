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
import { Textarea } from "@/components/ui/textarea"
import { createWarehouse, updateWarehouse, Warehouse } from "@/app/actions/warehouse"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"

const warehouseSchema = z.object({
    sloc: z.string().min(1, "Sloc is required"),
    description: z.string().optional(),
})

type WarehouseFormValues = z.infer<typeof warehouseSchema>

interface WarehouseDialogProps {
    warehouse?: Warehouse
    trigger?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function WarehouseDialog({ warehouse, trigger, open, onOpenChange }: WarehouseDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const isEdit = !!warehouse

    const form = useForm<WarehouseFormValues>({
        resolver: zodResolver(warehouseSchema),
        defaultValues: {
            sloc: warehouse?.sloc || "",
            description: warehouse?.description || "",
        },
    })

    const handleSubmit = async (data: WarehouseFormValues) => {
        setIsLoading(true)
        try {
            const result = isEdit
                ? await updateWarehouse(warehouse!.id, data)
                : await createWarehouse(data)

            if (result.success) {
                toast.success(`Warehouse ${isEdit ? "updated" : "created"}`)
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
                        Add Warehouse
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Warehouse" : "Add Warehouse"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Update warehouse details" : "Register a new warehouse location"}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="sloc"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Sloc (Storage Location)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="WH01" {...field} disabled={isEdit || isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Main Warehouse" {...field} disabled={isLoading} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={isLoading}>
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
