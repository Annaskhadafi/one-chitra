"use server"

import { db } from "@/db"
import {
    user,
    vendorInvoices,
    vendorPaymentBatches,
    vendorTenants,
    vendorTenantUsers,
    vendorInvoiceLogs,
    zvendorPoReportSap,
    me2lPurchDocsSap,
} from "@/db/schema"
import {
    calculateCutOffAndSchedule,
    calculatePaymentProjections,
    calculateTaxAndTotals,
    getDueDateUrgency,
} from "@/lib/vendor-invoice-calculator"
import {
    sendInvoiceAdminVerifiedNotification,
    sendInvoiceApprovedNotification,
    sendInvoicePaymentProofNotification,
    sendInvoiceRejectedNotification,
    sendInvoiceSubmittedNotification,
    sendVendorInvitationEmail,
} from "@/lib/vendor-invoice-notifications"
import { requireApiSession } from "@/lib/api-auth"
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import * as crypto from "crypto"

/**
 * Mendapatkan sesi pengguna aktif dari better-auth
 */
async function getActiveUser() {
    try {
        const session = await requireApiSession()
        return session?.user ?? null
    } catch {
        return null
    }
}

/**
 * Mendapatkan profil Vendor Tenant yang terhubung dengan pengguna aktif (Multi-tenant check)
 */
export async function getVendorTenantForCurrentUser() {
    const currentUser = await getActiveUser()
    if (!currentUser) return null

    const mapping = await db
        .select({
            tenant: vendorTenants,
            role: vendorTenantUsers.role,
        })
        .from(vendorTenantUsers)
        .innerJoin(vendorTenants, eq(vendorTenantUsers.tenantId, vendorTenants.id))
        .where(eq(vendorTenantUsers.userId, currentUser.id))
        .limit(1)

    if (mapping.length === 0) return null
    return {
        ...mapping[0].tenant,
        userRoleInTenant: mapping[0].role,
        currentUserId: currentUser.id,
    }
}

/**
 * 1. Hybrid Lookup: Cari PO pada tabel internal SAP (zvendorPoReportSap / me2lPurchDocsSap)
 */
export async function lookupSapPoForVendorAction(poNumber: string) {
    if (!poNumber?.trim()) {
        return { found: false, message: "Nomor PO kosong" }
    }

    const cleanPo = poNumber.trim()

    // 1. Cek pada zvendorPoReportSap
    const sapReportMatches = await db
        .select()
        .from(zvendorPoReportSap)
        .where(eq(zvendorPoReportSap.poNo, cleanPo))
        .limit(5)

    if (sapReportMatches.length > 0) {
        const first = sapReportMatches[0]
        const totalNetValue = sapReportMatches.reduce(
            (acc, curr) => acc + (Number(curr.netValue) || 0),
            0
        )

        return {
            found: true,
            source: "zvendor_po_report_sap",
            poNumber: cleanPo,
            vendorName: first.vendorName || "Tidak Diketahui",
            vendorCode: first.vendorCode,
            currency: first.currency || "IDR",
            netValue: totalNetValue,
            poDate: first.poDate ? new Date(first.poDate).toISOString() : null,
            itemsCount: sapReportMatches.length,
            materialSummary: sapReportMatches.map((m) => m.shortText).filter(Boolean).join(", "),
        }
    }

    // 2. Cek pada me2lPurchDocsSap
    const me2lMatches = await db
        .select()
        .from(me2lPurchDocsSap)
        .where(eq(me2lPurchDocsSap.purchasingDoc, cleanPo))
        .limit(5)

    if (me2lMatches.length > 0) {
        const first = me2lMatches[0]
        const totalNet = me2lMatches.reduce(
            (acc, curr) => acc + (Number(curr.netOrderValue) || 0),
            0
        )

        return {
            found: true,
            source: "me2l_purch_docs_sap",
            poNumber: cleanPo,
            vendorName: first.vendorName || "Tidak Diketahui",
            currency: first.currency || "IDR",
            netValue: totalNet,
            poDate: first.docDate ? new Date(first.docDate).toISOString() : null,
            itemsCount: me2lMatches.length,
            materialSummary: me2lMatches.map((m) => m.shortText).filter(Boolean).join(", "),
        }
    }

    return {
        found: false,
        poNumber: cleanPo,
        message: "PO tidak ditemukan di database SAP One Chitra (Admin dapat memverifikasi manual).",
    }
}

