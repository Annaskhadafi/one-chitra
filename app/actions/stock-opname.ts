"use server"

import { db } from "@/db"
import { stockOpnameSessions, stockOpnameItems, stockOpnameSignatures, stockLevels, stockMovements, products, warehouses } from "@/db/schema"
import { eq, and, desc, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAuthenticatedSession } from "@/lib/rbac"
import { z } from "zod"
import { createOpnameSessionSchema, updateOpnameCountSchema, type CreateOpnameSessionInput } from "@/lib/schemas"
import type { OpnamePdfReportData } from "@/lib/types"
import { sendSystemTemplatedEmailByCode } from "@/lib/email"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"
import { formatWarehouseLabel, normalizeSloc, normalizeSlocFields } from "@/lib/sloc"
import {
    clearStockOpnameRfidArtifacts,
    syncStockOpnameRfidReview,
} from "@/lib/rfid-opname"

type SapStockRow = {
    material_no: string | null
    stor_loc: string | null
    total_stock: string | number | null
}

type SortableOpnameItem = {
    systemQty: number
    product?: {
        category?: string | null
        materialNumber?: string | null
        materialDescription?: string | null
    } | null
}

const sortOpnameItemsByCategoryAndStock = <T extends SortableOpnameItem>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
        const categoryA = (a.product?.category ?? "").trim().toLowerCase()
        const categoryB = (b.product?.category ?? "").trim().toLowerCase()

        const categoryCompare = categoryA.localeCompare(categoryB, undefined, { sensitivity: "base" })
        if (categoryCompare !== 0) {
            return categoryCompare
        }

        if (b.systemQty !== a.systemQty) {
            return b.systemQty - a.systemQty
        }

        const materialA = (a.product?.materialNumber ?? "").trim().toLowerCase()
        const materialB = (b.product?.materialNumber ?? "").trim().toLowerCase()
        const materialCompare = materialA.localeCompare(materialB, undefined, { sensitivity: "base" })
        if (materialCompare !== 0) {
            return materialCompare
        }

        const descriptionA = (a.product?.materialDescription ?? "").trim().toLowerCase()
        const descriptionB = (b.product?.materialDescription ?? "").trim().toLowerCase()
        return descriptionA.localeCompare(descriptionB, undefined, { sensitivity: "base" })
    })
}

const normalizeMaterialNumber = (value: string | null | undefined) =>
    (value || "").trim().toUpperCase()

export type OpnameSourceType = "sap" | "actual"
type PermissionAction = "view" | "create" | "edit" | "delete"

const normalizeOpnameSourceType = (value: string | null | undefined): OpnameSourceType =>
    value === "actual" ? "actual" : "sap"

const isPermissionDeniedError = (error: unknown) =>
    error instanceof Error && error.message.toLowerCase().includes("permission denied")

const getOpnameAuthSession = async (sourceType: OpnameSourceType, action: PermissionAction) => {
    if (sourceType === "actual") {
        try {
            return await getAuthenticatedSession("stock-opname-aktual", action)
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                // Backward compatibility: old roles may still have stock-opname permission only.
                return await getAuthenticatedSession("stock-opname", action)
            }
            throw error
        }
    }
    return await getAuthenticatedSession("stock-opname", action)
}

// ─── Queries ───────────────────────────────────────────────────────────────

export async function getStockOpnameSessions(sourceType: OpnameSourceType = "sap") {
    await getOpnameAuthSession(sourceType, "view")
    const rows = await db.query.stockOpnameSessions.findMany({
        where: eq(stockOpnameSessions.sourceType, sourceType),
        with: {
            warehouse: true,
            createdBy: true,
            signatures: {
                orderBy: (signatures, { asc }) => [asc(signatures.order)],
            },
            items: true,
        },
        orderBy: [desc(stockOpnameSessions.createdAt)],
    })

    return normalizeSlocFields(rows)
}

const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
}

export async function getStockOpnameSession(sessionId: number, sourceType: OpnameSourceType = "sap") {
    await getOpnameAuthSession(sourceType, "view")

    const session = await db.query.stockOpnameSessions.findFirst({
        where: and(
            eq(stockOpnameSessions.id, sessionId),
            eq(stockOpnameSessions.sourceType, sourceType)
        ),
        with: {
            warehouse: true,
            createdBy: true,
            closedBy: true,
            signatures: true,
            items: {
                with: {
                    product: true,
                    countedBy: true,
                },
                orderBy: (items, { asc }) => [asc(items.id)],
            },
        },
    })

    if (!session) {
        return null
    }

    return normalizeSlocFields({
        ...session,
        items: sortOpnameItemsByCategoryAndStock(session.items ?? []),
    })
}

