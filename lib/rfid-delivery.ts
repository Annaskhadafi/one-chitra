"use server"

import { db } from "@/db"
import {
    inventoryUnitEvents,
    inventoryUnits,
    rfidExceptions,
    rfidTagBindings,
    rfidTags,
} from "@/db/schema"
import { and, eq, inArray, or } from "drizzle-orm"
import { resolveTrackingDecisionForProduct } from "@/lib/rfid-tracking"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

type DeliveryRfidSyncItem = {
    productId: number
    deliveredQuantity: number
    serialNumbers?: string[] | null
    salesOrderItemId?: number | null
}

export type DeliveryRfidSyncInput = {
    deliveryId: number
    deliveryNumber?: string | null
    warehouseId?: number | null
    warehouseToId?: number | null
    status: string
    userId: string
    items: DeliveryRfidSyncItem[]
    captureMethod?: "manual" | "rfid" | "hybrid"
    notes?: string | null
}

type DeliveryRfidSyncResult = {
    createdEvents: number
    createdExceptions: number
}

const normalizeDeliverySerialNumbers = (serialNumbers: string[] | null | undefined) => {
    const normalized = (serialNumbers ?? [])
        .map((entry) => entry.trim().toUpperCase())
        .filter(Boolean)

    return Array.from(new Set(normalized))
}

const getDuplicateDeliverySerialNumbers = (serialNumbers: string[] | null | undefined) => {
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

const getDeliveryExceptionSeverity = (trackingMode?: string | null, allowManualFallback?: boolean) => {
    if (trackingMode === "required_rfid") {
        return allowManualFallback === false ? "critical" : "high"
    }

    return "medium"
}

async function insertDeliveryRfidException(
    tx: DbTransaction,
    params: {
        warehouseId?: number | null
        productId: number
        inventoryUnitId?: number | null
        rfidTagId?: number | null
        deliveryId: number
        deliveryNumber?: string | null
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
        documentType: "delivery",
        documentId: params.deliveryId,
        referenceNumber: params.deliveryNumber ?? null,
        notes: params.notes,
        metadata: params.metadata ?? {},
    })
}

export async function clearDeliveryRfidArtifacts(tx: DbTransaction, deliveryId: number) {
    await tx.delete(inventoryUnitEvents).where(and(
        eq(inventoryUnitEvents.documentType, "delivery"),
        eq(inventoryUnitEvents.documentId, deliveryId),
        inArray(inventoryUnitEvents.operationType, ["outbound", "transfer_out"]),
    ))

    await tx.delete(rfidExceptions).where(and(
        eq(rfidExceptions.documentType, "delivery"),
        eq(rfidExceptions.documentId, deliveryId),
        or(
            eq(rfidExceptions.status, "open"),
            eq(rfidExceptions.status, "investigating"),
        ),
    ))
}

