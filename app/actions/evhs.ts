"use server"

import { db } from "@/db"
import {
    evhsReceipts,
    evhsReceiptItems,
    evhsVouchers,
    evhsVoucherItems,
    evhsGiRecords,
    evhsGiItems,
    evhsMasterPrices,
    stockLevels,
    stockTransfers,
    warehouses,
    zmc9StockSap,
} from "@/db/schema"
import { eq, desc, sql, inArray, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getAuthenticatedSession, getPermissionsByRoleName } from "@/lib/rbac"
import {
    assertCurrentUserHasWarehouseAccess,
    assertCurrentUserHasWarehouseAccessForAll,
    getAllowedWarehouseIdsForCurrentUser,
    getWarehouseAccessContextForUserId,
} from "@/lib/warehouse-access"
import { findCkMasterPriceSuggestion, type CkMasterPriceReference } from "@/lib/ck-master-price"
import { recordStockMovement } from "@/app/actions/stock-movement"
import { syncStockTransferReceipt } from "@/app/actions/stock-transfer"
import { expandSlocLookupKeys, formatWarehouseLabel, normalizeSloc, normalizeSlocFields } from "@/lib/sloc"

// Schema for Receipt Confirmation
const _confirmReceiptSchema = z.object({
    transferId: z.number(),
    receivedDate: z.date(),
    doChitraNo: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(z.object({
        productId: z.number(),
        confirmedQty: z.number().min(0),
        serialNumbers: z.array(z.string()).optional(),
    })),
})

function normalizeSerialNumber(serialNumber?: string | null) {
    return serialNumber?.trim() || ""
}

type EvhsMatchedGiItem = {
    materialNumber: string
    qty?: number | string | null
    price?: number | string | null
}

type EvhsMatchedGiRecord = {
    id: number
    warehouseId: number | null
    documentNo: string | null
    woNo: string | null
    createdAt: Date | string
    items: EvhsMatchedGiItem[]
}

type EvhsMatchedVoucherItem = {
    id: number
    productId: number
    qty: number | string | null
    serialNumber: string | null
    materialNumberCk: string | null
    unitPrice?: string | null
    pos: string | null
    unitId: string | null
}

type EvhsMatchedVoucher = {
    id: number
    warehouseId: number | null
    woNo: string | null
    vhsNo: string
    status: string
    date: Date | string | null
    createdAt: Date
    updatedAt: Date
    settledDate: Date | null
    mrkoStatus: string | null
    sapInvoiceNo: string | null
    mrkoNo: string | null
    warehouse?: { id: number; sloc: string; description?: string | null; type?: string | null } | null
    issuedByUser?: { name: string | null } | null
    items: Array<EvhsMatchedVoucherItem & {
        product?: {
            materialNumber: string
            materialDescription?: string | null
        } | null
    }>
}

type EvhsTrackingRow = {
    id: string
    dateIn: Date | string | null
    cpDo: string | null
    materialNumberCp: string
    materialNumberCk: string | null
    sn: string
    qty: number
    receivedQty: number
    availableQty: number
    usedQty: number
    installDate: Date | string | null
    pos: string
    unitId: string
    voucherNo: string
    voucherId: number | null
    voucherItemId: number | null
    woNo: string | null
    giNumber: string
    mrko: string
    inv: string
    date: Date | string | null
    productId: number
    product: {
        materialNumber: string
        materialDescription?: string | null
        materialNumberCk?: string | null
        category?: string | null
    }
    warehouseId: number | null | undefined
    warehouse: { id: number; sloc: string; description?: string | null; type?: string | null } | null | undefined
}

function parseSerialNumbers(serialNumbers: string[] | string | null | undefined) {
    if (Array.isArray(serialNumbers)) {
        return serialNumbers.map(normalizeSerialNumber).filter(Boolean)
    }

    if (typeof serialNumbers === "string") {
        return serialNumbers
            .split(/[\n,]+/)
            .map(normalizeSerialNumber)
            .filter(Boolean)
    }

    return []
}

type EvhsVoucherPricingProduct = {
    id: number
    materialNumber: string
    materialNumberCk?: string | null
}

function normalizeEvhsPrice(value?: string | number | null) {
    if (value == null || value === "") {
        return null
    }

    const numericValue = typeof value === "number" ? value : Number(value)
    return Number.isFinite(numericValue) ? numericValue : null
}

function getEvhsVoucherItemUnitPrice(
    masterPrices: CkMasterPriceReference[],
    warehouseId: number,
    product: EvhsVoucherPricingProduct | undefined,
    materialNumberCkOverride?: string | null,
    existingUnitPrice?: string | number | null
) {
    const storedUnitPrice = normalizeEvhsPrice(existingUnitPrice)
    if (storedUnitPrice != null) {
        return storedUnitPrice
    }

    if (!product) {
        return null
    }

    const suggestion = findCkMasterPriceSuggestion({
        product: {
            materialNumber: product.materialNumber,
            materialNumberCk: materialNumberCkOverride || product.materialNumberCk,
        },
        warehouseId,
        masterPrices,
    })

    return suggestion?.unitPrice ?? null
}

function hasEvhsWarehouseAccess(allowedWarehouseIds: number[] | null, warehouseId: number | null | undefined) {
    if (!allowedWarehouseIds) {
        return true
    }

    return typeof warehouseId === "number" && allowedWarehouseIds.includes(warehouseId)
}

function filterEvhsReceiptRowsByWarehouse<
    T extends { transfer?: { toWarehouseId?: number | null } | null }
>(rows: T[], allowedWarehouseIds: number[] | null) {
    if (!allowedWarehouseIds) {
        return rows
    }

    return rows.filter((row) => hasEvhsWarehouseAccess(allowedWarehouseIds, row.transfer?.toWarehouseId))
}

/**
 * Get all E-VHS Receipts
 */
export async function getEvhsReceipts() {
    try {
        await getAuthenticatedSession('evhs', 'view')
        const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")

        if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
            return []
        }

        const receipts = await db.query.evhsReceipts.findMany({
            with: {
                transfer: {
                    with: {
                        fromWarehouse: true,
                        toWarehouse: true,
                    }
                },
                confirmedByUser: true,
                items: {
                    with: {
                        product: true
                    }
                },
            },
            orderBy: [desc(evhsReceipts.createdAt)],
        })

        return normalizeSlocFields(filterEvhsReceiptRowsByWarehouse(receipts, allowedWarehouseIds))
    } catch (error) {
        console.error("Error fetching E-VHS receipts:", error)
        return []
    }
}

/**
 * Get Stock Transfers that are not yet confirmed in E-VHS.
 * Fitur EVHS saat ini khusus CK / PT Cipta Kridatama. Karena beberapa
 * warehouse lama belum memiliki customerId, kita kenali warehouse CK dari metadata.
 */
export async function getPendingEvhsTransfers() {
    try {
        await getAuthenticatedSession('evhs', 'view')
        const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")

        if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
            return []
        }

        // Load transfers that have not been confirmed yet, then keep only CK EVHS
        // destination warehouses. Some historical VHS warehouses are missing customerId.
        const transfers = await db.query.stockTransfers.findMany({
            where: (transfers, { exists, and, eq, not }) => and(
                not(
                    exists(
                        db.select()
                          .from(evhsReceipts)
                          .where(eq(evhsReceipts.transferId, transfers.id))
                    )
                )
            ),
            with: {
                fromWarehouse: true,
                toWarehouse: true,
                items: {
                    with: {
                        product: true
                    }
                },
                delivery: {
                    columns: {
                        id: true,
                        deliveryNumber: true,
                        doSap: true,
                        scanDoDocument: true,
                        scheduledDate: true,
                        deliveryDate: true,
                        status: true,
                        deliveryType: true,
                        driverName: true,
                        vehicleNumber: true,
                        vehicleType: true,
                        shippingAddress: true,
                        isExternal: true,
                        awbNumber: true,
                        vendorName: true,
                        notes: true,
                    },
                    with: {
                        salesOrder: {
                            columns: {
                                id: true,
                                invoiceNumber: true,
                                customerPo: true,
                                poReceive: true,
                            },
                            with: {
                                customer: true,
                            },
                        },
                        warehouse: true,
                        createdByUser: {
                            columns: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                        items: {
                            with: {
                                product: true,
                            },
                        }
                    }
                }
            },
            orderBy: [desc(stockTransfers.createdAt)],
        })

        return normalizeSlocFields(transfers.filter((transfer) =>
            hasEvhsWarehouseAccess(allowedWarehouseIds, transfer.toWarehouseId) &&
            isEvhsDestinationWarehouse(transfer.toWarehouse)
        ))
    } catch (error) {
        console.error("Error fetching pending E-VHS transfers:", error)
        return []
    }
}

/**
 * Confirm receipt of E-VHS stock
 */
export async function confirmEvhsReceipt(data: z.infer<typeof _confirmReceiptSchema>) {
    try {
        const session = await getAuthenticatedSession('evhs', 'create')
        const userId = session.user.id
        const transfer = await db.query.stockTransfers.findFirst({
            where: eq(stockTransfers.id, data.transferId),
            columns: {
                id: true,
                toWarehouseId: true,
            },
        })

        if (!transfer?.toWarehouseId) {
            return { success: false, error: "Transfer tujuan tidak ditemukan" }
        }

        await assertCurrentUserHasWarehouseAccess(transfer.toWarehouseId, "edit")

        return await db.transaction(async (tx) => {
            const existingReceipt = await tx.query.evhsReceipts.findFirst({
                where: eq(evhsReceipts.transferId, data.transferId),
                columns: { id: true },
            })

            if (existingReceipt) {
                return {
                    success: false,
                    error: "Transfer ini sudah pernah dikonfirmasi di E-VHS.",
                }
            }

            // 1. Create Receipt Header
            const [receipt] = await tx.insert(evhsReceipts).values({
                transferId: data.transferId,
                receivedDate: data.receivedDate,
                doChitraNo: data.doChitraNo,
                confirmedBy: userId,
                notes: data.notes,
            }).returning()

            // 2. Create Receipt Items and update stock if necessary
            // (Note: stock usually already updated by stock-transfer.ts "Received" status)
            for (const item of data.items) {
                await tx.insert(evhsReceiptItems).values({
                    receiptId: receipt.id,
                    productId: item.productId,
                    confirmedQty: item.confirmedQty,
                    serialNumbers: item.serialNumbers,
                })
            }

            await syncStockTransferReceipt(tx, {
                transferId: data.transferId,
                userId,
                receivedItems: data.items.map((item) => ({
                    productId: item.productId,
                    quantity: item.confirmedQty,
                })),
            })

            return { success: true, receiptId: receipt.id }
        })
    } catch (error) {
        console.error("Error confirming E-VHS receipt:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to confirm receipt" }
    } finally {
        revalidatePath("/dashboard/evhs")
        revalidatePath("/dashboard/stock-transfers")
        revalidatePath("/dashboard/inventory")
        revalidatePath("/dashboard/stocks")
        revalidatePath("/dashboard/warehouse")
        revalidatePath("/dashboard/stock-movements")
    }
}

/**
 * Fitur 2 & 4: Create Voucher VHS
 */
