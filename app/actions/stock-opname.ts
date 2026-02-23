"use server"

import { db } from "@/db"
import { stockOpnameSessions, stockOpnameItems, stockOpnameSignatures, stockLevels, stockMovements } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAuthenticatedSession } from "@/lib/rbac"
import { z } from "zod"
import { createOpnameSessionSchema, updateOpnameCountSchema, type CreateOpnameSessionInput } from "@/lib/schemas"

// ─── Queries ───────────────────────────────────────────────────────────────

export async function getStockOpnameSessions() {
    return await db.query.stockOpnameSessions.findMany({
        with: {
            warehouse: true,
            createdBy: true,
            items: true,
        },
        orderBy: [desc(stockOpnameSessions.createdAt)],
    })
}

export async function getStockOpnameSession(sessionId: number) {
    return await db.query.stockOpnameSessions.findFirst({
        where: eq(stockOpnameSessions.id, sessionId),
        with: {
            warehouse: true,
            createdBy: true,
            closedBy: true,
            items: {
                with: {
                    product: true,
                    countedBy: true,
                },
                orderBy: (items, { asc }) => [asc(items.id)],
            },
        },
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
            const firstError = validation.error.errors?.[0]
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

            // Fetch current stock levels for this warehouse
            const currentStocks = await tx.query.stockLevels.findMany({
                where: eq(stockLevels.warehouseId, validatedData.warehouseId),
            })

            if (currentStocks.length > 0) {
                await tx.insert(stockOpnameItems).values(
                    currentStocks.map((s) => ({
                        sessionId: newSession.id,
                        productId: s.productId,
                        systemQty: s.totalStock,
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
