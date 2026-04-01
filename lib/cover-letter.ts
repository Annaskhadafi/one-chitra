import { normalizeCodeValue } from "@/lib/formatters"

export function buildCoverLetterItemKey(poNo: string | null | undefined, noInvSap: string | null | undefined): string {
    const normalizedPoNo = (poNo || "").trim().toUpperCase()
    const normalizedInvoice = (normalizeCodeValue(noInvSap) || "").trim().toUpperCase()
    return `${normalizedPoNo}::${normalizedInvoice}`
}