// This helper keeps delivery RFID sync reusable for future API/mobile usage.
export async function syncDeliveryRfidLedger(
    tx: DbTransaction,
    input: DeliveryRfidSyncInput,
): Promise<DeliveryRfidSyncResult> {
    await clearDeliveryRfidArtifacts(tx, input.deliveryId)

    if (!input.warehouseId || input.status === "cancelled" || input.items.length === 0) {
        return {
            createdEvents: 0,
            createdExceptions: 0,
        }
    }

    const hasDestination = Boolean(input.warehouseToId && input.warehouseToId > 0)
    let createdEvents = 0
    let createdExceptions = 0

    for (const item of input.items) {
        if (item.deliveredQuantity <= 0) {
            continue
        }

        const trackingDecision = await resolveTrackingDecisionForProduct(input.warehouseId, item.productId)
        const trackingMode = trackingDecision?.trackingMode ?? "manual_only"
        const allowManualFallback = trackingDecision?.allowManualFallback ?? true
        const severity = getDeliveryExceptionSeverity(trackingMode, allowManualFallback)
        const duplicateSerialNumbers = getDuplicateDeliverySerialNumbers(item.serialNumbers)
        const normalizedSerialNumbers = normalizeDeliverySerialNumbers(item.serialNumbers)
        const shouldTrack = trackingMode !== "manual_only" || normalizedSerialNumbers.length > 0

        if (!shouldTrack) {
            continue
        }

        if (duplicateSerialNumbers.length > 0) {
            await insertDeliveryRfidException(tx, {
                warehouseId: input.warehouseId,
                productId: item.productId,
                deliveryId: input.deliveryId,
                deliveryNumber: input.deliveryNumber,
                exceptionType: "delivery_duplicate_serial",
                severity,
                notes: `Ada serial number duplikat pada delivery: ${duplicateSerialNumbers.join(", ")}`,
                metadata: {
                    deliveredQuantity: item.deliveredQuantity,
                    duplicateSerialNumbers,
                    salesOrderItemId: item.salesOrderItemId ?? null,
                },
            })
            createdExceptions += 1
        }

        if (trackingDecision?.serialRequired && normalizedSerialNumbers.length === 0) {
            await insertDeliveryRfidException(tx, {
                warehouseId: input.warehouseId,
                productId: item.productId,
                deliveryId: input.deliveryId,
                deliveryNumber: input.deliveryNumber,
                exceptionType: "delivery_missing_serial",
                severity,
                notes: "Item delivery membutuhkan serial/RFID, tetapi belum diisi pada dokumen.",
                metadata: {
                    deliveredQuantity: item.deliveredQuantity,
                    salesOrderItemId: item.salesOrderItemId ?? null,
                    trackingMode,
                    serialRequired: true,
                },
            })
            createdExceptions += 1
            continue
        }

        if (normalizedSerialNumbers.length < item.deliveredQuantity && trackingMode !== "manual_only") {
            await insertDeliveryRfidException(tx, {
                warehouseId: input.warehouseId,
                productId: item.productId,
                deliveryId: input.deliveryId,
                deliveryNumber: input.deliveryNumber,
                exceptionType: "delivery_partial_serial",
                severity,
                notes: `Serial/RFID baru terisi ${normalizedSerialNumbers.length} dari qty delivery ${item.deliveredQuantity}.`,
                metadata: {
                    deliveredQuantity: item.deliveredQuantity,
                    enteredSerialCount: normalizedSerialNumbers.length,
                    salesOrderItemId: item.salesOrderItemId ?? null,
                    trackingMode,
                    serialRequired: trackingDecision?.serialRequired ?? false,
                },
            })
            createdExceptions += 1
        }

        if (normalizedSerialNumbers.length > item.deliveredQuantity) {
            await insertDeliveryRfidException(tx, {
                warehouseId: input.warehouseId,
                productId: item.productId,
                deliveryId: input.deliveryId,
                deliveryNumber: input.deliveryNumber,
                exceptionType: "delivery_extra_serial",
                severity,
                notes: `Jumlah serial/RFID melebihi qty delivery. Qty ${item.deliveredQuantity}, serial ${normalizedSerialNumbers.length}.`,
                metadata: {
                    deliveredQuantity: item.deliveredQuantity,
                    enteredSerialCount: normalizedSerialNumbers.length,
                    salesOrderItemId: item.salesOrderItemId ?? null,
                },
            })
            createdExceptions += 1
        }

        const serialNumbersToProcess = normalizedSerialNumbers.slice(0, item.deliveredQuantity)

        for (const serialNumber of serialNumbersToProcess) {
            const inventoryUnit = await tx.query.inventoryUnits.findFirst({
                where: eq(inventoryUnits.serialNumber, serialNumber),
                columns: {
                    id: true,
                    productId: true,
                    warehouseId: true,
                    currentTagId: true,
                },
            })

            if (!inventoryUnit) {
                await insertDeliveryRfidException(tx, {
                    warehouseId: input.warehouseId,
                    productId: item.productId,
                    deliveryId: input.deliveryId,
                    deliveryNumber: input.deliveryNumber,
                    exceptionType: "delivery_unknown_serial",
                    severity,
                    notes: `Serial ${serialNumber} belum terdaftar sebagai inventory unit RFID.`,
                    metadata: {
                        serialNumber,
                        deliveredQuantity: item.deliveredQuantity,
                        salesOrderItemId: item.salesOrderItemId ?? null,
                    },
                })
                createdExceptions += 1
                continue
            }

            if (inventoryUnit.productId !== item.productId) {
                await insertDeliveryRfidException(tx, {
                    warehouseId: input.warehouseId,
                    productId: item.productId,
                    inventoryUnitId: inventoryUnit.id,
                    rfidTagId: inventoryUnit.currentTagId,
                    deliveryId: input.deliveryId,
                    deliveryNumber: input.deliveryNumber,
                    exceptionType: "delivery_wrong_product",
                    severity,
                    notes: `Serial ${serialNumber} terdaftar pada product lain, bukan item delivery ini.`,
                    metadata: {
                        serialNumber,
                        inventoryUnitProductId: inventoryUnit.productId,
                        deliveryProductId: item.productId,
                        salesOrderItemId: item.salesOrderItemId ?? null,
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

            if (inventoryUnit.warehouseId !== input.warehouseId) {
                await insertDeliveryRfidException(tx, {
                    warehouseId: input.warehouseId,
                    productId: item.productId,
                    inventoryUnitId: inventoryUnit.id,
                    rfidTagId: activeTagId,
                    deliveryId: input.deliveryId,
                    deliveryNumber: input.deliveryNumber,
                    exceptionType: "delivery_wrong_warehouse",
                    severity,
                    notes: `Serial ${serialNumber} terdaftar di warehouse lain dan perlu dicek sebelum delivery.`,
                    metadata: {
                        serialNumber,
                        inventoryUnitWarehouseId: inventoryUnit.warehouseId,
                        deliveryWarehouseId: input.warehouseId,
                        salesOrderItemId: item.salesOrderItemId ?? null,
                    },
                })
                createdExceptions += 1
                continue
            }

            if (!activeTagId && trackingMode === "required_rfid") {
                await insertDeliveryRfidException(tx, {
                    warehouseId: input.warehouseId,
                    productId: item.productId,
                    inventoryUnitId: inventoryUnit.id,
                    deliveryId: input.deliveryId,
                    deliveryNumber: input.deliveryNumber,
                    exceptionType: "delivery_missing_tag",
                    severity,
                    notes: `Serial ${serialNumber} belum punya tag RFID aktif saat delivery diproses.`,
                    metadata: {
                        serialNumber,
                        trackingMode,
                        salesOrderItemId: item.salesOrderItemId ?? null,
                    },
                })
                createdExceptions += 1
            }

            await tx.insert(inventoryUnitEvents).values({
                inventoryUnitId: inventoryUnit.id,
                productId: item.productId,
                warehouseId: input.warehouseId,
                rfidTagId: activeTagId,
                operationType: hasDestination ? "transfer_out" : "outbound",
                documentType: "delivery",
                documentId: input.deliveryId,
                captureMethod: input.captureMethod ?? "manual",
                referenceNumber: input.deliveryNumber ?? null,
                quantity: 1,
                notes: input.notes ?? (hasDestination
                    ? "Outbound RFID tercatat dari delivery antar warehouse"
                    : "Outbound RFID tercatat dari delivery"),
                metadata: {
                    serialNumber,
                    salesOrderItemId: item.salesOrderItemId ?? null,
                    deliveredQuantity: item.deliveredQuantity,
                    trackingMode,
                    serialRequired: trackingDecision?.serialRequired ?? false,
                    warehouseToId: input.warehouseToId ?? null,
                    deliveryStatus: input.status,
                },
                createdBy: input.userId,
            })
            createdEvents += 1

            await tx.update(inventoryUnits)
                .set({
                    lastMovementAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(inventoryUnits.id, inventoryUnit.id))

            if (activeTagId) {
                await tx.update(rfidTags)
                    .set({
                        lastSeenWarehouseId: input.warehouseId,
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