const _voucherSchema = z.object({
    woNo: z.string().optional(),
    date: z.date(),
    warehouseId: z.number(),
    remark: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
    items: z.array(z.object({
        productId: z.number(),
        materialNumberCk: z.string().optional(),
        qty: z.number().min(1),
        serialNumber: z.string().optional(),
        sourceType: z.enum(["receipt", "legacy-stock"]).optional(),
        stockBalance: z.number().optional(),
        pos: z.string().optional(),
        unitId: z.string().optional(),
    })),
})

export async function createEvhsVoucher(data: z.infer<typeof _voucherSchema>) {
    try {
        const session = await getAuthenticatedSession('evhs', 'create')
        const userId = session.user.id
        await assertCurrentUserHasWarehouseAccess(data.warehouseId, "edit")

        // Generate VHS Number: VHS/CP/CK/YYYYMMDD-Random
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase()
        const vhsNo = `VHS/CP/CK/${dateStr}-${randomStr}`

        return await db.transaction(async (tx) => {
            const warehouse = await tx.query.warehouses.findFirst({
                where: eq(warehouses.id, data.warehouseId),
            })

            if (!isCkVhsWarehouse(warehouse)) {
                return {
                    success: false,
                    error: "Warehouse harus bertipe Warehouse VHS dan mengandung nama CK untuk proses EVHS PT Cipta Kridatama.",
                }
            }

            const requestedProductIds = Array.from(new Set(data.items.map(item => item.productId)))
            const warehouseReceipts = await tx.query.evhsReceipts.findMany({
                with: {
                    transfer: true,
                    items: true,
                },
            })

            const existingVouchers = await tx.query.evhsVouchers.findMany({
                where: eq(evhsVouchers.warehouseId, data.warehouseId),
                with: {
                    items: true,
                },
            })

            const legacyStockLevels = requestedProductIds.length > 0
                ? await tx.query.stockLevels.findMany({
                    where: (stockLevel, { and, eq, inArray }) => and(
                        eq(stockLevel.warehouseId, data.warehouseId),
                        inArray(stockLevel.productId, requestedProductIds),
                    ),
                    columns: {
                        productId: true,
                        totalStock: true,
                    },
                })
                : []

            const requestedProducts = requestedProductIds.length > 0
                ? await tx.query.products.findMany({
                    where: (product, { inArray }) => inArray(product.id, requestedProductIds),
                    columns: {
                        id: true,
                        category: true,
                        materialNumber: true,
                        materialNumberCk: true,
                    },
                })
                : []
            const requestedMaterialNumbers = Array.from(new Set(
                requestedProducts
                    .map((product) => product.materialNumber)
                    .filter(Boolean)
            ))
            const requestedMaterialNumbersCk = Array.from(new Set(
                [
                    ...requestedProducts.map((product) => product.materialNumberCk),
                    ...data.items.map((item) => item.materialNumberCk),
                ]
                    .filter((value): value is string => Boolean(value?.trim()))
            ))
            const masterPriceFilters = []

            if (requestedMaterialNumbers.length > 0) {
                masterPriceFilters.push(inArray(evhsMasterPrices.materialNumberCp, requestedMaterialNumbers))
            }

            if (requestedMaterialNumbersCk.length > 0) {
                masterPriceFilters.push(inArray(evhsMasterPrices.materialNumberCk, requestedMaterialNumbersCk))
            }

            const relevantMasterPrices = masterPriceFilters.length > 0
                ? await tx.query.evhsMasterPrices.findMany({
                    where: masterPriceFilters.length === 1
                        ? masterPriceFilters[0]
                        : or(...masterPriceFilters),
                    columns: {
                        warehouseId: true,
                        materialNumberCp: true,
                        materialNumberCk: true,
                        price: true,
                    },
                })
                : []

            const requestedQtyByProduct = new Map<number, number>()
            const requestedSerials = new Set<string>()
            const legacyStockByProduct = new Map<number, number>(
                legacyStockLevels.map((stockLevel) => [stockLevel.productId, Number(stockLevel.totalStock || 0)])
            )
            const productById = new Map<number, { id: number; category: string; materialNumber: string; materialNumberCk?: string | null }>(
                requestedProducts.map((product) => [
                    product.id,
                    {
                        id: product.id,
                        category: product.category,
                        materialNumber: product.materialNumber,
                        materialNumberCk: product.materialNumberCk,
                    }
                ])
            )

            for (const item of data.items) {
                const productMeta = productById.get(item.productId)
                const relevantReceiptItems = warehouseReceipts
                    .filter(receipt => receipt.transfer?.toWarehouseId === data.warehouseId)
                    .flatMap(receipt => receipt.items)
                    .filter(receiptItem => receiptItem.productId === item.productId)

                const receivedQty = relevantReceiptItems.reduce((total, receiptItem) => total + receiptItem.confirmedQty, 0)
                const usedQty = existingVouchers
                    .flatMap(voucher => voucher.items)
                    .filter(voucherItem => voucherItem.productId === item.productId)
                    .reduce((total, voucherItem) => total + voucherItem.qty, 0)

                const warehouseStockQty = legacyStockByProduct.get(item.productId)
                const availableQty = warehouseStockQty !== undefined
                    ? Math.max(warehouseStockQty - usedQty, 0)
                    : Math.max(receivedQty - usedQty, 0)
                const normalizedSerial = normalizeSerialNumber(item.serialNumber)
                const sourceType = item.sourceType || "receipt"
                const nextRequestedQty = (requestedQtyByProduct.get(item.productId) || 0) + item.qty

                if (
                    sourceType === "legacy-stock" &&
                    productMeta?.category?.toUpperCase() === "TYRE" &&
                    !normalizedSerial
                ) {
                    return {
                        success: false,
                        error: `Serial number wajib diisi untuk stock legacy TYRE ${productMeta.materialNumber}.`,
                    }
                }

                if (normalizedSerial) {
                    const serialKey = `${item.productId}:${normalizedSerial}`

                    if (requestedSerials.has(serialKey)) {
                        return {
                            success: false,
                            error: `Serial number ${normalizedSerial} terduplikasi dalam voucher yang sama.`,
                        }
                    }

                    const serialExistsInWarehouse = relevantReceiptItems.some(receiptItem =>
                        parseSerialNumbers(receiptItem.serialNumbers).includes(normalizedSerial)
                    )

                    if (!serialExistsInWarehouse && sourceType !== "legacy-stock") {
                        return {
                            success: false,
                            error: `Serial number ${normalizedSerial} tidak ditemukan pada stok EVHS warehouse ini.`,
                        }
                    }

                    const serialAlreadyUsed = existingVouchers.some(voucher =>
                        voucher.items.some(voucherItem =>
                            voucherItem.productId === item.productId &&
                            normalizeSerialNumber(voucherItem.serialNumber) === normalizedSerial
                        )
                    )

                    if (serialAlreadyUsed) {
                        return {
                            success: false,
                            error: `Serial number ${normalizedSerial} sudah pernah dipakai pada voucher sebelumnya.`,
                        }
                    }

                    if (item.qty !== 1) {
                        return {
                            success: false,
                            error: `Qty untuk item berserial harus 1. Serial ${normalizedSerial} menerima qty ${item.qty}.`,
                        }
                    }

                    requestedSerials.add(serialKey)
                }

                if (nextRequestedQty > availableQty) {
                    return {
                        success: false,
                        error: `Stok tidak cukup untuk product ${item.productId}. Tersedia ${availableQty}, diminta total ${nextRequestedQty}.`,
                    }
                }

                requestedQtyByProduct.set(item.productId, nextRequestedQty)
            }

            const [voucher] = await tx.insert(evhsVouchers).values({
                vhsNo,
                woNo: data.woNo,
                date: data.date.toISOString().slice(0, 10), // Correct Date to string
                warehouseId: data.warehouseId,
                remark: data.remark,
                issuedBy: userId,
                approvedByName: data.approvedByName,
                receivedByName: data.receivedByName,
                status: "completed",
                mrkoStatus: "OPEN",
            }).returning()

            const insertedQtyByProduct = new Map<number, number>()

            for (const item of data.items) {
                const receivedQty = warehouseReceipts
                    .filter(receipt => receipt.transfer?.toWarehouseId === data.warehouseId)
                    .flatMap(receipt => receipt.items)
                    .filter(receiptItem => receiptItem.productId === item.productId)
                    .reduce((total, receiptItem) => total + receiptItem.confirmedQty, 0)

                const usedQtyBeforeInsert = existingVouchers
                    .flatMap(voucher => voucher.items)
                    .filter(voucherItem => voucherItem.productId === item.productId)
                    .reduce((total, voucherItem) => total + voucherItem.qty, 0)

                const warehouseStockQty = legacyStockByProduct.get(item.productId)
                const availableQtyBeforeInsert = warehouseStockQty !== undefined
                    ? Math.max(warehouseStockQty - usedQtyBeforeInsert, 0)
                    : Math.max(receivedQty - usedQtyBeforeInsert, 0)
                const alreadyInsertedQty = insertedQtyByProduct.get(item.productId) || 0
                const remainingAfterInsert = Math.max(availableQtyBeforeInsert - alreadyInsertedQty - item.qty, 0)
                const unitPrice = getEvhsVoucherItemUnitPrice(
                    relevantMasterPrices,
                    data.warehouseId,
                    productById.get(item.productId),
                    item.materialNumberCk,
                )

                await tx.insert(evhsVoucherItems).values({
                    voucherId: voucher.id,
                    productId: item.productId,
                    materialNumberCk: item.materialNumberCk,
                    unitPrice: unitPrice != null ? unitPrice.toString() : null,
                    qty: item.qty,
                    serialNumber: normalizeSerialNumber(item.serialNumber) || null,
                    stockBalance: item.stockBalance ?? remainingAfterInsert,
                    pos: item.pos,
                    unitId: item.unitId,
                })

                await recordStockMovement(tx, {
                    productId: item.productId,
                    warehouseId: data.warehouseId,
                    quantity: -Math.abs(item.qty),
                    type: "DELIVERY",
                    referenceNumber: vhsNo,
                    recordedBy: userId,
                    customerId: warehouse?.customerId ?? undefined,
                    notes: `Pengeluaran EVHS via voucher ${vhsNo}`,
                })

                insertedQtyByProduct.set(item.productId, alreadyInsertedQty + item.qty)
            }

            return { success: true, vhsNo }
        })
    } catch (error) {
        console.error("Error creating VHS voucher:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to create voucher" }
    } finally {
        revalidatePath("/dashboard/evhs")
        revalidatePath("/dashboard/stock-movements")
    }
}

const _editUsageSchema = z.object({
    voucherId: z.number(),
    voucherItemId: z.number(),
    woNo: z.string().optional(),
    materialNumberCk: z.string().optional(),
    pos: z.string().optional(),
    unitId: z.string().optional(),
})

