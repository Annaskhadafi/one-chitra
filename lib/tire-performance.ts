export type TirePerformanceType = "running" | "scrap"

export type TirePerformanceInput = {
    type: TirePerformanceType
    performanceDate: string
    endUser: string
    mineSite: string
    manufacture: string
    specification: string
    avgHours: string
    recordCount: number
    remarks: string
}

export type TirePerformanceRow = Omit<TirePerformanceInput, "remarks"> & {
    id: number
    remarks: string | null
    createdAt: Date
    updatedAt: Date
}

export type TirePerformanceAggregateRow = {
    key: string
    performanceDate: string
    endUser: string
    mineSite: string
    manufacture: string
    specification: string
    avgHours: number
    recordCount: number
    sourceCount: number
}

const HEADER_ALIASES = {
    performanceDate: [
        "inputdate",
        "inputdateyearmonth",
        "inputdateyear",
        "dateremoved",
        "dateremovedyear",
        "date",
        "period",
        "tahun",
        "bulan",
    ],
    endUser: ["enduser", "customer", "customername", "user"],
    mineSite: ["minesite", "site", "minesitearea"],
    manufacture: ["manufacture", "manufacturer", "brand", "merk"],
    specification: ["specification", "spesification", "spec", "size", "tirespecification"],
    avgHours: ["avghours", "averagehours", "averagehour", "hours", "hm", "totalh"],
    recordCount: ["recordcount", "recordcou", "count", "qty", "totalrecord"],
    remarks: ["remarks", "remark", "note", "notes", "keterangan"],
}

export function normalizeImportHeader(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function stringifyImportCell(value: unknown) {
    if (value === null || value === undefined) return ""
    if (value instanceof Date) return value.toLocaleDateString("id-ID")
    return String(value).trim()
}

/**
 * Convert a date value to "Mon YYYY" format (e.g. "Mar 2024").
 * Handles Excel serial dates, Date objects, and date strings.
 */
function toMonthYear(value: unknown): string {
    if (value === null || value === undefined) return ""

    let date: Date | null = null

    if (value instanceof Date) {
        date = value
    } else {
        const raw = String(value).trim()
        if (!raw) return ""

        // Excel serial date number
        const num = Number(raw)
        if (Number.isFinite(num) && num > 0 && num < 2958466) {
            // Excel epoch is 1900-01-01, but has a leap year bug (+1 day offset for dates after Feb 28 1900)
            const excelEpoch = new Date(1899, 11, 30)
            date = new Date(excelEpoch.getTime() + num * 86400000)
        } else {
            // Try parsing as date string
            const parsed = new Date(raw)
            if (!isNaN(parsed.getTime())) {
                date = parsed
            }
        }
    }

    if (!date || isNaN(date.getTime())) return String(value).trim()

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return `${months[date.getMonth()]} ${date.getFullYear()}`
}

export function parseImportNumber(value: unknown) {
    const raw = stringifyImportCell(value)
        .replace(/\s/g, "")
        .replace(/,/g, "")

    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : 0
}

function pickImportValue(row: Record<string, unknown>, aliases: string[]) {
    const normalizedAliases = new Set(aliases)
    const entry = Object.entries(row).find(([key]) => normalizedAliases.has(normalizeImportHeader(key)))
    return entry ? stringifyImportCell(entry[1]) : ""
}

export function normalizeTirePerformanceImportRow(
    row: Record<string, unknown>,
    type: TirePerformanceType,
): TirePerformanceInput {
    const rawRecordCount = Math.max(0, Math.round(parseImportNumber(pickImportValue(row, HEADER_ALIASES.recordCount))))

    // For scrap type, convert Date Removed to month-year format
    let performanceDate: string
    if (type === "scrap") {
        const dateAliases = HEADER_ALIASES.performanceDate
        const normalizedAliases = new Set(dateAliases)
        const entry = Object.entries(row).find(([key]) => normalizedAliases.has(normalizeImportHeader(key)))
        performanceDate = entry ? toMonthYear(entry[1]) : ""
    } else {
        performanceDate = pickImportValue(row, HEADER_ALIASES.performanceDate)
    }

    return {
        type,
        performanceDate,
        endUser: pickImportValue(row, HEADER_ALIASES.endUser),
        mineSite: pickImportValue(row, HEADER_ALIASES.mineSite),
        manufacture: pickImportValue(row, HEADER_ALIASES.manufacture),
        specification: pickImportValue(row, HEADER_ALIASES.specification),
        avgHours: String(parseImportNumber(pickImportValue(row, HEADER_ALIASES.avgHours))),
        recordCount: rawRecordCount > 0 ? rawRecordCount : 1,
        remarks: pickImportValue(row, HEADER_ALIASES.remarks),
    }
}

export function hasTirePerformanceContent(row: TirePerformanceInput) {
    return Boolean(
        row.performanceDate ||
            row.endUser ||
            row.mineSite ||
            row.manufacture ||
            row.specification ||
            Number(row.avgHours) ||
            row.recordCount ||
            row.remarks,
    )
}

export function aggregateTirePerformanceRows(rows: TirePerformanceRow[]): TirePerformanceAggregateRow[] {
    const grouped = new Map<string, TirePerformanceAggregateRow & { weightedHours: number }>()

    for (const row of rows) {
        const key = [
            row.performanceDate || "-",
            row.endUser || "-",
            row.mineSite || "-",
            row.manufacture || "-",
            row.specification || "-",
        ].join("||")
        const avgHours = Number(row.avgHours) || 0
        const recordCount = Number(row.recordCount) || 0
        const current = grouped.get(key)

        if (!current) {
            grouped.set(key, {
                key,
                performanceDate: row.performanceDate || "-",
                endUser: row.endUser || "-",
                mineSite: row.mineSite || "-",
                manufacture: row.manufacture || "-",
                specification: row.specification || "-",
                avgHours: 0,
                recordCount,
                sourceCount: 1,
                weightedHours: avgHours * recordCount,
            })
            continue
        }

        current.recordCount += recordCount
        current.sourceCount += 1
        current.weightedHours += avgHours * recordCount
    }

    return Array.from(grouped.values()).map(({ weightedHours, ...row }) => ({
        ...row,
        avgHours: row.recordCount > 0 ? Number((weightedHours / row.recordCount).toFixed(2)) : 0,
    }))
}