/**
 * 2. Mengambil Statistik Dashboard & Proyeksi 3 Bulan
 */
export async function getVendorInvoiceDashboardStats() {
    const allInvoices = await db
        .select({
            id: vendorInvoices.id,
            status: vendorInvoices.status,
            grandTotal: vendorInvoices.grandTotal,
            scheduledPaymentDate: vendorInvoices.scheduledPaymentDate,
            paymentDueDate: vendorInvoices.paymentDueDate,
            invoiceDate: vendorInvoices.invoiceDate,
            paidAt: vendorInvoices.paidAt,
            currency: vendorInvoices.currency,
        })
        .from(vendorInvoices)

    const now = new Date()
    const curYear = now.getFullYear()
    const curMonth = now.getMonth()

    let totalActive = 0
    let countSubmitted = 0
    let countVerifiedAdmin = 0
    let countValidatedFinance = 0
    let countApprovedManager = 0
    let countPaid = 0
    let countRejected = 0

    let totalAmountApproved = 0
    let totalAmountPaidThisMonth = 0

    const urgentInvoices: Array<{
        id: string
        scheduledPaymentDate: Date | null
        grandTotal: number
        status: string
        urgency: ReturnType<typeof getDueDateUrgency>
    }> = []

    for (const inv of allInvoices) {
        const amount = Number(inv.grandTotal) || 0

        switch (inv.status) {
            case "submitted":
                countSubmitted++
                totalActive++
                break
            case "verified_admin":
                countVerifiedAdmin++
                totalActive++
                break
            case "validated_finance":
                countValidatedFinance++
                totalActive++
                break
            case "approved_manager":
                countApprovedManager++
                totalActive++
                totalAmountApproved += amount
                break
            case "paid":
                countPaid++
                if (inv.paidAt) {
                    const pDate = new Date(inv.paidAt)
                    if (pDate.getFullYear() === curYear && pDate.getMonth() === curMonth) {
                        totalAmountPaidThisMonth += amount
                    }
                }
                break
            case "rejected_admin":
            case "rejected_finance":
            case "rejected_manager":
                countRejected++
                break
        }

        if (inv.status !== "paid" && inv.scheduledPaymentDate) {
            const urgency = getDueDateUrgency(inv.scheduledPaymentDate, inv.status, now)
            if (urgency.urgency === "overdue" || urgency.urgency === "due_this_week") {
                urgentInvoices.push({
                    id: inv.id,
                    scheduledPaymentDate: inv.scheduledPaymentDate,
                    grandTotal: amount,
                    status: inv.status,
                    urgency,
                })
            }
        }
    }

    const projections = calculatePaymentProjections(
        allInvoices.map((inv) => ({
            scheduledPaymentDate: inv.scheduledPaymentDate,
            grandTotal: inv.grandTotal,
            status: inv.status,
        })),
        now
    )

    return {
        summary: {
            totalActive,
            countSubmitted,
            countVerifiedAdmin,
            countValidatedFinance,
            countApprovedManager,
            countPaid,
            countRejected,
            totalAmountApproved,
            totalAmountPaidThisMonth,
        },
        projections,
        urgentInvoices,
    }
}

/**
 * 3. Mengambil Daftar Invoice dengan filter
 */
