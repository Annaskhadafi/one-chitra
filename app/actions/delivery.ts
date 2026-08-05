"use server"

import { db } from "@/db"
import { deliveries, deliveryItems, salesOrders, stockLevels, products, stockTransfers, stockTransferItems, warehouses, fleetTrips, settings } from "@/db/schema"
import { eq, desc, and, sql, isNotNull, inArray } from "drizzle-orm"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { z } from "zod"
import { saveCustomerAddress } from "./customer"
import { deliverySchema } from "@/lib/schemas"
import { checkPermission, getAuthenticatedSession } from "@/lib/rbac"
import { deleteFile } from "./upload"
import { recordStockMovement } from "./stock-movement"
import { sendDeliveryCreatedNotification, sendDeliveryDeliveredNotification } from "@/lib/delivery-notifications"
import { formatWarehouseLabel, normalizeSlocFields } from "@/lib/sloc"
import { recordActivity } from "@/lib/audit"
import { normalizeCodeValue, normalizeSapDocumentFields } from "@/lib/formatters"
import { consumeStockBookingsForDelivery, getStockBookingAvailability, restoreStockBookingsForDelivery } from "@/lib/stock-bookings"
import { buildBulkDeliveryShipmentDetailsUpdate, type BulkDeliveryShipmentDetailsInput } from "@/lib/delivery-bulk-shipment"

const isConsignmentCategory = (categoryPo: string | null | undefined) => {
    const normalized = (categoryPo ?? "").trim().toLowerCase()
    return normalized.includes("vhs") || normalized.includes("consignment")
}

