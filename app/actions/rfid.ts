"use server"

import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/db"
import {
    inventoryUnitEvents,
    inventoryUnits,
    products,
    rfidDevices,
    rfidScanEvents,
    rfidExceptions,
    rfidScanSessions,
    rfidTagBindings,
    rfidTagWriteSessions,
    rfidTags,
    warehouseRfidSettings,
    warehouseTrackingPolicies,
    warehouses,
} from "@/db/schema"
import {
    rfidExceptionStatusSchema,
    rfidExceptionStatusUpdateSchema,
    rfidMonitoringTagSchema,
    rfidTagUnitBindingSchema,
    rfidReaderResetSchema,
    rfidScanEventDeletionSchema,
    rfidTraceabilitySearchSchema,
    warehouseRfidSettingSchema,
    warehouseTrackingPolicySchema,
} from "@/lib/schemas"
import {
    resolveTrackingDecisionForProduct,
    resolveTrackingDecisionsForProducts,
} from "@/lib/rfid-tracking"
import { getAuthenticatedSession } from "@/lib/rbac"
import {
    assertCurrentUserHasWarehouseAccess,
    getAllowedWarehouseIdsForCurrentUser,
} from "@/lib/warehouse-access"

const buildWarehouseFilter = (allowedWarehouseIds: number[] | null, warehouseId?: number) => {
    if (warehouseId && allowedWarehouseIds && !allowedWarehouseIds.includes(warehouseId)) {
        throw new Error("Warehouse access denied")
    }

    const scopedWarehouseIds = warehouseId ? [warehouseId] : allowedWarehouseIds

    if (scopedWarehouseIds && scopedWarehouseIds.length === 0) {
        return null
    }

    return scopedWarehouseIds
}

const normalizeNullableText = (value: string | null | undefined) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

const normalizeUpperText = (value: string | null | undefined) => {
    const trimmed = value?.trim().toUpperCase()
    return trimmed ? trimmed : null
}

const normalizeSearchTerm = (value: string | null | undefined) => value?.trim() ?? ""

const buildOrCondition = (...conditions: Array<Parameters<typeof or>[number] | undefined>) => {
    const filtered = conditions.filter(
        (condition): condition is Parameters<typeof or>[number] => Boolean(condition),
    )

    if (filtered.length === 0) {
        return undefined
    }

    if (filtered.length === 1) {
        return filtered[0]
    }

    return or(...filtered)
}

const isTerminalInventoryUnitStatus = (status: string | null | undefined) =>
    status === "shipped" || status === "returned" || status === "scrapped"

const revalidateRfidMonitoringSurfaces = () => {
    revalidatePath("/dashboard/rfid-monitoring")
    revalidatePath("/dashboard/rfid-exceptions")
    revalidatePath("/dashboard/rfid-tagged-units")
    revalidatePath("/dashboard/rfid-traceability")
    revalidatePath("/dashboard/deliveries")
    revalidatePath("/dashboard/stock-transfers")
    revalidatePath("/dashboard/good-receive-manual")
    revalidatePath("/dashboard/stock-opname")
}

export async function getRfidSetupData(warehouseId?: number) {
    await getAuthenticatedSession("warehouses", "view")

    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")
    const scopedWarehouseIds = buildWarehouseFilter(allowedWarehouseIds, warehouseId)

    if (scopedWarehouseIds === null) {
        return {
            warehouses: [],
            settings: [],
            policies: [],
            rfidCapableProducts: [],
        }
    }

    const [warehouseRows, settingRows, policyRows, rfidCapableProductsRows, categoryRows] = await Promise.all([
        db.query.warehouses.findMany({
            orderBy: [warehouses.description, warehouses.sloc],
        }),
        db.query.warehouseRfidSettings.findMany({
            where: scopedWarehouseIds ? inArray(warehouseRfidSettings.warehouseId, scopedWarehouseIds) : undefined,
            with: {
                warehouse: true,
            },
            orderBy: [warehouseRfidSettings.warehouseId],
        }),
        db.query.warehouseTrackingPolicies.findMany({
            where: scopedWarehouseIds ? inArray(warehouseTrackingPolicies.warehouseId, scopedWarehouseIds) : undefined,
            with: {
                warehouse: true,
                product: true,
            },
            orderBy: [desc(warehouseTrackingPolicies.updatedAt)],
        }),
        db.query.products.findMany({
            where: eq(products.rfidCapable, true),
            columns: {
                id: true,
                materialNumber: true,
                materialDescription: true,
                category: true,
                defaultTrackingMode: true,
                serialRequired: true,
                allowTagReuse: true,
            },
            orderBy: [products.category, products.materialNumber],
        }),
        db.selectDistinct({ category: products.category })
            .from(products)
            .orderBy(products.category),
    ])

    return {
        warehouses: warehouseRows,
        settings: settingRows,
        policies: policyRows,
        rfidCapableProducts: rfidCapableProductsRows,
        categories: categoryRows
            .map((row) => row.category?.trim() ?? "")
            .filter(Boolean),
    }
}

export async function saveWarehouseRfidSetting(
    data: Parameters<typeof warehouseRfidSettingSchema.parse>[0],
) {
    const parsed = warehouseRfidSettingSchema.parse(data)
    await getAuthenticatedSession("warehouses", "edit")
    await assertCurrentUserHasWarehouseAccess(parsed.warehouseId, "edit")

    const existing = await db.query.warehouseRfidSettings.findFirst({
        where: eq(warehouseRfidSettings.warehouseId, parsed.warehouseId),
        columns: { id: true },
    })

    if (existing) {
        await db.update(warehouseRfidSettings)
            .set({
                isEnabled: parsed.isEnabled,
                defaultTrackingMode: parsed.defaultTrackingMode,
                allowManualFallback: parsed.allowManualFallback,
                requireInboundValidation: parsed.requireInboundValidation,
                requireOutboundValidation: parsed.requireOutboundValidation,
                pilotNotes: parsed.pilotNotes?.trim() || null,
                updatedAt: new Date(),
            })
            .where(eq(warehouseRfidSettings.id, existing.id))
    } else {
        await db.insert(warehouseRfidSettings).values({
            warehouseId: parsed.warehouseId,
            isEnabled: parsed.isEnabled,
            defaultTrackingMode: parsed.defaultTrackingMode,
            allowManualFallback: parsed.allowManualFallback,
            requireInboundValidation: parsed.requireInboundValidation,
            requireOutboundValidation: parsed.requireOutboundValidation,
            pilotNotes: parsed.pilotNotes?.trim() || null,
        })
    }

    revalidatePath("/dashboard/warehouse")
    return { success: true }
}

