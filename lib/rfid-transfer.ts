"use server"

import { and, eq, inArray, or } from "drizzle-orm"

import { db } from "@/db"
import {
    inventoryUnitEvents,
    inventoryUnits,
    rfidExceptions,
    rfidTagBindings,
    rfidTags,
} from "@/db/schema"
import { resolveTrackingDecisionForProduct } from "@/lib/rfid-tracking"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

type StockTransferRfidSyncItem = {
    productId: number
    quantity: number
    serialNumbers?: string[] | null
    stockTransferItemId?: number | null
}

export type StockTransferRfidSyncInput = {
    transferId: number
    referenceNumber?: string | null
    fromWarehouseId?: number | null
    toWarehouseId?: number | null
    status?: string | null
    receivedStatus?: string | null
    userId: string
    items: StockTransferRfidSyncItem[]
    captureMethod?: "manual" | "rfid" | "hybrid"
    notes?: string | null
    createTransferOut?: boolean
    createTransferIn?: boolean
}

type StockTransferRfidSyncResult = {
    createdEvents: number
    createdExceptions: number
}

const normalizeTransferSerialNumbers = (serialNumbers: string[] | null | undefined) => {
    const normalized = (serialNumbers ?? [])
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean)

    return Array.from(new Set(normalized))
}

const getDuplicateTransferSerialNumbers = (serialNumbers: string[] | null | undefined) => {
    const duplicates = new Set<string>()
    const seen = new Set<string>()

    for (const serialNumber of serialNumbers ?? []) {
        const normalized = serialNumber.trim().toUpperCase()
        if (!normalized) {
            continue
        }

        if (seen.has(normalized)) {
            duplicates.add(normalized)
            continue
        }

        seen.add(normalized)
    }

    return Array.from(duplicates)
}

const isTerminalInventoryUnitStatus = (status: string | null | undefined) =>
    status === "shipped" || status === "returned" || status === "scrapped"

const getTransferExceptionSeverity = (trackingMode?: string | null, allowManualFallback?: boolean) => {
    if (trackingMode === "required_rfid") {
        return allowManualFallback === false ? "critical" : "high"
    }

    return "medium"
}

async function insertStockTransferRfidException(
    tx: DbTransaction,
    params: {
        warehouseId?: number | null
        productId: number
        inventoryUnitId?: number | null
        rfidTagId?: number | null
        transferId: number
        referenceNumber?: string | null
        exceptionType: string
        severity: "medium" | "high" | "critical"
        notes: string
        metadata?: Record<string, unknown>
    },
) {
    await tx.insert(rfidExceptions).values({
        warehouseId: params.warehouseId ?? null,
        productId: params.productId,
        inventoryUnitId: params.inventoryUnitId ?? null,
        rfidTagId: params.rfidTagId ?? null,
        exceptionType: params.exceptionType,
        severity: params.severity,
        status: "open",
        documentType: "stock_transfer",
        documentId: params.transferId,
        referenceNumber: params.referenceNumber ?? null,
        notes: params.notes,
        metadata: params.metadata ?? {},
    })
}

export async function clearStockTransferRfidArtifacts(
    tx: DbTransaction,
    transferId: number,
    operationTypes: Array<"transfer_out" | "transfer_in"> = ["transfer_out", "transfer_in"],
) {
    await tx.delete(inventoryUnitEvents).where(and(
        eq(inventoryUnitEvents.documentType, "stock_transfer"),
        eq(inventoryUnitEvents.documentId, transferId),
        inArray(inventoryUnitEvents.operationType, operationTypes),
    ))

    await tx.delete(rfidExceptions).where(and(
        eq(rfidExceptions.documentType, "stock_transfer"),
        eq(rfidExceptions.documentId, transferId),
        or(
            eq(rfidExceptions.status, "open"),
            eq(rfidExceptions.status, "investigating"),
        ),
    ))
}

