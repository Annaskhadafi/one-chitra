"use server"

import { db } from "@/db"
import { salesOrders, salesOrderItems, stockLevels, deliveries, deliveryItems, stockTransfers, user, warehouses, products } from "@/db/schema"
import { eq, desc, inArray, sql, and, isNotNull, like } from "drizzle-orm"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import { z } from "zod"
import { salesOrderSchema } from "@/lib/schemas"
import { checkPermission, getAuthenticatedSession } from "@/lib/rbac"
import { deleteFile } from "./upload"
import { sendSalesOrderCreatedNotification } from "@/lib/delivery-notifications"
import { sendEmail } from "@/lib/email"
import { recordActivity } from "@/lib/audit"
import { restoreStockBookingsForDelivery } from "@/lib/stock-bookings"

let hasSalesPersonColumnCache: boolean | null = null
const salesOrderColumnCache = new Map<string, boolean>()
type SalesPersonRecord = typeof user.$inferSelect
const DUPLICATE_CUSTOMER_PO_ERROR = "No PO Customer ini sudah pernah diinput. Gunakan nomor PO Customer yang berbeda."

const baseSalesOrderColumns = {
    id: true,
    invoiceNumber: true,
    customerPo: true,
    customerId: true,
    warehouseId: true,
    salesDate: true,
    poReceive: true,
    categoryPo: true,
    categoryProduct: true,
    poDocument: true,
    status: true,
    termsConditions: true,
    notes: true,
    discount: true,
    shipping: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true,
} as const

function buildSalesOrderColumns(hasPicColumn: boolean, hasTripDestinationColumn: boolean) {
    return {
        ...baseSalesOrderColumns,
        ...(hasTripDestinationColumn ? { tripDestination: true } : {}),
        ...(hasPicColumn ? { salesPersonId: true } : {}),
    }
}

function normalizeSalesOrderRecord<T extends object>(order: T, hasPicColumn: boolean, hasTripDestinationColumn: boolean) {
    const optionalOrder = order as T & {
        tripDestination?: string | null
        salesPersonId?: string | null
        salesPerson?: SalesPersonRecord | null
    }
    const tripDestination: string | null = hasTripDestinationColumn
        ? optionalOrder.tripDestination ?? null
        : null

    const salesPersonId: string | null = hasPicColumn
        ? optionalOrder.salesPersonId ?? null
        : null

    return {
        ...order,
        tripDestination,
        salesPersonId,
        sourceType: null as string | null,
        quotationId: null as number | null,
        quotationNumber: null as string | null,
        quotationRevision: null as number | null,
        quotationSubject: null as string | null,
        quotationReferenceNumber: null as string | null,
        quotationValidUntil: null as Date | null,
        quotationCurrency: null as string | null,
        quotationDiscountType: null as string | null,
        quotationTax: null as string | null,
        quotationAdminNote: null as string | null,
        quotationClientNote: null as string | null,
        customerAttn: null as string | null,
        salesPerson: normalizeSalesPerson(order),
    }
}

function normalizeSalesPerson(order: unknown): SalesPersonRecord | null {
    if (typeof order === "object" && order !== null && "salesPerson" in order) {
        return (order as { salesPerson?: SalesPersonRecord | null }).salesPerson ?? null
    }

    return null
}

function normalizeCustomerPo(customerPo?: string | null) {
    return customerPo?.trim() ?? ""
}

async function findExistingSalesOrderByCustomerPo(customerPo?: string | null, excludeId?: number) {
    const normalizedCustomerPo = normalizeCustomerPo(customerPo)

    if (!normalizedCustomerPo) {
        return null
    }

    const duplicateCondition = excludeId === undefined
        ? sql`${salesOrders.customerPo} is not null and lower(trim(${salesOrders.customerPo})) = ${normalizedCustomerPo.toLowerCase()}`
        : sql`${salesOrders.customerPo} is not null and lower(trim(${salesOrders.customerPo})) = ${normalizedCustomerPo.toLowerCase()} and ${salesOrders.id} <> ${excludeId}`

    const [existingOrder] = await db
        .select({
            id: salesOrders.id,
            invoiceNumber: salesOrders.invoiceNumber,
        })
        .from(salesOrders)
        .where(duplicateCondition)
        .limit(1)

    return existingOrder ?? null
}

function duplicateCustomerPoResult(existingOrder?: { invoiceNumber: string | null } | null) {
    const message = existingOrder?.invoiceNumber
        ? `No PO Customer ini sudah pernah diinput pada Sales Order ${existingOrder.invoiceNumber}. Gunakan nomor PO Customer yang berbeda.`
        : DUPLICATE_CUSTOMER_PO_ERROR

    return {
        success: false as const,
        error: message,
        fieldErrors: {
            customerPo: message,
        },
    }
}

