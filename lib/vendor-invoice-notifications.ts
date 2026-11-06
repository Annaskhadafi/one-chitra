import { sendEmail } from "@/lib/email"
import { getCanonicalAppUrl } from "@/lib/app-url"
import { toAbsoluteUploadDocumentUrl } from "@/lib/upload-url"
import { db } from "@/db"
import { user } from "@/db/schema"
import { eq, or } from "drizzle-orm"

function formatCurrency(amount: number | string): string {
    const num = Number(amount) || 0
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(num)
}

async function getAdminEmails(): Promise<string[]> {
    try {
        const admins = await db
            .select({ email: user.email })
            .from(user)
            .where(or(eq(user.role, "admin"), eq(user.role, "superadmin"), eq(user.role, "scm")))
            .limit(10)

        const list = admins.map((a) => a.email).filter(Boolean)
        return list.length > 0 ? list : ["admin@chitraparatama.com"]
    } catch {
        return ["admin@chitraparatama.com"]
    }
}

async function getFinanceEmails(): Promise<string[]> {
    try {
        const finances = await db
            .select({ email: user.email })
            .from(user)
            .where(or(eq(user.role, "finance"), eq(user.role, "admin"), eq(user.role, "superadmin")))
            .limit(10)

        const list = finances.map((f) => f.email).filter(Boolean)
        return list.length > 0 ? list : ["finance@chitraparatama.com"]
    } catch {
        return ["finance@chitraparatama.com"]
    }
}

/**
 * 1. Email Undangan Pendaftaran Akun Vendor (Invite-only)
 */
export async function sendVendorInvitationEmail(params: {
    vendorName: string
    vendorEmail: string
    token: string
    inviterName?: string
}) {
    const baseUrl = getCanonicalAppUrl()
    const inviteUrl = `${baseUrl}/vendor/invitation/${params.token}`

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #0f172a; margin: 0;">Undangan Portal Vendor One Chitra</h2>
            <p style="color: #64748b; font-size: 14px;">PT Chitra Paratama</p>
        </div>
        <p>Yth. Rekan Vendor <strong>${params.vendorName}</strong>,</p>
        <p>Anda telah diundang ${params.inviterName ? `oleh <strong>${params.inviterName}</strong>` : ""} untuk mengakses <strong>Portal Vendor One Chitra</strong> guna mengelola penagihan invoice, memantau status persetujuan, dan jadwal pembayaran secara langsung.</p>
        <div style="margin: 32px 0; text-align: center;">
            <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Aktivasi Akun & Lengkapi Profil
            </a>
        </div>
        <p style="font-size: 13px; color: #64748b;">Tautan ini berlaku selama 7 hari. Jika tombol di atas tidak berfungsi, salin tautan berikut ke peramban Anda:<br/>
        <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Email ini dikirim otomatis oleh One Chitra Vendor Management System.</p>
    </div>
    `

    return sendEmail({
        to: params.vendorEmail,
        subject: `[One Chitra] Undangan Portal Vendor - ${params.vendorName}`,
        html,
        text: `Undangan Portal Vendor One Chitra untuk ${params.vendorName}. Silakan aktivasi akun melalui tautan: ${inviteUrl}`,
    })
}

/**
 * 2. Notifikasi Invoice Baru Diajukan oleh Vendor (Draft/Submitted -> Notif ke Admin)
 */
export async function sendInvoiceSubmittedNotification(params: {
    invoiceNumber: string
    vendorName: string
    poNumber: string
    grandTotal: number | string
}) {
    const adminRecipients = await getAdminEmails()
    const baseUrl = getCanonicalAppUrl()
    const reviewUrl = `${baseUrl}/dashboard/vendor-invoices?tab=admin`

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #0f172a; margin-top: 0;">Pengajuan Invoice Baru Menunggu Verifikasi Admin</h3>
        <p>Vendor telah mengajukan faktur tagihan baru yang memerlukan pengecekan <strong>Validation Gate (Checklist Dokumen)</strong>:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
            <tr><td style="padding: 8px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Vendor:</td><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">${params.vendorName}</td></tr>
            <tr><td style="padding: 8px; color: #64748b; border-bottom: 1px solid #f1f5f9;">No. Invoice:</td><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">${params.invoiceNumber}</td></tr>
            <tr><td style="padding: 8px; color: #64748b; border-bottom: 1px solid #f1f5f9;">No. PO:</td><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">${params.poNumber}</td></tr>
            <tr><td style="padding: 8px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Grand Total:</td><td style="padding: 8px; font-weight: bold; color: #2563eb; border-bottom: 1px solid #f1f5f9;">${formatCurrency(params.grandTotal)}</td></tr>
        </table>
        <div style="margin: 24px 0; text-align: center;">
            <a href="${reviewUrl}" style="background-color: #0f172a; color: #ffffff; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Buka Validation Gate Admin
            </a>
        </div>
    </div>
    `

    return sendEmail({
        to: adminRecipients,
        subject: `[Invoice Baru] ${params.vendorName} - ${params.invoiceNumber} (PO: ${params.poNumber})`,
        html,
        text: `Invoice baru diajukan oleh ${params.vendorName} (${params.invoiceNumber}, PO: ${params.poNumber}). Total: ${formatCurrency(params.grandTotal)}. Harap verifikasi di: ${reviewUrl}`,
    })
}