export async function getVendorInvoicesAction(params?: {
    tenantId?: string
    status?: string
    search?: string
    limit?: number
}) {
    const conditions = []

    if (params?.tenantId) {
        conditions.push(eq(vendorInvoices.tenantId, params.tenantId))
    }

    if (params?.status && params.status !== "all") {
        conditions.push(eq(vendorInvoices.status, params.status as any))
    }

    if (params?.search?.trim()) {
        const query = `%${params.search.trim()}%`
        conditions.push(
            or(
                ilike(vendorInvoices.invoiceNumber, query),
                ilike(vendorInvoices.poNumber, query)
            )
        )
    }

    const list = await db
        .select({
            invoice: vendorInvoices,
            tenant: {
                id: vendorTenants.id,
                code: vendorTenants.code,
                name: vendorTenants.name,
                email: vendorTenants.email,
                bankName: vendorTenants.bankName,
                bankAccountNo: vendorTenants.bankAccountNo,
                bankAccountHolder: vendorTenants.bankAccountHolder,
                isPkp: vendorTenants.isPkp,
            },
            batch: {
                id: vendorPaymentBatches.id,
                batchCode: vendorPaymentBatches.batchCode,
                paymentDate: vendorPaymentBatches.paymentDate,
            },
        })
        .from(vendorInvoices)
        .innerJoin(vendorTenants, eq(vendorInvoices.tenantId, vendorTenants.id))
        .leftJoin(
            vendorPaymentBatches,
            eq(vendorInvoices.paymentBatchId, vendorPaymentBatches.id)
        )
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(vendorInvoices.createdAt))
        .limit(params?.limit || 100)

    return list.map((item) => ({
        ...item.invoice,
        tenant: item.tenant,
        batch: item.batch,
        urgency: getDueDateUrgency(item.invoice.scheduledPaymentDate, item.invoice.status),
    }))
}

/**
 * 4. Detail Invoice Lengkap beserta Log Audit Timeline
 */
export async function getVendorInvoiceByIdAction(id: string) {
    if (!id) return null

    const found = await db
        .select({
            invoice: vendorInvoices,
            tenant: vendorTenants,
            batch: vendorPaymentBatches,
        })
        .from(vendorInvoices)
        .innerJoin(vendorTenants, eq(vendorInvoices.tenantId, vendorTenants.id))
        .leftJoin(
            vendorPaymentBatches,
            eq(vendorInvoices.paymentBatchId, vendorPaymentBatches.id)
        )
        .where(eq(vendorInvoices.id, id))
        .limit(1)

    if (found.length === 0) return null

    const logs = await db
        .select()
        .from(vendorInvoiceLogs)
        .where(eq(vendorInvoiceLogs.invoiceId, id))
        .orderBy(desc(vendorInvoiceLogs.createdAt))

    return {
        ...found[0].invoice,
        tenant: found[0].tenant,
        batch: found[0].batch,
        logs,
        urgency: getDueDateUrgency(
            found[0].invoice.scheduledPaymentDate,
            found[0].invoice.status
        ),
    }
}

/**
 * 5. Admin Mengundang Vendor Baru (Invite-Only Vendor Registration)
 */
export async function inviteVendorAction(data: {
    name: string
    email: string
    phone?: string
    address?: string
    defaultTopDays?: number
    isPkp?: boolean
    npwp?: string
    bankName?: string
    bankAccountNo?: string
    bankAccountHolder?: string
}) {
    const currentUser = await getActiveUser()
    const cleanEmail = data.email.trim().toLowerCase()

    // Cek apakah email sudah terdaftar
    const existing = await db
        .select()
        .from(vendorTenants)
        .where(eq(vendorTenants.email, cleanEmail))
        .limit(1)

    if (existing.length > 0) {
        return { success: false, error: "Email vendor sudah terdaftar sebelumnya." }
    }

    const invitationToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Berlaku 7 hari

    // Generate kode vendor VND-XXXX
    const countTenants = await db.select({ count: sql<number>`count(*)` }).from(vendorTenants)
    const code = `VND-${String(Number(countTenants[0]?.count || 0) + 1).padStart(4, "0")}`

    const [newTenant] = await db
        .insert(vendorTenants)
        .values({
            code,
            name: data.name.trim(),
            email: cleanEmail,
            phone: data.phone?.trim(),
            address: data.address?.trim(),
            defaultTopDays: Number(data.defaultTopDays) || 30,
            isPkp: Boolean(data.isPkp),
            npwp: data.npwp?.trim(),
            bankName: data.bankName?.trim(),
            bankAccountNo: data.bankAccountNo?.trim(),
            bankAccountHolder: data.bankAccountHolder?.trim(),
            status: "pending_invitation",
            invitationToken,
            invitationExpiresAt: expiresAt,
            invitedAt: new Date(),
            invitedBy: currentUser?.id,
        })
        .returning()

    // Kirim email undangan
    await sendVendorInvitationEmail({
        vendorName: data.name,
        vendorEmail: cleanEmail,
        token: invitationToken,
        inviterName: currentUser?.name || "Admin One Chitra",
    })

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true, tenant: newTenant }
}

