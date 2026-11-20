"use server"

import { db } from "@/db"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq, and, asc, desc, inArray, sql } from "drizzle-orm"
import {
    quotationApprovalTiers,
    quotationSalesApproverMatrix,
    quotationApprovalProgress,
    quotations,
    quotationItems,
    products,
    user,
    customers,
} from "@/db/schema"
import { sendEmail } from "@/lib/email"
import { getSetting, updateSetting } from "@/app/actions/settings"

// Standar Baseline Margin (Bisa dikonfigurasi & tersync dengan Quotation)
export async function getStandardMarginBaseline(): Promise<number> {
    try {
        const val = await getSetting("quotation_standard_margin")
        return val ? Number(val) : 11.0
    } catch {
        return 11.0
    }
}

export async function setStandardMarginBaseline(margin: number) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) return { success: false as const, error: "Unauthorized" }
        await updateSetting("quotation_standard_margin", margin.toString())
        revalidatePath("/dashboard/settings/approval-engine")
        revalidatePath("/dashboard/quotations/create")
        revalidatePath("/dashboard/quotations")
        return { success: true as const }
    } catch (error) {
        console.error("Failed to update standard margin baseline:", error)
        return { success: false as const, error: "Gagal menyimpan margin standard baseline" }
    }
}

// Helper: Kirim Notifikasi Email Delivery Resmi untuk Alur Approval
async function sendQuotationApprovalNotification(input: {
    toEmail: string
    toName: string
    quotationNumber: string
    customerName: string
    stepLabel: string
    minMargin: number
    quotationId: number
    actionType: "pending_review" | "approved" | "rejected"
    comment?: string | null
}) {
    try {
        if (!input.toEmail) return

        const baseUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        const link = `${baseUrl}/dashboard/quotations/${input.quotationId}`

        let subject = `[Approval] Permohonan Persetujuan Quotation: ${input.quotationNumber}`
        let headerBadge = "PERMOHONAN PERSETUJUAN"
        let headerBadgeColor = "#f59e0b"
        let headerBadgeBg = "#fffbeb"
        let title = "Persetujuan Quotation Diperlukan"
        let introText = `Yth. <strong>${input.toName}</strong>,<br/>Terdapat 1 dokumen quotation dengan margin di bawah batas standar baseline yang memerlukan tinjauan dan persetujuan dari Anda untuk <strong>${input.stepLabel}</strong>.`
        let buttonText = "👉 Tinjau & Proses Dokumen"
        let statusBadge = `<span style="background-color: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 12px; display: inline-block;">Menunggu Persetujuan (${input.stepLabel})</span>`

        if (input.actionType === "approved") {
            subject = `[Disetujui] Quotation Telah Disetujui Sepenuhnya: ${input.quotationNumber}`
            headerBadge = "FULL APPROVED"
            headerBadgeColor = "#10b981"
            headerBadgeBg = "#f0fdf4"
            title = "Quotation Telah Disetujui Sepenuhnya"
            introText = `Yth. <strong>${input.toName}</strong>,<br/>Kabar baik! Dokumen quotation berikut telah berhasil disetujui pada seluruh tahapan hierarki dan siap untuk diproses lebih lanjut.`
            buttonText = "📄 Lihat Dokumen Quotation"
            statusBadge = `<span style="background-color: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 12px; display: inline-block;">✓ Full Approved</span>`
        } else if (input.actionType === "rejected") {
            subject = `[Ditolak] Quotation Memerlukan Revisi: ${input.quotationNumber}`
            headerBadge = "MEMERLUKAN REVISI"
            headerBadgeColor = "#ef4444"
            headerBadgeBg = "#fef2f2"
            title = "Quotation Ditolak oleh Approver"
            introText = `Yth. <strong>${input.toName}</strong>,<br/>Dokumen quotation berikut ditolak pada tahap <strong>${input.stepLabel}</strong>. Silakan periksa catatan approver di bawah ini dan lakukan penyesuaian harga atau margin.`
            buttonText = "✏️ Buka & Revisi Quotation"
            statusBadge = `<span style="background-color: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 12px; display: inline-block;">✕ Ditolak (${input.stepLabel})</span>`
        }

        const isBelowMargin = input.minMargin < 11
        const marginColor = isBelowMargin ? "#dc2626" : "#16a34a"
        const marginBg = isBelowMargin ? "#fef2f2" : "#f0fdf4"
        const marginText = `${input.minMargin}% ${isBelowMargin ? "(Di bawah batas standard 11.00%)" : "(Memenuhi standar baseline)"}`

        const html = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 30px 10px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
                    
                    <!-- HEADER BRANDING -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 26px 32px; text-align: left; border-bottom: 3px solid #f59e0b;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td>
                                        <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #93c5fd; text-transform: uppercase; margin-bottom: 4px;">
                                            ONE CHITRA • APPROVAL ENGINE
                                        </div>
                                        <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase;">
                                            PT CHITRA PARATAMA
                                        </div>
                                    </td>
                                    <td align="right" style="vertical-align: middle;">
                                        <span style="background-color: ${headerBadgeBg}; color: ${headerBadgeColor}; border: 1px solid ${headerBadgeColor}; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                                            ${headerBadge}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CONTENT BODY -->
                    <tr>
                        <td style="padding: 32px 32px 24px 32px;">
                            <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; font-weight: 700;">
                                ${title}
                            </h2>
                            <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                                ${introText}
                            </p>

                            <!-- CARD RINCIAN DOKUMEN -->
                            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
                                <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                                    Ringkasan Informasi Dokumen
                                </div>
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px;">
                                    <tr>
                                        <td style="padding: 7px 0; color: #64748b; width: 140px; font-weight: 500;">No. Quotation</td>
                                        <td style="padding: 7px 0; font-weight: 700; color: #0f172a; font-family: 'Courier New', Courier, monospace; font-size: 14px;">
                                            ${input.quotationNumber}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Nama Customer</td>
                                        <td style="padding: 7px 0; font-weight: 600; color: #1e293b;">
                                            ${input.customerName}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Status Alur</td>
                                        <td style="padding: 7px 0;">
                                            ${statusBadge}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Margin Terendah</td>
                                        <td style="padding: 7px 0;">
                                            <span style="background-color: ${marginBg}; color: ${marginColor}; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 13px; font-family: 'Courier New', Courier, monospace;">
                                                ${marginText}
                                            </span>
                                        </td>
                                    </tr>
                                    ${input.comment ? `
                                    <tr>
                                        <td style="padding: 10px 0 4px 0; color: #64748b; font-weight: 500; vertical-align: top;">Catatan Approver</td>
                                        <td style="padding: 10px 0 4px 0; color: #334155; font-style: italic;">
                                            <div style="background-color: #ffffff; border-left: 3px solid #94a3b8; padding: 8px 12px; border-radius: 0 6px 6px 0; font-size: 13px;">
                                                &quot;${input.comment}&quot;
                                            </div>
                                        </td>
                                    </tr>
                                    ` : ""}
                                </table>
                            </div>

                            <!-- TOMBOL ACTION CALL TO ACTION -->
                            <div style="text-align: center; margin: 32px 0 24px 0;">
                                <a href="${link}" target="_blank" style="display: inline-block; background-color: #2563eb; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 32px; border-radius: 8px; box-shadow: 0 3px 10px rgba(37, 99, 235, 0.25); letter-spacing: 0.3px;">
                                    ${buttonText}
                                </a>
                            </div>

                            <!-- CATATAN KEAMANAN / DIRECT LINK -->
                            <div style="background-color: #f1f5f9; border-radius: 6px; padding: 12px 16px; margin-top: 24px; font-size: 11px; color: #64748b; text-align: center;">
                                Jika tombol di atas tidak dapat diklik, silakan salin dan buka tautan berikut pada browser Anda:<br/>
                                <a href="${link}" style="color: #2563eb; word-break: break-all; text-decoration: underline;">${link}</a>
                            </div>
                        </td>
                    </tr>

                    <!-- FOOTER RESMI -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6;">
                            <div style="font-weight: 700; color: #475569; margin-bottom: 4px;">
                                PT CHITRA PARATAMA
                            </div>
                            <div>
                                Total Tire & Fleet Management Solution • One Chitra Enterprise Portal
                            </div>
                            <div style="margin-top: 6px; color: #cbd5e1;">
                                Gedung TMT 1, Lantai 5, Jl. Cilandak KKO No. 1, Jakarta Selatan 12560
                            </div>
                            <div style="margin-top: 10px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px;">
                                Pesan ini dikirimkan secara otomatis oleh sistem One Chitra. Harap tidak membalas email ini secara langsung.
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `

        // Kirim langsung ke penerima email asli
        await sendEmail({
            to: input.toEmail,
            subject,
            html,
            actionUrl: link,
        })
    } catch (err) {
        console.error("Gagal mengirim notifikasi email approval:", err)
    }
}

// Helper to get authenticated user
async function getCurrentUser() {
    const session = await auth.api.getSession({
        headers: await headers(),
    })
    return session?.user || null
}

// ==========================================
// 1. TIERS CONFIGURATION (CRUD)
// ==========================================

export async function getQuotationApprovalTiers() {
    try {
        const tiers = await db.query.quotationApprovalTiers.findMany({
            orderBy: [asc(quotationApprovalTiers.productCategory), asc(quotationApprovalTiers.stagingLevel)],
        })
        return { success: true as const, data: tiers }
    } catch (error) {
        console.error("Failed to get quotation approval tiers:", error)
        return { success: false as const, error: "Failed to load approval tiers" }
    }
}

export async function saveQuotationApprovalTier(input: {
    id?: number
    productCategory: string
    stagingLevel: number
    positionName: string
    minMargin: number
    maxMargin: number
    maxDiscountGap?: number | null
    isAutoApproved: boolean
    description?: string | null
    isActive?: boolean
}) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return { success: false as const, error: "Unauthorized" }
        }

        if (input.id) {
            await db.update(quotationApprovalTiers)
                .set({
                    positionName: input.positionName,
                    minMargin: input.minMargin.toString(),
                    maxMargin: input.maxMargin.toString(),
                    maxDiscountGap: input.maxDiscountGap != null ? input.maxDiscountGap.toString() : null,
                    isAutoApproved: input.isAutoApproved,
                    description: input.description,
                    isActive: input.isActive ?? true,
                    updatedAt: new Date(),
                })
                .where(eq(quotationApprovalTiers.id, input.id))
        } else {
            await db.insert(quotationApprovalTiers)
                .values({
                    productCategory: input.productCategory,
                    stagingLevel: input.stagingLevel,
                    positionName: input.positionName,
                    minMargin: input.minMargin.toString(),
                    maxMargin: input.maxMargin.toString(),
                    maxDiscountGap: input.maxDiscountGap != null ? input.maxDiscountGap.toString() : null,
                    isAutoApproved: input.isAutoApproved,
                    description: input.description,
                    isActive: input.isActive ?? true,
                })
        }

        revalidatePath("/dashboard/settings/approval-engine")
        return { success: true as const }
    } catch (error) {
        console.error("Failed to save quotation approval tier:", error)
        return { success: false as const, error: "Failed to save tier" }
    }
}

// ==========================================
// 2. SALES APPROVER MATRIX (CRUD)
// ==========================================

export async function getSalesApproverMatrix() {
    try {
        const rows = await db.query.quotationSalesApproverMatrix.findMany({
            with: {
                salesUser: true,
                spvUser: true,
                majorAccountUser: true,
                salesManagerUser: true,
                generalManagerUser: true,
                financeManagerUser: true,
                secretaryUser: true,
                directorUser: true,
            },
            orderBy: [asc(quotationSalesApproverMatrix.id)],
        })
        return { success: true as const, data: rows }
    } catch (error) {
        console.error("Failed to get sales approver matrix:", error)
        return { success: false as const, error: "Failed to load matrix" }
    }
}

export async function saveSalesApproverMatrixRow(input: {
    salesUserId: string
    spvUserId?: string | null
    majorAccountUserId?: string | null
    salesManagerUserId?: string | null
    generalManagerUserId?: string | null
    financeManagerUserId?: string | null
    secretaryUserId?: string | null
    directorUserId?: string | null
    notes?: string | null
    isActive?: boolean
}) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return { success: false as const, error: "Unauthorized" }
        }

        await db.insert(quotationSalesApproverMatrix)
            .values({
                salesUserId: input.salesUserId,
                spvUserId: input.spvUserId || null,
                majorAccountUserId: input.majorAccountUserId || null,
                salesManagerUserId: input.salesManagerUserId || null,
                generalManagerUserId: input.generalManagerUserId || null,
                financeManagerUserId: input.financeManagerUserId || null,
                secretaryUserId: input.secretaryUserId || null,
                directorUserId: input.directorUserId || null,
                notes: input.notes || null,
                isActive: input.isActive ?? true,
            })
            .onConflictDoUpdate({
                target: [quotationSalesApproverMatrix.salesUserId],
                set: {
                    spvUserId: input.spvUserId || null,
                    majorAccountUserId: input.majorAccountUserId || null,
                    salesManagerUserId: input.salesManagerUserId || null,
                    generalManagerUserId: input.generalManagerUserId || null,
                    financeManagerUserId: input.financeManagerUserId || null,
                    secretaryUserId: input.secretaryUserId || null,
                    directorUserId: input.directorUserId || null,
                    notes: input.notes || null,
                    isActive: input.isActive ?? true,
                    updatedAt: new Date(),
                },
            })

        revalidatePath("/dashboard/settings/approval-engine")
        return { success: true as const }
    } catch (error) {
        console.error("Failed to save sales approver matrix row:", error)
        return { success: false as const, error: "Failed to save matrix row" }
    }
}

// ==========================================
// 3. MARGIN & APPROVAL EVALUATION ENGINE
// ==========================================

export interface QuotationItemEvaluationInput {
    productId?: number | null
    category?: string | null
    materialDescription?: string | null
    unitPrice: number
    discount?: number
    quantity: number
    costSap?: number | null
    costIdr?: number | null
}

export interface ItemMarginEvaluationResult {
    index: number
    productName: string
    productCategory: "prime_tyre" | "pas"
    unitPrice: number
    costIdr: number
    marginPercent: number
    discountGapPercent: number
    stagingLevel: number
    positionName: string
    requiresApproval: boolean
    isAutoApproved: boolean
}

export interface QuotationMarginEvaluationSummary {
    standardMargin: number // 11
    minItemMargin: number
    averageMargin: number
    totalCostIdr: number
    totalRevenueIdr: number
    maxDiscountGap: number
    requiresApproval: boolean
    worstCaseLevel: number // 0 = Standard (>= 11%), 1..5
    worstCasePosition: string
    itemResults: ItemMarginEvaluationResult[]
    approvalSteps: Array<{
        stepOrder: number
        roleKey: string
        label: string
        assignedUserId: string | null
        assignedUserName: string | null
        isAutoSkip: boolean
        skipReason?: string
    }>
}

export async function evaluateQuotationMargin(
    items: QuotationItemEvaluationInput[],
    salesPersonId?: string | null,
    exchangeRate?: number | null
): Promise<QuotationMarginEvaluationSummary> {
    const standardBaseline = await getStandardMarginBaseline()
    const STANDARD_MARGIN = typeof standardBaseline === "number" && !isNaN(standardBaseline) ? standardBaseline : 11.0

    // Resolve exchange rate dari setting jika tidak disediakan atau <= 1
    let activeExchangeRate = typeof exchangeRate === "number" && exchangeRate > 1 ? exchangeRate : 1
    if (activeExchangeRate <= 1) {
        try {
            const rateSetting = await getSetting("manual_usd_rate")
            if (rateSetting && Number(rateSetting) > 1) {
                activeExchangeRate = Number(rateSetting)
            }
        } catch {
            activeExchangeRate = 16000 // Fallback realistis USD-IDR
        }
    }

    // 1. Ambil seluruh tier rules
    const tiers = await db.query.quotationApprovalTiers.findMany({
        where: eq(quotationApprovalTiers.isActive, true),
        orderBy: [asc(quotationApprovalTiers.stagingLevel)],
    })

    // 2. Evaluasi setiap item
    const itemResults: ItemMarginEvaluationResult[] = []
    let minItemMargin = 9999
    let maxDiscountGap = 0
    let worstCaseLevel = 0
    let worstCasePosition = "Standard"

    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const costIdr = (item.costSap && Number(item.costSap) > 0)
            ? Number(item.costSap) * activeExchangeRate
            : (Number(item.costIdr) || 0)

        const unitPrice = Number(item.unitPrice) || 0
        const quantity = Number(item.quantity) || 1
        const discount = Number(item.discount) || 0

        // Harga jual efektif per unit setelah dikurangi diskon per part
        const effectiveUnitPrice = Math.max(0, unitPrice - (quantity > 0 ? discount / quantity : discount))

        // Margin calculation berdasarkan harga efektif setelah diskon: ((EffectiveUnitPrice - CostIdr) / CostIdr) * 100
        const marginPercent = costIdr > 0
            ? ((effectiveUnitPrice - costIdr) / costIdr) * 100
            : (effectiveUnitPrice > 0 ? 100 : 0)

        const discountGapPercent = Math.max(0, STANDARD_MARGIN - marginPercent)

        // Tentukan kategori: Prime Product HANYA untuk type TYRE, selainnya Product ACC & Service (PAS)
        const catRaw = (item.category || "").trim().toUpperCase()
        const isTyre = catRaw === "TYRE" || catRaw === "PRIME PRODUCT"
        const productCategory: "prime_tyre" | "pas" = isTyre ? "prime_tyre" : "pas"

        // Evaluasi tier untuk item ini
        const categoryTiers = tiers.filter(t => t.productCategory === productCategory)
        let itemLevel = 0
        let positionName = "Standard"
        let isAutoApproved = false

        if (marginPercent < STANDARD_MARGIN) {
            // Cari tier yang cocok berdasarkan minMargin dan maxMargin
            const matchedTier = categoryTiers.find(t => {
                const min = Number(t.minMargin)
                const max = Number(t.maxMargin)
                return marginPercent >= min && marginPercent <= max
            }) || categoryTiers[categoryTiers.length - 1] // Fallback ke tier tertinggi jika margin sangat rendah/minus

            if (matchedTier) {
                itemLevel = matchedTier.stagingLevel
                positionName = matchedTier.positionName
                isAutoApproved = matchedTier.isAutoApproved
            }
        }

        if (marginPercent < minItemMargin) {
            minItemMargin = marginPercent
        }
        if (discountGapPercent > maxDiscountGap) {
            maxDiscountGap = discountGapPercent
        }

        const requiresApproval = itemLevel > 0 && !isAutoApproved
        if (itemLevel > worstCaseLevel) {
            worstCaseLevel = itemLevel
            worstCasePosition = positionName
        }

        itemResults.push({
            index: i,
            productName: item.materialDescription || `Item #${i + 1}`,
            productCategory,
            unitPrice,
            costIdr,
            marginPercent: Number(marginPercent.toFixed(2)),
            discountGapPercent: Number(discountGapPercent.toFixed(2)),
            stagingLevel: itemLevel,
            positionName,
            requiresApproval,
            isAutoApproved,
        })
    }

    if (items.length === 0) {
        minItemMargin = STANDARD_MARGIN
    }

    const requiresOverallApproval = worstCaseLevel > 0 && itemResults.some(r => r.requiresApproval)

    // 3. Jika membutuhkan approval dan salesPersonId diberikan, cari mapping approver dari matriks
    const approvalSteps: QuotationMarginEvaluationSummary["approvalSteps"] = []

    if (requiresOverallApproval && salesPersonId) {
        const matrix = await db.query.quotationSalesApproverMatrix.findFirst({
            where: eq(quotationSalesApproverMatrix.salesUserId, salesPersonId),
            with: {
                spvUser: true,
                majorAccountUser: true,
                salesManagerUser: true,
                generalManagerUser: true,
                financeManagerUser: true,
                secretaryUser: true,
                directorUser: true,
            },
        })

        // Rantai langkah potensial berdasarkan level worstCaseLevel:
        // Level 1: SPV
        // Level 2: Supervisory (SPV -> Major Account)
        // Level 3: Managerial (SPV -> Major Account -> Sales Manager)
        // Level 4: General Manager (SPV -> Major Account -> Sales Manager -> GM)
        // Level 5: Director (SPV -> Major Account -> Sales Manager -> GM -> Finance Manager -> Secretary -> Director)
        const rawSteps = [
            { roleKey: "spv", label: "Approval 1: SPV", user: matrix?.spvUser, minLevel: 1 },
            { roleKey: "major_account", label: "Approval 2: Major Account", user: matrix?.majorAccountUser, minLevel: 2 },
            { roleKey: "sales_manager", label: "Approval 3: Sales Manager", user: matrix?.salesManagerUser, minLevel: 3 },
            { roleKey: "general_manager", label: "Approval 4: General Manager", user: matrix?.generalManagerUser, minLevel: 4 },
            { roleKey: "finance_manager", label: "Approval 5: Finance Manager", user: matrix?.financeManagerUser, minLevel: 5 },
            { roleKey: "secretary", label: "Approval 6: Secretary", user: matrix?.secretaryUser, minLevel: 5 },
            { roleKey: "director", label: "Approval 7: Director", user: matrix?.directorUser, minLevel: 5 },
        ]

        let currentOrder = 1
        let lastAssignedUserId: string | null = null

        for (const raw of rawSteps) {
            // Hanya masukkan jika level kebutuhan dokumen memenuhi minLevel
            if (worstCaseLevel < raw.minLevel) continue

            // Jika secretary belum diisi di DB, lewati jika tidak ada
            if (raw.roleKey === "secretary" && !raw.user) continue

            const assignedUserId = raw.user?.id || null
            const assignedUserName = raw.user?.name || "-"

            // Jika di matriks bernilai "-" (tidak ada user yang di-assign):
            // Otomatis DILEWATI (SKIP) dan langsung ke approver berikutnya!
            const isUnassigned = !assignedUserId

            // Proteksi Self-Approval (Four-Eyes Principle):
            // Sales Person / Pembuat quotation TIDAK BOLEH menyetujui pengajuannya sendiri
            const isSelfApproval = Boolean(
                assignedUserId &&
                salesPersonId &&
                assignedUserId === salesPersonId
            )

            // Logika Auto-Skip:
            // 1. Kolom bernilai "-" pada matriks -> auto-skip (dilewati langsung ke berikutnya)
            // 2. Approver sama persis dengan tahap sebelumnya -> auto-skip (PIC sama)
            // 3. Approver adalah Sales Person pengaju sendiri -> auto-skip (Four-Eyes Principle)
            const isSameApprover = Boolean(assignedUserId && lastAssignedUserId && assignedUserId === lastAssignedUserId)
            const isAutoSkip = isUnassigned || isSameApprover || isSelfApproval
            const skipReason = isUnassigned
                ? "Dilewati (Tidak ada approver pada matriks)"
                : (isSelfApproval
                    ? "Dilewati (Sales pengaju tidak dapat menyetujui pengajuannya sendiri)"
                    : (isSameApprover ? "Auto-approved (Same Approver as previous step)" : undefined))

            approvalSteps.push({
                stepOrder: currentOrder++,
                roleKey: raw.roleKey,
                label: raw.label,
                assignedUserId,
                assignedUserName: isUnassigned ? "-" : assignedUserName,
                isAutoSkip,
                skipReason,
            })

            if (assignedUserId) {
                lastAssignedUserId = assignedUserId
            }
        }
    }

    // Hitung total revenue, cost, dan rata-rata margin keseluruhan
    const totalRevenue = items.reduce((sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0)
    const totalCost = items.reduce((sum, it) => {
        const cost = (it.costSap && Number(it.costSap) > 0)
            ? Number(it.costSap) * activeExchangeRate
            : (Number(it.costIdr) || 0)
        return sum + cost * (Number(it.quantity) || 1)
    }, 0)
    const averageMargin = totalCost > 0
        ? Number((((totalRevenue - totalCost) / totalCost) * 100).toFixed(2))
        : (totalRevenue > 0 ? 100 : 0)

    // Jaga agar minItemMargin tidak 9999 di UI jika tidak ada item
    const safeMinMargin = (items.length === 0 || minItemMargin >= 9999)
        ? (items.length === 0 ? STANDARD_MARGIN : (itemResults.length > 0 ? Math.min(...itemResults.map(r => r.marginPercent)) : STANDARD_MARGIN))
        : Number(minItemMargin.toFixed(2))

    return {
        standardMargin: STANDARD_MARGIN,
        minItemMargin: safeMinMargin,
        averageMargin,
        totalCostIdr: Math.round(totalCost),
        totalRevenueIdr: Math.round(totalRevenue),
        maxDiscountGap: Number(maxDiscountGap.toFixed(2)),
        requiresApproval: requiresOverallApproval,
        worstCaseLevel,
        worstCasePosition,
        itemResults,
        approvalSteps,
    }
}