// ─── Create Session & Populate Items ───────────────────────────────────────

/**
 * Create a new opname session and populate items from current stock levels
 * for the chosen warehouse.
 */
export async function createStockOpnameSession(
    data: CreateOpnameSessionInput
) {
    try {
        // Validate input using Zod schema
        const validation = createOpnameSessionSchema.safeParse(data)
        
        if (!validation.success) {
            const firstError = validation.error.issues?.[0]
            return { success: false, error: firstError?.message || "Validation failed" }
        }
        
        const validatedData = validation.data
        
        const session = await getAuthenticatedSession("stock-opname", "create")
        const userId = session.user.id

        const result = await db.transaction(async (tx) => {
            // Create the session with new pre-count documentation fields
            const [newSession] = await tx
                .insert(stockOpnameSessions)
                .values({
                    name: validatedData.name,
                    warehouseId: validatedData.warehouseId,
                    notes: validatedData.notes,
                    sourceType: "sap",
                    selectedCategories: [],
                    notifyRoles: [],
                    notifyUserIds: [],
                    opnameDate: validatedData.opnameDate,
                    opnameTime: validatedData.opnameTime,
                    location: validatedData.location,
                    createdById: userId,
                    status: "open",
                })
                .returning()

            // Insert signature entries with proper ordering
            if (validatedData.signatures.length > 0) {
                await tx.insert(stockOpnameSignatures).values(
                    validatedData.signatures.map((sig, index) => ({
                        sessionId: newSession.id,
                        name: sig.name,
                        position: sig.position,
                        order: index,
                    }))
                )
            }

            // Fetch SAP stock snapshot for this warehouse SLoc
            const selectedWarehouse = await tx.query.warehouses.findFirst({
                where: eq(warehouses.id, validatedData.warehouseId),
                columns: {
                    sloc: true,
                },
            })

            const selectedSloc = normalizeSloc(selectedWarehouse?.sloc)

            const sapStocksResult = await tx.execute(sql`
                SELECT
                    TRIM(material_no) AS material_no,
                    TRIM(stor_loc) AS stor_loc,
                    SUM(COALESCE(total_stock::numeric, 0)) AS total_stock
                FROM public.zmc9_stock_sap
                WHERE material_no IS NOT NULL
                  AND stor_loc IS NOT NULL
                GROUP BY TRIM(material_no), TRIM(stor_loc)
            `)

            const sapRows = (sapStocksResult.rows as SapStockRow[])
                .filter((row) => normalizeSloc(row.stor_loc) === selectedSloc)

            const materialNumbers = Array.from(
                new Set(
                    sapRows
                        .map((row) => normalizeMaterialNumber(row.material_no))
                        .filter(Boolean)
                )
            )

            const mappedProducts = materialNumbers.length > 0
                ? await tx.query.products.findMany({
                    where: inArray(products.materialNumber, materialNumbers),
                    columns: {
                        id: true,
                        materialNumber: true,
                    },
                })
                : []

            const productIdByMaterialNumber = new Map(
                mappedProducts.map((product) => [normalizeMaterialNumber(product.materialNumber), product.id])
            )

            const sapQtyByProductId = new Map<number, number>()
            for (const row of sapRows) {
                const normalizedMaterialNumber = normalizeMaterialNumber(row.material_no)
                const productId = productIdByMaterialNumber.get(normalizedMaterialNumber)
                if (!productId) continue

                const qty = Math.max(0, Math.round(Number(row.total_stock ?? 0)))
                const currentQty = sapQtyByProductId.get(productId) ?? 0
                sapQtyByProductId.set(productId, currentQty + qty)
            }

            // Fallback for environments/tests where SAP snapshot is unavailable:
            // use current stock levels from local inventory table.
            if (sapQtyByProductId.size === 0) {
                const fallbackStockLevels = await tx.query.stockLevels.findMany({
                    where: and(
                        eq(stockLevels.warehouseId, validatedData.warehouseId),
                        sql`${stockLevels.totalStock} > 0`
                    ),
                    columns: {
                        productId: true,
                        totalStock: true,
                    },
                })

                for (const row of fallbackStockLevels) {
                    const qty = Math.max(0, Math.round(Number(row.totalStock ?? 0)))
                    if (qty <= 0) continue

                    const currentQty = sapQtyByProductId.get(row.productId) ?? 0
                    sapQtyByProductId.set(row.productId, currentQty + qty)
                }
            }

            if (sapQtyByProductId.size > 0) {
                await tx.insert(stockOpnameItems).values(
                    Array.from(sapQtyByProductId.entries()).map(([productId, sapQty]) => ({
                        sessionId: newSession.id,
                        productId,
                        systemQty: sapQty,
                        countedQty: null,
                        variance: null,
                    }))
                )
            }

            return newSession
        })

        revalidatePath("/dashboard/stock-opname")
        return { success: true, sessionId: result.id }
    } catch (error) {
        console.error("Create opname session error:", error)
        return { success: false, error: "Gagal membuat sesi stock opname" }
    }
}