async function hasSalesOrderColumn(columnName: string) {
    const cached = salesOrderColumnCache.get(columnName)
    if (cached !== undefined) {
        return cached
    }

    try {
        const result = await db.execute(sql`
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'sales_orders'
              AND column_name = ${columnName}
            LIMIT 1
        `)

        const exists = result.rows.length > 0
        salesOrderColumnCache.set(columnName, exists)
        return exists
    } catch {
        salesOrderColumnCache.set(columnName, false)
        return false
    }
}

async function hasSalesPersonColumn() {
    if (hasSalesPersonColumnCache !== null) {
        return hasSalesPersonColumnCache
    }

    hasSalesPersonColumnCache = await hasSalesOrderColumn("sales_person_id")
    return hasSalesPersonColumnCache
}

async function getSalesOrderWarehouseStock(warehouseId: number, productId: number) {
    const result = await db.select({
        totalStock: sql<number>`COALESCE(SUM(${stockLevels.totalStock}), 0)`,
    })
        .from(stockLevels)
        .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
        .innerJoin(products, eq(stockLevels.productId, products.id))
        .where(and(
            sql`${warehouses.sloc} = (SELECT sloc FROM warehouses WHERE id = ${warehouseId})`,
            sql`${products.materialNumber} = (SELECT material_number FROM products WHERE id = ${productId} LIMIT 1)`,
        ))

    return Number(result[0]?.totalStock ?? 0)
}

