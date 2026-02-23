"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { id as localeId } from "date-fns/locale"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

import { calendarEventSchema } from "@/lib/schemas"
import { createCalendarEvent, updateCalendarEvent } from "@/app/actions/calendar-events"
import type { FCEvent } from "@/lib/types"

type FormValues = z.infer<typeof calendarEventSchema>

const EVENT_COLORS = [
    { label: "Biru (Marketing)", value: "#3b82f6" },
    { label: "Hijau", value: "#22c55e" },
    { label: "Ungu", value: "#a855f7" },
    { label: "Amber (Reminder)", value: "#f59e0b" },
    { label: "Teal", value: "#14b8a6" },
    { label: "Pink", value: "#ec4899" },
]

interface EventDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultDate?: Date
    event?: FCEvent // if editing
    onSuccess: () => void
}

export function EventDialog({
    open,
    onOpenChange,
    defaultDate,
    event,
    onSuccess,
}: EventDialogProps) {
    const isEditing = !!event?.extendedProps?.dbId
    const [isPending, setIsPending] = useState(false)

    const form = useForm<FormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(calendarEventSchema) as any,
        defaultValues: {
            title: "",
            description: "",
            startDate: defaultDate ?? new Date(),
            endDate: null,
            allDay: true,
            type: "marketing",
            color: "#3b82f6",
            relatedCustomerId: null,
            emailReminderAt: null,
            emailReminderTo: "",
        },
    })

    // Reset form when dialog opens / event changes
    useEffect(() => {
        if (open) {
            if (event && isEditing) {
                form.reset({
                    title: event.title.replace(/^🎂 Birthday: /, ""),
                    description: event.extendedProps.description ?? "",
                    startDate: new Date(event.start),
                    endDate: event.end ? new Date(event.end) : null,
                    allDay: event.allDay,
                    type: (event.extendedProps.eventType as "marketing" | "reminder") ?? "marketing",
                    color: event.backgroundColor,
                    relatedCustomerId: event.extendedProps.customerId ?? null,
                    emailReminderAt: null,
                    emailReminderTo: "",
                })
            } else {
                form.reset({
                    title: "",
                    description: "",
                    startDate: defaultDate ?? new Date(),
                    endDate: null,
                    allDay: true,
                    type: "marketing",
                    color: "#3b82f6",
                    relatedCustomerId: null,
                    emailReminderAt: null,
                    emailReminderTo: "",
                })
            }
        }
    }, [open, event, defaultDate, isEditing, form])

    const onSubmit = async (data: FormValues) => {
        setIsPending(true)
        try {
            let res
            if (isEditing && event?.extendedProps?.dbId) {
                res = await updateCalendarEvent(event.extendedProps.dbId, data)
            } else {
                res = await createCalendarEvent(data)
            }

            if (res.success) {
                toast.success(isEditing ? "Event diperbarui" : "Event dibuat")
                onSuccess()
            } else {
                toast.error(res.error ?? "Gagal menyimpan event")
            }
        } finally {
            setIsPending(false)
        }
    }

    const watchAllDay = form.watch("allDay")
    const watchEmailReminder = !!form.watch("emailReminderAt")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Event" : "Tambah Event Baru"}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* Title */}
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Judul Event *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Contoh: Meeting dengan distributor Surabaya" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Type + Color */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipe</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="marketing">Marketing</SelectItem>
                                                <SelectItem value="reminder">Reminder</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="color"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Warna</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="inline-block size-3 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: field.value }}
                                                        />
                                                        <SelectValue />
                                                    </div>
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {EVENT_COLORS.map((c) => (
                                                    <SelectItem key={c.value} value={c.value}>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="inline-block size-3 rounded-full"
                                                                style={{ backgroundColor: c.value }}
                                                            />
                                                            {c.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* All Day toggle */}
                        <FormField
                            control={form.control}
                            name="allDay"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-3">
                                    <FormLabel className="mt-0">Seharian penuh</FormLabel>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {/* Start Date */}
                        <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tanggal Mulai *</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-start text-left font-normal"
                                                >
                                                    <CalendarIcon className="mr-2 size-4 opacity-50" />
                                                    {field.value
                                                        ? format(field.value, watchAllDay ? "dd MMMM yyyy" : "dd MMMM yyyy HH:mm", { locale: localeId })
                                                        : "Pilih tanggal"}
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={(d) => d && field.onChange(d)}
                                                initialFocus
                                            />
                                            {!watchAllDay && (
                                                <div className="p-3 border-t">
                                                    <Input
                                                        type="time"
                                                        value={field.value ? format(field.value, "HH:mm") : ""}
                                                        onChange={(e) => {
                                                            const [h, m] = e.target.value.split(":").map(Number)
                                                            const d = new Date(field.value)
                                                            d.setHours(h, m)
                                                            field.onChange(d)
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* End Date (optional) */}
                        <FormField
                            control={form.control}
                            name="endDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tanggal Selesai (opsional)</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-start text-left font-normal"
                                                >
                                                    <CalendarIcon className="mr-2 size-4 opacity-50" />
                                                    {field.value
                                                        ? format(field.value, "dd MMMM yyyy", { locale: localeId })
                                                        : "Pilih tanggal (opsional)"}
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value ?? undefined}
                                                onSelect={(d) => field.onChange(d ?? null)}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Description */}
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Deskripsi</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Detail event, agenda, atau catatan..."
                                            className="resize-none"
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Email Reminder */}
                        <div className="rounded-lg border p-4 space-y-3">
                            <p className="text-sm font-medium">Email Reminder (opsional)</p>
                            <FormField
                                control={form.control}
                                name="emailReminderTo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Kirim ke email</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="contoh@email.com"
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="emailReminderAt"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Waktu kirim reminder</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full justify-start text-left font-normal"
                                                    >
                                                        <CalendarIcon className="mr-2 size-3 opacity-50" />
                                                        {field.value
                                                            ? format(field.value, "dd MMM yyyy HH:mm", { locale: localeId })
                                                            : "Pilih waktu reminder"}
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value ?? undefined}
                                                    onSelect={(d) => field.onChange(d ?? null)}
                                                    initialFocus
                                                />
                                                <div className="p-3 border-t">
                                                    <Input
                                                        type="time"
                                                        value={field.value ? format(field.value, "HH:mm") : "08:00"}
                                                        onChange={(e) => {
                                                            const [h, m] = e.target.value.split(":").map(Number)
                                                            const d = field.value ? new Date(field.value) : new Date()
                                                            d.setHours(h, m)
                                                            field.onChange(d)
                                                        }}
                                                    />
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                                {isEditing ? "Simpan Perubahan" : "Buat Event"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
