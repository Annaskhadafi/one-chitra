"use client"

import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { CalendarDays, Clock, Edit, Mail, Trash2, User } from "lucide-react"
import { useState } from "react"

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { FCEvent } from "@/lib/types"

interface EventDetailSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    event: FCEvent | null
    onEdit: (event: FCEvent) => void
    onDelete: (event: FCEvent) => Promise<void>
}

const EVENT_TYPE_LABELS: Record<string, string> = {
    marketing: "Marketing",
    reminder: "Reminder",
    birthday: "Ulang Tahun Customer",
    national_holiday: "Hari Libur Nasional",
    joint_leave: "Cuti Bersama",
}

export function EventDetailSheet({
    open,
    onOpenChange,
    event,
    onEdit,
    onDelete,
}: EventDetailSheetProps) {
    const [isDeleting, setIsDeleting] = useState(false)

    if (!event) return null

    const isEditable = event.extendedProps.eventType === "marketing" || event.extendedProps.eventType === "reminder"
    const eventType = event.extendedProps.eventType
    const label = EVENT_TYPE_LABELS[eventType] ?? eventType

    const startDate = new Date(event.start)
    const endDate = event.end ? new Date(event.end) : null

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await onDelete(event)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md">
                <SheetHeader className="mb-6">
                    <div className="flex items-start gap-3">
                        <span
                            className="mt-1 inline-block size-4 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: event.backgroundColor }}
                        />
                        <SheetTitle className="text-left leading-snug">{event.title}</SheetTitle>
                    </div>
                    <Badge variant="secondary" className="w-fit ml-7">
                        {label}
                    </Badge>
                </SheetHeader>

                <div className="space-y-4">
                    {/* Date */}
                    <div className="flex items-start gap-3 text-sm">
                        <CalendarDays className="mt-0.5 size-4 text-muted-foreground flex-shrink-0" />
                        <div>
                            <p className="font-medium">
                                {format(startDate, "EEEE, dd MMMM yyyy", { locale: localeId })}
                            </p>
                            {endDate && (
                                <p className="text-muted-foreground">
                                    s/d {format(endDate, "dd MMMM yyyy", { locale: localeId })}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Time (if not all-day) */}
                    {!event.allDay && (
                        <div className="flex items-center gap-3 text-sm">
                            <Clock className="size-4 text-muted-foreground flex-shrink-0" />
                            <span>{format(startDate, "HH:mm")}{endDate ? ` – ${format(endDate, "HH:mm")}` : ""}</span>
                        </div>
                    )}

                    {/* Description */}
                    {event.extendedProps.description && (
                        <div className="rounded-lg bg-muted/50 p-3 text-sm">
                            <p className="whitespace-pre-wrap">{event.extendedProps.description}</p>
                        </div>
                    )}

                    {/* Customer info (birthday) */}
                    {eventType === "birthday" && event.extendedProps.customerName && (
                        <div className="flex items-center gap-3 text-sm">
                            <User className="size-4 text-muted-foreground flex-shrink-0" />
                            <span>{event.extendedProps.customerName}</span>
                        </div>
                    )}
                </div>

                {/* Actions for editable events only */}
                {isEditable && (
                    <div className="absolute bottom-6 left-6 right-6 flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => onEdit(event)}
                        >
                            <Edit className="mr-2 size-4" />
                            Edit
                        </Button>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon">
                                    <Trash2 className="size-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Event?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Event &ldquo;{event.title}&rdquo; akan dihapus permanen dan tidak bisa dikembalikan.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleDelete}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        disabled={isDeleting}
                                    >
                                        Hapus
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
