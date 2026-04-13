import { normalizeCodeValue } from "@/lib/formatters"

export function buildBillingRecordKey(
    poNo: string | null | undefined,
    noInvSap: string | null | undefined,
    dateInvoice?: string | Date | null,
) {
    const normalizedPoNo = (poNo || "").trim().toUpperCase()
    const normalizedInvoice = (normalizeCodeValue(noInvSap) || "").trim().toUpperCase() || "NOINV"
    const normalizedDate =
        dateInvoice instanceof Date
            ? dateInvoice.toISOString()
            : typeof dateInvoice === "string"
                ? dateInvoice.trim()
                : ""

    return `${normalizedPoNo}::${normalizedInvoice}::${normalizedDate}`
}
