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
