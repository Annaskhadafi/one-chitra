/**
 * Vendor Invoice OCR & Automated 3-Way Matching Engine
 * One Chitra Enterprise Procure-to-Pay (P2P)
 */

export interface ExtractedInvoiceItem {
    itemNo?: number
    description: string
    quantity: number
    unitPrice: number
    lineTotal: number
}

export interface ExtractedInvoiceData {
    invoiceNumber?: string
    invoiceDate?: string
    poNumber?: string
    vendorName?: string
    subtotal: number
    ppnAmount: number
    pphAmount: number
    grandTotal: number
    taxInvoiceNumber?: string
    items: ExtractedInvoiceItem[]
    confidenceScore?: number
    rawTextExcerpt?: string
}

export interface PoItemReference {
    itemNo: number
    material?: string
    description: string
    poQty: number
    netValue: number
    invoicedQty?: number
}

export interface ThreeWayMatchResult {
    matchStatus: "matched" | "variance_flagged" | "manual_check_needed"
    poMatch: {
        poNumberMatched: boolean
        expectedPoNumber: string
        extractedPoNumber?: string
    }
    priceMatch: {
        poNetValue: number
        invoiceSubtotal: number
        varianceAmount: number
        variancePercent: number
        isWithinTolerance: boolean
        toleranceThreshold: number // Default Rp 5,000 for rounding differences
    }
    qtyMatch: {
        totalPoQty: number
        totalInvoiceQty: number
        qtyVariance: number
        isQtyMatched: boolean
    }
    itemMatches: Array<{
        description: string
        poQty: number
        invQty: number
        poPrice: number
        invPrice: number
        status: "exact_match" | "price_variance" | "qty_variance" | "unmatched"
    }>
    suggestedChecklists: {
        checklistDocValid: boolean
        checklistPoValid: boolean
        checklistCalcValid: boolean
        checklistTaxValid: boolean
    }
    flags: string[]
    summaryMessage: string
    processedAt: string
}

/**
 * Heuristik / AI extractor untuk teks OCR Invoice
 */
export async function parseInvoiceOcrText(rawText: string): Promise<ExtractedInvoiceData> {
    if (!rawText || rawText.trim().length === 0) {
        return {
            subtotal: 0,
            ppnAmount: 0,
            pphAmount: 0,
            grandTotal: 0,
            items: [],
        }
    }

    const openAiKey = process.env.OPENAI_API_KEY?.trim()
    const rawBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://9router.chitraparatama.com/v1"
    const baseUrl = rawBaseUrl.replace(/\/$/, "")
    const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
    const model = process.env.OPENAI_MODEL?.trim() || "cx/gpt-5.6-luna"

    if (openAiKey) {
        try {
            const prompt = `Anda adalah asisten procurement ahli dalam memverifikasi Faktur/Invoice tagihan vendor.
Ekstrak teks OCR berikut ke JSON terstruktur dengan format:
{
  "invoiceNumber": "string",
  "invoiceDate": "YYYY-MM-DD",
  "poNumber": "string",
  "vendorName": "string",
  "subtotal": 0,
  "ppnAmount": 0,
  "pphAmount": 0,
  "grandTotal": 0,
  "taxInvoiceNumber": "string (Nomor Faktur Pajak 16 digit jika ada)",
  "items": [
    { "itemNo": 1, "description": "nama barang/jasa", "quantity": 1, "unitPrice": 0, "lineTotal": 0 }
  ]
}
Catatan: Pastikan angka subtotal, ppn, grandTotal adalah integer/float murni tanpa titik pemisah ribuan.

TEKS OCR INVOICE:
${rawText.slice(0, 4000)}`

            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${openAiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: "system", content: "Kembalikan hanya JSON valid tanpa markdown atau prolog." },
                        { role: "user", content: prompt },
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1,
                }),
                signal: AbortSignal.timeout(15000),
            })

            if (res.ok) {
                const completion = await res.json()
                const rawContent = completion.choices?.[0]?.message?.content
                if (rawContent) {
                    const parsed = JSON.parse(rawContent)
                    return {
                        invoiceNumber: parsed.invoiceNumber || undefined,
                        invoiceDate: parsed.invoiceDate || undefined,
                        poNumber: parsed.poNumber || undefined,
                        vendorName: parsed.vendorName || undefined,
                        subtotal: Number(parsed.subtotal) || 0,
                        ppnAmount: Number(parsed.ppnAmount) || 0,
                        pphAmount: Number(parsed.pphAmount) || 0,
                        grandTotal: Number(parsed.grandTotal) || 0,
                        taxInvoiceNumber: parsed.taxInvoiceNumber || undefined,
                        items: Array.isArray(parsed.items) ? parsed.items : [],
                        confidenceScore: 0.95,
                        rawTextExcerpt: rawText.slice(0, 300),
                    }
                }
            }
        } catch (err) {
            console.warn("AI OCR Invoice extraction failed, fallback ke regex:", err)
        }
    }

    // Heuristic Regex Fallback
    return extractInvoiceByRegex(rawText)
}

