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
    specification: ["specification", "spec", "size", "tirespecification"],
    avgHours: ["avghours", "averagehours", "averagehour", "hours", "hm"],
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
    return {
        type,
        performanceDate: pickImportValue(row, HEADER_ALIASES.performanceDate),
        endUser: pickImportValue(row, HEADER_ALIASES.endUser),
        mineSite: pickImportValue(row, HEADER_ALIASES.mineSite),
        manufacture: pickImportValue(row, HEADER_ALIASES.manufacture),
        specification: pickImportValue(row, HEADER_ALIASES.specification),
        avgHours: String(parseImportNumber(pickImportValue(row, HEADER_ALIASES.avgHours))),
        recordCount: Math.max(0, Math.round(parseImportNumber(pickImportValue(row, HEADER_ALIASES.recordCount)))),
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