export async function saveWarehouseTrackingPolicy(
    data: Parameters<typeof warehouseTrackingPolicySchema.parse>[0],
    id?: number,
) {
    const parsed = warehouseTrackingPolicySchema.parse(data)
    await getAuthenticatedSession("warehouses", "edit")
    await assertCurrentUserHasWarehouseAccess(parsed.warehouseId, "edit")

    const normalizedCategory = parsed.category?.trim().toUpperCase() || null

    if (id) {
        await db.update(warehouseTrackingPolicies)
            .set({
                warehouseId: parsed.warehouseId,
                scopeType: parsed.scopeType,
                productId: parsed.scopeType === "product" ? parsed.productId ?? null : null,
                category: parsed.scopeType === "category" ? normalizedCategory : null,
                trackingMode: parsed.trackingMode,
                allowManualFallback: parsed.allowManualFallback,
                serialRequired: parsed.serialRequired,
                isActive: parsed.isActive,
                notes: parsed.notes?.trim() || null,
                updatedAt: new Date(),
            })
            .where(eq(warehouseTrackingPolicies.id, id))
    } else {
        await db.insert(warehouseTrackingPolicies).values({
            warehouseId: parsed.warehouseId,
            scopeType: parsed.scopeType,
            productId: parsed.scopeType === "product" ? parsed.productId ?? null : null,
            category: parsed.scopeType === "category" ? normalizedCategory : null,
            trackingMode: parsed.trackingMode,
            allowManualFallback: parsed.allowManualFallback,
            serialRequired: parsed.serialRequired,
            isActive: parsed.isActive,
            notes: parsed.notes?.trim() || null,
        })
    }

    revalidatePath("/dashboard/products")
    revalidatePath("/dashboard/warehouse")
    return { success: true }
}

export async function deleteWarehouseTrackingPolicy(id: number) {
    await getAuthenticatedSession("warehouses", "edit")

    const policy = await db.query.warehouseTrackingPolicies.findFirst({
        where: eq(warehouseTrackingPolicies.id, id),
        columns: {
            id: true,
            warehouseId: true,
        },
    })

    if (!policy) {
        return { success: false, error: "Policy tidak ditemukan" }
    }

    await assertCurrentUserHasWarehouseAccess(policy.warehouseId, "edit")
    await db.delete(warehouseTrackingPolicies).where(eq(warehouseTrackingPolicies.id, id))

    revalidatePath("/dashboard/products")
    revalidatePath("/dashboard/warehouse")
    return { success: true }
}

export async function getTrackingDecisionPreview(warehouseId: number, productIds: number[]) {
    await getAuthenticatedSession()
    await assertCurrentUserHasWarehouseAccess(warehouseId, "view")

    return resolveTrackingDecisionsForProducts(warehouseId, productIds)
}

export async function getRfidTraceabilityLookup() {
    await getAuthenticatedSession("inventory", "view")

    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")
    const scopedWarehouseIds = buildWarehouseFilter(allowedWarehouseIds)

    if (scopedWarehouseIds === null) {
        return {
            warehouses: [],
        }
    }

    const warehouseRows = await db.query.warehouses.findMany({
        where: scopedWarehouseIds ? inArray(warehouses.id, scopedWarehouseIds) : undefined,
        orderBy: [warehouses.description, warehouses.sloc],
    })

    return {
        warehouses: warehouseRows,
    }
}

export async function getRfidTaggedUnitsOverview(warehouseId?: number) {
    await getAuthenticatedSession("inventory", "view")

    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")
    const scopedWarehouseIds = buildWarehouseFilter(allowedWarehouseIds, warehouseId)

    if (scopedWarehouseIds === null) {
        return {
            totals: {
                taggedUnits: 0,
                activeTags: 0,
                reusableTags: 0,
                warehouseCount: 0,
            },
            items: [],
        }
    }

    const items = await db.query.inventoryUnits.findMany({
        where: and(
            isNotNull(inventoryUnits.currentTagId),
            scopedWarehouseIds ? inArray(inventoryUnits.warehouseId, scopedWarehouseIds) : undefined,
        ),
        with: {
            product: true,
            warehouse: true,
            zone: true,
            currentTag: true,
        },
        orderBy: [desc(inventoryUnits.updatedAt)],
    })

    return {
        totals: {
            taggedUnits: items.length,
            activeTags: items.filter((item) => item.currentTag?.status === "active").length,
            reusableTags: items.filter((item) => item.currentTag?.isReusable).length,
            warehouseCount: new Set(items.map((item) => item.warehouseId)).size,
        },
        items,
    }
}

