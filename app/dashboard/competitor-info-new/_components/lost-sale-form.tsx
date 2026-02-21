"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CalendarIcon, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getUsers } from "@/app/actions/users"
import { createLostSale } from "@/app/actions/competitor-new"
import { toast } from "sonner"

const formSchema = z.object({
    businessConsultantId: z.string().min(1, "Consultant is required"),
    productType: z.string().min(1, "Product type is required"),
    offeringDate: z.date({ required_error: "Offering date is required" }),
    customerName: z.string().min(1, "Customer name is required"),
    productDetail: z.string().min(1, "Product detail is required"),
    totalOffering: z.string().min(1, "Total offering is required"),
    reason: z.string().min(1, "Reason is required"),
    remark: z.string().optional(),
})

interface LostSaleFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function LostSaleForm({ open, onOpenChange, onSuccess }: LostSaleFormProps) {
    const [users, setUsers] = useState<any[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            productType: "Tire",
            customerName: "",
            productDetail: "",
            totalOffering: "",
            reason: "Price",
            remark: "",
        },
    })

    useEffect(() => {
        getUsers().then(setUsers)
    }, [])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true)
        try {
            const result = await createLostSale(values)
            if (result.success) {
                toast.success("Record created successfully")
                form.reset()
                onSuccess()
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Lost Sale Record</DialogTitle>
                    <DialogDescription>
                        Record details about sales opportunities that were not closed.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="businessConsultantId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Business Consultant *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih Consultant" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {users.map((u) => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        {u.name}
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
                                name="offeringDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Tanggal Penawaran *</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>Pick a date</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="productType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipe Produk *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih Tipe" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {["Tire", "Repair/Retread", "Service", "Accessories", "Tire Handler", "Tools", "Digital Product", "Yang lain"].map((type) => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="customerName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Customer *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Jawaban Anda" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="productDetail"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Detail Produk *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Jawaban Anda" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="totalOffering"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Total Penawaran *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Jawaban Anda" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Penyebab Lost Sale *</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex flex-col space-y-1"
                                        >
                                            {["Price", "Stock Availability", "Quality", "TOP Payment", "OTHER"].map((reason) => (
                                                <FormItem key={reason} className="flex items-center space-x-3 space-y-0">
                                                    <FormControl><RadioGroupItem value={reason} /></FormControl>
                                                    <FormLabel className="font-normal">{reason}</FormLabel>
                                                </FormItem>
                                            ))}
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="remark"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Remark *</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Jawaban Anda" className="resize-none" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto">
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Submit Record"
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
