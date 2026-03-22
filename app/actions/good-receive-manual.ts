"use server"

import { db } from "@/db"
import {
    goodReceiveManual,
    goodReceiveManualItems,
    inventoryUnitEvents,
    inventoryUnits,
    me2lPurchDocsSap,
    products,
    rfidExceptions,
    rfidTagBindings,
    rfidTags,
    stockLevels,
    warehouses,
} from "@/db/schema"
import { revalidatePath } from "next/cache"
import { eq, and, or, desc, inArray, isNotNull, ne, isNull } from "drizzle-orm"
import { recordStockMovement } from "./stock-movement"
import { getAuthenticatedSession } from "@/lib/rbac"
import { sendSystemTemplatedEmailByCode } from "@/lib/email"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"
import { resolveTrackingDecisionForProduct } from "@/lib/rfid-tracking"
import { assertCurrentUserHasWarehouseAccessForAll } from "@/lib/warehouse-access"

export type ManualGoodReceivePoOption = {
    poNumber: string
    vendorName: string
    poDate: string | null
    totalOpenQty: number
    itemCount: number
}

export type ManualGoodReceivePoLineOption = {
    poNumber: string
    vendorName: string
    poItem: number
    materialNumber: string
    materialDescription: string
    openQty: number
    productId: number | null
}

type Me2lRow = Awaited<ReturnType<typeof db.query.me2lPurchDocsSap.findMany>>[number]

function buildLatestPoItemMap(rows: Me2lRow[]) {
    const latestByPoItem = new Map<string, Me2lRow>()

    for (const row of rows) {
        const poNumber = row.purchasingDoc?.trim()
        const poItem = row.item
        if (!poNumber || !poItem) continue

        const key = `${poNumber}-${poItem}`
        if (!latestByPoItem.has(key)) {
            latestByPoItem.set(key, row)
        }
    }

    return latestByPoItem
}

function sanitizeOpenQty(orderQty: number | null, deliveredQty: number | null) {
    const openQty = Number(orderQty || 0) - Number(deliveredQty || 0)
    return openQty > 0 ? openQty : 0
}

const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
}

type ParsedRfidReceiptLine = {
    serialNumber: string
    epc: string
    tid: string | null
}

const normalizeUpperText = (value: string | null | undefined) => {
    const trimmed = value?.trim().toUpperCase()
    return trimmed ? trimmed : null
}

function parseRfidReceiptLines(value: unknown): ParsedRfidReceiptLine[] {
    if (typeof value !== "string") {
        return []
    }

    const lines = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

    return lines.map((line, index) => {
        const separator = line.includes("|") ? "|" : line.includes(";") ? ";" : ","
        const parts = line
            .split(separator)
            .map((entry) => entry.trim())
            .filter(Boolean)

        if (parts.length < 2) {
            throw new Error(`Format RFID line ke-${index + 1} tidak valid. Gunakan SERIAL|EPC atau SERIAL|EPC|TID`)
        }

        const serialNumber = normalizeUpperText(parts[0])
        const epc = normalizeUpperText(parts[1])
        const tid = normalizeUpperText(parts[2] ?? null)

        if (!serialNumber || !epc) {
            throw new Error(`Serial number dan EPC wajib diisi pada RFID line ke-${index + 1}`)
        }

        return {
            serialNumber,
            epc,
            tid,
        }
    })
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")

async function getNotificationRecipientEmails(roleNames: string[], userIds: string[]) {
    const normalizedRoleSet = new Set(
        roleNames
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean)
    )
    const userIdSet = new Set(userIds.map((entry) => entry.trim()).filter(Boolean))

    const users = await db.query.user.findMany({
        columns: {
            id: true,
            email: true,
            role: true,
        },
    })

    const recipients = users
        .filter((entry) => {
            const role = (entry.role ?? "").trim().toLowerCase()
            return userIdSet.has(entry.id) || normalizedRoleSet.has(role)
        })
        .map((entry) => entry.email?.trim() ?? "")
        .filter(Boolean)

    return Array.from(new Set(recipients))
}

