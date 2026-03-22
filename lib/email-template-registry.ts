import { inArray, eq } from "drizzle-orm"
import { db } from "@/db"
import { emailTemplates } from "@/db/schema"
import { ensureEmailManagementSchema } from "@/lib/email-schema"

const APP_NAME = "One Chitra"

export const SYSTEM_EMAIL_TEMPLATE_CODES = {
    authMagicLink: "auth_magic_link",
    authPasswordReset: "auth_password_reset",
    approvalAssignment: "approval_assignment",
    approvalApproved: "approval_approved",
    approvalRejected: "approval_rejected",
    approvalSlaReminder: "approval_sla_reminder",
    approvalSlaEscalation: "approval_sla_escalation",
    inventoryRestockAlert: "inventory_restock_alert",
    stockMinimumAlert: "stock_minimum_alert",
    deliveryScheduledReminder: "delivery_scheduled_reminder",
    deliveryDeliveredSalesPic: "delivery_delivered_sales_pic",
    deliveryDoReturnOverdue: "delivery_do_return_overdue",
    stockTransferPendingReceipt: "stock_transfer_pending_receipt",
    goodReceiveManualNotification: "good_receive_manual_notification",
    stockOpnameActualCompletion: "stock_opname_actual_completion",
    calendarEventReminder: "calendar_event_reminder",
    customerBirthdayGreeting: "customer_birthday_greeting",
    costSettlementSubmitted: "cost_settlement_submitted",
    costSettlementApproved: "cost_settlement_approved",
    costSettlementRejected: "cost_settlement_rejected",
    sapSyncFailure: "sap_sync_failure",
    systemSmtpAlert: "system_smtp_alert",
    revenueReport: "revenue_report",
} as const

export type SystemEmailTemplateCode =
    (typeof SYSTEM_EMAIL_TEMPLATE_CODES)[keyof typeof SYSTEM_EMAIL_TEMPLATE_CODES]

type TemplateType =
    "magic_link" |
    "notification" |
    "welcome" |
    "password_reset" |
    "order_confirmation" |
    "delivery_update" |
    "custom"

type SystemEmailTemplateDefinition = {
    code: SystemEmailTemplateCode
    name: string
    type: TemplateType
    subject: string
    htmlContent: string
    textContent: string
    variables: string[]
    recipientRoles: string[]
    recipientUserIds: string[]
    ccEmails: string[]
    defaultActive: boolean
}

function createEmailShell(params: {
    title: string
    subtitle?: string
    accentColor: string
    bodyHtml: string
}) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:16px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;-webkit-text-size-adjust:100%;word-break:break-word;">
  <div style="max-width:920px;width:100%;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
    <div style="padding:24px 28px;background:${params.accentColor};color:#ffffff;">
      <h1 style="margin:0;font-size:24px;">${params.title}</h1>
      ${params.subtitle ? `<p style="margin:8px 0 0;font-size:14px;opacity:.95;">${params.subtitle}</p>` : ""}
    </div>
    <div style="padding:28px;">
      ${params.bodyHtml}
      <p style="margin:24px 0 0;font-size:12px;color:#64748b;">Email ini dikirim otomatis oleh sistem ${APP_NAME}.</p>
    </div>
  </div>
</body>
</html>`
}

function createActionButton(label: string, href: string, accentColor: string) {
    return `<a href="${href}" style="display:inline-block;max-width:100%;background:${accentColor};color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;box-sizing:border-box;">${label}</a>`
}

function createSummaryTable(rows: Array<{ label: string; value: string }>) {
    return `
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f8fafc;font-size:14px;line-height:1.5;table-layout:fixed;">
        <tbody>
          ${rows.map((row) => `<tr><td style="padding:10px 12px;border:1px solid #dbe2ea;width:38%;vertical-align:top;"><strong>${row.label}</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;vertical-align:top;word-break:break-word;">${row.value}</td></tr>`).join("")}
        </tbody>
      </table>
    `
}

function createTextBlock(title: string, lines: string[]) {
    return `${title}

${lines.join("\n")}