/**
 * 3. Notifikasi Invoice Lolos Admin (Verified -> Notif ke Finance Siap Divalidasi)
 */
export async function sendInvoiceVerifiedNotification(params: {
    invoiceNumber: string
    vendorName: string
    poNumber: string
    grandTotal: number | string
}) {
    const financeRecipients = await getFinanceEmails()
    const baseUrl = getCanonicalAppUrl()
    const financeUrl = `${baseUrl}/dashboard/vendor-invoices?tab=finance`

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="color: #0f172a; margin-top: 0;">Invoice Terverifikasi Admin - Siap Divalidasi Finance</h3>
        <p>Admin telah memverifikasi kelengkapan dokumen dan kesesuaian PO untuk invoice berikut:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
            <tr><td style="padding: 8px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Vendor:</td><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">${params.vendorName}</td></tr>
            <tr><td style="padding: 8px; color: #64748b; border-bottom: 1px solid #f1f5f9;">No. Invoice:</td><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">${params.invoiceNumber}</td></tr>
            <tr><td style="padding: 8px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Grand Total:</td><td style="padding: 8px; font-weight: bold; color: #16a34a; border-bottom: 1px solid #f1f5f9;">${formatCurrency(params.grandTotal)}</td></tr>
        </table>
        <div style="margin: 24px 0; text-align: center;">
            <a href="${financeUrl}" style="background-color: #16a34a; color: #ffffff; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Validasi Pajak & Akurasi Nominal
            </a>
        </div>
    </div>
    `

    return sendEmail({
        to: financeRecipients,
        subject: `[Siap Validasi Finance] ${params.vendorName} - ${params.invoiceNumber}`,
        html,
        text: `Invoice ${params.invoiceNumber} dari ${params.vendorName} telah lolos checklist admin dan siap divalidasi finance di: ${financeUrl}`,
    })
}

/**
 * 4. Email Penolakan Invoice ke Vendor (Rejected -> Email ke Vendor dengan Alasan & Revisi)
 */
export async function sendInvoiceRejectedNotification(params: {
    invoiceNumber: string
    vendorName: string
    vendorEmail: string
    stage: string // "Admin Checklist" | "Finance Validation" | "Manager Approval"
    reason: string
    notes?: string
}) {
    const baseUrl = getCanonicalAppUrl()
    const portalUrl = `${baseUrl}/vendor/invoices`

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #fecaca; border-radius: 8px; background-color: #fffaf0;">
        <h3 style="color: #b91c1c; margin-top: 0;">Pemberitahuan Revisi Invoice: ${params.invoiceNumber}</h3>
        <p>Yth. <strong>${params.vendorName}</strong>,</p>
        <p>Tagihan invoice Anda dengan nomor <strong>${params.invoiceNumber}</strong> saat ini belum dapat diproses pada tahap <strong>${params.stage}</strong>.</p>
        <div style="background-color: #ffffff; padding: 16px; border: 1px solid #fca5a5; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #991b1b;">Alasan Penolakan:</p>
            <p style="margin: 0; color: #374151;">${params.reason || "Dokumen tidak memenuhi persyaratan checklist."}</p>
            ${params.notes ? `<p style="margin: 8px 0 0 0; color: #4b5563; font-size: 13px;"><em>Instruksi Tambahan: ${params.notes}</em></p>` : ""}
        </div>
        <p>Silakan perbaiki dokumen terkait dan ajukan revisi melalui portal vendor One Chitra:</p>
        <div style="margin: 24px 0; text-align: center;">
            <a href="${portalUrl}" style="background-color: #dc2626; color: #ffffff; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Buka Portal & Ajukan Revisi
            </a>
        </div>
    </div>
    `

    return sendEmail({
        to: params.vendorEmail,
        subject: `[Revisi Diperlukan] Penolakan Invoice ${params.invoiceNumber} - ${params.vendorName}`,
        html,
        text: `Invoice ${params.invoiceNumber} memerlukan revisi pada tahap ${params.stage}. Alasan: ${params.reason}. Silakan revisi di: ${portalUrl}`,
    })
}

/**
 * 5. Notifikasi Invoice Disetujui (Approved -> Notifikasi ke Vendor)
 */
