import { ExtractedSOData, ExtractedVendorQuotation } from "./ai-document-structurer"

// Kamus Alias untuk Kolom Tabel
const COLUMN_ALIASES = {
    item: [
        "item description",
        "description",
        "item_description",
        "material description",
        "deskripsi",
        "nama barang",
        "nama item",
        "nama produk",
        "nama barang / uraian",
        "uraian",
        "product",
        "item",
        "goods description",
        "item name",
        "part name",
    ],
    code: [
        "part number",
        "part no",
        "part-no",
        "part_no",
        "part#",
        "kode barang",
        "material no",
        "material number",
        "item code",
        "code",
        "no part",
        "no. part",
        "part code",
    ],
    qty: [
        "qty",
        "quantity",
        "jumlah",
        "vol",
        "volume",
        "banyaknya",
        "kuantitas",
        "order qty",
        "jml",
        "order quantity",
        "total qty",
    ],
    unit: [
        "unit",
        "uom",
        "satuan",
        "sat",
        "sat.",
        "u/m",
    ],
    unit_price: [
        "unit price",
        "harga satuan",
        "harga/satuan",
        "harga / satuan",
        "price",
        "harga/unit",
        "rate",
        "harga per unit",
        "unit rate",
        "harga",
        "price/unit",
        "unit price (idr)",
        "unit price (rp)",
        "harga (idr)",
        "harga (rp)",
    ],
    total_price: [
        "total",
        "amount",
        "total price",
        "jumlah harga",
        "subtotal",
        "ext. price",
        "total amount",
        "total harga",
        "total idr",
        "total (idr)",
        "total (rp)",
        "extended price",
        "line total",
    ],
    remark: [
        "remark",
        "remarks",
        "keterangan",
        "notes",
        "catatan",
        "ket",
        "ket.",
    ],
}

type ColumnRole = keyof typeof COLUMN_ALIASES

/**
 * Mengidentifikasi peran kolom dari header tabel
 */
function identifyColumnRole(headerText: string): ColumnRole | null {
    const cleaned = headerText.toLowerCase().replace(/[*_~`]/g, "").trim()
    if (!cleaned) return null

    // Exact or contains match in alias dictionary
    for (const [role, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of aliases) {
            if (cleaned === alias || cleaned.includes(alias)) {
                return role as ColumnRole
            }
        }
    }

    return null
}

/**
 * Membersihkan angka dari string (menghapus IDR, Rp, koma, spasi)
 */
function parseNumericValue(valueStr: string): number {
    if (!valueStr) return 0
    let sanitized = valueStr
        .replace(/^(?:idr|rp\.?|usd|\$)\s*/i, "")
        .replace(/[*_~`]/g, "")
        .trim()

    // Format Indonesia: 150.000.000,00 atau Format Standar: 150,000,000.00
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(sanitized)) {
        // format 150.000.000 atau 150.000.000,50
        sanitized = sanitized.replace(/\./g, "").replace(",", ".")
    } else {
        // format 150,000,000.00
        sanitized = sanitized.replace(/,/g, "")
    }

    const num = parseFloat(sanitized)
    return Number.isFinite(num) ? num : 0
}

/**
 * Mengekstrak tabel Markdown menjadi baris data
 */
