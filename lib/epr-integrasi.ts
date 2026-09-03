export const EPR_VIEW_ID = "2354"
export const EPR_VIEW_URL = `https://proc-share.com/wp-json/gravityview/v1/views/${EPR_VIEW_ID}`
export const EPR_ENTRIES_URL = `https://proc-share.com/wp-json/gravityview/v1/views/${EPR_VIEW_ID}/entries.json?limit=0`
export const EPR_REVALIDATE_SECONDS = 300

export const EPR_COLUMN_ORDER = ["18", "1", "50", "27", "22", "23", "38", "40", "41"] as const
export type EprColumnId = (typeof EPR_COLUMN_ORDER)[number]
export type EprEntryValues = Partial<Record<EprColumnId, string | string[]>>

type ViewPayload = {
    fields?: {
        "directory_table-columns"?: Record<string, { id: string; label: string }>
    }
}

type EntriesPayload = { entries?: EprEntryValues[] }

export type EprIntegrationEntry = {
    id: string
    values: EprEntryValues
}

function firstString(value: unknown) {
    if (Array.isArray(value)) return String(value[0] ?? "").trim()
    return String(value ?? "").trim()
}

async function fetchJsonWithNestedString<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        next: { revalidate: EPR_REVALIDATE_SECONDS },
        headers: { Accept: "application/json" },
    })
    if (!response.ok) throw new Error(`EPR request failed with status ${response.status}`)

    const parsed = JSON.parse(await response.text()) as T | string
    if (typeof parsed !== "string") return parsed
    return JSON.parse(parsed) as T
}

function extractRawDateValue(value: unknown) {
    return firstString(value)
}

function isDateRequiredFrom2026(value: unknown) {
    const date = new Date(extractRawDateValue(value))
    return !Number.isNaN(date.getTime()) && date >= new Date("2026-01-01T00:00:00+08:00")
}

export function getEprPrNumber(values: EprEntryValues) {
    return firstString(values["18"])
}

export function getEprVendorPoNumber(values: EprEntryValues) {
    return firstString(values["38"])
}

export function getEprStatus(values: EprEntryValues) {
    return firstString(values["41"])
}

export async function fetchEprIntegrationSnapshot() {
    const [viewPayload, entriesPayload] = await Promise.all([
        fetchJsonWithNestedString<ViewPayload>(EPR_VIEW_URL),
        fetchJsonWithNestedString<EntriesPayload>(EPR_ENTRIES_URL),
    ])

    const directoryColumns = viewPayload.fields?.["directory_table-columns"] ?? {}
    const columns = EPR_COLUMN_ORDER.map((id) => ({
        id,
        label: Object.values(directoryColumns).find((column) => column.id === id)?.label ?? `Field ${id}`,
    }))

    const entries: EprIntegrationEntry[] = (entriesPayload.entries ?? [])
        .filter((entry) => isDateRequiredFrom2026(entry["1"]))
        .sort((left, right) => new Date(extractRawDateValue(right["1"])).getTime() - new Date(extractRawDateValue(left["1"])).getTime())
        .map((values, index) => ({
            id: `${getEprPrNumber(values) || "entry"}-${index}`,
            values,
        }))

    return { columns, entries }
}