/**
 * 6. Mengambil Detail Undangan Berdasarkan Token
 */
export async function getVendorInvitationDetailsAction(token: string) {
    if (!token?.trim()) return null

    const found = await db
        .select()
        .from(vendorTenants)
        .where(eq(vendorTenants.invitationToken, token.trim()))
        .limit(1)

    if (found.length === 0) return null
    const tenant = found[0]

    if (tenant.invitationExpiresAt && new Date() > new Date(tenant.invitationExpiresAt)) {
        return { error: "Undangan telah kedaluwarsa. Silakan hubungi Admin One Chitra." }
    }

    return { tenant }
}

/**
 * 7. Vendor Menerima Undangan & Aktivasi Akun (Create/Link Account & Password)
 */
export async function acceptVendorInvitationAction(data: {
    token: string
    password: string
    contactName: string
    phone?: string
    bankName?: string
    bankAccountNo?: string
    bankAccountHolder?: string
    npwp?: string
    address?: string
}) {
    if (!data.token || !data.password || data.password.length < 8) {
        return { success: false, error: "Password minimal harus 8 karakter." }
    }

    const invitation = await getVendorInvitationDetailsAction(data.token)
    if (!invitation || "error" in invitation) {
        return { success: false, error: (invitation as any)?.error || "Token undangan tidak valid." }
    }

    const tenant = invitation.tenant

    // 1. Cek atau buat user di tabel "user"
    const existingUser = await db
        .select()
        .from(user)
        .where(eq(user.email, tenant.email))
        .limit(1)

    let userId: string

    if (existingUser.length > 0) {
        userId = existingUser[0].id
        // Update user role to vendor
        await db.update(user).set({ role: "vendor" }).where(eq(user.id, userId))
    } else {
        userId = crypto.randomUUID()
        await db.insert(user).values({
            id: userId,
            name: data.contactName.trim() || tenant.name,
            email: tenant.email,
            role: "vendor",
            emailVerified: true,
        })
    }

    // 2. Hash password dan simpan ke Better-Auth account table
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(data.password, salt)

    await db.execute(sql`
        INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (
            ${crypto.randomUUID()},
            ${userId},
            'credential',
            ${userId},
            ${hashedPassword},
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET password = ${hashedPassword}, updated_at = NOW();
    `)

    // 3. Kaitkan ke vendor_tenant_users
    await db
        .insert(vendorTenantUsers)
        .values({
            tenantId: tenant.id,
            userId,
            role: "owner",
        })
        .onConflictDoNothing()

    // 4. Perbarui data profil tenant & aktifkan status
    await db
        .update(vendorTenants)
        .set({
            status: "active",
            invitationToken: null,
            phone: data.phone || tenant.phone,
            bankName: data.bankName || tenant.bankName,
            bankAccountNo: data.bankAccountNo || tenant.bankAccountNo,
            bankAccountHolder: data.bankAccountHolder || tenant.bankAccountHolder,
            npwp: data.npwp || tenant.npwp,
            address: data.address || tenant.address,
            updatedAt: new Date(),
        })
        .where(eq(vendorTenants.id, tenant.id))

    return { success: true, email: tenant.email }
}

/**
 * 8. Vendor Mengajukan Invoice Baru (Draft/Submitted -> Notifikasi ke Admin)
 */
