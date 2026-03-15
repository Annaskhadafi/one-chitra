"use server"

import { db } from "@/db"
import { stockOpnameSessions, stockOpnameItems, stockOpnameSignatures, stockLevels, stockMovements, products, warehouses } from "@/db/schema"
import { eq, and, desc, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAuthenticatedSession } from "@/lib/rbac"
import { z } from "zod"
import { createOpnameSessionSchema, updateOpnameCountSchema, type CreateOpnameSessionInput } from "@/lib/schemas"
import type { OpnamePdfReportData } from "@/lib/types"

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

const normalizeSloc = (value: string | null | undefined) => {
    const raw = (value || "").trim()
    if (!raw) return ""
    if (/^\d+$/.test(raw)) {
        return String(parseInt(raw, 10))
    }
    return raw.toUpperCase()
}

const normalizeMaterialNumber = (value: string | null | undefined) =>
    (value || "").trim().toUpperCase()

// ─── Queries ───────────────────────────────────────────────────────────────

export async function getStockOpnameSessions() {
    return await db.query.stockOpnameSessions.findMany({
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
}

export async function getStockOpnameSession(sessionId: number) {
    const session = await db.query.stockOpnameSessions.findFirst({
        where: eq(stockOpnameSessions.id, sessionId),
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

    return {
        ...session,
        items: sortOpnameItemsByCategoryAndStock(session.items ?? []),
    }
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
        const session = await getAuthenticatedSession("stock-opname", "edit")
        const userId = session.user.id

        // Fetch item to verify it exists and session is still open
        const item = await db.query.stockOpnameItems.findFirst({
            where: eq(stockOpnameItems.id, data.itemId),
            with: { session: true },
        })

        if (!item) return { success: false, error: "Item tidak ditemukan" }
        if (item.session?.status !== "open")
            return { success: false, error: "Sesi sudah ditutup, tidak bisa diubah" }

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
        const session = await getAuthenticatedSession("stock-opname", "edit")
        const userId = session.user.id

        const opnameSession = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
            columns: { id: true, name: true },
        })

        if (!opnameSession) {
            return { success: false, error: "Sesi tidak ditemukan" }
        }

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
        revalidatePath(`/dashboard/stock-opname/${sessionId}`)
        revalidatePath(`/dashboard/stock-opname/${sessionId}/print-checklist`)
        return { success: true }
    } catch (error) {
        console.error("Update opname document error:", error)
        return { success: false, error: "Gagal menyimpan metadata dokumen" }
    }
}

// ─── Close Session (with optional stock adjustment) ────────────────────────

export async function closeStockOpnameSession(
    sessionId: number,
    applyAdjustments: boolean = false
) {
    try {
        const authSession = await getAuthenticatedSession("stock-opname", "edit")
        const userId = authSession.user.id

        const opnameSession = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
            with: {
                items: true,
            },
        })

        if (!opnameSession) return { success: false, error: "Sesi tidak ditemukan" }
        if (opnameSession.status !== "open") return { success: false, error: "Sesi sudah ditutup" }

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
        })

        revalidatePath("/dashboard/stock-opname")
        revalidatePath(`/dashboard/stock-opname/${sessionId}`)
        return { success: true }
    } catch (error) {
        console.error("Close opname session error:", error)
        return { success: false, error: "Gagal menutup sesi" }
    }
}

// ─── Cancel Session ─────────────────────────────────────────────────────────

export async function cancelStockOpnameSession(sessionId: number) {
    try {
        await getAuthenticatedSession("stock-opname", "edit")

        const opnameSession = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
        })

        if (!opnameSession) return { success: false, error: "Sesi tidak ditemukan" }
        if (opnameSession.status === "closed")
            return { success: false, error: "Sesi sudah ditutup, tidak bisa dibatalkan" }

        await db
            .update(stockOpnameSessions)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(stockOpnameSessions.id, sessionId))

        revalidatePath("/dashboard/stock-opname")
        return { success: true }
    } catch (error) {
        console.error("Cancel opname session error:", error)
        return { success: false, error: "Gagal membatalkan sesi" }
    }
}

// ─── Delete Session ─────────────────────────────────────────────────────────

export async function deleteStockOpnameSession(sessionId: number) {
    try {
        await getAuthenticatedSession("stock-opname", "delete")

        const opnameSession = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
        })

        if (!opnameSession) return { success: false, error: "Sesi tidak ditemukan" }

        await db.transaction(async (tx) => {
            // Delete related items and signatures (cascade should handle this, but explicit is safer)
            await tx.delete(stockOpnameItems).where(eq(stockOpnameItems.sessionId, sessionId))
            await tx.delete(stockOpnameSignatures).where(eq(stockOpnameSignatures.sessionId, sessionId))
            
            // Delete the session
            await tx.delete(stockOpnameSessions).where(eq(stockOpnameSessions.id, sessionId))
        })

        revalidatePath("/dashboard/stock-opname")
        return { success: true }
    } catch (error) {
        console.error("Delete opname session error:", error)
        return { success: false, error: "Gagal menghapus sesi" }
    }
}

// ─── Bulk Delete Sessions ─────────────────────────────────────────────────

export async function bulkDeleteStockOpnameSessions(sessionIds: number[]) {
    try {
        await getAuthenticatedSession("stock-opname", "delete")

        if (!sessionIds || sessionIds.length === 0) {
            return { success: false, error: "Tidak ada sesi yang dipilih" }
        }

        let deletedCount = 0
        await db.transaction(async (tx) => {
            for (const sessionId of sessionIds) {
                await tx.delete(stockOpnameItems).where(eq(stockOpnameItems.sessionId, sessionId))
                await tx.delete(stockOpnameSignatures).where(eq(stockOpnameSignatures.sessionId, sessionId))
                await tx.delete(stockOpnameSessions).where(eq(stockOpnameSessions.id, sessionId))
                deletedCount++
            }
        })

        revalidatePath("/dashboard/stock-opname")
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
        const authSession = await getAuthenticatedSession("stock-opname", "edit")
        const userId = authSession.user.id

        const opnameSession = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
            with: { items: true },
        })

        if (!opnameSession) return { success: false, error: "Sesi tidak ditemukan" }
        if (opnameSession.status !== "open") return { success: false, error: "Sesi sudah ditutup" }

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
    sessionId: number
): Promise<{ success: boolean; data?: OpnamePdfReportData; error?: string }> {
    try {
        await getAuthenticatedSession("stock-opname", "view")

        // Fetch session with all required relations
        const session = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, sessionId),
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

        return { success: true, data: reportData }
    } catch (error) {
        console.error("Get opname PDF report data error:", error)
        return { success: false, error: "Gagal mengambil data laporan PDF" }
    }
}
