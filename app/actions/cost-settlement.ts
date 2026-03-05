"use server"

import { z } from "zod"
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import {
    approvalFormRegistry,
    costSettlementItems,
    costSettlementReceipts,
    costSettlementSignatories,
    costSettlements,
    deliveries,
    fleetTrips,
} from "@/db/schema"
import { costSettlementSchema } from "@/lib/schemas"
import { getAuthenticatedSession } from "@/lib/rbac"
import { createApprovalRequestForEntity } from "./approval"
import { uploadFile } from "./upload"

const parseDecimal = (value: string | number | null | undefined) => Number(value ?? 0)

const mapSettlementErrorMessage = (error: unknown) => {
    if (error instanceof z.ZodError) {
        return error.issues[0]?.message || "Data settlement tidak valid"
    }

    const message = error instanceof Error ? error.message : "Unknown error"
    const lower = message.toLowerCase()

    if (lower.includes("permission") || lower.includes("unauthorized") || lower.includes("forbidden")) {
        return "Anda tidak memiliki izin untuk membuat settlement"
    }

    if (lower.includes("does not exist") || lower.includes("relation") || lower.includes("cost_settlements")) {
        return "Tabel settlement belum siap di database. Hubungi admin untuk migrasi DB"
    }

    return message || "Gagal membuat settlement"
}

async function getSettlementSession(action: "view" | "create" | "edit" | "delete") {
    try {
        return await getAuthenticatedSession("cost-settlements", action)
    } catch {
        // Backward compatibility for existing roles that only have deliveries permissions.
        return await getAuthenticatedSession("deliveries", action)
    }
}

const toDateOnly = (value: string | Date) => {
    const d = typeof value === "string" ? new Date(value) : value
    return d.toISOString().slice(0, 10)
}

const sumCostFields = (payload: {
    costGasoline?: string | number | null
    costToll?: string | number | null
    costParking?: string | number | null
    costMeals?: string | number | null
    costMaintenance?: string | number | null
    costOthers?: string | number | null
}) => {
    return parseDecimal(payload.costGasoline)
        + parseDecimal(payload.costToll)
        + parseDecimal(payload.costParking)
        + parseDecimal(payload.costMeals)
        + parseDecimal(payload.costMaintenance)
        + parseDecimal(payload.costOthers)
}

