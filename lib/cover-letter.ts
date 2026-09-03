import { normalizeCodeValue } from "@/lib/formatters"

export function buildCoverLetterItemKey(poNo: string | null | undefined, noInvSap: string | null | undefined): string {
    const normalizedPoNo = (poNo || "").trim().toUpperCase()
    const normalizedInvoice = (normalizeCodeValue(noInvSap) || "").trim().toUpperCase()
    return `${normalizedPoNo}::${normalizedInvoice}`
}

export function sortCoverLetterItems<T extends { noInvSap?: string | null }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
        const invA = normalizeCodeValue(a.noInvSap) || ""
        const invB = normalizeCodeValue(b.noInvSap) || ""
        return invA.localeCompare(invB, undefined, { numeric: true, sensitivity: "base" })
    })
}