export async function getSalesOrders() {
    noStore()
    const [hasPicColumn, hasTripDestinationColumn] = await Promise.all([
        hasSalesPersonColumn(),
        hasSalesOrderColumn("trip_destination"),
    ])

    const orderColumns = buildSalesOrderColumns(hasPicColumn, hasTripDestinationColumn)

    // Fetch orders with customer and createdByUser first
    const orders = hasPicColumn
        ? await db.query.salesOrders.findMany({
            columns: orderColumns,
            with: {
                customer: true,
                createdByUser: true,
                salesPerson: true,
            },
            orderBy: [desc(salesOrders.createdAt)],
        })
        : await db.query.salesOrders.findMany({
            columns: orderColumns,
            with: {
                customer: true,
                createdByUser: true,
            },
            orderBy: [desc(salesOrders.createdAt)],
        })

    const orderIds = orders.map((order) => order.id)
    const relatedDeliveries = orderIds.length > 0
        ? await db.query.deliveries.findMany({
            where: inArray(deliveries.salesOrderId, orderIds),
            columns: {
                id: true,
                salesOrderId: true,
                status: true,
                deliveryNumber: true,
                createdAt: true,
                tripDestination: true,
            },
            orderBy: [desc(deliveries.createdAt)],
        })
        : []

    const deliveryMap = new Map<number, typeof relatedDeliveries>()
    for (const delivery of relatedDeliveries) {
        const current = deliveryMap.get(delivery.salesOrderId) ?? []
        current.push(delivery)
        deliveryMap.set(delivery.salesOrderId, current)
    }

    if (orders.length === 0) {
        return []
    }

    // 2. Batch fetch all sales order items with products in ONE query
    const allItems = await db.query.salesOrderItems.findMany({
        where: inArray(salesOrderItems.salesOrderId, orderIds),
        with: {
            product: true,
        },
    })

    const itemsMap = new Map<number, typeof allItems>()
    for (const item of allItems) {
        const current = itemsMap.get(item.salesOrderId) ?? []
        current.push(item)
        itemsMap.set(item.salesOrderId, current)
    }

    // 3. Batch fetch delivered quantities in ONE query
    const allItemIds = allItems.map((item) => item.id)
    const deliveredQuantities = new Map<number, number>()

    if (allItemIds.length > 0) {
        const deliveredRows = await db.select({
            salesOrderItemId: deliveryItems.salesOrderItemId,
            totalDelivered: sql<number>`COALESCE(SUM(${deliveryItems.deliveredQuantity}), 0)`,
        })
            .from(deliveryItems)
            .innerJoin(deliveries, eq(deliveryItems.deliveryId, deliveries.id))
            .where(and(
                inArray(deliveryItems.salesOrderItemId, allItemIds),
                sql`${deliveries.status} != 'cancelled'`,
            ))
            .groupBy(deliveryItems.salesOrderItemId)

        for (const row of deliveredRows) {
            if (row.salesOrderItemId != null) {
                deliveredQuantities.set(row.salesOrderItemId, Number(row.totalDelivered))
            }
        }
    }

    // 4. Batch fetch warehouse stock for all warehouses referenced in ONE query
    const warehouseIds = [...new Set(orders.map((o) => o.warehouseId).filter((id): id is number => id != null))]
    const stockMap = new Map<string, number>()

    if (warehouseIds.length > 0) {
        const stockRows = await db.select({
            warehouseId: stockLevels.warehouseId,
            materialNumber: products.materialNumber,
            totalStock: sql<number>`COALESCE(SUM(${stockLevels.totalStock}), 0)`,
        })
            .from(stockLevels)
            .innerJoin(products, eq(stockLevels.productId, products.id))
            .where(inArray(stockLevels.warehouseId, warehouseIds))
            .groupBy(stockLevels.warehouseId, products.materialNumber)

        for (const row of stockRows) {
            stockMap.set(`${row.warehouseId}_${row.materialNumber}`, Number(row.totalStock))
        }
    }

    // 5. Assemble all orders in memory
    const ordersWithItems = orders.map((order) => {
        const items = itemsMap.get(order.id) ?? []
        const orderDeliveries = deliveryMap.get(order.id) ?? []
        const activeDeliveries = orderDeliveries.filter((delivery) => delivery.status !== "cancelled")
        const tripDestinationFallback = activeDeliveries.find((delivery) => delivery.tripDestination)?.tripDestination ?? null
        const orderWithOptionalTripDestination = order as typeof order & { tripDestination?: string | null }
        const effectiveOrder = {
            ...order,
            tripDestination: orderWithOptionalTripDestination.tripDestination || tripDestinationFallback,
        }

        const hasOutstandingDeliveryItems = items.some((item) => {
            const delivered = deliveredQuantities.get(item.id) ?? 0
            return item.quantity - delivered > 0
        })

        const outstandingItems = items
            .map((item) => {
                const delivered = deliveredQuantities.get(item.id) ?? 0
                const remainingQuantity = Math.max(item.quantity - delivered, 0)
                const matNum = item.product?.materialNumber
                const availableStock = (order.warehouseId && matNum) ? (stockMap.get(`${order.warehouseId}_${matNum}`) ?? 0) : 0
                const stockStatus = remainingQuantity <= 0
                    ? "done"
                    : availableStock >= remainingQuantity
                        ? "ready"
                        : availableStock > 0
                            ? "partial"
                            : "empty"

                return {
                    itemId: item.id,
                    productId: item.productId,
                    productName: item.product?.materialDescription || item.product?.materialNumber || item.description || "Unknown Product",
                    materialNumber: item.product?.materialNumber || "-",
                    orderedQuantity: item.quantity,
                    deliveredQuantity: delivered,
                    remainingQuantity,
                    availableStock,
                    stockStatus,
                }
            })
            .filter((item) => item.remainingQuantity > 0)

        const hasReadyAll = outstandingItems.length > 0 && outstandingItems.every((item) => item.stockStatus === "ready")
        const hasAnyPartial = outstandingItems.some((item) => item.stockStatus === "partial")
        const hasAnyReady = outstandingItems.some((item) => item.stockStatus === "ready")
        const outstandingDays = order.poReceive
            ? Math.max(0, Math.floor((Date.now() - new Date(order.poReceive).getTime()) / (1000 * 60 * 60 * 24)))
            : null

        const remarks = outstandingItems.length === 0
            ? {
                status: "complete",
                label: "Complete",
                outstandingDays,
                outstandingItemsCount: 0,
                outstandingQty: 0,
                items: [],
            }
            : hasReadyAll
                ? {
                    status: "ready",
                    label: "Stock Ready",
                    outstandingDays,
                    outstandingItemsCount: outstandingItems.length,
                    outstandingQty: outstandingItems.reduce((sum, item) => sum + item.remainingQuantity, 0),
                    items: outstandingItems,
                }
                : hasAnyPartial || hasAnyReady
                    ? {
                        status: "partial",
                        label: "Partial Stock",
                        outstandingDays,
                        outstandingItemsCount: outstandingItems.length,
                        outstandingQty: outstandingItems.reduce((sum, item) => sum + item.remainingQuantity, 0),
                        items: outstandingItems,
                    }
                    : {
                        status: "empty",
                        label: "No Stock",
                        outstandingDays,
                        outstandingItemsCount: outstandingItems.length,
                        outstandingQty: outstandingItems.reduce((sum, item) => sum + item.remainingQuantity, 0),
                        items: outstandingItems,
                    }

        const normalizedOrder = normalizeSalesOrderRecord(effectiveOrder, hasPicColumn, hasTripDestinationColumn)

        return {
            ...normalizedOrder,
            items,
            remarks,
            deliverySummary: {
                totalCount: orderDeliveries.length,
                activeCount: activeDeliveries.length,
                cancelledCount: orderDeliveries.filter((delivery) => delivery.status === "cancelled").length,
                latestStatus: orderDeliveries[0]?.status ?? null,
                latestDeliveryNumber: orderDeliveries[0]?.deliveryNumber ?? null,
                hasOutstandingDeliveryItems,
            },
        }
    })

    return ordersWithItems
}

export async function getSalesOrderCategories() {
    const categories = await db
        .selectDistinct({ category: salesOrders.categoryProduct })
        .from(salesOrders)
        .where(isNotNull(salesOrders.categoryProduct))
        .orderBy(salesOrders.categoryProduct)

    return categories.map(c => c.category).filter(Boolean) as string[]
}


