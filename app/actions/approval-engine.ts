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
    exchangeRate: number = 1
): Promise<QuotationMarginEvaluationSummary> {
    const STANDARD_MARGIN = 11.0

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
            ? Number(item.costSap) * exchangeRate
            : (Number(item.costIdr) || 0)

        const unitPrice = Number(item.unitPrice) || 0

        // Margin calculation: ((UnitPrice - CostIdr) / CostIdr) * 100
        const marginPercent = costIdr > 0
            ? ((unitPrice - costIdr) / costIdr) * 100
            : (unitPrice > 0 ? 100 : 0)

        const discountGapPercent = Math.max(0, STANDARD_MARGIN - marginPercent)

        // Tentukan kategori: jika category mengandung "tyre" atau "tire" -> prime_tyre, selain itu pas
        const catRaw = (item.category || "").toLowerCase()
        const isTyre = catRaw.includes("tyre") || catRaw.includes("tire")
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
            const assignedUserName = raw.user?.name || "Belum Ditetapkan"

            // Logika Auto-Skip jika approver sama persis dengan tahap sebelumnya
            const isAutoSkip = Boolean(assignedUserId && lastAssignedUserId && assignedUserId === lastAssignedUserId)
            const skipReason = isAutoSkip ? "Auto-approved (Same Approver as previous step)" : undefined

            approvalSteps.push({
                stepOrder: currentOrder++,
                roleKey: raw.roleKey,
                label: raw.label,
                assignedUserId,
                assignedUserName,
                isAutoSkip,
                skipReason,
            })

            if (assignedUserId) {
                lastAssignedUserId = assignedUserId
            }
        }
    }

    return {
        standardMargin: STANDARD_MARGIN,
        minItemMargin: Number(minItemMargin.toFixed(2)),
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

export async function submitQuotationForApproval(quotationId: number) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return { success: false as const, error: "Unauthorized" }
        }

        // Ambil quotation dan items
        const quotation = await db.query.quotations.findFirst({
            where: eq(quotations.id, quotationId),
            with: {
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

        if (quotation.status === "approved") {
            return { success: false as const, error: "Quotation is already approved" }
        }

        // Evaluasi margin
        const evaluationItems: QuotationItemEvaluationInput[] = quotation.items.map(it => ({
            productId: it.productId,
            category: it.product?.category,
            materialDescription: it.description || it.product?.materialDescription,
            unitPrice: Number(it.unitPrice),
            quantity: it.quantity,
            costSap: it.product?.costSap ? Number(it.product.costSap) : null,
        }))

        const evaluation = await evaluateQuotationMargin(evaluationItems, quotation.salesPersonId || quotation.createdBy)

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

        // Jika butuh approval:
        if (evaluation.approvalSteps.length === 0) {
            return {
                success: false as const,
                error: "Matriks approval untuk sales person belum dikonfigurasi di Settings > Approval Engine.",
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
        await db.update(quotations)
            .set({
                status: "waiting_approval",
                rejectedAt: null,
                rejectedBy: null,
                rejectionReason: null,
                updatedAt: new Date(),
            })
            .where(eq(quotations.id, quotationId))

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
            quantity: it.quantity,
            costSap: it.product?.costSap ? Number(it.product.costSap) : null,
        }))

        const evaluation = await evaluateQuotationMargin(evaluationItems, quotation.salesPersonId || quotation.createdBy)

        // Cari active step (pending pertama yang tidak skipped)
        const activeStep = progressSteps.find(s => s.status === "pending") || null

        // Apakah current user berhak approve/reject step aktif ini?
        const canActOnCurrentStep = Boolean(
            currentUser &&
            activeStep &&
            (activeStep.assignedUserId === currentUser.id || currentUser.role === "Admin" || currentUser.role === "admin")
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

        if (!detail.canActOnCurrentStep) {
            return { success: false as const, error: "Anda tidak memiliki wewenang untuk menyetujui langkah ini." }
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

                revalidatePath(`/dashboard/quotations/${input.quotationId}`)
                revalidatePath("/dashboard/quotations")
                revalidatePath("/dashboard/approvals")
                return { success: true as const, message: "Quotation telah disetujui sepenuhnya (Full Approved)!" }
            } else {
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

// ==========================================
// 7. INBOX QUOTATION APPROVALS
// ==========================================

export async function getApprovalInboxQuotations() {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return { success: true as const, pendingItems: [] }
        }

        // Cari seluruh progress yang pending dimana assignedUserId adalah user ini (atau admin)
        const isUserAdmin = currentUser.role === "Admin" || currentUser.role === "admin"

        const condition = isUserAdmin
            ? eq(quotationApprovalProgress.status, "pending")
            : and(
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