export async function updateEvhsUsage(data: z.infer<typeof _editUsageSchema>) {
    try {
        await getAuthenticatedSession('evhs', 'edit')
        const voucher = await db.query.evhsVouchers.findFirst({
            where: eq(evhsVouchers.id, data.voucherId),
            columns: {
                warehouseId: true,
            },
        })

        if (!voucher) {
            return { success: false, error: "Voucher tidak ditemukan" }
        }

        await assertCurrentUserHasWarehouseAccess(voucher.warehouseId, "edit")

        return await db.transaction(async (tx) => {
            if (data.woNo !== undefined) {
                await tx.update(evhsVouchers)
                    .set({ woNo: data.woNo, updatedAt: new Date() })
                    .where(eq(evhsVouchers.id, data.voucherId))
            }

            await tx.update(evhsVoucherItems)
                .set({
                    materialNumberCk: data.materialNumberCk,
                    pos: data.pos,
                    unitId: data.unitId
                })
                .where(eq(evhsVoucherItems.id, data.voucherItemId))

            return { success: true }
        })
    } catch (error) {
        console.error("Error updating VHS usage:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update usage" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

const _editVoucherSchema = z.object({
    id: z.number(),
    woNo: z.string().optional(),
    date: z.date(),
    remark: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
})

export async function updateEvhsVoucher(data: z.infer<typeof _editVoucherSchema>) {
    try {
        await getAuthenticatedSession('evhs', 'edit')
        const voucher = await db.query.evhsVouchers.findFirst({
            where: eq(evhsVouchers.id, data.id),
            columns: {
                warehouseId: true,
            },
        })

        if (!voucher) {
            return { success: false, error: "Voucher tidak ditemukan" }
        }

        await assertCurrentUserHasWarehouseAccess(voucher.warehouseId, "edit")

        await db.update(evhsVouchers)
            .set({
                woNo: data.woNo,
                date: data.date.toISOString().slice(0, 10),
                remark: data.remark,
                approvedByName: data.approvedByName,
                receivedByName: data.receivedByName,
                updatedAt: new Date(),
            })
            .where(eq(evhsVouchers.id, data.id))

        return { success: true }
    } catch (error) {
        console.error("Error updating VHS Voucher:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update voucher" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

export async function deleteEvhsVoucher(voucherId: number) {
    try {
        const session = await getAuthenticatedSession('evhs', 'delete')
        const userId = session.user.id
        const warehouseAccessContext = await getWarehouseAccessContextForUserId(userId, "edit")

        return await db.transaction(async (tx) => {
            const voucher = await tx.query.evhsVouchers.findFirst({
                where: eq(evhsVouchers.id, voucherId),
                with: {
                    items: true,
                    warehouse: true,
                },
            })

            if (!voucher) {
                return { success: false, error: "Voucher tidak ditemukan" }
            }

            if (!warehouseAccessContext.isGlobal) {
                if (!warehouseAccessContext.warehouseIds.includes(voucher.warehouseId)) {
                    return {
                        success: false,
                        error: "Anda tidak memiliki akses edit ke warehouse voucher ini.",
                    }
                }

                if (!voucher.issuedBy || voucher.issuedBy !== userId) {
                    return {
                        success: false,
                        error: "Voucher hanya bisa dihapus oleh pembuat voucher atau admin pusat.",
                    }
                }
            }

            for (const item of voucher.items) {
                await recordStockMovement(tx, {
                    productId: item.productId,
                    warehouseId: voucher.warehouseId,
                    quantity: Math.abs(Number(item.qty || 0)),
                    type: "DELIVERY",
                    referenceNumber: voucher.vhsNo,
                    recordedBy: userId,
                    customerId: voucher.warehouse?.customerId ?? undefined,
                    notes: `Reversal EVHS voucher ${voucher.vhsNo}`,
                })
            }

            // Revert all associated evhsVoucherItems to reset their voucher association
            await tx.delete(evhsVoucherItems)
                .where(eq(evhsVoucherItems.voucherId, voucherId))

            // Delete the voucher header
            await tx.delete(evhsVouchers)
                .where(eq(evhsVouchers.id, voucherId))

            return { success: true }
        })
    } catch (error) {
        console.error("Error deleting VHS Voucher:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete voucher" }
    } finally {
        revalidatePath("/dashboard/evhs")
        revalidatePath("/dashboard/stock-movements")
    }
}

// ─── Draft Voucher MHU ──────────────────────────────────────────────────────

const _draftVoucherSchema = z.object({
    woNo: z.string().optional(),
    date: z.date(),
    warehouseId: z.number(),
    remark: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
    items: z.array(z.object({
        materialNumberCk: z.string().min(1, "Material Number CK wajib diisi"),
        qty: z.number().min(1, "Qty minimal 1"),
    })).min(1, "Minimal satu item"),
})

/**
 * Buat Voucher VHS Draft untuk Warehouse MHU.
 * Tidak memerlukan SN/stok pada saat pembuatan — nomor VHS dibuat sekarang.
 * Stock movement belum dikurangi sampai voucher di-complete.
 */
export async function createEvhsDraftVoucher(data: z.infer<typeof _draftVoucherSchema>) {
    try {
        const session = await getAuthenticatedSession('evhs', 'create')
        const userId = session.user.id
        await assertCurrentUserHasWarehouseAccess(data.warehouseId, "edit")

        return await db.transaction(async (tx) => {
            const warehouse = await tx.query.warehouses.findFirst({
                where: eq(warehouses.id, data.warehouseId),
            })

            if (!isCkVhsWarehouse(warehouse)) {
                return {
                    success: false,
                    error: "Warehouse harus bertipe Warehouse VHS CK untuk proses EVHS.",
                }
            }

            // Generate nomor VHS
            const now = new Date()
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
            const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase()
            const vhsNo = `VHS/CP/CK/${dateStr}-${randomStr}`

            // Insert voucher header dengan status draft
            const [voucher] = await tx.insert(evhsVouchers).values({
                vhsNo,
                woNo: data.woNo,
                date: data.date.toISOString().slice(0, 10),
                warehouseId: data.warehouseId,
                remark: data.remark,
                issuedBy: userId,
                approvedByName: data.approvedByName,
                receivedByName: data.receivedByName,
                status: "draft",
                mrkoStatus: "OPEN",
            }).returning()

            // Insert items (materialNumberCk + qty saja, productId akan diisi nanti jika perlu)
            // Untuk draft MHU: cari productId berdasarkan materialNumberCk jika ada
            for (const item of data.items) {
                // Cari product berdasarkan materialNumberCk
                const matchedProduct = await tx.query.products.findFirst({
                    where: (p, { eq, or }) => or(
                        eq(p.materialNumberCk, item.materialNumberCk),
                        eq(p.materialNumber, item.materialNumberCk),
                    ),
                    columns: { id: true },
                })

                // Gunakan productId yang ditemukan, atau placeholder pertama (akan diisi saat complete)
                // Jika tidak ditemukan, gunakan productId = 0 sebagai sentinel (akan error saat complete)
                // Tapi kita butuh productId valid untuk FK. Cari product dengan materialNumber match
                if (!matchedProduct) {
                    return {
                        success: false,
                        error: `Material Number "${item.materialNumberCk}" tidak ditemukan di database. Pastikan CK Material Number sesuai.`,
                    }
                }

                await tx.insert(evhsVoucherItems).values({
                    voucherId: voucher.id,
                    productId: matchedProduct.id,
                    materialNumberCk: item.materialNumberCk,
                    qty: item.qty,
                    serialNumber: null,
                    pos: null,
                    unitId: null,
                })
            }

            return { success: true, vhsNo, voucherId: voucher.id }
        })
    } catch (error) {
        console.error("Error creating draft VHS voucher:", error)
        return { success: false, error: error instanceof Error ? error.message : "Gagal membuat voucher draft" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

const _updateDraftItemsSchema = z.object({
    voucherId: z.number(),
    woNo: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
        itemId: z.number(),
        serialNumber: z.string().optional(),
        pos: z.string().optional(),
        unitId: z.string().optional(),
        materialNumberCk: z.string().optional(),
        qty: z.number().min(1).optional(),
    })),
})

/**
 * Update item-item pada voucher draft (isi SN, POS, Unit ID) tanpa mengubah status.
 */
export async function updateEvhsDraftVoucherItems(data: z.infer<typeof _updateDraftItemsSchema>) {
    try {
        await getAuthenticatedSession('evhs', 'edit')
        const voucher = await db.query.evhsVouchers.findFirst({
            where: eq(evhsVouchers.id, data.voucherId),
            columns: { warehouseId: true, status: true },
        })

        if (!voucher) {
            return { success: false, error: "Voucher tidak ditemukan" }
        }

        if (voucher.status === "completed") {
            return { success: false, error: "Voucher sudah completed, tidak bisa diedit." }
        }

        await assertCurrentUserHasWarehouseAccess(voucher.warehouseId, "edit")

        return await db.transaction(async (tx) => {
            // Update header voucher
            await tx.update(evhsVouchers).set({
                woNo: data.woNo,
                approvedByName: data.approvedByName,
                receivedByName: data.receivedByName,
                remark: data.remark,
                updatedAt: new Date(),
            }).where(eq(evhsVouchers.id, data.voucherId))

            // Update masing-masing item
            for (const item of data.items) {
                await tx.update(evhsVoucherItems).set({
                    serialNumber: item.serialNumber || null,
                    pos: item.pos || null,
                    unitId: item.unitId || null,
                    materialNumberCk: item.materialNumberCk,
                    ...(item.qty !== undefined ? { qty: item.qty } : {}),
                }).where(eq(evhsVoucherItems.id, item.itemId))
            }

            return { success: true }
        })
    } catch (error) {
        console.error("Error updating draft voucher items:", error)
        return { success: false, error: error instanceof Error ? error.message : "Gagal update draft voucher" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

const _completeDraftVoucherSchema = z.object({
    voucherId: z.number(),
    woNo: z.string().optional(),
    approvedByName: z.string().optional(),
    receivedByName: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
        itemId: z.number(),
        productId: z.number(),
        qty: z.number().min(1),
        serialNumber: z.string().optional(),
        pos: z.string().optional(),
        unitId: z.string().optional(),
        materialNumberCk: z.string().optional(),
    })),
})

/**
 * Selesaikan (complete) voucher draft MHU.
 * Melakukan validasi stok, update items, kurangi stock movement, ubah status → completed.
 */
export async function completeEvhsDraftVoucher(data: z.infer<typeof _completeDraftVoucherSchema>) {
    try {
        const session = await getAuthenticatedSession('evhs', 'edit')
        const userId = session.user.id

        const voucher = await db.query.evhsVouchers.findFirst({
            where: eq(evhsVouchers.id, data.voucherId),
            columns: { warehouseId: true, status: true, vhsNo: true },
        })

        if (!voucher) {
            return { success: false, error: "Voucher tidak ditemukan" }
        }

        if (voucher.status !== "draft") {
            return { success: false, error: "Hanya voucher berstatus draft yang bisa di-complete." }
        }

        await assertCurrentUserHasWarehouseAccess(voucher.warehouseId, "edit")

        return await db.transaction(async (tx) => {
            const warehouseRow = await tx.query.warehouses.findFirst({
                where: eq(warehouses.id, voucher.warehouseId),
            })

            // Validasi stok per product
            const productIds = Array.from(new Set(data.items.map(i => i.productId)))
            const legacyStockLevels = productIds.length > 0
                ? await tx.query.stockLevels.findMany({
                    where: (sl, { and, eq, inArray }) => and(
                        eq(sl.warehouseId, voucher.warehouseId),
                        inArray(sl.productId, productIds),
                    ),
                    columns: { productId: true, totalStock: true },
                })
                : []

            const warehouseReceipts = await tx.query.evhsReceipts.findMany({
                with: { transfer: true, items: true },
            })
            const existingCompletedVouchers = await tx.query.evhsVouchers.findMany({
                where: (v, { and, eq, ne }) => and(
                    eq(v.warehouseId, voucher.warehouseId),
                    ne(v.id, data.voucherId),
                    ne(v.status, "draft"),
                ),
                with: { items: true },
            })

            const legacyStockByProduct = new Map<number, number>(
                legacyStockLevels.map(sl => [sl.productId, Number(sl.totalStock || 0)])
            )

            const requestedQtyByProduct = new Map<number, number>()
            const requestedSerials = new Set<string>()

            for (const item of data.items) {
                const relevantReceiptItems = warehouseReceipts
                    .filter(r => r.transfer?.toWarehouseId === voucher.warehouseId)
                    .flatMap(r => r.items)
                    .filter(ri => ri.productId === item.productId)

                const receivedQty = relevantReceiptItems.reduce((t, ri) => t + ri.confirmedQty, 0)
                const usedQty = existingCompletedVouchers
                    .flatMap(v => v.items)
                    .filter(vi => vi.productId === item.productId)
                    .reduce((t, vi) => t + vi.qty, 0)

                const warehouseStockQty = legacyStockByProduct.get(item.productId)
                const availableQty = warehouseStockQty !== undefined
                    ? Math.max(warehouseStockQty - usedQty, 0)
                    : Math.max(receivedQty - usedQty, 0)

                const nextRequested = (requestedQtyByProduct.get(item.productId) || 0) + item.qty

                if (nextRequested > availableQty) {
                    return {
                        success: false,
                        error: `Stok tidak cukup untuk product ID ${item.productId}. Tersedia ${availableQty}, diminta ${nextRequested}.`,
                    }
                }

                // Cek duplikasi serial number
                const normalizedSN = normalizeSerialNumber(item.serialNumber)
                if (normalizedSN) {
                    const key = `${item.productId}:${normalizedSN}`
                    if (requestedSerials.has(key)) {
                        return { success: false, error: `Serial number ${normalizedSN} terduplikasi.` }
                    }
                    const snUsed = existingCompletedVouchers.some(v =>
                        v.items.some(vi =>
                            vi.productId === item.productId &&
                            normalizeSerialNumber(vi.serialNumber) === normalizedSN
                        )
                    )
                    if (snUsed) {
                        return { success: false, error: `Serial number ${normalizedSN} sudah dipakai pada voucher lain.` }
                    }
                    requestedSerials.add(key)
                }

                requestedQtyByProduct.set(item.productId, nextRequested)
            }

            // Update header
            await tx.update(evhsVouchers).set({
                woNo: data.woNo,
                approvedByName: data.approvedByName,
                receivedByName: data.receivedByName,
                remark: data.remark,
                status: "completed",
                updatedAt: new Date(),
            }).where(eq(evhsVouchers.id, data.voucherId))

            // Update items dan rekam stock movement
            for (const item of data.items) {
                await tx.update(evhsVoucherItems).set({
                    serialNumber: normalizeSerialNumber(item.serialNumber) || null,
                    pos: item.pos || null,
                    unitId: item.unitId || null,
                    materialNumberCk: item.materialNumberCk,
                    qty: item.qty,
                }).where(eq(evhsVoucherItems.id, item.itemId))

                await recordStockMovement(tx, {
                    productId: item.productId,
                    warehouseId: voucher.warehouseId,
                    quantity: -Math.abs(item.qty),
                    type: "DELIVERY",
                    referenceNumber: voucher.vhsNo,
                    recordedBy: userId,
                    customerId: warehouseRow?.customerId ?? undefined,
                    notes: `Pengeluaran EVHS via voucher draft ${voucher.vhsNo} (completed)`,
                })
            }

            return { success: true }
        })
    } catch (error) {
        console.error("Error completing draft VHS voucher:", error)
        return { success: false, error: error instanceof Error ? error.message : "Gagal menyelesaikan draft voucher" }
    } finally {
        revalidatePath("/dashboard/evhs")
        revalidatePath("/dashboard/stock-movements")
    }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function getEvhsVouchers() {
    try {
        const session = await getAuthenticatedSession('evhs', 'view')
        const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")
        const warehouseEditContext = await getWarehouseAccessContextForUserId(session.user.id, "edit")
        const rolePermissions = warehouseEditContext.isGlobal || !warehouseEditContext.role
            ? []
            : await getPermissionsByRoleName(warehouseEditContext.role)
        const canDeleteByRole = warehouseEditContext.isGlobal || rolePermissions.includes("evhs:delete")

        if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
            return []
        }

        const vouchers = await db.query.evhsVouchers.findMany({
            where: allowedWarehouseIds
                ? inArray(evhsVouchers.warehouseId, allowedWarehouseIds)
                : undefined,
            with: {
                items: {
                    with: {
                        product: true
                    }
                },
                warehouse: true,
                issuedByUser: true,
            },
            orderBy: [desc(evhsVouchers.createdAt)],
        })
        const relevantMaterialNumbers = Array.from(new Set(
            vouchers
                .flatMap((voucher) => voucher.items)
                .map((item) => item.product?.materialNumber)
                .filter(Boolean)
        ))
        const relevantMaterialNumbersCk = Array.from(new Set(
            vouchers
                .flatMap((voucher) => voucher.items)
                .map((item) => item.materialNumberCk || item.product?.materialNumberCk)
                .filter((value): value is string => Boolean(value?.trim()))
        ))
        const masterPriceFilters = []

        if (relevantMaterialNumbers.length > 0) {
            masterPriceFilters.push(inArray(evhsMasterPrices.materialNumberCp, relevantMaterialNumbers))
        }

        if (relevantMaterialNumbersCk.length > 0) {
            masterPriceFilters.push(inArray(evhsMasterPrices.materialNumberCk, relevantMaterialNumbersCk))
        }

        const relevantMasterPrices = masterPriceFilters.length > 0
            ? await db.query.evhsMasterPrices.findMany({
                where: masterPriceFilters.length === 1
                    ? masterPriceFilters[0]
                    : or(...masterPriceFilters),
                columns: {
                    warehouseId: true,
                    materialNumberCp: true,
                    materialNumberCk: true,
                    price: true,
                },
            })
            : []

        return normalizeSlocFields(vouchers.map((voucher) => ({
            ...voucher,
            items: voucher.items.map((item) => {
                const unitPrice = getEvhsVoucherItemUnitPrice(
                    relevantMasterPrices,
                    voucher.warehouseId,
                    item.product
                        ? {
                            id: item.productId,
                            materialNumber: item.product.materialNumber,
                            materialNumberCk: item.product.materialNumberCk,
                        }
                        : undefined,
                    item.materialNumberCk,
                    item.unitPrice,
                )
                const lineTotal = unitPrice != null ? unitPrice * Number(item.qty || 0) : null

                return {
                    ...item,
                    unitPrice: unitPrice != null ? unitPrice.toFixed(2) : null,
                    lineTotal,
                }
            }),
            totalAmount: voucher.items.reduce((total, item) => {
                const unitPrice = getEvhsVoucherItemUnitPrice(
                    relevantMasterPrices,
                    voucher.warehouseId,
                    item.product
                        ? {
                            id: item.productId,
                            materialNumber: item.product.materialNumber,
                            materialNumberCk: item.product.materialNumberCk,
                        }
                        : undefined,
                    item.materialNumberCk,
                    item.unitPrice,
                )

                return total + ((unitPrice ?? 0) * Number(item.qty || 0))
            }, 0),
            canDelete: canDeleteByRole && (
                warehouseEditContext.isGlobal ||
                (
                    warehouseEditContext.warehouseIds.includes(voucher.warehouseId) &&
                    voucher.issuedBy === session.user.id
                )
            ),
        })))
    } catch (error) {
        console.error("Error fetching Vouchers:", error)
        return []
    }
}

/**
 * Fitur 3 — GI Records & Matching
 */
export async function getGiRecords() {
    try {
        await getAuthenticatedSession('evhs', 'view')
        const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")

        if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
            return []
        }

        const rows = await db.query.evhsGiRecords.findMany({
            where: allowedWarehouseIds
                ? inArray(evhsGiRecords.warehouseId, allowedWarehouseIds)
                : undefined,
            with: {
                items: true,
                warehouse: true
            },
            orderBy: [desc(evhsGiRecords.createdAt)]
        })
        return normalizeSlocFields(rows)
    } catch (error) {
        console.error("Error fetching GI records:", error)
        return []
    }
}

export async function createGiRecord(data: {
    warehouseId: number;
    periodDate: Date;
    documentNo?: string;
    woNo?: string;
    items: { materialNumber: string; qty: number; price?: number }[];
}) {
    try {
        await getAuthenticatedSession('evhs', 'create')
        await assertCurrentUserHasWarehouseAccess(data.warehouseId, "edit")

        return await db.transaction(async (tx) => {
            const [record] = await tx.insert(evhsGiRecords).values({
                warehouseId: data.warehouseId,
                periodDate: data.periodDate.toISOString().slice(0, 10), // Correct Date to string
                documentNo: data.documentNo,
                woNo: data.woNo,
                source: "manual",
            }).returning()

            for (const item of data.items) {
                await tx.insert(evhsGiItems).values({
                    giRecordId: record.id,
                    materialNumber: item.materialNumber,
                    qty: item.qty.toString(),
                    price: item.price?.toString(),
                    status: "pending",
                })
            }

            return { success: true, recordId: record.id }
        })
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to create GI record" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

const giImportRecordSchema = z.object({
    warehouseId: z.number(),
    periodDate: z.string().min(1),
    documentNo: z.string().optional(),
    woNo: z.string().optional(),
    items: z.array(z.object({
        materialNumber: z.string().min(1),
        qty: z.number().positive(),
        price: z.number().optional(),
    })).min(1),
})

export async function importEvhsGiRecords(records: z.infer<typeof giImportRecordSchema>[]) {
    try {
        await getAuthenticatedSession('evhs', 'create')
        const parsedRecords = z.array(giImportRecordSchema).parse(records)
        await assertCurrentUserHasWarehouseAccessForAll(
            parsedRecords.map((record) => record.warehouseId),
            "edit"
        )

        return await db.transaction(async (tx) => {
            const errors: { record: number; reference: string; error: string }[] = []
            let imported = 0

            for (const [index, record] of parsedRecords.entries()) {
                try {
                    const [giRecord] = await tx.insert(evhsGiRecords).values({
                        warehouseId: record.warehouseId,
                        periodDate: record.periodDate,
                        documentNo: record.documentNo,
                        woNo: record.woNo,
                        source: "upload",
                    }).returning()

                    await tx.insert(evhsGiItems).values(
                        record.items.map(item => ({
                            giRecordId: giRecord.id,
                            materialNumber: item.materialNumber,
                            qty: item.qty.toString(),
                            price: item.price?.toString(),
                            status: "pending",
                        }))
                    )

                    imported += 1
                } catch (error) {
                    errors.push({
                        record: index + 1,
                        reference: record.documentNo || record.woNo || `Record ${index + 1}`,
                        error: error instanceof Error ? error.message : "Failed to import GI record",
                    })
                }
            }

            return {
                success: errors.length === 0,
                imported,
                failed: errors.length,
                errors,
            }
        })
    } catch (error) {
        return {
            success: false,
            imported: 0,
            failed: records.length,
            errors: [
                {
                    record: 0,
                    reference: "validation",
                    error: error instanceof Error ? error.message : "Failed to import GI records",
                },
            ],
        }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

/**
 * Fitur 6 — MRKO & Invoicing
 */
export async function updateMrko(data: {
    voucherId: number;
    mrkoStatus: string;
    mrkoNo?: string;
    sapInvoiceNo: string;
    settledDate?: Date;
}) {
    try {
        await getAuthenticatedSession('evhs', 'edit')
        const voucher = await db.query.evhsVouchers.findFirst({
            where: eq(evhsVouchers.id, data.voucherId),
            columns: {
                warehouseId: true,
            },
        })

        if (!voucher) {
            return { success: false, error: "Voucher tidak ditemukan" }
        }

        await assertCurrentUserHasWarehouseAccess(voucher.warehouseId, "edit")

        await db.update(evhsVouchers)
            .set({
                mrkoStatus: data.mrkoStatus,
                mrkoNo: data.mrkoNo,
                sapInvoiceNo: data.sapInvoiceNo,
                settledDate: data.settledDate || new Date(),
                updatedAt: new Date()
            })
            .where(eq(evhsVouchers.id, data.voucherId))

        return { success: true }
    } catch (error) {
        console.error("Error updating MRKO:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update MRKO" }
    } finally {
        revalidatePath("/dashboard/evhs")
    }
}

/**
 * Get Data specifically for MRKO & Invoicing tab
 * Includes Vouchers, GI Matching status, and SAP Invoice sync
 */
export async function getEvhsMrkoData() {
    try {
        await getAuthenticatedSession('evhs', 'view')
        const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")

        if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
            return { vouchers: [], giRecords: [], sapRevenue: [] }
        }

        const vouchers = await db.query.evhsVouchers.findMany({
            where: allowedWarehouseIds
                ? inArray(evhsVouchers.warehouseId, allowedWarehouseIds)
                : undefined,
            with: {
                items: { with: { product: true } },
                warehouse: true
            },
            orderBy: [desc(evhsVouchers.createdAt)]
        })

        const giRecords = await db.query.evhsGiRecords.findMany({
            where: allowedWarehouseIds
                ? inArray(evhsGiRecords.warehouseId, allowedWarehouseIds)
                : undefined,
            with: { items: true }
        })
        const relevantMaterialNumbers = Array.from(new Set(
            vouchers
                .flatMap((voucher) => voucher.items)
                .map((item) => item.product?.materialNumber)
                .filter(Boolean)
        ))
        const relevantMaterialNumbersCk = Array.from(new Set(
            vouchers
                .flatMap((voucher) => voucher.items)
                .map((item) => item.materialNumberCk || item.product?.materialNumberCk)
                .filter((value): value is string => Boolean(value?.trim()))
        ))
        const masterPriceFilters = []

        if (relevantMaterialNumbers.length > 0) {
            masterPriceFilters.push(inArray(evhsMasterPrices.materialNumberCp, relevantMaterialNumbers))
        }

        if (relevantMaterialNumbersCk.length > 0) {
            masterPriceFilters.push(inArray(evhsMasterPrices.materialNumberCk, relevantMaterialNumbersCk))
        }

        const relevantMasterPrices = masterPriceFilters.length > 0
            ? await db.query.evhsMasterPrices.findMany({
                where: masterPriceFilters.length === 1
                    ? masterPriceFilters[0]
                    : or(...masterPriceFilters),
                columns: {
                    warehouseId: true,
                    materialNumberCp: true,
                    materialNumberCk: true,
                    price: true,
                },
            })
            : []

        // Fetch SAP Revenue to sync invoices
        const sapRevenue = await db.query.salesRevenueSap.findMany({
            where: eq(sql`customer_name`, "PT CIPTA KRIDATAMA")
        })

        return normalizeSlocFields({
            vouchers: vouchers.map((voucher) => ({
                ...voucher,
                items: voucher.items.map((item) => {
                    const unitPrice = getEvhsVoucherItemUnitPrice(
                        relevantMasterPrices,
                        voucher.warehouseId,
                        item.product
                            ? {
                                id: item.productId,
                                materialNumber: item.product.materialNumber,
                                materialNumberCk: item.product.materialNumberCk,
                            }
                            : undefined,
                        item.materialNumberCk,
                        item.unitPrice,
                    )
                    const lineTotal = unitPrice != null ? unitPrice * Number(item.qty || 0) : null

                    return {
                        ...item,
                        unitPrice: unitPrice != null ? unitPrice.toFixed(2) : null,
                        lineTotal,
                    }
                }),
                totalAmount: voucher.items.reduce((total, item) => {
                    const unitPrice = getEvhsVoucherItemUnitPrice(
                        relevantMasterPrices,
                        voucher.warehouseId,
                        item.product
                            ? {
                                id: item.productId,
                                materialNumber: item.product.materialNumber,
                                materialNumberCk: item.product.materialNumberCk,
                            }
                            : undefined,
                        item.materialNumberCk,
                        item.unitPrice,
                    )

                    return total + ((unitPrice ?? 0) * Number(item.qty || 0))
                }, 0),
            })),
            giRecords,
            sapRevenue
        })
    } catch (error) {
        console.error("Error fetching MRKO data:", error)
        return { vouchers: [], giRecords: [], sapRevenue: [] }
    }
}

/**
 * Fitur: Get Tracking Data (from Receipts to Vouchers)
 */
export async function getEvhsTrackingData() {
    try {
        await getAuthenticatedSession('evhs', 'view')
        const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")

        if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
            return []
        }

        const receipts = await db.query.evhsReceipts.findMany({
            with: {
                transfer: {
                    with: { toWarehouse: true }
                },
                items: {
                    with: { product: true }
                }
            },
            orderBy: [desc(evhsReceipts.receivedDate)]
        })

        const vouchers = await db.query.evhsVouchers.findMany({
            where: allowedWarehouseIds
                ? inArray(evhsVouchers.warehouseId, allowedWarehouseIds)
                : undefined,
            with: {
                items: {
                    with: {
                        product: true,
                    }
                },
                warehouse: true,
            }
        })

        const giRecords = await db.query.evhsGiRecords.findMany({
            where: allowedWarehouseIds
                ? inArray(evhsGiRecords.warehouseId, allowedWarehouseIds)
                : undefined,
            with: { items: true }
        })

        const filteredReceipts = filterEvhsReceiptRowsByWarehouse(receipts, allowedWarehouseIds)

        const trackingRows: EvhsTrackingRow[] = []
        const trackedVoucherItemIds = new Set<number>()

        for (const receipt of filteredReceipts) {
            for (const item of receipt.items) {
                const sns = Array.isArray(item.serialNumbers)
                    ? item.serialNumbers.filter(Boolean)
                    : parseSerialNumbers(item.serialNumbers)

                if (sns.length > 0) {
                    for (const sn of sns) {
                        let matchedVoucherItem = null
                        let matchedVoucher = null
                        for (const v of vouchers) {
                            if (v.warehouseId !== receipt.transfer?.toWarehouseId) {
                                continue
                            }

                            const vi = v.items.find((i: EvhsMatchedVoucherItem) =>
                                i.productId === item.productId &&
                                normalizeSerialNumber(i.serialNumber) === normalizeSerialNumber(sn)
                            )
                            if (vi) {
                                matchedVoucherItem = vi
                                matchedVoucher = v
                                trackedVoucherItemIds.add(vi.id)
                                break
                            }
                        }

                        let matchedGi = null
                        if (matchedVoucher && matchedVoucher.woNo) {
                            matchedGi = giRecords.find(g => g.items.some(gi => gi.materialNumber === matchedVoucherItem?.materialNumberCk) || (matchedVoucher?.woNo && g.documentNo === matchedVoucher.woNo))
                        }

                        trackingRows.push({
                            id: `${item.id}-${sn}`,
                            dateIn: receipt.receivedDate,
                            cpDo: receipt.doChitraNo,
                            materialNumberCp: item.product.materialNumber,
                            materialNumberCk: matchedVoucherItem?.materialNumberCk || item.product.materialNumberCk || "-",
                            sn: sn,
                            qty: 1,
                            receivedQty: 1,
                            availableQty: matchedVoucher ? 0 : 1,
                            usedQty: matchedVoucher ? 1 : 0,
                            installDate: matchedVoucher?.date || null,
                            pos: matchedVoucherItem?.pos || "",
                            unitId: matchedVoucherItem?.unitId || "",
                            voucherNo: matchedVoucher?.vhsNo || "",
                            voucherId: matchedVoucher?.id || null,
                            voucherItemId: matchedVoucherItem?.id || null,
                            woNo: matchedVoucher?.woNo || "",
                            giNumber: matchedGi?.documentNo || "",
                            mrko: matchedVoucher?.mrkoStatus === "SETTLED" ? "SETTLED" : (matchedVoucher ? "OPEN" : ""),
                            inv: matchedVoucher?.sapInvoiceNo || "",
                            date: matchedVoucher?.settledDate || null,
                            productId: item.productId,
                            product: item.product,
                            warehouseId: receipt.transfer?.toWarehouseId,
                            warehouse: receipt.transfer?.toWarehouse
                        })
                    }
                } else {
                    const itemUsages = []
                    for (const v of vouchers) {
                        if (v.warehouseId !== receipt.transfer?.toWarehouseId) {
                            continue
                        }

                        for (const vi of v.items) {
                            if (vi.productId === item.productId && !vi.serialNumber) {
                                itemUsages.push({ voucher: v, voucherItem: vi })
                            }
                        }
                    }

                    for (const usage of itemUsages) {
                        trackedVoucherItemIds.add(usage.voucherItem.id)
                    }

                    const usedQty = itemUsages.reduce(
                        (total, usage) => total + Number(usage.voucherItem.qty || 0),
                        0
                    )
                    const availableQty = Math.max(item.confirmedQty - usedQty, 0)
                    const latestUsage = itemUsages[itemUsages.length - 1]

                    trackingRows.push({
                        id: `${item.id}-bulk`,
                        dateIn: receipt.receivedDate,
                        cpDo: receipt.doChitraNo,
                        materialNumberCp: item.product.materialNumber,
                        materialNumberCk: itemUsages.length > 0 && itemUsages[itemUsages.length-1].voucherItem.materialNumberCk
                            ? itemUsages[itemUsages.length-1].voucherItem.materialNumberCk
                            : (item.product.materialNumberCk || "-"),
                        sn: "-",
                        qty: availableQty,
                        receivedQty: item.confirmedQty,
                        availableQty,
                        usedQty,
                        installDate: latestUsage ? latestUsage.voucher.date : null,
                        pos: "",
                        unitId: "",
                        voucherNo: itemUsages.length > 0 ? (itemUsages.length > 1 ? "Multiple Usages" : itemUsages[0].voucher.vhsNo) : "",
                        voucherId: itemUsages.length === 1 ? itemUsages[0].voucher.id : null,
                        voucherItemId: itemUsages.length === 1 ? itemUsages[0].voucherItem.id : null,
                        woNo: itemUsages.length > 0 ? itemUsages[itemUsages.length-1].voucher.woNo : "",
                        giNumber: "",
                        mrko: "",
                        inv: "",
                        date: null,
                        productId: item.productId,
                        product: item.product,
                        warehouseId: receipt.transfer?.toWarehouseId,
                        warehouse: receipt.transfer?.toWarehouse
                    })
                }
            }
        }

        for (const voucher of vouchers) {
            if (voucher.status !== "completed") {
                continue
            }

            for (const voucherItem of voucher.items) {
                if (trackedVoucherItemIds.has(voucherItem.id)) {
                    continue
                }

                const matchedGi = getEvhsMatchedGiRecord(voucher, voucherItem, giRecords)

                trackingRows.push({
                    id: `manual-voucher-${voucherItem.id}`,
                    dateIn: voucher.date,
                    cpDo: "MANUAL VOUCHER",
                    materialNumberCp: voucherItem.product?.materialNumber || "-",
                    materialNumberCk: voucherItem.materialNumberCk || voucherItem.product?.materialNumberCk || "-",
                    sn: normalizeSerialNumber(voucherItem.serialNumber) || "-",
                    qty: Number(voucherItem.qty || 0),
                    receivedQty: Number(voucherItem.qty || 0),
                    availableQty: 0,
                    usedQty: Number(voucherItem.qty || 0),
                    installDate: voucher.date,
                    pos: voucherItem.pos || "",
                    unitId: voucherItem.unitId || "",
                    voucherNo: voucher.vhsNo,
                    voucherId: voucher.id,
                    voucherItemId: voucherItem.id,
                    woNo: voucher.woNo || "",
                    giNumber: matchedGi?.documentNo || "",
                    mrko: voucher.mrkoStatus === "SETTLED" ? "SETTLED" : (voucher.mrkoStatus || ""),
                    inv: voucher.sapInvoiceNo || "",
                    date: voucher.settledDate || null,
                    productId: voucherItem.productId,
                    product: voucherItem.product
                        ? {
                            materialNumber: voucherItem.product.materialNumber,
                            materialDescription: voucherItem.product.materialDescription,
                            materialNumberCk: voucherItem.product.materialNumberCk,
                            category: voucherItem.product.category,
                        }
                        : {
                            materialNumber: "-",
                            materialDescription: null,
                            materialNumberCk: null,
                            category: null,
                        },
                    warehouseId: voucher.warehouseId,
                    warehouse: voucher.warehouse
                        ? {
                            id: voucher.warehouse.id,
                            sloc: voucher.warehouse.sloc,
                            description: voucher.warehouse.description,
                            type: voucher.warehouse.type,
                        }
                        : null,
                })
            }
        }

        return normalizeSlocFields(trackingRows)
    } catch (error) {
        console.error("Error fetching tracking data:", error)
        return []
    }
}

type EvhsAllVhsStockDetailRow = EvhsTrackingRow & {
    sourceLabel?: string
}

type EvhsAllVhsStockRow = {
    id: string
    warehouseId: number
    warehouse: {
        id: number
        sloc: string
        description?: string | null
        type?: string | null
    }
    productId: number
    materialNumber: string
    materialNumberCk?: string | null
    materialDescription?: string | null
    category: string
    sapStock: number
    totalStock: number
    usedQty: number
    availableQty: number
    detailRows: EvhsAllVhsStockDetailRow[]
}

function normalizeEvhsMaterialKey(value?: string | null) {
    return (value || "").trim().toUpperCase()
}

function normalizeEvhsSlocKey(value?: string | null) {
    return normalizeSloc(value)
}

function normalizeEvhsSapSlocKey(value?: string | null) {
    return normalizeSloc(value)
}

function normalizeEvhsWarehouseDescriptionKey(value?: string | null) {
    return (value || "").trim().toUpperCase()
}

function isCkVhsWarehouse(warehouse?: { sloc?: string | null; description?: string | null; type?: string | null } | null) {
    if (!warehouse) return false

    const warehouseType = (warehouse.type || "").trim().toUpperCase()
    const warehouseLabel = `${normalizeSloc(warehouse.sloc) || ""} ${warehouse.description || ""}`.toUpperCase()

    return warehouseType === "WAREHOUSE VHS" && warehouseLabel.includes("CK")
}

function isEvhsDestinationWarehouse(
    warehouse?: {
        sloc?: string | null
        description?: string | null
        type?: string | null
        customerId?: number | null
    } | null
) {
    if (!warehouse) return false

    return isCkVhsWarehouse(warehouse)
}

export async function getEvhsAllVhsStockData(): Promise<EvhsAllVhsStockRow[]> {
    try {
        await getAuthenticatedSession('evhs', 'view')
        const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")

        if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
            return []
        }

        const [stockRows, trackingRows, vouchers, giRecords] = await Promise.all([
            db.query.stockLevels.findMany({
                where: allowedWarehouseIds
                    ? inArray(stockLevels.warehouseId, allowedWarehouseIds)
                    : undefined,
                with: {
                    product: true,
                    warehouse: true,
                },
            }),
            getEvhsTrackingData(),
            db.query.evhsVouchers.findMany({
                where: allowedWarehouseIds
                    ? inArray(evhsVouchers.warehouseId, allowedWarehouseIds)
                    : undefined,
                with: {
                    items: {
                        with: {
                            product: true,
                        },
                    },
                    warehouse: true,
                },
                orderBy: [desc(evhsVouchers.createdAt)],
            }),
            db.query.evhsGiRecords.findMany({
                where: allowedWarehouseIds
                    ? inArray(evhsGiRecords.warehouseId, allowedWarehouseIds)
                    : undefined,
                with: {
                    items: true,
                },
            }),
        ])

        const filteredStocks = stockRows.filter((stockRow) =>
            stockRow.totalStock > 0 && isCkVhsWarehouse(stockRow.warehouse)
        )
        const relevantSlocs = Array.from(new Set(
            filteredStocks
                .flatMap((stockRow) => expandSlocLookupKeys(stockRow.warehouse?.sloc))
                .filter(Boolean)
        ))
        const relevantWarehouseDescriptions = Array.from(new Set(
            filteredStocks
                .map((stockRow) => normalizeEvhsWarehouseDescriptionKey(stockRow.warehouse?.description))
                .filter(Boolean)
        ))
        const relevantMaterialNumbers = new Set(
            filteredStocks
                .map((stockRow) => normalizeEvhsMaterialKey(stockRow.product?.materialNumber))
                .filter(Boolean)
        )
        const sapStockRows = (relevantSlocs.length > 0 || relevantWarehouseDescriptions.length > 0)
            ? await db.select({
                materialNo: zmc9StockSap.materialNo,
                storLoc: zmc9StockSap.storLoc,
                totalStock: zmc9StockSap.totalStock,
                storLocDesc: zmc9StockSap.storLocDesc,
            })
                .from(zmc9StockSap)
                .where(
                    relevantSlocs.length > 0 && relevantWarehouseDescriptions.length > 0
                        ? or(
                            inArray(zmc9StockSap.storLoc, relevantSlocs),
                            inArray(zmc9StockSap.storLocDesc, relevantWarehouseDescriptions)
                        )
                        : relevantSlocs.length > 0
                            ? inArray(zmc9StockSap.storLoc, relevantSlocs)
                            : inArray(zmc9StockSap.storLocDesc, relevantWarehouseDescriptions)
                )
            : []
        const sapStockByWarehouseDescKey = new Map<string, number>()
        const sapStockBySlocKey = new Map<string, number>()

        const usedQtyByKey = new Map<string, number>()
        const detailRowsByKey = new Map<string, EvhsAllVhsStockDetailRow[]>()
        const trackedVoucherItemIds = new Set<number>()

        for (const sapStockRow of sapStockRows) {
            const materialKey = normalizeEvhsMaterialKey(sapStockRow.materialNo)
            if (!relevantMaterialNumbers.has(materialKey)) {
                continue
            }

            const warehouseDescKey = normalizeEvhsWarehouseDescriptionKey(sapStockRow.storLocDesc)
            if (warehouseDescKey) {
                const descSapKey = `${materialKey}:${warehouseDescKey}`
                const currentWarehouseDescStock = sapStockByWarehouseDescKey.get(descSapKey) || 0
                sapStockByWarehouseDescKey.set(descSapKey, currentWarehouseDescStock + Number(sapStockRow.totalStock || 0))
            }

            const slocKey = normalizeEvhsSapSlocKey(sapStockRow.storLoc)
            if (slocKey) {
                const slocSapKey = `${materialKey}:${slocKey}`
                const currentSlocStock = sapStockBySlocKey.get(slocSapKey) || 0
                sapStockBySlocKey.set(slocSapKey, currentSlocStock + Number(sapStockRow.totalStock || 0))
            }
        }

        for (const voucher of vouchers) {
            for (const voucherItem of voucher.items) {
                const warehouseKey = `${voucher.warehouseId}:${voucherItem.productId}`
                const currentUsedQty = usedQtyByKey.get(warehouseKey) || 0
                usedQtyByKey.set(warehouseKey, currentUsedQty + Number(voucherItem.qty || 0))
            }
        }

        for (const trackingRow of trackingRows) {
            if (!trackingRow.warehouseId) continue

            const warehouseKey = `${trackingRow.warehouseId}:${trackingRow.productId}`
            const currentRows = detailRowsByKey.get(warehouseKey) || []
            currentRows.push({
                ...trackingRow,
                sourceLabel: "Penerimaan EVHS",
            })
            detailRowsByKey.set(warehouseKey, currentRows)

            if (trackingRow.voucherItemId) {
                trackedVoucherItemIds.add(trackingRow.voucherItemId)
            }
        }

        for (const voucher of vouchers) {
            for (const voucherItem of voucher.items) {
                if (trackedVoucherItemIds.has(voucherItem.id)) {
                    continue
                }

                const warehouseKey = `${voucher.warehouseId}:${voucherItem.productId}`
                const matchedGi = getEvhsMatchedGiRecord(voucher, voucherItem, giRecords)
                const currentRows = detailRowsByKey.get(warehouseKey) || []

                currentRows.push({
                    id: `legacy-voucher-${voucherItem.id}`,
                    dateIn: null,
                    cpDo: "LEGACY STOCK",
                    materialNumberCp: voucherItem.product?.materialNumber || "-",
                    materialNumberCk: voucherItem.materialNumberCk || voucherItem.product?.materialNumberCk || "-",
                    sn: normalizeSerialNumber(voucherItem.serialNumber) || "-",
                    qty: Number(voucherItem.qty || 0),
                    receivedQty: Number(voucherItem.qty || 0),
                    availableQty: 0,
                    usedQty: Number(voucherItem.qty || 0),
                    installDate: voucher.date,
                    pos: voucherItem.pos || "",
                    unitId: voucherItem.unitId || "",
                    voucherNo: voucher.vhsNo,
                    voucherId: voucher.id,
                    voucherItemId: voucherItem.id,
                    woNo: voucher.woNo || "",
                    giNumber: matchedGi?.documentNo || "",
                    mrko: voucher.mrkoStatus === "SETTLED" ? "SETTLED" : (voucher.mrkoStatus || ""),
                    inv: voucher.sapInvoiceNo || "",
                    date: voucher.settledDate || null,
                    productId: voucherItem.productId,
                    product: voucherItem.product
                        ? {
                            materialNumber: voucherItem.product.materialNumber,
                            materialDescription: voucherItem.product.materialDescription,
                            materialNumberCk: voucherItem.product.materialNumberCk,
                        }
                        : {
                            materialNumber: "-",
                            materialDescription: null,
                            materialNumberCk: null,
                        },
                    warehouseId: voucher.warehouseId,
                    warehouse: voucher.warehouse,
                    sourceLabel: "Voucher Legacy",
                })

                detailRowsByKey.set(warehouseKey, currentRows)
            }
        }

        return normalizeSlocFields(filteredStocks
            .map((stockRow) => {
                const warehouseKey = `${stockRow.warehouseId}:${stockRow.productId}`
                const usedQty = usedQtyByKey.get(warehouseKey) || 0
                const materialKey = normalizeEvhsMaterialKey(stockRow.product?.materialNumber)
                const warehouseDescKey = normalizeEvhsWarehouseDescriptionKey(stockRow.warehouse?.description)
                const slocKey = normalizeEvhsSapSlocKey(stockRow.warehouse?.sloc)
                const sapStock = (warehouseDescKey
                    ? sapStockByWarehouseDescKey.get(`${materialKey}:${warehouseDescKey}`)
                    : undefined
                ) ?? (slocKey
                    ? sapStockBySlocKey.get(`${materialKey}:${slocKey}`)
                    : undefined
                ) ?? 0
                const detailRows = (detailRowsByKey.get(warehouseKey) || [])
                    .sort((left, right) => {
                        const leftDate = left.installDate || left.dateIn || left.date
                        const rightDate = right.installDate || right.dateIn || right.date
                        return new Date(rightDate || 0).getTime() - new Date(leftDate || 0).getTime()
                    })

                return {
                    id: `${stockRow.warehouseId}-${stockRow.productId}`,
                    warehouseId: stockRow.warehouseId,
                    warehouse: {
                        id: stockRow.warehouse?.id || stockRow.warehouseId,
                        sloc: stockRow.warehouse?.sloc || "-",
                        description: stockRow.warehouse?.description,
                        type: stockRow.warehouse?.type,
                    },
                    productId: stockRow.productId,
                    materialNumber: stockRow.product?.materialNumber || "-",
                    materialNumberCk: stockRow.product?.materialNumberCk,
                    materialDescription: stockRow.product?.materialDescription,
                    category: stockRow.product?.category || "-",
                    sapStock,
                    totalStock: stockRow.totalStock,
                    usedQty,
                    availableQty: Math.max(stockRow.totalStock - usedQty, 0),
                    detailRows,
                }
            })
            .sort((left, right) => {
                const warehouseCompare = formatEvhsWarehouseLabel(left.warehouse).localeCompare(formatEvhsWarehouseLabel(right.warehouse))
                if (warehouseCompare !== 0) return warehouseCompare
                return right.totalStock - left.totalStock
            }))
    } catch (error) {
        console.error("Error fetching Stock All VHS data:", error)
        return []
    }
}

function getEvhsMatchedGiRecord(
    voucher: Pick<EvhsMatchedVoucher, "warehouseId" | "woNo">,
    voucherItem: Pick<EvhsMatchedVoucherItem, "materialNumberCk">,
    giRecords: EvhsMatchedGiRecord[]
) {
    const materialCk = voucherItem?.materialNumberCk

    return giRecords.find((gi) => {
        const warehouseMatches = !gi.warehouseId || gi.warehouseId === voucher.warehouseId
        const woMatches = Boolean(voucher.woNo) && gi.woNo === voucher.woNo
        const materialMatches = Boolean(materialCk) && gi.items?.some((item: EvhsMatchedGiItem) => item.materialNumber === materialCk)

        return warehouseMatches && (woMatches || materialMatches)
    }) || null
}

function getDaysSince(dateValue: Date | string | null | undefined) {
    if (!dateValue) return 0

    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return 0

    return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)))
}

function getAgingBucket(days: number) {
    if (days <= 3) return "0-3 hari"
    if (days <= 7) return "4-7 hari"
    return ">7 hari"
}

function formatEvhsWarehouseLabel(warehouse?: { sloc: string; description?: string | null } | null) {
    return formatWarehouseLabel(warehouse)
}

export async function getEvhsControlTowerData() {
    try {
        await getAuthenticatedSession('evhs', 'view')
        const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")

        if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
            return {
                summary: {
                    receivedQty: 0,
                    reservedQty: 0,
                    usedQty: 0,
                    reversedQty: 0,
                    remainingQty: 0,
                },
                ledgerRows: [],
                reconciliationByWarehouse: [],
                aging: {
                    idleStockQty: 0,
                    voucherPendingGiQty: 0,
                    giPendingMrkoQty: 0,
                    mrkoPendingInvoiceQty: 0,
                    buckets: {
                        pendingGi: { "0-3 hari": 0, "4-7 hari": 0, ">7 hari": 0 },
                        giPendingMrko: { "0-3 hari": 0, "4-7 hari": 0, ">7 hari": 0 },
                        mrkoPendingInvoice: { "0-3 hari": 0, "4-7 hari": 0, ">7 hari": 0 },
                    },
                },
                exceptionCenter: [],
                auditTrail: [],
            }
        }

        const [receipts, vouchers, giRecords] = await Promise.all([
            db.query.evhsReceipts.findMany({
                with: {
                    transfer: {
                        with: {
                            toWarehouse: true,
                        },
                    },
                    confirmedByUser: true,
                    items: {
                        with: {
                            product: true,
                        },
                    },
                },
                orderBy: [desc(evhsReceipts.receivedDate)],
            }),
            db.query.evhsVouchers.findMany({
                where: allowedWarehouseIds
                    ? inArray(evhsVouchers.warehouseId, allowedWarehouseIds)
                    : undefined,
                with: {
                    items: {
                        with: {
                            product: true,
                        },
                    },
                    warehouse: true,
                    issuedByUser: true,
                },
                orderBy: [desc(evhsVouchers.createdAt)],
            }),
            db.query.evhsGiRecords.findMany({
                where: allowedWarehouseIds
                    ? inArray(evhsGiRecords.warehouseId, allowedWarehouseIds)
                    : undefined,
                with: {
                    items: true,
                    warehouse: true,
                },
                orderBy: [desc(evhsGiRecords.createdAt)],
            }),
        ])
        const filteredReceipts = filterEvhsReceiptRowsByWarehouse(receipts, allowedWarehouseIds)

        const duplicateSerialMap = new Map<string, {
            serialNumber: string
            site: string
            references: string[]
        }>()

        const ledgerRows: Array<{
            id: string
            site: string
            receiptDate: Date | string | null
            reference: string
            materialNumberCp: string
            materialDescription: string | null
            receivedQty: number
            reservedQty: number
            usedQty: number
            reversedQty: number
            remainingQty: number
            ageDays: number
            confirmedBy: string
        }> = []

        for (const receipt of filteredReceipts) {
            const siteLabel = formatEvhsWarehouseLabel(receipt.transfer?.toWarehouse)
            const reference = receipt.doChitraNo || receipt.transfer?.referenceNumber || `Receipt ${receipt.id}`

            for (const item of receipt.items) {
                const serials = parseSerialNumbers(item.serialNumbers)

                if (serials.length > 0) {
                    let reservedQty = 0
                    let usedQty = 0

                    for (const serialNumber of serials) {
                        const normalizedSerial = normalizeSerialNumber(serialNumber)
                        const duplicateKey = `${receipt.transfer?.toWarehouseId || "na"}:${item.productId}:${normalizedSerial}`
                        const duplicateEntry = duplicateSerialMap.get(duplicateKey)

                        if (duplicateEntry) {
                            duplicateEntry.references.push(reference)
                        } else {
                            duplicateSerialMap.set(duplicateKey, {
                                serialNumber: normalizedSerial,
                                site: siteLabel,
                                references: [reference],
                            })
                        }

                        let matchedUsage: { voucher: EvhsMatchedVoucher; voucherItem: EvhsMatchedVoucherItem } | null = null

                        for (const voucher of vouchers) {
                            if (voucher.warehouseId !== receipt.transfer?.toWarehouseId) {
                                continue
                            }

                            const voucherItem = voucher.items.find((candidate: EvhsMatchedVoucherItem) => (
                                candidate.productId === item.productId &&
                                normalizeSerialNumber(candidate.serialNumber) === normalizedSerial
                            ))

                            if (voucherItem) {
                                matchedUsage = { voucher, voucherItem }
                                break
                            }
                        }

                        if (matchedUsage) {
                            const matchedGi = getEvhsMatchedGiRecord(matchedUsage.voucher, matchedUsage.voucherItem, giRecords)
                            if (matchedGi) {
                                usedQty += 1
                            } else {
                                reservedQty += 1
                            }
                        }
                    }

                    ledgerRows.push({
                        id: `${receipt.id}-${item.id}-serial`,
                        site: siteLabel,
                        receiptDate: receipt.receivedDate,
                        reference,
                        materialNumberCp: item.product.materialNumber,
                        materialDescription: item.product.materialDescription,
                        receivedQty: item.confirmedQty,
                        reservedQty,
                        usedQty,
                        reversedQty: 0,
                        remainingQty: item.confirmedQty - reservedQty - usedQty,
                        ageDays: getDaysSince(receipt.receivedDate),
                        confirmedBy: receipt.confirmedByUser?.name || "System",
                    })
                    continue
                }

                let reservedQty = 0
                let usedQty = 0

                for (const voucher of vouchers) {
                    if (voucher.warehouseId !== receipt.transfer?.toWarehouseId) {
                        continue
                    }

                    for (const voucherItem of voucher.items) {
                        if (voucherItem.productId !== item.productId || voucherItem.serialNumber) {
                            continue
                        }

                        const matchedGi = getEvhsMatchedGiRecord(voucher, voucherItem, giRecords)
                        if (matchedGi) {
                            usedQty += Number(voucherItem.qty || 0)
                        } else {
                            reservedQty += Number(voucherItem.qty || 0)
                        }
                    }
                }

                ledgerRows.push({
                    id: `${receipt.id}-${item.id}-bulk`,
                    site: siteLabel,
                    receiptDate: receipt.receivedDate,
                    reference,
                    materialNumberCp: item.product.materialNumber,
                    materialDescription: item.product.materialDescription,
                    receivedQty: item.confirmedQty,
                    reservedQty,
                    usedQty,
                    reversedQty: 0,
                    remainingQty: item.confirmedQty - reservedQty - usedQty,
                    ageDays: getDaysSince(receipt.receivedDate),
                    confirmedBy: receipt.confirmedByUser?.name || "System",
                })
            }
        }

        const warehouseSummaryMap = new Map<number, {
            warehouseId: number
            site: string
            receivedQty: number
            reservedQty: number
            usedQty: number
            reversedQty: number
            remainingQty: number
            giQty: number
            invoicedQty: number
            openMrkoQty: number
        }>()

        const warehouseById = new Map<number, { sloc: string; description?: string | null }>()
        for (const receipt of filteredReceipts) {
            if (receipt.transfer?.toWarehouse?.id) {
                warehouseById.set(receipt.transfer.toWarehouse.id, receipt.transfer.toWarehouse)
            }
        }
        for (const voucher of vouchers) {
            if (voucher.warehouse?.id) {
                warehouseById.set(voucher.warehouse.id, voucher.warehouse)
            }
        }
        for (const giRecord of giRecords) {
            if (giRecord.warehouse?.id) {
                warehouseById.set(giRecord.warehouse.id, giRecord.warehouse)
            }
        }

        for (const [warehouseId, warehouse] of warehouseById.entries()) {
            warehouseSummaryMap.set(warehouseId, {
                warehouseId,
                site: formatEvhsWarehouseLabel(warehouse),
                receivedQty: 0,
                reservedQty: 0,
                usedQty: 0,
                reversedQty: 0,
                remainingQty: 0,
                giQty: 0,
                invoicedQty: 0,
                openMrkoQty: 0,
            })
        }

        for (const ledgerRow of ledgerRows) {
            const warehouseEntry = Array.from(warehouseSummaryMap.values()).find((entry) => entry.site === ledgerRow.site)
            if (!warehouseEntry) continue

            warehouseEntry.receivedQty += ledgerRow.receivedQty
            warehouseEntry.reservedQty += ledgerRow.reservedQty
            warehouseEntry.usedQty += ledgerRow.usedQty
            warehouseEntry.reversedQty += ledgerRow.reversedQty
            warehouseEntry.remainingQty += ledgerRow.remainingQty
        }

        for (const giRecord of giRecords) {
            if (!giRecord.warehouseId || !warehouseSummaryMap.has(giRecord.warehouseId)) continue

            const warehouseEntry = warehouseSummaryMap.get(giRecord.warehouseId)
            if (!warehouseEntry) continue

            warehouseEntry.giQty += giRecord.items.reduce((total: number, item: EvhsMatchedGiItem) => total + Number(item.qty || 0), 0)
        }

        for (const voucher of vouchers) {
            if (!voucher.warehouseId || !warehouseSummaryMap.has(voucher.warehouseId)) continue

            const warehouseEntry = warehouseSummaryMap.get(voucher.warehouseId)
            if (!warehouseEntry) continue

            const voucherQty = voucher.items.reduce((total: number, item: EvhsMatchedVoucherItem) => total + Number(item.qty || 0), 0)

            if (voucher.sapInvoiceNo) {
                warehouseEntry.invoicedQty += voucherQty
            }

            if (voucher.mrkoStatus !== "SETTLED") {
                warehouseEntry.openMrkoQty += voucherQty
            }
        }

        const matchedGiRecordIds = new Set<number>()
        const exceptionCenter: Array<{
            id: string
            category: string
            severity: "high" | "medium"
            site: string
            reference: string
            detail: string
            ageDays: number
        }> = []

        for (const [duplicateKey, duplicate] of duplicateSerialMap.entries()) {
            if (duplicate.references.length <= 1) continue

            exceptionCenter.push({
                id: `duplicate-sn-${duplicateKey}`,
                category: "Duplicate SN",
                severity: "high",
                site: duplicate.site,
                reference: duplicate.references[0],
                detail: `Serial ${duplicate.serialNumber} muncul pada ${duplicate.references.length} receipt: ${duplicate.references.join(", ")}`,
                ageDays: 0,
            })
        }

        for (const ledgerRow of ledgerRows) {
            if (ledgerRow.remainingQty < 0) {
                exceptionCenter.push({
                    id: `over-issued-${ledgerRow.id}`,
                    category: "Qty Over-Issued",
                    severity: "high",
                    site: ledgerRow.site,
                    reference: ledgerRow.reference,
                    detail: `Saldo negatif ${Math.abs(ledgerRow.remainingQty)} pada ${ledgerRow.materialNumberCp}.`,
                    ageDays: ledgerRow.ageDays,
                })
            }

            if (ledgerRow.remainingQty > 0 && ledgerRow.ageDays > 30) {
                exceptionCenter.push({
                    id: `idle-stock-${ledgerRow.id}`,
                    category: "Stock Aging",
                    severity: "medium",
                    site: ledgerRow.site,
                    reference: ledgerRow.reference,
                    detail: `Stok ${ledgerRow.materialNumberCp} masih tersisa ${ledgerRow.remainingQty} setelah ${ledgerRow.ageDays} hari.`,
                    ageDays: ledgerRow.ageDays,
                })
            }
        }

        let voucherPendingGiQty = 0
        let giPendingMrkoQty = 0
        let mrkoPendingInvoiceQty = 0
        const agingBuckets = {
            pendingGi: { "0-3 hari": 0, "4-7 hari": 0, ">7 hari": 0 },
            giPendingMrko: { "0-3 hari": 0, "4-7 hari": 0, ">7 hari": 0 },
            mrkoPendingInvoice: { "0-3 hari": 0, "4-7 hari": 0, ">7 hari": 0 },
        }

        for (const voucher of vouchers) {
            const voucherAge = getDaysSince(voucher.createdAt)

            for (const voucherItem of voucher.items) {
                if (!voucherItem.materialNumberCk) {
                    exceptionCenter.push({
                        id: `missing-ck-${voucher.id}-${voucherItem.id}`,
                        category: "Material CK Missing",
                        severity: "medium",
                        site: formatEvhsWarehouseLabel(voucher.warehouse),
                        reference: voucher.vhsNo,
                        detail: `Material CP ${voucherItem.product?.materialNumber || voucherItem.productId} belum punya material CK.`,
                        ageDays: voucherAge,
                    })
                }

                const matchedGi = getEvhsMatchedGiRecord(voucher, voucherItem, giRecords)
                if (matchedGi?.id) {
                    matchedGiRecordIds.add(matchedGi.id)
                }

                if (!matchedGi) {
                    voucherPendingGiQty += Number(voucherItem.qty || 0)
                    agingBuckets.pendingGi[getAgingBucket(voucherAge)] += Number(voucherItem.qty || 0)
                    exceptionCenter.push({
                        id: `gi-unmatched-${voucher.id}-${voucherItem.id}`,
                        category: "GI Unmatched",
                        severity: "high",
                        site: formatEvhsWarehouseLabel(voucher.warehouse),
                        reference: voucher.vhsNo,
                        detail: `Item ${voucherItem.product?.materialNumber || voucherItem.productId} belum menemukan GI pasangan.`,
                        ageDays: voucherAge,
                    })
                }

                if (matchedGi && voucher.mrkoStatus !== "SETTLED") {
                    giPendingMrkoQty += Number(voucherItem.qty || 0)
                    agingBuckets.giPendingMrko[getAgingBucket(voucherAge)] += Number(voucherItem.qty || 0)
                }

                if (voucher.mrkoStatus === "SETTLED" && !voucher.sapInvoiceNo) {
                    const settledAge = getDaysSince(voucher.settledDate || voucher.updatedAt || voucher.createdAt)
                    mrkoPendingInvoiceQty += Number(voucherItem.qty || 0)
                    agingBuckets.mrkoPendingInvoice[getAgingBucket(settledAge)] += Number(voucherItem.qty || 0)
                }
            }

            if (voucher.mrkoStatus !== "SETTLED" && voucherAge > 7) {
                exceptionCenter.push({
                    id: `mrko-overdue-${voucher.id}`,
                    category: "MRKO Overdue",
                    severity: "medium",
                    site: formatEvhsWarehouseLabel(voucher.warehouse),
                    reference: voucher.vhsNo,
                    detail: `Voucher masih OPEN selama ${voucherAge} hari dan belum settle MRKO.`,
                    ageDays: voucherAge,
                })
            }
        }

        for (const giRecord of giRecords) {
            if (matchedGiRecordIds.has(giRecord.id)) continue

            exceptionCenter.push({
                id: `orphan-gi-${giRecord.id}`,
                category: "GI Unmatched",
                severity: "medium",
                site: formatEvhsWarehouseLabel(giRecord.warehouse),
                reference: giRecord.documentNo || giRecord.woNo || `GI ${giRecord.id}`,
                detail: "Dokumen GI belum punya voucher pasangan.",
                ageDays: getDaysSince(giRecord.createdAt),
            })
        }

        const summary = ledgerRows.reduce((acc, row) => {
            acc.receivedQty += row.receivedQty
            acc.reservedQty += row.reservedQty
            acc.usedQty += row.usedQty
            acc.reversedQty += row.reversedQty
            acc.remainingQty += row.remainingQty
            return acc
        }, {
            receivedQty: 0,
            reservedQty: 0,
            usedQty: 0,
            reversedQty: 0,
            remainingQty: 0,
        })

        const auditTrail = [
            ...filteredReceipts.map((receipt) => ({
                id: `receipt-${receipt.id}`,
                timestamp: receipt.receivedDate,
                type: "Receipt Confirmed",
                actor: receipt.confirmedByUser?.name || "System",
                reference: receipt.doChitraNo || receipt.transfer?.referenceNumber || `Receipt ${receipt.id}`,
                detail: `${receipt.items.length} item diterima di ${formatEvhsWarehouseLabel(receipt.transfer?.toWarehouse)}`,
            })),
            ...vouchers.map((voucher) => ({
                id: `voucher-issued-${voucher.id}`,
                timestamp: voucher.createdAt,
                type: "Voucher Issued",
                actor: voucher.issuedByUser?.name || "System",
                reference: voucher.vhsNo,
                detail: `WO ${voucher.woNo || "-"} / ${voucher.items.length} item`,
            })),
            ...vouchers
                .filter((voucher) => new Date(voucher.updatedAt).getTime() > new Date(voucher.createdAt).getTime() + 1000)
                .map((voucher) => ({
                    id: `voucher-updated-${voucher.id}`,
                    timestamp: voucher.updatedAt,
                    type: "Voucher Updated",
                    actor: voucher.issuedByUser?.name || "System",
                    reference: voucher.vhsNo,
                    detail: "WO, material CK, POS, unit, atau remark terakhir diperbarui.",
                })),
            ...vouchers
                .filter((voucher) => voucher.mrkoStatus === "SETTLED" && voucher.settledDate)
                .map((voucher) => ({
                    id: `mrko-settled-${voucher.id}`,
                    timestamp: voucher.settledDate!,
                    type: "MRKO Settled",
                    actor: voucher.issuedByUser?.name || "System",
                    reference: voucher.mrkoNo || voucher.vhsNo,
                    detail: `Invoice ${voucher.sapInvoiceNo || "-"} / voucher ${voucher.vhsNo}`,
                })),
        ]
            .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
            .slice(0, 12)

        return {
            summary,
            ledgerRows,
            reconciliationByWarehouse: Array.from(warehouseSummaryMap.values()).sort((left, right) => left.site.localeCompare(right.site)),
            aging: {
                idleStockQty: ledgerRows
                    .filter((row) => row.remainingQty > 0 && row.ageDays > 30)
                    .reduce((total, row) => total + row.remainingQty, 0),
                voucherPendingGiQty,
                giPendingMrkoQty,
                mrkoPendingInvoiceQty,
                buckets: agingBuckets,
            },
            exceptionCenter: exceptionCenter
                .sort((left, right) => {
                    if (left.severity !== right.severity) {
                        return left.severity === "high" ? -1 : 1
                    }
                    return right.ageDays - left.ageDays
                })
                .slice(0, 25),
            auditTrail,
        }
    } catch (error) {
        console.error("Error fetching EVHS control tower data:", error)
        return {
            summary: {
                receivedQty: 0,
                reservedQty: 0,
                usedQty: 0,
                reversedQty: 0,
                remainingQty: 0,
            },
            ledgerRows: [],
            reconciliationByWarehouse: [],
            aging: {
                idleStockQty: 0,
                voucherPendingGiQty: 0,
                giPendingMrkoQty: 0,
                mrkoPendingInvoiceQty: 0,
                buckets: {
                    pendingGi: { "0-3 hari": 0, "4-7 hari": 0, ">7 hari": 0 },
                    giPendingMrko: { "0-3 hari": 0, "4-7 hari": 0, ">7 hari": 0 },
                    mrkoPendingInvoice: { "0-3 hari": 0, "4-7 hari": 0, ">7 hari": 0 },
                },
            },
            exceptionCenter: [],
            auditTrail: [],
        }
    }
}