// This helper is intentionally reusable so future mobile/API flows can sync transfer RFID
// without duplicating warehouse-tracking rules in the client.
export async function syncStockTransferRfidLedger(
    tx: DbTransaction,
    input: StockTransferRfidSyncInput,
): Promise<StockTransferRfidSyncResult> {
    await clearStockTransferRfidArtifacts(tx, input.transferId)

    const createTransferOut = input.createTransferOut ?? true
    const createTransferIn = input.createTransferIn ?? true

    if (
        (!input.fromWarehouseId && !input.toWarehouseId) ||
        input.receivedStatus === "Rejected" ||
        input.status === "cancelled" ||
        input.items.length === 0 ||
        (!createTransferOut && !createTransferIn)
    ) {
        return {
            createdEvents: 0,
            createdExceptions: 0,
        }
    }

    let createdEvents = 0
    let createdExceptions = 0

    for (const item of input.items) {
        if (item.quantity <= 0) {
            continue
        }

        const decisionWarehouseId = input.fromWarehouseId ?? input.toWarehouseId
        const trackingDecision = decisionWarehouseId
            ? await resolveTrackingDecisionForProduct(decisionWarehouseId, item.productId)
            : null
        const trackingMode = trackingDecision?.trackingMode ?? "manual_only"
        const allowManualFallback = trackingDecision?.allowManualFallback ?? true
        const severity = getTransferExceptionSeverity(trackingMode, allowManualFallback)
        const duplicateSerialNumbers = getDuplicateTransferSerialNumbers(item.serialNumbers)
        const normalizedSerialNumbers = normalizeTransferSerialNumbers(item.serialNumbers)
        const shouldTrack = trackingMode !== "manual_only" || normalizedSerialNumbers.length > 0

        if (!shouldTrack) {
            continue
        }

        if (duplicateSerialNumbers.length > 0) {
            await insertStockTransferRfidException(tx, {
                warehouseId: input.fromWarehouseId ?? input.toWarehouseId,
                productId: item.productId,
                transferId: input.transferId,
                referenceNumber: input.referenceNumber,
                exceptionType: "stock_transfer_duplicate_serial",
                severity,
                notes: `Ada serial number duplikat pada stock transfer: ${duplicateSerialNumbers.join(", ")}`,
                metadata: {
                    quantity: item.quantity,
                    duplicateSerialNumbers,
                    stockTransferItemId: item.stockTransferItemId ?? null,
                },
            })
            createdExceptions += 1
        }

        if (trackingDecision?.serialRequired && normalizedSerialNumbers.length === 0) {
            await insertStockTransferRfidException(tx, {
                warehouseId: input.fromWarehouseId ?? input.toWarehouseId,
                productId: item.productId,
                transferId: input.transferId,
                referenceNumber: input.referenceNumber,
                exceptionType: "stock_transfer_missing_serial",
                severity,
                notes: "Item transfer membutuhkan serial/RFID, tetapi belum dicatat pada dokumen transfer.",
                metadata: {
                    quantity: item.quantity,
                    stockTransferItemId: item.stockTransferItemId ?? null,
                    trackingMode,
                    serialRequired: true,
                    createTransferOut,
                    createTransferIn,
                },
            })
            createdExceptions += 1
            continue
        }

        if (normalizedSerialNumbers.length < item.quantity && trackingMode !== "manual_only") {
            await insertStockTransferRfidException(tx, {
                warehouseId: input.fromWarehouseId ?? input.toWarehouseId,
                productId: item.productId,
                transferId: input.transferId,
                referenceNumber: input.referenceNumber,
                exceptionType: "stock_transfer_partial_serial",
                severity,
                notes: `Serial/RFID baru terisi ${normalizedSerialNumbers.length} dari qty transfer ${item.quantity}.`,
                metadata: {
                    quantity: item.quantity,
                    enteredSerialCount: normalizedSerialNumbers.length,
                    stockTransferItemId: item.stockTransferItemId ?? null,
                    trackingMode,
                    serialRequired: trackingDecision?.serialRequired ?? false,
                    createTransferOut,
                    createTransferIn,
                },
            })
            createdExceptions += 1
        }

        if (normalizedSerialNumbers.length > item.quantity) {
            await insertStockTransferRfidException(tx, {
                warehouseId: input.fromWarehouseId ?? input.toWarehouseId,
                productId: item.productId,
                transferId: input.transferId,
                referenceNumber: input.referenceNumber,
                exceptionType: "stock_transfer_extra_serial",
                severity,
                notes: `Jumlah serial/RFID melebihi qty transfer. Qty ${item.quantity}, serial ${normalizedSerialNumbers.length}.`,
                metadata: {
                    quantity: item.quantity,
                    enteredSerialCount: normalizedSerialNumbers.length,
                    stockTransferItemId: item.stockTransferItemId ?? null,
                },
            })
            createdExceptions += 1
        }

        const serialNumbersToProcess = normalizedSerialNumbers.slice(0, item.quantity)

        for (const serialNumber of serialNumbersToProcess) {
            const inventoryUnit = await tx.query.inventoryUnits.findFirst({
                where: eq(inventoryUnits.serialNumber, serialNumber),
                columns: {
                    id: true,
                    productId: true,
                    warehouseId: true,
                    currentTagId: true,
                    status: true,
                },
            })

            if (!inventoryUnit) {
                await insertStockTransferRfidException(tx, {
                    warehouseId: input.fromWarehouseId ?? input.toWarehouseId,
                    productId: item.productId,
                    transferId: input.transferId,
                    referenceNumber: input.referenceNumber,
                    exceptionType: "stock_transfer_unknown_serial",
                    severity,
                    notes: `Serial ${serialNumber} belum terdaftar sebagai inventory unit RFID.`,
                    metadata: {
                        serialNumber,
                        quantity: item.quantity,
                        stockTransferItemId: item.stockTransferItemId ?? null,
                    },
                })
                createdExceptions += 1
                continue
            }

            if (inventoryUnit.productId !== item.productId) {
                await insertStockTransferRfidException(tx, {
                    warehouseId: input.fromWarehouseId ?? input.toWarehouseId,
                    productId: item.productId,
                    inventoryUnitId: inventoryUnit.id,
                    rfidTagId: inventoryUnit.currentTagId,
                    transferId: input.transferId,
                    referenceNumber: input.referenceNumber,
                    exceptionType: "stock_transfer_wrong_product",
                    severity,
                    notes: `Serial ${serialNumber} terdaftar pada product lain, bukan item transfer ini.`,
                    metadata: {
                        serialNumber,
                        inventoryUnitProductId: inventoryUnit.productId,
                        transferProductId: item.productId,
                        stockTransferItemId: item.stockTransferItemId ?? null,
                    },
                })
                createdExceptions += 1
                continue
            }

            const activeBinding = await tx.query.rfidTagBindings.findFirst({
                where: and(
                    eq(rfidTagBindings.inventoryUnitId, inventoryUnit.id),
                    eq(rfidTagBindings.status, "active"),
                ),
                columns: {
                    rfidTagId: true,
                },
            })

            const activeTagId = inventoryUnit.currentTagId ?? activeBinding?.rfidTagId ?? null

            if (createTransferOut && input.fromWarehouseId && inventoryUnit.warehouseId !== input.fromWarehouseId) {
                await insertStockTransferRfidException(tx, {
                    warehouseId: input.fromWarehouseId,
                    productId: item.productId,
                    inventoryUnitId: inventoryUnit.id,
                    rfidTagId: activeTagId,
                    transferId: input.transferId,
                    referenceNumber: input.referenceNumber,
                    exceptionType: "stock_transfer_wrong_warehouse",
                    severity,
                    notes: `Serial ${serialNumber} terdaftar di warehouse lain dan perlu dicek sebelum transfer keluar.`,
                    metadata: {
                        serialNumber,
                        inventoryUnitWarehouseId: inventoryUnit.warehouseId,
                        transferWarehouseId: input.fromWarehouseId,
                        stockTransferItemId: item.stockTransferItemId ?? null,
                    },
                })
                createdExceptions += 1
                continue
            }

            if (!activeTagId && trackingMode === "required_rfid") {
                await insertStockTransferRfidException(tx, {
                    warehouseId: input.fromWarehouseId ?? input.toWarehouseId,
                    productId: item.productId,
                    inventoryUnitId: inventoryUnit.id,
                    transferId: input.transferId,
                    referenceNumber: input.referenceNumber,
                    exceptionType: "stock_transfer_missing_tag",
                    severity,
                    notes: `Serial ${serialNumber} belum punya tag RFID aktif saat transfer diproses.`,
                    metadata: {
                        serialNumber,
                        trackingMode,
                        stockTransferItemId: item.stockTransferItemId ?? null,
                    },
                })
                createdExceptions += 1
            }

            if (createTransferOut && input.fromWarehouseId) {
                await tx.insert(inventoryUnitEvents).values({
                    inventoryUnitId: inventoryUnit.id,
                    productId: item.productId,
                    warehouseId: input.fromWarehouseId,
                    rfidTagId: activeTagId,
                    operationType: "transfer_out",
                    documentType: "stock_transfer",
                    documentId: input.transferId,
                    captureMethod: input.captureMethod ?? "manual",
                    referenceNumber: input.referenceNumber ?? null,
                    quantity: 1,
                    notes: input.notes ?? "Transfer keluar RFID tercatat dari stock transfer",
                    metadata: {
                        serialNumber,
                        quantity: item.quantity,
                        stockTransferItemId: item.stockTransferItemId ?? null,
                        trackingMode,
                        serialRequired: trackingDecision?.serialRequired ?? false,
                        toWarehouseId: input.toWarehouseId ?? null,
                        status: input.status ?? null,
                        receivedStatus: input.receivedStatus ?? null,
                    },
                    createdBy: input.userId,
                })
                createdEvents += 1
            }

            if (createTransferIn && input.toWarehouseId) {
                await tx.insert(inventoryUnitEvents).values({
                    inventoryUnitId: inventoryUnit.id,
                    productId: item.productId,
                    warehouseId: input.toWarehouseId,
                    rfidTagId: activeTagId,
                    operationType: "transfer_in",
                    documentType: "stock_transfer",
                    documentId: input.transferId,
                    captureMethod: input.captureMethod ?? "manual",
                    referenceNumber: input.referenceNumber ?? null,
                    quantity: 1,
                    notes: input.notes ?? "Transfer masuk RFID tercatat dari stock transfer",
                    metadata: {
                        serialNumber,
                        quantity: item.quantity,
                        stockTransferItemId: item.stockTransferItemId ?? null,
                        trackingMode,
                        serialRequired: trackingDecision?.serialRequired ?? false,
                        fromWarehouseId: input.fromWarehouseId ?? null,
                        status: input.status ?? null,
                        receivedStatus: input.receivedStatus ?? null,
                    },
                    createdBy: input.userId,
                })
                createdEvents += 1
            }

            const nextWarehouseId = createTransferIn
                ? (input.toWarehouseId ?? inventoryUnit.warehouseId)
                : inventoryUnit.warehouseId
            const nextStatus = createTransferIn
                ? (isTerminalInventoryUnitStatus(inventoryUnit.status) ? inventoryUnit.status : "in_stock")
                : createTransferOut
                    ? (isTerminalInventoryUnitStatus(inventoryUnit.status) ? inventoryUnit.status : "in_transfer")
                    : inventoryUnit.status

            await tx.update(inventoryUnits)
                .set({
                    warehouseId: nextWarehouseId,
                    status: nextStatus,
                    lastMovementAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(inventoryUnits.id, inventoryUnit.id))

            if (activeTagId) {
                await tx.update(rfidTags)
                    .set({
                        lastSeenWarehouseId: createTransferIn
                            ? (input.toWarehouseId ?? input.fromWarehouseId ?? null)
                            : (input.fromWarehouseId ?? input.toWarehouseId ?? null),
                        lastSeenAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(rfidTags.id, activeTagId))
            }
        }
    }

    return {
        createdEvents,
        createdExceptions,
    }
}
