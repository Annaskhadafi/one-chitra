export const DEFAULT_QUOTATION_TERMS = [
    "Payment Terms : 30 days after Date Invoice",
    "Stock :",
    "DDP :",
    "Exclude Tax",
    "",
    "PT. CHITRA PARATAMA",
    "BANK MANDIRI",
    "Branch Cilandak KKO, Jakarta Selatan 12560",
    "IDR A/C NO:127 – 000 – 00 – 17416",
].join("\n")

export function normalizeQuotationText(value: string | null | undefined) {
    return value
        ?.replace(/â€“/g, "–")
        .replace(/â€”/g, "—")
        .replace(/â€˜/g, "‘")
        .replace(/â€™/g, "’")
        .replace(/â€œ/g, "“")
        .replace(/â€/g, "”")
        .replace(/IDR A\/C NO:\s*127\s*[–—-]\s*000\s*[–—-]\s*00\s*[–—-]\s*17416/g, "IDR A/C NO:127 – 000 – 00 – 17416")
}