Email ini dikirim otomatis oleh sistem ${APP_NAME}.`
}

function createStructuredTemplate(params: {
    title: string
    subtitle: string
    accentColor: string
    buttonLabel?: string
    buttonHref?: string
    rows: Array<{ label: string; value: string }>
    extraHtml?: string
    extraText?: string[]
}) {
    const buttonHtml = params.buttonLabel && params.buttonHref
        ? `${createActionButton(params.buttonLabel, params.buttonHref, params.accentColor)}`
        : ""

    const htmlContent = createEmailShell({
        title: params.title,
        subtitle: params.subtitle,
        accentColor: params.accentColor,
        bodyHtml: `${createSummaryTable(params.rows)}${params.extraHtml ?? ""}${buttonHtml}`,
    })

    const textContent = createTextBlock(
        params.title,
        [
            ...params.rows.map((row) => `${row.label}: ${row.value}`),
            ...(params.extraText ?? []),
            ...(params.buttonHref ? [`Buka: ${params.buttonHref}`] : []),
        ],
    )

    return { htmlContent, textContent }
}

const deliveryDeliveredTemplate = createEmailShell({
    title: "Delivery Sudah Dikirim",
    subtitle: "Informasi delivery terbaru untuk Sales PIC.",
    accentColor: "#0f766e",
    bodyHtml: `
      <p style="margin:0 0 16px;">Halo <strong>{{salesPicName}}</strong>,</p>
      <p style="margin:0 0 18px;">Barang untuk delivery <strong>{{deliveryNumber}}</strong> sudah dikirim.</p>
      {{partialNoticeHtml}}
      ${createSummaryTable([
        { label: "Delivery No", value: "{{deliveryNumber}}" },
        { label: "Jenis Pengiriman", value: "{{deliveryTypeLabel}}" },
        { label: "Tanggal Delivery", value: "{{deliveryDate}}" },
        { label: "Tanggal Schedule", value: "{{scheduledDate}}" },
        { label: "Sales Order", value: "{{salesOrderNumber}}" },
        { label: "Customer PO", value: "{{customerPo}}" },
        { label: "Customer", value: "{{customerName}}" },
        { label: "Warehouse Asal", value: "{{warehouseName}}" },
        { label: "Warehouse Tujuan", value: "{{destinationWarehouseName}}" },
        { label: "Driver", value: "{{driverName}}" },
        { label: "No. Kendaraan", value: "{{vehicleNumber}}" },
        { label: "Vendor Ekspedisi", value: "{{vendorName}}" },
        { label: "DO SAP", value: "{{doSap}}" },
        { label: "Alamat Kirim", value: "{{shippingAddress}}" },
        { label: "Catatan", value: "{{notes}}" },
      ])}
      <h3 style="margin:0 0 10px;font-size:16px;color:#0f172a;">Detail Item Delivery</h3>
      <div style="width:100%;overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.5;">
        <thead style="background:#e2e8f0;">
          <tr>
            <th style="padding:10px;border:1px solid #cbd5e1;">No</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Material No</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Deskripsi</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Qty SO</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Qty Delivery Ini</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Qty Delivered s/d Saat Ini</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Sisa SO</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Serial Number</th>
          </tr>
        </thead>
        <tbody>{{itemsTableRows}}</tbody>
      </table>
      </div>
    `,
})

const goodReceiveTemplate = createEmailShell({
    title: "Notifikasi Good Receive Manual",
    subtitle: "Barang sudah datang dan sudah diinput ke stock manual.",
    accentColor: "#1d4ed8",
    bodyHtml: `
      ${createSummaryTable([
        { label: "PO Number", value: "{{poNumber}}" },
        { label: "Supplier", value: "{{supplier}}" },
        { label: "Tanggal Receive", value: "{{receiveDate}}" },
        { label: "Delivery Type", value: "{{deliveryType}}" },
        { label: "Warehouse", value: "{{warehouseLabel}}" },
        { label: "Ref. Document", value: "{{referenceDocument}}" },
        { label: "Detail URL", value: "{{detailUrl}}" },
      ])}
      <h3 style="margin:0 0 10px;font-size:16px;color:#0f172a;">Detail Item Diterima</h3>
      <div style="width:100%;overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.5;">
        <thead style="background:#e2e8f0;">
          <tr>
            <th style="padding:10px;border:1px solid #cbd5e1;">No</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">PO Item</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Material No</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Deskripsi</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Qty</th>
          </tr>
        </thead>
        <tbody>{{itemsTableRows}}</tbody>
      </table>
      </div>
    `,
})

const stockOpnameTemplate = createEmailShell({
    title: "Hasil Stock Opname Aktual",
    subtitle: "Sesi <strong>{{sessionName}}</strong> telah ditutup.",
    accentColor: "#0f766e",
    bodyHtml: `
      ${createSummaryTable([
        { label: "Warehouse", value: "{{warehouseLabel}}" },
        { label: "Tanggal / Waktu", value: "{{opnameDate}} {{opnameTime}}" },
        { label: "Lokasi", value: "{{location}}" },
        { label: "Total Item", value: "{{totalItems}}" },
        { label: "Sudah Dihitung", value: "{{countedItems}}" },
        { label: "Item Selisih", value: "{{varianceItems}}" },
        { label: "Detail URL", value: "{{detailUrl}}" },
      ])}
      <h3 style="margin:0 0 10px;font-size:16px;color:#0f172a;">Detail Selisih (Top 25)</h3>
      <div style="width:100%;overflow:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.5;">
        <thead style="background:#e2e8f0;">
          <tr>
            <th style="padding:10px;border:1px solid #cbd5e1;">No</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Material</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Deskripsi</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Kategori</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Qty Sistem</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Qty Fisik</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Selisih</th>
          </tr>
        </thead>
        <tbody>{{varianceTableRows}}</tbody>
      </table>
      </div>
    `,
})

const revenueReportTemplate = createEmailShell({
    title: "Daily Revenue vs SAP Report",
    subtitle: "Status laporan pendapatan per {{period}}.",
    accentColor: "#0f172a",
    bodyHtml: `
      <p style="margin:0 0 16px;">Halo Team,</p>
      
      <div style="margin: 0 0 24px; padding: 16px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
        <p style="margin: 0; font-style: italic; color: #1e293b;">{{customMessage}}</p>
      </div>

      <p style="margin:0 0 20px; line-height: 1.6; color: #475569;">
        Laporan lengkap <strong>Revenue vs Forecast</strong> untuk periode <strong>{{period}}</strong> telah di-generate dan dilampirkan dalam format PDF pada email ini.
      </p>

      <p style="margin:0 0 24px; line-height: 1.6; color: #475569;">
        Silakan buka lampiran PDF untuk melihat rincian performa per Salesman, Inventory, dan Customer Achievement.
      </p>

      ${createActionButton("Buka Dashboard Revenue", "{{actionUrl}}?period={{period}}", "#0f172a")}
      
      <p style="margin:24px 0 0; font-size:12px; color:#94a3b8; text-align:center;">
        Vision: "To be the trusted leader in mining tire solution"
      </p>
    `,
})

export const SYSTEM_EMAIL_TEMPLATES: SystemEmailTemplateDefinition[] = [
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.authMagicLink,
        name: "Auth Magic Link",
        type: "magic_link",
        subject: `[${APP_NAME}] Magic link masuk untuk {{userName}}`,
        variables: ["magicLink", "userName", "appName", "expiresIn"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: true,
        htmlContent: createEmailShell({
            title: "Magic Link Sign In",
            subtitle: "Gunakan tautan ini untuk masuk tanpa password.",
            accentColor: "#1d4ed8",
            bodyHtml: `<p style="margin:0 0 16px;">Halo <strong>{{userName}}</strong>,</p><p style="margin:0 0 20px;line-height:1.6;color:#475569;">Klik tombol di bawah untuk masuk ke <strong>{{appName}}</strong>. Link ini berlaku selama <strong>{{expiresIn}}</strong>.</p>${createActionButton("Masuk Sekarang", "{{magicLink}}", "#1d4ed8")}<p style="margin:20px 0 0;font-size:12px;color:#64748b;">Jika Anda tidak meminta link ini, Anda bisa abaikan email ini.</p>`,
        }),
        textContent: createTextBlock("Magic Link Sign In", ["Halo {{userName}},", "Gunakan link berikut untuk masuk ke {{appName}}:", "{{magicLink}}", "Masa berlaku link: {{expiresIn}}."]),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.authPasswordReset,
        name: "Auth Password Reset",
        type: "password_reset",
        subject: `[${APP_NAME}] Reset password untuk {{userName}}`,
        variables: ["resetUrl", "userName", "appName", "expiresIn"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: true,
        htmlContent: createEmailShell({
            title: "Reset Password",
            subtitle: "Tautan aman untuk mengganti password akun Anda.",
            accentColor: "#dc2626",
            bodyHtml: `<p style="margin:0 0 16px;">Halo <strong>{{userName}}</strong>,</p><p style="margin:0 0 20px;line-height:1.6;color:#475569;">Kami menerima permintaan reset password untuk akun {{appName}} Anda. Link ini berlaku selama <strong>{{expiresIn}}</strong>.</p>${createActionButton("Reset Password", "{{resetUrl}}", "#dc2626")}<p style="margin:20px 0 0;font-size:12px;color:#64748b;">Jika Anda tidak meminta reset password, abaikan email ini.</p>`,
        }),
        textContent: createTextBlock("Reset Password", ["Halo {{userName}},", "Gunakan link berikut untuk reset password akun {{appName}} Anda:", "{{resetUrl}}", "Masa berlaku link: {{expiresIn}}."]),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.approvalAssignment,
        name: "Approval Assignment",
        type: "notification",
        subject: "[Approval] Tugas approval baru #{{requestId}}",
        variables: ["requestId", "stepOrder", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Approval Baru Menunggu Tindakan",
            subtitle: "Ada approval baru yang perlu Anda review.",
            accentColor: "#0f766e",
            buttonLabel: "Buka Approval",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Request ID", value: "{{requestId}}" },
                { label: "Step Approval", value: "{{stepOrder}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.approvalApproved,
        name: "Approval Approved",
        type: "notification",
        subject: "[Approval] Request #{{requestId}} telah disetujui",
        variables: ["requestId", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Approval Selesai Disetujui",
            subtitle: "Request approval Anda telah disetujui sepenuhnya.",
            accentColor: "#15803d",
            buttonLabel: "Lihat Detail",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Request ID", value: "{{requestId}}" },
                { label: "Status", value: "Approved" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.approvalRejected,
        name: "Approval Rejected",
        type: "notification",
        subject: "[Approval] Request #{{requestId}} ditolak",
        variables: ["requestId", "stepOrder", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Approval Ditolak",
            subtitle: "Request approval dihentikan karena ditolak.",
            accentColor: "#b91c1c",
            buttonLabel: "Lihat Detail",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Request ID", value: "{{requestId}}" },
                { label: "Ditolak di Step", value: "{{stepOrder}}" },
                { label: "Status", value: "Rejected" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.approvalSlaReminder,
        name: "Approval SLA Reminder",
        type: "notification",
        subject: "[Approval] Reminder SLA untuk request #{{requestId}}",
        variables: ["requestId", "stepOrder", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Reminder SLA Approval",
            subtitle: "Approval ini melewati SLA dan butuh tindakan Anda.",
            accentColor: "#d97706",
            buttonLabel: "Proses Approval",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Request ID", value: "{{requestId}}" },
                { label: "Step Saat Ini", value: "{{stepOrder}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.approvalSlaEscalation,
        name: "Approval SLA Escalation",
        type: "notification",
        subject: "[Approval] Escalation SLA untuk request #{{requestId}}",
        variables: ["requestId", "stepOrder", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Escalation SLA Approval",
            subtitle: "Approval ini dieskalasi karena melewati SLA.",
            accentColor: "#7c2d12",
            buttonLabel: "Buka Approval",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Request ID", value: "{{requestId}}" },
                { label: "Step Saat Ini", value: "{{stepOrder}}" },
                { label: "Status", value: "Escalated" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.inventoryRestockAlert,
        name: "Inventory Restock Alert",
        type: "notification",
        subject: "[Inventory] Restock {{urgencyLevel}} untuk {{productCode}}",
        variables: ["productCode", "productName", "currentStock", "recommendedStock", "urgencyLevel", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Restock Alert",
            subtitle: "Stok produk perlu segera diperhatikan.",
            accentColor: "#b45309",
            buttonLabel: "Buka Dashboard Inventory",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Material Number", value: "{{productCode}}" },
                { label: "Produk", value: "{{productName}}" },
                { label: "Current Stock", value: "{{currentStock}}" },
                { label: "Recommended Stock", value: "{{recommendedStock}}" },
                { label: "Urgency", value: "{{urgencyLevel}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.stockMinimumAlert,
        name: "Stock Minimum Alert",
        type: "notification",
        subject: "[Stock] Minimum stock tercapai untuk {{productCode}}",
        variables: ["productCode", "productName", "warehouseLabel", "currentStock", "minStock", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Minimum Stock Alert",
            subtitle: "Stok saat ini sudah menyentuh batas minimum.",
            accentColor: "#92400e",
            buttonLabel: "Buka Stock Alerts",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Material Number", value: "{{productCode}}" },
                { label: "Produk", value: "{{productName}}" },
                { label: "Warehouse", value: "{{warehouseLabel}}" },
                { label: "Current Stock", value: "{{currentStock}}" },
                { label: "Minimum Stock", value: "{{minStock}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.deliveryScheduledReminder,
        name: "Delivery Scheduled Reminder",
        type: "delivery_update",
        subject: "[Delivery] Pengiriman {{deliveryNumber}} terjadwal {{scheduledDate}}",
        variables: ["deliveryNumber", "scheduledDate", "customerName", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Reminder Jadwal Delivery",
            subtitle: "Pengiriman mendekati jadwal dan perlu dipastikan siap jalan.",
            accentColor: "#0369a1",
            buttonLabel: "Buka Delivery",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Delivery Number", value: "{{deliveryNumber}}" },
                { label: "Customer", value: "{{customerName}}" },
                { label: "Tanggal Jadwal", value: "{{scheduledDate}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.deliveryDeliveredSalesPic,
        name: "Delivery Delivered to Sales PIC",
        type: "delivery_update",
        subject: `[${APP_NAME}] Delivery {{deliveryTypeLabel}} - {{deliveryNumber}}`,
        variables: [
            "salesPicName",
            "deliveryNumber",
            "deliveryTypeLabel",
            "deliveryDate",
            "scheduledDate",
            "salesOrderNumber",
            "customerPo",
            "customerName",
            "warehouseName",
            "destinationWarehouseName",
            "driverName",
            "vehicleNumber",
            "vendorName",
            "doSap",
            "shippingAddress",
            "notes",
            "partialNoticeHtml",
            "partialNoticeText",
            "itemsTableRows",
            "itemsTextRows",
        ],
        recipientRoles: ["staff"],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        htmlContent: deliveryDeliveredTemplate,
        textContent: createTextBlock("Delivery Sudah Dikirim", [
            "Halo {{salesPicName}},",
            "Barang untuk delivery {{deliveryNumber}} sudah dikirim.",
            "{{partialNoticeText}}",
            "Delivery No: {{deliveryNumber}}",
            "Jenis Pengiriman: {{deliveryTypeLabel}}",
            "Tanggal Delivery: {{deliveryDate}}",
            "Tanggal Schedule: {{scheduledDate}}",
            "Sales Order: {{salesOrderNumber}}",
            "Customer PO: {{customerPo}}",
            "Customer: {{customerName}}",
            "Warehouse Asal: {{warehouseName}}",
            "Warehouse Tujuan: {{destinationWarehouseName}}",
            "Driver: {{driverName}}",
            "No. Kendaraan: {{vehicleNumber}}",
            "Vendor Ekspedisi: {{vendorName}}",
            "DO SAP: {{doSap}}",
            "Alamat Kirim: {{shippingAddress}}",
            "Catatan: {{notes}}",
            "",
            "Detail Item Delivery:",
            "{{itemsTextRows}}",
        ]),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.deliveryDoReturnOverdue,
        name: "Delivery DO Return Overdue",
        type: "notification",
        subject: "[Delivery] Return DO overdue untuk {{deliveryNumber}}",
        variables: ["deliveryNumber", "customerName", "returnDoDate", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Return DO Melewati Target",
            subtitle: "Dokumen DO belum kembali sesuai target.",
            accentColor: "#9a3412",
            buttonLabel: "Buka DO Monitoring",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Delivery Number", value: "{{deliveryNumber}}" },
                { label: "Customer", value: "{{customerName}}" },
                { label: "Target Return DO", value: "{{returnDoDate}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.stockTransferPendingReceipt,
        name: "Stock Transfer Pending Receipt",
        type: "notification",
        subject: "[Transfer] Menunggu penerimaan {{referenceNumber}}",
        variables: ["referenceNumber", "fromWarehouse", "toWarehouse", "transferDate", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Transfer Menunggu Penerimaan",
            subtitle: "Transfer stok belum dikonfirmasi gudang tujuan.",
            accentColor: "#4338ca",
            buttonLabel: "Buka Stock Transfer",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Reference Number", value: "{{referenceNumber}}" },
                { label: "Warehouse Asal", value: "{{fromWarehouse}}" },
                { label: "Warehouse Tujuan", value: "{{toWarehouse}}" },
                { label: "Tanggal Transfer", value: "{{transferDate}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.goodReceiveManualNotification,
        name: "Good Receive Manual Notification",
        type: "notification",
        subject: "[GR Manual] Barang datang untuk PO {{poNumber}}",
        variables: ["poNumber", "supplier", "receiveDate", "deliveryType", "warehouseLabel", "referenceDocument", "detailUrl", "itemsTableRows", "itemsTextRows"],
        recipientRoles: ["admin", "manager", "staff"],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        htmlContent: goodReceiveTemplate,
        textContent: createTextBlock("Notifikasi Good Receive Manual", [
            "PO Number: {{poNumber}}",
            "Supplier: {{supplier}}",
            "Tanggal Receive: {{receiveDate}}",
            "Delivery Type: {{deliveryType}}",
            "Warehouse: {{warehouseLabel}}",
            "Ref. Document: {{referenceDocument}}",
            "Detail URL: {{detailUrl}}",
            "",
            "Detail Item Diterima:",
            "{{itemsTextRows}}",
        ]),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.stockOpnameActualCompletion,
        name: "Stock Opname Actual Completion",
        type: "notification",
        subject: "[Stock Opname Aktual] Hasil Sesi {{sessionName}}",
        variables: ["sessionName", "warehouseLabel", "opnameDate", "opnameTime", "location", "totalItems", "countedItems", "varianceItems", "detailUrl", "varianceTableRows", "varianceTextRows"],
        recipientRoles: ["admin", "manager", "staff"],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        htmlContent: stockOpnameTemplate,
        textContent: createTextBlock("Hasil Stock Opname Aktual", [
            "Sesi: {{sessionName}}",
            "Warehouse: {{warehouseLabel}}",
            "Tanggal / Waktu: {{opnameDate}} {{opnameTime}}",
            "Lokasi: {{location}}",
            "Total Item: {{totalItems}}",
            "Sudah Dihitung: {{countedItems}}",
            "Item Selisih: {{varianceItems}}",
            "Detail URL: {{detailUrl}}",
            "",
            "Detail Selisih:",
            "{{varianceTextRows}}",
        ]),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.calendarEventReminder,
        name: "Calendar Event Reminder",
        type: "notification",
        subject: "[Reminder] {{eventTitle}}",
        variables: ["eventTitle", "eventDate", "eventDescription", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Pengingat Event",
            subtitle: "Event mendekati waktunya.",
            accentColor: "#f59e0b",
            buttonLabel: "Buka Kalender",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Judul Event", value: "{{eventTitle}}" },
                { label: "Waktu", value: "{{eventDate}}" },
                { label: "Deskripsi", value: "{{eventDescription}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.customerBirthdayGreeting,
        name: "Customer Birthday Greeting",
        type: "welcome",
        subject: "Selamat Ulang Tahun, {{customerName}}",
        variables: ["customerName", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        htmlContent: createEmailShell({
            title: "Selamat Ulang Tahun",
            subtitle: "Ucapan hangat dari tim One Chitra.",
            accentColor: "#db2777",
            bodyHtml: `<p style="margin:0 0 16px;">Halo <strong>{{customerName}}</strong>,</p><p style="margin:0 0 16px;line-height:1.6;color:#475569;">Semoga ulang tahun Anda penuh kebahagiaan, kesehatan, dan kesuksesan. Terima kasih telah menjadi pelanggan setia kami.</p><p style="margin:0;color:#be185d;font-weight:600;">Salam hangat,<br />Tim {{appName}}</p>`,
        }),
        textContent: createTextBlock("Selamat Ulang Tahun", ["Halo {{customerName}},", "Semoga ulang tahun Anda penuh kebahagiaan, kesehatan, dan kesuksesan.", "Terima kasih telah menjadi pelanggan setia kami.", "Salam hangat,", "Tim {{appName}}"]),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.costSettlementSubmitted,
        name: "Cost Settlement Submitted",
        type: "notification",
        subject: "[Settlement] {{settlementNumber}} menunggu approval",
        variables: ["settlementNumber", "settlementType", "status", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Cost Settlement Diajukan",
            subtitle: "Settlement baru telah diajukan dan menunggu approval.",
            accentColor: "#2563eb",
            buttonLabel: "Buka Settlement",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Settlement Number", value: "{{settlementNumber}}" },
                { label: "Tipe", value: "{{settlementType}}" },
                { label: "Status", value: "{{status}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.costSettlementApproved,
        name: "Cost Settlement Approved",
        type: "notification",
        subject: "[Settlement] {{settlementNumber}} disetujui",
        variables: ["settlementNumber", "settlementType", "status", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Cost Settlement Disetujui",
            subtitle: "Settlement telah selesai melalui approval.",
            accentColor: "#15803d",
            buttonLabel: "Buka Settlement",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Settlement Number", value: "{{settlementNumber}}" },
                { label: "Tipe", value: "{{settlementType}}" },
                { label: "Status", value: "{{status}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.costSettlementRejected,
        name: "Cost Settlement Rejected",
        type: "notification",
        subject: "[Settlement] {{settlementNumber}} ditolak",
        variables: ["settlementNumber", "settlementType", "status", "rejectionReason", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "Cost Settlement Ditolak",
            subtitle: "Settlement memerlukan revisi sebelum diajukan ulang.",
            accentColor: "#b91c1c",
            buttonLabel: "Buka Settlement",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Settlement Number", value: "{{settlementNumber}}" },
                { label: "Tipe", value: "{{settlementType}}" },
                { label: "Status", value: "{{status}}" },
                { label: "Alasan", value: "{{rejectionReason}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.sapSyncFailure,
        name: "SAP Sync Failure",
        type: "notification",
        subject: "[System] SAP sync {{syncType}} gagal",
        variables: ["syncType", "status", "startedAt", "notes", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        ...createStructuredTemplate({
            title: "SAP Sync Gagal",
            subtitle: "Integrasi SAP membutuhkan perhatian admin.",
            accentColor: "#7c3aed",
            buttonLabel: "Buka Monitoring",
            buttonHref: "{{actionUrl}}",
            rows: [
                { label: "Sync Type", value: "{{syncType}}" },
                { label: "Status", value: "{{status}}" },
                { label: "Started At", value: "{{startedAt}}" },
                { label: "Catatan", value: "{{notes}}" },
            ],
        }),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.systemSmtpAlert,
        name: "System SMTP Alert",
        type: "notification",
        subject: "[System] {{alertTitle}}",
        variables: ["alertTitle", "alertMessage", "actionUrl", "appName"],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: false,
        htmlContent: createEmailShell({
            title: "System Alert",
            subtitle: "Ada kondisi sistem yang perlu dicek.",
            accentColor: "#475569",
            bodyHtml: `<p style="margin:0 0 16px;line-height:1.6;color:#475569;">{{alertMessage}}</p>${createActionButton("Buka Pengaturan", "{{actionUrl}}", "#475569")}`,
        }),
        textContent: createTextBlock("System Alert", ["Judul: {{alertTitle}}", "Pesan: {{alertMessage}}", "Buka: {{actionUrl}}"]),
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.revenueReport,
        name: "Revenue Report Automation",
        type: "notification",
        subject: "[Report] Sales Revenue vs SAP - {{period}}",
        variables: [
            "period", "customMessage",
            "consolidateRevenue", "consolidateForecast", "consolidatePct",
            "primeProductRevenue", "primeProductForecast", "primeProductPct",
            "serviceRevenue", "serviceForecast", "servicePct",
            "paRevenue", "paForecast", "paPct",
            "ckRevenue", "ckPct", "sisRevenue", "sisPct",
            "inventoryTotal",
            "actionUrl"
        ],
        recipientRoles: [],
        recipientUserIds: [],
        ccEmails: [],
        defaultActive: true,
        htmlContent: revenueReportTemplate,
        textContent: createTextBlock("Sales Revenue vs SAP", [
            "Halo Team,",
            "",
            "{{customMessage}}",
            "",
            "Laporan lengkap Revenue vs Forecast untuk periode {{period}} telah di-generate dan dilampirkan dalam format PDF pada email ini.",
            "",
            "Silakan buka lampiran PDF untuk melihat rincian performa per Salesman, Inventory, dan Customer Achievement.",
            "",
            "Buka Dashboard: {{actionUrl}}?period={{period}}",
            "",
            "One Chitra Vision: \"To be the trusted leader in mining tire solution\"",
        ]),
    },
]

export function getSystemEmailTemplateDefinition(code: SystemEmailTemplateCode) {
    return SYSTEM_EMAIL_TEMPLATES.find((entry) => entry.code === code) ?? null
}

export async function ensureSystemEmailTemplates() {
    await ensureEmailManagementSchema()

    const codes = SYSTEM_EMAIL_TEMPLATES.map((entry) => entry.code)
    const existing = await db
        .select({ code: emailTemplates.code })
        .from(emailTemplates)
        .where(inArray(emailTemplates.code, codes))

    const existingCodes = new Set(existing.map((entry) => entry.code).filter(Boolean))
    const missingTemplates = SYSTEM_EMAIL_TEMPLATES.filter((entry) => !existingCodes.has(entry.code))

    // Insert missing templates
    if (missingTemplates.length > 0) {
        await db.insert(emailTemplates).values(
            missingTemplates.map((template) => ({
                name: template.name,
                code: template.code,
                type: template.type,
                subject: template.subject,
                htmlContent: template.htmlContent,
                textContent: template.textContent,
                variables: template.variables,
                recipientRoles: template.recipientRoles,
                recipientUserIds: template.recipientUserIds,
                ccEmails: template.ccEmails,
                isActive: template.defaultActive,
            })),
        )
    }

    // Update existing system templates to match current definitions (content, variables, etc.)
    // Only update if they match one of our system codes to avoid touching user custom templates
    for (const template of SYSTEM_EMAIL_TEMPLATES) {
        if (existingCodes.has(template.code)) {
            await db.update(emailTemplates)
                .set({
                    name: template.name,
                    subject: template.subject,
                    htmlContent: template.htmlContent,
                    textContent: template.textContent,
                    variables: template.variables,
                    recipientRoles: template.recipientRoles,
                    recipientUserIds: template.recipientUserIds,
                    ccEmails: template.ccEmails,
                    updatedAt: new Date(),
                    // Optionally force active if it's a critical system template
                    // isActive: template.defaultActive 
                })
                .where(eq(emailTemplates.code, template.code))
        }
    }
}
