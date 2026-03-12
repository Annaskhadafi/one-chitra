"use server"

import { db } from "@/db"
import { deliveries, deliveryItems, salesOrders, stockLevels, products, stockTransfers, stockTransferItems } from "@/db/schema"
import { eq, desc, and, sql, isNotNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { saveCustomerAddress } from "./customer"
import { deliverySchema } from "@/lib/schemas"
import { checkPermission, getAuthenticatedSession } from "@/lib/rbac"
import { deleteFile } from "./upload"
import { recordStockMovement } from "./stock-movement"

const isConsignmentCategory = (categoryPo: string | null | undefined) => {
    const normalized = (categoryPo ?? "").trim().toLowerCase()
    return normalized.includes("vhs") || normalized.includes("consignment")
}

const buildDeliveryItemQuantityMap = (
    items: Array<{ productId: number; deliveredQuantity: number; salesOrderItemId?: number | null }>,
) => {
    const result = new Map<string, number>()
    for (const item of items) {
        const key = `${item.productId}:${item.salesOrderItemId ?? "null"}`
        result.set(key, (result.get(key) ?? 0) + item.deliveredQuantity)
    }
    return result
}

const isSameDeliveryItemComposition = (
    originalItems: Array<{ productId: number; deliveredQuantity: number; salesOrderItemId?: number | null }>,
    newItems: Array<{ productId: number; deliveredQuantity: number; salesOrderItemId?: number | null }>,
) => {
    const left = buildDeliveryItemQuantityMap(originalItems)
    const right = buildDeliveryItemQuantityMap(newItems)

    if (left.size !== right.size) {
        return false
    }

    for (const [key, qty] of left.entries()) {
        if ((right.get(key) ?? null) !== qty) {
            return false
        }
    }

    return true
}

export async function getDeliveries() {
    return await db.query.deliveries.findMany({
        with: {
            salesOrder: {
                with: {
                    customer: true,
                    warehouse: true,
                    items: true,
                },
            },
            warehouse: true,
            createdByUser: true,
            items: {
                with: {
                    product: true,
                },
            },
        },
        orderBy: [desc(deliveries.createdAt)],
    })
}

export async function getDeliveryItemsFlat() {
    const allDeliveries = await db.query.deliveries.findMany({
        with: {
            salesOrder: {
                with: { 
                    customer: true,
                    warehouse: true 
                },
            },
            warehouse: true,
            createdByUser: true,
            items: {
                with: { product: true },
            },
        },
        orderBy: [desc(deliveries.createdAt)],
    })

    // Flatten: satu baris per item produk
    return allDeliveries.flatMap(delivery =>
        delivery.items.map(item => ({
            itemId: item.id,
            productId: item.productId,
            productName: item.product?.materialDescription || item.product?.materialNumber || "-",
            productNumber: item.product?.materialNumber || "-",
            oldMaterialNo: item.product?.oldMaterialNo || "-",
            productCategory: item.product?.category || "-",
            orderedQuantity: item.orderedQuantity,
            deliveredQuantity: item.deliveredQuantity,
            serialNumbers: item.serialNumbers,
            deliveryId: delivery.id,
            deliveryNumber: delivery.deliveryNumber,
            doSap: delivery.doSap,
            scheduledDate: delivery.scheduledDate,
            deliveryDate: delivery.deliveryDate,
            status: delivery.status,
            deliveryType: delivery.deliveryType,
            driverName: delivery.driverName,
            vehicleNumber: delivery.vehicleNumber,
            isExternal: delivery.isExternal,
            vendorName: delivery.vendorName,
            salesOrderId: delivery.salesOrderId,
            invoiceNumber: delivery.salesOrder?.invoiceNumber,
            customerPo: delivery.salesOrder?.customerPo,
            customerName: delivery.salesOrder?.customer?.name,
            customerId: delivery.salesOrder?.customer?.id,
            warehouseId: delivery.warehouseId,
            warehouseName: delivery.warehouse?.description || delivery.warehouse?.sloc,
            createdByName: delivery.createdByUser?.name || null,
        }))
    )
}

export async function getDelivery(id: number) {
    return await db.query.deliveries.findFirst({
        where: eq(deliveries.id, id),
        with: {
            salesOrder: {
                with: {
                    customer: true,
                    items: {
                        with: {
                            product: true,
                        },
                    },
                },
            },
            warehouse: true,
            items: {
                with: {
                    product: true,
                    salesOrderItem: true,
                },
            },
        },
    })
}

export async function getSalesOrdersForDelivery() {
    // Get confirmed sales orders with their items and already-delivered quantities
    const orders = await db.query.salesOrders.findMany({
        where: eq(salesOrders.status, "confirmed"),
        with: {
            customer: true,
            items: {
                with: {
                    product: true,
                },
            },
        },
        orderBy: [desc(salesOrders.createdAt)],
    })

    // For each SO, calculate already-delivered quantities (excluding cancelled deliveries)
    const allDeliveryItems = await db.select({
        salesOrderItemId: deliveryItems.salesOrderItemId,
        totalDelivered: sql<number>`COALESCE(SUM(${deliveryItems.deliveredQuantity}), 0)`,
    })
        .from(deliveryItems)
        .innerJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
        .where(sql`${deliveries.status} != 'cancelled'`)
        .groupBy(deliveryItems.salesOrderItemId)

    const deliveredMap = new Map<number, number>()
    for (const di of allDeliveryItems) {
        if (di.salesOrderItemId) {
            deliveredMap.set(di.salesOrderItemId, Number(di.totalDelivered))
        }
    }

    // Filter out fully delivered SOs and attach remaining qty info
    return orders.map(order => ({
        ...order,
        items: order.items.map(item => ({
            ...item,
            alreadyDelivered: deliveredMap.get(item.id) || 0,
            remainingQuantity: item.quantity - (deliveredMap.get(item.id) || 0),
        })),
    })).filter(order => order.items.some(item => item.remainingQuantity > 0))
}

export async function checkStockAvailability(warehouseId: number, items: { productId: number; quantity: number }[]) {
    const results: {
        productId: number;
        requested: number;
        available: number;
        sufficient: boolean;
        alternativeIds?: { id: number; stock: number; description: string }[];
        otherWarehouses?: { warehouseId: number; warehouseName: string; stock: number }[];
    }[] = []

    console.log(`[STOCKS] Checking warehouse ${warehouseId}, items:`, items)

    for (const item of items) {
        // 1. Get exact product stock in requested warehouse
        const stockRecord = await db.query.stockLevels.findFirst({
            where: and(
                eq(stockLevels.warehouseId, warehouseId),
                eq(stockLevels.productId, item.productId),
            )
        })

        const directAvailable = stockRecord ? stockRecord.totalStock : 0

        let totalAvailable = directAvailable
        const alternatives: { id: number; stock: number; description: string }[] = []

        // 2. Smart Check: look for other products with same description in requested warehouse
        const currentProduct = await db.query.products.findFirst({
            where: eq(products.id, item.productId)
        })

        if (currentProduct?.materialDescription) {
            // Find other products with SAME description
            const relatedProducts = await db.query.products.findMany({
                where: and(
                    eq(products.materialDescription, currentProduct.materialDescription),
                    sql`${products.id} != ${item.productId}`
                )
            })

            for (const rel of relatedProducts) {
                const relStock = await db.query.stockLevels.findFirst({
                    where: and(
                        eq(stockLevels.warehouseId, warehouseId),
                        eq(stockLevels.productId, rel.id)
                    )
                })
                if (relStock && relStock.totalStock > 0) {
                    alternatives.push({
                        id: rel.id,
                        stock: relStock.totalStock,
                        description: rel.materialDescription || ""
                    })
                    totalAvailable += relStock.totalStock
                }
            }
        }

        // 3. Check other warehouses for the same product
        const otherWarehouseStocks = await db.query.stockLevels.findMany({
            where: and(
                eq(stockLevels.productId, item.productId),
                sql`${stockLevels.warehouseId} != ${warehouseId}`,
                sql`${stockLevels.totalStock} > 0`
            ),
            with: {
                warehouse: true
            }
        })

        const otherWarehouses = otherWarehouseStocks.map(sw => ({
            warehouseId: sw.warehouseId,
            warehouseName: sw.warehouse?.description || sw.warehouse?.sloc || "Unknown",
            stock: sw.totalStock
        }))

        const sufficient = totalAvailable >= item.quantity

        const result = {
            productId: item.productId,
            requested: item.quantity,
            available: directAvailable,
            sufficient,
            alternativeIds: alternatives.length > 0 ? alternatives : undefined,
            otherWarehouses: otherWarehouses.length > 0 ? otherWarehouses : undefined
        }

        console.log(`[STOCKS] Product ${item.productId}: available=${directAvailable}, alternatives=${alternatives.length}, otherWHs=${otherWarehouses.length}`)
        results.push(result)
    }

    return results
}

export async function generateDeliveryNumber() {
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`

    // Use SQL to count instead of fetching everything
    const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(deliveries)
        .where(sql`${deliveries.deliveryNumber} LIKE ${`DLV-${dateStr}-%`}`)

    const nextNum = (Number(result?.count) || 0) + 1
    
    // Safety check: if the number exists, increment until we find a free one
    let finalNum = nextNum
    let exists = true
    let finalDeliveryNumber = ""

    while (exists) {
        finalDeliveryNumber = `DLV-${dateStr}-${String(finalNum).padStart(4, "0")}`
        const check = await db.query.deliveries.findFirst({
            where: eq(deliveries.deliveryNumber, finalDeliveryNumber),
            columns: { id: true }
        })
        if (!check) {
            exists = false
        } else {
            finalNum++
        }
    }

    return finalDeliveryNumber
}

export async function createDelivery(data: z.infer<typeof deliverySchema>) {
    console.log("[CREATE DELIVERY] Starting...")
    try {
        console.log("[CREATE DELIVERY] Getting session...")
        const session = await getAuthenticatedSession('deliveries', 'create')
        const userId = session.user.id
        console.log("[CREATE DELIVERY] User ID:", userId)

        const deliveryNumber = data.deliveryNumber || await generateDeliveryNumber()
        console.log("[CREATE DELIVERY] Delivery Number:", deliveryNumber)

        return await db.transaction(async (tx) => {
            console.log("[CREATE DELIVERY] Starting transaction...")

            const [newDelivery] = await tx.insert(deliveries)
                .values({
                    deliveryNumber,
                    doSap: data.doSap || null,
                    salesOrderId: data.salesOrderId,
                    createdBy: userId,
                    scheduledDate: new Date(data.scheduledDate),
                    deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
                    status: data.status,
                    deliveryType: data.deliveryType,
                    // Internal Fleet
                    driverName: data.driverName || null,
                    vehicleNumber: data.vehicleNumber || null,
                    vehicleType: data.vehicleType || null,
                    // External Delivery
                    isExternal: data.isExternal || false,
                    vendorName: data.vendorName || null,
                    awbNumber: data.awbNumber || null,
                    shippingCost: data.shippingCost ? String(data.shippingCost) : "0",
                    // Internal Cost Breakdown
                    tripDestination: data.tripDestination || null,
                    costGasolineDexlite: data.costGasolineDexlite ? String(data.costGasolineDexlite) : "0",
                    costGasolineBio: data.costGasolineBio ? String(data.costGasolineBio) : "0",
                    costToll: data.costToll ? String(data.costToll) : "0",
                    costParking: data.costParking ? String(data.costParking) : "0",
                    costMeals: data.costMeals ? String(data.costMeals) : "0",
                    costMaintenance: data.costMaintenance ? String(data.costMaintenance) : "0",
                    costOthers: data.costOthers ? String(data.costOthers) : "0",
                    costRapidTest: data.costRapidTest ? String(data.costRapidTest) : "0",
                    costFerry: data.costFerry ? String(data.costFerry) : "0",
                    costPortal: data.costPortal ? String(data.costPortal) : "0",
                    costWashing: data.costWashing ? String(data.costWashing) : "0",
                    costEscort: data.costEscort ? String(data.costEscort) : "0",

                    warehouseId: data.warehouseId,
                    warehouseToId: data.warehouseToId,
                    shippingAddress: data.shippingAddress || null,
                    notes: data.notes || null,
                })
                .returning()

            console.log("[CREATE DELIVERY] Delivery created, ID:", newDelivery.id)

            // Save Address to history
            if (data.shippingAddress) {
                const so = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, data.salesOrderId),
                    columns: { customerId: true }
                })
                if (so?.customerId) {
                    await saveCustomerAddress(so.customerId, data.shippingAddress)
                }
            }

            if (data.items.length > 0) {
                console.log("[CREATE DELIVERY] Inserting items...")
                await tx.insert(deliveryItems)
                    .values(data.items.map(item => ({
                        deliveryId: newDelivery.id,
                        salesOrderItemId: item.salesOrderItemId || null,
                        productId: item.productId,
                        orderedQuantity: item.orderedQuantity,
                        deliveredQuantity: item.deliveredQuantity,
                        serialNumbers: item.serialNumbers || null,
                    })))

                console.log("[CREATE DELIVERY] Items inserted")

                // Handle Stock Transfer automation for VHS/Consignment or any delivery with destination warehouse
                console.log("[CREATE DELIVERY] Checking for stock transfer...")
                const order = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, data.salesOrderId),
                    columns: { categoryPo: true, customerId: true }
                })

                const hasDestination = data.warehouseToId && data.warehouseToId !== 0
                const isCancelled = data.status === "cancelled"

                if (hasDestination && !isCancelled) {
                    console.log("[CREATE DELIVERY] Creating stock transfer...")
                    const referenceNumber = `ST-AUTO-${newDelivery.deliveryNumber}`
                    const [transfer] = await tx.insert(stockTransfers).values({
                        referenceNumber,
                        deliveryId: newDelivery.id,
                        fromWarehouseId: data.warehouseId as number,
                        toWarehouseId: data.warehouseToId as number,
                        receivedStatus: "Scheduled",
                        transferDate: new Date(data.scheduledDate),
                        notes: `Automated transfer from delivery ${newDelivery.deliveryNumber}`,
                    }).returning()

                    await tx.insert(stockTransferItems).values(
                        data.items.map(item => ({
                            transferId: transfer.id,
                            productId: item.productId,
                            quantity: item.deliveredQuantity,
                        }))
                    )

                    // NOTE: Stock ke destination warehouse akan ditambah saat transfer di-mark "Received"
                    // Tidak ada perubahan stock destination di sini untuk menghindari double count.

                    console.log("[CREATE DELIVERY] Stock transfer created (Scheduled, awaiting Received confirmation)")
                }

                // Deduct stock for all statuses EXCEPT cancelled
                const isCommitted = data.status !== "cancelled"

                if (isCommitted) {
                    console.log("[CREATE DELIVERY] Deducting stock...")
                    const movementType = hasDestination ? "TRANSFER_OUT" : "DELIVERY"

                    for (const item of data.items) {
                        // Deduct total stock AND booked stock
                        await tx.update(stockLevels)
                            .set({
                                totalStock: sql`${stockLevels.totalStock} - ${item.deliveredQuantity}`,
                                bookedStock: sql`${stockLevels.bookedStock} - ${item.deliveredQuantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, data.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))

                        // Record Movement with customer and warehouse info
                        await recordStockMovement(tx, {
                            productId: item.productId,
                            warehouseId: data.warehouseId,
                            quantity: -item.deliveredQuantity, // Negative for Out
                            type: movementType,
                            referenceNumber: deliveryNumber,
                            recordedBy: userId,
                            customerId: order?.customerId ?? undefined,
                            fromWarehouseId: hasDestination ? (data.warehouseId ?? undefined) : undefined,
                            toWarehouseId: hasDestination ? (data.warehouseToId ?? undefined) : undefined,
                            notes: hasDestination ? `Transfer OUT ke warehouse tujuan` : `Delivery ke customer`,
                        })
                    }
                    console.log("[CREATE DELIVERY] Stock deducted")
                }
            }

            // Enforce: jika SO punya >1 delivery aktif, semua harus 'partial'
            await syncDeliveryTypesForSO(tx, data.salesOrderId)

            if (data.status === "delivered") {
                console.log("[CREATE DELIVERY] Checking SO completion...")
                await checkAndCompleteSalesOrder(tx, data.salesOrderId)
                console.log("[CREATE DELIVERY] SO check completed")
            }

            try {
                revalidatePath("/dashboard/deliveries")
            } catch (_e) { }

            console.log("[CREATE DELIVERY] Transaction completed successfully")
            return { success: true, id: newDelivery.id }
        })
    } catch (error) {
        console.error("[CREATE DELIVERY] Error:", error)
        return { success: false, error: "Failed to create delivery: " + (error instanceof Error ? error.message : "Unknown error") }
    }
}