export async function searchRfidTraceability(
    data: Parameters<typeof rfidTraceabilitySearchSchema.parse>[0],
) {
    const parsed = rfidTraceabilitySearchSchema.parse(data)
    await getAuthenticatedSession("inventory", "view")

    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")
    const scopedWarehouseIds = buildWarehouseFilter(allowedWarehouseIds, parsed.warehouseId ?? undefined)

    if (scopedWarehouseIds === null) {
        return {
            query: parsed.query,
            warehouseId: parsed.warehouseId ?? null,
            matchedTags: [],
            matchedUnits: [],
            bindings: [],
            unitEvents: [],
            scanEvents: [],
            writeSessions: [],
            exceptions: [],
        }
    }

    const normalizedQuery = normalizeSearchTerm(parsed.query)
    const likePattern = `%${normalizedQuery}%`

    const matchedProducts = await db.query.products.findMany({
        where: buildOrCondition(
            ilike(products.materialNumber, likePattern),
            ilike(products.materialDescription, likePattern),
        ),
        columns: {
            id: true,
            materialNumber: true,
            materialDescription: true,
        },
        limit: 25,
    })

    const matchedProductIds = matchedProducts.map((product) => product.id)
    const tagSearchConditions = [
        ilike(rfidTags.epc, likePattern),
        ilike(rfidTags.tid, likePattern),
        ilike(rfidTags.tagSerial, likePattern),
        ilike(rfidTags.memoryMaterialNumber, likePattern),
        ilike(rfidTags.memorySerialNumber, likePattern),
    ]

    const matchedTags = await db.query.rfidTags.findMany({
        where: and(
            buildOrCondition(...tagSearchConditions),
            scopedWarehouseIds ? inArray(rfidTags.lastSeenWarehouseId, scopedWarehouseIds) : undefined,
        ),
        with: {
            lastSeenWarehouse: true,
        },
        orderBy: [desc(rfidTags.updatedAt)],
        limit: 20,
    })

    const matchedTagIds = matchedTags.map((tag) => tag.id)
    const unitSearchConditions = [
        ilike(inventoryUnits.serialNumber, likePattern),
        matchedProductIds.length > 0 ? inArray(inventoryUnits.productId, matchedProductIds) : undefined,
        matchedTagIds.length > 0 ? inArray(inventoryUnits.currentTagId, matchedTagIds) : undefined,
    ].filter(Boolean)

    const unitWhere =
        unitSearchConditions.length === 0
            ? undefined
            : unitSearchConditions.length === 1
                ? unitSearchConditions[0]
                : buildOrCondition(...unitSearchConditions)

    const matchedUnits = unitWhere
        ? await db.query.inventoryUnits.findMany({
            where: and(
                unitWhere,
                scopedWarehouseIds ? inArray(inventoryUnits.warehouseId, scopedWarehouseIds) : undefined,
            ),
            with: {
                product: true,
                warehouse: true,
                zone: true,
                currentTag: true,
            },
            orderBy: [desc(inventoryUnits.updatedAt)],
            limit: 20,
        })
        : []

    const allTagIds = Array.from(new Set([
        ...matchedTagIds,
        ...matchedUnits.map((unit) => unit.currentTagId).filter((value): value is number => Boolean(value)),
    ]))
    const allUnitIds = Array.from(new Set(matchedUnits.map((unit) => unit.id)))

    const bindings = (allTagIds.length > 0 || allUnitIds.length > 0)
        ? await db.query.rfidTagBindings.findMany({
            where: buildOrCondition(
                allTagIds.length > 0 ? inArray(rfidTagBindings.rfidTagId, allTagIds) : undefined,
                allUnitIds.length > 0 ? inArray(rfidTagBindings.inventoryUnitId, allUnitIds) : undefined,
            ),
            with: {
                rfidTag: true,
                inventoryUnit: {
                    with: {
                        product: true,
                        warehouse: true,
                        zone: true,
                        currentTag: true,
                    },
                },
                boundByUser: true,
                unboundByUser: true,
            },
            orderBy: [desc(rfidTagBindings.boundAt)],
            limit: 40,
        })
        : []

    const relatedUnitIds = Array.from(new Set([
        ...allUnitIds,
        ...bindings.map((binding) => binding.inventoryUnitId),
    ]))
    const relatedTagIds = Array.from(new Set([
        ...allTagIds,
        ...bindings.map((binding) => binding.rfidTagId),
    ]))

    const [unitEvents, scanEvents, writeSessions, exceptions] = (relatedUnitIds.length > 0 || relatedTagIds.length > 0)
        ? await Promise.all([
            db.query.inventoryUnitEvents.findMany({
                where: buildOrCondition(
                    relatedUnitIds.length > 0 ? inArray(inventoryUnitEvents.inventoryUnitId, relatedUnitIds) : undefined,
                    relatedTagIds.length > 0 ? inArray(inventoryUnitEvents.rfidTagId, relatedTagIds) : undefined,
                ),
                with: {
                    inventoryUnit: {
                        with: {
                            product: true,
                            warehouse: true,
                            zone: true,
                            currentTag: true,
                        },
                    },
                    product: true,
                    warehouse: true,
                    zone: true,
                    rfidTag: true,
                    createdByUser: true,
                },
                orderBy: [desc(inventoryUnitEvents.createdAt)],
                limit: 60,
            }),
            db.query.rfidScanEvents.findMany({
                where: buildOrCondition(
                    relatedUnitIds.length > 0 ? inArray(rfidScanEvents.inventoryUnitId, relatedUnitIds) : undefined,
                    relatedTagIds.length > 0 ? inArray(rfidScanEvents.rfidTagId, relatedTagIds) : undefined,
                ),
                with: {
                    session: {
                        with: {
                            device: true,
                            warehouse: true,
                            zone: true,
                        },
                    },
                    rfidTag: true,
                    inventoryUnit: {
                        with: {
                            product: true,
                            warehouse: true,
                            zone: true,
                            currentTag: true,
                        },
                    },
                    product: true,
                    warehouse: true,
                    zone: true,
                },
                orderBy: [desc(rfidScanEvents.lastSeenAt)],
                limit: 60,
            }),
            db.query.rfidTagWriteSessions.findMany({
                where: buildOrCondition(
                    relatedUnitIds.length > 0 ? inArray(rfidTagWriteSessions.inventoryUnitId, relatedUnitIds) : undefined,
                    relatedTagIds.length > 0 ? inArray(rfidTagWriteSessions.rfidTagId, relatedTagIds) : undefined,
                ),
                with: {
                    device: true,
                    warehouse: true,
                    zone: true,
                    rfidTag: true,
                    inventoryUnit: {
                        with: {
                            product: true,
                            warehouse: true,
                            zone: true,
                            currentTag: true,
                        },
                    },
                    requestedByUser: true,
                },
                orderBy: [desc(rfidTagWriteSessions.updatedAt)],
                limit: 40,
            }),
            db.query.rfidExceptions.findMany({
                where: buildOrCondition(
                    relatedUnitIds.length > 0 ? inArray(rfidExceptions.inventoryUnitId, relatedUnitIds) : undefined,
                    relatedTagIds.length > 0 ? inArray(rfidExceptions.rfidTagId, relatedTagIds) : undefined,
                ),
                with: {
                    warehouse: true,
                    zone: true,
                    device: true,
                    product: true,
                    rfidTag: true,
                },
                orderBy: [desc(rfidExceptions.createdAt)],
                limit: 30,
            }),
        ])
        : [[], [], [], []]

    return {
        query: normalizedQuery,
        warehouseId: parsed.warehouseId ?? null,
        matchedTags,
        matchedUnits,
        bindings,
        unitEvents,
        scanEvents,
        writeSessions,
        exceptions,
    }
}