// ==========================================
// 4. SUBMIT / INITIATE QUOTATION APPROVAL
// ==========================================

export async function submitQuotationForApproval(quotationId: number, justification?: string) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return { success: false as const, error: "Unauthorized" }
        }

        // Ambil quotation dan items
        const quotation = await db.query.quotations.findFirst({
            where: eq(quotations.id, quotationId),
            with: {
                customer: true,
                items: {
                    with: {
                        product: true,
                    },
                },
            },
        })

        if (!quotation) {
            return { success: false as const, error: "Quotation not found" }
        }

        // Evaluasi margin dengan kurs aktual
        const evaluationItems: QuotationItemEvaluationInput[] = quotation.items.map(it => ({
            productId: it.productId,
            category: it.product?.category,
            materialDescription: it.description || it.product?.materialDescription,
            unitPrice: Number(it.unitPrice),
            discount: Number(it.discount || 0),
            quantity: it.quantity,
            costSap: it.product?.costSap ? Number(it.product.costSap) : null,
            costIdr: (it as any).costIdr ? Number((it as any).costIdr) : (it.product?.costSap ? Number(it.product.costSap) : null),
        }))

        const evaluation = await evaluateQuotationMargin(evaluationItems, quotation.salesPersonId || quotation.createdBy)

        // Jika quotation sudah approved dan evaluasi margin memang aman (>= 11%), tidak perlu submit ulang
        if (quotation.status === "approved" && !evaluation.requiresApproval) {
            return { success: false as const, error: "Quotation is already approved and meets margin baseline" }
        }

        // Jika tidak butuh approval, langsung auto-approve!
        if (!evaluation.requiresApproval) {
            await db.update(quotations)
                .set({
                    status: "approved",
                    approvedAt: new Date(),
                    approvedBy: currentUser.id,
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, quotationId))

            revalidatePath(`/dashboard/quotations/${quotationId}`)
            revalidatePath("/dashboard/quotations")
            revalidatePath("/dashboard/approvals")
            return {
                success: true as const,
                requiresApproval: false,
                status: "approved",
                message: "Margin memenuhi standar (>= 11%). Quotation disetujui otomatis.",
            }
        }

        // Jika butuh approval, pastikan ada minimal 1 approver aktif yang tidak dilewati
        const hasActiveApprover = evaluation.approvalSteps.some(s => !s.isAutoSkip && s.assignedUserId)
        if (evaluation.approvalSteps.length === 0 || !hasActiveApprover) {
            return {
                success: false as const,
                error: "Matriks approval untuk sales person belum memiliki approver aktif yang ditetapkan.",
            }
        }

        // Hapus progress lama jika ada (misal re-submit setelah reject)
        await db.delete(quotationApprovalProgress).where(eq(quotationApprovalProgress.quotationId, quotationId))

        // Buat baris progress approval
        const progressInserts = evaluation.approvalSteps.map(step => ({
            quotationId,
            stepOrder: step.stepOrder,
            stepRole: step.roleKey,
            stepLabel: step.label,
            assignedUserId: step.assignedUserId || currentUser.id,
            status: step.isAutoSkip ? "skipped" : "pending",
            comment: step.skipReason || null,
            actedAt: step.isAutoSkip ? new Date() : null,
            requiredByMargin: evaluation.minItemMargin.toString(),
        }))

        await db.insert(quotationApprovalProgress).values(progressInserts)

        // Set status quotation menjadi waiting_approval
        const quotationUpdatePayload: Record<string, any> = {
            status: "waiting_approval",
            rejectedAt: null,
            rejectedBy: null,
            rejectionReason: null,
            updatedAt: new Date(),
        }
        if (typeof justification === "string" && justification.trim()) {
            quotationUpdatePayload.adminNote = justification.trim()
        }

        await db.update(quotations)
            .set(quotationUpdatePayload)
            .where(eq(quotations.id, quotationId))

        // Kirim Email Notifikasi ke Approver Pertama yang Aktif
        const firstActiveStep = progressInserts.find(s => s.status === "pending")
        if (firstActiveStep) {
            const approverUser = await db.query.user.findFirst({
                where: eq(user.id, firstActiveStep.assignedUserId),
            })
            if (approverUser?.email) {
                await sendQuotationApprovalNotification({
                    toEmail: approverUser.email,
                    toName: approverUser.name || "Approver",
                    quotationNumber: quotation.quotationNumber || `Quote #${quotationId}`,
                    customerName: quotation.customer?.name || "Customer",
                    stepLabel: firstActiveStep.stepLabel,
                    minMargin: evaluation.minItemMargin,
                    quotationId,
                    actionType: "pending_review",
                })
            }
        }

        revalidatePath(`/dashboard/quotations/${quotationId}`)
        revalidatePath("/dashboard/quotations")
        revalidatePath("/dashboard/approvals")

        return {
            success: true as const,
            requiresApproval: true,
            status: "waiting_approval",
            message: `Quotation berhasil diajukan untuk approval ke ${evaluation.worstCasePosition}.`,
        }
    } catch (error) {
        console.error("Failed to submit quotation for approval:", error)
        return { success: false as const, error: "Failed to submit approval" }
    }
}