// ─── Update Individual Item Count ──────────────────────────────────────────

export async function updateOpnameItemCount(
    data: z.infer<typeof updateOpnameCountSchema>
) {
    try {
        // Fetch item to verify it exists and session is still open
        const item = await db.query.stockOpnameItems.findFirst({
            where: eq(stockOpnameItems.id, data.itemId),
            with: { session: true },
        })

        if (!item) return { success: false, error: "Item tidak ditemukan" }
        if (item.session?.status !== "open")
            return { success: false, error: "Sesi sudah ditutup, tidak bisa diubah" }

        const authSession = await getOpnameAuthSession(normalizeOpnameSourceType(item.session?.sourceType), "edit")
        const userId = authSession.user.id

        const variance = data.countedQty - item.systemQty

        await db
            .update(stockOpnameItems)
            .set({
                countedQty: data.countedQty,
                variance,
                notes: data.notes ?? item.notes,
                countedById: userId,
                countedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(stockOpnameItems.id, data.itemId))

        revalidatePath(`/dashboard/stock-opname/${item.sessionId}`)
        revalidatePath(`/dashboard/stock-opname-aktual/${item.sessionId}`)
        return { success: true }
    } catch (error) {
        console.error("Update opname item error:", error)
        return { success: false, error: "Gagal update hitungan" }
    }
}

// ─── Update Opname Session Document Metadata ───────────────────────────────

export async function updateStockOpnameDocument(
    sessionId: number,
    data: {
        url: string
        originalFileName?: string
        fileType?: string
        fileSize?: number
        title?: string
    }
) {
    try {
        const opnameSession = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
            columns: { id: true, name: true, sourceType: true },
        })

        if (!opnameSession) {
            return { success: false, error: "Sesi tidak ditemukan" }
        }

        const authSession = await getOpnameAuthSession(normalizeOpnameSourceType(opnameSession.sourceType), "edit")
        const userId = authSession.user.id

        const trimmedUrl = data.url?.trim()
        if (!trimmedUrl) {
            return { success: false, error: "URL dokumen tidak valid" }
        }

        const fileName = data.originalFileName?.trim() || null
        const fileType = data.fileType?.trim() || null
        const normalizedFileSize =
            typeof data.fileSize === "number" && Number.isFinite(data.fileSize)
                ? Math.max(0, Math.round(data.fileSize))
                : null
        const title =
            data.title?.trim() ||
            fileName ||
            `Dokumen Hasil Audit - ${opnameSession.name}`

        await db
            .update(stockOpnameSessions)
            .set({
                documentUrl: trimmedUrl,
                documentTitle: title,
                documentFileName: fileName,
                documentFileType: fileType,
                documentFileSize: normalizedFileSize,
                documentUploadedAt: new Date(),
                documentUploadedBy: userId,
                updatedAt: new Date(),
            })
            .where(eq(stockOpnameSessions.id, sessionId))

        revalidatePath("/dashboard/stock-opname")
        revalidatePath("/dashboard/stock-opname-aktual")
        revalidatePath(`/dashboard/stock-opname/${sessionId}`)
        revalidatePath(`/dashboard/stock-opname-aktual/${sessionId}`)
        revalidatePath(`/dashboard/stock-opname/${sessionId}/print-checklist`)
        revalidatePath(`/dashboard/stock-opname-aktual/${sessionId}/print-checklist`)
        return { success: true }
    } catch (error) {
        console.error("Update opname document error:", error)
        return { success: false, error: "Gagal menyimpan metadata dokumen" }
    }
}

const createStockOpnameActualSessionSchema = createOpnameSessionSchema.extend({
    selectedCategories: z.array(z.string().min(1, "Kategori tidak valid")).min(1, "Pilih minimal 1 kategori produk"),
    notifyRoles: z.array(z.string()).optional().default([]),
    notifyUserIds: z.array(z.string()).optional().default([]),
})

export type CreateStockOpnameActualSessionInput = z.infer<typeof createStockOpnameActualSessionSchema>