export async function getRfidMonitoringSummary(warehouseId?: number) {
    await getAuthenticatedSession("inventory", "view")

    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")
    const scopedWarehouseIds = buildWarehouseFilter(allowedWarehouseIds, warehouseId)

    if (scopedWarehouseIds === null) {
        return {
            totals: {
                activePilotWarehouses: 0,
                trackedUnits: 0,
                activeTags: 0,
                openExceptions: 0,
                openScanSessions: 0,
                pendingWriteSessions: 0,
            },
            warehouses: [],
            products: [],
            writerDevices: [],
            recentTags: [],
            recentWriteSessions: [],
            recentScanEvents: [],
            recentExceptions: [],
            recentSessions: [],
        }
    }

    const [pilotWarehousesCount, trackedUnitsCount, activeTagsCount, openExceptionsCount, openScanSessionsCount, pendingWriteSessionsCount, warehouseRows, productRows, writerDevicesRows, recentTagsRows, recentWriteSessions, recentScanEventsRows, recentExceptions, recentSessions] = await Promise.all([
        db.select({ count: sql<number>`count(*)` })
            .from(warehouseRfidSettings)
            .where(and(
                eq(warehouseRfidSettings.isEnabled, true),
                scopedWarehouseIds ? inArray(warehouseRfidSettings.warehouseId, scopedWarehouseIds) : undefined,
            )),
        db.select({ count: sql<number>`count(*)` })
            .from(inventoryUnits)
            .where(scopedWarehouseIds ? inArray(inventoryUnits.warehouseId, scopedWarehouseIds) : undefined),
        db.select({ count: sql<number>`count(*)` })
            .from(rfidTags)
            .where(and(
                eq(rfidTags.status, "active"),
                scopedWarehouseIds ? inArray(rfidTags.lastSeenWarehouseId, scopedWarehouseIds) : undefined,
            )),
        db.select({ count: sql<number>`count(*)` })
            .from(rfidExceptions)
            .where(and(
                eq(rfidExceptions.status, "open"),
                scopedWarehouseIds ? inArray(rfidExceptions.warehouseId, scopedWarehouseIds) : undefined,
            )),
        db.select({ count: sql<number>`count(*)` })
            .from(rfidScanSessions)
            .where(and(
                eq(rfidScanSessions.status, "open"),
                scopedWarehouseIds ? inArray(rfidScanSessions.warehouseId, scopedWarehouseIds) : undefined,
            )),
        db.select({ count: sql<number>`count(*)` })
            .from(rfidTagWriteSessions)
            .where(eq(rfidTagWriteSessions.status, "open")),
        db.query.warehouses.findMany({
            where: scopedWarehouseIds ? inArray(warehouses.id, scopedWarehouseIds) : undefined,
            orderBy: [warehouses.description, warehouses.sloc],
        }),
        db.query.products.findMany({
            columns: {
                id: true,
                materialNumber: true,
                materialDescription: true,
                category: true,
                defaultTrackingMode: true,
                serialRequired: true,
                rfidCapable: true,
            },
            orderBy: [products.category, products.materialNumber],
        }),
        db.query.rfidDevices.findMany({
            where: and(
                eq(rfidDevices.canWrite, true),
                eq(rfidDevices.isActive, true),
                scopedWarehouseIds
                    ? or(
                        inArray(rfidDevices.warehouseId, scopedWarehouseIds),
                        isNull(rfidDevices.warehouseId),
                    )
                    : undefined,
            ),
            with: {
                warehouse: true,
                zone: true,
            },
            orderBy: [rfidDevices.deviceName],
        }),
        db.query.rfidTags.findMany({
            where: scopedWarehouseIds ? inArray(rfidTags.lastSeenWarehouseId, scopedWarehouseIds) : undefined,
            with: {
                lastSeenWarehouse: true,
            },
            orderBy: [desc(rfidTags.updatedAt)],
            limit: 20,
        }),
        db.query.rfidTagWriteSessions.findMany({
            where: scopedWarehouseIds ? inArray(rfidTagWriteSessions.warehouseId, scopedWarehouseIds) : undefined,
            with: {
                warehouse: true,
                zone: true,
                device: true,
                rfidTag: true,
                inventoryUnit: {
                    with: {
                        product: true,
                    },
                },
            },
            orderBy: [desc(rfidTagWriteSessions.updatedAt)],
            limit: 20,
        }),
        db.query.rfidScanEvents.findMany({
            where: scopedWarehouseIds ? inArray(rfidScanEvents.warehouseId, scopedWarehouseIds) : undefined,
            with: {
                session: {
                    with: {
                        device: true,
                    },
                },
                rfidTag: true,
                inventoryUnit: true,
                product: true,
                warehouse: true,
                zone: true,
            },
            orderBy: [desc(rfidScanEvents.lastSeenAt)],
            limit: 20,
        }),
        db.query.rfidExceptions.findMany({
            where: and(
                eq(rfidExceptions.status, "open"),
                scopedWarehouseIds ? inArray(rfidExceptions.warehouseId, scopedWarehouseIds) : undefined,
            ),
            with: {
                warehouse: true,
                product: true,
                rfidTag: true,
            },
            orderBy: [desc(rfidExceptions.createdAt)],
            limit: 15,
        }),
        db.query.rfidScanSessions.findMany({
            where: scopedWarehouseIds ? inArray(rfidScanSessions.warehouseId, scopedWarehouseIds) : undefined,
            with: {
                warehouse: true,
                device: true,
                zone: true,
            },
            orderBy: [desc(rfidScanSessions.updatedAt)],
            limit: 15,
        }),
    ])

    return {
        totals: {
            activePilotWarehouses: Number(pilotWarehousesCount[0]?.count ?? 0),
            trackedUnits: Number(trackedUnitsCount[0]?.count ?? 0),
            activeTags: Number(activeTagsCount[0]?.count ?? 0),
            openExceptions: Number(openExceptionsCount[0]?.count ?? 0),
            openScanSessions: Number(openScanSessionsCount[0]?.count ?? 0),
            pendingWriteSessions: Number(pendingWriteSessionsCount[0]?.count ?? 0),
        },
        warehouses: warehouseRows,
        products: productRows,
        writerDevices: writerDevicesRows,
        recentTags: recentTagsRows,
        recentWriteSessions,
        recentScanEvents: recentScanEventsRows,
        recentExceptions,
        recentSessions,
    }
}

export async function getRfidExceptionCenterData(warehouseId?: number) {
    await getAuthenticatedSession("inventory", "view")

    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")
    const scopedWarehouseIds = buildWarehouseFilter(allowedWarehouseIds, warehouseId)

    if (scopedWarehouseIds === null) {
        return {
            totals: {
                total: 0,
                open: 0,
                investigating: 0,
                resolved: 0,
                ignored: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
            },
            warehouses: [],
            exceptions: [],
        }
    }

    const [warehouseRows, exceptionRows] = await Promise.all([
        db.query.warehouses.findMany({
            where: scopedWarehouseIds ? inArray(warehouses.id, scopedWarehouseIds) : undefined,
            orderBy: [warehouses.description, warehouses.sloc],
        }),
        db.query.rfidExceptions.findMany({
            where: scopedWarehouseIds ? inArray(rfidExceptions.warehouseId, scopedWarehouseIds) : undefined,
            with: {
                warehouse: true,
                zone: true,
                device: true,
                session: {
                    with: {
                        device: true,
                        warehouse: true,
                    },
                },
                inventoryUnit: {
                    with: {
                        product: true,
                        warehouse: true,
                        zone: true,
                        currentTag: true,
                    },
                },
                product: true,
                rfidTag: true,
                resolvedByUser: true,
            },
            orderBy: [desc(rfidExceptions.createdAt)],
            limit: 300,
        }),
    ])

    return {
        totals: {
            total: exceptionRows.length,
            open: exceptionRows.filter((item) => item.status === "open").length,
            investigating: exceptionRows.filter((item) => item.status === "investigating").length,
            resolved: exceptionRows.filter((item) => item.status === "resolved").length,
            ignored: exceptionRows.filter((item) => item.status === "ignored").length,
            critical: exceptionRows.filter((item) => item.severity === "critical").length,
            high: exceptionRows.filter((item) => item.severity === "high").length,
            medium: exceptionRows.filter((item) => item.severity === "medium").length,
            low: exceptionRows.filter((item) => item.severity === "low").length,
        },
        warehouses: warehouseRows,
        exceptions: exceptionRows,
        statusOptions: rfidExceptionStatusSchema.options,
    }
}

