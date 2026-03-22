/**
 * Shared formatting utilities safe for both Server and Client components.
 */

export function formatCurrency(val: number): string {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}B`
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`
    return `Rp ${val.toLocaleString("id-ID")}`
}

export function formatNumber(val: number): string {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
    return val.toLocaleString("id-ID")
}

export function formatPercentage(val: number): string {
    return `${val.toFixed(1)}%`
}

function stripTrailingZeroDecimalToken(token: string): string {
    const trimmed = token.trim()
    if (/^-?\d+[.,]0+$/.test(trimmed)) {
        return trimmed.replace(/[.,]0+$/, "")
    }
    return trimmed
}

/**
 * Normalize identifier-like values from SAP/Excel that may come as "12345.0".
 * Keeps non-zero decimals intact and supports multi values delimited by "|".
 */
export function normalizeCodeValue(value: string | number | null | undefined): string | null {
    if (value === null || value === undefined) return null
    const raw = String(value).trim()
    if (!raw) return null

    if (!raw.includes("|")) {
        const normalized = stripTrailingZeroDecimalToken(raw)
        return normalized || null
    }

    const normalizedParts = raw
        .split("|")
        .map(stripTrailingZeroDecimalToken)
        .filter(Boolean)

    if (normalizedParts.length === 0) return null
    return normalizedParts.join("|")
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object") return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

const sapDocumentFieldNames = new Set(["noInvSap", "nomorDoSap", "doSap", "invoiceNumber"])

export function normalizeSapDocumentFields<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeSapDocumentFields(item)) as T
    }

    if (!isPlainObject(value)) {
        return value
    }

    const entries = Object.entries(value).map(([key, fieldValue]) => {
        if (sapDocumentFieldNames.has(key) && (typeof fieldValue === "string" || typeof fieldValue === "number")) {
            return [key, normalizeCodeValue(fieldValue)]
        }

        return [key, normalizeSapDocumentFields(fieldValue)]
    })

    return Object.fromEntries(entries) as T
}