export async function getSalesOrder(id: number) {
    noStore()
    const [hasPicColumn, hasTripDestinationColumn] = await Promise.all([
        hasSalesPersonColumn(),
        hasSalesOrderColumn("trip_destination"),
    ])

    const orderColumns = buildSalesOrderColumns(hasPicColumn, hasTripDestinationColumn)

    // Fetch order with customer first
    const order = hasPicColumn
        ? await db.query.salesOrders.findFirst({
            where: eq(salesOrders.id, id),
            columns: orderColumns,
            with: {
                customer: true,
                createdByUser: true,
                salesPerson: true,
            },
        })
        : await db.query.salesOrders.findFirst({
            where: eq(salesOrders.id, id),
            columns: orderColumns,
            with: {
                customer: true,
                createdByUser: true,
            },
        })

    if (!order) return undefined

    // Fetch items with products separately
    const items = await db.query.salesOrderItems.findMany({
        where: eq(salesOrderItems.salesOrderId, id),
        with: {
            product: true,
        },
    })

    return {
        ...normalizeSalesOrderRecord(order, hasPicColumn, hasTripDestinationColumn),
        items,
    }
}

export async function generateInvoiceNumber() {
    const date = new Date()
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`
    const prefix = `SO-${dateStr}`

    // Count today's orders efficiently using like query
    // We look for the highest number used today to avoid gaps/duplicates
    const result = await db
        .select({ invoiceNumber: salesOrders.invoiceNumber })
        .from(salesOrders)
        .where(like(salesOrders.invoiceNumber, `${prefix}%`))
        .orderBy(desc(salesOrders.invoiceNumber))
        .limit(1)

    let nextNum = 1
    if (result.length > 0 && result[0].invoiceNumber) {
        const lastInvoice = result[0].invoiceNumber
        const lastNumStr = lastInvoice.split("-").pop()
        if (lastNumStr && !isNaN(parseInt(lastNumStr))) {
            nextNum = parseInt(lastNumStr) + 1
        }
    }

    return `${prefix}-${String(nextNum).padStart(4, "0")}`
}

export async function createSalesOrder(data: z.infer<typeof salesOrderSchema>) {
    try {
        const hasPicColumn = await hasSalesPersonColumn()
        const session = await getAuthenticatedSession('sales-orders', 'create')
        const userId = session.user.id
        const normalizedCustomerPo = normalizeCustomerPo(data.customerPo)

        const existingCustomerPo = await findExistingSalesOrderByCustomerPo(normalizedCustomerPo)
        if (existingCustomerPo) {
            return duplicateCustomerPoResult(existingCustomerPo)
        }
        
        // Ensure invoice number is unique (retry if collision happens)
        let invoiceNumber = data.invoiceNumber
        if (!invoiceNumber) {
            invoiceNumber = await generateInvoiceNumber()
            
            // Double check if generated number exists (race condition mitigation)
            const existing = await db.query.salesOrders.findFirst({
                where: eq(salesOrders.invoiceNumber, invoiceNumber)
            })
            
            if (existing) {
                // Regenerate if exists
                const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
                invoiceNumber = `${invoiceNumber}-${randomSuffix}`
            }
        }

        // Start transaction
        const result = await db.transaction(async (tx) => {
            const [newOrder] = await tx.insert(salesOrders)
                .values({
                    invoiceNumber: invoiceNumber!,
                    customerPo: normalizedCustomerPo || null,
                    tripDestination: data.tripDestination || null,
                    createdBy: userId,
                    customerId: data.customerId,
                    ...(hasPicColumn ? { salesPersonId: data.salesPersonId || null } : {}),
                    warehouseId: data.warehouseId,
                    salesDate: new Date(data.salesDate),
                    poReceive: data.poReceive ? new Date(data.poReceive) : null,
                    categoryPo: data.categoryPo || null,
                    categoryProduct: data.categoryProduct || null,
                    poDocument: data.poDocument || null,
                    status: data.status,
                    termsConditions: data.termsConditions || null,
                    notes: data.notes || null,
                    discount: String(data.discount),
                    shipping: String(data.shipping),
                })
                .returning()

            if (data.items.length > 0) {
                await tx.insert(salesOrderItems)
                    .values(data.items.map(item => ({
                        salesOrderId: newOrder.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: String(item.unitPrice),
                        discount: String(item.discount),
                        tax: String(item.tax),
                    })))

                // Book stock if warehouse is selected
                // Note: Sales Order can be created even without stock availability (pre-order scenario)
                if (data.warehouseId) {
                    const isDraft = data.status === "draft"
                    for (const item of data.items) {
                        if (!item.productId) continue

                        // Check if stock level record exists
                        const existing = await tx.query.stockLevels.findFirst({
                            where: and(
                                eq(stockLevels.warehouseId, data.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            )
                        })

                        if (existing) {
                            // Update existing record - just book the quantity
                            if (isDraft) {
                                await tx.update(stockLevels)
                                    .set({
                                        draftBookedStock: sql`${stockLevels.draftBookedStock} + ${item.quantity}`,
                                        updatedAt: new Date()
                                    })
                                    .where(and(
                                        eq(stockLevels.warehouseId, data.warehouseId),
                                        eq(stockLevels.productId, item.productId)
                                    ))
                            } else {
                                await tx.update(stockLevels)
                                    .set({
                                        bookedStock: sql`${stockLevels.bookedStock} + ${item.quantity}`,
                                        updatedAt: new Date()
                                    })
                                    .where(and(
                                        eq(stockLevels.warehouseId, data.warehouseId),
                                        eq(stockLevels.productId, item.productId)
                                    ))
                            }
                        } else {
                            // Create new stock level record with booked quantity
                            // This allows pre-orders even when stock doesn't exist yet
                            await tx.insert(stockLevels)
                                .values({
                                    warehouseId: data.warehouseId,
                                    productId: item.productId,
                                    draftBookedStock: isDraft ? item.quantity : 0,
                                    bookedStock: isDraft ? 0 : item.quantity,
                                    totalStock: 0, // No physical stock yet
                                    minStock: 0,
                                })
                        }
                    }
                }
            }

            revalidatePath("/dashboard/sales-orders")
            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/deliveries/create")
            revalidatePath("/dashboard/stock-transfers")
            
            await recordActivity({
                action: "CREATE",
                tableName: "sales_orders",
                recordId: newOrder.id.toString(),
                description: `Membuat Sales Order baru ${newOrder.invoiceNumber}`,
            })

            return { success: true, id: newOrder.id }
        })

        if (result.success && result.id) {
            try {
                const notificationResult = await sendSalesOrderCreatedNotification(result.id)
                if (!notificationResult.success && !notificationResult.skipped) {
                    console.error(`[SO EMAIL] Failed to send creation notification for SO ${result.id}:`, notificationResult.error)
                }
            } catch (error) {
                console.error(`[SO EMAIL] Unexpected error for SO ${result.id}:`, error)
            }
        }

        return result
    } catch (error: unknown) {
        console.error("Failed to create sales order:", error)
        const message = error instanceof Error ? error.message : String(error)
        
        // Check for specific database errors
        if (message.includes("duplicate key value violates unique constraint")) {
             return { success: false, error: "Nomor Invoice sudah ada. Silakan coba lagi atau gunakan nomor yang berbeda." }
        }
        
        return { success: false, error: `Gagal membuat Sales Order: ${message}` }
    }
}

export async function updateSalesOrder(id: number, data: z.infer<typeof salesOrderSchema>) {
    try {
        const hasPicColumn = await hasSalesPersonColumn()
        await checkPermission('sales-orders', 'edit')
        const normalizedCustomerPo = normalizeCustomerPo(data.customerPo)

        const existingCustomerPo = await findExistingSalesOrderByCustomerPo(normalizedCustomerPo, id)
        if (existingCustomerPo) {
            return duplicateCustomerPoResult(existingCustomerPo)
        }

        return await db.transaction(async (tx) => {
            // Get original order to see if items changed
            const originalOrder = await tx.query.salesOrders.findFirst({
                where: eq(salesOrders.id, id),
                with: { items: true },
            })

            if (!originalOrder) {
                return { success: false, error: "Order not found" }
            }

            // Revert original booked stock if it had a warehouse
            if (originalOrder.warehouseId) {
                const wasDraft = originalOrder.status === "draft"
                for (const item of originalOrder.items) {
                    if (!item.productId) continue

                    if (wasDraft) {
                        await tx.update(stockLevels)
                            .set({
                                draftBookedStock: sql`${stockLevels.draftBookedStock} - ${item.quantity}`,
                                updatedAt: new Date()
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, originalOrder.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    } else {
                        await tx.update(stockLevels)
                            .set({
                                bookedStock: sql`${stockLevels.bookedStock} - ${item.quantity}`,
                                updatedAt: new Date()
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, originalOrder.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    }
                }
            }

            await tx.update(salesOrders)
                .set({
                    invoiceNumber: data.invoiceNumber || undefined,
                    customerPo: normalizedCustomerPo || null,
                    tripDestination: data.tripDestination || null,
                    customerId: data.customerId,
                    ...(hasPicColumn ? { salesPersonId: data.salesPersonId || null } : {}),
                    warehouseId: data.warehouseId,
                    salesDate: new Date(data.salesDate),
                    poReceive: data.poReceive ? new Date(data.poReceive) : null,
                    categoryPo: data.categoryPo || null,
                    categoryProduct: data.categoryProduct || null,
                    poDocument: data.poDocument || null,
                    status: data.status,
                    termsConditions: data.termsConditions || null,
                    notes: data.notes || null,
                    discount: data.discount.toString(),
                    shipping: data.shipping.toString(),
                    updatedAt: new Date(),
                })
                .where(eq(salesOrders.id, id))

            // Handle items: Update, Insert, Delete
            const existingItems = originalOrder.items
            const existingItemIds = existingItems.map(i => i.id)
            const payloadItemIds = data.items.map(i => i.id).filter(Boolean) as number[]

            const itemsToDelete = existingItemIds.filter(id => !payloadItemIds.includes(id))
            const itemsToInsert = data.items.filter(i => !i.id)
            const itemsToUpdate = data.items.filter(i => i.id)

            // Delete removed items
            if (itemsToDelete.length > 0) {
                await tx.delete(salesOrderItems).where(inArray(salesOrderItems.id, itemsToDelete))
            }

            // Update existing items
            for (const item of itemsToUpdate) {
                await tx.update(salesOrderItems)
                    .set({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice.toString(),
                        discount: item.discount.toString(),
                        tax: item.tax.toString(),
                    })
                    .where(eq(salesOrderItems.id, item.id!))
            }

            // Insert new items
            if (itemsToInsert.length > 0) {
                await tx.insert(salesOrderItems)
                    .values(itemsToInsert.map(item => ({
                        salesOrderId: id,
                        productId: item.productId,
                        quantity: item.quantity,
                        unitPrice: String(item.unitPrice),
                        discount: String(item.discount),
                        tax: String(item.tax),
                    })))
            }

            // Apply new booked stock if warehouse is selected
            if (data.warehouseId) {
                const isDraft = data.status === "draft"
                for (const item of data.items) {
                    if (!item.productId) continue

                    // Manual upsert: cek existing record dulu
                    const existingLevel = await tx.query.stockLevels.findFirst({
                        where: and(
                            eq(stockLevels.warehouseId, data.warehouseId),
                            eq(stockLevels.productId, item.productId)
                        )
                    })

                    if (isDraft) {
                        if (existingLevel) {
                            await tx.update(stockLevels)
                                .set({
                                    draftBookedStock: sql`${stockLevels.draftBookedStock} + ${item.quantity}`,
                                    updatedAt: new Date()
                                })
                                .where(and(
                                    eq(stockLevels.warehouseId, data.warehouseId),
                                    eq(stockLevels.productId, item.productId)
                                ))
                        } else {
                            await tx.insert(stockLevels)
                                .values({
                                    warehouseId: data.warehouseId,
                                    productId: item.productId,
                                    draftBookedStock: item.quantity,
                                    bookedStock: 0,
                                    totalStock: 0,
                                    minStock: 0,
                                })
                        }
                    } else {
                        if (existingLevel) {
                            await tx.update(stockLevels)
                                .set({
                                    bookedStock: sql`${stockLevels.bookedStock} + ${item.quantity}`,
                                    updatedAt: new Date()
                                })
                                .where(and(
                                    eq(stockLevels.warehouseId, data.warehouseId),
                                    eq(stockLevels.productId, item.productId)
                                ))
                        } else {
                            await tx.insert(stockLevels)
                                .values({
                                    warehouseId: data.warehouseId,
                                    productId: item.productId,
                                    draftBookedStock: 0,
                                    bookedStock: item.quantity,
                                    totalStock: 0,
                                    minStock: 0,
                                })
                        }
                    }
                }
            }

            revalidatePath("/dashboard/sales-orders")
            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/deliveries/create")
            

            await recordActivity({
                action: "UPDATE",
                tableName: "sales_orders",
                recordId: id.toString(),
                description: `Memperbarui Sales Order ${data.invoiceNumber}`,
            })

            return { success: true }
        })
    } catch (error) {
        console.error("Failed to update sales order:", error)
        const message = error instanceof Error ? error.message : String(error)

        // Check for specific database errors
        if (message.includes("duplicate key value violates unique constraint")) {
             return { success: false, error: "Nomor Invoice sudah ada. Silakan gunakan nomor yang berbeda." }
        }

        return { success: false, error: `Gagal mengupdate Sales Order: ${message}` }
    }
}

export async function getSalesOrderPicUsers() {
    noStore()
    await getAuthenticatedSession()
    return await db
        .select({ id: user.id, name: user.name, email: user.email, role: user.role })
        .from(user)
        .orderBy(
            sql`CASE
                WHEN lower(${user.role}) = 'sales' THEN 0
                WHEN lower(${user.role}) LIKE '%sales%' THEN 1
                ELSE 2
            END`,
            user.role,
            user.name
        )
}

export async function deleteSalesOrder(id: number) {
    try {
        await checkPermission('sales-orders', 'delete')

        const order = await db.query.salesOrders.findFirst({
            where: eq(salesOrders.id, id),
            with: { items: true }
        })

        if (!order) return { success: false, error: "Sales Order not found" }

        return await db.transaction(async (tx) => {
            // 1. Revert booked stock for SO items (Booked Stock only)
            if (order.warehouseId) {
                const wasDraft = order.status === "draft"
                for (const item of order.items) {
                    if (!item.productId) continue

                    if (wasDraft) {
                        await tx.update(stockLevels)
                            .set({
                                draftBookedStock: sql`${stockLevels.draftBookedStock} - ${item.quantity}`,
                                updatedAt: new Date()
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, order.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    } else {
                        await tx.update(stockLevels)
                            .set({
                                bookedStock: sql`${stockLevels.bookedStock} - ${item.quantity}`,
                                updatedAt: new Date()
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, order.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    }
                }
            }

            // 2. Revert Stock for Related Deliveries
            const relatedDeliveries = await tx.query.deliveries.findMany({
                where: eq(deliveries.salesOrderId, id),
                with: { items: true }
            })

            for (const delivery of relatedDeliveries) {
                // If delivery was not cancelled, it affects stock
                if (delivery.status !== "cancelled" && delivery.warehouseId) {
                    await restoreStockBookingsForDelivery(tx, delivery.id)
                    for (const dItem of delivery.items) {
                        await tx.update(stockLevels)
                            .set({
                                totalStock: sql`${stockLevels.totalStock} + ${dItem.deliveredQuantity}`,
                                bookedStock: sql`${stockLevels.bookedStock} + ${dItem.deliveredQuantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, delivery.warehouseId),
                                eq(stockLevels.productId, dItem.productId)
                            ))
                    }
                }

                // Cleanup Delivery Transfers and Documents
                await tx.delete(stockTransfers).where(eq(stockTransfers.deliveryId, delivery.id))
                if (delivery.scanDoDocument) {
                    await deleteFile(delivery.scanDoDocument)
                }

                await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, delivery.id))
                await tx.delete(deliveries).where(eq(deliveries.id, delivery.id))
            }

            // 3. Cleanup SO Document
            if (order.poDocument) {
                await deleteFile(order.poDocument)
            }

            // 4. Final Deletion
            await tx.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, id))
            await tx.delete(salesOrders).where(eq(salesOrders.id, id))

            await recordActivity({
                action: "DELETE",
                tableName: "sales_orders",
                recordId: id.toString(),
                description: `Menghapus Sales Order ${order.invoiceNumber}`,
            })

            revalidatePath("/dashboard/sales-orders")
            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/deliveries/create")
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to delete sales order:", error)
        return { success: false, error: "Failed to delete sales order" }
    }
}