const buildDeliveryItemQuantityMap = (
    items: Array<{ productId: number; deliveredQuantity: number; salesOrderItemId?: number | null }>,
) => {
    const result = new Map<string, number>()
    for (const item of items) {
        if (Number(item.deliveredQuantity) <= 0) {
            continue
        }
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

function normalizeDeliveryOutput<T>(value: T): T {
    return normalizeSapDocumentFields(normalizeSlocFields(value))
}

type StockQueryable = Pick<typeof db, "query" | "select">
type StockWriteExecutor = StockQueryable & Pick<typeof db, "execute">

type DeliveryItemLike = {
    id?: number
    deliveryId?: number
    salesOrderItemId?: number | null
    productId: number
    orderedQuantity: number
    deliveredQuantity: number
    serialNumbers?: string[] | null
    product?: unknown
    salesOrderItem?: unknown
}

function normalizeDeliverySerialNumbers(serialNumbers: string[] | null | undefined) {
    if (!serialNumbers?.length) {
        return null
    }

    const normalized = serialNumbers
        .map((serialNumber) => serialNumber?.trim())
        .filter((serialNumber): serialNumber is string => Boolean(serialNumber))

    if (normalized.length === 0) {
        return null
    }

    const uniqueSerialNumbers: string[] = []
    const seenSerialNumbers = new Set<string>()

    for (const serialNumber of normalized) {
        const normalizedKey = serialNumber.toUpperCase()
        if (seenSerialNumbers.has(normalizedKey)) {
            continue
        }
        seenSerialNumbers.add(normalizedKey)
        uniqueSerialNumbers.push(serialNumber)
    }

    return uniqueSerialNumbers.length > 0 ? uniqueSerialNumbers : null
}

function mergeDeliveryItemsByProduct<T extends DeliveryItemLike>(items: T[]): T[] {
    const mergedItems = new Map<string, T>()

    for (const item of items) {
        const key = `${item.productId}:${item.salesOrderItemId ?? "null"}`
        const existing = mergedItems.get(key)

        if (!existing) {
            mergedItems.set(key, {
                ...item,
                serialNumbers: normalizeDeliverySerialNumbers(item.serialNumbers),
            })
            continue
        }

        const mergedSerialNumbers = normalizeDeliverySerialNumbers([
            ...(existing.serialNumbers ?? []),
            ...(item.serialNumbers ?? []),
        ])
        const hasTrackedSerialNumbers = Boolean(mergedSerialNumbers?.length)

        mergedItems.set(key, {
            ...existing,
            // For serial-tracked items, duplicate rows should collapse into one logical line.
            orderedQuantity: hasTrackedSerialNumbers
                ? Math.max(Number(existing.orderedQuantity), Number(item.orderedQuantity), mergedSerialNumbers?.length ?? 0)
                : Number(existing.orderedQuantity) + Number(item.orderedQuantity),
            deliveredQuantity: hasTrackedSerialNumbers
                ? Math.max(
                    mergedSerialNumbers?.length ?? 0,
                    Number(existing.deliveredQuantity),
                    Number(item.deliveredQuantity),
                )
                : Number(existing.deliveredQuantity) + Number(item.deliveredQuantity),
            serialNumbers: mergedSerialNumbers,
        })
    }

    return Array.from(mergedItems.values())
}

function mergeDeliveryRows<T extends { items: DeliveryItemLike[] }>(rows: T[]): T[] {
    return rows.map((row) => ({
        ...row,
        items: mergeDeliveryItemsByProduct(row.items),
    }))
}

type DeliveryStockCheckInput = {
    productId: number
    quantity: number
}

type DeliveryStockCheckResult = {
    productId: number
    requested: number
    available: number
    remainingAfterDelivery: number
    shortage: number
    sufficient: boolean
    customerBooked: number
    bookedByOtherCustomers: number
    alternativeIds?: { id: number; stock: number; description: string }[]
    otherWarehouses?: { warehouseId: number; warehouseName: string; stock: number }[]
}

async function getOriginWarehouseStock(queryable: StockQueryable, warehouseId: number, productId: number) {
    // Look up the warehouse sloc and product materialNumber
    // Then find stock by matching sloc + materialNumber (not just IDs)
    // This handles cases where the same product/warehouse exists under different IDs
    const result = await queryable.select({
        totalStock: sql<number>`COALESCE(SUM(${stockLevels.totalStock}), 0)`,
    })
        .from(stockLevels)
        .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
        .innerJoin(products, eq(stockLevels.productId, products.id))
        .where(and(
            sql`${warehouses.sloc} = (SELECT sloc FROM warehouses WHERE id = ${warehouseId})`,
            sql`${products.materialNumber} = (SELECT material_number FROM products WHERE id = ${productId} LIMIT 1)`,
        ))

    return Number(result[0]?.totalStock) || 0
}

async function adjustOriginWarehouseStock(
    executor: StockWriteExecutor,
    {
        warehouseId,
        productId,
        totalDelta,
        bookedDelta = 0,
    }: {
        warehouseId: number
        productId: number
        totalDelta: number
        bookedDelta?: number
    },
) {
    const result = await executor.execute(sql`
        UPDATE stock_levels
        SET
            total_stock = total_stock + ${totalDelta},
            booked_stock = booked_stock + ${bookedDelta},
            updated_at = NOW()
        WHERE id = (
            SELECT sl.id
            FROM stock_levels sl
            INNER JOIN warehouses w ON w.id = sl.warehouse_id
            INNER JOIN products p ON p.id = sl.product_id
            WHERE
                w.sloc = (SELECT sloc FROM warehouses WHERE id = ${warehouseId})
                AND p.material_number = (SELECT material_number FROM products WHERE id = ${productId} LIMIT 1)
            ORDER BY sl.id
            LIMIT 1
        )
    `)

    if ((result.rowCount ?? 0) === 0) {
        throw new Error(`Stock level not found for product ID ${productId} in origin warehouse`)
    }
}

function getProductStockLabel(
    product: { materialDescription?: string | null; materialNumber?: string | null } | null | undefined,
    productId: number,
) {
    return product?.materialDescription || product?.materialNumber || `Produk #${productId}`
}

async function buildDeliveryStockCheckResult(
    queryable: StockQueryable,
    warehouseId: number,
    item: DeliveryStockCheckInput,
    customerId?: number | null,
): Promise<DeliveryStockCheckResult> {
    const requested = Math.max(item.quantity, 0)
    const physicalStock = await getOriginWarehouseStock(queryable, warehouseId, item.productId)
    const bookingAvailability = await getStockBookingAvailability(queryable, {
        warehouseId,
        productId: item.productId,
        totalStock: physicalStock,
        customerId,
    })
    const availableForDelivery = bookingAvailability.availableQty
    const remainingAfterDelivery = Math.max(availableForDelivery - requested, 0)
    const shortage = Math.max(requested - availableForDelivery, 0)
    const sufficient = availableForDelivery >= requested

    const alternatives: { id: number; stock: number; description: string }[] = []

    // Suggestions only: do not affect the Available status for Delivery.
    const currentProduct = await queryable.query.products.findFirst({
        where: eq(products.id, item.productId),
    })

    if (currentProduct?.materialDescription) {
        const relatedProducts = await queryable.query.products.findMany({
            where: and(
                eq(products.materialDescription, currentProduct.materialDescription),
                sql`${products.id} != ${item.productId}`,
            ),
        })

        for (const rel of relatedProducts) {
            const relStock = await getOriginWarehouseStock(queryable, warehouseId, rel.id)
            if (relStock > 0) {
                alternatives.push({
                    id: rel.id,
                    stock: relStock,
                    description: rel.materialDescription || "",
                })
            }
        }
    }

    // Find stock in other warehouses (different sloc) for the same materialNumber
    const otherWarehouseStocks = await queryable.select({
        warehouseId: stockLevels.warehouseId,
        totalStock: sql<number>`COALESCE(SUM(${stockLevels.totalStock}), 0)`,
        whSloc: warehouses.sloc,
        whDescription: warehouses.description,
    })
        .from(stockLevels)
        .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
        .innerJoin(products, eq(stockLevels.productId, products.id))
        .where(and(
            sql`${products.materialNumber} = (SELECT material_number FROM products WHERE id = ${item.productId} LIMIT 1)`,
            sql`${warehouses.sloc} != (SELECT sloc FROM warehouses WHERE id = ${warehouseId})`,
            sql`${stockLevels.totalStock} > 0`,
        ))
        .groupBy(stockLevels.warehouseId, warehouses.sloc, warehouses.description)

    const otherWarehouses = otherWarehouseStocks.map((sw) => ({
        warehouseId: sw.warehouseId,
        warehouseName: sw.whSloc && sw.whDescription ? `${sw.whSloc} - ${sw.whDescription}` : sw.whSloc || "Unknown",
        stock: Number(sw.totalStock),
    }))

    return {
        productId: item.productId,
        requested,
        available: availableForDelivery,
        remainingAfterDelivery,
        shortage,
        sufficient,
        customerBooked: bookingAvailability.customerReservedQty,
        bookedByOtherCustomers: bookingAvailability.otherReservedQty,
        alternativeIds: alternatives.length > 0 ? alternatives : undefined,
        otherWarehouses: otherWarehouses.length > 0 ? otherWarehouses : undefined,
    }
}

async function assertOriginWarehouseStock(
    queryable: StockQueryable,
    warehouseId: number,
    items: Array<{ productId: number; deliveredQuantity: number }>,
    customerId?: number | null,
) {
    const insufficientItems: string[] = []

    for (const item of items) {
        const stock = await buildDeliveryStockCheckResult(queryable, warehouseId, {
            productId: item.productId,
            quantity: item.deliveredQuantity,
        }, customerId)

        if (!stock.sufficient) {
            const product = await queryable.query.products.findFirst({
                where: eq(products.id, item.productId),
                columns: {
                    materialDescription: true,
                    materialNumber: true,
                },
            })

            insufficientItems.push(
                `${getProductStockLabel(product, item.productId)}: stok tersedia ${stock.available}, qty kirim ${stock.requested}, kurang ${stock.shortage}${stock.bookedByOtherCustomers > 0 ? `, tertahan booking customer lain ${stock.bookedByOtherCustomers}` : ""}`,
            )
        }
    }

    if (insufficientItems.length > 0) {
        throw new Error(`Stok origin warehouse tidak cukup. ${insufficientItems.join("; ")}`)
    }
}

async function notifyDeliveredDeliveries(deliveryIds: number[]) {
    for (const deliveryId of deliveryIds) {
        try {
            const result = await sendDeliveryDeliveredNotification(deliveryId)
            if (!result.success && !result.skipped) {
                console.error(`[DELIVERY EMAIL] Failed to send notification for delivery ${deliveryId}:`, result.error)
            }
        } catch (error) {
            console.error(`[DELIVERY EMAIL] Unexpected error for delivery ${deliveryId}:`, error)
        }
    }
}

async function notifyCreatedDelivery(deliveryId: number) {
    try {
        const result = await sendDeliveryCreatedNotification(deliveryId)
        if (!result.success && !result.skipped) {
            console.error(`[DELIVERY EMAIL] Failed to send created notification for delivery ${deliveryId}:`, result.error)
        }
    } catch (error) {
        console.error(`[DELIVERY EMAIL] Unexpected error for created notification ${deliveryId}:`, error)
    }
}

export async function getDeliveries() {
    noStore()
    const rows = await db.query.deliveries.findMany({
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

    return normalizeDeliveryOutput(mergeDeliveryRows(rows))
}

export async function getDoMonitoringDeliveries() {
    noStore()
    const rows = await db.query.deliveries.findMany({
        with: {
            salesOrder: {
                with: {
                    customer: true,
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

    return normalizeDeliveryOutput(mergeDeliveryRows(rows))
}

export async function getDoMonitoringDeliveryOptions() {
    noStore()
    const rows = await db.query.deliveries.findMany({
        columns: {
            id: true,
            deliveryNumber: true,
            doSap: true,
            invoiceNumber: true,
        },
        with: {
            salesOrder: {
                columns: {},
                with: {
                    customer: {
                        columns: {
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: [desc(deliveries.createdAt)],
    })

    return rows.map((delivery) => ({
        id: delivery.id,
        deliveryNumber: delivery.deliveryNumber,
        doSap: delivery.doSap,
        invoiceNumber: delivery.invoiceNumber,
        salesOrder: {
            customer: {
                name: delivery.salesOrder?.customer?.name ?? null,
            },
        },
    }))
}

export async function getDeliveryItemsFlat() {
    noStore()
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
    const mergedDeliveries = mergeDeliveryRows(allDeliveries)

    return normalizeDeliveryOutput(mergedDeliveries.flatMap(delivery =>
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
            warehouseName: formatWarehouseLabel(delivery.warehouse),
            createdByName: delivery.createdByUser?.name || null,
        }))
    ))
}

export async function getDelivery(id: number) {
    await getAuthenticatedSession("deliveries", "view")

    const delivery = await db.query.deliveries.findFirst({
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
            createdByUser: true,
            items: {
                with: {
                    product: true,
                    salesOrderItem: true,
                },
            },
        },
    })

    return normalizeDeliveryOutput(delivery ? mergeDeliveryRows([delivery])[0] : delivery)
}

export async function getSalesOrdersForDelivery() {
    noStore()
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

export type ReadyOutstandingSalesOrder = Awaited<ReturnType<typeof getSalesOrdersForDelivery>>[0] & {
    readyItems: (Awaited<ReturnType<typeof getSalesOrdersForDelivery>>[0]["items"][0] & { availableStock: number })[]
}

export async function getReadyOutstandingSalesOrders(): Promise<ReadyOutstandingSalesOrder[]> {
    noStore()

    const orders = await getSalesOrdersForDelivery()
    const readyOrdersList: ReadyOutstandingSalesOrder[] = []

    for (const order of orders) {
        // Cek apakah pesanan ini Outstanding (Parsial) dengan mengecek item yang sudah pernah dikirim
        const isPartial = order.items.some(i => i.alreadyDelivered > 0)
        
        // Hanya notifikasi untuk pesanan parsial/outstanding seperti request user
        // (Pesanan yang sama sekali belum disentuh bukan kategori Outstanding Tertunda)
        if (!isPartial) continue

        const readyItems = []

        for (const item of order.items) {
            if (item.remainingQuantity > 0 && item.productId) {
                // Mengecek stok akurat di Origin Warehouse
                if (order.warehouseId) {
                    const physicalStock = await getOriginWarehouseStock(db, order.warehouseId, item.productId)
                    const bookingAvailability = await getStockBookingAvailability(db, {
                        warehouseId: order.warehouseId,
                        productId: item.productId,
                        totalStock: physicalStock,
                        customerId: order.customerId,
                    })
                    const directAvailable = bookingAvailability.availableQty
                    if (directAvailable > 0) {
                        readyItems.push({
                            ...item,
                            availableStock: directAvailable
                        })
                    }
                }
            }
        }

        // Kalau ada item sisa kelupaan yang sekarang ready di gudang, masukkan ke Notifikasi
        if (readyItems.length > 0) {
            readyOrdersList.push({
                ...order,
                readyItems
            })
        }
    }

    return readyOrdersList
}

export async function checkStockAvailability(warehouseId: number, items: DeliveryStockCheckInput[], customerId?: number | null) {
    const results: DeliveryStockCheckResult[] = []

    console.log(`[STOCKS] Checking warehouse ${warehouseId}, items:`, items)

    for (const item of items) {
        const result = await buildDeliveryStockCheckResult(db, warehouseId, item, customerId)

        console.log(
            `[STOCKS] Product ${item.productId}: available=${result.available}, requested=${result.requested}, remaining=${result.remainingAfterDelivery}, alternatives=${result.alternativeIds?.length ?? 0}, otherWHs=${result.otherWarehouses?.length ?? 0}`,
        )
        results.push(result)
    }

    return results
}

export async function generateDeliveryNumber() {
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`

    const key = `seq_dlv_${dateStr}`

    // Use settings table as a sequence to prevent reusing deleted delivery numbers
    const [updated] = await db.insert(settings)
        .values({ key, value: "1" })
        .onConflictDoUpdate({
            target: settings.key,
            set: { value: sql`CAST(CAST(${settings.value} AS INTEGER) + 1 AS TEXT)` }
        })
        .returning()

    let nextNum = parseInt(updated.value, 10)
    
    // Safety check: if the number already exists (e.g., from old count-based logic), 
    // increment until we find a free one and update the sequence.
    let exists = true
    let finalDeliveryNumber = ""

    while (exists) {
        finalDeliveryNumber = `DLV-${dateStr}-${String(nextNum).padStart(4, "0")}`
        const check = await db.query.deliveries.findFirst({
            where: eq(deliveries.deliveryNumber, finalDeliveryNumber),
            columns: { id: true }
        })
        if (!check) {
            exists = false
        } else {
            nextNum++
            await db.update(settings)
                .set({ value: nextNum.toString() })
                .where(eq(settings.key, key))
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
        const mergedItems = mergeDeliveryItemsByProduct(data.items)

        const result = await db.transaction(async (tx) => {
            console.log("[CREATE DELIVERY] Starting transaction...")

            const [newDelivery] = await tx.insert(deliveries)
                .values({
                    deliveryNumber,
                    doSap: normalizeCodeValue(data.doSap),
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

            if (mergedItems.length > 0) {
                const hasDestination = data.warehouseToId && data.warehouseToId !== 0
                const isCancelled = data.status === "cancelled"
                const order = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, data.salesOrderId),
                    columns: { categoryPo: true, customerId: true }
                })

                if (!isCancelled && data.warehouseId) {
                    await assertOriginWarehouseStock(tx, data.warehouseId, mergedItems.map((item) => ({
                        productId: item.productId,
                        deliveredQuantity: item.deliveredQuantity,
                    })), order?.customerId)
                }

                console.log("[CREATE DELIVERY] Inserting items...")
                await tx.insert(deliveryItems)
                    .values(mergedItems.map(item => ({
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
                        mergedItems.map(item => ({
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

                    for (const item of mergedItems) {
                        // Deduct total stock AND booked stock
                        await adjustOriginWarehouseStock(tx, {
                            warehouseId: data.warehouseId,
                            productId: item.productId,
                            totalDelta: -item.deliveredQuantity,
                            bookedDelta: -item.deliveredQuantity,
                        })

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

                    await consumeStockBookingsForDelivery(tx, {
                        deliveryId: newDelivery.id,
                        warehouseId: data.warehouseId,
                        customerId: order?.customerId,
                        items: mergedItems.map((item) => ({
                            productId: item.productId,
                            quantity: item.deliveredQuantity,
                        })),
                    })
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
                revalidatePath("/dashboard/deliveries/create")
            } catch (_e) { }

            console.log("[CREATE DELIVERY] Transaction completed successfully")
            return {
                success: true as const,
                id: newDelivery.id,
                deliveredNotificationIds: data.status === "delivered" ? [newDelivery.id] : [],
            }
        })

        if (result.success) {
            await recordActivity({ action: "CREATE", tableName: "deliveries", recordId: result.id.toString(), description: `Membuat Delivery baru ${deliveryNumber}` });
            await notifyCreatedDelivery(result.id)

            const allSerialNumbers = (data.items || [])
                .flatMap((item) => item.serialNumbers || [])
                .filter((sn): sn is string => Boolean(sn && sn.trim()))

            if (allSerialNumbers.length > 0) {
                try {
                    const { linkRfidScansToDelivery } = await import("@/lib/rfid")
                    await linkRfidScansToDelivery(deliveryNumber, allSerialNumbers)
                } catch (err) {
                    console.error("Failed to link RFID scans on create delivery:", err)
                }
            }
        }

        if (result.success && result.deliveredNotificationIds.length > 0) {
            await notifyDeliveredDeliveries(result.deliveredNotificationIds)
        }

        return { success: true, id: result.id }
    } catch (error) {
        console.error("[CREATE DELIVERY] Error:", error)
        return { success: false, error: "Failed to create delivery: " + (error instanceof Error ? error.message : "Unknown error") }
    }
}

export async function updateDelivery(id: number, data: z.infer<typeof deliverySchema>) {
    try {
        const session = await getAuthenticatedSession('deliveries', 'edit')
        const userId = session.user.id
        const mergedNewItems = mergeDeliveryItemsByProduct(data.items)

        const result = await db.transaction(async (tx) => {
            const originalDelivery = await tx.query.deliveries.findFirst({
                where: eq(deliveries.id, id),
                with: { items: true },
            })

            if (!originalDelivery) {
                console.error("[UPDATE DELIVERY] Delivery not found:", id)
                return { success: false as const, error: "Delivery not found" }
            }
            console.log("[UPDATE DELIVERY] Found original delivery:", id)

            // Revert stock if it was previously committed (not cancelled)
            // Check if original was VHS/Consignment
            const originalOrder = await tx.query.salesOrders.findFirst({
                where: eq(salesOrders.id, originalDelivery.salesOrderId),
                columns: { categoryPo: true, customerId: true }
            })
            const nextOrder = await tx.query.salesOrders.findFirst({
                where: eq(salesOrders.id, data.salesOrderId),
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
                mergedNewItems.map((item) => ({
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
                await restoreStockBookingsForDelivery(tx, id)
                const originalMovementType = originalWasVHS ? "TRANSFER_OUT" : "DELIVERY"
                for (const item of originalDelivery.items) {
                    await adjustOriginWarehouseStock(tx, {
                        warehouseId: originalDelivery.warehouseId,
                        productId: item.productId,
                        totalDelta: item.deliveredQuantity,
                        bookedDelta: item.deliveredQuantity,
                    })

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

            if (shouldReconcileStock && newIsCommitted && data.warehouseId) {
                await assertOriginWarehouseStock(tx, data.warehouseId, mergedNewItems.map((item) => ({
                    productId: item.productId,
                    deliveredQuantity: item.deliveredQuantity,
                })), nextOrder?.customerId)
            }

            await tx.update(deliveries)
                .set({
                    deliveryNumber: data.deliveryNumber || undefined,
                    doSap: normalizeCodeValue(data.doSap),
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
                        mergedNewItems.map(item => ({
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
                        mergedNewItems.map(item => ({
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

            if (mergedNewItems.length > 0) {
                await tx.insert(deliveryItems)
                    .values(mergedNewItems.map(item => ({
                        deliveryId: id,
                        salesOrderItemId: item.salesOrderItemId || null,
                        productId: item.productId,
                        orderedQuantity: item.orderedQuantity,
                        deliveredQuantity: item.deliveredQuantity,
                        serialNumbers: item.serialNumbers || null,
                    })))

                // Apply new stock deduction if now committed (not cancelled)
                // For VHS/Consignment, stock will be managed by the transfer
                const isVHSConsignment = isConsignmentCategory(nextOrder?.categoryPo) && data.warehouseToId

                if (shouldReconcileStock && newIsCommitted) {
                    const movementType = isVHSConsignment ? "TRANSFER_OUT" : "DELIVERY"
                    for (const item of mergedNewItems) {
                        await adjustOriginWarehouseStock(tx, {
                            warehouseId: data.warehouseId,
                            productId: item.productId,
                            totalDelta: -item.deliveredQuantity,
                            bookedDelta: -item.deliveredQuantity,
                        })

                        // Record New Movement
                        await recordStockMovement(tx, {
                            productId: item.productId,
                            warehouseId: data.warehouseId,
                            quantity: -item.deliveredQuantity, // Negative for Out
                            type: movementType,
                            referenceNumber: data.deliveryNumber ?? originalDelivery.deliveryNumber ?? undefined,
                            recordedBy: userId,
                            customerId: nextOrder?.customerId ?? undefined,
                            fromWarehouseId: hasDestination ? (data.warehouseId ?? undefined) : undefined,
                            toWarehouseId: hasDestination ? (data.warehouseToId ?? undefined) : undefined,
                            notes: hasDestination ? `Transfer OUT ke warehouse tujuan` : `Delivery ke customer`,
                        })
                    }

                    if (data.warehouseId) {
                        await consumeStockBookingsForDelivery(tx, {
                            deliveryId: id,
                            warehouseId: data.warehouseId,
                            customerId: nextOrder?.customerId,
                            items: mergedNewItems.map((item) => ({
                                productId: item.productId,
                                quantity: item.deliveredQuantity,
                            })),
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
                revalidatePath("/dashboard/deliveries/create")
            } catch (_e) { }
            return {
                success: true as const,
                deliveredNotificationIds: originalDelivery.status !== "delivered" && data.status === "delivered" ? [id] : [],
                loggedDeliveryNumber: data.deliveryNumber || originalDelivery.deliveryNumber || null,
            }
        })

        if (!result.success) {
            return result
        }

        if (result.deliveredNotificationIds.length > 0) {
            await notifyDeliveredDeliveries(result.deliveredNotificationIds)
        }

        await recordActivity({ action: "UPDATE", tableName: "deliveries", recordId: id.toString(), description: `Memperbarui Delivery ${result.loggedDeliveryNumber || id}` });

        const currentDeliveryNumber = result.loggedDeliveryNumber || data.deliveryNumber || null
        if (currentDeliveryNumber) {
            const allSerialNumbers = (data.items || [])
                .flatMap((item) => item.serialNumbers || [])
                .filter((sn): sn is string => Boolean(sn && sn.trim()))

            if (allSerialNumbers.length > 0) {
                try {
                    const { linkRfidScansToDelivery } = await import("@/lib/rfid")
                    await linkRfidScansToDelivery(currentDeliveryNumber, allSerialNumbers)
                } catch (err) {
                    console.error("Failed to link RFID scans on update delivery:", err)
                }
            }
        }

        return { success: true }
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
        const result = await db.transaction(async (tx) => {
            const session = await getAuthenticatedSession('deliveries', 'delete')
            const userId = session.user.id

            // Restore stock for items if the delivery was committed (not cancelled)
            // Check if it was VHS/Consignment
            const order = await tx.query.salesOrders.findFirst({
                where: eq(salesOrders.id, delivery.salesOrderId),
                columns: { categoryPo: true, customerId: true }
            })
            const wasVHS = order?.categoryPo === "VHS/Consignment" && delivery.warehouseToId
            const wasCommitted = delivery.status !== "cancelled"

            if (wasCommitted && delivery.warehouseId) {
                await restoreStockBookingsForDelivery(tx, id)
                const movementType = wasVHS ? "TRANSFER_OUT" : "DELIVERY"
                for (const item of delivery.items) {
                    await adjustOriginWarehouseStock(tx, {
                        warehouseId: delivery.warehouseId,
                        productId: item.productId,
                        totalDelta: item.deliveredQuantity,
                        bookedDelta: item.deliveredQuantity,
                    })

                    // Record Revert Movement (from delete)
                    await recordStockMovement(tx, {
                        productId: item.productId,
                        warehouseId: delivery.warehouseId as number,
                        quantity: item.deliveredQuantity, // Positive for Revert In
                        type: movementType,
                        referenceNumber: delivery.deliveryNumber ?? undefined,
                        recordedBy: userId,
                        customerId: order?.customerId ?? undefined,
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
                revalidatePath("/dashboard/stocks")
                revalidatePath("/dashboard/inventory")
            } catch (_e) { }
            return { success: true }
        })

        if (result.success) {
            await recordActivity({
                action: "DELETE",
                tableName: "deliveries",
                recordId: id.toString(),
                description: `Menghapus Delivery ${delivery.deliveryNumber ?? id}`,
            })
        }

        return result
    } catch (error) {
        console.error("Failed to delete delivery:", error)
        return { success: false, error: "Failed to delete delivery" }
    }
}

export async function bulkDeleteDeliveries(ids: number[]) {
    try {
        await checkPermission('deliveries', 'delete')

        const deletedDeliveries: Array<{ id: number; deliveryNumber: string | null }> = []

        const result = await db.transaction(async (tx) => {
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
                    columns: { categoryPo: true, customerId: true }
                })
                const wasVHS = order?.categoryPo === "VHS/Consignment" && delivery.warehouseToId
                const wasCommitted = delivery.status !== "cancelled"

                if (wasCommitted && delivery.warehouseId) {
                    await restoreStockBookingsForDelivery(tx, id)
                    const movementType = wasVHS ? "TRANSFER_OUT" : "DELIVERY"
                    for (const item of delivery.items) {
                        await adjustOriginWarehouseStock(tx, {
                            warehouseId: delivery.warehouseId,
                            productId: item.productId,
                            totalDelta: item.deliveredQuantity,
                            bookedDelta: item.deliveredQuantity,
                        })

                        await recordStockMovement(tx, {
                            productId: item.productId,
                            warehouseId: delivery.warehouseId as number,
                            quantity: item.deliveredQuantity,
                            type: movementType,
                            referenceNumber: delivery.deliveryNumber ?? undefined,
                            recordedBy: userId,
                            customerId: order?.customerId ?? undefined,
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
                deletedDeliveries.push({ id, deliveryNumber: delivery.deliveryNumber ?? null })
            }

            try {
                revalidatePath("/dashboard/deliveries")
                revalidatePath("/dashboard/stocks")
                revalidatePath("/dashboard/inventory")
            } catch (_e) { }
            return { success: true }
        })

        if (result.success) {
            for (const delivery of deletedDeliveries) {
                await recordActivity({
                    action: "DELETE",
                    tableName: "deliveries",
                    recordId: delivery.id.toString(),
                    description: `Menghapus Delivery ${delivery.deliveryNumber ?? delivery.id}`,
                })
            }
        }

        return result
    } catch (error) {
        console.error("Bulk delete deliveries error:", error)
        return { success: false, error: "Failed to delete deliveries" }
    }
}

export async function bulkUpdateDeliveryStatus(ids: number[], status: string) {
    try {
        await checkPermission('deliveries', 'edit')

        const result = await db.transaction(async (tx) => {
            const session = await getAuthenticatedSession('deliveries', 'edit')
            const userId = session.user.id
            const deliveredNotificationIds: number[] = []

            for (const id of ids) {
                const delivery = await tx.query.deliveries.findFirst({
                    where: eq(deliveries.id, id),
                    with: { items: true }
                })

                if (!delivery) continue

                const order = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, delivery.salesOrderId),
                    columns: { categoryPo: true, customerId: true }
                })
                const isVHS = order?.categoryPo === "VHS/Consignment" && delivery.warehouseToId

                // Logic for status transitions:
                // 1. From non-cancelled to cancelled: REVERT stock
                if (delivery.status !== "cancelled" && status === "cancelled") {
                    if (delivery.warehouseId) {
                        await restoreStockBookingsForDelivery(tx, id)
                        const movementType = isVHS ? "TRANSFER_OUT" : "DELIVERY"
                        for (const item of delivery.items) {
                            await adjustOriginWarehouseStock(tx, {
                                warehouseId: delivery.warehouseId,
                                productId: item.productId,
                                totalDelta: item.deliveredQuantity,
                                bookedDelta: item.deliveredQuantity,
                            })

                            await recordStockMovement(tx, {
                                productId: item.productId,
                                warehouseId: delivery.warehouseId as number,
                                quantity: item.deliveredQuantity,
                                type: movementType,
                                referenceNumber: delivery.deliveryNumber ?? undefined,
                                recordedBy: userId,
                                customerId: order?.customerId ?? undefined,
                            })
                        }
                    }

                    // Delete associated automated transfers if delivery is cancelled
                    await tx.delete(stockTransfers).where(eq(stockTransfers.deliveryId, id))
                }

                // 2. From cancelled to non-cancelled: APPLY stock
                if (delivery.status === "cancelled" && status !== "cancelled") {
                    if (delivery.warehouseId) {
                        await assertOriginWarehouseStock(tx, delivery.warehouseId, delivery.items.map((item) => ({
                            productId: item.productId,
                            deliveredQuantity: item.deliveredQuantity,
                        })), order?.customerId)

                        const movementType = isVHS ? "TRANSFER_OUT" : "DELIVERY"
                        for (const item of delivery.items) {
                            await adjustOriginWarehouseStock(tx, {
                                warehouseId: delivery.warehouseId,
                                productId: item.productId,
                                totalDelta: -item.deliveredQuantity,
                                bookedDelta: -item.deliveredQuantity,
                            })

                            await recordStockMovement(tx, {
                                productId: item.productId,
                                warehouseId: delivery.warehouseId as number,
                                quantity: -item.deliveredQuantity,
                                type: movementType,
                                referenceNumber: delivery.deliveryNumber ?? undefined,
                                recordedBy: userId,
                                customerId: order?.customerId ?? undefined,
                            })
                        }

                        await consumeStockBookingsForDelivery(tx, {
                            deliveryId: id,
                            warehouseId: delivery.warehouseId,
                            customerId: order?.customerId,
                            items: delivery.items.map((item) => ({
                                productId: item.productId,
                                quantity: item.deliveredQuantity,
                            })),
                        })
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
                    if (delivery.status !== "delivered") {
                        deliveredNotificationIds.push(id)
                    }
                }
            }

            try {
                revalidatePath("/dashboard/deliveries")
                revalidatePath("/dashboard/stocks")
                revalidatePath("/dashboard/inventory")
            } catch (_e) { }
            return { success: true as const, deliveredNotificationIds }
        })

        if (result.success && result.deliveredNotificationIds.length > 0) {
            await notifyDeliveredDeliveries(result.deliveredNotificationIds)
        }

        return { success: true }
    } catch (_error) {
        console.error("Bulk update delivery status error:", _error)
        return { success: false, error: "Failed to update delivery status" }
    }
}

export async function bulkUpdateDeliveryShipmentDetails(ids: number[], input: BulkDeliveryShipmentDetailsInput) {
    try {
        await checkPermission('deliveries', 'edit')

        const deliveryIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)))
        if (deliveryIds.length === 0) {
            return { success: false, error: "Tidak ada delivery yang dipilih" }
        }

        const updateData = buildBulkDeliveryShipmentDetailsUpdate(input)
        if (Object.keys(updateData).length === 0) {
            return { success: false, error: "Tidak ada field shipment details atau cost yang diisi" }
        }

        await db.update(deliveries)
            .set({ ...updateData, updatedAt: new Date() })
            .where(inArray(deliveries.id, deliveryIds))

        try {
            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/logistics-costs")
        } catch (_e) { }

        return { success: true }
    } catch (_error) {
        console.error("Bulk update delivery shipment details error:", _error)
        const message = _error instanceof Error ? _error.message : "Failed to update delivery shipment details"
        return { success: false, error: message }
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
    doSap?: string | null,
}) {
    try {
        await checkPermission('deliveries', 'edit')

        const hasScanDoDocument = data.scanDoDocument !== undefined && Boolean(data.scanDoDocument)
        const normalizedDoStatus = hasScanDoDocument && data.doStatus !== "Lost"
            ? "Returned"
            : data.doStatus
        const normalizedReturnDate = hasScanDoDocument && data.returnDoDate === undefined
            ? new Date()
            : data.returnDoDate

        // Build update object dynamically to support partial updates
        const updateData: Partial<typeof deliveries.$inferInsert> = {
            updatedAt: new Date(),
        }

        if (normalizedReturnDate !== undefined) updateData.returnDoDate = normalizedReturnDate
        if (data.invoiceNumber !== undefined) updateData.invoiceNumber = normalizeCodeValue(data.invoiceNumber)
        if (data.invoiceDate !== undefined) updateData.invoiceDate = data.invoiceDate
        if (normalizedDoStatus !== undefined) updateData.doStatus = normalizedDoStatus
        if (data.remark !== undefined) updateData.remark = data.remark
        if (data.scanDoDocument !== undefined) updateData.scanDoDocument = data.scanDoDocument
        if (data.doSap !== undefined) updateData.doSap = normalizeCodeValue(data.doSap)

        await db.update(deliveries)
            .set(updateData)
            .where(eq(deliveries.id, id))

        if (normalizedDoStatus === "Delivered") {
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

export async function bulkAttachDoScansByInternalNo(entries: Array<{
    internalNo: string
    fileUrl: string
    originalFileName?: string | null
}>) {
    try {
        await checkPermission('deliveries', 'edit')

        const now = new Date()
        const normalizedEntries = entries
            .map((entry) => ({
                internalNo: normalizeDeliveryNumberKey(entry.internalNo),
                fileUrl: entry.fileUrl,
                originalFileName: entry.originalFileName?.trim() || null,
            }))
            .filter((entry) => entry.internalNo && entry.fileUrl)

        if (normalizedEntries.length === 0) {
            return {
                success: false,
                error: "Tidak ada file hasil OCR yang siap diproses",
            }
        }

        const deliveryRows = await db.query.deliveries.findMany({
            columns: {
                id: true,
                deliveryNumber: true,
                scanDoDocument: true,
                doStatus: true,
                returnDoDate: true,
            },
        })

        const deliveryMap = new Map<string, {
            id: number
            deliveryNumber: string | null
            scanDoDocument: string | null
            doStatus: string | null
            returnDoDate: Date | null
        }>(
            deliveryRows
                .filter((row) => row.deliveryNumber)
                .map((row) => [normalizeDeliveryNumberKey(row.deliveryNumber ?? ""), row]),
        )

        const seenKeys = new Set<string>()
        const updated: Array<{
            id: number
            deliveryNumber: string
            fileUrl: string
            originalFileName: string | null
        }> = []
        const unmatched: Array<{
            internalNo: string
            fileUrl: string
            originalFileName: string | null
            reason: string
        }> = []
        const duplicates: Array<{
            internalNo: string
            fileUrl: string
            originalFileName: string | null
            reason: string
        }> = []

        for (const entry of normalizedEntries) {
            const key = normalizeDeliveryNumberKey(entry.internalNo)
            if (!key) {
                unmatched.push({
                    internalNo: entry.internalNo,
                    fileUrl: entry.fileUrl,
                    originalFileName: entry.originalFileName,
                    reason: "Internal No kosong setelah normalisasi",
                })
                continue
            }

            if (seenKeys.has(key)) {
                duplicates.push({
                    internalNo: entry.internalNo,
                    fileUrl: entry.fileUrl,
                    originalFileName: entry.originalFileName,
                    reason: "Duplicate Internal No pada batch upload",
                })
                continue
            }
            seenKeys.add(key)

            const matchedDelivery = deliveryMap.get(key)
            if (!matchedDelivery?.id || !matchedDelivery.deliveryNumber) {
                unmatched.push({
                    internalNo: entry.internalNo,
                    fileUrl: entry.fileUrl,
                    originalFileName: entry.originalFileName,
                    reason: "Delivery tidak ditemukan",
                })
                continue
            }

            await db.update(deliveries)
                .set({
                    scanDoDocument: entry.fileUrl,
                    returnDoDate: now,
                    doStatus: "Returned",
                    updatedAt: now,
                })
                .where(eq(deliveries.id, matchedDelivery.id))

            updated.push({
                id: matchedDelivery.id,
                deliveryNumber: matchedDelivery.deliveryNumber,
                fileUrl: entry.fileUrl,
                originalFileName: entry.originalFileName,
            })
        }

        try {
            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/do-monitoring")
        } catch (_e) { }

        return {
            success: true,
            processedAt: now.toISOString(),
            totalReceived: entries.length,
            totalReady: normalizedEntries.length,
            updatedCount: updated.length,
            unmatchedCount: unmatched.length,
            duplicateCount: duplicates.length,
            updated,
            unmatched,
            duplicates,
        }
    } catch (_error) {
        console.error("Failed to bulk attach DO scans:", _error)
        return { success: false, error: "Failed to bulk attach DO scans" }
    }
}

function normalizeDeliveryNumberKey(value: string | null | undefined) {
    return String(value ?? "")
        .toUpperCase()
        .replace(/[–—]/g, "-")
        .replace(/\//g, "-")
        .replace(/[^A-Z0-9]/g, "")
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

        const rows = await db.query.deliveries.findMany({
            where: isNotNull(deliveries.deliveryNumber),
            with: {
                salesOrder: {
                    with: {
                        customer: true,
                    },
                },
                items: true,
                fleetTrip: {
                    with: {
                        driver: true,
                        vehicle: true,
                    },
                },
            },
            orderBy: [desc(deliveries.createdAt)],
        })

        type LogisticsCostDetail = {
            deliveryId: number
            deliveryNumber: string | null
            invoiceNumber: string | null
            destination: string
            qty: number
        }

        type LogisticsCostEntry = {
            id: number
            entryType: "trip" | "delivery"
            referenceNumber: string | null
            tripNumber: string | null
            deliveryNumber: string | null
            deliveryIds: number[]
            deliveryDate: Date | null
            scheduledDate: Date | null
            driverName: string | null
            vehicleNumber: string | null
            vendorName: string | null
            isExternal: boolean | null
            shippingCost: string | null
            costGasolineDexlite: string | null
            costGasolineBio: string | null
            costToll: string | null
            costParking: string | null
            costMeals: string | null
            costMaintenance: string | null
            costOthers: string | null
            costRapidTest: string | null
            costFerry: string | null
            costPortal: string | null
            costWashing: string | null
            costEscort: string | null
            invoiceNumber: string | null
            detailItems: LogisticsCostDetail[]
            totalQty: number
            sortDate: Date
        }

        const grouped = new Map<string, LogisticsCostEntry>()

        for (const delivery of rows) {
            const detailItem: LogisticsCostDetail = {
                deliveryId: delivery.id,
                deliveryNumber: delivery.deliveryNumber,
                invoiceNumber: delivery.invoiceNumber || delivery.salesOrder?.invoiceNumber || null,
                destination:
                    delivery.tripDestination ||
                    delivery.shippingAddress ||
                    delivery.salesOrder?.customer?.name ||
                    "-",
                qty: delivery.items.reduce((sum, item) => sum + Number(item.deliveredQuantity || 0), 0),
            }

            if (!delivery.isExternal && delivery.fleetTripId && delivery.fleetTrip) {
                const trip = delivery.fleetTrip
                const key = `trip-${trip.id}`
                const existing = grouped.get(key)

                if (existing) {
                    existing.deliveryIds.push(delivery.id)
                    existing.detailItems.push(detailItem)
                    existing.totalQty += detailItem.qty
                    if (!existing.deliveryDate && delivery.deliveryDate) {
                        existing.deliveryDate = delivery.deliveryDate
                    }
                    if (
                        delivery.deliveryDate &&
                        delivery.deliveryDate > existing.sortDate
                    ) {
                        existing.sortDate = delivery.deliveryDate
                    }
                    continue
                }

                grouped.set(key, {
                    id: trip.id,
                    entryType: "trip",
                    referenceNumber: trip.tripNumber,
                    tripNumber: trip.tripNumber,
                    deliveryNumber: delivery.deliveryNumber,
                    deliveryIds: [delivery.id],
                    deliveryDate: delivery.deliveryDate,
                    scheduledDate: trip.date,
                    driverName: trip.driver?.name || delivery.driverName,
                    vehicleNumber: trip.vehicle?.policeNumber || delivery.vehicleNumber,
                    vendorName: null,
                    isExternal: false,
                    shippingCost: "0",
                    costGasolineDexlite: trip.costGasolineDexlite,
                    costGasolineBio: trip.costGasolineBio,
                    costToll: trip.costToll,
                    costParking: trip.costParking,
                    costMeals: trip.costMeals,
                    costMaintenance: trip.costMaintenance,
                    costOthers: trip.costOthers,
                    costRapidTest: trip.costRapidTest,
                    costFerry: trip.costFerry,
                    costPortal: trip.costPortal,
                    costWashing: trip.costWashing,
                    costEscort: trip.costEscort,
                    invoiceNumber: null,
                    detailItems: [detailItem],
                    totalQty: detailItem.qty,
                    sortDate: delivery.deliveryDate || trip.date,
                })
                continue
            }

            grouped.set(`delivery-${delivery.id}`, {
                id: delivery.id,
                entryType: "delivery",
                referenceNumber: delivery.deliveryNumber,
                tripNumber: null,
                deliveryNumber: delivery.deliveryNumber,
                deliveryIds: [delivery.id],
                deliveryDate: delivery.deliveryDate,
                scheduledDate: delivery.scheduledDate,
                driverName: delivery.driverName,
                vehicleNumber: delivery.vehicleNumber,
                vendorName: delivery.vendorName,
                isExternal: delivery.isExternal,
                shippingCost: delivery.shippingCost,
                costGasolineDexlite: delivery.costGasolineDexlite,
                costGasolineBio: delivery.costGasolineBio,
                costToll: delivery.costToll,
                costParking: delivery.costParking,
                costMeals: delivery.costMeals,
                costMaintenance: delivery.costMaintenance,
                costOthers: delivery.costOthers,
                costRapidTest: delivery.costRapidTest,
                costFerry: delivery.costFerry,
                costPortal: delivery.costPortal,
                costWashing: delivery.costWashing,
                costEscort: delivery.costEscort,
                invoiceNumber: delivery.invoiceNumber,
                detailItems: [detailItem],
                totalQty: detailItem.qty,
                sortDate: delivery.deliveryDate || delivery.scheduledDate,
            })
        }

        return Array.from(grouped.values())
            .map((entry) => ({
                ...entry,
                deliveryIds: Array.from(new Set(entry.deliveryIds)),
                detailItems: entry.detailItems.sort((a, b) => (a.deliveryNumber || "").localeCompare(b.deliveryNumber || "")),
                invoiceNumber:
                    entry.invoiceNumber ||
                    Array.from(
                        new Set(
                            entry.detailItems
                                .map((item) => item.invoiceNumber)
                                .filter((value): value is string => Boolean(value)),
                        ),
                    ).join(", ") ||
                    null,
            }))
            .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
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

        await db.update(fleetTrips)
            .set({
                costGasolineDexlite: "0",
                costGasolineBio: "0",
                costToll: "0",
                costParking: "0",
                costMeals: "0",
                costMaintenance: "0",
                costOthers: "0",
                costRapidTest: "0",
                costFerry: "0",
                costPortal: "0",
                costWashing: "0",
                costEscort: "0",
            })

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