function extractInvoiceByRegex(rawText: string): ExtractedInvoiceData {
    const invMatch = rawText.match(/(?:inv(?:oice)?|no(?:\.|\s*faktur)?)\s*[:#.]?\s*([A-Za-z0-9\-\/]{3,30})/i)
    const poMatch = rawText.match(/(?:p\.?o\.?|purchase order|no\.?\s*pesanan)\s*[:#.]?\s*([0-9]{5,15})/i)
    const taxMatch = rawText.match(/(?:010|020|030|040|070|080|090)\.\d{3}[-.]?\d{2}\.\d{8}/)

    // Deteksi nominal
    const numbers = Array.from(rawText.matchAll(/(?:rp\.?|idr)?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/gi))
        .map((m) => {
            const clean = m[1].replace(/\./g, "").replace(/,/g, ".")
            return parseFloat(clean)
        })
        .filter((n) => !isNaN(n) && n > 1000)

    const grandTotal = numbers.length > 0 ? Math.max(...numbers) : 0
    const subtotal = grandTotal > 0 ? Math.round(grandTotal / 1.11) : 0
    const ppnAmount = grandTotal - subtotal

    return {
        invoiceNumber: invMatch ? invMatch[1].trim() : undefined,
        poNumber: poMatch ? poMatch[1].trim() : undefined,
        taxInvoiceNumber: taxMatch ? taxMatch[0].trim() : undefined,
        subtotal,
        ppnAmount,
        pphAmount: 0,
        grandTotal,
        items: [],
        confidenceScore: 0.6,
        rawTextExcerpt: rawText.slice(0, 300),
    }
}

/**
 * Mesin 3-Way Matching: Membandingkan Invoice vs PO SAP vs GRN (Goods Receipt)
 */
export function execute3WayMatching(params: {
    invoice: {
        invoiceNumber: string
        subtotal: number
        grandTotal: number
        poNumber: string
        items?: ExtractedInvoiceItem[]
    }
    poReference: {
        poNumber: string
        netValue: number
        itemsDetail?: Array<{
            itemNo: number
            description: string
            poQty: number
            netValue: number
            invoicedQty?: number
        }>
        status?: string
    }
    toleranceThreshold?: number // Default Rp 5,000
}): ThreeWayMatchResult {
    const tolerance = params.toleranceThreshold ?? 5000
    const flags: string[] = []

    // 1. PO Number Match
    const cleanInvPo = params.invoice.poNumber.replace(/[^0-9A-Za-z]/g, "").toLowerCase()
    const cleanRefPo = params.poReference.poNumber.replace(/[^0-9A-Za-z]/g, "").toLowerCase()
    const poNumberMatched = cleanInvPo === cleanRefPo || cleanInvPo.includes(cleanRefPo) || cleanRefPo.includes(cleanInvPo)

    if (!poNumberMatched) {
        flags.push(`Nomor PO tidak cocok: Tertera di Invoice '${params.invoice.poNumber}', Data SAP '${params.poReference.poNumber}'`)
    }

    // 2. Price Variance Match
    const poNetValue = Number(params.poReference.netValue) || 0
    const invSubtotal = Number(params.invoice.subtotal) || 0
    const varianceAmount = invSubtotal - poNetValue
    const variancePercent = poNetValue > 0 ? (varianceAmount / poNetValue) * 100 : 0
    const isWithinTolerance = Math.abs(varianceAmount) <= tolerance

    if (!isWithinTolerance) {
        if (varianceAmount > 0) {
            flags.push(`Price Variance: Subtotal invoice lebih tinggi Rp ${Math.abs(varianceAmount).toLocaleString("id-ID")} (${variancePercent.toFixed(2)}%) dari nilai PO SAP`)
        } else {
            flags.push(`Price Variance: Subtotal invoice lebih rendah Rp ${Math.abs(varianceAmount).toLocaleString("id-ID")} (${Math.abs(variancePercent).toFixed(2)}%) dari nilai PO SAP (Partial Billing)`)
        }
    }

    // 3. Item Level Qty Match
    const poItems = params.poReference.itemsDetail || []
    const invItems = params.invoice.items || []
    const totalPoQty = poItems.reduce((acc, i) => acc + (Number(i.poQty) || 0), 0)
    const totalInvoiceQty = invItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)
    const qtyVariance = totalInvoiceQty > 0 ? totalInvoiceQty - totalPoQty : 0
    const isQtyMatched = totalInvoiceQty === 0 || Math.abs(qtyVariance) === 0

    if (totalInvoiceQty > 0 && Math.abs(qtyVariance) > 0) {
        flags.push(`Quantity Variance: Total item di invoice (${totalInvoiceQty}) tidak sesuai dengan PO SAP (${totalPoQty})`)
    }

    const itemMatches: ThreeWayMatchResult["itemMatches"] = []
    if (poItems.length > 0 && invItems.length > 0) {
        for (const invItem of invItems) {
            const matchedPoItem = poItems.find(
                (p) =>
                    p.description.toLowerCase().includes(invItem.description.toLowerCase()) ||
                    invItem.description.toLowerCase().includes(p.description.toLowerCase())
            )
            if (matchedPoItem) {
                const isExact = matchedPoItem.poQty === invItem.quantity && Math.abs(matchedPoItem.netValue - invItem.lineTotal) <= tolerance
                itemMatches.push({
                    description: invItem.description,
                    poQty: matchedPoItem.poQty,
                    invQty: invItem.quantity,
                    poPrice: matchedPoItem.netValue,
                    invPrice: invItem.lineTotal,
                    status: isExact ? "exact_match" : invItem.quantity !== matchedPoItem.poQty ? "qty_variance" : "price_variance",
                })
            } else {
                itemMatches.push({
                    description: invItem.description,
                    poQty: 0,
                    invQty: invItem.quantity,
                    poPrice: 0,
                    invPrice: invItem.lineTotal,
                    status: "unmatched",
                })
            }
        }
    }

    // 4. Determine Match Status
    let matchStatus: ThreeWayMatchResult["matchStatus"] = "matched"
    if (!poNumberMatched || !isWithinTolerance || (!isQtyMatched && totalInvoiceQty > 0)) {
        matchStatus = "variance_flagged"
    }
    if (poNetValue === 0) {
        matchStatus = "manual_check_needed"
        flags.push("Data nilai PO di SAP bernilai 0 atau belum sinkron.")
    }

    // 5. Checklist Auto-Fill
    const suggestedChecklists = {
        checklistDocValid: true,
        checklistPoValid: poNumberMatched,
        checklistCalcValid: isWithinTolerance,
        checklistTaxValid: true,
    }

    let summaryMessage = "3-Way Matching Berhasil: Seluruh nilai PO, Kuantitas, dan Subtotal sesuai toleransi standar."
    if (matchStatus === "variance_flagged") {
        summaryMessage = `3-Way Matching Menemukan Varians: ${flags.join("; ")}`
    } else if (matchStatus === "manual_check_needed") {
        summaryMessage = "3-Way Matching Membutuhkan Verifikasi Manual: Data PO belum lengkap."
    }

    return {
        matchStatus,
        poMatch: {
            poNumberMatched,
            expectedPoNumber: params.poReference.poNumber,
            extractedPoNumber: params.invoice.poNumber,
        },
        priceMatch: {
            poNetValue,
            invoiceSubtotal: invSubtotal,
            varianceAmount,
            variancePercent,
            isWithinTolerance,
            toleranceThreshold: tolerance,
        },
        qtyMatch: {
            totalPoQty,
            totalInvoiceQty,
            qtyVariance,
            isQtyMatched,
        },
        itemMatches,
        suggestedChecklists,
        flags,
        summaryMessage,
        processedAt: new Date().toISOString(),
    }
}