export async function bulkDeleteSalesOrders(ids: number[]) {
    try {
        await checkPermission('sales-orders', 'delete')

        return await db.transaction(async (tx) => {
            for (const id of ids) {
                const order = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, id),
                    with: { items: true }
                })

                if (!order) continue

                // 1. Revert booked stock
                if (order.warehouseId) {
                    const wasDraft = order.status === "draft"
                    for (const item of order.items) {
                        if (!item.productId) continue

                        if (wasDraft) {
                            await tx.update(stockLevels)
                                .set({
                                    draftBookedStock: sql`${stockLevels.draftBookedStock} - ${item.quantity}`,
                                    updatedAt: new Date()
                                })
                                .where(and(
                                    eq(stockLevels.warehouseId, order.warehouseId),
                                    eq(stockLevels.productId, item.productId)
                                ))
                        } else {
                            await tx.update(stockLevels)
                                .set({
                                    bookedStock: sql`${stockLevels.bookedStock} - ${item.quantity}`,
                                    updatedAt: new Date()
                                })
                                .where(and(
                                    eq(stockLevels.warehouseId, order.warehouseId),
                                    eq(stockLevels.productId, item.productId)
                                ))
                        }
                    }
                }

                // 2. Handle related deliveries
                const relatedDeliveries = await tx.query.deliveries.findMany({
                    where: eq(deliveries.salesOrderId, order.id),
                    with: { items: true }
                })

                for (const delivery of relatedDeliveries) {
                    if (delivery.status !== "cancelled" && delivery.warehouseId) {
                        await restoreStockBookingsForDelivery(tx, delivery.id)
                        for (const dItem of delivery.items) {
                            await tx.update(stockLevels)
                                .set({
                                    totalStock: sql`${stockLevels.totalStock} + ${dItem.deliveredQuantity}`,
                                    bookedStock: sql`${stockLevels.bookedStock} + ${dItem.deliveredQuantity}`,
                                    updatedAt: new Date(),
                                })
                                .where(and(
                                    eq(stockLevels.warehouseId, delivery.warehouseId),
                                    eq(stockLevels.productId, dItem.productId)
                                ))
                        }
                    }

                    if (delivery.scanDoDocument) {
                        await deleteFile(delivery.scanDoDocument)
                    }

                    await tx.delete(stockTransfers).where(eq(stockTransfers.deliveryId, delivery.id))
                    await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, delivery.id))
                    await tx.delete(deliveries).where(eq(deliveries.id, delivery.id))
                }

                // 3. Delete SO Document
                if (order.poDocument) {
                    await deleteFile(order.poDocument)
                }
            }

            // 4. Final Bulk Deletion
            await tx.delete(salesOrderItems).where(inArray(salesOrderItems.salesOrderId, ids))
            await tx.delete(salesOrders).where(inArray(salesOrders.id, ids))

            revalidatePath("/dashboard/sales-orders")
            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/deliveries/create")
            return { success: true }
        })
    } catch (error) {
        console.error("Failed to bulk delete sales orders:", error)
        return { success: false, error: "Failed to bulk delete sales orders" }
    }
}
export async function bulkUpdateSalesOrderStatus(ids: number[], status: string) {
    try {
        await checkPermission('sales-orders', 'edit')

        return await db.transaction(async (tx) => {
            for (const id of ids) {
                const originalOrder = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, id),
                    with: { items: true }
                })

                if (!originalOrder) continue

                // Check for stock transition if status changed from draft to something else
                if (originalOrder.status === "draft" && status !== "draft" && originalOrder.warehouseId) {
                    for (const item of originalOrder.items) {
                        if (!item.productId) continue
                        await tx.update(stockLevels)
                            .set({
                                draftBookedStock: sql`${stockLevels.draftBookedStock} - ${item.quantity}`,
                                bookedStock: sql`${stockLevels.bookedStock} + ${item.quantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, originalOrder.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    }
                } else if (originalOrder.status !== "draft" && status === "draft" && originalOrder.warehouseId) {
                    // Reversed transition: Confirmed -> Draft
                    for (const item of originalOrder.items) {
                        if (!item.productId) continue
                        await tx.update(stockLevels)
                            .set({
                                draftBookedStock: sql`${stockLevels.draftBookedStock} + ${item.quantity}`,
                                bookedStock: sql`${stockLevels.bookedStock} - ${item.quantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, originalOrder.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    }
                }

                await tx.update(salesOrders)
                    .set({ status, updatedAt: new Date() })
                    .where(eq(salesOrders.id, id))
            }

            revalidatePath("/dashboard/sales-orders")
            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/deliveries/create")
            return { success: true }
        })
    } catch (error) {
        console.error("Bulk update SO status error:", error)
        return { success: false, error: "Failed to update sales order status" }
    }
}

