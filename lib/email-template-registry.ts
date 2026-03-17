import { inArray } from "drizzle-orm"
import { db } from "@/db"
import { emailTemplates } from "@/db/schema"
import { ensureEmailManagementSchema } from "@/lib/email-schema"

export const SYSTEM_EMAIL_TEMPLATE_CODES = {
    deliveryDeliveredSalesPic: "delivery_delivered_sales_pic",
    goodReceiveManualNotification: "good_receive_manual_notification",
    stockOpnameActualCompletion: "stock_opname_actual_completion",
} as const

export type SystemEmailTemplateCode =
    (typeof SYSTEM_EMAIL_TEMPLATE_CODES)[keyof typeof SYSTEM_EMAIL_TEMPLATE_CODES]

type TemplateType = "magic_link" | "notification" | "welcome" | "password_reset" | "order_confirmation" | "delivery_update" | "custom"

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
}

export const SYSTEM_EMAIL_TEMPLATES: SystemEmailTemplateDefinition[] = [
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.deliveryDeliveredSalesPic,
        name: "Delivery Delivered to Sales PIC",
        type: "delivery_update",
        subject: "[One Chitra] Delivery {{deliveryTypeLabel}} - {{deliveryNumber}}",
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
        htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:980px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
    <div style="padding:24px 28px;background:#0f766e;color:#ffffff;">
      <h1 style="margin:0;font-size:24px;">Delivery Sudah Dikirim</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:.95;">Informasi delivery terbaru untuk Sales PIC.</p>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 16px;">Halo <strong>{{salesPicName}}</strong>,</p>
      <p style="margin:0 0 18px;">Barang untuk delivery <strong>{{deliveryNumber}}</strong> sudah dikirim.</p>
      {{partialNoticeHtml}}
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f8fafc;">
        <tbody>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;width:220px;"><strong>Delivery No</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{deliveryNumber}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Jenis Pengiriman</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{deliveryTypeLabel}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Tanggal Delivery</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{deliveryDate}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Tanggal Schedule</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{scheduledDate}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Sales Order</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{salesOrderNumber}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Customer PO</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{customerPo}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Customer</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{customerName}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Warehouse Asal</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{warehouseName}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Warehouse Tujuan</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{destinationWarehouseName}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Driver</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{driverName}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>No. Kendaraan</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{vehicleNumber}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Vendor Ekspedisi</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{vendorName}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>DO SAP</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{doSap}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Alamat Kirim</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{shippingAddress}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Catatan</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{notes}}</td></tr>
        </tbody>
      </table>
      <h3 style="margin:0 0 10px;font-size:16px;color:#0f172a;">Detail Item Delivery</h3>
      <table style="width:100%;border-collapse:collapse;">
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
        <tbody>
          {{itemsTableRows}}
        </tbody>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#64748b;">Email ini dikirim otomatis oleh sistem One Chitra.</p>
    </div>
  </div>
</body>
</html>`,
        textContent: `Halo {{salesPicName}},

Barang untuk delivery {{deliveryNumber}} sudah dikirim.
{{partialNoticeText}}
Detail Delivery:
- Delivery No: {{deliveryNumber}}
- Jenis Pengiriman: {{deliveryTypeLabel}}
- Tanggal Delivery: {{deliveryDate}}
- Tanggal Schedule: {{scheduledDate}}
- Sales Order: {{salesOrderNumber}}
- Customer PO: {{customerPo}}
- Customer: {{customerName}}
- Warehouse Asal: {{warehouseName}}
- Warehouse Tujuan: {{destinationWarehouseName}}
- Driver: {{driverName}}
- No. Kendaraan: {{vehicleNumber}}
- Vendor Ekspedisi: {{vendorName}}
- DO SAP: {{doSap}}
- Alamat Kirim: {{shippingAddress}}
- Catatan: {{notes}}

Detail Item Delivery:
{{itemsTextRows}}

Email ini dikirim otomatis oleh sistem One Chitra.`,
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.goodReceiveManualNotification,
        name: "Good Receive Manual Notification",
        type: "notification",
        subject: "[GR Manual] Barang datang untuk PO {{poNumber}}",
        variables: [
            "poNumber",
            "supplier",
            "receiveDate",
            "deliveryType",
            "warehouseLabel",
            "referenceDocument",
            "detailUrl",
            "itemsTableRows",
            "itemsTextRows",
        ],
        recipientRoles: ["admin", "manager", "staff"],
        recipientUserIds: [],
        ccEmails: [],
        htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:900px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
    <div style="padding:24px 28px;background:#1d4ed8;color:#ffffff;">
      <h1 style="margin:0;font-size:24px;">Notifikasi Good Receive Manual</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:.95;">Barang sudah datang dan sudah diinput ke stock manual.</p>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f8fafc;">
        <tbody>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;width:220px;"><strong>PO Number</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{poNumber}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Supplier</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{supplier}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Tanggal Receive</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{receiveDate}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Delivery Type</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{deliveryType}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Warehouse</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{warehouseLabel}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Ref. Document</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{referenceDocument}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Detail URL</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{detailUrl}}</td></tr>
        </tbody>
      </table>
      <h3 style="margin:0 0 10px;font-size:16px;color:#0f172a;">Detail Item Diterima</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead style="background:#e2e8f0;">
          <tr>
            <th style="padding:10px;border:1px solid #cbd5e1;">No</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">PO Item</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Material No</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Deskripsi</th>
            <th style="padding:10px;border:1px solid #cbd5e1;">Qty</th>
          </tr>
        </thead>
        <tbody>
          {{itemsTableRows}}
        </tbody>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#64748b;">Email ini dikirim otomatis oleh sistem One Chitra.</p>
    </div>
  </div>
</body>
</html>`,
        textContent: `Notifikasi Good Receive Manual

PO Number: {{poNumber}}
Supplier: {{supplier}}
Tanggal Receive: {{receiveDate}}
Delivery Type: {{deliveryType}}
Warehouse: {{warehouseLabel}}
Ref. Document: {{referenceDocument}}
Detail URL: {{detailUrl}}

Detail Item Diterima:
{{itemsTextRows}}

Email ini dikirim otomatis oleh sistem One Chitra.`,
    },
    {
        code: SYSTEM_EMAIL_TEMPLATE_CODES.stockOpnameActualCompletion,
        name: "Stock Opname Actual Completion",
        type: "notification",
        subject: "[Stock Opname Aktual] Hasil Sesi {{sessionName}}",
        variables: [
            "sessionName",
            "warehouseLabel",
            "opnameDate",
            "opnameTime",
            "location",
            "totalItems",
            "countedItems",
            "varianceItems",
            "detailUrl",
            "varianceTableRows",
            "varianceTextRows",
        ],
        recipientRoles: ["admin", "manager", "staff"],
        recipientUserIds: [],
        ccEmails: [],
        htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:920px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
    <div style="padding:24px 28px;background:#0f766e;color:#ffffff;">
      <h1 style="margin:0;font-size:24px;">Hasil Stock Opname Aktual</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:.95;">Sesi <strong>{{sessionName}}</strong> telah ditutup.</p>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f8fafc;">
        <tbody>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;width:220px;"><strong>Warehouse</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{warehouseLabel}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Tanggal / Waktu</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{opnameDate}} {{opnameTime}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Lokasi</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{location}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Total Item</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{totalItems}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Sudah Dihitung</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{countedItems}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Item Selisih</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{varianceItems}}</td></tr>
          <tr><td style="padding:10px 12px;border:1px solid #dbe2ea;"><strong>Detail URL</strong></td><td style="padding:10px 12px;border:1px solid #dbe2ea;">{{detailUrl}}</td></tr>
        </tbody>
      </table>
      <h3 style="margin:0 0 10px;font-size:16px;color:#0f172a;">Detail Selisih (Top 25)</h3>
      <table style="width:100%;border-collapse:collapse;">
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
        <tbody>
          {{varianceTableRows}}
        </tbody>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#64748b;">Email ini dikirim otomatis oleh sistem One Chitra.</p>
    </div>
  </div>
</body>
</html>`,
        textContent: `Hasil Stock Opname Aktual

Sesi: {{sessionName}}
Warehouse: {{warehouseLabel}}
Tanggal / Waktu: {{opnameDate}} {{opnameTime}}
Lokasi: {{location}}
Total Item: {{totalItems}}
Sudah Dihitung: {{countedItems}}
Item Selisih: {{varianceItems}}
Detail URL: {{detailUrl}}

Detail Selisih:
{{varianceTextRows}}

Email ini dikirim otomatis oleh sistem One Chitra.`,
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

    if (missingTemplates.length === 0) {
        return
    }

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
            isActive: true,
        })),
    )
}