export async function submitVendorInvoiceAction(data: {
    tenantId: string
    invoiceNumber: string
    poNumber: string
    invoiceDate: string
    subtotal: number
    ppnPercent?: number
    pphPercent?: number
    currency?: string
    topDays?: number
    invoiceFileUrl: string
    taxInvoiceFileUrl?: string
    poFileUrl?: string
    deliveryReceiptFileUrl?: string
    additionalFileUrl?: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) {
        return { success: false, error: "Sesi telah berakhir. Silakan login kembali." }
    }

    // Ambil tenant untuk validasi
    const tenant = await db
        .select()
        .from(vendorTenants)
        .where(eq(vendorTenants.id, data.tenantId))
        .limit(1)

    if (tenant.length === 0) {
        return { success: false, error: "Organisasi vendor tidak ditemukan." }
    }

    const { ppnAmount, pphAmount, grandTotal } = calculateTaxAndTotals({
        subtotal: data.subtotal,
        ppnPercent: data.ppnPercent ?? (tenant[0].isPkp ? 11 : 0),
        pphPercent: data.pphPercent ?? 0,
    })

    const topDays = Number(data.topDays) || tenant[0].defaultTopDays || 30

    // Simpan invoice
    const [newInvoice] = await db
        .insert(vendorInvoices)
        .values({
            tenantId: data.tenantId,
            invoiceNumber: data.invoiceNumber.trim(),
            poNumber: data.poNumber.trim(),
            invoiceDate: new Date(data.invoiceDate),
            subtotal: String(data.subtotal),
            ppnPercent: String(data.ppnPercent ?? 11),
            ppnAmount: String(ppnAmount),
            pphPercent: String(data.pphPercent ?? 0),
            pphAmount: String(pphAmount),
            grandTotal: String(grandTotal),
            currency: data.currency || "IDR",
            topDays,
            status: "submitted",
            invoiceFileUrl: data.invoiceFileUrl,
            taxInvoiceFileUrl: data.taxInvoiceFileUrl,
            poFileUrl: data.poFileUrl,
            deliveryReceiptFileUrl: data.deliveryReceiptFileUrl,
            additionalFileUrl: data.additionalFileUrl,
            createdBy: currentUser.id,
        })
        .returning()

    // Log riwayat
    await db.insert(vendorInvoiceLogs).values({
        invoiceId: newInvoice.id,
        action: "submitted",
        actorId: currentUser.id,
        actorName: currentUser.name || "Vendor",
        actorRole: "vendor",
        notes: `Pengajuan invoice baru nomor ${newInvoice.invoiceNumber}`,
    })

    // Kirim notifikasi email ke Admin
    await sendInvoiceSubmittedNotification({
        invoiceNumber: newInvoice.invoiceNumber,
        vendorName: tenant[0].name,
        poNumber: newInvoice.poNumber,
        grandTotal: newInvoice.grandTotal,
    })

    revalidatePath("/vendor/dashboard")
    revalidatePath("/dashboard/vendor-invoices")
    return { success: true, invoice: newInvoice }
}

/**
 * 9. Validation Gate: Admin Checklist Verification
 */
