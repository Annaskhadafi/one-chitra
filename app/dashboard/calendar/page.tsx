import { getCalendarEvents } from "@/app/actions/calendar-events"
import { CalendarView } from "./_components/calendar-view"
import "./calendar.css"

export const metadata = {
    title: "Marketing Calendar",
}

export default async function CalendarPage() {
    // Load events for the current month as initial data
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0) // +2 months buffer

    const result = await getCalendarEvents(startOfMonth, endOfMonth)
    const initialEvents = result.success ? result.data : []

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Marketing Calendar</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Kelola event marketing, ulang tahun customer, dan hari libur nasional.
                    </p>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-full bg-blue-500" />
                    Marketing Event
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-full bg-amber-500" />
                    Reminder
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-full bg-pink-500" />
                    Ulang Tahun Customer
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-full bg-red-500" />
                    Hari Libur Nasional
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-full bg-orange-500" />
                    Cuti Bersama
                </div>
            </div>

            <CalendarView initialEvents={initialEvents} />
        </div>
    )
}
