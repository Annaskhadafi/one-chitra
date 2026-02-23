"use client"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import type { DateSelectArg, EventClickArg, DatesSetArg } from "@fullcalendar/core"
import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"
import type { FCEvent } from "@/lib/types"
import { getCalendarEvents, deleteCalendarEvent } from "@/app/actions/calendar-events"
import { EventDialog } from "./event-dialog"
import { EventDetailSheet } from "./event-detail-sheet"
import { BirthdayCSVImport } from "./birthday-csv-import"

interface CalendarViewProps {
    initialEvents: FCEvent[]
}

export function CalendarView({ initialEvents }: CalendarViewProps) {
    const calendarRef = useRef<FullCalendar>(null)
    const [events, setEvents] = useState<FCEvent[]>(initialEvents)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [detailOpen, setDetailOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [selectedEvent, setSelectedEvent] = useState<FCEvent | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    // Reload events for a date range when calendar navigates
    const handleDatesSet = useCallback(async (arg: DatesSetArg) => {
        setIsLoading(true)
        try {
            const result = await getCalendarEvents(arg.start, arg.end)
            if (result.success) {
                setEvents(result.data)
            }
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Click on empty date cell → open create dialog
    const handleDateSelect = useCallback((arg: DateSelectArg) => {
        setSelectedDate(arg.start)
        setSelectedEvent(null)
        setDialogOpen(true)
    }, [])

    // Click on an existing event
    const handleEventClick = useCallback((arg: EventClickArg) => {
        const ev = events.find((e) => e.id === arg.event.id)
        if (!ev) return
        setSelectedEvent(ev)
        setDetailOpen(true)
    }, [events])

    const refreshEvents = useCallback(async () => {
        const cal = calendarRef.current
        if (!cal) return
        const view = cal.getApi().view
        const result = await getCalendarEvents(view.activeStart, view.activeEnd)
        if (result.success) setEvents(result.data)
    }, [])

    const handleEditFromDetail = useCallback((ev: FCEvent) => {
        setDetailOpen(false)
        setSelectedEvent(ev)
        setDialogOpen(true)
    }, [])

    const handleDeleteFromDetail = useCallback(async (ev: FCEvent) => {
        if (!ev.extendedProps.dbId) return
        const res = await deleteCalendarEvent(ev.extendedProps.dbId)
        if (res.success) {
            toast.success("Event dihapus")
            setDetailOpen(false)
            await refreshEvents()
        } else {
            toast.error(res.error ?? "Gagal menghapus event")
        }
    }, [refreshEvents])

    return (
        <>
            <div className="flex justify-end">
                <BirthdayCSVImport onSuccess={refreshEvents} />
            </div>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                {isLoading && (
                    <div className="h-1 bg-primary/20 animate-pulse" />
                )}
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                        left: "prev,next today",
                        center: "title",
                        right: "dayGridMonth,timeGridWeek,timeGridDay addEvent",
                    }}
                    customButtons={{
                        addEvent: {
                            text: "+ Tambah Event",
                            click: () => {
                                setSelectedDate(new Date())
                                setSelectedEvent(null)
                                setDialogOpen(true)
                            },
                        },
                    }}
                    locale="id"
                    buttonText={{
                        today: "Hari Ini",
                        month: "Bulan",
                        week: "Minggu",
                        day: "Hari",
                    }}
                    firstDay={1}
                    events={events}
                    selectable
                    selectMirror
                    dayMaxEvents={3}
                    select={handleDateSelect}
                    eventClick={handleEventClick}
                    datesSet={handleDatesSet}
                    height="auto"
                    contentHeight="auto"
                    expandRows={true}
                    eventDisplay="block"
                    displayEventTime={false}
                />
            </div>

            <EventDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                defaultDate={selectedDate ?? undefined}
                event={selectedEvent ?? undefined}
                onSuccess={async () => {
                    setDialogOpen(false)
                    await refreshEvents()
                }}
            />

            <EventDetailSheet
                open={detailOpen}
                onOpenChange={setDetailOpen}
                event={selectedEvent}
                onEdit={handleEditFromDetail}
                onDelete={handleDeleteFromDetail}
            />
        </>
    )
}
