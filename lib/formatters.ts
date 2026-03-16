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