export async function verifyAdminChecklistAction(data: {
    invoiceId: string
    action: "verify" | "reject"
    checklist: {
        checklistDocValid: boolean
        checklistPoValid: boolean
        checklistCalcValid: boolean
        checklistBankValid: boolean
        checklistTaxValid: boolean
    }
    notes?: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const invoice = await getVendorInvoiceByIdAction(data.invoiceId)
    if (!invoice) return { success: false, error: "Invoice tidak ditemukan." }

    if (data.action === "verify") {
        // Mandatory: semua 5 poin harus true
        const { checklistDocValid, checklistPoValid, checklistCalcValid, checklistBankValid, checklistTaxValid } =
            data.checklist

        if (!checklistDocValid || !checklistPoValid || !checklistCalcValid || !checklistBankValid || !checklistTaxValid) {
            return {
                success: false,
                error: "Seluruh 5 checklist mandatory wajib terpenuhi sebelum memverifikasi invoice ke tahap Finance.",
            }
        }

        await db
            .update(vendorInvoices)
            .set({
                status: "verified_admin",
                checklistDocValid: true,
                checklistPoValid: true,
                checklistCalcValid: true,
                checklistBankValid: true,
                checklistTaxValid: true,
                adminChecklistNotes: data.notes?.trim() || null,
                adminVerifiedAt: new Date(),
                adminVerifiedBy: currentUser.id,
                rejectionReason: null,
                rejectionStage: null,
                updatedAt: new Date(),
            })
            .where(eq(vendorInvoices.id, data.invoiceId))

        await db.insert(vendorInvoiceLogs).values({
            invoiceId: data.invoiceId,
            action: "verified_admin",
            actorId: currentUser.id,
            actorName: currentUser.name || "Admin",
            actorRole: "admin",
            notes: data.notes || "Semua 5 poin mandatory checklist terpenuhi.",
        })

        // Notifikasi ke Finance
        await sendInvoiceAdminVerifiedNotification({
            invoiceNumber: invoice.invoiceNumber,
            vendorName: invoice.tenant.name,
            poNumber: invoice.poNumber,
            grandTotal: invoice.grandTotal,
        })
    } else {
        // Reject
        if (!data.notes?.trim()) {
            return { success: false, error: "Alasan penolakan dan instruksi revisi wajib diisi." }
        }

        await db
            .update(vendorInvoices)
            .set({
                status: "rejected_admin",
                rejectionStage: "Admin Checklist",
                rejectionReason: data.notes.trim(),
                checklistDocValid: data.checklist.checklistDocValid,
                checklistPoValid: data.checklist.checklistPoValid,
                checklistCalcValid: data.checklist.checklistCalcValid,
                checklistBankValid: data.checklist.checklistBankValid,
                checklistTaxValid: data.checklist.checklistTaxValid,
                updatedAt: new Date(),
            })
            .where(eq(vendorInvoices.id, data.invoiceId))

        await db.insert(vendorInvoiceLogs).values({
            invoiceId: data.invoiceId,
            action: "rejected_admin",
            actorId: currentUser.id,
            actorName: currentUser.name || "Admin",
            actorRole: "admin",
            notes: `Ditolak Admin: ${data.notes.trim()}`,
        })

        // Kirim email penolakan ke vendor
        await sendInvoiceRejectedNotification({
            invoiceNumber: invoice.invoiceNumber,
            vendorName: invoice.tenant.name,
            vendorEmail: invoice.tenant.email,
            stage: "Validation Gate Admin",
            reason: data.notes.trim(),
        })
    }

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true }
}

/**
 * 10. Finance Validation & Cut-Off Engine Execution
 */
export async function validateFinanceInvoiceAction(data: {
    invoiceId: string
    action: "validate" | "reject"
    notes?: string
    overrideTopDays?: number
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const invoice = await getVendorInvoiceByIdAction(data.invoiceId)
    if (!invoice) return { success: false, error: "Invoice tidak ditemukan." }

    if (data.action === "validate") {
        const now = new Date()
        const effectiveTopDays = data.overrideTopDays ?? invoice.topDays ?? 30

        // Jalankan kalkulator cut-off, TOP, dan jadwal bayar
        const schedule = calculateCutOffAndSchedule({
            financeValidatedDate: now,
            topDays: effectiveTopDays,
        })

        await db
            .update(vendorInvoices)
            .set({
                status: "validated_finance",
                topDays: effectiveTopDays,
                financeValidatedAt: now,
                financeValidatedBy: currentUser.id,
                financeNotes: data.notes?.trim() || null,
                bookReceivedDate: schedule.bookReceivedDate,
                paymentDueDate: schedule.paymentDueDate,
                scheduledPaymentDate: schedule.scheduledPaymentDate,
                rejectionReason: null,
                rejectionStage: null,
                updatedAt: now,
            })
            .where(eq(vendorInvoices.id, data.invoiceId))

        await db.insert(vendorInvoiceLogs).values({
            invoiceId: data.invoiceId,
            action: "validated_finance",
            actorId: currentUser.id,
            actorName: currentUser.name || "Finance",
            actorRole: "finance",
            notes: `Validasi Finance berhasil. Buku: ${schedule.bookReceivedDate.toISOString().slice(0, 10)}, Jadwal Bayar: ${schedule.scheduledPaymentDate.toISOString().slice(0, 10)}.`,
            metadata: {
                bookReceivedDate: schedule.bookReceivedDate,
                paymentDueDate: schedule.paymentDueDate,
                scheduledPaymentDate: schedule.scheduledPaymentDate,
            },
        })
    } else {
        if (!data.notes?.trim()) {
            return { success: false, error: "Alasan penolakan Finance wajib diisi." }
        }

        await db
            .update(vendorInvoices)
            .set({
                status: "rejected_finance",
                rejectionStage: "Finance Validation",
                rejectionReason: data.notes.trim(),
                updatedAt: new Date(),
            })
            .where(eq(vendorInvoices.id, data.invoiceId))

        await db.insert(vendorInvoiceLogs).values({
            invoiceId: data.invoiceId,
            action: "rejected_finance",
            actorId: currentUser.id,
            actorName: currentUser.name || "Finance",
            actorRole: "finance",
            notes: `Ditolak Finance: ${data.notes.trim()}`,
        })

        await sendInvoiceRejectedNotification({
            invoiceNumber: invoice.invoiceNumber,
            vendorName: invoice.tenant.name,
            vendorEmail: invoice.tenant.email,
            stage: "Validasi Pajak & Nominal Finance",
            reason: data.notes.trim(),
        })
    }

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true }
}