export async function updateDelivery(id: number, data: z.infer<typeof deliverySchema>) {
    try {
        const session = await getAuthenticatedSession('deliveries', 'edit')
        const userId = session.user.id

        return await db.transaction(async (tx) => {
            const originalDelivery = await tx.query.deliveries.findFirst({
                where: eq(deliveries.id, id),
                with: { items: true },
            })

            if (!originalDelivery) {
                console.error("[UPDATE DELIVERY] Delivery not found:", id)
                return { success: false, error: "Delivery not found" }
            }
            console.log("[UPDATE DELIVERY] Found original delivery:", id)

            // Revert stock if it was previously committed (not cancelled)
            // Check if original was VHS/Consignment
            const originalOrder = await tx.query.salesOrders.findFirst({
                where: eq(salesOrders.id, originalDelivery.salesOrderId),
                columns: { categoryPo: true, customerId: true }
            })
            const originalWasVHS = isConsignmentCategory(originalOrder?.categoryPo) && originalDelivery.warehouseToId
            const originalWasCommitted = originalDelivery.status !== "cancelled"
            const newIsCommitted = data.status !== "cancelled"

            const sameItemComposition = isSameDeliveryItemComposition(
                originalDelivery.items.map((item) => ({
                    productId: item.productId,
                    deliveredQuantity: item.deliveredQuantity,
                    salesOrderItemId: item.salesOrderItemId,
                })),
                data.items.map((item) => ({
                    productId: item.productId,
                    deliveredQuantity: item.deliveredQuantity,
                    salesOrderItemId: item.salesOrderItemId,
                })),
            )

            const hasWarehouseChanged = (originalDelivery.warehouseId ?? null) !== (data.warehouseId ?? null)
            const hasDestinationChanged = (originalDelivery.warehouseToId ?? null) !== (data.warehouseToId ?? null)

            const shouldReconcileStock =
                originalWasCommitted !== newIsCommitted ||
                hasWarehouseChanged ||
                hasDestinationChanged ||
                !sameItemComposition

            if (shouldReconcileStock && originalWasCommitted && originalDelivery.warehouseId) {
                const originalMovementType = originalWasVHS ? "TRANSFER_OUT" : "DELIVERY"
                for (const item of originalDelivery.items) {
                    await tx.update(stockLevels)
                        .set({
                            totalStock: sql`${stockLevels.totalStock} + ${item.deliveredQuantity}`,
                            bookedStock: sql`${stockLevels.bookedStock} + ${item.deliveredQuantity}`,
                            updatedAt: new Date(),
                        })
                        .where(and(
                            eq(stockLevels.warehouseId, originalDelivery.warehouseId),
                            eq(stockLevels.productId, item.productId)
                        ))

                    // Record Revert Movement
                    await recordStockMovement(tx, {
                        productId: item.productId,
                        warehouseId: originalDelivery.warehouseId,
                        quantity: item.deliveredQuantity, // Positive for Revert In
                        type: originalMovementType,
                        referenceNumber: originalDelivery.deliveryNumber ?? undefined,
                        recordedBy: userId ?? undefined,
                        customerId: originalOrder?.customerId ?? undefined,
                    })
                }
            }

            await tx.update(deliveries)
                .set({
                    deliveryNumber: data.deliveryNumber || undefined,
                    doSap: data.doSap || null,
                    salesOrderId: data.salesOrderId,
                    scheduledDate: new Date(data.scheduledDate),
                    deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
                    status: data.status,
                    deliveryType: data.deliveryType,
                    // Internal
                    driverName: data.driverName || null,
                    vehicleNumber: data.vehicleNumber || null,
                    vehicleType: data.vehicleType || null,
                    // External
                    isExternal: data.isExternal || false,
                    vendorName: data.vendorName || null,
                    awbNumber: data.awbNumber || null,
                    shippingCost: data.shippingCost ? String(data.shippingCost) : "0",
                    // Internal Cost Breakdown
                    tripDestination: data.tripDestination || null,
                    costGasolineDexlite: data.costGasolineDexlite ? String(data.costGasolineDexlite) : "0",
                    costGasolineBio: data.costGasolineBio ? String(data.costGasolineBio) : "0",
                    costToll: data.costToll ? String(data.costToll) : "0",
                    costParking: data.costParking ? String(data.costParking) : "0",
                    costMeals: data.costMeals ? String(data.costMeals) : "0",
                    costMaintenance: data.costMaintenance ? String(data.costMaintenance) : "0",
                    costOthers: data.costOthers ? String(data.costOthers) : "0",
                    costRapidTest: data.costRapidTest ? String(data.costRapidTest) : "0",
                    costFerry: data.costFerry ? String(data.costFerry) : "0",
                    costPortal: data.costPortal ? String(data.costPortal) : "0",
                    costWashing: data.costWashing ? String(data.costWashing) : "0",
                    costEscort: data.costEscort ? String(data.costEscort) : "0",

                    warehouseId: data.warehouseId,
                    warehouseToId: data.warehouseToId,
                    shippingAddress: data.shippingAddress || null,
                    notes: data.notes || null,
                    updatedAt: new Date(),
                })
                .where(eq(deliveries.id, id))

            // Save Address to history
            if (data.shippingAddress) {
                console.log("[UPDATE DELIVERY] Saving address to history...")
                const so = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, originalDelivery.salesOrderId),
                    columns: { customerId: true }
                })
                if (so?.customerId) {
                    const addrRes = await saveCustomerAddress(so.customerId, data.shippingAddress)
                    console.log("[UPDATE DELIVERY] Address save result:", addrRes)
                }
            }

            // Sync automated Stock Transfer
            const hasDestination = data.warehouseToId && data.warehouseToId !== 0
            const isCancelled = data.status === "cancelled"

            if (hasDestination && !isCancelled) {
                const existingTransfer = await tx.query.stockTransfers.findFirst({
                    where: eq(stockTransfers.deliveryId, id)
                })

                if (existingTransfer) {
                    await tx.update(stockTransfers)
                        .set({
                            fromWarehouseId: data.warehouseId,
                            toWarehouseId: data.warehouseToId as number,
                            transferDate: new Date(data.scheduledDate),
                            updatedAt: new Date(),
                        })
                        .where(eq(stockTransfers.id, existingTransfer.id))

                    // Update items
                    await tx.delete(stockTransferItems).where(eq(stockTransferItems.transferId, existingTransfer.id))
                    await tx.insert(stockTransferItems).values(
                        data.items.map(item => ({
                            transferId: existingTransfer.id,
                            productId: item.productId,
                            quantity: item.deliveredQuantity,
                        }))
                    )
                } else {
                    // Create if not exists
                    const referenceNumber = `ST-AUTO-${data.deliveryNumber || originalDelivery.deliveryNumber || ""}`
                    const [transfer] = await tx.insert(stockTransfers).values({
                        referenceNumber,
                        deliveryId: id,
                        fromWarehouseId: data.warehouseId as number,
                        toWarehouseId: data.warehouseToId as number,
                        receivedStatus: "Scheduled",
                        transferDate: new Date(data.scheduledDate),
                        notes: `Automated transfer from delivery ${data.deliveryNumber || originalDelivery.deliveryNumber || ""}`,
                    }).returning()

                    await tx.insert(stockTransferItems).values(
                        data.items.map(item => ({
                            transferId: transfer.id,
                            productId: item.productId,
                            quantity: item.deliveredQuantity,
                        }))
                    )
                }
            } else {
                // If no destination, remove existing automated transfer if any
                await tx.delete(stockTransfers).where(eq(stockTransfers.deliveryId, id))
            }

            // Replace items
            await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, id))

            if (data.items.length > 0) {
                await tx.insert(deliveryItems)
                    .values(data.items.map(item => ({
                        deliveryId: id,
                        salesOrderItemId: item.salesOrderItemId || null,
                        productId: item.productId,
                        orderedQuantity: item.orderedQuantity,
                        deliveredQuantity: item.deliveredQuantity,
                        serialNumbers: item.serialNumbers || null,
                    })))

                // Apply new stock deduction if now committed (not cancelled)
                // For VHS/Consignment, stock will be managed by the transfer
                const order = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, data.salesOrderId),
                    columns: { categoryPo: true, customerId: true }
                })
                const isVHSConsignment = isConsignmentCategory(order?.categoryPo) && data.warehouseToId

                if (shouldReconcileStock && newIsCommitted) {
                    const movementType = isVHSConsignment ? "TRANSFER_OUT" : "DELIVERY"
                    for (const item of data.items) {
                        await tx.update(stockLevels)
                            .set({
                                totalStock: sql`${stockLevels.totalStock} - ${item.deliveredQuantity}`,
                                bookedStock: sql`${stockLevels.bookedStock} - ${item.deliveredQuantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, data.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))

                        // Record New Movement
                        await recordStockMovement(tx, {
                            productId: item.productId,
                            warehouseId: data.warehouseId,
                            quantity: -item.deliveredQuantity, // Negative for Out
                            type: movementType,
                            referenceNumber: data.deliveryNumber ?? originalDelivery.deliveryNumber ?? undefined,
                            recordedBy: userId,
                            customerId: order?.customerId ?? undefined,
                            fromWarehouseId: hasDestination ? (data.warehouseId ?? undefined) : undefined,
                            toWarehouseId: hasDestination ? (data.warehouseToId ?? undefined) : undefined,
                            notes: hasDestination ? `Transfer OUT ke warehouse tujuan` : `Delivery ke customer`,
                        })
                    }
                }
            }

            // Enforce: jika SO punya >1 delivery aktif, semua harus 'partial'
            await syncDeliveryTypesForSO(tx, data.salesOrderId)

            if (data.status === "delivered") {
                await checkAndCompleteSalesOrder(tx, data.salesOrderId)
            }

            try {
                revalidatePath("/dashboard/deliveries")
            } catch (_e) { }
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to update delivery (GLOBAL CATCH):", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to update delivery" }
    }
}

export async function deleteDelivery(id: number) {
    try {
        await checkPermission('deliveries', 'delete')

        // Fetch delivery to check for assets and items
        const delivery = await db.query.deliveries.findFirst({
            where: eq(deliveries.id, id),
            with: { items: true }
        })

        if (!delivery) return { success: false, error: "Delivery not found" }

        // Start transaction
        return await db.transaction(async (tx) => {
            const session = await getAuthenticatedSession('deliveries', 'delete')
            const userId = session.user.id

            // Restore stock for items if the delivery was committed (not cancelled)
            // Check if it was VHS/Consignment
            const order = await tx.query.salesOrders.findFirst({
                where: eq(salesOrders.id, delivery.salesOrderId),
                columns: { categoryPo: true }
            })
            const wasVHS = order?.categoryPo === "VHS/Consignment" && delivery.warehouseToId
            const wasCommitted = delivery.status !== "cancelled"

            if (wasCommitted && delivery.warehouseId) {
                const movementType = wasVHS ? "TRANSFER_OUT" : "DELIVERY"
                for (const item of delivery.items) {
                    await tx.update(stockLevels)
                        .set({
                            totalStock: sql`${stockLevels.totalStock} + ${item.deliveredQuantity}`,
                            bookedStock: sql`${stockLevels.bookedStock} + ${item.deliveredQuantity}`, // Also restore booked stock
                            updatedAt: new Date(),
                        })
                        .where(and(
                            eq(stockLevels.warehouseId, delivery.warehouseId),
                            eq(stockLevels.productId, item.productId)
                        ))

                    // Record Revert Movement (from delete)
                    await recordStockMovement(tx, {
                        productId: item.productId,
                        warehouseId: delivery.warehouseId as number,
                        quantity: item.deliveredQuantity, // Positive for Revert In
                        type: movementType,
                        referenceNumber: delivery.deliveryNumber ?? undefined,
                        recordedBy: userId,
                    })
                }
            }

            // Permanent deletion of assets
            if (delivery.scanDoDocument) {
                await deleteFile(delivery.scanDoDocument)
            }

            // Permanent deletion of stock transfers
            await tx.delete(stockTransfers).where(eq(stockTransfers.deliveryId, id))

            // Permanent deletion of items
            await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, id))
            // Permanent deletion of the delivery record
            await tx.delete(deliveries).where(eq(deliveries.id, id))

            try {
                revalidatePath("/dashboard/deliveries")
                revalidatePath("/dashboard/inventory")
            } catch (_e) { }
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to delete delivery:", error)
        return { success: false, error: "Failed to delete delivery" }
    }
}

export async function bulkDeleteDeliveries(ids: number[]) {
    try {
        await checkPermission('deliveries', 'delete')

        return await db.transaction(async (tx) => {
            const session = await getAuthenticatedSession('deliveries', 'delete')
            const userId = session.user.id

            for (const id of ids) {
                const delivery = await tx.query.deliveries.findFirst({
                    where: eq(deliveries.id, id),
                    with: { items: true }
                })

                if (!delivery) continue

                // 1. Revert stock if it was committed
                const order = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, delivery.salesOrderId),
                    columns: { categoryPo: true }
                })
                const wasVHS = order?.categoryPo === "VHS/Consignment" && delivery.warehouseToId
                const wasCommitted = delivery.status !== "cancelled"

                if (wasCommitted && delivery.warehouseId) {
                    const movementType = wasVHS ? "TRANSFER_OUT" : "DELIVERY"
                    for (const item of delivery.items) {
                        await tx.update(stockLevels)
                            .set({
                                totalStock: sql`${stockLevels.totalStock} + ${item.deliveredQuantity}`,
                                bookedStock: sql`${stockLevels.bookedStock} + ${item.deliveredQuantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, delivery.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))

                        await recordStockMovement(tx, {
                            productId: item.productId,
                            warehouseId: delivery.warehouseId as number,
                            quantity: item.deliveredQuantity,
                            type: movementType,
                            referenceNumber: delivery.deliveryNumber ?? undefined,
                            recordedBy: userId,
                        })
                    }
                }

                // 2. Cleanup assets
                if (delivery.scanDoDocument) {
                    await deleteFile(delivery.scanDoDocument)
                }

                // 3. Delete items, transfers and record
                await tx.delete(stockTransfers).where(eq(stockTransfers.deliveryId, id))
                await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, id))
                await tx.delete(deliveries).where(eq(deliveries.id, id))
            }

            try {
                revalidatePath("/dashboard/deliveries")
                revalidatePath("/dashboard/inventory")
            } catch (_e) { }
            return { success: true }
        })
    } catch (error) {
        console.error("Bulk delete deliveries error:", error)
        return { success: false, error: "Failed to delete deliveries" }
    }
}

