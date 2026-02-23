/**
 * Hari Libur Nasional dan Cuti Bersama Indonesia
 * Sumber: SKB 3 Menteri (Menag, Menteri Ketenagakerjaan, Menpan RB)
 * Tahun 2025 & 2026
 */

export type HolidayType = "national_holiday" | "joint_leave"

export interface IndonesiaHoliday {
  date: string // format: YYYY-MM-DD
  name: string
  type: HolidayType
}

export const INDONESIA_HOLIDAYS: IndonesiaHoliday[] = [
  // ──────────────────────────────────────────────────────────────
  // 2025
  // ──────────────────────────────────────────────────────────────
  { date: "2025-01-01", name: "Tahun Baru Masehi 2025", type: "national_holiday" },
  { date: "2025-01-27", name: "Isra Mikraj Nabi Muhammad SAW", type: "national_holiday" },
  { date: "2025-01-28", name: "Cuti Bersama Isra Mikraj", type: "joint_leave" },
  { date: "2025-01-29", name: "Tahun Baru Imlek 2576 Kongzili", type: "national_holiday" },
  { date: "2025-03-29", name: "Hari Raya Nyepi (Tahun Baru Saka 1947)", type: "national_holiday" },
  { date: "2025-03-31", name: "Hari Raya Idul Fitri 1 Syawal 1446 H", type: "national_holiday" },
  { date: "2025-04-01", name: "Hari Raya Idul Fitri 2 Syawal 1446 H", type: "national_holiday" },
  { date: "2025-04-02", name: "Cuti Bersama Idul Fitri", type: "joint_leave" },
  { date: "2025-04-03", name: "Cuti Bersama Idul Fitri", type: "joint_leave" },
  { date: "2025-04-04", name: "Cuti Bersama Idul Fitri", type: "joint_leave" },
  { date: "2025-04-07", name: "Cuti Bersama Idul Fitri", type: "joint_leave" },
  { date: "2025-04-18", name: "Wafat Yesus Kristus (Good Friday)", type: "national_holiday" },
  { date: "2025-04-20", name: "Cuti Bersama Paskah", type: "joint_leave" },
  { date: "2025-05-01", name: "Hari Buruh Internasional", type: "national_holiday" },
  { date: "2025-05-12", name: "Hari Raya Waisak 2569 BE", type: "national_holiday" },
  { date: "2025-05-13", name: "Cuti Bersama Waisak", type: "joint_leave" },
  { date: "2025-05-29", name: "Kenaikan Yesus Kristus", type: "national_holiday" },
  { date: "2025-05-30", name: "Cuti Bersama Kenaikan Isa Al-Masih", type: "joint_leave" },
  { date: "2025-06-01", name: "Hari Lahir Pancasila", type: "national_holiday" },
  { date: "2025-06-06", name: "Hari Raya Idul Adha 1446 H", type: "national_holiday" },
  { date: "2025-06-27", name: "Tahun Baru Islam 1447 H", type: "national_holiday" },
  { date: "2025-08-17", name: "Hari Kemerdekaan Republik Indonesia", type: "national_holiday" },
  { date: "2025-09-05", name: "Maulid Nabi Muhammad SAW 1447 H", type: "national_holiday" },
  { date: "2025-12-25", name: "Hari Raya Natal", type: "national_holiday" },
  { date: "2025-12-26", name: "Cuti Bersama Natal", type: "joint_leave" },

  // ──────────────────────────────────────────────────────────────
  // 2026
  // ──────────────────────────────────────────────────────────────
 
  { "date": "2026-01-01", "name": "Tahun Baru Masehi 2026", "type": "national_holiday" },
  { "date": "2026-01-16", "name": "Isra Mikraj Nabi Muhammad SAW 1447 H", "type": "national_holiday" },
  { "date": "2026-01-25", "name": "Hari Gizi Nasional", "type": "observance" },
  { "date": "2026-02-09", "name": "Hari Pers Nasional (HPN)", "type": "observance" },
  { "date": "2026-02-17", "name": "Tahun Baru Imlek 2577 Kongzili", "type": "national_holiday" },
  { "date": "2026-02-22", "name": "Hari Istiqlal", "type": "observance" },
  { "date": "2026-03-01", "name": "Hari Penegakan Kedaulatan Negara", "type": "observance" },
  { "date": "2026-03-09", "name": "Hari Musik Nasional", "type": "observance" },
  { "date": "2026-03-19", "name": "Hari Raya Nyepi (Tahun Baru Saka 1948)", "type": "national_holiday" },
  { "date": "2026-03-20", "name": "Hari Raya Idul Fitri 1 Syawal 1447 H", "type": "national_holiday" },
  { "date": "2026-03-21", "name": "Hari Raya Idul Fitri 2 Syawal 1447 H", "type": "national_holiday" },
  { "date": "2026-03-23", "name": "Cuti Bersama Idul Fitri", "type": "joint_leave" },
  { "date": "2026-03-24", "name": "Cuti Bersama Idul Fitri", "type": "joint_leave" },
  { "date": "2026-03-25", "name": "Cuti Bersama Idul Fitri", "type": "joint_leave" },
  { "date": "2026-03-26", "name": "Cuti Bersama Idul Fitri", "type": "joint_leave" },
  { "date": "2026-03-30", "name": "Hari Film Nasional", "type": "observance" },
  { "date": "2026-04-03", "name": "Wafat Yesus Kristus (Good Friday)", "type": "national_holiday" },
  { "date": "2026-04-06", "name": "Cuti Bersama Paskah", "type": "joint_leave" },
  { "date": "2026-04-21", "name": "Hari Kartini", "type": "observance" },
  { "date": "2026-05-01", "name": "Hari Buruh Internasional", "type": "national_holiday" },
  { "date": "2026-05-02", "name": "Hari Pendidikan Nasional", "type": "observance" },
  { "date": "2026-05-14", "name": "Kenaikan Yesus Kristus", "type": "national_holiday" },
  { "date": "2026-05-20", "name": "Hari Kebangkitan Nasional", "type": "observance" },
  { "date": "2026-05-27", "name": "Hari Raya Waisak 2570 BE", "type": "national_holiday" },
  { "date": "2026-06-01", "name": "Hari Lahir Pancasila", "type": "national_holiday" },
  { "date": "2026-06-18", "name": "Hari Raya Idul Adha 1447 H", "type": "national_holiday" },
  { "date": "2026-06-29", "name": "Hari Keluarga Nasional (Harganas)", "type": "observance" },
  { "date": "2026-07-16", "name": "Tahun Baru Islam 1448 H", "type": "national_holiday" },
  { "date": "2026-07-22", "name": "Hari Kejaksaan / Hari Bhakti Adhyaksa", "type": "observance" },
  { "date": "2026-07-23", "name": "Hari Anak Nasional", "type": "observance" },
  { "date": "2026-08-17", "name": "Hari Kemerdekaan Republik Indonesia", "type": "national_holiday" },
  { "date": "2026-09-09", "name": "Hari Olahraga Nasional (Haornas)", "type": "observance" },
  { "date": "2026-09-24", "name": "Maulid Nabi Muhammad SAW 1448 H", "type": "national_holiday" },
  { "date": "2026-10-01", "name": "Hari Kesaktian Pancasila", "type": "observance" },
  { "date": "2026-10-02", "name": "Hari Batik Nasional", "type": "observance" },
  { "date": "2026-10-05", "name": "Hari Tentara Nasional Indonesia (TNI)", "type": "observance" },
  { "date": "2026-10-22", "name": "Hari Santri Nasional", "type": "observance" },
  { "date": "2026-10-28", "name": "Hari Sumpah Pemuda", "type": "observance" },
  { "date": "2026-11-10", "name": "Hari Pahlawan", "type": "observance" },
  { "date": "2026-11-12", "name": "Hari Kesehatan Nasional", "type": "observance" },
  { "date": "2026-11-25", "name": "Hari Guru Nasional (PGRI)", "type": "observance" },
  { "date": "2026-12-09", "name": "Hari Anti Korupsi Sedunia", "type": "observance" },
  { "date": "2026-12-22", "name": "Hari Ibu", "type": "observance" },
  { "date": "2026-12-25", "name": "Hari Raya Natal", "type": "national_holiday" }

]

/**
 * Get holidays for a specific year
 */
export function getHolidaysByYear(year: number): IndonesiaHoliday[] {
  return INDONESIA_HOLIDAYS.filter((h) => h.date.startsWith(`${year}-`))
}

/**
 * Get holidays within a date range (inclusive)
 */
export function getHolidaysInRange(startDate: Date, endDate: Date): IndonesiaHoliday[] {
  const start = startDate.toISOString().slice(0, 10)
  const end = endDate.toISOString().slice(0, 10)
  return INDONESIA_HOLIDAYS.filter((h) => h.date >= start && h.date <= end)
}

/**
 * Check if a given date string (YYYY-MM-DD) is a national holiday
 */
export function isNationalHoliday(dateStr: string): boolean {
  return INDONESIA_HOLIDAYS.some((h) => h.date === dateStr && h.type === "national_holiday")
}