export async function releaseExpiredDraftBookings() {
    try {
        const oneMonthAgo = new Date()
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
        const [hasPicColumn, hasTripDestinationColumn] = await Promise.all([
            hasSalesPersonColumn(),
            hasSalesOrderColumn("trip_destination"),
        ])

        const expiredDrafts = await db.query.salesOrders.findMany({
            columns: buildSalesOrderColumns(hasPicColumn, hasTripDestinationColumn),
            where: and(
                eq(salesOrders.status, "draft"),
                sql`${salesOrders.createdAt} < ${oneMonthAgo}`
            ),
            with: { items: true }
        })

        if (expiredDrafts.length === 0) return { success: true, released: 0 }

        return await db.transaction(async (tx) => {
            for (const order of expiredDrafts) {
                if (order.warehouseId) {
                    for (const item of order.items) {
                        if (!item.productId) continue
                        await tx.update(stockLevels)
                            .set({
                                draftBookedStock: sql`${stockLevels.draftBookedStock} - ${item.quantity}`,
                                updatedAt: new Date(),
                            })
                            .where(and(
                                eq(stockLevels.warehouseId, order.warehouseId),
                                eq(stockLevels.productId, item.productId)
                            ))
                    }
                }

                // Update status to 'cancelled' or similar to mark as expired
                await tx.update(salesOrders)
                    .set({
                        status: "cancelled",
                        notes: sql`concat(${salesOrders.notes}, '\nAuto-cancelled due to draft expiration (1 month)')`,
                        updatedAt: new Date()
                    })
                    .where(eq(salesOrders.id, order.id))
            }

            revalidatePath("/dashboard/sales-orders")
            revalidatePath("/dashboard/inventory")
            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/deliveries/create")
            return { success: true, released: expiredDrafts.length }
        })
    } catch (error) {
        console.error("Failed to release expired draft bookings:", error)
        return { success: false, error: "Failed to release expired draft bookings" }
    }
}