export async function getStockOpnameActualSetupData() {
    await getOpnameAuthSession("actual", "create")

    const [categoryRows, users] = await Promise.all([
        db
            .selectDistinct({ category: products.category })
            .from(products)
            .orderBy(products.category),
        db.query.user.findMany({
            columns: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
            orderBy: (fields, { asc }) => [asc(fields.name), asc(fields.email)],
        }),
    ])

    const categories = categoryRows
        .map((row) => row.category?.trim() ?? "")
        .filter(Boolean)

    const categoryMap = new Map<string, string>()
    for (const category of categories) {
        const normalized = category.toLowerCase()
        if (!categoryMap.has(normalized)) {
            categoryMap.set(normalized, category)
        }
    }

    const normalizedCategories = Array.from(categoryMap.values()).sort((a, b) => a.localeCompare(b))

    const roleOptions = Array.from(
        new Set(
            users
                .map((entry) => entry.role?.trim() ?? "")
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b))

    return {
        categories: normalizedCategories,
        roles: roleOptions,
        users: users.map((entry) => ({
            id: entry.id,
            name: entry.name,
            email: entry.email,
            role: entry.role,
        })),
    }
}

/**
 * Create Stock Opname Aktual session with system qty from stock_levels
 * (not SAP snapshot), filtered by selected product categories.
 */
export async function createStockOpnameActualSession(
    data: CreateStockOpnameActualSessionInput
) {
    try {
        const validation = createStockOpnameActualSessionSchema.safeParse(data)

        if (!validation.success) {
            const firstError = validation.error.issues?.[0]
            return { success: false, error: firstError?.message || "Validation failed" }
        }

        const validatedData = validation.data
        const session = await getOpnameAuthSession("actual", "create")
        const userId = session.user.id

        const selectedCategoriesRaw = normalizeStringArray(validatedData.selectedCategories)
        const selectedCategoryMap = new Map<string, string>()
        for (const category of selectedCategoriesRaw) {
            const normalized = category.trim().toLowerCase()
            if (!normalized || selectedCategoryMap.has(normalized)) continue
            selectedCategoryMap.set(normalized, category.trim())
        }
        const selectedCategorySet = new Set(selectedCategoryMap.keys())
        const selectedCategories = Array.from(selectedCategoryMap.values())
        const notifyRoles = normalizeStringArray(validatedData.notifyRoles)
        const notifyUserIds = normalizeStringArray(validatedData.notifyUserIds)

        const result = await db.transaction(async (tx) => {
            const [newSession] = await tx
                .insert(stockOpnameSessions)
                .values({
                    name: validatedData.name,
                    warehouseId: validatedData.warehouseId,
                    notes: validatedData.notes,
                    sourceType: "actual",
                    selectedCategories,
                    notifyRoles,
                    notifyUserIds,
                    opnameDate: validatedData.opnameDate,
                    opnameTime: validatedData.opnameTime,
                    location: validatedData.location,
                    createdById: userId,
                    status: "open",
                })
                .returning()

            if (validatedData.signatures.length > 0) {
                await tx.insert(stockOpnameSignatures).values(
                    validatedData.signatures.map((sig, index) => ({
                        sessionId: newSession.id,
                        name: sig.name,
                        position: sig.position,
                        order: index,
                    }))
                )
            }

            const stockRows = await tx.query.stockLevels.findMany({
                where: and(
                    eq(stockLevels.warehouseId, validatedData.warehouseId),
                    sql`${stockLevels.totalStock} > 0`
                ),
                columns: {
                    productId: true,
                    totalStock: true,
                },
                with: {
                    product: {
                        columns: {
                            category: true,
                        },
                    },
                },
            })

            const filteredRows = stockRows.filter((row) => {
                const category = (row.product?.category ?? "").trim().toLowerCase()
                return selectedCategorySet.has(category)
            })

            if (filteredRows.length > 0) {
                await tx.insert(stockOpnameItems).values(
                    filteredRows.map((row) => ({
                        sessionId: newSession.id,
                        productId: row.productId,
                        systemQty: Math.max(0, Math.round(Number(row.totalStock ?? 0))),
                        countedQty: null,
                        variance: null,
                    }))
                )
            }

            return newSession
        })

        revalidatePath("/dashboard/stock-opname-aktual")
        return { success: true, sessionId: result.id }
    } catch (error) {
        console.error("Create stock opname aktual session error:", error)
        return { success: false, error: "Gagal membuat sesi stock opname aktual" }
    }
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")

const formatNumber = (value: number | null | undefined) => {
    const safe = Number(value ?? 0)
    if (!Number.isFinite(safe)) return "0"
    return safe.toLocaleString("id-ID")
}

const buildStockOpnameActualEmailContent = (params: {
    sessionName: string
    warehouseLabel: string
    opnameDate: string
    opnameTime: string
    location: string
    totalItems: number
    countedItems: number
    varianceItems: number
    detailUrl: string
    topVarianceRows: Array<{
        materialNumber: string
        materialDescription: string
        systemQty: number
        countedQty: number | null
        variance: number | null
        category: string
    }>
}) => {
    const varianceTableRows = params.topVarianceRows.length > 0
        ? params.topVarianceRows
            .map((row, index) => `
                <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${index + 1}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(row.materialNumber)}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(row.materialDescription)}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(row.category)}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatNumber(row.systemQty)}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatNumber(row.countedQty ?? 0)}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;font-weight:600;color:${(row.variance ?? 0) < 0 ? "#dc2626" : "#059669"};">
                        ${(row.variance ?? 0) > 0 ? "+" : ""}${formatNumber(row.variance ?? 0)}
                    </td>
                </tr>
            `)
            .join("")
        : `
            <tr>
                <td colspan="7" style="padding:10px;border:1px solid #e5e7eb;text-align:center;color:#6b7280;">
                    Tidak ada item selisih.
                </td>
            </tr>
        `
    const varianceTextRows = params.topVarianceRows.length > 0
        ? params.topVarianceRows
            .map((row, index) => `${index + 1}. ${row.materialNumber} - ${row.materialDescription} | ${row.category} | Qty Sistem: ${formatNumber(row.systemQty)} | Qty Fisik: ${formatNumber(row.countedQty ?? 0)} | Selisih: ${(row.variance ?? 0) > 0 ? "+" : ""}${formatNumber(row.variance ?? 0)}`)
            .join("\n")
        : "Tidak ada item selisih."

    return {
        varianceTableRows,
        varianceTextRows,
    }
}

async function getNotificationRecipientEmails(roleNames: string[], userIds: string[]) {
    const normalizedRoleSet = new Set(
        roleNames
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean)
    )
    const userIdSet = new Set(userIds.map((entry) => entry.trim()).filter(Boolean))

    const allUsers = await db.query.user.findMany({
        columns: {
            id: true,
            email: true,
            role: true,
        },
    })

    const recipients = allUsers
        .filter((entry) => {
            const role = (entry.role ?? "").trim().toLowerCase()
            return userIdSet.has(entry.id) || normalizedRoleSet.has(role)
        })
        .map((entry) => entry.email?.trim() ?? "")
        .filter(Boolean)

    return Array.from(new Set(recipients))
}