export async function generateSettlementNumber() {
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`

    const allNumbers = await db.select({ settlementNumber: costSettlements.settlementNumber }).from(costSettlements)
    const todayCount = allNumbers.filter((row) => row.settlementNumber.startsWith(`STL-${dateStr}`)).length + 1

    return `STL-${dateStr}-${String(todayCount).padStart(4, "0")}`
}

async function resolveSettlementContext(input: z.infer<typeof costSettlementSchema>) {
    if (input.settlementType === "trip" && input.fleetTripId) {
        const trip = await db.query.fleetTrips.findFirst({
            where: eq(fleetTrips.id, input.fleetTripId),
            columns: {
                id: true,
                costGasoline: true,
                costToll: true,
                costParking: true,
                costMeals: true,
                costMaintenance: true,
                costOthers: true,
                driverId: true,
                vehicleId: true,
            },
            with: {
                driver: {
                    columns: {
                        name: true,
                    },
                },
                vehicle: {
                    columns: {
                        policeNumber: true,
                    },
                },
            },
        })

        if (!trip) {
            throw new Error("Fleet trip not found")
        }

        return {
            advanceAmount: sumCostFields(trip),
            driverName: trip.driver?.name || null,
            vehicleNumber: trip.vehicle?.policeNumber || null,
        }
    }

    if (input.settlementType === "delivery" && input.deliveryId) {
        const delivery = await db.query.deliveries.findFirst({
            where: eq(deliveries.id, input.deliveryId),
            columns: {
                shippingCost: true,
                costGasoline: true,
                costToll: true,
                costParking: true,
                costMeals: true,
                costMaintenance: true,
                costOthers: true,
                isExternal: true,
                driverName: true,
                vehicleNumber: true,
            },
        })

        if (!delivery) {
            throw new Error("Delivery not found")
        }

        if (delivery.isExternal) {
            return {
                advanceAmount: parseDecimal(delivery.shippingCost),
                driverName: delivery.driverName || null,
                vehicleNumber: delivery.vehicleNumber || null,
            }
        }

        return {
            advanceAmount: sumCostFields(delivery),
            driverName: delivery.driverName || null,
            vehicleNumber: delivery.vehicleNumber || null,
        }
    }

    throw new Error("Invalid settlement source")
}

export async function getSettlements(filters?: {
    status?: "draft" | "submitted" | "approved" | "rejected" | "posted"
    settlementType?: "trip" | "delivery"
    dateFrom?: string
    dateTo?: string
}) {
    const conditions = [isNull(costSettlements.deletedAt)]

    if (filters?.status) {
        conditions.push(eq(costSettlements.status, filters.status))
    }

    if (filters?.settlementType) {
        conditions.push(eq(costSettlements.settlementType, filters.settlementType))
    }

    if (filters?.dateFrom) {
        conditions.push(gte(costSettlements.settlementDate, filters.dateFrom))
    }

    if (filters?.dateTo) {
        conditions.push(lte(costSettlements.settlementDate, filters.dateTo))
    }

    try {
        return await db.query.costSettlements.findMany({
            where: and(...conditions),
            with: {
                fleetTrip: true,
                delivery: {
                    with: {
                        salesOrder: {
                            with: {
                                customer: true,
                            },
                        },
                    },
                },
                items: {
                    with: {
                        receipts: true,
                    },
                    orderBy: [costSettlementItems.sortOrder],
                },
                signatories: {
                    orderBy: [costSettlementSignatories.sortOrder],
                },
                createdByUser: true,
            },
            orderBy: [desc(costSettlements.createdAt)],
        })
    } catch (error) {
        void error
        return []
    }
}

export async function getSettlementById(id: number) {
    try {
        return await db.query.costSettlements.findFirst({
            where: and(eq(costSettlements.id, id), isNull(costSettlements.deletedAt)),
            with: {
                fleetTrip: true,
                delivery: {
                    with: {
                        salesOrder: {
                            with: {
                                customer: true,
                            },
                        },
                    },
                },
                items: {
                    with: {
                        receipts: true,
                        deliveryItem: {
                            with: {
                                product: true,
                            },
                        },
                    },
                    orderBy: [costSettlementItems.sortOrder],
                },
                signatories: {
                    orderBy: [costSettlementSignatories.sortOrder],
                },
                createdByUser: true,
            },
        })
    } catch (error) {
        void error
        return null
    }
}

export async function createSettlement(data: z.infer<typeof costSettlementSchema>) {
    try {
        const session = await getSettlementSession("create")
        const parsed = costSettlementSchema.parse(data)

        const settlementNumber = parsed.settlementNumber || await generateSettlementNumber()
        const context = await resolveSettlementContext(parsed)
        const advanceAmount = context.advanceAmount
        const totalActualAmount = parsed.items.reduce((sum, item) => sum + item.amount, 0)
        const varianceAmount = totalActualAmount - advanceAmount

        const result = await db.transaction(async (tx) => {
            const itemIdsBySortOrder: number[] = []

            const [created] = await tx.insert(costSettlements).values({
                settlementNumber,
                settlementType: parsed.settlementType,
                fleetTripId: parsed.settlementType === "trip" ? (parsed.fleetTripId ?? null) : null,
                deliveryId: parsed.settlementType === "delivery" ? (parsed.deliveryId ?? null) : null,
                driverName: context.driverName,
                vehicleNumber: context.vehicleNumber,
                advanceAmount: String(advanceAmount),
                totalActualAmount: String(totalActualAmount),
                varianceAmount: String(varianceAmount),
                settlementDate: toDateOnly(parsed.settlementDate),
                remarks: parsed.remarks || null,
                createdBy: session.user.id,
            }).returning()

            if (parsed.items.length > 0) {
                const insertedItems = await tx.insert(costSettlementItems).values(
                    parsed.items.map((item, index) => ({
                        settlementId: created.id,
                        costCategory: item.costCategory,
                        description: item.description,
                        amount: String(item.amount),
                        receiptDate: item.receiptDate ? toDateOnly(item.receiptDate) : null,
                        vendorName: item.vendorName || null,
                        deliveryItemId: item.deliveryItemId || null,
                        sortOrder: item.sortOrder ?? index,
                    }))
                ).returning({ id: costSettlementItems.id, sortOrder: costSettlementItems.sortOrder })

                // Keep deterministic line ordering even if client omits sort order.
                if (insertedItems.length !== parsed.items.length) {
                    throw new Error("Failed to insert settlement items")
                }

                insertedItems
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .forEach((item) => itemIdsBySortOrder.push(item.id))
            }

            if (parsed.signatories.length > 0) {
                await tx.insert(costSettlementSignatories).values(
                    parsed.signatories.map((signatory, index) => ({
                        settlementId: created.id,
                        signatoryName: signatory.signatoryName,
                        signatoryPosition: signatory.signatoryPosition,
                        signatoryRole: signatory.signatoryRole,
                        sortOrder: signatory.sortOrder ?? index,
                    }))
                )
            }

            return {
                id: created.id,
                itemIdsBySortOrder,
            }
        })

        revalidatePath("/dashboard/cost-settlements")
        return { success: true as const, id: result.id, itemIdsBySortOrder: result.itemIdsBySortOrder }
    } catch (error) {
        return { success: false as const, error: mapSettlementErrorMessage(error) }
    }
}

export async function updateSettlement(id: number, data: z.infer<typeof costSettlementSchema>) {
    await getSettlementSession("edit")
    const parsed = costSettlementSchema.parse(data)

    const existing = await db.query.costSettlements.findFirst({
        where: and(eq(costSettlements.id, id), isNull(costSettlements.deletedAt)),
        columns: {
            id: true,
            status: true,
        },
    })

    if (!existing) {
        return { success: false as const, error: "Settlement not found" }
    }

    if (existing.status !== "draft") {
        return { success: false as const, error: "Only draft settlement can be edited" }
    }

    const context = await resolveSettlementContext(parsed)
    const advanceAmount = context.advanceAmount
    const totalActualAmount = parsed.items.reduce((sum, item) => sum + item.amount, 0)
    const varianceAmount = totalActualAmount - advanceAmount

    await db.transaction(async (tx) => {
        await tx.update(costSettlements)
            .set({
                settlementType: parsed.settlementType,
                fleetTripId: parsed.settlementType === "trip" ? (parsed.fleetTripId ?? null) : null,
                deliveryId: parsed.settlementType === "delivery" ? (parsed.deliveryId ?? null) : null,
                driverName: context.driverName,
                vehicleNumber: context.vehicleNumber,
                advanceAmount: String(advanceAmount),
                totalActualAmount: String(totalActualAmount),
                varianceAmount: String(varianceAmount),
                settlementDate: toDateOnly(parsed.settlementDate),
                remarks: parsed.remarks || null,
                updatedAt: new Date(),
            })
            .where(eq(costSettlements.id, id))

        // Child receipts are removed automatically via FK cascade on settlement item deletion.
        await tx.delete(costSettlementItems).where(eq(costSettlementItems.settlementId, id))
        await tx.delete(costSettlementSignatories).where(eq(costSettlementSignatories.settlementId, id))

        if (parsed.items.length > 0) {
            await tx.insert(costSettlementItems).values(
                parsed.items.map((item, index) => ({
                    settlementId: id,
                    costCategory: item.costCategory,
                    description: item.description,
                    amount: String(item.amount),
                    receiptDate: item.receiptDate ? toDateOnly(item.receiptDate) : null,
                    vendorName: item.vendorName || null,
                    deliveryItemId: item.deliveryItemId || null,
                    sortOrder: item.sortOrder ?? index,
                }))
            )
        }

        if (parsed.signatories.length > 0) {
            await tx.insert(costSettlementSignatories).values(
                parsed.signatories.map((signatory, index) => ({
                    settlementId: id,
                    signatoryName: signatory.signatoryName,
                    signatoryPosition: signatory.signatoryPosition,
                    signatoryRole: signatory.signatoryRole,
                    sortOrder: signatory.sortOrder ?? index,
                }))
            )
        }
    })

    revalidatePath("/dashboard/cost-settlements")
    revalidatePath(`/dashboard/cost-settlements/${id}`)
    return { success: true as const }
}

export async function deleteSettlement(id: number) {
    await getSettlementSession("delete")

    const existing = await db.query.costSettlements.findFirst({
        where: and(eq(costSettlements.id, id), isNull(costSettlements.deletedAt)),
        columns: {
            id: true,
            status: true,
        },
    })

    if (!existing) {
        return { success: false as const, error: "Settlement not found" }
    }

    if (existing.status !== "draft") {
        return { success: false as const, error: "Only draft settlement can be deleted" }
    }

    await db.update(costSettlements)
        .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
        })
        .where(eq(costSettlements.id, id))

    revalidatePath("/dashboard/cost-settlements")
    return { success: true as const }
}

export async function submitSettlement(id: number) {
    const session = await getSettlementSession("edit")

    const settlement = await db.query.costSettlements.findFirst({
        where: and(eq(costSettlements.id, id), isNull(costSettlements.deletedAt)),
    })

    if (!settlement) {
        return { success: false as const, error: "Settlement not found" }
    }

    if (settlement.status !== "draft") {
        return { success: false as const, error: "Settlement is not in draft status" }
    }

    await db.insert(approvalFormRegistry)
        .values({
            formKey: "cost-settlement",
            formName: "Cost Settlement",
            modulePath: "/dashboard/cost-settlements",
            description: "Settlement biaya aktual pengiriman dengan lampiran nota",
            isActive: true,
            createdBy: session.user.id,
        })
        .onConflictDoNothing({ target: approvalFormRegistry.formKey })

    const approvalResult = await createApprovalRequestForEntity({
        formKey: "cost-settlement",
        entityId: String(id),
        requesterId: session.user.id,
        metadata: {
            settlementNumber: settlement.settlementNumber,
            settlementType: settlement.settlementType,
            advanceAmount: settlement.advanceAmount,
            totalActualAmount: settlement.totalActualAmount,
            varianceAmount: settlement.varianceAmount,
        },
    })

    await db.update(costSettlements)
        .set({
            status: "submitted",
            approvalRequestId: approvalResult.success && !approvalResult.skipped ? approvalResult.id : null,
            updatedAt: new Date(),
        })
        .where(eq(costSettlements.id, id))

    revalidatePath("/dashboard/cost-settlements")
    revalidatePath("/dashboard/approvals")

    return {
        success: true as const,
        approvalSkipped: Boolean(approvalResult.success && approvalResult.skipped),
    }
}

export async function postSettlement(id: number) {
    await getSettlementSession("edit")

    const settlement = await db.query.costSettlements.findFirst({
        where: and(eq(costSettlements.id, id), isNull(costSettlements.deletedAt)),
        columns: {
            id: true,
            status: true,
        },
    })

    if (!settlement) {
        return { success: false as const, error: "Settlement not found" }
    }

    if (settlement.status !== "approved" && settlement.status !== "submitted") {
        return { success: false as const, error: "Only submitted or approved settlement can be posted" }
    }

    await db.update(costSettlements)
        .set({
            status: "posted",
            updatedAt: new Date(),
        })
        .where(eq(costSettlements.id, id))

    revalidatePath("/dashboard/cost-settlements")
    return { success: true as const }
}

export async function getSettlementSummary() {
    let rows: Array<{
        totalSettlements: number
        totalAdvance: number
        totalActual: number
        totalVariance: number
        pendingApprovalCount: number
        approvedCount: number
        postedCount: number
    }> = []

    try {
        rows = await db.select({
            totalSettlements: sql<number>`count(*)`,
            totalAdvance: sql<number>`coalesce(sum(${costSettlements.advanceAmount}), 0)`,
            totalActual: sql<number>`coalesce(sum(${costSettlements.totalActualAmount}), 0)`,
            totalVariance: sql<number>`coalesce(sum(${costSettlements.varianceAmount}), 0)`,
            pendingApprovalCount: sql<number>`sum(case when ${costSettlements.status} = 'submitted' then 1 else 0 end)`,
            approvedCount: sql<number>`sum(case when ${costSettlements.status} = 'approved' then 1 else 0 end)`,
            postedCount: sql<number>`sum(case when ${costSettlements.status} = 'posted' then 1 else 0 end)`,
        })
            .from(costSettlements)
            .where(isNull(costSettlements.deletedAt))
    } catch (error) {
        void error
        return {
            totalSettlements: 0,
            totalAdvance: 0,
            totalActual: 0,
            totalVariance: 0,
            pendingApprovalCount: 0,
            approvedCount: 0,
            postedCount: 0,
        }
    }

    const summary = rows[0]

    return {
        totalSettlements: Number(summary?.totalSettlements ?? 0),
        totalAdvance: Number(summary?.totalAdvance ?? 0),
        totalActual: Number(summary?.totalActual ?? 0),
        totalVariance: Number(summary?.totalVariance ?? 0),
        pendingApprovalCount: Number(summary?.pendingApprovalCount ?? 0),
        approvedCount: Number(summary?.approvedCount ?? 0),
        postedCount: Number(summary?.postedCount ?? 0),
    }
}

export async function getLatestSettlementByDeliveryIds(deliveryIds: number[]) {
    const ids = Array.from(new Set(deliveryIds.filter((id) => Number.isFinite(id) && id > 0)))
    if (ids.length === 0) {
        return {} as Record<number, { settlementId: number; settlementNumber: string; status: "draft" | "submitted" | "approved" | "rejected" | "posted" }>
    }

    let rows: Array<{
        id: number
        settlementNumber: string
        status: "draft" | "submitted" | "approved" | "rejected" | "posted"
        deliveryId: number | null
    }> = []

    try {
        rows = await db.query.costSettlements.findMany({
            where: and(
                inArray(costSettlements.deliveryId, ids),
                isNull(costSettlements.deletedAt),
            ),
            columns: {
                id: true,
                settlementNumber: true,
                status: true,
                deliveryId: true,
            },
            orderBy: [desc(costSettlements.createdAt)],
        })
    } catch (error) {
        // Keep logistics page available even if settlement tables are not migrated yet.
        void error
        return {}
    }

    const lookup: Record<number, { settlementId: number; settlementNumber: string; status: "draft" | "submitted" | "approved" | "rejected" | "posted" }> = {}
    for (const row of rows) {
        if (!row.deliveryId) continue
        if (!lookup[row.deliveryId]) {
            lookup[row.deliveryId] = {
                settlementId: row.id,
                settlementNumber: row.settlementNumber,
                status: row.status,
            }
        }
    }

    return lookup
}

export async function uploadSettlementReceipt(formData: FormData) {
    const session = await getSettlementSession("edit")
    const settlementItemIdRaw = formData.get("settlementItemId")
    const settlementItemId = Number(settlementItemIdRaw)

    if (!Number.isFinite(settlementItemId) || settlementItemId <= 0) {
        return { success: false as const, error: "Invalid settlement item" }
    }

    const item = await db.query.costSettlementItems.findFirst({
        where: eq(costSettlementItems.id, settlementItemId),
        columns: { id: true },
    })

    if (!item) {
        return { success: false as const, error: "Settlement item not found" }
    }

    const uploadResult = await uploadFile(formData)
    if (!uploadResult.success || !uploadResult.url) {
        return { success: false as const, error: uploadResult.error || "Upload failed" }
    }

    const file = formData.get("file") as File | null

    const [created] = await db.insert(costSettlementReceipts)
        .values({
            settlementItemId,
            fileUrl: uploadResult.url,
            originalFileName: file?.name || "receipt",
            fileSize: file?.size || 0,
            uploadedBy: session.user.id,
        })
        .returning()

    revalidatePath("/dashboard/cost-settlements")

    return { success: true as const, receipt: created }
}