// ==========================================
// 5. DETAIL APPROVAL & TRACKING
// ==========================================

export async function getQuotationApprovalDetail(quotationId: number) {
    try {
        const currentUser = await getCurrentUser()

        const quotation = await db.query.quotations.findFirst({
            where: eq(quotations.id, quotationId),
            with: {
                customer: true,
                salesPerson: true,
                createdByUser: true,
                items: {
                    with: {
                        product: true,
                    },
                },
            },
        })

        if (!quotation) {
            return { success: false as const, error: "Quotation not found" }
        }

        const progressSteps = await db.query.quotationApprovalProgress.findMany({
            where: eq(quotationApprovalProgress.quotationId, quotationId),
            with: {
                assignedUser: true,
            },
            orderBy: [asc(quotationApprovalProgress.stepOrder)],
        })

        // Hitung evaluasi margin
        const evaluationItems: QuotationItemEvaluationInput[] = quotation.items.map(it => ({
            productId: it.productId,
            category: it.product?.category,
            materialDescription: it.description || it.product?.materialDescription,
            unitPrice: Number(it.unitPrice),
            discount: Number(it.discount || 0),
            quantity: it.quantity,
            costSap: it.product?.costSap ? Number(it.product.costSap) : null,
            costIdr: (it as any).costIdr ? Number((it as any).costIdr) : (it.product?.costSap ? Number(it.product.costSap) : null),
        }))

        const evaluation = await evaluateQuotationMargin(evaluationItems, quotation.salesPersonId || quotation.createdBy)

        // Jika quotation masih berstatus 'draft' padahal margin memenuhi standar (tidak butuh persetujuan berjenjang),
        // otomatis sinkronkan statusnya di database menjadi 'approved' (Auto Approved)
        if (quotation.status === "draft" && !evaluation.requiresApproval && quotation.items.length > 0) {
            const approveTime = new Date()
            const approverId = quotation.approvedBy || quotation.salesPersonId || quotation.createdBy || currentUser?.id || "system"
            await db.update(quotations)
                .set({
                    status: "approved",
                    approvedAt: quotation.approvedAt || approveTime,
                    approvedBy: approverId,
                    updatedAt: approveTime,
                })
                .where(eq(quotations.id, quotationId))

            quotation.status = "approved"
            quotation.approvedAt = quotation.approvedAt || approveTime
            quotation.approvedBy = approverId
        }

        // Cari active step (pending pertama yang tidak skipped)
        const activeStep = progressSteps.find(s => s.status === "pending") || null

        // Apakah current user berhak approve/reject step aktif ini?
        // Hanya user yang memang ditugaskan sebagai PIC di active step (dan bukan self-approval) yang berhak!
        const canActOnCurrentStep = Boolean(
            currentUser &&
            activeStep &&
            activeStep.assignedUserId === currentUser.id
        )

        return {
            success: true as const,
            quotation,
            progressSteps,
            activeStep,
            evaluation,
            canActOnCurrentStep,
            currentUserId: currentUser?.id || null,
        }
    } catch (error) {
        console.error("Failed to get quotation approval detail:", error)
        return { success: false as const, error: "Failed to load approval detail" }
    }
}

