"use server"

import { and, eq, or } from "drizzle-orm"

import { db } from "@/db"
import { rfidExceptions } from "@/db/schema"
import { resolveTrackingDecisionForProduct } from "@/lib/rfid-tracking"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

type StockOpnameRfidSyncItem = {
    itemId?: number | null
    productId: number
    systemQty: number
    countedQty: number | null
    variance: number | null
    notes?: string | null
}

export type StockOpnameRfidSyncInput = {
    sessionId: number
    sessionName?: string | null
    warehouseId: number
    sourceType?: string | null
    status?: string | null
    applyAdjustments?: boolean
    userId: string
    items: StockOpnameRfidSyncItem[]
}

type StockOpnameRfidSyncResult = {
    createdExceptions: number
}

const getOpnameExceptionSeverity = (trackingMode?: string | null, allowManualFallback?: boolean) => {
    if (trackingMode === "required_rfid") {
        return allowManualFallback === false ? "critical" : "high"
    }

    return "medium"
}

async function insertStockOpnameRfidException(
    tx: DbTransaction,
    params: {
        warehouseId: number
        productId: number
        sessionId: number
        sessionName?: string | null
        exceptionType: string
        severity: "medium" | "high" | "critical"
        notes: string
        metadata?: Record<string, unknown>
    },
) {
    await tx.insert(rfidExceptions).values({
        warehouseId: params.warehouseId,
        productId: params.productId,
        exceptionType: params.exceptionType,
        severity: params.severity,
        status: "open",
        documentType: "stock_opname",
        documentId: params.sessionId,
        referenceNumber: params.sessionName ?? `OPNAME-${params.sessionId}`,
        notes: params.notes,
        metadata: params.metadata ?? {},
    })
}

export async function clearStockOpnameRfidArtifacts(tx: DbTransaction, sessionId: number) {
    await tx.delete(rfidExceptions).where(and(
        eq(rfidExceptions.documentType, "stock_opname"),
        eq(rfidExceptions.documentId, sessionId),
        or(
            eq(rfidExceptions.status, "open"),
            eq(rfidExceptions.status, "investigating"),
        ),
    ))
}

// Opname RFID sync is kept aggregate-only for now so current manual counting stays safe.
// Future mobile flows can enrich this with scanned serial/tag evidence without changing
// the close-session behavior already used by the web.
export async function syncStockOpnameRfidReview(
    tx: DbTransaction,
    input: StockOpnameRfidSyncInput,
): Promise<StockOpnameRfidSyncResult> {
    await clearStockOpnameRfidArtifacts(tx, input.sessionId)

    if (input.status === "cancelled" || input.items.length === 0) {
        return {
            createdExceptions: 0,
        }
    }

    let createdExceptions = 0

    for (const item of input.items) {
        const trackingDecision = await resolveTrackingDecisionForProduct(input.warehouseId, item.productId)
        const trackingMode = trackingDecision?.trackingMode ?? "manual_only"
        const shouldTrack = trackingMode !== "manual_only"

        if (!shouldTrack) {
            continue
        }

        const severity = getOpnameExceptionSeverity(trackingMode, trackingDecision?.allowManualFallback)

        if (item.countedQty === null) {
            await insertStockOpnameRfidException(tx, {
                warehouseId: input.warehouseId,
                productId: item.productId,
                sessionId: input.sessionId,
                sessionName: input.sessionName,
                exceptionType: "stock_opname_missing_count",
                severity,
                notes: "Item pilot RFID belum dihitung saat sesi stock opname ditutup.",
                metadata: {
                    itemId: item.itemId ?? null,
                    systemQty: item.systemQty,
                    countedQty: null,
                    variance: null,
                    sourceType: input.sourceType ?? null,
                    applyAdjustments: input.applyAdjustments ?? false,
                    trackingMode,
                    serialRequired: trackingDecision?.serialRequired ?? false,
                    reviewedBy: input.userId,
                },
            })
            createdExceptions += 1
            continue
        }

        if (item.variance !== null && item.variance !== 0) {
            await insertStockOpnameRfidException(tx, {
                warehouseId: input.warehouseId,
                productId: item.productId,
                sessionId: input.sessionId,
                sessionName: input.sessionName,
                exceptionType: "stock_opname_variance",
                severity,
                notes: `Item pilot RFID memiliki selisih stock opname ${item.variance > 0 ? "+" : ""}${item.variance}.`,
                metadata: {
                    itemId: item.itemId ?? null,
                    systemQty: item.systemQty,
                    countedQty: item.countedQty,
                    variance: item.variance,
                    sourceType: input.sourceType ?? null,
                    applyAdjustments: input.applyAdjustments ?? false,
                    trackingMode,
                    serialRequired: trackingDecision?.serialRequired ?? false,
                    reviewedBy: input.userId,
                    itemNotes: item.notes ?? null,
                },
            })
            createdExceptions += 1
        }
    }

    return {
        createdExceptions,
    }
}
