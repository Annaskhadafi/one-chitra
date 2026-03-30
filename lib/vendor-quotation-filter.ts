type VendorQuotationYearSource = {
    quoteDate?: string | null
    quoteNumber?: string | null
    fileName?: string | null
    fileUrl?: string | null
}

function hasYearToken(value: string | null | undefined, year: number) {
    if (!value) return false
    return new RegExp(`(?:^|[^\\d])${year}(?:[^\\d]|$)`).test(value)
}

function tryExtractYearFromDate(value: string | null | undefined) {
    if (!value) return null

    const normalized = value.trim()
    if (!normalized) return null

    const isoMatch = normalized.match(/^(\d{4})[-/]/)
    if (isoMatch) {
        return Number(isoMatch[1])
    }

    const trailingYearMatch = normalized.match(/(?:^|[^\\d])(\d{4})(?:[^\\d]|$)/)
    if (trailingYearMatch) {
        return Number(trailingYearMatch[1])
    }

    return null
}

export function isVendorQuotationFromYear(record: VendorQuotationYearSource, year: number) {
    const explicitYear = tryExtractYearFromDate(record.quoteDate)
    if (explicitYear !== null) {
        return explicitYear === year
    }

    return (
        hasYearToken(record.quoteNumber, year) ||
        hasYearToken(record.fileName, year) ||
        hasYearToken(record.fileUrl, year)
    )
}

export function isVendorQuotationFrom2026(record: VendorQuotationYearSource) {
    return isVendorQuotationFromYear(record, 2026)
}