export async function sendInvoiceApprovedNotification(params: {
    invoiceNumber: string
    vendorName: string
    vendorEmail: string
    grandTotal: number | string
    scheduledPaymentDate?: string | null
}) {
    const baseUrl = getCanonicalAppUrl()
    const portalUrl = `${baseUrl}/vendor/invoices`

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #bbf7d0; border-radius: 8px; background-color: #f0fdf4;">
        <h3 style="color: #15803d; margin-top: 0;">Invoice Disetujui untuk Pembayaran</h3>
        <p>Yth. <strong>${params.vendorName}</strong>,</p>
        <p>Invoice tagihan Anda telah mendapatkan otorisasi approval dari Manajemen One Chitra dan telah dimasukkan ke dalam antrean jadwal pembayaran:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; background: #ffffff; border-radius: 6px;">
            <tr><td style="padding: 10px; color: #64748b;">No. Invoice:</td><td style="padding: 10px; font-weight: bold;">${params.invoiceNumber}</td></tr>
            <tr><td style="padding: 10px; color: #64748b;">Nominal:</td><td style="padding: 10px; font-weight: bold; color: #15803d;">${formatCurrency(params.grandTotal)}</td></tr>
            ${params.scheduledPaymentDate ? `<tr><td style="padding: 10px; color: #64748b;">Estimasi Pembayaran:</td><td style="padding: 10px; font-weight: bold; color: #2563eb;">${params.scheduledPaymentDate}</td></tr>` : ""}
        </table>
        <div style="margin: 24px 0; text-align: center;">
            <a href="${portalUrl}" style="background-color: #16a34a; color: #ffffff; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Pantau Status Pembayaran
            </a>
        </div>
    </div>
    `

    return sendEmail({
        to: params.vendorEmail,
        subject: `[Invoice Disetujui] ${params.invoiceNumber} - ${params.vendorName}`,
        html,
        text: `Invoice ${params.invoiceNumber} telah disetujui. Total: ${formatCurrency(params.grandTotal)}. Estimasi tanggal bayar: ${params.scheduledPaymentDate || "Minggu terakhir bulan jatuh tempo"}.`,
    })
}

/**
 * 6. Email Bukti Pembayaran Otomatis ke Vendor (Batch Checkout -> Bukti payment automatis teremail ke vendor)
 */
export async function sendInvoicePaymentProofNotification(params: {
    invoiceNumber: string
    vendorName: string
    vendorEmail: string
    grandTotal: number | string
    paymentBatchCode: string
    paymentDate: string
    bankSource: string
    referenceNo?: string
    proofUrl: string
}) {
    const fullProofUrl = toAbsoluteUploadDocumentUrl(params.proofUrl) || params.proofUrl

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #bfdbfe; border-radius: 8px; background-color: #eff6ff;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #1e40af; margin: 0;">Bukti Pembayaran Invoice</h2>
            <p style="color: #60a5fa; font-size: 14px; margin: 4px 0 0 0;">PT Chitra Paratama - Finance & Treasury</p>
        </div>
        <p>Yth. <strong>${params.vendorName}</strong>,</p>
        <p>Pembayaran untuk tagihan invoice Anda telah berhasil diproses melalui transfer perbankan dengan rincian sebagai berikut:</p>
        <div style="background-color: #ffffff; padding: 16px; border: 1px solid #cbd5e1; border-radius: 6px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 6px 0; color: #64748b;">No. Invoice:</td><td style="padding: 6px 0; font-weight: bold;">${params.invoiceNumber}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Jumlah Transfer:</td><td style="padding: 6px 0; font-weight: bold; color: #16a34a; font-size: 16px;">${formatCurrency(params.grandTotal)}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Tanggal Transfer:</td><td style="padding: 6px 0;">${params.paymentDate}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Sumber Rekening:</td><td style="padding: 6px 0;">${params.bankSource}</td></tr>
                ${params.referenceNo ? `<tr><td style="padding: 6px 0; color: #64748b;">No. Referensi Bank:</td><td style="padding: 6px 0; font-family: monospace;">${params.referenceNo}</td></tr>` : ""}
                <tr><td style="padding: 6px 0; color: #64748b;">No. Batch Voucher:</td><td style="padding: 6px 0; font-family: monospace;">${params.paymentBatchCode}</td></tr>
            </table>
        </div>
        <p>Anda dapat mengunduh bukti transfer resmi melalui tombol di bawah ini:</p>
        <div style="margin: 24px 0; text-align: center;">
            <a href="${fullProofUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Unduh / Lihat Bukti Transfer Bank
            </a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Terima kasih atas kerja sama Anda bersama PT Chitra Paratama.</p>
    </div>
    `

    return sendEmail({
        to: params.vendorEmail,
        subject: `[Bukti Pembayaran] Invoice ${params.invoiceNumber} - ${params.vendorName} (${formatCurrency(params.grandTotal)})`,
        html,
        text: `Pembayaran invoice ${params.invoiceNumber} sebesar ${formatCurrency(params.grandTotal)} telah berhasil diproses. Unduh bukti transfer: ${fullProofUrl}`,
    })
}