async function sendStockOpnameActualCompletionNotification(sessionId: number): Promise<{
    sent: boolean
    reason?: string
    recipientCount?: number
}> {
    const opnameSession = await db.query.stockOpnameSessions.findFirst({
        where: eq(stockOpnameSessions.id, sessionId),
        with: {
            warehouse: true,
            items: {
                with: {
                    product: true,
                },
            },
        },
    })

    if (!opnameSession || opnameSession.sourceType !== "actual") {
        return { sent: false, reason: "Session is not stock opname aktual" }
    }

    const notifyRoles = normalizeStringArray(opnameSession.notifyRoles)
    const notifyUserIds = normalizeStringArray(opnameSession.notifyUserIds)
    const recipients = await getNotificationRecipientEmails(notifyRoles, notifyUserIds)

    if (recipients.length === 0) {
        return { sent: false, reason: "Tidak ada penerima notifikasi yang cocok", recipientCount: 0 }
    }

    const countedItems = (opnameSession.items ?? []).filter((item) => item.countedQty !== null)
    const varianceItems = countedItems.filter((item) => item.variance !== null && item.variance !== 0)
    const topVarianceRows = varianceItems
        .sort((a, b) => Math.abs(b.variance ?? 0) - Math.abs(a.variance ?? 0))
        .slice(0, 25)
        .map((item) => ({
            materialNumber: item.product?.materialNumber ?? "-",
            materialDescription: item.product?.materialDescription ?? "-",
            category: item.product?.category ?? "-",
            systemQty: item.systemQty,
            countedQty: item.countedQty,
            variance: item.variance,
        }))

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "")
    const detailPath = `/dashboard/stock-opname-aktual/${opnameSession.id}`
    const detailUrl = baseUrl ? `${baseUrl}${detailPath}` : detailPath
    const warehouseLabel = formatWarehouseLabel(opnameSession.warehouse)
    const opnameDate = opnameSession.opnameDate
        ? new Date(opnameSession.opnameDate).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        })
        : "-"

    const { varianceTableRows, varianceTextRows } = buildStockOpnameActualEmailContent({
        sessionName: opnameSession.name,
        warehouseLabel,
        opnameDate,
        opnameTime: opnameSession.opnameTime ?? "-",
        location: opnameSession.location ?? "-",
        totalItems: opnameSession.items?.length ?? 0,
        countedItems: countedItems.length,
        varianceItems: varianceItems.length,
        detailUrl,
        topVarianceRows,
    })

    const emailResult = await sendSystemTemplatedEmailByCode({
        code: SYSTEM_EMAIL_TEMPLATE_CODES.stockOpnameActualCompletion,
        to: recipients,
        data: {
            sessionName: opnameSession.name,
            warehouseLabel,
            opnameDate,
            opnameTime: opnameSession.opnameTime ?? "-",
            location: opnameSession.location ?? "-",
            totalItems: formatNumber(opnameSession.items?.length ?? 0),
            countedItems: formatNumber(countedItems.length),
            varianceItems: formatNumber(varianceItems.length),
            detailUrl,
            varianceTableRows,
            varianceTextRows,
        },
    })

    if (!emailResult.success) {
        console.error("Failed to send stock opname aktual notification:", emailResult.error)
        return { sent: false, reason: emailResult.error || "Gagal mengirim email", recipientCount: recipients.length }
    }

    return { sent: true, recipientCount: recipients.length }
}

