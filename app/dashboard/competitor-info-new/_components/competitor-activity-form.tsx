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
import { createCompetitorActivity } from "@/app/actions/competitor-new"
import { toast } from "sonner"

const formSchema = z.object({
    businessConsultantId: z.string().min(1, "Consultant is required"),
    infoDate: z.date({ required_error: "Information date is required" }),
    competitorName: z.string().min(1, "Competitor name is required"),
    customerName: z.string().min(1, "Customer name is required"),
    industryCategory: z.string().min(1, "Industry category is required"),
    location: z.string().min(1, "Location is required"),
    activityType: z.string().min(1, "Activity type is required"),
    marketResponse: z.string().min(1, "Market response is required"),
    businessImpact: z.string().min(1, "Business impact is required"),
    description: z.string().optional(),
})

interface CompetitorActivityFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function CompetitorActivityForm({ open, onOpenChange, onSuccess }: CompetitorActivityFormProps) {
    const [users, setUsers] = useState<any[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            competitorName: "",
            customerName: "",
            industryCategory: "Distributor Ban",
            location: "",
            activityType: "",
            marketResponse: "Positif",
            businessImpact: "Tidak Ada",
            description: "",
        },
    })

    useEffect(() => {
        getUsers().then(setUsers)
    }, [])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true)
        try {
            const result = await createCompetitorActivity(values)
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
                    <DialogTitle>Add Competitor Activity</DialogTitle>
                    <DialogDescription>
                        Record activities and potential impacts from competitors.
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
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="competitorName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Competitor *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Jawaban Anda" {...field} />
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
                                        <FormLabel>Customer *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Jawaban Anda" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="industryCategory"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Industri / Kategori *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih Kategori" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Distributor Ban">Distributor Ban</SelectItem>
                                            <SelectItem value="Distributor Aksesoris">Distributor Aksesoris</SelectItem>
                                            <SelectItem value="Jasa Service/Repair/Retread">Jasa Service/Repair/Retread</SelectItem>
                                            <SelectItem value="Principal">Principal</SelectItem>
                                            <SelectItem value="Distributor Unit">Distributor Unit</SelectItem>
                                            <SelectItem value="Distributor Tyre Handler">Distributor Tyre Handler</SelectItem>
                                            <SelectItem value="Yang lain">Yang lain</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="location"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Lokasi *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Jawaban Anda" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="activityType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Jenis Aktivitas *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Promosi, Kunjungan, dll" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="marketResponse"
                                border-none
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Respon Pasar *</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex flex-col space-y-1"
                                            >
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl><RadioGroupItem value="Positif" /></FormControl>
                                                    <FormLabel className="font-normal text-green-600 font-bold">Positif</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl><RadioGroupItem value="Negatif" /></FormControl>
                                                    <FormLabel className="font-normal text-red-600 font-bold">Negatif</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl><RadioGroupItem value="Netral" /></FormControl>
                                                    <FormLabel className="font-normal text-blue-600 font-bold">Netral</FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="businessImpact"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Perkiraan Pengaruh ke Bisnis *</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex flex-col space-y-1"
                                            >
                                                {["Tidak Ada", "Rendah", "Sedang", "Tinggi"].map((impact) => (
                                                    <FormItem key={impact} className="flex items-center space-x-3 space-y-0">
                                                        <FormControl><RadioGroupItem value={impact} /></FormControl>
                                                        <FormLabel className="font-normal">{impact}</FormLabel>
                                                    </FormItem>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Deskripsi Competitor Activity *</FormLabel>
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
                                    "Submit Activity"
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
