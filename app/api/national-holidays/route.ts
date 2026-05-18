import { NextResponse } from "next/server"

type Holiday = {
  date: string
  name: string
  is_national_holiday: boolean
}

const HOLIDAY_API_URL = "https://libur.deno.dev/api"

export async function GET() {
  try {
    const response = await fetch(HOLIDAY_API_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 6 },
    })

    if (!response.ok) {
      return NextResponse.json({ error: `API Hari Nasional gagal: HTTP ${response.status}` }, { status: 502 })
    }

    const holidays = await response.json() as Holiday[]
    const validHolidays = holidays
      .filter((holiday) => holiday.date && holiday.name)
      .sort((a, b) => a.date.localeCompare(b.date))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nearestHoliday = validHolidays.find((holiday) => {
      const date = new Date(`${holiday.date}T00:00:00+08:00`)
      return date.getTime() >= today.getTime() && holiday.is_national_holiday
    }) || validHolidays.find((holiday) => holiday.is_national_holiday) || validHolidays[0]

    return NextResponse.json({ holidays: validHolidays, nearestHoliday })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengambil data Hari Nasional"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