export async function bulkUpdateDeliveryStatus(ids: number[], status: string) {
    try {
        await checkPermission('deliveries', 'edit')

        return await db.transaction(async (tx) => {
            const session = await getAuthenticatedSession('deliveries', 'edit')
            const userId = session.user.id

            for (const id of ids) {
                const delivery = await tx.query.deliveries.findFirst({
                    where: eq(deliveries.id, id),
                    with: { items: true }
                })

                if (!delivery) continue

                const order = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, delivery.salesOrderId),
                    columns: { categoryPo: true }
                })
                const isVHS = order?.categoryPo === "VHS/Consignment" && delivery.warehouseToId

                // Logic for status transitions:
                // 1. From non-cancelled to cancelled: REVERT stock
                if (delivery.status !== "cancelled" && status === "cancelled") {
                    if (delivery.warehouseId) {
                        const movementType = isVHS ? "TRANSFER_OUT" : "DELIVERY"
                        for (const item of delivery.items) {
                            await tx.update(stockLevels)
                                .set({
                                    totalStock: sql`${stockLevels.totalStock} + ${item.deliveredQuantity}`,
                                    bookedStock: sql`${stockLevels.bookedStock} + ${item.deliveredQuantity}`,
                                    updatedAt: new Date(),
                                })
                                .where(and(
                                    eq(stockLevels.warehouseId, delivery.warehouseId),
                                    eq(stockLevels.productId, item.productId)
                                ))

                            await recordStockMovement(tx, {
                                productId: item.productId,
                                warehouseId: delivery.warehouseId as number,
                                quantity: item.deliveredQuantity,
                                type: movementType,
                                referenceNumber: delivery.deliveryNumber ?? undefined,
                                recordedBy: userId,
                            })
                        }
                    }

                    // Delete associated automated transfers if delivery is cancelled
                    await tx.delete(stockTransfers).where(eq(stockTransfers.deliveryId, id))
                }

                // 2. From cancelled to non-cancelled: APPLY stock
                if (delivery.status === "cancelled" && status !== "cancelled") {
                    if (delivery.warehouseId) {
                        const movementType = isVHS ? "TRANSFER_OUT" : "DELIVERY"
                        for (const item of delivery.items) {
                            await tx.update(stockLevels)
                                .set({
                                    totalStock: sql`${stockLevels.totalStock} - ${item.deliveredQuantity}`,
                                    bookedStock: sql`${stockLevels.bookedStock} - ${item.deliveredQuantity}`,
                                    updatedAt: new Date(),
                                })
                                .where(and(
                                    eq(stockLevels.warehouseId, delivery.warehouseId),
                                    eq(stockLevels.productId, item.productId)
                                ))

                            await recordStockMovement(tx, {
                                productId: item.productId,
                                warehouseId: delivery.warehouseId as number,
                                quantity: -item.deliveredQuantity,
                                type: movementType,
                                referenceNumber: delivery.deliveryNumber ?? undefined,
                                recordedBy: userId,
                            })
                        }
                    }

                    // Re-create automated transfer if it's VHS and moving back from cancelled
                    if (isVHS) {
                        const referenceNumber = `ST-AUTO-${delivery.deliveryNumber}`
                        const [transfer] = await tx.insert(stockTransfers).values({
                            referenceNumber,
                            deliveryId: delivery.id,
                            fromWarehouseId: delivery.warehouseId as number,
                            toWarehouseId: delivery.warehouseToId as number,
                            receivedStatus: "Scheduled",
                            transferDate: new Date(delivery.scheduledDate),
                            notes: `Automated transfer from delivery ${delivery.deliveryNumber}`,
                        }).returning()

                        await tx.insert(stockTransferItems).values(
                            delivery.items.map(item => ({
                                transferId: transfer.id,
                                productId: item.productId,
                                quantity: item.deliveredQuantity,
                            }))
                        )
                    }
                }

                // Update status
                await tx.update(deliveries)
                    .set({ status, updatedAt: new Date() })
                    .where(eq(deliveries.id, id))

                if (status === "delivered") {
                    await checkAndCompleteSalesOrder(tx, delivery.salesOrderId)
                }
            }

            try {
                revalidatePath("/dashboard/deliveries")
                revalidatePath("/dashboard/inventory")
            } catch (_e) { }
            return { success: true }
        })
    } catch (_error) {
        console.error("Bulk update delivery status error:", _error)
        return { success: false, error: "Failed to update delivery status" }
    }
}

