import { db } from "@/db"
import { customers, products, stockBookingConsumptions, stockCustomerBookings, stockLevels, warehouses } from "@/db/schema"
import { and, eq, sql } from "drizzle-orm"

type BookingExecutor = Pick<typeof db, "select" | "insert" | "update" | "delete" | "query">
type BookingReadExecutor = Pick<typeof db, "select" | "query">
let stockBookingSchemaAvailability: boolean | null = null

export async function isStockBookingSchemaAvailable(forceRefresh = false) {
    if (!forceRefresh && stockBookingSchemaAvailability === true) {
        return stockBookingSchemaAvailability
    }

    try {
        const result = await db.execute(sql`
            select
                exists (
                    select 1
                    from information_schema.tables
                    where table_schema = 'public' and table_name = 'stock_customer_bookings'
                ) as has_customer_bookings,
                exists (
                    select 1
                    from information_schema.tables
                    where table_schema = 'public' and table_name = 'stock_booking_consumptions'
                ) as has_booking_consumptions
        `)

        const row = result.rows[0] as {
            has_customer_bookings?: boolean | "t" | "f" | 1 | 0 | null
            has_booking_consumptions?: boolean | "t" | "f" | 1 | 0 | null
        } | undefined

        const hasCustomerBookings = row?.has_customer_bookings === true || row?.has_customer_bookings === "t" || row?.has_customer_bookings === 1
        const hasBookingConsumptions = row?.has_booking_consumptions === true || row?.has_booking_consumptions === "t" || row?.has_booking_consumptions === 1

        stockBookingSchemaAvailability = hasCustomerBookings && hasBookingConsumptions
        return stockBookingSchemaAvailability
    } catch {
        if (forceRefresh) {
            stockBookingSchemaAvailability = false
        }
        return false
    }
}

export type StockBookingConsumptionItem = {
    productId: number
    quantity: number
}

export type ActiveStockBookingRow = {
    id: number
    stockLevelId: number
    customerId: number
    customerName: string
    quantity: number
    remark: string | null
}

export type StockBookingAvailability = {
    totalReservedQty: number
    otherReservedQty: number
    customerReservedQty: number
    availableQty: number
    bookings: ActiveStockBookingRow[]
}

async function getMatchingBookingRows(
    executor: BookingReadExecutor,
    warehouseId: number,
    productId: number,
) {
    if (!(await isStockBookingSchemaAvailable())) {
        return []
    }

    const rows = await executor
        .select({
            id: stockCustomerBookings.id,
            stockLevelId: stockCustomerBookings.stockLevelId,
            customerId: stockCustomerBookings.customerId,
            customerName: customers.name,
            quantity: stockCustomerBookings.quantity,
            remark: stockCustomerBookings.remark,
        })
        .from(stockCustomerBookings)
        .innerJoin(stockLevels, eq(stockCustomerBookings.stockLevelId, stockLevels.id))
        .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
        .innerJoin(products, eq(stockLevels.productId, products.id))
        .innerJoin(customers, eq(stockCustomerBookings.customerId, customers.id))
        .where(and(
            sql`${stockCustomerBookings.quantity} > 0`,
            sql`${warehouses.sloc} = (SELECT sloc FROM warehouses WHERE id = ${warehouseId})`,
            sql`${products.materialNumber} = (SELECT material_number FROM products WHERE id = ${productId} LIMIT 1)`,
        ))

    return rows
        .map((row) => ({
            id: Number(row.id),
            stockLevelId: Number(row.stockLevelId),
            customerId: Number(row.customerId),
            customerName: row.customerName ?? `Customer #${row.customerId}`,
            quantity: Number(row.quantity ?? 0),
            remark: row.remark ?? null,
        }))
        .sort((left, right) => left.id - right.id)
}

export async function getStockBookingAvailability(
    executor: BookingReadExecutor,
    {
        warehouseId,
        productId,
        totalStock,
        customerId,
    }: {
        warehouseId: number
        productId: number
        totalStock: number
        customerId?: number | null
    },
): Promise<StockBookingAvailability> {
    const bookings = await getMatchingBookingRows(executor, warehouseId, productId)
    const totalReservedQty = bookings.reduce((sum, booking) => sum + booking.quantity, 0)
    const customerReservedQty = customerId
        ? bookings
            .filter((booking) => booking.customerId === customerId)
            .reduce((sum, booking) => sum + booking.quantity, 0)
        : 0
    const otherReservedQty = Math.max(totalReservedQty - customerReservedQty, 0)

    return {
        totalReservedQty,
        otherReservedQty,
        customerReservedQty,
        availableQty: Math.max(totalStock - otherReservedQty, 0),
        bookings,
    }
}

export async function restoreStockBookingsForDelivery(
    executor: BookingExecutor,
    deliveryId: number,
) {
    if (!(await isStockBookingSchemaAvailable())) {
        return
    }

    const consumptions = await executor.query.stockBookingConsumptions.findMany({
        where: eq(stockBookingConsumptions.deliveryId, deliveryId),
    })

    for (const consumption of consumptions) {
        await executor.update(stockCustomerBookings)
            .set({
                quantity: sql`${stockCustomerBookings.quantity} + ${consumption.quantity}`,
                updatedAt: new Date(),
            })
            .where(eq(stockCustomerBookings.id, consumption.stockBookingId))
    }

    if (consumptions.length > 0) {
        await executor.delete(stockBookingConsumptions)
            .where(eq(stockBookingConsumptions.deliveryId, deliveryId))
    }
}

export async function consumeStockBookingsForDelivery(
    executor: BookingExecutor,
    {
        deliveryId,
        warehouseId,
        customerId,
        items,
    }: {
        deliveryId: number
        warehouseId: number
        customerId?: number | null
        items: StockBookingConsumptionItem[]
    },
) {
    if (!(await isStockBookingSchemaAvailable())) {
        return
    }

    if (!customerId) {
        return
    }

    for (const item of items) {
        let remainingToConsume = Math.max(Number(item.quantity) || 0, 0)

        if (remainingToConsume <= 0) {
            continue
        }

        const customerBookings = (await getMatchingBookingRows(executor, warehouseId, item.productId))
            .filter((booking) => booking.customerId === customerId && booking.quantity > 0)

        for (const booking of customerBookings) {
            if (remainingToConsume <= 0) {
                break
            }

            const consumedQty = Math.min(booking.quantity, remainingToConsume)

            await executor.update(stockCustomerBookings)
                .set({
                    quantity: Math.max(booking.quantity - consumedQty, 0),
                    updatedAt: new Date(),
                })
                .where(eq(stockCustomerBookings.id, booking.id))

            const existingConsumption = await executor.query.stockBookingConsumptions.findFirst({
                where: and(
                    eq(stockBookingConsumptions.deliveryId, deliveryId),
                    eq(stockBookingConsumptions.stockBookingId, booking.id),
                ),
            })

            if (existingConsumption) {
                await executor.update(stockBookingConsumptions)
                    .set({
                        quantity: existingConsumption.quantity + consumedQty,
                        updatedAt: new Date(),
                    })
                    .where(eq(stockBookingConsumptions.id, existingConsumption.id))
            } else {
                await executor.insert(stockBookingConsumptions)
                    .values({
                        deliveryId,
                        stockBookingId: booking.id,
                        quantity: consumedQty,
                    })
            }

            remainingToConsume -= consumedQty
        }
    }
}