// ==========================================
// 6. PROCESS APPROVE / REJECT ACTION
// ==========================================

export async function processQuotationApprovalAction(input: {
    quotationId: number
    action: "approve" | "reject"
    comment?: string
}) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return { success: false as const, error: "Unauthorized" }
        }

        const detail = await getQuotationApprovalDetail(input.quotationId)
        if (!detail.success || !detail.activeStep) {
            return { success: false as const, error: "Tidak ada langkah approval yang sedang menunggu tindakan." }
        }

        if (!detail.canActOnCurrentStep || detail.activeStep.assignedUserId !== currentUser.id) {
            return { success: false as const, error: "Anda tidak memiliki wewenang untuk menyetujui langkah ini. Hanya approver yang ditugaskan yang berhak memproses." }
        }

        const activeStep = detail.activeStep

        if (input.action === "reject") {
            // 1. Update step saat ini menjadi rejected
            await db.update(quotationApprovalProgress)
                .set({
                    status: "rejected",
                    actedAt: new Date(),
                    comment: input.comment || "Rejected by approver",
                })
                .where(eq(quotationApprovalProgress.id, activeStep.id))

            // 2. Update quotation status menjadi rejected
            await db.update(quotations)
                .set({
                    status: "rejected",
                    rejectedAt: new Date(),
                    rejectedBy: currentUser.id,
                    rejectionReason: input.comment || "Rejected by approver",
                    updatedAt: new Date(),
                })
                .where(eq(quotations.id, input.quotationId))

            // Kirim notifikasi email penolakan ke sales / pembuat quotation
            const requesterEmail = detail.quotation.salesPerson?.email || detail.quotation.createdByUser?.email
            if (requesterEmail) {
                await sendQuotationApprovalNotification({
                    toEmail: requesterEmail,
                    toName: detail.quotation.salesPerson?.name || detail.quotation.createdByUser?.name || "Sales",
                    quotationNumber: detail.quotation.quotationNumber || `Quote #${input.quotationId}`,
                    customerName: detail.quotation.customer?.name || "Customer",
                    stepLabel: activeStep.stepLabel,
                    minMargin: detail.evaluation.minItemMargin,
                    quotationId: input.quotationId,
                    actionType: "rejected",
                    comment: input.comment,
                })
            }

            revalidatePath(`/dashboard/quotations/${input.quotationId}`)
            revalidatePath("/dashboard/quotations")
            revalidatePath("/dashboard/approvals")
            return { success: true as const, message: "Quotation berhasil ditolak." }
        }

        if (input.action === "approve") {
            // 1. Update step saat ini menjadi approved
            await db.update(quotationApprovalProgress)
                .set({
                    status: "approved",
                    actedAt: new Date(),
                    comment: input.comment || null,
                })
                .where(eq(quotationApprovalProgress.id, activeStep.id))

            // 2. Ambil seluruh step tersisa
            const allSteps = await db.query.quotationApprovalProgress.findMany({
                where: eq(quotationApprovalProgress.quotationId, input.quotationId),
                orderBy: [asc(quotationApprovalProgress.stepOrder)],
            })

            // Cek apakah ada langkah pending berikutnya
            let remainingPendingSteps = allSteps.filter(s => s.status === "pending" && s.id !== activeStep.id)

            // Auto-skip jika langkah berikutnya ditugaskan ke approver yang sama yang baru saja approve
            while (remainingPendingSteps.length > 0 && remainingPendingSteps[0].assignedUserId === currentUser.id) {
                const autoSkipStep = remainingPendingSteps[0]
                await db.update(quotationApprovalProgress)
                    .set({
                        status: "approved",
                        actedAt: new Date(),
                        comment: "Auto-approved (Same Approver)",
                    })
                    .where(eq(quotationApprovalProgress.id, autoSkipStep.id))

                remainingPendingSteps = remainingPendingSteps.slice(1)
            }

            // Jika sudah tidak ada langkah pending tersisa -> Full Approved!
            if (remainingPendingSteps.length === 0) {
                await db.update(quotations)
                    .set({
                        status: "approved",
                        approvedAt: new Date(),
                        approvedBy: currentUser.id,
                        updatedAt: new Date(),
                    })
                    .where(eq(quotations.id, input.quotationId))

                // Kirim email persetujuan lengkap ke sales / pembuat quotation
                const requesterEmail = detail.quotation.salesPerson?.email || detail.quotation.createdByUser?.email
                if (requesterEmail) {
                    await sendQuotationApprovalNotification({
                        toEmail: requesterEmail,
                        toName: detail.quotation.salesPerson?.name || detail.quotation.createdByUser?.name || "Sales",
                        quotationNumber: detail.quotation.quotationNumber || `Quote #${input.quotationId}`,
                        customerName: detail.quotation.customer?.name || "Customer",
                        stepLabel: "Persetujuan Lengkap",
                        minMargin: detail.evaluation.minItemMargin,
                        quotationId: input.quotationId,
                        actionType: "approved",
                        comment: input.comment,
                    })
                }

                revalidatePath(`/dashboard/quotations/${input.quotationId}`)
                revalidatePath("/dashboard/quotations")
                revalidatePath("/dashboard/approvals")
                return { success: true as const, message: "Quotation telah disetujui sepenuhnya (Full Approved)!" }
            } else {
                // Kirim notifikasi email ke approver langkah berikutnya
                const nextStep = remainingPendingSteps[0]
                const nextApprover = await db.query.user.findFirst({
                    where: eq(user.id, nextStep.assignedUserId),
                })
                if (nextApprover?.email) {
                    await sendQuotationApprovalNotification({
                        toEmail: nextApprover.email,
                        toName: nextApprover.name || "Approver",
                        quotationNumber: detail.quotation.quotationNumber || `Quote #${input.quotationId}`,
                        customerName: detail.quotation.customer?.name || "Customer",
                        stepLabel: nextStep.stepLabel,
                        minMargin: detail.evaluation.minItemMargin,
                        quotationId: input.quotationId,
                        actionType: "pending_review",
                    })
                }

                revalidatePath(`/dashboard/quotations/${input.quotationId}`)
                revalidatePath("/dashboard/quotations")
                revalidatePath("/dashboard/approvals")
                return { success: true as const, message: `Langkah disetujui, diteruskan ke ${remainingPendingSteps[0].stepLabel}.` }
            }
        }

        return { success: false as const, error: "Aksi tidak valid" }
    } catch (error) {
        console.error("Failed to process approval action:", error)
        return { success: false as const, error: "Failed to process approval action" }
    }
}

