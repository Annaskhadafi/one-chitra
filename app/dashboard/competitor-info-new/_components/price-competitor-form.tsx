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
import { createCompetitorPrice } from "@/app/actions/competitor-new"
import { useSession } from "@/lib/auth-client"
import { toast } from "sonner"

const formSchema = z.object({
    infoDate: z.date({ error: "Information date is required" }),
    businessConsultantId: z.string().optional().nullable(),
    customerName: z.string().min(1, "Customer name is required"),
    productSize: z.string().min(1, "Product size is required"),
    category: z.string().min(1, "Category is required"),
    brand: z.string().min(1, "Brand is required"),
    supplier: z.string().min(1, "Supplier is required"),
    currency: z.string().min(1, "Currency is required"),
    price: z.string().min(1, "Price is required"),
    consultantName: z.string().optional().nullable(),
    remark: z.string().optional(),
})

interface PriceCompetitorFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function PriceCompetitorForm({ open, onOpenChange, onSuccess }: PriceCompetitorFormProps) {
    const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { data: session } = useSession()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            businessConsultantId: undefined,
            customerName: "",
            productSize: "",
            category: "Earthmover",
            brand: "",
            supplier: "",
            currency: "IDR",
            price: "",
            consultantName: "",
            remark: "",
        },
    })

    useEffect(() => {
        getUsers().then(setUsers)
    }, [])

    useEffect(() => {
        const currentUserId = session?.user?.id
        const currentUserName = session?.user?.name
        if (!currentUserId) return
        if (form.getValues("businessConsultantId")) return

        form.setValue("businessConsultantId", currentUserId)
        if (currentUserName) {
            form.setValue("consultantName", currentUserName)
        }
    }, [form, session?.user?.id, session?.user?.name, users])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true)
        try {
            const submissionData = {
                ...values,
                businessConsultantId: values.businessConsultantId === "none" ? null : values.businessConsultantId
            }
            const result = await createCompetitorPrice(submissionData as Parameters<typeof createCompetitorPrice>[0])
            if (result.success) {
                toast.success("Record created successfully")
                form.reset({
                    businessConsultantId: session?.user?.id,
                    consultantName: session?.user?.name ?? "",
                    customerName: "",
                    productSize: "",
                    category: "Earthmover",
                    brand: "",
                    supplier: "",
                    currency: "IDR",
                    price: "",
                    remark: "",
                })
                onSuccess()
            } else {
                toast.error(result.error)
            }
        } catch (_error) {
            toast.error("Something went wrong")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Price Competitor Record</DialogTitle>
                    <DialogDescription>
                        Enter competitor price information from the field.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="infoDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Tanggal Informasi *</FormLabel>
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

                            <FormField
                                control={form.control}
                                name="businessConsultantId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Business Consultant (User Sistem)</FormLabel>
                                        <Select
                                            onValueChange={(val) => {
                                                field.onChange(val)
                                                // Automatically set consultantName if a user is selected
                                                const selectedUser = users.find(u => u.id === val)
                                                if (selectedUser) {
                                                    form.setValue("consultantName", selectedUser.name)
                                                }
                                            }}
                                            value={field.value || undefined}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih User (Opsional)" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">-- Bukan User Sistem --</SelectItem>
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
                        </div>

                        <FormField
                            control={form.control}
                            name="consultantName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nama Consultant (Source Asli) *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Nama consultant dari sumber data" {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="customerName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nama Customer *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Jawaban Anda" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="productSize"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Size Tire / Product *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Jawaban Anda" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Category Tire *</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex flex-col space-y-1"
                                        >
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value="Earthmover" />
                                                </FormControl>
                                                <FormLabel className="font-normal">Earthmover</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value="Truck & Bus" />
                                                </FormControl>
                                                <FormLabel className="font-normal">Truck & Bus</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="brand"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Brand *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Jawaban Anda" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="supplier"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Supplier *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Jawaban Anda" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <FormField
                                control={form.control}
                                name="currency"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Currency *</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex space-x-4"
                                            >
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="IDR" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">IDR</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value="USD" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">USD</FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Price * (Angka Saja)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. 1500000" type="text" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="remark"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Remark / Delivery Drop Point *</FormLabel>
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
