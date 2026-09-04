export interface NoStockNotificationConfig {
    enabled: boolean
    notifyEmail: boolean
    notifyInApp: boolean
    triggerCondition: "po_customer_only" | "all_so"
    minEmptyItems: number
    recipientRoles: string[]
    recipientEmails: string[]
    emailSubjectTemplate: string
    updatedAt?: string
    updatedBy?: string
}

export const DEFAULT_NO_STOCK_NOTIFICATION_CONFIG: NoStockNotificationConfig = {
    enabled: true,
    notifyEmail: true,
    notifyInApp: true,
    triggerCondition: "po_customer_only",
    minEmptyItems: 1,
    recipientRoles: ["admin", "manager"],
    recipientEmails: ["procurement@chitraparatama.com"],
    emailSubjectTemplate: "[URGENT] SO Baru #{invoiceNumber} Membutuhkan Pengadaan (Stok Kosong)",
}

export interface EmptyStockItemSummary {
    materialNumber: string
    materialDescription: string
    orderedQuantity: number
    availableStock: number
    shortageQuantity: number
}

export function formatNoStockNotificationHtml(params: {
    invoiceNumber: string
    customerName: string
    customerPo: string
    salesPersonName: string
    items: EmptyStockItemSummary[]
    appUrl?: string
}) {
    const { invoiceNumber, customerName, customerPo, salesPersonName, items, appUrl = "http://localhost:3000" } = params

    const rowsHtml = items
        .map(
            (item, index) => `
        <tr style="border-bottom: 1px solid #e2e8f0; ${index % 2 === 1 ? "background-color: #f8fafc;" : ""}">
            <td style="padding: 10px; font-family: monospace; font-weight: bold; color: #1e293b;">${item.materialNumber}</td>
            <td style="padding: 10px; color: #475569;">${item.materialDescription}</td>
            <td style="padding: 10px; text-align: right; font-weight: 600; color: #0f172a;">${item.orderedQuantity}</td>
            <td style="padding: 10px; text-align: right; color: #ef4444; font-weight: 600;">${item.availableStock}</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; color: #dc2626;">${item.shortageQuantity}</td>
        </tr>
    `
        )
        .join("")

    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #991b1b; font-size: 16px; font-weight: 700;">⚠️ Peringatan Kebutuhan Pengadaan (No Stock Alert)</h2>
            <p style="margin: 4px 0 0 0; color: #b91c1c; font-size: 13px;">
                Sales Order baru telah dibuat, namun terdapat <strong>${items.length} barang</strong> dengan stok kosong yang memerlukan tindak lanjut alokasi PO Vendor.
            </p>
        </div>

        <table style="width: 100%; font-size: 13px; margin-bottom: 20px; border-collapse: collapse;">
            <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">No. Sales Order:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #1e293b;">${invoiceNumber}</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #64748b;">Customer:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${customerName}</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #64748b;">No. PO Customer:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">${customerPo || "-"}</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #64748b;">Sales Person:</td>
                <td style="padding: 6px 0; color: #334155;">${salesPersonName}</td>
            </tr>
        </table>

        <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Rincian Barang Kosong / Butuh PO:</h3>
        <table style="width: 100%; font-size: 12px; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 24px;">
            <thead>
                <tr style="background-color: #f1f5f9; text-align: left; color: #475569;">
                    <th style="padding: 10px;">Material SKU</th>
                    <th style="padding: 10px;">Deskripsi Barang</th>
                    <th style="padding: 10px; text-align: right;">Qty SO</th>
                    <th style="padding: 10px; text-align: right;">Stok Gudang</th>
                    <th style="padding: 10px; text-align: right;">Defisit</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>

        <div style="text-align: center; margin-top: 25px;">
            <a href="${appUrl}/dashboard/no-stock-monitoring" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 13px; font-weight: 600;">
                Buka Halaman No Stock Monitoring &rarr;
            </a>
        </div>

        <div style="margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
            Email otomatis dari Sistem One Chitra &bull; Notifikasi SO Stok Kosong
        </div>
    </div>
    `
}