export async function updateRfidExceptionStatus(
    data: Parameters<typeof rfidExceptionStatusUpdateSchema.parse>[0],
) {
    const parsed = rfidExceptionStatusUpdateSchema.parse(data)
    const session = await getAuthenticatedSession("inventory", "edit")

    const exception = await db.query.rfidExceptions.findFirst({
        where: eq(rfidExceptions.id, parsed.exceptionId),
        columns: {
            id: true,
            warehouseId: true,
            status: true,
            notes: true,
            metadata: true,
        },
    })

    if (!exception) {
        return { success: false, error: "RFID exception tidak ditemukan" }
    }

    if (exception.warehouseId) {
        await assertCurrentUserHasWarehouseAccess(exception.warehouseId, "edit")
    }

    const now = new Date()
    const normalizedReviewNote = normalizeNullableText(parsed.reviewNote)
    const existingMetadata = typeof exception.metadata === "object" && exception.metadata !== null
        ? exception.metadata
        : {}
    const reviewHistory = Array.isArray(existingMetadata.reviewHistory)
        ? existingMetadata.reviewHistory
        : []

    await db.update(rfidExceptions)
        .set({
            status: parsed.status,
            resolvedBy: parsed.status === "resolved" || parsed.status === "ignored" ? session.user.id : null,
            resolvedAt: parsed.status === "resolved" || parsed.status === "ignored" ? now : null,
            updatedAt: now,
            metadata: {
                ...existingMetadata,
                lastReviewNote: normalizedReviewNote,
                reviewHistory: [
                    ...reviewHistory,
                    {
                        previousStatus: exception.status,
                        nextStatus: parsed.status,
                        note: normalizedReviewNote,
                        updatedBy: session.user.id,
                        updatedAt: now.toISOString(),
                    },
                ],
            },
        })
        .where(eq(rfidExceptions.id, parsed.exceptionId))

    revalidateRfidMonitoringSurfaces()

    return {
        success: true,
        status: parsed.status,
    }
}

export async function saveRfidTagMonitoringData(
    data: Parameters<typeof rfidMonitoringTagSchema.parse>[0],
) {
    const parsed = rfidMonitoringTagSchema.parse(data)
    const session = await getAuthenticatedSession()
    await assertCurrentUserHasWarehouseAccess(parsed.warehouseId, "edit")

    const normalizedEpc = normalizeUpperText(parsed.epc)
    if (!normalizedEpc) {
        return { success: false, error: "EPC wajib diisi" }
    }

    const normalizedTid = normalizeUpperText(parsed.tid)
    const normalizedTagSerial = normalizeNullableText(parsed.tagSerial)
    const normalizedTagType = normalizeNullableText(parsed.tagType) ?? "label"
    const normalizedMaterialNumber = normalizeUpperText(parsed.materialNumber)
    const normalizedSerialNumber = normalizeUpperText(parsed.serialNumber)
    const normalizedNotes = normalizeNullableText(parsed.notes)

    return db.transaction(async (tx) => {
        const writerDevice = parsed.deviceId
            ? await tx.query.rfidDevices.findFirst({
                where: eq(rfidDevices.id, parsed.deviceId),
                columns: {
                    id: true,
                    warehouseId: true,
                    zoneId: true,
                    canWrite: true,
                    deviceName: true,
                },
            })
            : null

        if (parsed.deviceId && !writerDevice) {
            return { success: false, error: "RFID reader tidak ditemukan" }
        }

        if (writerDevice?.warehouseId && writerDevice.warehouseId !== parsed.warehouseId) {
            return { success: false, error: "RFID reader tidak sesuai dengan warehouse yang dipilih" }
        }

        if (writerDevice && !writerDevice.canWrite) {
            return { success: false, error: "RFID reader yang dipilih belum diizinkan untuk menulis tag" }
        }

        const tagById = parsed.rfidTagId
            ? await tx.query.rfidTags.findFirst({
                where: eq(rfidTags.id, parsed.rfidTagId),
                columns: {
                    id: true,
                    epc: true,
                },
            })
            : null

        if (parsed.rfidTagId && !tagById) {
            return { success: false, error: "RFID tag tidak ditemukan" }
        }

        const conflictingTag = await tx.query.rfidTags.findFirst({
            where: eq(rfidTags.epc, normalizedEpc),
            columns: {
                id: true,
            },
        })

        if (conflictingTag && conflictingTag.id !== tagById?.id) {
            return { success: false, error: "EPC sudah terdaftar pada tag lain" }
        }

        const now = new Date()
        const tagPayload = {
            epc: normalizedEpc,
            tid: normalizedTid,
            tagSerial: normalizedTagSerial,
            tagType: normalizedTagType,
            status: parsed.status,
            isReusable: parsed.isReusable,
            memoryMaterialNumber: normalizedMaterialNumber,
            memorySerialNumber: normalizedSerialNumber,
            lastSeenWarehouseId: parsed.warehouseId,
            lastSeenAt: now,
            notes: normalizedNotes,
            updatedAt: now,
        } as const

        const persistedTag = tagById
            ? await tx.update(rfidTags)
                .set(tagPayload)
                .where(eq(rfidTags.id, tagById.id))
                .returning({
                    id: rfidTags.id,
                    epc: rfidTags.epc,
                })
            : await tx.insert(rfidTags)
                .values(tagPayload)
                .returning({
                    id: rfidTags.id,
                    epc: rfidTags.epc,
                })

        const savedTag = persistedTag[0]
        const writeOperation = tagById ? "verify" : "register"

        await tx.insert(rfidTagWriteSessions).values({
            deviceId: writerDevice?.id ?? null,
            warehouseId: parsed.warehouseId,
            zoneId: writerDevice?.zoneId ?? null,
            rfidTagId: savedTag.id,
            operationType: writeOperation,
            status: "completed",
            materialNumber: normalizedMaterialNumber,
            serialNumber: normalizedSerialNumber,
            payload: {
                epc: normalizedEpc,
                tid: normalizedTid,
                tagSerial: normalizedTagSerial,
                tagType: normalizedTagType,
                status: parsed.status,
                isReusable: parsed.isReusable,
                materialNumber: normalizedMaterialNumber,
                serialNumber: normalizedSerialNumber,
            },
            requestedBy: session.user.id,
            executedAt: now,
            verifiedAt: now,
            notes: normalizedNotes,
        })

        revalidateRfidMonitoringSurfaces()

        return {
            success: true,
            tagId: savedTag.id,
            epc: savedTag.epc,
            operationType: writeOperation,
        }
    })
}