// ─── Close Session (with optional stock adjustment) ────────────────────────

export async function closeStockOpnameSession(
    sessionId: number,
    applyAdjustments: boolean = false,
    expectedSourceType?: OpnameSourceType
) {
    try {
        const opnameSession = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
            with: {
                items: true,
            },
        })

        if (!opnameSession) return { success: false, error: "Sesi tidak ditemukan" }
        if (expectedSourceType && opnameSession.sourceType !== expectedSourceType) {
            return { success: false, error: "Sesi tidak sesuai dengan menu yang dipilih" }
        }
        if (opnameSession.status !== "open") return { success: false, error: "Sesi sudah ditutup" }

        const authSession = await getOpnameAuthSession(normalizeOpnameSourceType(opnameSession.sourceType), "edit")
        const userId = authSession.user.id

        await db.transaction(async (tx) => {
            if (applyAdjustments) {
                // Apply stock adjustments for items that have a variance
                const itemsWithVariance = opnameSession.items.filter(
                    (i) => i.countedQty !== null && i.variance !== null && i.variance !== 0
                )

                for (const item of itemsWithVariance) {
                    if (item.variance === null || item.countedQty === null) continue

                    // Update stock level
                    await tx
                        .update(stockLevels)
                        .set({
                            totalStock: item.countedQty,
                            updatedAt: new Date(),
                        })
                        .where(
                            and(
                                eq(stockLevels.productId, item.productId),
                                eq(stockLevels.warehouseId, opnameSession.warehouseId)
                            )
                        )

                    // Record stock movement
                    await tx.insert(stockMovements).values({
                        productId: item.productId,
                        warehouseId: opnameSession.warehouseId,
                        quantity: item.variance,
                        type: "ADJUSTMENT",
                        referenceNumber: `OPNAME-${sessionId}`,
                        recordedBy: userId,
                    })
                }
            }

            // Close the session
            await tx
                .update(stockOpnameSessions)
                .set({
                    status: "closed",
                    closedById: userId,
                    closedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(stockOpnameSessions.id, sessionId))

            try {
                await syncStockOpnameRfidReview(tx, {
                    sessionId,
                    sessionName: opnameSession.name,
                    warehouseId: opnameSession.warehouseId,
                    sourceType: opnameSession.sourceType,
                    status: "closed",
                    applyAdjustments,
                    userId,
                    items: opnameSession.items.map((item) => ({
                        itemId: item.id,
                        productId: item.productId,
                        systemQty: item.systemQty,
                        countedQty: item.countedQty,
                        variance: item.variance,
                        notes: item.notes,
                    })),
                })
            } catch (rfidError) {
                console.error("[CLOSE STOCK OPNAME] RFID sync skipped:", rfidError)
            }
        })

        revalidatePath("/dashboard/stock-opname")
        revalidatePath("/dashboard/stock-opname-aktual")
        revalidatePath(`/dashboard/stock-opname/${sessionId}`)
        revalidatePath(`/dashboard/stock-opname-aktual/${sessionId}`)
        revalidatePath("/dashboard/rfid-monitoring")
        revalidatePath("/dashboard/rfid-exceptions")
        revalidatePath("/dashboard/rfid-traceability")
        revalidatePath("/dashboard/rfid-tagged-units")

        let notificationResult: { sent: boolean; reason?: string; recipientCount?: number } | null = null
        if (opnameSession.sourceType === "actual") {
            try {
                notificationResult = await sendStockOpnameActualCompletionNotification(sessionId)
            } catch (notificationError) {
                console.error("Stock opname aktual notification error:", notificationError)
                notificationResult = { sent: false, reason: "Terjadi error saat mengirim notifikasi email" }
            }
        }

        return { success: true, notification: notificationResult }
    } catch (error) {
        console.error("Close opname session error:", error)
        return { success: false, error: "Gagal menutup sesi" }
    }
}

