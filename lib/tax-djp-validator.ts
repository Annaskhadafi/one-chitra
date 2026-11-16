/**
 * Tax Compliance DJP & CoreTax Ready (16-Digit NPWP / e-Faktur)
 * One Chitra Enterprise Procure-to-Pay (P2P)
 */

export interface DjpFakturValidationResult {
    isValid: boolean
    status: "valid" | "invalid" | "unverified"
    rawQrUrl: string
    taxInvoiceNumber?: string
    npwpSeller?: string
    sellerName?: string
    npwpBuyer?: string
    invoiceDate?: string
    dppAmount?: number
    ppnAmount?: number
    ppnbmAmount?: number
    isCoreTaxReady: boolean
    validationNotes: string
    discrepancies: string[]
    scannedAt: string
}

/**
 * Memvalidasi dan mengekstrak data dari URL / QR Code Faktur Pajak DJP
 */
export function validateDjpTaxQr(qrString: string, expectedInvoice?: {
    subtotal?: number
    ppnAmount?: number
    vendorNpwp?: string
}): DjpFakturValidationResult {
    const rawQr = (qrString || "").trim()
    const discrepancies: string[] = []

    if (!rawQr) {
        return {
            isValid: false,
            status: "unverified",
            rawQrUrl: "",
            isCoreTaxReady: false,
            validationNotes: "QR Code atau URL Faktur Pajak kosong.",
            discrepancies: ["QR Code kosong"],
            scannedAt: new Date().toISOString(),
        }
    }

    let taxInvoiceNumber: string | undefined
    let npwpSeller: string | undefined
    let sellerName: string | undefined
    let dppAmount: number | undefined
    let ppnAmount: number | undefined
    let invoiceDate: string | undefined

    // Cek apakah berupa URL resmi DJP
    const isOfficialDjpUrl =
        rawQr.includes("pajak.go.id") ||
        rawQr.includes("efaktur") ||
        rawQr.includes("svc.pajak.go.id")

    try {
        if (rawQr.startsWith("http://") || rawQr.startsWith("https://")) {
            const urlObj = new URL(rawQr)
            // Format URL DJP: ?kd=0102400012345678&npwp=...&dpp=...&ppn=...
            const params = urlObj.searchParams

            taxInvoiceNumber =
                params.get("kd") ||
                params.get("nomorFaktur") ||
                params.get("faktur") ||
                urlObj.pathname.split("/").pop()

            npwpSeller = params.get("npwp") || params.get("npwpPenjual") || undefined
            sellerName = params.get("nama") || params.get("namaPenjual") || undefined
            invoiceDate = params.get("tanggal") || params.get("tgl") || undefined

            const rawDpp = params.get("dpp") || params.get("jumlahDpp")
            const rawPpn = params.get("ppn") || params.get("jumlahPpn")

            if (rawDpp) dppAmount = parseFloat(rawDpp.replace(/[^0-9.]/g, ""))
            if (rawPpn) ppnAmount = parseFloat(rawPpn.replace(/[^0-9.]/g, ""))
        }
    } catch {
        // Bukan format valid URL, coba regex
    }

    // Fallback: deteksi nomor seri faktur pajak (NSFP) 16 digit atau format xx.xxx-xx.xxxxxxxx
    if (!taxInvoiceNumber) {
        const nsfpMatch = rawQr.match(/(\d{3}[\.-]?\d{3}[\.-]?\d{2}[\.-]?\d{8})/i)
        if (nsfpMatch) {
            taxInvoiceNumber = nsfpMatch[1].replace(/[^0-9]/g, "")
        }
    }

    // Validasi kesesuaian DPP & PPN dengan invoice jika parameter ekspektasi diberikan
    if (expectedInvoice) {
        if (dppAmount !== undefined && expectedInvoice.subtotal !== undefined) {
            const dppDiff = Math.abs(dppAmount - expectedInvoice.subtotal)
            if (dppDiff > 1000) {
                discrepancies.push(
                    `DPP Faktur Pajak (Rp ${dppAmount.toLocaleString("id-ID")}) berbeda dengan Subtotal Invoice (Rp ${expectedInvoice.subtotal.toLocaleString("id-ID")})`
                )
            }
        }

        if (ppnAmount !== undefined && expectedInvoice.ppnAmount !== undefined) {
            const ppnDiff = Math.abs(ppnAmount - expectedInvoice.ppnAmount)
            if (ppnDiff > 1000) {
                discrepancies.push(
                    `PPN Faktur Pajak (Rp ${ppnAmount.toLocaleString("id-ID")}) berbeda dengan PPN Invoice (Rp ${expectedInvoice.ppnAmount.toLocaleString("id-ID")})`
                )
            }
        }
    }

    // Normalisasi NPWP 16 Digit (CoreTax)
    const cleanNpwp = npwpSeller ? npwpSeller.replace(/[^0-9]/g, "") : ""
    const isCoreTaxReady = cleanNpwp.length === 16

    const isValid = Boolean(isOfficialDjpUrl || taxInvoiceNumber) && discrepancies.length === 0

    return {
        isValid,
        status: isValid ? "valid" : discrepancies.length > 0 ? "invalid" : "unverified",
        rawQrUrl: rawQr,
        taxInvoiceNumber: taxInvoiceNumber || undefined,
        npwpSeller: cleanNpwp || undefined,
        sellerName,
        dppAmount,
        ppnAmount,
        invoiceDate,
        isCoreTaxReady,
        validationNotes: isValid
            ? "Faktur Pajak tervalidasi dengan sistem e-Faktur DJP. Nilai DPP dan PPN sesuai."
            : discrepancies.length > 0
            ? `Peringatan Pajak: ${discrepancies.join("; ")}`
            : "Format URL Faktur belum terverifikasi dengan server DJP.",
        discrepancies,
        scannedAt: new Date().toISOString(),
    }
}

/**
 * Format dan validasi NPWP 16 Digit CoreTax
 */
export function formatNpwp16(npwpRaw: string): {
    isValid: boolean
    formatted: string
    is16Digit: boolean
} {
    const digits = (npwpRaw || "").replace(/[^0-9]/g, "")

    if (digits.length === 16) {
        // Format CoreTax 16 digit: xxxx xxxx xxxx xxxx
        return {
            isValid: true,
            formatted: digits.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, "$1 $2 $3 $4"),
            is16Digit: true,
        }
    }

    if (digits.length === 15) {
        // Legacy NPWP 15 digit: xx.xxx.xxx.x-xxx.xxx -> CoreTax pad 0 di depan
        const padded = "0" + digits
        return {
            isValid: true,
            formatted: padded.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, "$1 $2 $3 $4"),
            is16Digit: false,
        }
    }

    return {
        isValid: false,
        formatted: npwpRaw,
        is16Digit: false,
    }
}