export async function resetRfidTagViaReader(
    data: Parameters<typeof rfidReaderResetSchema.parse>[0],
) {
    const parsed = rfidReaderResetSchema.parse(data)
    const session = await getAuthenticatedSession()
    await assertCurrentUserHasWarehouseAccess(parsed.warehouseId, "edit")

    return db.transaction(async (tx) => {
        const tag = await tx.query.rfidTags.findFirst({
            where: eq(rfidTags.id, parsed.rfidTagId),
            columns: {
                id: true,
                epc: true,
                status: true,
                memoryMaterialNumber: true,
                memorySerialNumber: true,
                notes: true,
            },
        })

        if (!tag) {
            return { success: false, error: "RFID tag tidak ditemukan" }
        }

        const writerDevice = parsed.deviceId
            ? await tx.query.rfidDevices.findFirst({
                where: eq(rfidDevices.id, parsed.deviceId),
                columns: {
                    id: true,
                    warehouseId: true,
                    zoneId: true,
                    canWrite: true,
                    canReset: true,
                },
            })
            : null

        if (parsed.deviceId && !writerDevice) {
            return { success: false, error: "RFID reader tidak ditemukan" }
        }

        if (writerDevice?.warehouseId && writerDevice.warehouseId !== parsed.warehouseId) {
            return { success: false, error: "RFID reader tidak sesuai dengan warehouse yang dipilih" }
        }

        if (writerDevice && !writerDevice.canReset && !writerDevice.canWrite) {
            return { success: false, error: "RFID reader yang dipilih belum diizinkan untuk reset tag" }
        }

        const linkedUnits = await tx.query.inventoryUnits.findMany({
            where: eq(inventoryUnits.currentTagId, tag.id),
            columns: {
                id: true,
                productId: true,
                warehouseId: true,
                zoneId: true,
                status: true,
            },
        })

        const now = new Date()
        const normalizedNotes = normalizeNullableText(parsed.notes)

        if (linkedUnits.length > 0) {
            for (const unit of linkedUnits) {
                await tx.update(inventoryUnits)
                    .set({
                        currentTagId: null,
                        status: isTerminalInventoryUnitStatus(unit.status) ? unit.status : "awaiting_tagging",
                        updatedAt: now,
                        lastMovementAt: now,
                    })
                    .where(eq(inventoryUnits.id, unit.id))

                await tx.insert(inventoryUnitEvents).values({
                    inventoryUnitId: unit.id,
                    productId: unit.productId,
                    warehouseId: unit.warehouseId,
                    zoneId: unit.zoneId,
                    rfidTagId: tag.id,
                    operationType: "reset_tag",
                    captureMethod: "rfid_reader",
                    referenceNumber: tag.epc,
                    notes: normalizedNotes ?? "Tag dikosongkan melalui RFID Monitoring",
                    metadata: {
                        previousTagStatus: tag.status,
                        previousMaterialNumber: tag.memoryMaterialNumber,
                        previousSerialNumber: tag.memorySerialNumber,
                    },
                    createdBy: session.user.id,
                })
            }
        }

        await tx.update(rfidTagBindings)
            .set({
                status: "unbound",
                unboundBy: session.user.id,
                unboundAt: now,
                updatedAt: now,
                notes: normalizedNotes ?? "Binding dilepas karena tag dikosongkan via RFID Monitoring",
            })
            .where(and(
                eq(rfidTagBindings.rfidTagId, tag.id),
                eq(rfidTagBindings.status, "active"),
            ))

        await tx.update(rfidTags)
            .set({
                status: "blank",
                memoryMaterialNumber: null,
                memorySerialNumber: null,
                lastSeenWarehouseId: parsed.warehouseId,
                lastSeenAt: now,
                notes: normalizedNotes ?? tag.notes,
                updatedAt: now,
            })
            .where(eq(rfidTags.id, tag.id))

        await tx.insert(rfidTagWriteSessions).values({
            deviceId: writerDevice?.id ?? null,
            warehouseId: parsed.warehouseId,
            zoneId: writerDevice?.zoneId ?? null,
            rfidTagId: tag.id,
            operationType: "reset",
            status: "completed",
            materialNumber: tag.memoryMaterialNumber,
            serialNumber: tag.memorySerialNumber,
            payload: {
                epc: tag.epc,
                previousStatus: tag.status,
                previousMaterialNumber: tag.memoryMaterialNumber,
                previousSerialNumber: tag.memorySerialNumber,
                resetBy: session.user.id,
            },
            requestedBy: session.user.id,
            executedAt: now,
            verifiedAt: now,
            notes: normalizedNotes,
        })

        revalidateRfidMonitoringSurfaces()

        return {
            success: true,
            tagId: tag.id,
            epc: tag.epc,
            affectedUnits: linkedUnits.length,
        }
    })
}