export async function updateQuotationJustification(input: {
    quotationId: number
    justification: string
}) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return { success: false as const, error: "Unauthorized" }
        }

        await db.update(quotations)
            .set({
                adminNote: input.justification.trim() || null,
                updatedAt: new Date(),
            })
            .where(eq(quotations.id, input.quotationId))

        revalidatePath(`/dashboard/quotations/${input.quotationId}`)
        revalidatePath("/dashboard/quotations")
        revalidatePath("/dashboard/approvals")

        return { success: true as const, message: "Catatan alasan margin berhasil diperbarui." }
    } catch (error) {
        console.error("Failed to update quotation justification:", error)
        return { success: false as const, error: "Gagal memperbarui catatan alasan margin." }
    }
}

// ==========================================
// 7. INBOX QUOTATION APPROVALS
// ==========================================

export async function getApprovalInboxQuotations() {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return { success: true as const, pendingItems: [] }
        }

        // Inbox persetujuan hanya memuat tugas yang secara eksplisit ditugaskan kepada user yang sedang login
        const condition = and(
            eq(quotationApprovalProgress.status, "pending"),
            eq(quotationApprovalProgress.assignedUserId, currentUser.id)
        )

        const pendingSteps = await db.query.quotationApprovalProgress.findMany({
            where: condition,
            with: {
                quotation: {
                    with: {
                        customer: true,
                        salesPerson: true,
                        createdByUser: true,
                    },
                },
            },
            orderBy: [desc(quotationApprovalProgress.createdAt)],
        })

        // Filter hanya yang quotation-nya berstatus waiting_approval
        const pendingItems = pendingSteps
            .filter(step => step.quotation && step.quotation.status === "waiting_approval")
            .map(step => ({
                stepId: step.id,
                stepOrder: step.stepOrder,
                stepLabel: step.stepLabel,
                stepRole: step.stepRole,
                requiredByMargin: step.requiredByMargin ? Number(step.requiredByMargin) : null,
                createdAt: step.createdAt,
                quotation: step.quotation,
            }))

        return { success: true as const, pendingItems }
    } catch (error) {
        console.error("Failed to get approval inbox quotations:", error)
        return { success: false as const, error: "Failed to load approval inbox" }
    }
}