function buildGoodReceiveManualNotificationContent(params: {
    poNumber: string
    supplier: string
    receiveDate: string
    deliveryType: "Partial" | "Complete"
    warehouseLabel: string
    referenceDocument?: string | null
    detailUrl: string
    items: Array<{
        poItem: number
        materialNumber: string
        materialDescription: string
        quantity: number
    }>
}) {
    const itemsTableRows = params.items.length > 0
        ? params.items
            .map((item, index) => `
                <tr>
                    <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${index + 1}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${item.poItem}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(item.materialNumber)}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(item.materialDescription)}</td>
                    <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${item.quantity.toLocaleString("id-ID")}</td>
                </tr>
            `)
            .join("")
        : `
            <tr>
                <td colspan="5" style="padding:10px;border:1px solid #e5e7eb;text-align:center;color:#6b7280;">
                    Tidak ada item quantity > 0.
                </td>
            </tr>
        `
    const itemsTextRows = params.items.length > 0
        ? params.items
            .map((item, index) => `${index + 1}. PO Item ${item.poItem} | ${item.materialNumber} - ${item.materialDescription} | Qty: ${item.quantity.toLocaleString("id-ID")}`)
            .join("\n")
        : "Tidak ada item quantity > 0."

    return {
        itemsTableRows,
        itemsTextRows,
    }
}

export async function getManualGoodReceivePoOptions() {
    try {
        const sapRows = await db.query.me2lPurchDocsSap.findMany({
            where: and(
                isNull(me2lPurchDocsSap.grProcessedDate),
                isNotNull(me2lPurchDocsSap.purchasingDoc),
                isNotNull(me2lPurchDocsSap.item),
                isNotNull(me2lPurchDocsSap.material),
                ne(me2lPurchDocsSap.material, ""),
                ne(me2lPurchDocsSap.material, "-")
            ),
            orderBy: [desc(me2lPurchDocsSap.docDate), desc(me2lPurchDocsSap.purchDocId)],
        })

        const latestByPoItem = buildLatestPoItemMap(sapRows)
        const latestRows = Array.from(latestByPoItem.values()).filter((row) =>
            sanitizeOpenQty(row.orderQty, row.deliveredQty) > 0
        )

        const materialNumbers = Array.from(new Set(
            latestRows
                .map((row) => row.material?.trim())
                .filter((material): material is string => Boolean(material))
        ))

        const internalProducts = materialNumbers.length > 0
            ? await db.select({
                id: products.id,
                materialNumber: products.materialNumber,
                oldMaterialNo: products.oldMaterialNo,
                materialNumberCk: products.materialNumberCk,
                sloc: products.sloc,
            })
                .from(products)
                .where(or(
                    inArray(products.materialNumber, materialNumbers),
                    inArray(products.oldMaterialNo, materialNumbers),
                    inArray(products.materialNumberCk, materialNumbers)
                ))
            : []

        const productByMaterialSloc = new Map<string, number>()
        const fallbackProductByMaterial = new Map<string, number>()
        const productByOldMaterialNo = new Map<string, number>()
        const productByMaterialNumberCk = new Map<string, number>()
        for (const product of internalProducts) {
            const material = product.materialNumber?.trim() || ""
            const sloc = product.sloc?.trim() || ""
            if (!material) continue

            const key = `${material}::${sloc}`
            if (!productByMaterialSloc.has(key)) {
                productByMaterialSloc.set(key, product.id)
            }
            if (!fallbackProductByMaterial.has(material)) {
                fallbackProductByMaterial.set(material, product.id)
            }

            const oldMaterialNo = product.oldMaterialNo?.trim() || ""
            if (oldMaterialNo && !productByOldMaterialNo.has(oldMaterialNo)) {
                productByOldMaterialNo.set(oldMaterialNo, product.id)
            }

            const materialNumberCk = product.materialNumberCk?.trim() || ""
            if (materialNumberCk && !productByMaterialNumberCk.has(materialNumberCk)) {
                productByMaterialNumberCk.set(materialNumberCk, product.id)
            }
        }

        const lineOptions: ManualGoodReceivePoLineOption[] = latestRows.map((row) => {
            const poNumber = row.purchasingDoc?.trim() || ""
            const poItem = row.item || 0
            const materialNumber = row.material?.trim() || ""
            const storageLoc = row.storageLoc?.trim() || ""
            const vendorName = row.vendorName?.trim() || "Unknown Vendor"
            const openQty = sanitizeOpenQty(row.orderQty, row.deliveredQty)
            const productId = productByMaterialSloc.get(`${materialNumber}::${storageLoc}`)
                ?? fallbackProductByMaterial.get(materialNumber)
                ?? productByOldMaterialNo.get(materialNumber)
                ?? productByMaterialNumberCk.get(materialNumber)
                ?? null

            return {
                poNumber,
                vendorName,
                poItem,
                materialNumber,
                materialDescription: row.shortText?.trim() || "-",
                openQty,
                productId,
            }
        }).sort((a, b) => {
            if (a.poNumber === b.poNumber) return a.poItem - b.poItem
            return a.poNumber.localeCompare(b.poNumber)
        })

        const poMap = new Map<string, ManualGoodReceivePoOption>()
        latestRows.forEach((row) => {
            const poNumber = row.purchasingDoc?.trim() || ""
            if (!poNumber) return

            const vendorName = row.vendorName?.trim() || "Unknown Vendor"
            const openQty = sanitizeOpenQty(row.orderQty, row.deliveredQty)
            const poDate = row.docDate ? String(row.docDate) : null

            const current = poMap.get(poNumber)
            if (!current) {
                poMap.set(poNumber, {
                    poNumber,
                    vendorName,
                    poDate,
                    totalOpenQty: openQty,
                    itemCount: 1,
                })
                return
            }

            current.itemCount += 1
            current.totalOpenQty += openQty
            if ((!current.vendorName || current.vendorName === "Unknown Vendor") && vendorName) {
                current.vendorName = vendorName
            }
            if (!current.poDate && poDate) {
                current.poDate = poDate
            }
        })

        const poOptions = Array.from(poMap.values()).sort((a, b) => {
            const aDate = a.poDate ? new Date(a.poDate).getTime() : 0
            const bDate = b.poDate ? new Date(b.poDate).getTime() : 0
            if (aDate !== bDate) return bDate - aDate
            return b.poNumber.localeCompare(a.poNumber)
        })

        return {
            success: true as const,
            data: {
                poOptions,
                poLineOptions: lineOptions,
            },
        }
    } catch (error) {
        console.error("Error fetching manual good receive PO options:", error)
        return {
            success: false as const,
            error: "Failed to load PO options",
        }
    }
}