// ─── Cancel Session ─────────────────────────────────────────────────────────

export async function cancelStockOpnameSession(sessionId: number, expectedSourceType?: OpnameSourceType) {
    try {
        const opnameSession = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
        })

        if (!opnameSession) return { success: false, error: "Sesi tidak ditemukan" }
        if (expectedSourceType && opnameSession.sourceType !== expectedSourceType) {
            return { success: false, error: "Sesi tidak sesuai dengan menu yang dipilih" }
        }
        if (opnameSession.status === "closed")
            return { success: false, error: "Sesi sudah ditutup, tidak bisa dibatalkan" }

        await getOpnameAuthSession(normalizeOpnameSourceType(opnameSession.sourceType), "edit")

        await db.transaction(async (tx) => {
            await tx
                .update(stockOpnameSessions)
                .set({ status: "cancelled", updatedAt: new Date() })
                .where(eq(stockOpnameSessions.id, sessionId))

            try {
                await clearStockOpnameRfidArtifacts(tx, sessionId)
            } catch (rfidError) {
                console.error("[CANCEL STOCK OPNAME] RFID cleanup skipped:", rfidError)
            }
        })

        revalidatePath("/dashboard/stock-opname")
        revalidatePath("/dashboard/stock-opname-aktual")
        revalidatePath("/dashboard/rfid-monitoring")
        revalidatePath("/dashboard/rfid-exceptions")
        revalidatePath("/dashboard/rfid-traceability")
        revalidatePath("/dashboard/rfid-tagged-units")
        return { success: true }
    } catch (error) {
        console.error("Cancel opname session error:", error)
        return { success: false, error: "Gagal membatalkan sesi" }
    }
}

// ─── Delete Session ─────────────────────────────────────────────────────────

export async function deleteStockOpnameSession(sessionId: number, expectedSourceType?: OpnameSourceType) {
    try {
        const opnameSession = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
        })

        if (!opnameSession) return { success: false, error: "Sesi tidak ditemukan" }
        if (expectedSourceType && opnameSession.sourceType !== expectedSourceType) {
            return { success: false, error: "Sesi tidak sesuai dengan menu yang dipilih" }
        }

        await getOpnameAuthSession(normalizeOpnameSourceType(opnameSession.sourceType), "delete")

        await db.transaction(async (tx) => {
            // Delete related items and signatures (cascade should handle this, but explicit is safer)
            await tx.delete(stockOpnameItems).where(eq(stockOpnameItems.sessionId, sessionId))
            await tx.delete(stockOpnameSignatures).where(eq(stockOpnameSignatures.sessionId, sessionId))
            try {
                await clearStockOpnameRfidArtifacts(tx, sessionId)
            } catch (rfidError) {
                console.error("[DELETE STOCK OPNAME] RFID cleanup skipped:", rfidError)
            }
            
            // Delete the session
            await tx.delete(stockOpnameSessions).where(eq(stockOpnameSessions.id, sessionId))
        })

        revalidatePath("/dashboard/stock-opname")
        revalidatePath("/dashboard/stock-opname-aktual")
        revalidatePath("/dashboard/rfid-monitoring")
        revalidatePath("/dashboard/rfid-exceptions")
        revalidatePath("/dashboard/rfid-traceability")
        revalidatePath("/dashboard/rfid-tagged-units")
        return { success: true }
    } catch (error) {
        console.error("Delete opname session error:", error)
        return { success: false, error: "Gagal menghapus sesi" }
    }
}

// ─── Bulk Delete Sessions ─────────────────────────────────────────────────

export async function bulkDeleteStockOpnameSessions(sessionIds: number[], expectedSourceType?: OpnameSourceType) {
    try {
        await getOpnameAuthSession(expectedSourceType ?? "sap", "delete")

        if (!sessionIds || sessionIds.length === 0) {
            return { success: false, error: "Tidak ada sesi yang dipilih" }
        }

        let deletedCount = 0
        await db.transaction(async (tx) => {
            for (const sessionId of sessionIds) {
                if (expectedSourceType) {
                    const existingSession = await tx.query.stockOpnameSessions.findFirst({
                        where: eq(stockOpnameSessions.id, sessionId),
                        columns: {
                            sourceType: true,
                        },
                    })
                    if (!existingSession || existingSession.sourceType !== expectedSourceType) {
                        continue
                    }
                }
                await tx.delete(stockOpnameItems).where(eq(stockOpnameItems.sessionId, sessionId))
                await tx.delete(stockOpnameSignatures).where(eq(stockOpnameSignatures.sessionId, sessionId))
                try {
                    await clearStockOpnameRfidArtifacts(tx, sessionId)
                } catch (rfidError) {
                    console.error("[BULK DELETE STOCK OPNAME] RFID cleanup skipped:", rfidError)
                }
                await tx.delete(stockOpnameSessions).where(eq(stockOpnameSessions.id, sessionId))
                deletedCount++
            }
        })

        revalidatePath("/dashboard/stock-opname")
        revalidatePath("/dashboard/stock-opname-aktual")
        revalidatePath("/dashboard/rfid-monitoring")
        revalidatePath("/dashboard/rfid-exceptions")
        revalidatePath("/dashboard/rfid-traceability")
        revalidatePath("/dashboard/rfid-tagged-units")
        return { success: true, deletedCount }
    } catch (error) {
        console.error("Bulk delete opname sessions error:", error)
        return { success: false, error: "Gagal menghapus sesi" }
    }
}