/**
 * 11. Manager Authorization & Approval
 */
export async function approveManagerInvoiceAction(data: {
    invoiceId: string
    action: "approve" | "reject"
    notes?: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const invoice = await getVendorInvoiceByIdAction(data.invoiceId)
    if (!invoice) return { success: false, error: "Invoice tidak ditemukan." }

    if (data.action === "approve") {
        await db
            .update(vendorInvoices)
            .set({
                status: "approved_manager",
                managerApprovedAt: new Date(),
                managerApprovedBy: currentUser.id,
                managerNotes: data.notes?.trim() || null,
                rejectionReason: null,
                rejectionStage: null,
                updatedAt: new Date(),
            })
            .where(eq(vendorInvoices.id, data.invoiceId))

        await db.insert(vendorInvoiceLogs).values({
            invoiceId: data.invoiceId,
            action: "approved_manager",
            actorId: currentUser.id,
            actorName: currentUser.name || "Manager",
            actorRole: "manager",
            notes: data.notes || "Otorisasi persetujuan pembayaran disetujui Manager.",
        })

        // Notifikasi ke Vendor
        await sendInvoiceApprovedNotification({
            invoiceNumber: invoice.invoiceNumber,
            vendorName: invoice.tenant.name,
            vendorEmail: invoice.tenant.email,
            grandTotal: invoice.grandTotal,
            scheduledPaymentDate: invoice.scheduledPaymentDate
                ? new Date(invoice.scheduledPaymentDate).toLocaleDateString("id-ID", {
                      dateStyle: "full",
                  })
                : null,
        })
    } else {
        if (!data.notes?.trim()) {
            return { success: false, error: "Alasan penolakan Manager wajib diisi." }
        }

        await db
            .update(vendorInvoices)
            .set({
                status: "rejected_manager",
                rejectionStage: "Manager Approval",
                rejectionReason: data.notes.trim(),
                updatedAt: new Date(),
            })
            .where(eq(vendorInvoices.id, data.invoiceId))

        await db.insert(vendorInvoiceLogs).values({
            invoiceId: data.invoiceId,
            action: "rejected_manager",
            actorId: currentUser.id,
            actorName: currentUser.name || "Manager",
            actorRole: "manager",
            notes: `Ditolak Manager: ${data.notes.trim()}`,
        })

        await sendInvoiceRejectedNotification({
            invoiceNumber: invoice.invoiceNumber,
            vendorName: invoice.tenant.name,
            vendorEmail: invoice.tenant.email,
            stage: "Otorisasi Manager",
            reason: data.notes.trim(),
        })
    }

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true }
}

/**
 * 12. Batch Payment Checkout & Automatic Payment Proof Email to Vendors
 */