export async function updateDeliveryDate(id: number, date: Date | null) {
    try {
        await checkPermission('deliveries', 'edit')
        await db.update(deliveries)
            .set({ deliveryDate: date, updatedAt: new Date() })
            .where(eq(deliveries.id, id))
        try {
            revalidatePath("/dashboard/deliveries")
        } catch (_e) { }
        return { success: true }
    } catch (_error) {
        console.error("Failed to update delivery date:", _error)
        return { success: false, error: "Failed to update delivery date" }
    }
}

export async function updateDoMonitoringFields(id: number, data: {
    returnDoDate?: Date | null,
    invoiceNumber?: string | null,
    invoiceDate?: Date | null,
    doStatus?: string,
    remark?: string | null,
    scanDoDocument?: string | null,
}) {
    try {
        await checkPermission('deliveries', 'edit')

        // Build update object dynamically to support partial updates
        const updateData: Partial<typeof deliveries.$inferInsert> = {
            updatedAt: new Date(),
        }

        if (data.returnDoDate !== undefined) updateData.returnDoDate = data.returnDoDate
        if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber
        if (data.invoiceDate !== undefined) updateData.invoiceDate = data.invoiceDate
        if (data.doStatus !== undefined) updateData.doStatus = data.doStatus
        if (data.remark !== undefined) updateData.remark = data.remark
        if (data.scanDoDocument !== undefined) updateData.scanDoDocument = data.scanDoDocument

        await db.update(deliveries)
            .set(updateData)
            .where(eq(deliveries.id, id))

        if (data.doStatus === "Delivered") {
            const delivery = await db.query.deliveries.findFirst({
                where: eq(deliveries.id, id),
                columns: { salesOrderId: true }
            })
            if (delivery) {
                await db.transaction(async (tx) => {
                    await checkAndCompleteSalesOrder(tx, delivery.salesOrderId)
                })
            }
        }

        try {
            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/do-monitoring")
        } catch (_e) { }
        return { success: true }
    } catch (_error) {
        console.error("Failed to update DO Monitoring fields:", _error)
        return { success: false, error: "Failed to update DO Monitoring fields" }
    }
}

