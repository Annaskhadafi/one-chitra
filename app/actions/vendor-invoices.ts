"use server"

import { db } from "@/db"
import {
    user,
    account,
    vendorInvoices,
    vendorPaymentBatches,
    vendorTenants,
    vendorTenantUsers,
    vendorInvoiceLogs,
    sapVendorMaster,
    vendorContracts,
    vendorPoTracking,
    zvendorPoReportSap,
    me2lPurchDocsSap,
} from "@/db/schema"
import {
    calculateCutOffAndSchedule,
    calculatePaymentProjections,
    calculateTaxAndTotals,
    getDueDateUrgency,
    isPoOwnedByVendor,
} from "@/lib/vendor-invoice-calculator"
import {
    sendInvoiceVerifiedNotification,
    sendInvoiceApprovedNotification,
    sendInvoicePaymentProofNotification,
    sendInvoiceRejectedNotification,
    sendInvoiceSubmittedNotification,
    sendVendorInvitationEmail,
} from "@/lib/vendor-invoice-notifications"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { checkPermission } from "@/lib/rbac"
import { and, asc, desc, eq, ilike, inArray, not, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import * as crypto from "crypto"

/**
 * Mendapatkan sesi pengguna aktif dari better-auth
 */
async function getActiveUser() {
    try {
        const reqHeaders = await headers()
        const session = await auth.api.getSession({
            headers: reqHeaders,
        })
        if (session?.user) return session.user
    } catch (e) {
        console.error("[vendor-invoices] getActiveUser failed:", e)
    }

    // Development fallback jika cookie sesi tidak terbaca di localhost
    if (process.env.NODE_ENV !== "production") {
        try {
            const adminUser = await db.query.user.findFirst({
                where: (u, { or, eq }) => or(
                    eq(u.role, "admin"),
                    eq(u.role, "superadmin"),
                    eq(u.role, "admin procurement"),
                    eq(u.role, "procurement"),
                    eq(u.role, "scm")
                ),
            })
            if (adminUser) return adminUser
        } catch {}
    }
    return null
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
 * Mengambil daftar PO aktif (HANYA status Open atau Partial) milik vendor tertentu
 */
export async function getAvailablePosForVendorAction(tenantId: string) {
    if (!tenantId) return []

    const tenantList = await db
        .select()
        .from(vendorTenants)
        .where(eq(vendorTenants.id, tenantId))
        .limit(1)

    if (tenantList.length === 0) return []
    const tenant = tenantList[0]

    // Kumpulkan filter vendor SAP
    let conditions = []
    if (tenant.sapVendorCode) {
        conditions.push(eq(zvendorPoReportSap.vendorCode, tenant.sapVendorCode))
    }
    if (tenant.name) {
        const cleanName = tenant.name.replace(/\b(pt|cv|ud)\b/gi, "").trim()
        if (cleanName.length > 3) {
            conditions.push(ilike(zvendorPoReportSap.vendorName, `%${cleanName}%`))
        }
    }

    let rawSapRows: any[] = []
    if (conditions.length > 0) {
        rawSapRows = await db
            .select()
            .from(zvendorPoReportSap)
            .where(or(...conditions))
            .limit(500)
    }

    // Grouping baris per nomor PO
    const poMap = new Map<string, any[]>()
    for (const row of rawSapRows) {
        if (!row.poNo) continue
        const list = poMap.get(row.poNo) || []
        list.push(row)
        poMap.set(row.poNo, list)
    }

    const poNumbers = Array.from(poMap.keys())
    const existingInvoices = poNumbers.length > 0
        ? await db
            .select({
                poNumber: vendorInvoices.poNumber,
                subtotal: vendorInvoices.subtotal,
                invoicedItemsCount: vendorInvoices.invoicedItemsCount,
                status: vendorInvoices.status,
            })
            .from(vendorInvoices)
            .where(
                and(
                    inArray(vendorInvoices.poNumber, poNumbers),
                    not(inArray(vendorInvoices.status, ["rejected_admin", "rejected_finance"]))
                )
            )
        : []

    const invoicesPerPo = new Map<string, typeof existingInvoices>()
    for (const inv of existingInvoices) {
        if (!inv.poNumber) continue
        const list = invoicesPerPo.get(inv.poNumber) || []
        list.push(inv)
        invoicesPerPo.set(inv.poNumber, list)
    }

    const availablePos: any[] = []

    for (const [poNo, items] of poMap.entries()) {
        const first = items[0]
        const totalNetValue = items.reduce((acc, curr) => acc + (Number(curr.netValue) || 0), 0)
        const totalItemsCount = items.length

        const invs = invoicesPerPo.get(poNo) || []
        const invoicedValueSum = invs.reduce((acc, curr) => acc + (Number(curr.subtotal) || 0), 0)
        let invoicedItemsCount = 0
        for (const inv of invs) {
            invoicedItemsCount += (inv.invoicedItemsCount || 1)
        }
        if (invoicedItemsCount > totalItemsCount) invoicedItemsCount = totalItemsCount

        // Tentukan Status PO
        let poStatus: "open" | "partial" | "completed" = "open"
        if (invs.length === 0) {
            poStatus = "open"
        } else if (invoicedItemsCount >= totalItemsCount || (totalNetValue > 0 && invoicedValueSum >= totalNetValue * 0.99)) {
            poStatus = "completed"
        } else {
            poStatus = "partial"
        }

        // ATURAN MANDATORI: HANYA PO DENGAN STATUS NON-COMPLETED (open atau partial) YANG TAMPIL!
        if (poStatus === "open" || poStatus === "partial") {
            const materialSummary = items
                .map((m) => m.shortText)
                .filter(Boolean)
                .slice(0, 2)
                .join(", ") + (items.length > 2 ? ` (+${items.length - 2} item lainnya)` : "")

            const remainingValue = Math.max(0, totalNetValue - invoicedValueSum)

            availablePos.push({
                poNumber: poNo,
                poDate: first.poDate ? new Date(first.poDate).toISOString() : null,
                vendorCode: first.vendorCode,
                vendorName: first.vendorName,
                netValue: totalNetValue,
                remainingValue: remainingValue > 0 ? remainingValue : totalNetValue,
                totalItems: totalItemsCount,
                invoicedItems: invoicedItemsCount,
                remainingItems: totalItemsCount - invoicedItemsCount,
                poStatus,
                materialSummary,
                items: items.map((m, idx) => ({
                    itemNo: m.item ?? idx + 1,
                    material: m.material || "-",
                    shortText: m.shortText || "Barang/Jasa",
                    poQuantity: Number(m.poQuantity) || 0,
                    oun: m.oun || "PCS",
                    netValue: Number(m.netValue) || 0,
                    grQuantity: Number(m.grQuantity) || 0,
                    isInvoiced: idx < invoicedItemsCount,
                })),
            })
        }
    }

    return availablePos.sort((a, b) => (b.poDate || "").localeCompare(a.poDate || ""))
}

/**
 * 1. Hybrid Lookup: Cari PO pada tabel internal SAP (zvendorPoReportSap / me2lPurchDocsSap)
 * Dilengkapi validasi multi-tenant kepemilikan vendor & filter status non-completed.
 */
export async function lookupSapPoForVendorAction(poNumber: string, expectedTenantId?: string) {
    if (!poNumber?.trim()) {
        return { found: false, message: "Nomor PO kosong" }
    }

    const cleanPo = poNumber.trim()

    let expectedTenant: any = null
    if (expectedTenantId) {
        const tList = await db
            .select()
            .from(vendorTenants)
            .where(eq(vendorTenants.id, expectedTenantId))
            .limit(1)
        expectedTenant = tList[0] || null
    }

    // 1. Cek pada zvendorPoReportSap (ambil seluruh item PO ini, limit 100)
    const sapReportMatches = await db
        .select()
        .from(zvendorPoReportSap)
        .where(eq(zvendorPoReportSap.poNo, cleanPo))
        .limit(100)

    if (sapReportMatches.length > 0) {
        const first = sapReportMatches[0]

        // Validasi Kepemilikan Vendor: PO harus milik vendor yang sedang login
        if (expectedTenant) {
            const isMatch = isPoOwnedByVendor(first.vendorCode, first.vendorName, expectedTenant)
            if (!isMatch) {
                return {
                    found: false,
                    isWrongVendor: true,
                    poNumber: cleanPo,
                    vendorName: first.vendorName || "Vendor Lain",
                    message: `Nomor PO ${cleanPo} diterbitkan untuk rekanan "${first.vendorName || "Vendor Lain"}", bukan untuk perusahaan Anda (${expectedTenant.name}). Anda hanya diperbolehkan menagihkan PO yang diterbitkan untuk ${expectedTenant.name}.`,
                }
            }
        }

        const totalNetValue = sapReportMatches.reduce(
            (acc, curr) => acc + (Number(curr.netValue) || 0),
            0
        )
        const totalPoQty = sapReportMatches.reduce(
            (acc, curr) => acc + (Number(curr.poQuantity) || 0),
            0
        )
        const totalGrQty = sapReportMatches.reduce(
            (acc, curr) => acc + (Number(curr.grQuantity) || 0),
            0
        )

        // Query invoice yang sudah diajukan untuk PO ini (kecuali yang ditolak)
        const existingInvoices = await db
            .select({
                id: vendorInvoices.id,
                invoiceNumber: vendorInvoices.invoiceNumber,
                subtotal: vendorInvoices.subtotal,
                grandTotal: vendorInvoices.grandTotal,
                invoicedItemsCount: vendorInvoices.invoicedItemsCount,
                status: vendorInvoices.status,
            })
            .from(vendorInvoices)
            .where(
                and(
                    eq(vendorInvoices.poNumber, cleanPo),
                    not(inArray(vendorInvoices.status, ["rejected_admin", "rejected_finance"]))
                )
            )

        const totalItemsCount = sapReportMatches.length
        const invoicedValueSum = existingInvoices.reduce(
            (acc, curr) => acc + (Number(curr.subtotal) || 0),
            0
        )

        let invoicedItemsCount = 0
        for (const inv of existingInvoices) {
            invoicedItemsCount += (inv.invoicedItemsCount || 1)
        }
        if (invoicedItemsCount > totalItemsCount) {
            invoicedItemsCount = totalItemsCount
        }

        // Kriteria Status PO:
        let poStatus: "open" | "partial" | "completed" | "closed" | "cancelled" = "open"
        if (existingInvoices.length === 0) {
            poStatus = "open"
        } else if (invoicedItemsCount >= totalItemsCount || (totalNetValue > 0 && invoicedValueSum >= totalNetValue * 0.99)) {
            poStatus = "completed"
        } else {
            poStatus = "partial"
        }

        // ATURAN MANDATORI: PO COMPLETED TIDAK BOLEH DIAJUKAN LAGI!
        if (poStatus === "completed") {
            return {
                found: false,
                isCompleted: true,
                poNumber: cleanPo,
                poStatus: "completed",
                vendorName: first.vendorName,
                netValue: totalNetValue,
                message: `Nomor PO ${cleanPo} telah selesai ditagihkan penuh (Status: COMPLETED). Seluruh item/kuantitas telah memiliki invoice dan tidak dapat ditagihkan kembali.`,
            }
        }

        if (poStatus === "closed" || poStatus === "cancelled") {
            return {
                found: false,
                isClosedOrCancelled: true,
                poNumber: cleanPo,
                poStatus,
                vendorName: first.vendorName,
                message: `Nomor PO ${cleanPo} berstatus "${poStatus.toUpperCase()}" dan tidak dapat diajukan penagihan.`,
            }
        }

        const items = sapReportMatches.map((m, idx) => ({
            itemNo: m.item ?? idx + 1,
            material: m.material || "-",
            shortText: m.shortText || "Barang/Jasa",
            poQuantity: Number(m.poQuantity) || 0,
            oun: m.oun || "PCS",
            netValue: Number(m.netValue) || 0,
            grQuantity: Number(m.grQuantity) || 0,
            plant: m.plant || "-",
            isInvoiced: idx < invoicedItemsCount,
        }))

        return {
            found: true,
            source: "zvendor_po_report_sap",
            poNumber: cleanPo,
            vendorName: first.vendorName || "Tidak Diketahui",
            vendorCode: first.vendorCode,
            currency: first.currency || "IDR",
            netValue: totalNetValue,
            poDate: first.poDate ? new Date(first.poDate).toISOString() : null,
            totalItems: totalItemsCount,
            invoicedItems: invoicedItemsCount,
            totalPoQty,
            totalGrQty,
            invoicedValue: invoicedValueSum,
            poStatus,
            poStatusLabel: poStatus === "open" ? "Open" : poStatus === "partial" ? "Partial" : "Completed",
            items,
            materialSummary: sapReportMatches.map((m) => m.shortText).filter(Boolean).slice(0, 3).join(", ") + (sapReportMatches.length > 3 ? ` (+${sapReportMatches.length - 3} item lainnya)` : ""),
        }
    }

    // 2. Cek pada me2lPurchDocsSap
    const me2lMatches = await db
        .select()
        .from(me2lPurchDocsSap)
        .where(eq(me2lPurchDocsSap.purchasingDoc, cleanPo))
        .limit(100)

    if (me2lMatches.length > 0) {
        const first = me2lMatches[0]

        // Validasi Kepemilikan Vendor
        if (expectedTenant) {
            const isMatch = isPoOwnedByVendor(null, first.vendorName, expectedTenant)
            if (!isMatch) {
                return {
                    found: false,
                    isWrongVendor: true,
                    poNumber: cleanPo,
                    vendorName: first.vendorName || "Vendor Lain",
                    message: `Nomor PO ${cleanPo} diterbitkan untuk rekanan "${first.vendorName || "Vendor Lain"}", bukan untuk perusahaan Anda (${expectedTenant.name}). Anda hanya diperbolehkan menagihkan PO yang diterbitkan untuk ${expectedTenant.name}.`,
                }
            }
        }

        const totalNet = me2lMatches.reduce(
            (acc, curr) => acc + (Number(curr.netOrderValue) || 0),
            0
        )
        const totalItemsCount = me2lMatches.length

        const existingInvoices = await db
            .select({
                id: vendorInvoices.id,
                subtotal: vendorInvoices.subtotal,
                invoicedItemsCount: vendorInvoices.invoicedItemsCount,
                status: vendorInvoices.status,
            })
            .from(vendorInvoices)
            .where(
                and(
                    eq(vendorInvoices.poNumber, cleanPo),
                    not(inArray(vendorInvoices.status, ["rejected_admin", "rejected_finance"]))
                )
            )

        let invoicedItemsCount = 0
        for (const inv of existingInvoices) {
            invoicedItemsCount += (inv.invoicedItemsCount || 1)
        }
        if (invoicedItemsCount > totalItemsCount) invoicedItemsCount = totalItemsCount

        let poStatus: "open" | "partial" | "completed" = "open"
        if (existingInvoices.length === 0) {
            poStatus = "open"
        } else if (invoicedItemsCount >= totalItemsCount) {
            poStatus = "completed"
        } else {
            poStatus = "partial"
        }

        if (poStatus === "completed") {
            return {
                found: false,
                isCompleted: true,
                poNumber: cleanPo,
                poStatus: "completed",
                vendorName: first.vendorName,
                netValue: totalNet,
                message: `Nomor PO ${cleanPo} telah selesai ditagihkan penuh (Status: COMPLETED). Seluruh item/kuantitas telah memiliki invoice dan tidak dapat ditagihkan kembali.`,
            }
        }

        return {
            found: true,
            source: "me2l_purch_docs_sap",
            poNumber: cleanPo,
            vendorName: first.vendorName || "Tidak Diketahui",
            currency: first.currency || "IDR",
            netValue: totalNet,
            poDate: first.docDate ? new Date(first.docDate).toISOString() : null,
            totalItems: totalItemsCount,
            invoicedItems: invoicedItemsCount,
            poStatus,
            poStatusLabel: poStatus === "open" ? "Open" : poStatus === "partial" ? "Partial" : "Completed",
            items: me2lMatches.map((m, idx) => ({
                itemNo: idx + 1,
                material: m.material || "-",
                shortText: m.shortText || "Material",
                poQuantity: Number(m.orderQty) || 0,
                oun: m.orderUnit || "PCS",
                netValue: Number(m.netOrderValue) || 0,
                grQuantity: 0,
                plant: m.plant || "-",
                isInvoiced: idx < invoicedItemsCount,
            })),
            materialSummary: me2lMatches.map((m) => m.shortText).filter(Boolean).slice(0, 3).join(", "),
        }
    }

    return {
        found: false,
        poNumber: cleanPo,
        message: `Nomor PO ${cleanPo} tidak ditemukan di database SAP One Chitra.`,
    }
}

/**
 * Lookup Vendor Contract by Contract Number
 */
export async function lookupVendorContractAction(contractNumber: string) {
    if (!contractNumber?.trim()) {
        return { found: false, message: "Nomor kontrak kosong" }
    }
    const cleanNum = contractNumber.trim()
    const matches = await db
        .select()
        .from(vendorContracts)
        .where(
            or(
                eq(vendorContracts.contractNumber, cleanNum),
                ilike(vendorContracts.contractNumber, `%${cleanNum}%`)
            )
        )
        .limit(1)

    if (matches.length > 0) {
        const c = matches[0]
        return {
            found: true,
            contract: {
                ...c,
                contractValue: Number(c.contractValue) || 0,
                ppnPercent: Number(c.ppnPercent) || 0,
                pphPercent: Number(c.pphPercent) || 0,
            },
            contractNumber: c.contractNumber,
            vendorName: c.vendorName,
            title: c.title,
            category: c.category,
            itemName: c.itemName,
            itemDetails: c.itemDetails,
            contractValue: Number(c.contractValue) || 0,
            billingFrequency: c.billingFrequency,
            topDays: c.topDays,
            isPkp: c.isPkp,
            ppnPercent: Number(c.ppnPercent) || 0,
            pphPercent: Number(c.pphPercent) || 0,
            startDate: c.startDate ? new Date(c.startDate).toISOString() : null,
            endDate: c.endDate ? new Date(c.endDate).toISOString() : null,
            bankName: c.bankName,
            bankAccountNumber: c.bankAccountNumber,
            bankAccountHolder: c.bankAccountHolder,
            status: c.status,
            contractFileUrl: c.contractFileUrl,
        }
    }

    return {
        found: false,
        contractNumber: cleanNum,
        message: `Kontrak nomor "${cleanNum}" tidak ditemukan di database.`,
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
 * 4.b. Pencarian Master Vendor SAP (Autocomplete & Sync)
 */
export async function searchSapVendorMasterAction(query: string) {
    if (!query || query.trim().length < 2) {
        return []
    }
    const clean = `%${query.trim()}%`
    const results = await db
        .select()
        .from(sapVendorMaster)
        .where(
            or(
                ilike(sapVendorMaster.supplierCode, clean),
                ilike(sapVendorMaster.vendorName, clean),
                ilike(sapVendorMaster.city, clean)
            )
        )
        .limit(20)

    return results
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
    sapVendorCode?: string
    sapTopCode?: string
    sapCurrency?: string
    sapSalesperson?: string
    sapTelephone?: string
    city?: string
    country?: string
    postalCode?: string
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

    // Kode vendor: jika ada SAP vendor code, gunakan SAP code, jika tidak VND-XXXX
    let code: string
    if (data.sapVendorCode?.trim()) {
        code = `SAP-${data.sapVendorCode.trim()}`
    } else {
        const countTenants = await db.select({ count: sql<number>`count(*)` }).from(vendorTenants)
        code = `VND-${String(Number(countTenants[0]?.count || 0) + 1).padStart(4, "0")}`
    }

    const [newTenant] = await db
        .insert(vendorTenants)
        .values({
            code,
            name: data.name.trim(),
            email: cleanEmail,
            phone: data.phone?.trim() || data.sapTelephone?.trim(),
            address: data.address?.trim(),
            defaultTopDays: Number(data.defaultTopDays) || 30,
            isPkp: Boolean(data.isPkp),
            npwp: data.npwp?.trim(),
            bankName: data.bankName?.trim(),
            bankAccountNo: data.bankAccountNo?.trim(),
            bankAccountHolder: data.bankAccountHolder?.trim(),
            sapVendorCode: data.sapVendorCode?.trim() || null,
            sapTopCode: data.sapTopCode?.trim() || null,
            sapCurrency: data.sapCurrency?.trim() || "IDR",
            sapSalesperson: data.sapSalesperson?.trim() || null,
            sapTelephone: data.sapTelephone?.trim() || null,
            city: data.city?.trim() || null,
            country: data.country?.trim() || null,
            postalCode: data.postalCode?.trim() || null,
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
 * 4.c. Dapatkan atau Buat Tenant dari Master SAP Vendor (On-The-Fly Linking)
 */
export async function getOrCreateVendorTenantFromSapAction(sapSupplierCode: string) {
    if (!sapSupplierCode?.trim()) {
        return { success: false, error: "Kode supplier SAP tidak valid." }
    }
    const cleanCode = sapSupplierCode.trim()

    // 1. Cek apakah sudah ada tenant yang tertaut dengan sap_vendor_code ini
    const existingTenant = await db
        .select()
        .from(vendorTenants)
        .where(
            or(
                eq(vendorTenants.sapVendorCode, cleanCode),
                eq(vendorTenants.code, `SAP-${cleanCode}`)
            )
        )
        .limit(1)

    if (existingTenant.length > 0) {
        return { success: true, tenant: existingTenant[0] }
    }

    // 2. Ambil data master vendor SAP
    const sapVendor = await db
        .select()
        .from(sapVendorMaster)
        .where(eq(sapVendorMaster.supplierCode, cleanCode))
        .limit(1)

    if (sapVendor.length === 0) {
        return { success: false, error: `Vendor SAP dengan kode ${cleanCode} tidak ditemukan di database master.` }
    }

    const sv = sapVendor[0]
    const placeholderEmail = `${cleanCode.toLowerCase()}@vendor-sap.chitra.com`

    // Cek apakah email placeholder sudah ada
    const existingByEmail = await db
        .select()
        .from(vendorTenants)
        .where(eq(vendorTenants.email, placeholderEmail))
        .limit(1)

    if (existingByEmail.length > 0) {
        return { success: true, tenant: existingByEmail[0] }
    }

    const [newTenant] = await db
        .insert(vendorTenants)
        .values({
            code: `SAP-${cleanCode}`,
            name: sv.vendorName,
            email: placeholderEmail,
            phone: sv.telephone || undefined,
            address: `${sv.street || ""}, ${sv.city || ""}, ${sv.country || ""}`.replace(/^,\s*|,\s*$/g, "") || undefined,
            defaultTopDays: sv.topDays || 30,
            isPkp: true, // Default PKP jika bertransaksi komersial SAP
            sapVendorCode: sv.supplierCode,
            sapTopCode: sv.termsOfPayment || undefined,
            sapCurrency: sv.orderCurrency || "IDR",
            city: sv.city || undefined,
            country: sv.country || undefined,
            postalCode: sv.postalCode || undefined,
            status: "active",
        })
        .returning()

    return { success: true, tenant: newTenant }
}

/**
 * 8. Vendor Mengajukan Invoice Baru (Draft/Submitted -> Notifikasi ke Admin)
 */
export async function submitVendorInvoiceAction(data: {
    tenantId: string
    invoiceNumber: string
    poNumber: string
    referenceType?: "PO" | "CONTRACT"
    contractNumber?: string
    invoiceDate: string
    subtotal: number
    ppnPercent?: number
    pphPercent?: number
    currency?: string
    invoiceFileUrl: string
    grSlipFileUrl?: string // Goods Receipt Slip (wajib salah satu dengan deliveryReceiptFileUrl)
    taxInvoiceFileUrl?: string
    poFileUrl?: string
    contractFileUrl?: string
    deliveryReceiptFileUrl?: string // Surat Jalan / BAST / Absen (wajib salah satu dengan grSlipFileUrl)
    additionalFileUrl?: string
    invoicedItemsCount?: number
    totalPoItemsCount?: number
    poStatus?: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) {
        return { success: false, error: "Sesi telah berakhir. Silakan login kembali." }
    }

    if (!data.invoiceNumber.trim()) {
        return { success: false, error: "Nomor Invoice wajib diisi." }
    }

    if ((data.referenceType || "PO") === "CONTRACT") {
        if (!data.contractNumber?.trim()) {
            return { success: false, error: "Nomor Kontrak wajib diisi untuk penagihan kontrak." }
        }
    } else {
        if (!data.poNumber.trim()) {
            return { success: false, error: "Nomor Purchase Order (PO) wajib diisi." }
        }
        // Validasi Kepemilikan Vendor & Status PO Non-Completed
        const poCheck = await lookupSapPoForVendorAction(data.poNumber, data.tenantId)
        if (!poCheck.found) {
            return {
                success: false,
                error: poCheck.message || "Nomor PO tidak valid atau telah selesai ditagihkan.",
            }
        }
    }

    if (data.subtotal <= 0) {
        return { success: false, error: "Subtotal nominal invoice harus lebih besar dari 0." }
    }

    if (!data.invoiceFileUrl?.trim()) {
        return { success: false, error: "Berkas PDF/Scan Invoice fisik wajib diunggah." }
    }

    // Validasi bukti penerimaan: minimal salah satu antara GR Slip atau Surat Jalan/BAST/Absen
    if (!data.grSlipFileUrl?.trim() && !data.deliveryReceiptFileUrl?.trim()) {
        return { success: false, error: "Wajib melampirkan minimal salah satu bukti penerimaan: Lampiran GR Slip atau Surat Jalan / BAST / Daftar Absen." }
    }

    // Ambil tenant untuk validasi & TOP read-only
    const tenant = await db
        .select()
        .from(vendorTenants)
        .where(eq(vendorTenants.id, data.tenantId))
        .limit(1)

    if (tenant.length === 0) {
        return { success: false, error: "Organisasi vendor tidak ditemukan." }
    }

    // Validasi e-Faktur Pajak Wajib bagi Vendor PKP
    const isVendorPkp = tenant[0].isPkp || (data.ppnPercent ?? 0) > 0
    if (isVendorPkp && !data.taxInvoiceFileUrl?.trim()) {
        return { success: false, error: "Vendor PKP wajib melampirkan berkas e-Faktur Pajak." }
    }

    const { ppnAmount, pphAmount, grandTotal } = calculateTaxAndTotals({
        subtotal: data.subtotal,
        ppnPercent: data.ppnPercent ?? (tenant[0].isPkp ? 11 : 0),
        pphPercent: data.pphPercent ?? 0,
    })

    // TOP vendor READ-ONLY mengikuti Master Vendor masing-masing
    const topDays = tenant[0].defaultTopDays || 30

    // Simpan invoice
    const [newInvoice] = await db
        .insert(vendorInvoices)
        .values({
            tenantId: data.tenantId,
            invoiceNumber: data.invoiceNumber.trim(),
            poNumber: data.poNumber?.trim() || data.contractNumber?.trim() || "-",
            referenceType: data.referenceType || "PO",
            contractNumber: data.contractNumber?.trim() || null,
            contractFileUrl: data.contractFileUrl || null,
            poStatus: data.poStatus || "open",
            invoicedItemsCount: data.invoicedItemsCount || 1,
            totalPoItemsCount: data.totalPoItemsCount || 1,
            invoiceDate: new Date(data.invoiceDate),
            subtotal: String(data.subtotal),
            ppnPercent: String(data.ppnPercent ?? 11),
            ppnAmount: String(ppnAmount),
            pphPercent: String(data.pphPercent ?? 0),
            pphAmount: String(pphAmount),
            grandTotal: String(grandTotal),
            currency: data.currency || tenant[0].sapCurrency || "IDR",
            topDays,
            entryMode: "vendor",
            status: "submitted",
            invoiceFileUrl: data.invoiceFileUrl,
            grSlipFileUrl: data.grSlipFileUrl,
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
        notes: `Pengajuan invoice baru nomor ${newInvoice.invoiceNumber} (TOP ${topDays} hari, Ref: ${newInvoice.referenceType})`,
    })

    // Kirim notifikasi email ke Admin (non-blocking)
    try {
        await sendInvoiceSubmittedNotification({
            invoiceNumber: newInvoice.invoiceNumber,
            vendorName: tenant[0].name,
            poNumber: newInvoice.poNumber,
            grandTotal: newInvoice.grandTotal,
        })
    } catch (e) {
        console.error("Gagal mengirim email invoice submitted:", e)
    }

    revalidatePath("/vendor/dashboard")
    revalidatePath("/dashboard/vendor-invoices")
    return { success: true, invoice: newInvoice }
}

/**
 * 8.b. Opsi Entry Invoice oleh Admin Procurement (Internal Submission on behalf of Vendor)
 */
export async function submitInvoiceByAdminAction(data: {
    tenantId: string
    sapSupplierCode?: string // Optional direct link to SAP Vendor Master
    invoiceNumber: string
    poNumber: string
    referenceType?: "PO" | "CONTRACT"
    contractNumber?: string
    invoiceDate: string
    subtotal: number
    ppnPercent?: number
    pphPercent?: number
    currency?: string
    invoiceFileUrl: string
    grSlipFileUrl?: string // Goods Receipt Slip (wajib salah satu dengan deliveryReceiptFileUrl)
    taxInvoiceFileUrl?: string
    poFileUrl?: string
    contractFileUrl?: string
    deliveryReceiptFileUrl?: string // Surat Jalan / BAST / Absen (wajib salah satu dengan grSlipFileUrl)
    additionalFileUrl?: string
    invoicedItemsCount?: number
    totalPoItemsCount?: number
    poStatus?: string
    notes?: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) {
        return { success: false, error: "Unauthorized. Silakan login terlebih dahulu." }
    }

    try {
        await checkPermission("vendor-invoices", "create")
    } catch {
        return { success: false, error: "Akses ditolak. Akun Anda belum memiliki izin entry invoice vendor." }
    }

    if ((data.referenceType || "PO") === "CONTRACT") {
        if (!data.contractNumber?.trim()) {
            return { success: false, error: "Nomor Kontrak wajib diisi untuk penagihan kontrak." }
        }
    } else {
        if (!data.poNumber?.trim()) {
            return { success: false, error: "Nomor Purchase Order (PO) wajib diisi." }
        }
    }

    // Validasi bukti penerimaan: minimal salah satu antara GR Slip atau Surat Jalan/BAST/Absen
    if (!data.grSlipFileUrl?.trim() && !data.deliveryReceiptFileUrl?.trim()) {
        return { success: false, error: "Wajib melampirkan minimal salah satu bukti penerimaan: Lampiran GR Slip atau Surat Jalan / BAST / Daftar Absen." }
    }

    let targetTenantId = data.tenantId

    // Jika tenantId berawalan "sap:" atau dikirim sapSupplierCode, lakukan on-the-fly linking
    if (targetTenantId?.startsWith("sap:") || data.sapSupplierCode) {
        const sapCode = data.sapSupplierCode || targetTenantId.replace("sap:", "")
        const linkedRes = await getOrCreateVendorTenantFromSapAction(sapCode)
        if (!linkedRes.success || !linkedRes.tenant) {
            return { success: false, error: linkedRes.error || "Gagal mengaitkan data Master Vendor SAP." }
        }
        targetTenantId = linkedRes.tenant.id
    }

    const tenant = await db
        .select()
        .from(vendorTenants)
        .where(eq(vendorTenants.id, targetTenantId))
        .limit(1)

    if (tenant.length === 0) {
        return { success: false, error: "Vendor tidak ditemukan." }
    }

    // Validasi e-Faktur Pajak Wajib bagi Vendor PKP
    const isVendorPkp = tenant[0].isPkp || (data.ppnPercent ?? 0) > 0
    if (isVendorPkp && !data.taxInvoiceFileUrl?.trim()) {
        return { success: false, error: "Vendor PKP wajib melampirkan berkas e-Faktur Pajak." }
    }

    const { ppnAmount, pphAmount, grandTotal } = calculateTaxAndTotals({
        subtotal: data.subtotal,
        ppnPercent: data.ppnPercent ?? (tenant[0].isPkp ? 11 : 0),
        pphPercent: data.pphPercent ?? 0,
    })

    // TOP read-only dari master vendor
    const topDays = tenant[0].defaultTopDays || 30

    const [newInvoice] = await db
        .insert(vendorInvoices)
        .values({
            tenantId: targetTenantId,
            invoiceNumber: data.invoiceNumber.trim(),
            poNumber: data.poNumber?.trim() || data.contractNumber?.trim() || "-",
            referenceType: data.referenceType || "PO",
            contractNumber: data.contractNumber?.trim() || null,
            contractFileUrl: data.contractFileUrl || null,
            poStatus: data.poStatus || "open",
            invoicedItemsCount: data.invoicedItemsCount || 1,
            totalPoItemsCount: data.totalPoItemsCount || 1,
            invoiceDate: new Date(data.invoiceDate),
            subtotal: String(data.subtotal),
            ppnPercent: String(data.ppnPercent ?? 11),
            ppnAmount: String(ppnAmount),
            pphPercent: String(data.pphPercent ?? 0),
            pphAmount: String(pphAmount),
            grandTotal: String(grandTotal),
            currency: data.currency || tenant[0].sapCurrency || "IDR",
            topDays,
            entryMode: "admin_procurement",
            enteredBy: currentUser.id,
            status: "submitted",
            invoiceFileUrl: data.invoiceFileUrl,
            grSlipFileUrl: data.grSlipFileUrl,
            taxInvoiceFileUrl: data.taxInvoiceFileUrl,
            poFileUrl: data.poFileUrl,
            deliveryReceiptFileUrl: data.deliveryReceiptFileUrl,
            additionalFileUrl: data.additionalFileUrl,
            createdBy: currentUser.id,
        })
        .returning()

    // Update PO tracking record jika PO
    if ((data.referenceType || "PO") === "PO" && data.poNumber?.trim()) {
        const cleanPo = data.poNumber.trim()
        try {
            await db
                .insert(vendorPoTracking)
                .values({
                    poNumber: cleanPo,
                    vendorName: tenant[0].name,
                    totalItems: data.totalPoItemsCount || 1,
                    invoicedItems: data.invoicedItemsCount || 1,
                    netValue: String(data.subtotal),
                    invoicedValue: String(data.subtotal),
                    currency: data.currency || "IDR",
                    status: data.poStatus || "open",
                    lastInvoicedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: vendorPoTracking.poNumber,
                    set: {
                        invoicedItems: data.invoicedItemsCount || 1,
                        invoicedValue: String(data.subtotal),
                        status: data.poStatus || "open",
                        lastInvoicedAt: new Date(),
                        updatedAt: new Date(),
                    },
                })
        } catch (e) {
            console.error("Gagal update vendorPoTracking:", e)
        }
    }

    await db.insert(vendorInvoiceLogs).values({
        invoiceId: newInvoice.id,
        action: "submitted",
        actorId: currentUser.id,
        actorName: currentUser.name || "Admin Procurement",
        actorRole: "admin_procurement",
        notes: `Entry invoice oleh Procurement on-behalf vendor ${tenant[0].name}. ${data.notes || ""}`,
    })

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

        // Notifikasi ke Finance (non-blocking)
        try {
            await sendInvoiceVerifiedNotification({
                invoiceNumber: invoice.invoiceNumber,
                vendorName: invoice.tenant.name,
                poNumber: invoice.poNumber,
                grandTotal: invoice.grandTotal,
            })
        } catch (mailErr) {
            console.error("Gagal mengirim email notifikasi verified_admin:", mailErr)
        }
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
 * 9.b. Finance Re-Check Hasil Validasi Checklist Admin
 */
export async function recheckAdminChecklistAction(data: {
    invoiceId: string
    passed: boolean
    notes?: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const invoice = await getVendorInvoiceByIdAction(data.invoiceId)
    if (!invoice) return { success: false, error: "Invoice tidak ditemukan." }

    const now = new Date()

    await db
        .update(vendorInvoices)
        .set({
            financeRecheckAt: now,
            financeRecheckBy: currentUser.id,
            financeRecheckNotes: data.notes?.trim() || null,
            financeRecheckPassed: data.passed,
            updatedAt: now,
        })
        .where(eq(vendorInvoices.id, data.invoiceId))

    await db.insert(vendorInvoiceLogs).values({
        invoiceId: data.invoiceId,
        action: data.passed ? "finance_recheck_passed" : "finance_recheck_failed",
        actorId: currentUser.id,
        actorName: currentUser.name || "Finance",
        actorRole: "finance",
        notes: `Finance re-check hasil validasi admin: ${data.passed ? "SESUAI" : "DISCREPANCY/TIDAK SESUAI"}. ${data.notes || ""}`,
    })

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true }
}

/**
 * 10. Finance Validation & Cut-Off Engine Execution
 * Catatan: TOP vendor adalah READ-ONLY mengikuti Master Vendor masing-masing.
 */
export async function validateFinanceInvoiceAction(data: {
    invoiceId: string
    action: "validate" | "reject"
    notes?: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const invoice = await getVendorInvoiceByIdAction(data.invoiceId)
    if (!invoice) return { success: false, error: "Invoice tidak ditemukan." }

    if (data.action === "validate") {
        const now = new Date()

        // TOP vendor READ-ONLY dari Master Vendor
        const effectiveTopDays = invoice.topDays || invoice.tenant.defaultTopDays || 30

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
                financeRecheckPassed: true,
                financeRecheckAt: invoice.financeRecheckAt || now,
                financeRecheckBy: invoice.financeRecheckBy || currentUser.id,
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
            notes: `Validasi Finance berhasil. TOP: ${effectiveTopDays} hari (Read-Only Master Vendor). Buku: ${schedule.bookReceivedDate.toISOString().slice(0, 10)}, Jadwal Bayar: ${schedule.scheduledPaymentDate.toISOString().slice(0, 10)}.`,
            metadata: {
                bookReceivedDate: schedule.bookReceivedDate,
                paymentDueDate: schedule.paymentDueDate,
                scheduledPaymentDate: schedule.scheduledPaymentDate,
                topDays: effectiveTopDays,
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

/**
 * 14. Mengambil Daftar Master Vendor SAP MKVZ (Paginasi/Pencarian)
 */
/**
 * 14. Mengambil Daftar Master Vendor SAP MKVZ (Paginasi/Pencarian Sesuai Standar VPMS Accenture)
 */
export async function getAccentureMasterVendorsAction(params?: {
    search?: string
    status?: string // "All" | "Active" | "Blacklisted" | "Inactive"
    page?: number
    pageSize?: number
}) {
    const page = Math.max(1, params?.page || 1)
    const pageSize = Math.max(1, Math.min(100, params?.pageSize || 10))
    const offset = (page - 1) * pageSize

    const conditions: any[] = []

    if (params?.search?.trim()) {
        const clean = `%${params.search.trim()}%`
        conditions.push(
            or(
                ilike(sapVendorMaster.supplierCode, clean),
                ilike(sapVendorMaster.vendorName, clean),
                ilike(sapVendorMaster.npwp, clean),
                ilike(sapVendorMaster.typeOfBusiness, clean),
                ilike(sapVendorMaster.city, clean)
            )
        )
    }

    if (params?.status && params.status !== "All Status" && params.status !== "All") {
        conditions.push(ilike(sapVendorMaster.status, params.status))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sapVendorMaster)
        .where(whereClause)

    const totalCount = countResult?.count || 0
    const totalPages = Math.ceil(totalCount / pageSize) || 1

    const vendors = await db
        .select()
        .from(sapVendorMaster)
        .where(whereClause)
        .orderBy(asc(sapVendorMaster.supplierCode))
        .limit(pageSize)
        .offset(offset)

    return {
        vendors,
        totalCount,
        totalPages,
        page,
        pageSize,
    }
}

export async function createAccentureMasterVendorAction(data: {
    vendorName: string
    supplierCode?: string
    address?: string
    npwp?: string
    typeOfBusiness?: string
    directorName?: string
    directorPosition?: string
    directorEmail?: string
    directorPhone?: string
    salesPicName?: string
    salesPicPosition?: string
    salesPicEmail?: string
    salesPicPhone?: string
    bankName?: string
    bankAccountNumber?: string
    bankAccountHolder?: string
    topDays?: number
    orderCurrency?: string
    status?: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized. Silakan login terlebih dahulu." }

    const cleanName = data.vendorName?.trim()
    if (!cleanName) return { success: false, error: "Nama vendor wajib diisi." }

    // Generate kode jika tidak diisi (misal: 2012xxx atau 9000xxx)
    let code = data.supplierCode?.trim()
    if (!code) {
        const [last] = await db
            .select({ supplierCode: sapVendorMaster.supplierCode })
            .from(sapVendorMaster)
            .orderBy(desc(sapVendorMaster.id))
            .limit(1)

        const num = last?.supplierCode ? parseInt(last.supplierCode, 10) : 2012300
        code = isNaN(num) ? `9000${Math.floor(100 + Math.random() * 900)}` : String(num + 1)
    }

    // Cek apakah kode sudah terpakai
    const [exist] = await db
        .select({ id: sapVendorMaster.id })
        .from(sapVendorMaster)
        .where(eq(sapVendorMaster.supplierCode, code))
        .limit(1)

    if (exist) {
        return { success: false, error: `Kode vendor ${code} sudah terdaftar di sistem.` }
    }

    const [newVendor] = await db
        .insert(sapVendorMaster)
        .values({
            supplierCode: code,
            vendorName: cleanName,
            address: data.address?.trim() || null,
            street: data.address?.trim() || null,
            npwp: data.npwp?.trim() || null,
            typeOfBusiness: data.typeOfBusiness?.trim() || "46590 - Perdagangan Besar Mesin, Peralatan dan Perlengkapan Lainnya",
            status: data.status || "Active",
            directorName: data.directorName?.trim() || null,
            directorPosition: data.directorPosition?.trim() || null,
            directorEmail: data.directorEmail?.trim() || null,
            directorPhone: data.directorPhone?.trim() || null,
            salesPicName: data.salesPicName?.trim() || null,
            salesPicPosition: data.salesPicPosition?.trim() || null,
            salesPicEmail: data.salesPicEmail?.trim() || null,
            salesPicPhone: data.salesPicPhone?.trim() || null,
            salesperson: data.salesPicName?.trim() || null,
            telephone: data.salesPicPhone?.trim() || null,
            bankName: data.bankName?.trim() || "BCA",
            bankAccountNumber: data.bankAccountNumber?.trim() || null,
            bankAccountHolder: data.bankAccountHolder?.trim() || cleanName,
            topDays: Number(data.topDays) || 30,
            orderCurrency: data.orderCurrency || "IDR",
            isActive: data.status !== "Inactive",
        })
        .returning()

    // Sinkronkan juga ke vendor_tenants jika belum ada
    const [existingTenant] = await db
        .select({ id: vendorTenants.id })
        .from(vendorTenants)
        .where(eq(vendorTenants.code, code))
        .limit(1)

    if (!existingTenant) {
        await db.insert(vendorTenants).values({
            code,
            name: cleanName,
            email: data.salesPicEmail?.trim() || data.directorEmail?.trim() || `${code.toLowerCase()}@vendor.chitra.com`,
            phone: data.salesPicPhone?.trim() || data.directorPhone?.trim() || null,
            address: data.address?.trim() || null,
            npwp: data.npwp?.trim() || null,
            isPkp: Boolean(data.npwp),
            bankName: data.bankName?.trim() || "BCA",
            bankAccountNo: data.bankAccountNumber?.trim() || null,
            bankAccountHolder: data.bankAccountHolder?.trim() || cleanName,
            defaultTopDays: Number(data.topDays) || 30,
            sapVendorCode: code,
            status: "active",
        }).catch(() => {})
    }

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true, vendor: newVendor }
}

export async function updateAccentureMasterVendorAction(
    id: number,
    data: {
        vendorName?: string
        address?: string
        npwp?: string
        typeOfBusiness?: string
        status?: string
        directorName?: string
        directorPosition?: string
        directorEmail?: string
        directorPhone?: string
        salesPicName?: string
        salesPicPosition?: string
        salesPicEmail?: string
        salesPicPhone?: string
        bankName?: string
        bankAccountNumber?: string
        bankAccountHolder?: string
        topDays?: number
        orderCurrency?: string
    }
) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized. Silakan login terlebih dahulu." }

    const [existing] = await db
        .select()
        .from(sapVendorMaster)
        .where(eq(sapVendorMaster.id, id))
        .limit(1)

    if (!existing) {
        return { success: false, error: "Data vendor tidak ditemukan." }
    }

    const updatePayload: any = {
        updatedAt: new Date(),
    }

    if (data.vendorName !== undefined) updatePayload.vendorName = data.vendorName.trim()
    if (data.address !== undefined) {
        updatePayload.address = data.address.trim()
        updatePayload.street = data.address.trim()
    }
    if (data.npwp !== undefined) updatePayload.npwp = data.npwp.trim()
    if (data.typeOfBusiness !== undefined) updatePayload.typeOfBusiness = data.typeOfBusiness.trim()
    if (data.status !== undefined) {
        updatePayload.status = data.status
        updatePayload.isActive = data.status === "Active"
    }
    if (data.directorName !== undefined) updatePayload.directorName = data.directorName.trim()
    if (data.directorPosition !== undefined) updatePayload.directorPosition = data.directorPosition.trim()
    if (data.directorEmail !== undefined) updatePayload.directorEmail = data.directorEmail.trim()
    if (data.directorPhone !== undefined) updatePayload.directorPhone = data.directorPhone.trim()
    if (data.salesPicName !== undefined) {
        updatePayload.salesPicName = data.salesPicName.trim()
        updatePayload.salesperson = data.salesPicName.trim()
    }
    if (data.salesPicPosition !== undefined) updatePayload.salesPicPosition = data.salesPicPosition.trim()
    if (data.salesPicEmail !== undefined) updatePayload.salesPicEmail = data.salesPicEmail.trim()
    if (data.salesPicPhone !== undefined) {
        updatePayload.salesPicPhone = data.salesPicPhone.trim()
        updatePayload.telephone = data.salesPicPhone.trim()
    }
    if (data.bankName !== undefined) updatePayload.bankName = data.bankName.trim()
    if (data.bankAccountNumber !== undefined) updatePayload.bankAccountNumber = data.bankAccountNumber.trim()
    if (data.bankAccountHolder !== undefined) updatePayload.bankAccountHolder = data.bankAccountHolder.trim()
    if (data.topDays !== undefined) updatePayload.topDays = Number(data.topDays) || 30
    if (data.orderCurrency !== undefined) updatePayload.orderCurrency = data.orderCurrency.trim()

    const [updated] = await db
        .update(sapVendorMaster)
        .set(updatePayload)
        .where(eq(sapVendorMaster.id, id))
        .returning()

    // Sinkronkan juga ke vendor_tenants jika ada yang cocok dengan supplierCode
    await db
        .update(vendorTenants)
        .set({
            name: updatePayload.vendorName || existing.vendorName,
            address: updatePayload.address || existing.address,
            npwp: updatePayload.npwp || existing.npwp,
            bankName: updatePayload.bankName || existing.bankName,
            bankAccountNo: updatePayload.bankAccountNumber || existing.bankAccountNumber,
            bankAccountHolder: updatePayload.bankAccountHolder || existing.bankAccountHolder,
            defaultTopDays: updatePayload.topDays || existing.topDays,
            updatedAt: new Date(),
        })
        .where(eq(vendorTenants.code, existing.supplierCode))
        .catch(() => {})

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true, vendor: updated }
}

export async function deleteAccentureMasterVendorAction(id: number) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized. Silakan login terlebih dahulu." }

    const [existing] = await db
        .select()
        .from(sapVendorMaster)
        .where(eq(sapVendorMaster.id, id))
        .limit(1)

    if (!existing) {
        return { success: false, error: "Data vendor tidak ditemukan." }
    }

    // Toggle status menjadi Inactive atau hapus
    const newStatus = existing.status === "Active" ? "Inactive" : "Active"

    await db
        .update(sapVendorMaster)
        .set({
            status: newStatus,
            isActive: newStatus === "Active",
            updatedAt: new Date(),
        })
        .where(eq(sapVendorMaster.id, id))

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true, newStatus }
}

export async function getSapVendorMasterListAction(params?: {
    search?: string
    limit?: number
    offset?: number
}) {
    const limit = params?.limit || 50
    const offset = params?.offset || 0

    let query = db.select().from(sapVendorMaster)

    if (params?.search?.trim()) {
        const clean = `%${params.search.trim()}%`
        return await db
            .select()
            .from(sapVendorMaster)
            .where(
                or(
                    ilike(sapVendorMaster.supplierCode, clean),
                    ilike(sapVendorMaster.vendorName, clean),
                    ilike(sapVendorMaster.city, clean)
                )
            )
            .orderBy(sapVendorMaster.supplierCode)
            .limit(limit)
            .offset(offset)
    }

    return await db
        .select()
        .from(sapVendorMaster)
        .orderBy(sapVendorMaster.supplierCode)
        .limit(limit)
        .offset(offset)
}

/**
 * 15. Master Vendor Management (CRUD)
 */
export async function createMasterVendorAction(data: {
    name: string
    code?: string
    email: string
    phone?: string
    address?: string
    city?: string
    sapVendorCode?: string
    isPkp: boolean
    npwp?: string
    bankName?: string
    bankAccountNo?: string
    bankAccountHolder?: string
    defaultTopDays?: number
    status?: "active" | "pending_invitation" | "suspended"
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const cleanName = data.name.trim()
    if (!cleanName) return { success: false, error: "Nama vendor wajib diisi." }

    const code = data.code?.trim() || (data.sapVendorCode ? `SAP-${data.sapVendorCode}` : `VND-${Date.now().toString(36).toUpperCase()}`)
    const email = data.email?.trim() || `${code.toLowerCase()}@vendor.chitra.com`

    const existing = await db
        .select()
        .from(vendorTenants)
        .where(or(eq(vendorTenants.code, code), eq(vendorTenants.email, email)))
        .limit(1)

    if (existing.length > 0) {
        return { success: false, error: `Vendor dengan kode ${code} atau email ${email} sudah terdaftar.` }
    }

    const [newVendor] = await db
        .insert(vendorTenants)
        .values({
            name: cleanName,
            code,
            email,
            phone: data.phone?.trim() || null,
            address: data.address?.trim() || null,
            city: data.city?.trim() || null,
            sapVendorCode: data.sapVendorCode?.trim() || null,
            isPkp: Boolean(data.isPkp),
            npwp: data.npwp?.trim() || null,
            bankName: data.bankName?.trim() || null,
            bankAccountNo: data.bankAccountNo?.trim() || null,
            bankAccountHolder: data.bankAccountHolder?.trim() || null,
            defaultTopDays: Number(data.defaultTopDays) || 30,
            status: data.status || "active",
        })
        .returning()

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true, vendor: newVendor }
}

export async function updateMasterVendorAction(
    id: string,
    data: {
        name?: string
        email?: string
        phone?: string
        address?: string
        city?: string
        sapVendorCode?: string
        isPkp?: boolean
        npwp?: string
        bankName?: string
        bankAccountNo?: string
        bankAccountHolder?: string
        defaultTopDays?: number
        status?: "active" | "pending_invitation" | "suspended"
    }
) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    const [updated] = await db
        .update(vendorTenants)
        .set({
            ...(data.name ? { name: data.name.trim() } : {}),
            ...(data.email ? { email: data.email.trim() } : {}),
            phone: data.phone !== undefined ? data.phone.trim() : undefined,
            address: data.address !== undefined ? data.address.trim() : undefined,
            city: data.city !== undefined ? data.city.trim() : undefined,
            sapVendorCode: data.sapVendorCode !== undefined ? data.sapVendorCode.trim() : undefined,
            isPkp: data.isPkp !== undefined ? Boolean(data.isPkp) : undefined,
            npwp: data.npwp !== undefined ? data.npwp.trim() : undefined,
            bankName: data.bankName !== undefined ? data.bankName.trim() : undefined,
            bankAccountNo: data.bankAccountNo !== undefined ? data.bankAccountNo.trim() : undefined,
            bankAccountHolder: data.bankAccountHolder !== undefined ? data.bankAccountHolder.trim() : undefined,
            defaultTopDays: data.defaultTopDays !== undefined ? Number(data.defaultTopDays) : undefined,
            status: data.status,
            updatedAt: new Date(),
        })
        .where(eq(vendorTenants.id, id))
        .returning()

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true, vendor: updated }
}

export async function deleteMasterVendorAction(id: string) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    await db
        .update(vendorTenants)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(vendorTenants.id, id))

    revalidatePath("/dashboard/vendor-invoices")
    return { success: true }
}

/**
 * 16. Vendor Contracts Management (CRUD)
 */
export async function getVendorContractsAction(params?: {
    search?: string
    status?: string
    category?: string
}) {
    let whereClause = undefined
    if (params?.search?.trim()) {
        const clean = `%${params.search.trim()}%`
        whereClause = or(
            ilike(vendorContracts.contractNumber, clean),
            ilike(vendorContracts.vendorName, clean),
            ilike(vendorContracts.itemName, clean)
        )
    }

    const contracts = await db
        .select()
        .from(vendorContracts)
        .where(whereClause)
        .orderBy(desc(vendorContracts.createdAt))

    return contracts.map((c) => ({
        ...c,
        contractValue: Number(c.contractValue) || 0,
        ppnPercent: Number(c.ppnPercent) || 0,
        pphPercent: Number(c.pphPercent) || 0,
    }))
}

export async function createVendorContractAction(data: {
    contractNumber: string
    vendorName: string
    vendorSapCode?: string
    vendorTenantId?: string
    title?: string
    category: string
    itemName: string
    itemDetails?: any
    contractValue: number
    billingFrequency?: string
    currency?: string
    startDate: string
    endDate: string
    topDays: number
    isPkp: boolean
    ppnPercent?: number
    pphPercent?: number
    bankName?: string
    bankAccountNumber?: string
    bankAccountHolder?: string
    npwpNumber?: string
    vendorAddress?: string
    vendorPicName?: string
    contractFileUrl?: string
    attachmentUrls?: any
    notes?: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) return { success: false, error: "Unauthorized" }

    if (!data.contractNumber?.trim()) {
        return { success: false, error: "Nomor Kontrak wajib diisi." }
    }
    if (!data.vendorName?.trim()) {
        return { success: false, error: "Nama Vendor wajib diisi." }
    }
    if (!data.itemName?.trim()) {
        return { success: false, error: "Nama Barang / Jasa / Unit wajib diisi." }
    }
    if (!data.contractValue || data.contractValue <= 0) {
        return { success: false, error: "Nilai kontrak / tarif sewa harus lebih besar dari 0." }
    }

    try {
        const [newContract] = await db
            .insert(vendorContracts)
            .values({
                contractNumber: data.contractNumber.trim(),
                vendorName: data.vendorName.trim(),
                vendorSapCode: data.vendorSapCode?.trim() || null,
                vendorTenantId: data.vendorTenantId || null,
                title: data.title?.trim() || "Perjanjian Kerjasama / Sewa",
                category: data.category || "Sewa Kendaraan",
                itemName: data.itemName.trim(),
                itemDetails: data.itemDetails || {},
                contractValue: String(data.contractValue),
                billingFrequency: data.billingFrequency || "monthly",
                currency: data.currency || "IDR",
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                topDays: Number(data.topDays) || 45,
                isPkp: Boolean(data.isPkp),
                ppnPercent: String(data.ppnPercent ?? 11),
                pphPercent: String(data.pphPercent ?? 2),
                bankName: data.bankName?.trim() || null,
                bankAccountNumber: data.bankAccountNumber?.trim() || null,
                bankAccountHolder: data.bankAccountHolder?.trim() || null,
                npwpNumber: data.npwpNumber?.trim() || null,
                vendorAddress: data.vendorAddress?.trim() || null,
                vendorPicName: data.vendorPicName?.trim() || null,
                contractFileUrl: data.contractFileUrl || null,
                attachmentUrls: data.attachmentUrls || {},
                status: "active",
                notes: data.notes?.trim() || null,
                createdBy: currentUser.id,
            })
            .returning()

        revalidatePath("/dashboard/vendor-invoices")
        return { success: true, contract: newContract }
    } catch (e: any) {
        return { success: false, error: e.message || "Gagal menyimpan kontrak vendor." }
    }
}

/**
 * 22. Login & Auto-Provisioning Rekanan Master Vendor SAP
 * Memungkinkan vendor login menggunakan Kode Vendor SAP (misal: "2000001", "2010600", "2012991")
 * dengan password awal "Password123!".
 */
export async function prepareVendorLoginAction(identifier: string) {
    if (!identifier?.trim()) {
        return { success: false, error: "Email atau Kode Vendor SAP wajib diisi." }
    }

    const cleanInput = identifier.trim()

    // Jika input mengandung '@', cari langsung di tabel user / vendorTenants
    if (cleanInput.includes("@")) {
        const cleanEmail = cleanInput.toLowerCase()
        const u = await db.query.user.findFirst({
            where: (usr, { eq }) => eq(usr.email, cleanEmail),
        })
        if (u) {
            return { success: true, email: u.email, isSapCode: false }
        }
        return { success: false, error: "Email vendor belum terdaftar." }
    }

    // Jika input adalah Kode Vendor SAP (angka atau alfanumerik)
    const cleanSupplierCode = cleanInput.replace(/^0+/, "")
    const sapVendor = await db.query.sapVendorMaster.findFirst({
        where: (svm, { or, eq }) => or(
            eq(svm.supplierCode, cleanInput),
            eq(svm.supplierCode, cleanSupplierCode)
        ),
    })

    if (!sapVendor) {
        return {
            success: false,
            error: `Kode Vendor SAP "${cleanInput}" tidak ditemukan di database Master Data.`,
        }
    }

    // Tentukan email untuk akun ini (ambil dari salesPicEmail, directorEmail, atau email virtual resmi)
    const vendorEmail =
        sapVendor.salesPicEmail?.trim().toLowerCase() ||
        sapVendor.directorEmail?.trim().toLowerCase() ||
        `${sapVendor.supplierCode}@vendor-sap.chitra.com`

    // Cek apakah user sudah ada di tabel user
    let vendorUser = await db.query.user.findFirst({
        where: (usr, { eq }) => eq(usr.email, vendorEmail),
    })

    const defaultHashedPassword = await bcrypt.hash("Password123!", 10)

    if (!vendorUser) {
        // Buat user baru di Better-Auth
        const userId = crypto.randomUUID()
        const [newUser] = await db
            .insert(user)
            .values({
                id: userId,
                name: `${sapVendor.vendorName} (${sapVendor.supplierCode})`,
                email: vendorEmail,
                role: "vendor",
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning()

        vendorUser = newUser

        // Buat akun kredensial dengan password default Password123!
        await db.insert(account).values({
            id: crypto.randomUUID(),
            accountId: vendorUser.id,
            providerId: "credential",
            userId: vendorUser.id,
            password: defaultHashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
    }

    // Cek apakah tenant di vendorTenants sudah ada
    let tenant = await db.query.vendorTenants.findFirst({
        where: (vt, { or, eq }) => or(
            eq(vt.sapVendorCode, sapVendor.supplierCode),
            eq(vt.code, `SAP-${sapVendor.supplierCode}`)
        ),
    })

    if (!tenant) {
        const [newTenant] = await db
            .insert(vendorTenants)
            .values({
                code: `SAP-${sapVendor.supplierCode}`,
                name: sapVendor.vendorName,
                email: vendorEmail,
                phone: sapVendor.telephone || sapVendor.salesPicPhone || sapVendor.directorPhone || null,
                address: sapVendor.address || sapVendor.street || `${sapVendor.city || ""}, ${sapVendor.country || ""}`.trim() || null,
                city: sapVendor.city || null,
                country: sapVendor.country || null,
                postalCode: sapVendor.postalCode || null,
                defaultTopDays: sapVendor.topDays || 30,
                isPkp: true,
                npwp: sapVendor.npwp || null,
                bankName: sapVendor.bankName || null,
                bankAccountNo: sapVendor.bankAccountNumber || null,
                bankAccountHolder: sapVendor.bankAccountHolder || sapVendor.vendorName,
                sapVendorCode: sapVendor.supplierCode,
                sapTopCode: sapVendor.termsOfPayment || null,
                sapCurrency: sapVendor.orderCurrency || "IDR",
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning()
        tenant = newTenant
    }

    // Pastikan relasi di vendorTenantUsers sudah ada
    const mapping = await db
        .select()
        .from(vendorTenantUsers)
        .where(
            and(
                eq(vendorTenantUsers.tenantId, tenant.id),
                eq(vendorTenantUsers.userId, vendorUser.id)
            )
        )
        .limit(1)

    if (mapping.length === 0) {
        await db.insert(vendorTenantUsers).values({
            tenantId: tenant.id,
            userId: vendorUser.id,
            role: "owner",
        })
    }

    return {
        success: true,
        email: vendorEmail,
        isSapCode: true,
        vendorName: sapVendor.vendorName,
        supplierCode: sapVendor.supplierCode,
    }
}

/**
 * 23. Mengubah kata sandi akun vendor yang sedang login
 */
export async function changeVendorPasswordAction(data: {
    currentPassword: string
    newPassword: string
}) {
    const currentUser = await getActiveUser()
    if (!currentUser) {
        return { success: false, error: "Sesi telah berakhir. Silakan login kembali." }
    }

    if (!data.newPassword || data.newPassword.length < 8) {
        return { success: false, error: "Kata sandi baru minimal harus 8 karakter." }
    }

    // Ambil account record pengguna saat ini
    const acc = await db
        .select()
        .from(account)
        .where(
            and(
                eq(account.userId, currentUser.id),
                eq(account.providerId, "credential")
            )
        )
        .limit(1)

    if (acc.length === 0 || !acc[0].password) {
        return { success: false, error: "Akun login tidak ditemukan." }
    }

    // Verifikasi kata sandi lama
    const isMatch = await bcrypt.compare(data.currentPassword, acc[0].password)
    if (!isMatch) {
        return { success: false, error: "Kata sandi saat ini tidak sesuai." }
    }

    // Hash kata sandi baru
    const newHashed = await bcrypt.hash(data.newPassword, 10)

    await db
        .update(account)
        .set({
            password: newHashed,
            updatedAt: new Date(),
        })
        .where(eq(account.id, acc[0].id))

    return { success: true }
}