export async function getGoodReceiveManualNotificationTargets() {
    await getAuthenticatedSession("good-receive-manual", "create")

    const users = await db.query.user.findMany({
        columns: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
        orderBy: (fields, { asc }) => [asc(fields.name), asc(fields.email)],
    })

    const roles = Array.from(
        new Set(
            users
                .map((entry) => entry.role?.trim() ?? "")
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b))

    return {
        roles,
        users: users.map((entry) => ({
            id: entry.id,
            name: entry.name,
            email: entry.email,
            role: entry.role,
        })),
    }
}

export type CreateGoodReceiveManualInput = {
    poNumber: string
    receiveDate: Date
    deliveryType: "Partial" | "Complete"
    referenceDocument?: string
    notifyRoles?: string[]
    notifyUserIds?: string[]
    items: {
        productId: number
        warehouseId: number
        quantity: number
        notes?: string
        rfidLines?: string
        manualOverrideReason?: string
    }[]
}

type ManualGoodReceiveNotificationPayload = {
    poNumber: string
    supplier: string
    receiveDate: string
    deliveryType: "Partial" | "Complete"
    referenceDocument: string | null | undefined
    warehouseLabel: string
    items: Array<{
        materialNumber: string
        materialDescription: string
        quantity: number
    }>
}

export async function createGoodReceiveManual(input: CreateGoodReceiveManualInput) {
    try {
        const session = await getAuthenticatedSession('good-receive-manual', 'create')
        const userId = session.user.id
        const notifyRoles = normalizeStringArray(input.notifyRoles)
        const notifyUserIds = normalizeStringArray(input.notifyUserIds)
        const poNumber = input.poNumber.trim()
        if (!poNumber) {
            throw new Error("PO Number is required")
        }

        const positiveItems = input.items.filter((item) => Number(item.quantity) > 0)
        if (positiveItems.length === 0) {
            throw new Error("Minimal satu item harus memiliki quantity > 0")
        }

        const warehouseIds = Array.from(new Set(
            positiveItems
                .map((item) => Number(item.warehouseId))
                .filter((warehouseId) => Number.isInteger(warehouseId) && warehouseId > 0),
        ))

        if (warehouseIds.length === 0) {
            throw new Error("Warehouse wajib dipilih")
        }

        await assertCurrentUserHasWarehouseAccessForAll(warehouseIds, "edit")

        const trackingDecisions = await Promise.all(
            positiveItems.map(async (item) => ({
                key: `${item.warehouseId}:${item.productId}`,
                decision: await resolveTrackingDecisionForProduct(item.warehouseId, item.productId),
            })),
        )

        const trackingDecisionByKey = new Map(
            trackingDecisions
                .filter((entry) => Boolean(entry.decision))
                .map((entry) => [entry.key, entry.decision!]),
        )

        const notificationPayload = await db.transaction<ManualGoodReceiveNotificationPayload>(async (tx) => {
            const productIds = Array.from(new Set(positiveItems.map((item) => item.productId)))

            const [existingProducts, warehouseRows] = await Promise.all([
                tx.select({
                    id: products.id,
                    materialNumber: products.materialNumber,
                    materialDescription: products.materialDescription,
                    defaultTrackingMode: products.defaultTrackingMode,
                    serialRequired: products.serialRequired,
                    rfidCapable: products.rfidCapable,
                })
                    .from(products)
                    .where(inArray(products.id, productIds)),
                tx.select({
                    id: warehouses.id,
                    sloc: warehouses.sloc,
                    description: warehouses.description,
                })
                    .from(warehouses)
                    .where(inArray(warehouses.id, warehouseIds)),
            ])

            const productById = new Map(existingProducts.map((product) => [product.id, product]))
            const warehouseById = new Map(warehouseRows.map((warehouse) => [warehouse.id, warehouse]))
            const resolvedItems = positiveItems.map((item) => {
                const product = productById.get(item.productId)
                const warehouse = warehouseById.get(item.warehouseId)

                if (!product) {
                    throw new Error(`Produk internal ${item.productId} tidak ditemukan`)
                }

                if (!warehouse) {
                    throw new Error(`Warehouse ${item.warehouseId} tidak ditemukan`)
                }

                const decision = trackingDecisionByKey.get(`${item.warehouseId}:${item.productId}`) ?? null
                const rfidLines = parseRfidReceiptLines(item.rfidLines)
                const manualOverrideReason = item.manualOverrideReason?.trim() || null

                if (rfidLines.length > item.quantity) {
                    throw new Error(`Jumlah RFID line untuk ${product.materialNumber} melebihi quantity penerimaan`)
                }

                if (decision?.trackingMode !== "manual_only" && decision?.serialRequired && rfidLines.length > 0 && rfidLines.length !== item.quantity) {
                    throw new Error(`Item ${product.materialNumber} membutuhkan 1 serial + EPC per quantity yang diterima`)
                }

                if (decision?.trackingMode === "required_rfid" && !decision.allowManualFallback && rfidLines.length === 0) {
                    throw new Error(`Item ${product.materialNumber} wajib ditag RFID saat goods receive`)
                }

                if (decision?.trackingMode !== "manual_only" && rfidLines.length === 0 && !manualOverrideReason) {
                    throw new Error(`Item ${product.materialNumber} belum ditag RFID. Isi alasan manual override / follow-up tagging.`)
                }

                const duplicateSerial = rfidLines.find(
                    (line, index) => rfidLines.findIndex((candidate) => candidate.serialNumber === line.serialNumber) !== index,
                )
                if (duplicateSerial) {
                    throw new Error(`Serial ${duplicateSerial.serialNumber} duplikat pada input RFID ${product.materialNumber}`)
                }

                const duplicateEpc = rfidLines.find(
                    (line, index) => rfidLines.findIndex((candidate) => candidate.epc === line.epc) !== index,
                )
                if (duplicateEpc) {
                    throw new Error(`EPC ${duplicateEpc.epc} duplikat pada input RFID ${product.materialNumber}`)
                }

                return {
                    ...item,
                    notes: item.notes?.trim() || null,
                    manualOverrideReason,
                    rfidLines,
                    product,
                    warehouse,
                    decision,
                }
            })

            const [header] = await tx.insert(goodReceiveManual).values({
                supplier: input.supplier.trim(),
                poNumber,
                receiveDate: input.receiveDate.toISOString(),
                deliveryType: input.deliveryType,
                referenceDocument: input.referenceDocument?.trim() || null,
            }).returning()

            for (const item of resolvedItems) {
                await tx.insert(goodReceiveManualItems).values({
                    headerId: header.id,
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    quantity: item.quantity,
                    notes: item.notes,
                })

                const existingStock = await tx.select()
                    .from(stockLevels)
                    .where(
                        and(
                            eq(stockLevels.productId, item.productId),
                            eq(stockLevels.warehouseId, item.warehouseId),
                        ),
                    )
                    .limit(1)

                if (existingStock.length > 0) {
                    await tx.update(stockLevels)
                        .set({
                            totalStock: existingStock[0].totalStock + item.quantity,
                            updatedAt: new Date(),
                        })
                        .where(eq(stockLevels.id, existingStock[0].id))
                } else {
                    await tx.insert(stockLevels).values({
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        totalStock: item.quantity,
                        bookedStock: 0,
                        minStock: 0,
                        valuationValue: "0",
                    })
                }

                await recordStockMovement(tx, {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    quantity: item.quantity,
                    type: "GR_MANUAL",
                    referenceNumber: `GR MANUAL: ${header.poNumber}`,
                    recordedBy: userId,
                })

                for (const rfidLine of item.rfidLines) {
                    const existingUnit = await tx.query.inventoryUnits.findFirst({
                        where: eq(inventoryUnits.serialNumber, rfidLine.serialNumber),
                        columns: {
                            id: true,
                            productId: true,
                            warehouseId: true,
                            currentTagId: true,
                            status: true,
                        },
                    })

                    if (existingUnit && existingUnit.productId !== item.productId) {
                        throw new Error(`Serial ${rfidLine.serialNumber} sudah terdaftar untuk product lain`)
                    }

                    if (existingUnit && existingUnit.currentTagId) {
                        throw new Error(`Serial ${rfidLine.serialNumber} sudah punya RFID tag aktif`)
                    }

                    let tag = await tx.query.rfidTags.findFirst({
                        where: eq(rfidTags.epc, rfidLine.epc),
                        columns: {
                            id: true,
                            epc: true,
                            status: true,
                        },
                    })

                    if (tag) {
                        const activeBinding = await tx.query.rfidTagBindings.findFirst({
                            where: and(
                                eq(rfidTagBindings.rfidTagId, tag.id),
                                eq(rfidTagBindings.status, "active"),
                            ),
                            columns: {
                                id: true,
                                inventoryUnitId: true,
                            },
                        })

                        if (activeBinding && activeBinding.inventoryUnitId !== existingUnit?.id) {
                            throw new Error(`Tag ${rfidLine.epc} masih aktif pada unit lain`)
                        }

                        await tx.update(rfidTags)
                            .set({
                                status: "active",
                                tid: rfidLine.tid,
                                memoryMaterialNumber: item.product.materialNumber,
                                memorySerialNumber: rfidLine.serialNumber,
                                lastSeenWarehouseId: item.warehouseId,
                                lastSeenAt: new Date(),
                                updatedAt: new Date(),
                            })
                            .where(eq(rfidTags.id, tag.id))
                    } else {
                        const createdTag = await tx.insert(rfidTags)
                            .values({
                                epc: rfidLine.epc,
                                tid: rfidLine.tid,
                                status: "active",
                                isReusable: false,
                                memoryMaterialNumber: item.product.materialNumber,
                                memorySerialNumber: rfidLine.serialNumber,
                                lastSeenWarehouseId: item.warehouseId,
                                lastSeenAt: new Date(),
                            })
                            .returning({
                                id: rfidTags.id,
                                epc: rfidTags.epc,
                                status: rfidTags.status,
                            })

                        tag = createdTag[0]
                    }

                    const inventoryUnit = existingUnit
                        ? (
                            await tx.update(inventoryUnits)
                                .set({
                                    productId: item.productId,
                                    warehouseId: item.warehouseId,
                                    serialNumber: rfidLine.serialNumber,
                                    currentTagId: tag.id,
                                    trackingMode: item.decision?.trackingMode ?? "optional_rfid",
                                    status: "received",
                                    lastMovementAt: new Date(),
                                    updatedAt: new Date(),
                                    notes: item.notes,
                                })
                                .where(eq(inventoryUnits.id, existingUnit.id))
                                .returning({
                                    id: inventoryUnits.id,
                                    serialNumber: inventoryUnits.serialNumber,
                                })
                        )[0]
                        : (
                            await tx.insert(inventoryUnits)
                                .values({
                                    productId: item.productId,
                                    warehouseId: item.warehouseId,
                                    serialNumber: rfidLine.serialNumber,
                                    currentTagId: tag.id,
                                    trackingMode: item.decision?.trackingMode ?? "optional_rfid",
                                    status: "received",
                                    originDocumentType: "good_receive_manual",
                                    originDocumentId: header.id,
                                    lastMovementAt: new Date(),
                                    notes: item.notes,
                                })
                                .returning({
                                    id: inventoryUnits.id,
                                    serialNumber: inventoryUnits.serialNumber,
                                })
                        )[0]

                    const existingBinding = await tx.query.rfidTagBindings.findFirst({
                        where: and(
                            eq(rfidTagBindings.rfidTagId, tag.id),
                            eq(rfidTagBindings.inventoryUnitId, inventoryUnit.id),
                            eq(rfidTagBindings.status, "active"),
                        ),
                        columns: {
                            id: true,
                        },
                    })

                    if (!existingBinding) {
                        await tx.insert(rfidTagBindings).values({
                            rfidTagId: tag.id,
                            inventoryUnitId: inventoryUnit.id,
                            status: "active",
                            writeOperation: "register",
                            boundBy: userId,
                            notes: `Bound from GR Manual ${header.poNumber}`,
                        })
                    }

                    await tx.insert(inventoryUnitEvents).values({
                        inventoryUnitId: inventoryUnit.id,
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        rfidTagId: tag.id,
                        operationType: "inbound",
                        documentType: "good_receive_manual",
                        documentId: header.id,
                        captureMethod: "manual",
                        referenceNumber: header.poNumber,
                        quantity: 1,
                        notes: item.notes ?? "Unit diterima melalui Good Receive Manual",
                        metadata: {
                            source: "good_receive_manual",
                            receiveDate: input.receiveDate.toISOString(),
                            deliveryType: input.deliveryType,
                        },
                        createdBy: userId,
                    })
                }

                const missingTagCount = item.quantity - item.rfidLines.length
                if (item.decision?.trackingMode !== "manual_only" && missingTagCount > 0) {
                    await tx.insert(rfidExceptions).values({
                        warehouseId: item.warehouseId,
                        productId: item.productId,
                        exceptionType: missingTagCount === item.quantity ? "gr_manual_missing_rfid" : "gr_manual_partial_rfid",
                        severity: item.decision.trackingMode === "required_rfid" ? "high" : "medium",
                        status: "open",
                        documentType: "good_receive_manual",
                        documentId: header.id,
                        referenceNumber: header.poNumber,
                        notes: item.manualOverrideReason ?? `Masih ada ${missingTagCount} unit menunggu tagging setelah GR manual`,
                        metadata: {
                            quantity: item.quantity,
                            taggedCount: item.rfidLines.length,
                            missingTagCount,
                            materialNumber: item.product.materialNumber,
                            trackingDecision: item.decision,
                        },
                    })
                }
            }

            const warehouseLabel = warehouseIds.length === 1
                ? (() => {
                    const warehouse = warehouseById.get(warehouseIds[0])
                    return warehouse?.sloc
                        ? `${warehouse.sloc}${warehouse.description ? ` - ${warehouse.description}` : ""}`
                        : "-"
                })()
                : `${warehouseIds.length} warehouse`

            return {
                poNumber,
                supplier: input.supplier.trim(),
                receiveDate: input.receiveDate.toISOString(),
                deliveryType: input.deliveryType,
                referenceDocument: input.referenceDocument,
                warehouseLabel,
                items: resolvedItems.map((item) => ({
                    materialNumber: item.product.materialNumber,
                    materialDescription: item.product.materialDescription || "-",
                    quantity: item.quantity,
                })),
            }
        })

        revalidatePath("/dashboard/good-receive-manual")
        revalidatePath("/dashboard/stocks")
        revalidatePath("/dashboard/stock-movements")
        revalidatePath("/dashboard/rfid-monitoring")
        revalidatePath("/dashboard/rfid-exceptions")
        revalidatePath("/dashboard/rfid-tagged-units")
        revalidatePath("/dashboard/rfid-traceability")

        let notificationResult: { sent: boolean; reason?: string; recipientCount?: number } | null = null
        if (notifyRoles.length > 0 || notifyUserIds.length > 0) {
            try {
                const payload = notificationPayload
                const recipients = await getNotificationRecipientEmails(notifyRoles, notifyUserIds)

                if (recipients.length > 0) {
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "")
                    const detailPath = "/dashboard/good-receive-manual"
                    const detailUrl = baseUrl ? `${baseUrl}${detailPath}` : detailPath
                    const receiveDateText = new Date(payload.receiveDate).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                    })
                    const { itemsTableRows, itemsTextRows } = buildGoodReceiveManualNotificationContent({
                        poNumber: payload.poNumber,
                        supplier: payload.supplier,
                        receiveDate: receiveDateText,
                        deliveryType: payload.deliveryType,
                        warehouseLabel: payload.warehouseLabel,
                        referenceDocument: payload.referenceDocument,
                        detailUrl,
                        items: payload.items,
                    })

                    const emailResult = await sendSystemTemplatedEmailByCode({
                        code: SYSTEM_EMAIL_TEMPLATE_CODES.goodReceiveManualNotification,
                        to: recipients,
                        data: {
                            poNumber: payload.poNumber,
                            supplier: payload.supplier,
                            receiveDate: receiveDateText,
                            deliveryType: payload.deliveryType,
                            warehouseLabel: payload.warehouseLabel,
                            referenceDocument: payload.referenceDocument?.trim() || "-",
                            detailUrl,
                            itemsTableRows,
                            itemsTextRows,
                        },
                    })

                    if (!emailResult.success) {
                        console.error("Failed to send GR manual notification:", emailResult.error)
                        notificationResult = { sent: false, reason: emailResult.error || "Gagal mengirim email", recipientCount: recipients.length }
                    } else {
                        notificationResult = { sent: true, recipientCount: recipients.length }
                    }
                } else {
                    notificationResult = { sent: false, reason: "Tidak ada penerima notifikasi yang cocok", recipientCount: 0 }
                }
            } catch (notificationError) {
                console.error("GR manual notification error:", notificationError)
                notificationResult = { sent: false, reason: "Terjadi error saat mengirim notifikasi email" }
            }
        }

        return { success: true, notification: notificationResult }
    } catch (error) {
        console.error("Error creating manual good receive:", error)
        return { success: false, error: "Failed to create good receive record" }
    }
}