export async function sendProformaInvoiceEmail(recipientEmail: string, pdfBase64: string, invoiceNumber: string) {
    try {
        await checkPermission('sales-orders', 'view')
        
        // Remove any data URI prefix if present
        const base64Data = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64
        const buffer = Buffer.from(base64Data, 'base64')

        const result = await sendEmail({
            to: recipientEmail,
            subject: `Proforma Invoice - ${invoiceNumber}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #334155;">
                    <div style="margin-bottom: 20px;">
                        <img src="https://onechitra.dokploy.annaskhadafi.com/logo.png" alt="One Chitra" style="height: 40px;" />
                    </div>
                    <h2 style="color: #0f172a; margin-bottom: 16px;">Proforma Invoice Attachment</h2>
                    <p>Halo,</p>
                    <p>Terlampir dokumen Proforma Invoice untuk pesanan <strong>${invoiceNumber}</strong>.</p>
                    <p>Silakan tinjau lampiran PDF yang tersedia pada email ini.</p>
                    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
                        Pesan ini dikirim secara otomatis melalui sistem One Chitra.<br/>
                        &copy; ${new Date().getFullYear()} One Chitra. All rights reserved.
                    </div>
                </div>
            `,
            attachments: [
                {
                    filename: `Proforma_Invoice_${invoiceNumber}.pdf`,
                    content: buffer,
                    contentType: 'application/pdf'
                }
            ]
        })

        return result
    } catch (error) {
        console.error("Failed to send Proforma Invoice email:", error)
        return { success: false, error: "Gagal mengirim email: " + (error instanceof Error ? error.message : String(error)) }
    }
}
