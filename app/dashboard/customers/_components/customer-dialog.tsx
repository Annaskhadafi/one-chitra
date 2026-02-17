"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { upsertCustomer } from "@/app/actions/customer"
import { Plus } from "lucide-react"
import { customerSchema } from "@/lib/schemas"
import { Customer } from "@/lib/types"

type CustomerFormValues = z.infer<typeof customerSchema>

interface CustomerDialogProps {
    customer?: Customer
    trigger?: React.ReactNode
    onSuccess?: () => void
}

export function CustomerDialog({ customer, trigger, onSuccess }: CustomerDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const isEdit = !!customer

    const form = useForm<CustomerFormValues>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            customerCode: customer?.customerCode || "",
            name: customer?.name || "",
            contactName: customer?.contactName || "",
            email: customer?.email || "",
            address1: customer?.address1 || "",
            address2: customer?.address2 || "",
            address3: customer?.address3 || "",
            address4: customer?.address4 || "",
            address5: customer?.address5 || "",
        },
    })

    const handleSubmit = async (data: CustomerFormValues) => {
        setIsLoading(true)
        try {
            const result = await upsertCustomer(customer?.id, data)

            if (result.success) {
                toast.success(`Customer ${isEdit ? "updated" : "created"} successfully`)
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
                        Add Customer
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Customer" : "Add Customer"}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? "Update customer details below." : "Enter customer details to add to the system."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="customerCode"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer Code</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="C001" disabled={isEdit} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Acme Corp" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="contactName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contact Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="John Doe" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="john@example.com" type="email" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-medium">Address Information</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <FormField
                                    control={form.control}
                                    name="address1"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Address Line 1</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Street address" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="address2"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Address Line 2 (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="address3"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>City (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? "Saving..." : isEdit ? "Update Customer" : "Add Customer"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