export async function checkAndCompleteSalesOrder(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], salesOrderId: number) {
    // 1. Fetch SO with items
    const order = await tx.query.salesOrders.findFirst({
        where: eq(salesOrders.id, salesOrderId),
        with: { items: true },
    })

    if (!order || order.status !== "confirmed") return

    // 2. Fetch all delivered quantities for this SO
    const deliveredItems = await tx.select({
        salesOrderItemId: deliveryItems.salesOrderItemId,
        totalDelivered: sql<number>`COALESCE(SUM(${deliveryItems.deliveredQuantity}), 0)`,
    })
        .from(deliveryItems)
        .innerJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
        .where(and(
            eq(deliveries.salesOrderId, salesOrderId),
            eq(deliveries.status, "delivered")
        ))
        .groupBy(deliveryItems.salesOrderItemId)


    const deliveredMap = new Map<number, number>()
    for (const d of deliveredItems) {
        if (d.salesOrderItemId) {
            deliveredMap.set(d.salesOrderItemId, Number(d.totalDelivered))
        }
    }

    // 3. Check if all items are fully delivered
    const isAllDelivered = order.items.every((item) => {
        const delivered = deliveredMap.get(item.id) || 0
        return delivered >= item.quantity
    })


    if (isAllDelivered) {
        await tx.update(salesOrders)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(salesOrders.id, salesOrderId))
        try {
            revalidatePath("/dashboard/sales-orders")
        } catch (_error) {
            // Context-specific error (handled for script environment)
        }
    }
}

