/**
 * Corporate Banking Bulk Payment / H2H File Exporter
 * Mendukung BCA KlikBCA Bisnis, Mandiri MCM II, dan Universal AP Disbursement CSV
 * One Chitra Enterprise Procure-to-Pay (P2P)
 */

export interface BankDisbursementItem {
    invoiceId: string
    invoiceNumber: string
    vendorName: string
    bankName: string
    bankAccountNo: string
    bankAccountHolder: string
    amount: number
    currency?: string
    vendorEmail?: string
    referenceNo?: string
    notes?: string
}

export interface BankBatchExportResult {
    filename: string
    mimeType: string
    content: string
    totalRecords: number
    totalAmount: number
}

/**
 * 1. Export format BCA KlikBCA Bisnis (Multi-Transfer / Payroll CSV)
 */
export function generateBcaKlikBcaCsv(params: {
    sourceAccount: string
    items: BankDisbursementItem[]
    batchCode?: string
}): BankBatchExportResult {
    const cleanSource = (params.sourceAccount || "").replace(/[^0-9]/g, "")
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")

    const rows: string[] = []
    let totalAmount = 0

    // Header komentar informasi
    rows.push(`// BCA KLIKBCA BISNIS MULTI-TRANSFER BATCH: ${params.batchCode || dateStr}`)
    rows.push(`// REKENING SUMBER: ${cleanSource}`)
    rows.push(`"REK_SUMBER","REK_TUJUAN","NAMA_PENERIMA","NOMINAL","MATA_UANG","BERITA_1","BERITA_2","EMAIL"`)

    for (const item of params.items) {
        const destAcc = (item.bankAccountNo || "").replace(/[^0-9]/g, "")
        const destHolder = (item.bankAccountHolder || item.vendorName || "VENDOR").slice(0, 35).replace(/"/g, '""')
        const amount = Math.round(Number(item.amount) || 0)
        totalAmount += amount

        const remark1 = `INV ${item.invoiceNumber}`.slice(0, 18).replace(/"/g, '""')
        const remark2 = (item.referenceNo || "ONE-CHITRA").slice(0, 18).replace(/"/g, '""')
        const email = (item.vendorEmail || "").replace(/"/g, '""')

        rows.push(
            `"${cleanSource}","${destAcc}","${destHolder}","${amount}","${item.currency || "IDR"}","${remark1}","${remark2}","${email}"`
        )
    }

    return {
        filename: `BCA_BULK_${params.batchCode || dateStr}.csv`,
        mimeType: "text/csv;charset=utf-8;",
        content: rows.join("\r\n"),
        totalRecords: params.items.length,
        totalAmount,
    }
}

/**
 * 2. Export format Mandiri MCM II (Corporate Transfer CSV)
 */
export function generateMandiriMcmCsv(params: {
    sourceAccount: string
    items: BankDisbursementItem[]
    batchCode?: string
}): BankBatchExportResult {
    const cleanSource = (params.sourceAccount || "").replace(/[^0-9]/g, "")
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")

    const rows: string[] = []
    let totalAmount = 0

    // Header Mandiri MCM format
    rows.push(`"DEBIT_ACCOUNT","BENEFICIARY_ACCOUNT","BENEFICIARY_NAME","AMOUNT","CURRENCY","REMARK1","REMARK2","BENEFICIARY_EMAIL"`)

    for (const item of params.items) {
        const destAcc = (item.bankAccountNo || "").replace(/[^0-9]/g, "")
        const destHolder = (item.bankAccountHolder || item.vendorName || "VENDOR").slice(0, 40).replace(/"/g, '""')
        const amount = Math.round(Number(item.amount) || 0)
        totalAmount += amount

        const remark1 = `INV-${item.invoiceNumber}`.slice(0, 20).replace(/"/g, '""')
        const remark2 = `CHITRA-${item.referenceNo || dateStr}`.slice(0, 20).replace(/"/g, '""')
        const email = (item.vendorEmail || "").replace(/"/g, '""')

        rows.push(
            `"${cleanSource}","${destAcc}","${destHolder}","${amount}","${item.currency || "IDR"}","${remark1}","${remark2}","${email}"`
        )
    }

    return {
        filename: `MANDIRI_MCM_${params.batchCode || dateStr}.csv`,
        mimeType: "text/csv;charset=utf-8;",
        content: rows.join("\r\n"),
        totalRecords: params.items.length,
        totalAmount,
    }
}

/**
 * 3. Export format Universal AP Disbursement (Excel / ERP friendly CSV)
 */
export function generateUniversalApCsv(params: {
    sourceAccount: string
    items: BankDisbursementItem[]
    batchCode?: string
}): BankBatchExportResult {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")

    const rows: string[] = []
    let totalAmount = 0

    rows.push(
        `"Batch Code","No Invoice","Nama Vendor","Bank Penerima","Nomor Rekening","Atas Nama","Nominal Netto","Mata Uang","No Referensi","Email Vendor","Catatan"`
    )

    for (const item of params.items) {
        const amount = Number(item.amount) || 0
        totalAmount += amount

        rows.push(
            [
                `"${params.batchCode || "BATCH"}"`,
                `"${item.invoiceNumber.replace(/"/g, '""')}"`,
                `"${item.vendorName.replace(/"/g, '""')}"`,
                `"${(item.bankName || "BCA").replace(/"/g, '""')}"`,
                `"'${item.bankAccountNo}"`, // Single quote prevents Excel scientific notation
                `"${(item.bankAccountHolder || "").replace(/"/g, '""')}"`,
                amount,
                `"${item.currency || "IDR"}"`,
                `"${(item.referenceNo || "").replace(/"/g, '""')}"`,
                `"${(item.vendorEmail || "").replace(/"/g, '""')}"`,
                `"${(item.notes || "").replace(/"/g, '""')}"`,
            ].join(",")
        )
    }

    return {
        filename: `AP_DISBURSEMENT_${params.batchCode || dateStr}.csv`,
        mimeType: "text/csv;charset=utf-8;",
        content: rows.join("\r\n"),
        totalRecords: params.items.length,
        totalAmount,
    }
}