export function parseMarkdownTables(markdown: string): Array<{
    headers: string[]
    columnMap: Record<number, ColumnRole>
    rows: Array<Record<ColumnRole, string>>
}> {
    const tables: Array<{
        headers: string[]
        columnMap: Record<number, ColumnRole>
        rows: Array<Record<ColumnRole, string>>
    }> = []

    const lines = markdown.split(/\r?\n/)
    let inTable = false
    let currentHeaders: string[] = []
    let currentColumnMap: Record<number, ColumnRole> = {}
    let currentRows: Array<Record<ColumnRole, string>> = []

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // Baris tabel markdown dimulai dan diakhiri dengan | atau mengandung minimal 2 tanda |
        if (line.startsWith("|") && line.endsWith("|")) {
            const cells = line
                .slice(1, -1)
                .split("|")
                .map((c) => c.trim())

            // Cek apakah ini baris pemisah |---|---|
            const isSeparator = cells.every((c) => /^:?-+:?$/.test(c))

            if (isSeparator && !inTable && currentHeaders.length > 0) {
                // Header sudah didapat di baris sebelumnya
                inTable = true
                continue
            }

            if (!inTable) {
                // Kemungkinan header baru
                currentHeaders = cells
                currentColumnMap = {}
                cells.forEach((header, index) => {
                    const role = identifyColumnRole(header)
                    if (role) {
                        currentColumnMap[index] = role
                    }
                })
                currentRows = []
            } else {
                // Baris data tabel
                const rowData: Record<string, string> = {}
                cells.forEach((cell, index) => {
                    const role = currentColumnMap[index]
                    if (role) {
                        rowData[role] = cell.replace(/[*_~`]/g, "").trim()
                    }
                })

                if (Object.keys(rowData).length > 0) {
                    currentRows.push(rowData as Record<ColumnRole, string>)
                }
            }
        } else {
            if (inTable && currentRows.length > 0) {
                tables.push({
                    headers: currentHeaders,
                    columnMap: currentColumnMap,
                    rows: currentRows,
                })
            }
            inTable = false
            currentHeaders = []
            currentColumnMap = {}
            currentRows = []
        }
    }

    if (inTable && currentRows.length > 0) {
        tables.push({
            headers: currentHeaders,
            columnMap: currentColumnMap,
            rows: currentRows,
        })
    }

    return tables
}

/**
 * Anchor Regex: Ekstraksi Nomor PO
 */
export function extractPoNumber(text: string): string | null {
    const patterns = [
        /(?:purchase\s*order|po)\s*(?:number|no|#)?\s*[:.]?\s*([A-Z0-9\-_/]{4,35})/i,
        /(?:order\s*no|nomor\s*po|no\.?\s*pesanan)\s*[:.]?\s*([A-Z0-9\-_/]{4,35})/i,
        /\b(PO[-/][A-Z0-9\-_/]{4,30})\b/i,
    ]

    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
            const cleaned = match[1].replace(/[*_~`]/g, "").trim()
            if (cleaned.length >= 4 && !/^(number|date|tanggal|customer)$/i.test(cleaned)) {
                return cleaned
            }
        }
    }

    return null
}

/**
 * Anchor Regex: Ekstraksi Nomor Quotation
 */
export function extractQuotationNumber(text: string): string | null {
    const patterns = [
        /(?:quotation|quote|penawaran)\s*(?:number|no|#)?\s*[:.]?\s*([A-Z0-9\-_/]{4,35})/i,
        /(?:no\.?\s*penawaran|quo\s*no|ref\s*no)\s*[:.]?\s*([A-Z0-9\-_/]{4,35})/i,
        /\b(QUO[-/][A-Z0-9\-_/]{4,30})\b/i,
        /\b(QTN[-/][A-Z0-9\-_/]{4,30})\b/i,
    ]

    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
            const cleaned = match[1].replace(/[*_~`]/g, "").trim()
            if (cleaned.length >= 4 && !/^(number|date|tanggal|vendor)$/i.test(cleaned)) {
                return cleaned
            }
        }
    }

    return null
}

/**
 * Anchor Regex: Ekstraksi Tanggal Dokumen
 */
export function extractDocumentDate(text: string): string | null {
    const patterns = [
        // ISO YYYY-MM-DD
        /(?:date|tanggal|tgl|doc\.?\s*date)\s*[:.]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i,
        // DD/MM/YYYY atau DD-MM-YYYY
        /(?:date|tanggal|tgl|doc\.?\s*date)\s*[:.]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i,
        // Format Teks: 14 Agustus 2026 atau 14 Aug 2026
        /(?:date|tanggal|tgl)?\s*[:.]?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)[a-z]*\s+\d{4})/i,
    ]

    const monthMap: Record<string, string> = {
        jan: "01", januari: "01", january: "01",
        feb: "02", februari: "02", february: "02",
        mar: "03", maret: "03", march: "03",
        apr: "04", april: "04",
        may: "05", mei: "05",
        jun: "06", juni: "06", june: "06",
        jul: "07", juli: "07", july: "07",
        aug: "08", agustus: "08", august: "08",
        sep: "09", september: "09",
        oct: "10", oktober: "10", october: "10",
        nov: "11", november: "11",
        dec: "12", desember: "12", december: "12",
    }

    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
            const raw = match[1].trim()
            // Jika format YYYY-MM-DD
            if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(raw)) {
                const parts = raw.split(/[-/.]/)
                return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
            }
            // Jika format DD-MM-YYYY
            if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(raw)) {
                const parts = raw.split(/[-/.]/)
                return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
            }
            // Jika format teks "14 Agustus 2026"
            const textMatch = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
            if (textMatch) {
                const day = textMatch[1].padStart(2, "0")
                const mKey = textMatch[2].toLowerCase().slice(0, 3)
                const month = monthMap[mKey] || "01"
                const year = textMatch[3]
                return `${year}-${month}-${day}`
            }
            return raw
        }
    }

    return null
}

/**
 * Ekstraksi Nama Customer (Buyer) dari Header Dokumen
 */
export function extractCustomerName(text: string): string | null {
    const patterns = [
        /(?:customer|buyer|pembeli|kepada|to|bill\s*to|sold\s*to)\s*[:.]?\s*(PT\.?\s+[A-Z0-9\s.,&-]{3,50})/i,
        /\b(PT\.?\s+(?:HASNUR|CITRA\s*KRIDA|PAMAPERSADA|BUKIT\s*MAKMUR|BERAU\s*COAL|KIDECO|ADARO|UNITED\s*TRACTORS)[A-Z0-9\s.,&-]*)/i,
        /^(?:#+\s*)?(PT\.?\s+[A-Z0-9\s.,&-]{3,50})/im,
    ]

    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
            const cleaned = match[1].replace(/[*_~`]/g, "").trim()
            if (cleaned.length >= 4) {
                return cleaned
            }
        }
    }

    return null
}

/**
 * Ekstraksi Nama Vendor (Supplier) dari Header Dokumen Quotation
 */
export function extractVendorName(text: string): string | null {
    const patterns = [
        /(?:vendor|supplier|from|dari|pemberi\s*penawaran)\s*[:.]?\s*(PT\.?\s+[A-Z0-9\s.,&-]{3,50})/i,
        /\b(PT\.?\s+(?:TRIANGLE|BRIDGESTONE|GAJAH\s*TUNGGAL|GOODYEAR|MICHELIN|TECH|MAXAM)[A-Z0-9\s.,&-]*)/i,
        /^(?:#+\s*)?(PT\.?\s+[A-Z0-9\s.,&-]{3,50})/im,
    ]

    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
            const cleaned = match[1].replace(/[*_~`]/g, "").trim()
            if (cleaned.length >= 4) {
                return cleaned
            }
        }
    }

    return null
}

/**
 * Layer 1: Heuristic & Deterministic Parser untuk Purchase Order (PO)
 */
export function tryHeuristicPoParse(markdownText: string): {
    success: boolean
    data?: ExtractedSOData
    confidence: number
} {
    if (!markdownText || typeof markdownText !== "string") {
        return { success: false, confidence: 0 }
    }

    const tables = parseMarkdownTables(markdownText)
    if (tables.length === 0) {
        return { success: false, confidence: 0 }
    }

    // Cari tabel yang memiliki kolom item
    const candidateTable = tables.find((t) => Object.values(t.columnMap).includes("item"))
    if (!candidateTable || candidateTable.rows.length === 0) {
        return { success: false, confidence: 0 }
    }

    const poNumber = extractPoNumber(markdownText)
    const documentDate = extractDocumentDate(markdownText) || new Date().toISOString().split("T")[0]
    const customerName = extractCustomerName(markdownText)

    const products = candidateTable.rows
        .map((row) => {
            const name = (row.item || "").trim()
            const code = (row.code || "").trim() || null
            const qty = parseNumericValue(row.qty || "1") || 1
            const unitPrice = parseNumericValue(row.unit_price || "0")
            const totalPrice = parseNumericValue(row.total_price || "0") || qty * unitPrice

            return {
                name,
                code,
                qty,
                unit_price: unitPrice,
                total_price: totalPrice,
            }
        })
        .filter((p) => p.name.length > 0 && !/^(total|subtotal|ppn|grand\s*total)$/i.test(p.name))

    if (products.length === 0) {
        return { success: false, confidence: 0 }
    }

    // Ambil nama perusahaan dari baris awal jika tidak cocok regex
    const candidateLines = markdownText
        .split(/\r?\n/)
        .map((l) => l.replace(/[*_#~`]/g, "").trim())
        .filter((l) => l.length > 3 && !l.startsWith("|") && !/^(purchase order|po|order|faktur|invoice|surat pesanan)$/i.test(l))

    const resolvedCustomer = customerName || candidateLines[0] || "Customer Terdeteksi"
    const resolvedPo = poNumber || (candidateLines.find((l) => /^[A-Z0-9\-_/]{4,}$/i.test(l)) ?? "PO-Terdeteksi")

    return {
        success: true,
        confidence: poNumber && customerName ? 0.95 : 0.8,
        data: {
            customer_company_name: resolvedCustomer,
            customer_code: null,
            po_number: resolvedPo,
            document_date: documentDate,
            products,
            tax_total: 0,
            grand_total: products.reduce((acc, p) => acc + (p.total_price || 0), 0),
        },
    }
}

/**
 * Layer 1: Heuristic & Deterministic Parser untuk Vendor Quotation
 */
export function tryHeuristicVendorQuotationParse(markdownText: string): {
    success: boolean
    data?: ExtractedVendorQuotation
    confidence: number
} {
    if (!markdownText || typeof markdownText !== "string") {
        return { success: false, confidence: 0 }
    }

    const tables = parseMarkdownTables(markdownText)
    if (tables.length === 0) {
        return { success: false, confidence: 0 }
    }

    const candidateTable = tables.find((t) => Object.values(t.columnMap).includes("item"))
    if (!candidateTable || candidateTable.rows.length === 0) {
        return { success: false, confidence: 0 }
    }

    const quoteNumber = extractQuotationNumber(markdownText)
    const quoteDate = extractDocumentDate(markdownText) || new Date().toISOString().split("T")[0]
    const vendorName = extractVendorName(markdownText)

    const items = candidateTable.rows
        .map((row) => {
            const itemName = (row.item || "").trim()
            const qty = parseNumericValue(row.qty || "1") || 1
            const unit = (row.unit || "").trim() || "Unit"
            const unitPrice = parseNumericValue(row.unit_price || "0")
            const totalPrice = parseNumericValue(row.total_price || "0") || qty * unitPrice
            const remark = (row.remark || "").trim() || null

            return {
                item_name: itemName,
                qty,
                unit,
                unit_price: unitPrice,
                total_price: totalPrice,
                remark,
            }
        })
        .filter((item) => item.item_name.length > 0 && !/^(total|subtotal|ppn|grand\s*total)$/i.test(item.item_name))

    if (items.length === 0) {
        return { success: false, confidence: 0 }
    }

    const candidateLines = markdownText
        .split(/\r?\n/)
        .map((l) => l.replace(/[*_#~`]/g, "").trim())
        .filter((l) => l.length > 3 && !l.startsWith("|") && !/^(quotation|penawaran|surat penawaran|price quotation)$/i.test(l))

    const resolvedVendor = vendorName || candidateLines[0] || "Vendor Terdeteksi"
    const resolvedQuoteNo = quoteNumber || (candidateLines.find((l) => /^[A-Z0-9\-_/]{4,}$/i.test(l)) ?? "QUO-Terdeteksi")

    return {
        success: true,
        confidence: quoteNumber && vendorName ? 0.95 : 0.8,
        data: {
            vendor_name: resolvedVendor,
            quote_number: resolvedQuoteNo,
            quoteDate: quoteDate,
            remark: null,
            items,
        },
    }
}
