import Fuse from "fuse.js"

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

    if (!date || isNaN(date.getTime())) return stringifyImportCell(value)

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
    const entries = Object.entries(row)
    const exactEntry = entries.find(([key]) => aliases[0] && normalizeImportHeader(key) === aliases[0])
    const entry = exactEntry ?? entries.find(([key]) => normalizedAliases.has(normalizeImportHeader(key)))
    return entry ? stringifyImportCell(entry[1]) : ""
}

export function normalizeTirePerformanceImportRow(
    row: Record<string, unknown>,
    type: TirePerformanceType,
): TirePerformanceInput {
    const rawRecordCount = Math.max(0, Math.round(parseImportNumber(pickImportValue(row, HEADER_ALIASES.recordCount))))

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

// ─── Manufacture Normalization (Fuse.js) ──────────────────────────────────────

function toTitleCase(str: string): string {
    return str
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Builds a Map from every raw manufacture name found in `rows` to its
 * canonical (Title Case, fuzzy-deduplicated) form.
 *
 * Algorithm:
 *  1. Collect all unique raw names.
 *  2. Sort longest-first so the most descriptive variant wins as canonical.
 *  3. Title-case each name before comparison.
 *  4. Use Fuse.js fuzzy search against the growing canonical list.
 *     – threshold 0.25 handles case differences + minor typos (1-2 chars).
 *  5. If a match is found, map the raw name to that canonical.
 *     Otherwise, add the title-cased name as a new canonical.
 *
 * Examples that get merged:
 *   "MICHELIN" | "michelin" | "Michelin"        → "Michelin"
 *   "BRIDGESTONE" | "Bridgestone"               → "Bridgestone"
 *   "GAJAH TUNGGAL" | "Gajah Tunggal"           → "Gajah Tunggal"
 *   "GOODYEAR" | "Goodyear" | "GoodyEar"        → "Goodyear"
 */
export function buildManufactureNormalizationMap(
    rows: { manufacture: string }[],
): Map<string, string> {
    const rawSet = new Set(rows.map((r) => (r.manufacture ?? "").trim()))
    const rawNames = Array.from(rawSet).filter(Boolean)

    // Prefer longest names as the master (more descriptive)
    const sorted = [...rawNames].sort((a, b) => b.length - a.length)

    const canonicals: string[] = []
    const rawToCanonical = new Map<string, string>()

    for (const raw of sorted) {
        const titleCased = toTitleCase(raw)

        if (canonicals.length === 0) {
            canonicals.push(titleCased)
            rawToCanonical.set(raw, titleCased)
            continue
        }

        const fuse = new Fuse(canonicals, {
            includeScore: true,
            threshold: 0.25,
            isCaseSensitive: false,
        })

        const results = fuse.search(titleCased)
        const best = results[0]

        if (best && best.score !== undefined && best.score < 0.25) {
            // Close enough → map to existing canonical
            rawToCanonical.set(raw, best.item)
        } else {
            // New canonical
            canonicals.push(titleCased)
            rawToCanonical.set(raw, titleCased)
        }
    }

    // Always handle the empty / unknown fallback
    rawToCanonical.set("", "Unknown")

    return rawToCanonical
}

/**
 * Convenience: normalise a single manufacture name using a pre-built map.
 * Falls back to Title Case if the raw name is not in the map.
 */
export function normalizeManufacture(
    raw: string | null | undefined,
    map: Map<string, string>,
): string {
    const trimmed = (raw ?? "").trim()
    return map.get(trimmed) ?? toTitleCase(trimmed) || "Unknown"
}