export async function manageRfidTagBinding(
    data: Parameters<typeof rfidTagUnitBindingSchema.parse>[0],
) {
    const parsed = rfidTagUnitBindingSchema.parse(data)
    const session = await getAuthenticatedSession()
    await assertCurrentUserHasWarehouseAccess(parsed.warehouseId, "edit")

    const normalizedSerialNumber = normalizeUpperText(parsed.serialNumber)
    const normalizedNotes = normalizeNullableText(parsed.notes)
    const trackingDecision = parsed.productId
        ? await resolveTrackingDecisionForProduct(parsed.warehouseId, parsed.productId)
        : null

    return db.transaction(async (tx) => {
        const tag = await tx.query.rfidTags.findFirst({
            where: eq(rfidTags.id, parsed.rfidTagId),
            columns: {
                id: true,
                epc: true,
                status: true,
                isReusable: true,
                memoryMaterialNumber: true,
                memorySerialNumber: true,
                notes: true,
            },
        })

        if (!tag) {
            return { success: false, error: "RFID tag tidak ditemukan" }
        }

        const writerDevice = parsed.deviceId
            ? await tx.query.rfidDevices.findFirst({
                where: eq(rfidDevices.id, parsed.deviceId),
                columns: {
                    id: true,
                    warehouseId: true,
                    zoneId: true,
                    canWrite: true,
                    deviceName: true,
                },
            })
            : null

        if (parsed.deviceId && !writerDevice) {
            return { success: false, error: "RFID reader tidak ditemukan" }
        }

        if (writerDevice?.warehouseId && writerDevice.warehouseId !== parsed.warehouseId) {
            return { success: false, error: "RFID reader tidak sesuai dengan warehouse yang dipilih" }
        }

        if (writerDevice && !writerDevice.canWrite) {
            return { success: false, error: "RFID reader yang dipilih belum diizinkan untuk menulis tag" }
        }

        const activeBindingForTag = await tx.query.rfidTagBindings.findFirst({
            where: and(
                eq(rfidTagBindings.rfidTagId, tag.id),
                eq(rfidTagBindings.status, "active"),
            ),
            with: {
                inventoryUnit: {
                    columns: {
                        id: true,
                        productId: true,
                        warehouseId: true,
                        zoneId: true,
                        serialNumber: true,
                        currentTagId: true,
                        status: true,
                    },
                },
            },
        })

        const now = new Date()

        if (parsed.operation === "unbind") {
            if (!activeBindingForTag?.inventoryUnit) {
                return { success: false, error: "Tag ini belum punya binding aktif" }
            }

            const targetUnit = activeBindingForTag.inventoryUnit

            await tx.update(rfidTagBindings)
                .set({
                    status: "unbound",
                    unboundBy: session.user.id,
                    unboundAt: now,
                    updatedAt: now,
                    notes: normalizedNotes ?? "Binding dilepas dari RFID Monitoring",
                })
                .where(eq(rfidTagBindings.id, activeBindingForTag.id))

            if (targetUnit.currentTagId === tag.id) {
                await tx.update(inventoryUnits)
                    .set({
                        currentTagId: null,
                        status: isTerminalInventoryUnitStatus(targetUnit.status) ? targetUnit.status : "awaiting_tagging",
                        updatedAt: now,
                        lastMovementAt: now,
                        notes: normalizedNotes ?? undefined,
                    })
                    .where(eq(inventoryUnits.id, targetUnit.id))
            }

            await tx.insert(inventoryUnitEvents).values({
                inventoryUnitId: targetUnit.id,
                productId: targetUnit.productId,
                warehouseId: targetUnit.warehouseId,
                zoneId: targetUnit.zoneId,
                rfidTagId: tag.id,
                operationType: "reset_tag",
                captureMethod: "manual",
                referenceNumber: tag.epc,
                notes: normalizedNotes ?? "Binding tag dilepas tanpa reset fisik tag",
                metadata: {
                    action: "unbind_only",
                    previousSerialNumber: targetUnit.serialNumber,
                    previousTagEpc: tag.epc,
                },
                createdBy: session.user.id,
            })

            await tx.insert(rfidTagWriteSessions).values({
                deviceId: writerDevice?.id ?? null,
                warehouseId: parsed.warehouseId,
                zoneId: writerDevice?.zoneId ?? null,
                rfidTagId: tag.id,
                inventoryUnitId: targetUnit.id,
                operationType: "unbind",
                status: "completed",
                materialNumber: tag.memoryMaterialNumber,
                serialNumber: targetUnit.serialNumber ?? tag.memorySerialNumber,
                payload: {
                    epc: tag.epc,
                    action: "unbind_only",
                    inventoryUnitId: targetUnit.id,
                },
                requestedBy: session.user.id,
                executedAt: now,
                verifiedAt: now,
                notes: normalizedNotes,
            })

            revalidateRfidMonitoringSurfaces()

            return {
                success: true,
                operation: "unbind",
                unitId: targetUnit.id,
                serialNumber: targetUnit.serialNumber,
                epc: tag.epc,
            }
        }

        if (!parsed.productId || !trackingDecision) {
            return { success: false, error: "Product tidak valid untuk operasi binding" }
        }

        const product = await tx.query.products.findFirst({
            where: eq(products.id, parsed.productId),
            columns: {
                id: true,
                materialNumber: true,
                materialDescription: true,
                defaultTrackingMode: true,
                serialRequired: true,
                rfidCapable: true,
            },
        })

        if (!product) {
            return { success: false, error: "Product tidak ditemukan" }
        }

        if (!normalizedSerialNumber) {
            return { success: false, error: "Serial number / unit ID wajib diisi" }
        }

        const effectiveTrackingMode = trackingDecision.trackingMode === "manual_only"
            ? "optional_rfid"
            : trackingDecision.trackingMode

        let targetUnit = await tx.query.inventoryUnits.findFirst({
            where: eq(inventoryUnits.serialNumber, normalizedSerialNumber),
            columns: {
                id: true,
                productId: true,
                warehouseId: true,
                zoneId: true,
                serialNumber: true,
                currentTagId: true,
                trackingMode: true,
                status: true,
            },
        })

        if (targetUnit && targetUnit.productId !== product.id) {
            return {
                success: false,
                error: "Serial number sudah dipakai oleh product lain. Cek ulang serial atau gunakan unit yang benar.",
            }
        }

        if (targetUnit && targetUnit.warehouseId !== parsed.warehouseId) {
            return {
                success: false,
                error: "Serial number ini terdaftar di warehouse lain. Gunakan warehouse yang sesuai atau pindahkan unit dulu.",
            }
        }

        if (activeBindingForTag?.inventoryUnit && activeBindingForTag.inventoryUnit.id !== targetUnit?.id) {
            return {
                success: false,
                error: `Tag ${tag.epc} masih aktif di unit ${activeBindingForTag.inventoryUnit.serialNumber || `#${activeBindingForTag.inventoryUnit.id}`}. Lepas binding lama dulu sebelum dipakai lagi.`,
            }
        }

        if (!targetUnit) {
            const createdUnits = await tx.insert(inventoryUnits)
                .values({
                    productId: product.id,
                    warehouseId: parsed.warehouseId,
                    zoneId: writerDevice?.zoneId ?? null,
                    serialNumber: normalizedSerialNumber,
                    currentTagId: null,
                    trackingMode: effectiveTrackingMode,
                    status: "in_stock",
                    lastMovementAt: now,
                    notes: normalizedNotes,
                })
                .returning({
                    id: inventoryUnits.id,
                    productId: inventoryUnits.productId,
                    warehouseId: inventoryUnits.warehouseId,
                    zoneId: inventoryUnits.zoneId,
                    serialNumber: inventoryUnits.serialNumber,
                    currentTagId: inventoryUnits.currentTagId,
                    trackingMode: inventoryUnits.trackingMode,
                    status: inventoryUnits.status,
                })

            targetUnit = createdUnits[0]
        }

        const previousTagId = targetUnit.currentTagId
        const replacingExistingTag = Boolean(previousTagId && previousTagId !== tag.id)

        if (replacingExistingTag && parsed.operation !== "replace") {
            return {
                success: false,
                error: "Unit ini sudah punya tag aktif. Gunakan mode replace untuk mengganti tag lama.",
            }
        }

        if (!replacingExistingTag && parsed.operation === "replace") {
            return {
                success: false,
                error: "Unit ini belum punya tag aktif untuk diganti. Gunakan bind untuk memasang tag pertama.",
            }
        }

        if (replacingExistingTag && previousTagId) {
            await tx.update(rfidTagBindings)
                .set({
                    status: "replaced",
                    unboundBy: session.user.id,
                    unboundAt: now,
                    updatedAt: now,
                    notes: normalizedNotes ?? "Binding lama diganti melalui RFID Monitoring",
                })
                .where(and(
                    eq(rfidTagBindings.rfidTagId, previousTagId),
                    eq(rfidTagBindings.inventoryUnitId, targetUnit.id),
                    eq(rfidTagBindings.status, "active"),
                ))
        }

        await tx.update(inventoryUnits)
            .set({
                productId: product.id,
                warehouseId: parsed.warehouseId,
                zoneId: writerDevice?.zoneId ?? targetUnit.zoneId ?? null,
                serialNumber: normalizedSerialNumber,
                currentTagId: tag.id,
                trackingMode: effectiveTrackingMode,
                status: isTerminalInventoryUnitStatus(targetUnit.status) ? targetUnit.status : "in_stock",
                updatedAt: now,
                lastMovementAt: now,
                notes: normalizedNotes ?? undefined,
            })
            .where(eq(inventoryUnits.id, targetUnit.id))

        const activeBinding = await tx.query.rfidTagBindings.findFirst({
            where: and(
                eq(rfidTagBindings.rfidTagId, tag.id),
                eq(rfidTagBindings.inventoryUnitId, targetUnit.id),
                eq(rfidTagBindings.status, "active"),
            ),
            columns: {
                id: true,
            },
        })

        if (!activeBinding) {
            await tx.insert(rfidTagBindings).values({
                rfidTagId: tag.id,
                inventoryUnitId: targetUnit.id,
                status: "active",
                writeOperation: parsed.operation === "replace" ? "replace" : "register",
                boundBy: session.user.id,
                boundAt: now,
                notes: normalizedNotes,
            })
        }

        await tx.update(rfidTags)
            .set({
                status: "active",
                memoryMaterialNumber: product.materialNumber,
                memorySerialNumber: normalizedSerialNumber,
                lastSeenWarehouseId: parsed.warehouseId,
                lastSeenAt: now,
                updatedAt: now,
                notes: normalizedNotes ?? tag.notes,
            })
            .where(eq(rfidTags.id, tag.id))

        await tx.insert(inventoryUnitEvents).values({
            inventoryUnitId: targetUnit.id,
            productId: product.id,
            warehouseId: parsed.warehouseId,
            zoneId: writerDevice?.zoneId ?? targetUnit.zoneId ?? null,
            rfidTagId: tag.id,
            operationType: parsed.operation === "replace" ? "replace_tag" : "register_tag",
            captureMethod: "manual",
            referenceNumber: tag.epc,
            notes: normalizedNotes ?? (parsed.operation === "replace"
                ? "Tag diganti melalui RFID Monitoring"
                : "Tag di-bind ke inventory unit melalui RFID Monitoring"),
            metadata: {
                materialNumber: product.materialNumber,
                serialNumber: normalizedSerialNumber,
                previousTagId,
                requestedOperation: parsed.operation,
                trackingMode: effectiveTrackingMode,
                trackingDecision,
            },
            createdBy: session.user.id,
        })

        await tx.insert(rfidTagWriteSessions).values({
            deviceId: writerDevice?.id ?? null,
            warehouseId: parsed.warehouseId,
            zoneId: writerDevice?.zoneId ?? targetUnit.zoneId ?? null,
            rfidTagId: tag.id,
            inventoryUnitId: targetUnit.id,
            operationType: parsed.operation === "replace" ? "replace" : "register",
            status: "completed",
            materialNumber: product.materialNumber,
            serialNumber: normalizedSerialNumber,
            payload: {
                epc: tag.epc,
                productId: product.id,
                materialNumber: product.materialNumber,
                serialNumber: normalizedSerialNumber,
                inventoryUnitId: targetUnit.id,
                requestedOperation: parsed.operation,
                previousTagId,
                trackingMode: effectiveTrackingMode,
            },
            requestedBy: session.user.id,
            executedAt: now,
            verifiedAt: now,
            notes: normalizedNotes,
        })

        revalidateRfidMonitoringSurfaces()

        return {
            success: true,
            operation: parsed.operation,
            unitId: targetUnit.id,
            serialNumber: normalizedSerialNumber,
            epc: tag.epc,
            materialNumber: product.materialNumber,
            replacedPreviousTag: replacingExistingTag,
        }
    })
}

export async function deleteRfidScanEvent(
    data: Parameters<typeof rfidScanEventDeletionSchema.parse>[0],
) {
    const parsed = rfidScanEventDeletionSchema.parse(data)
    await getAuthenticatedSession()

    const scanEvent = await db.query.rfidScanEvents.findFirst({
        where: eq(rfidScanEvents.id, parsed.scanEventId),
        with: {
            session: {
                columns: {
                    warehouseId: true,
                    sessionCode: true,
                },
            },
        },
    })

    if (!scanEvent) {
        return { success: false, error: "Scan RFID tidak ditemukan" }
    }

    const relatedWarehouseId = scanEvent.warehouseId ?? scanEvent.session?.warehouseId
    if (relatedWarehouseId) {
        await assertCurrentUserHasWarehouseAccess(relatedWarehouseId, "edit")
    }

    await db.delete(rfidScanEvents).where(eq(rfidScanEvents.id, parsed.scanEventId))

    revalidateRfidMonitoringSurfaces()

    return {
        success: true,
        sessionCode: scanEvent.session?.sessionCode ?? null,
        epc: scanEvent.epc,
    }
}