export async function createPaymentBatchCheckoutAction(data: {
    invoiceIds: string[]
    bankSource: string
    proofFileUrl: string
    referenceNo?: string
    notes?: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    if (!data.invoiceIds || data.invoiceIds.length === 0) {
        return { success: false, error: "Pilih setidaknya 1 invoice untuk di-checkout." }
    }

    if (!data.bankSource?.trim()) {
        return { success: false, error: "Sumber rekening bank pembayaran wajib diisi." }
    }

    if (!data.proofFileUrl?.trim()) {
        return { success: false, error: "Bukti transfer perbankan wajib diunggah." }
    }

    // Ambil semua invoice terpilih yang berstatus approved_manager
    const selectedInvoices = await db
        .select({
            invoice: vendorInvoices,
            tenant: vendorTenants,
        })
        .from(vendorInvoices)
        .innerJoin(vendorTenants, eq(vendorInvoices.tenantId, vendorTenants.id))
        .where(
            and(
                inArray(vendorInvoices.id, data.invoiceIds),
                eq(vendorInvoices.status, "approved_manager")
            )
        )

    if (selectedInvoices.length === 0) {
        return {
            success: false,
            error: "Tidak ada invoice berstatus Approved yang valid untuk diproses.",
        }
    }

    const totalAmount = selectedInvoices.reduce(
        (acc, item) => acc + (Number(item.invoice.grandTotal) || 0),
        0
    )

    // Generate batch code: BATCH-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    const batchCode = `BATCH-${dateStr}-${randomSuffix}`
    const now = new Date()

    // 1. Simpan Batch
    const [batch] = await db
        .insert(vendorPaymentBatches)
        .values({
            batchCode,
            paymentDate: now,
            totalAmount: String(totalAmount),
            totalInvoices: selectedInvoices.length,
            bankSource: data.bankSource.trim(),
            proofFileUrl: data.proofFileUrl,
            referenceNo: data.referenceNo?.trim() || null,
            notes: data.notes?.trim() || null,
            disbursedBy: currentUser.id,
        })
        .returning()

    // 2. Perbarui seluruh invoice terpilih menjadi "paid"
    for (const item of selectedInvoices) {
        await db
            .update(vendorInvoices)
            .set({
                status: "paid",
                paymentBatchId: batch.id,
                paidAt: now,
                paidProofUrl: data.proofFileUrl,
                paidReferenceNo: data.referenceNo?.trim() || null,
                paidEmailSentAt: now,
                updatedAt: now,
            })
            .where(eq(vendorInvoices.id, item.invoice.id))

        await db.insert(vendorInvoiceLogs).values({
            invoiceId: item.invoice.id,
            action: "paid",
            actorId: currentUser.id,
            actorName: currentUser.name || "Finance Disbursement",
            actorRole: "finance",
            notes: `Pembayaran berhasil via Batch ${batchCode}. Rekening: ${data.bankSource}.`,
            metadata: {
                batchId: batch.id,
                batchCode,
                proofUrl: data.proofFileUrl,
            },
        })

        // 3. MANDATORI (Komentar Pengguna): Bukti payment otomatis teremail ke vendor!
        try {
            await sendInvoicePaymentProofNotification({
                invoiceNumber: item.invoice.invoiceNumber,
                vendorName: item.tenant.name,
                vendorEmail: item.tenant.email,
                grandTotal: item.invoice.grandTotal,
                paymentBatchCode: batchCode,
                paymentDate: now.toLocaleDateString("id-ID", { dateStyle: "long" }),
                bankSource: data.bankSource,
                referenceNo: data.referenceNo,
                proofUrl: data.proofFileUrl,
            })
        } catch (emailErr) {
            console.error(`Gagal mengirim bukti bayar ke vendor ${item.tenant.email}:`, emailErr)
        }
    }

    revalidatePath("/dashboard/vendor-invoices")
    revalidatePath("/vendor/dashboard")
    return { success: true, batch }
}

/**
 * 13. Mengambil Semua Master Vendor Tenant (Admin View)
 */
export async function getAllVendorTenantsAction() {
    const tenants = await db
        .select({
            id: vendorTenants.id,
            code: vendorTenants.code,
            name: vendorTenants.name,
            email: vendorTenants.email,
            phone: vendorTenants.phone,
            address: vendorTenants.address,
            npwp: vendorTenants.npwp,
            isPkp: vendorTenants.isPkp,
            bankName: vendorTenants.bankName,
            bankAccountNo: vendorTenants.bankAccountNo,
            bankAccountHolder: vendorTenants.bankAccountHolder,
            defaultTopDays: vendorTenants.defaultTopDays,
            status: vendorTenants.status,
            invitedAt: vendorTenants.invitedAt,
            createdAt: vendorTenants.createdAt,
        })
        .from(vendorTenants)
        .orderBy(desc(vendorTenants.createdAt))

    return tenants
}