// ─── Bulk update counts (import from CSV / manual list) ───────────────────

export async function bulkUpdateOpnameCounts(
    sessionId: number,
    counts: Array<{ productId: number; countedQty: number; notes?: string }>
) {
    try {
        const opnameSession = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
            with: { items: true },
        })

        if (!opnameSession) return { success: false, error: "Sesi tidak ditemukan" }
        if (opnameSession.status !== "open") return { success: false, error: "Sesi sudah ditutup" }

        const authSession = await getOpnameAuthSession(normalizeOpnameSourceType(opnameSession.sourceType), "edit")
        const userId = authSession.user.id

        const itemMap = new Map(opnameSession.items.map((i) => [i.productId, i]))

        await db.transaction(async (tx) => {
            for (const c of counts) {
                const item = itemMap.get(c.productId)
                if (!item) continue
                const variance = c.countedQty - item.systemQty
                await tx
                    .update(stockOpnameItems)
                    .set({
                        countedQty: c.countedQty,
                        variance,
                        notes: c.notes ?? item.notes,
                        countedById: userId,
                        countedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(stockOpnameItems.id, item.id))
            }
        })

        revalidatePath(`/dashboard/stock-opname/${sessionId}`)
        revalidatePath(`/dashboard/stock-opname-aktual/${sessionId}`)
        return { success: true }
    } catch (error) {
        console.error("Bulk update opname error:", error)
        return { success: false, error: "Gagal bulk update" }
    }
}

// ─── Get PDF Report Data ───────────────────────────────────────────────────

/**
 * Fetch all data needed to generate a PDF report for a closed stock opname session.
 * Validates that the session exists and is closed before returning data.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export async function getOpnamePdfReportData(
    sessionId: number,
    sourceType: OpnameSourceType = "sap"
): Promise<{ success: boolean; data?: OpnamePdfReportData; error?: string }> {
    try {
        await getOpnameAuthSession(sourceType, "view")

        // Fetch session with all required relations
        const session = await db.query.stockOpnameSessions.findFirst({
            where: and(
                eq(stockOpnameSessions.id, sessionId),
                eq(stockOpnameSessions.sourceType, sourceType)
            ),
            with: {
                warehouse: true,
                createdBy: true,
                closedBy: true,
                signatures: {
                    orderBy: (signatures, { asc }) => [asc(signatures.order)],
                },
                items: {
                    with: {
                        product: true,
                        countedBy: true,
                    },
                    orderBy: (items, { asc }) => [asc(items.id)],
                },
            },
        })

        // Validate session exists
        if (!session) {
            return { success: false, error: "Sesi stock opname tidak ditemukan" }
        }

        // Validate session is closed (Requirement 5.4)
        if (session.status !== "closed") {
            return { success: false, error: "Tidak dapat membuat PDF untuk sesi yang belum ditutup" }
        }

        // Ensure all items have product data
        const itemsWithProducts = session.items.filter(item => item.product !== null) as Array<typeof session.items[number] & { product: NonNullable<typeof session.items[number]['product']> }>
        const sortedItems = sortOpnameItemsByCategoryAndStock(itemsWithProducts)

        // Return structured data for PDF rendering
        // Includes closure timestamp and user information (Requirements 5.2, 5.3)
        const reportData: OpnamePdfReportData = {
            session: {
                ...session,
                warehouse: session.warehouse,
                createdBy: session.createdBy,
                closedBy: session.closedBy,
                items: sortedItems,
                signatures: session.signatures,
            },
            signatures: session.signatures,
            items: sortedItems,
            companyLogo: "/logo.png", // Default company logo path
        }

        return { success: true, data: normalizeSlocFields(reportData) }
    } catch (error) {
        console.error("Get opname PDF report data error:", error)
        return { success: false, error: "Gagal mengambil data laporan PDF" }
    }
}
