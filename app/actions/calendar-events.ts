"use server"

import { db } from "@/db"
import { calendarEvents } from "@/db/schema/calendar-events"
import { customers } from "@/db/schema/customers"
import { eq, and, gte, lte, isNotNull, ilike, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { calendarEventSchema } from "@/lib/schemas"
import type { FCEvent } from "@/lib/types"
import { getHolidaysInRange } from "@/lib/indonesia-holidays"

// ─── Helper: map DB event → FCEvent ────────────────────────────────────────

function dbEventToFC(ev: typeof calendarEvents.$inferSelect): FCEvent {
    const colorMap: Record<string, string> = {
        marketing: "#3b82f6",
        reminder: "#f59e0b",
    }
    const bg = ev.color ?? colorMap[ev.type] ?? "#3b82f6"

    return {
        id: `db-${ev.id}`,
        title: ev.title,
        start: ev.startDate.toISOString(),
        end: ev.endDate ? ev.endDate.toISOString() : undefined,
        allDay: ev.allDay,
        backgroundColor: bg,
        borderColor: bg,
        textColor: "#ffffff",
        extendedProps: {
            eventType: ev.type,
            description: ev.description ?? undefined,
            customerId: ev.relatedCustomerId ?? undefined,
            dbId: ev.id,
        },
    }
}

// ─── GET: events + birthdays + holidays for a date range ────────────────────

export async function getCalendarEvents(
    startDate: Date,
    endDate: Date
): Promise<{ success: true; data: FCEvent[] } | { success: false; error: string }> {
    try {
        // 1. Marketing / reminder events from DB
        const dbEvents = await db
            .select()
            .from(calendarEvents)
            .where(
                and(
                    gte(calendarEvents.startDate, startDate),
                    lte(calendarEvents.startDate, endDate)
                )
            )
            .orderBy(calendarEvents.startDate)

        const fcEvents: FCEvent[] = dbEvents.map(dbEventToFC)

        // 2. Customer birthdays (any customer with a birthday month/day in the range)
        const customersWithBirthday = await db
            .select({
                id: customers.id,
                name: customers.name,
                email: customers.email,
                birthday: customers.birthday,
            })
            .from(customers)
            .where(isNotNull(customers.birthday))

        // Expand birthdays across all years in range
        const startYear = startDate.getFullYear()
        const endYear = endDate.getFullYear()

        for (const c of customersWithBirthday) {
            if (!c.birthday) continue
            const [, bMonth, bDay] = c.birthday.split("-").map(Number)

            for (let year = startYear; year <= endYear; year++) {
                const birthdayDate = new Date(year, bMonth - 1, bDay)
                if (birthdayDate >= startDate && birthdayDate <= endDate) {
                    const dateStr = birthdayDate.toISOString().slice(0, 10)
                    fcEvents.push({
                        id: `bday-${c.id}-${year}`,
                        title: `🎂 Birthday: ${c.name}`,
                        start: dateStr,
                        allDay: true,
                        backgroundColor: "#ec4899",
                        borderColor: "#ec4899",
                        textColor: "#ffffff",
                        extendedProps: {
                            eventType: "birthday",
                            customerId: c.id,
                            customerName: c.name,
                            description: `Ulang tahun ${c.name}`,
                        },
                    })
                }
            }
        }

        // 3. Indonesia national holidays
        const holidays = getHolidaysInRange(startDate, endDate)
        for (const h of holidays) {
            const bg = h.type === "national_holiday" ? "#ef4444" : "#f97316"
            fcEvents.push({
                id: `holiday-${h.date}`,
                title: h.name,
                start: h.date,
                allDay: true,
                backgroundColor: bg,
                borderColor: bg,
                textColor: "#ffffff",
                extendedProps: {
                    eventType: h.type,
                    description: h.type === "national_holiday" ? "Hari Libur Nasional" : "Cuti Bersama",
                },
            })
        }

        return { success: true, data: fcEvents }
    } catch (error) {
        console.error("getCalendarEvents error:", error)
        return { success: false, error: "Failed to load calendar events" }
    }
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createCalendarEvent(data: z.infer<typeof calendarEventSchema>) {
    try {
        const parsed = calendarEventSchema.parse(data)
        const [created] = await db
            .insert(calendarEvents)
            .values({
                title: parsed.title,
                description: parsed.description,
                startDate: parsed.startDate,
                endDate: parsed.endDate ?? null,
                allDay: parsed.allDay,
                type: parsed.type,
                color: parsed.color,
                relatedCustomerId: parsed.relatedCustomerId ?? null,
                emailReminderAt: parsed.emailReminderAt ?? null,
                emailReminderTo: parsed.emailReminderTo || null,
                emailReminderSent: false,
            })
            .returning()

        revalidatePath("/dashboard/calendar")
        return { success: true, data: created }
    } catch (error) {
        console.error("createCalendarEvent error:", error)
        return { success: false, error: "Failed to create event" }
    }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export async function updateCalendarEvent(id: number, data: z.infer<typeof calendarEventSchema>) {
    try {
        const parsed = calendarEventSchema.parse(data)
        const [updated] = await db
            .update(calendarEvents)
            .set({
                title: parsed.title,
                description: parsed.description,
                startDate: parsed.startDate,
                endDate: parsed.endDate ?? null,
                allDay: parsed.allDay,
                type: parsed.type,
                color: parsed.color,
                relatedCustomerId: parsed.relatedCustomerId ?? null,
                emailReminderAt: parsed.emailReminderAt ?? null,
                emailReminderTo: parsed.emailReminderTo || null,
                updatedAt: new Date(),
            })
            .where(eq(calendarEvents.id, id))
            .returning()

        revalidatePath("/dashboard/calendar")
        return { success: true, data: updated }
    } catch (error) {
        console.error("updateCalendarEvent error:", error)
        return { success: false, error: "Failed to update event" }
    }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deleteCalendarEvent(id: number) {
    try {
        await db.delete(calendarEvents).where(eq(calendarEvents.id, id))
        revalidatePath("/dashboard/calendar")
        return { success: true }
    } catch (error) {
        console.error("deleteCalendarEvent error:", error)
        return { success: false, error: "Failed to delete event" }
    }
}

// ─── EMAIL REMINDER ──────────────────────────────────────────────────────────

/**
 * Mark a specific event's reminder as sent (called after email dispatch).
 */
export async function markReminderSent(id: number) {
    await db
        .update(calendarEvents)
        .set({ emailReminderSent: true, updatedAt: new Date() })
        .where(eq(calendarEvents.id, id))
}

/**
 * Get all events where emailReminderAt is past AND emailReminderSent is false.
 * Used by the cron route.
 */
export async function getPendingEmailReminders() {
    const now = new Date()
    return db
        .select()
        .from(calendarEvents)
        .where(
            and(
                isNotNull(calendarEvents.emailReminderAt),
                lte(calendarEvents.emailReminderAt, now),
                eq(calendarEvents.emailReminderSent, false),
                isNotNull(calendarEvents.emailReminderTo)
            )
        )
}

/**
 * Get customers whose birthday is TOMORROW — for sending birthday greetings.
 */
export async function getCustomersWithTomorrowBirthday() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0")
    const day = String(tomorrow.getDate()).padStart(2, "0")
    const suffix = `-${month}-${day}`

    const all = await db
        .select({ id: customers.id, name: customers.name, email: customers.email, birthday: customers.birthday })
        .from(customers)
        .where(isNotNull(customers.birthday))

    // Filter by month-day suffix (birthday stored as YYYY-MM-DD)
    return all.filter((c) => c.birthday?.endsWith(suffix))
}

// ─── BIRTHDAY CSV IMPORT ─────────────────────────────────────────────────────

export interface BirthdayImportRow {
    identifier: string       // customer code or name from CSV
    identifierType: "code" | "name"
    birthday: string          // normalized YYYY-MM-DD
}

export interface BirthdayImportResult {
    success: boolean
    total: number
    updated: number
    notFound: string[]
    errors: string[]
}

export async function importCustomerBirthdays(
    rows: BirthdayImportRow[]
): Promise<BirthdayImportResult> {
    const notFound: string[] = []
    const errors: string[] = []
    let updated = 0

    // Batch all customers to avoid N+1 queries
    const allCustomers = await db
        .select({ id: customers.id, name: customers.name, customerCode: customers.customerCode })
        .from(customers)

    const byCode = new Map(allCustomers.map((c) => [c.customerCode.toLowerCase().trim(), c]))
    const byName = new Map(allCustomers.map((c) => [c.name.toLowerCase().trim(), c]))

    for (const row of rows) {
        try {
            const lookup = row.identifier.toLowerCase().trim()
            const customer = row.identifierType === "code"
                ? byCode.get(lookup)
                : byName.get(lookup)

            if (!customer) {
                notFound.push(row.identifier)
                continue
            }

            await db
                .update(customers)
                .set({ birthday: row.birthday, updatedAt: new Date() })
                .where(eq(customers.id, customer.id))

            updated++
        } catch (err) {
            errors.push(`${row.identifier}: ${err instanceof Error ? err.message : "unknown error"}`)
        }
    }

    if (updated > 0) {
        revalidatePath("/dashboard/calendar")
        revalidatePath("/dashboard/customers")
    }

    return {
        success: errors.length === 0,
        total: rows.length,
        updated,
        notFound,
        errors,
    }
}

/**
 * Get minimal customer list for client-side matching preview.
 */
export async function getCustomerListForBirthday() {
    return db
        .select({
            id: customers.id,
            customerCode: customers.customerCode,
            name: customers.name,
            birthday: customers.birthday,
        })
        .from(customers)
        .orderBy(customers.name)
}