export async function getLogisticsCosts() {
    try {
        await checkPermission('deliveries', 'view')

        const costs = await db.select({
            id: deliveries.id,
            deliveryNumber: deliveries.deliveryNumber,
            deliveryDate: deliveries.deliveryDate,
            scheduledDate: deliveries.scheduledDate,
            driverName: deliveries.driverName,
            vehicleNumber: deliveries.vehicleNumber,
            vendorName: deliveries.vendorName,
            isExternal: deliveries.isExternal,
            shippingCost: deliveries.shippingCost,
            costGasolineDexlite: deliveries.costGasolineDexlite,
            costGasolineBio: deliveries.costGasolineBio,
            costToll: deliveries.costToll,
            costParking: deliveries.costParking,
            costMeals: deliveries.costMeals,
            costMaintenance: deliveries.costMaintenance,
            costOthers: deliveries.costOthers,
            invoiceNumber: deliveries.invoiceNumber,
        })
            .from(deliveries)
            .where(isNotNull(deliveries.deliveryNumber))
            .orderBy(desc(deliveries.createdAt))

        return costs
    } catch (_error) {
        const error = _error as Error;
        console.error("Failed to fetch logistics costs:", error)
        return []
    }
}

export async function clearLogisticsCosts() {
    try {
        const session = await getAuthenticatedSession()
        const dbUser = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, session.user.id),
        })

        if (!dbUser || (dbUser.role.toLowerCase() !== "admin" && dbUser.role.toLowerCase() !== "superuser")) {
            throw new Error("Only Admin can clear logs")
        }

        await db.update(deliveries)
            .set({
                shippingCost: "0",
                costGasolineDexlite: "0",
                costGasolineBio: "0",
                costToll: "0",
                costParking: "0",
                costMeals: "0",
                costMaintenance: "0",
                costOthers: "0",
            })
            .where(isNotNull(deliveries.deliveryNumber))

        revalidatePath("/dashboard/logistics-costs")
        return { success: true }
    } catch (error) {
        console.error("Error clearing logistics costs:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to clear costs" }
    }
}

// ΓöÇΓöÇΓöÇ Business Rule: Sinkronisasi deliveryType antar delivery dalam satu SO ΓöÇΓöÇΓöÇΓöÇ
// Jika SO punya lebih dari 1 delivery (non-cancelled), semua harus "partial"
// Jika hanya 1 delivery tersisa, biarkan type-nya seperti yang dipilih user
async function syncDeliveryTypesForSO(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    salesOrderId: number
) {
    const siblings = await tx
        .select({ id: deliveries.id })
        .from(deliveries)
        .where(
            and(
                eq(deliveries.salesOrderId, salesOrderId),
                sql`${deliveries.status} != 'cancelled'`
            )
        )

    if (siblings.length > 1) {
        // Lebih dari 1 delivery aktif ΓåÆ semua harus partial
        await tx
            .update(deliveries)
            .set({ deliveryType: "partial", updatedAt: new Date() })
            .where(
                and(
                    eq(deliveries.salesOrderId, salesOrderId),
                    sql`${deliveries.status} != 'cancelled'`
                )
            )
    }
}
