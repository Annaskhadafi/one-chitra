"use server"

import { db } from "@/db"
import { fleetTrips, deliveries, deliveryItems, salesOrders, salesOrderItems, fleetDrivers, fleetVehicles } from "@/db/schema"
import { eq, desc, sql, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { fleetTripSchema } from "@/lib/schemas"
import { checkPermission } from "@/lib/rbac"

export async function getFleetTrips() {
    return await db.query.fleetTrips.findMany({
        with: {
            driver: true,
            vehicle: true,
            deliveries: {
                with: {
                    salesOrder: {
                        with: {
                            customer: true
                        }
                    }
                }
            },
            createdByUser: true,
        },
        orderBy: [desc(fleetTrips.createdAt)],
    })
}

export async function getFleetTrip(id: number) {
    return await db.query.fleetTrips.findFirst({
        where: eq(fleetTrips.id, id),
        with: {
            driver: true,
            vehicle: true,
            deliveries: {
                with: {
                    salesOrder: {
                        with: {
                            customer: true
                        }
                    },
                    items: {
                        with: {
                            product: true
                        }
                    }
                }
            },
            createdByUser: true,
        },
    })
}

export async function generateTripNumber() {
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`

    const allTrips = await db.select({ tripNumber: fleetTrips.tripNumber }).from(fleetTrips)
    const todayTrips = allTrips.filter(t => t.tripNumber?.startsWith(`TRIP-${dateStr}`))
    const nextNum = todayTrips.length + 1

    return `TRIP-${dateStr}-${String(nextNum).padStart(4, "0")}`
}

function allocateSharedAmount(totalAmount: number, weights: number[]) {
    if (weights.length === 0) return []

    const normalizedWeights = weights.some((weight) => weight > 0)
        ? weights.map((weight) => Math.max(weight, 0))
        : weights.map(() => 1)

    const totalWeight = normalizedWeights.reduce((sum, weight) => sum + weight, 0) || normalizedWeights.length
    const totalCents = Math.round((Number(totalAmount) || 0) * 100)

    let allocatedCents = 0

    return normalizedWeights.map((weight, index) => {
        if (index === normalizedWeights.length - 1) {
            return Number(((totalCents - allocatedCents) / 100).toFixed(2))
        }

        const shareCents = Math.round(totalCents * (weight / totalWeight))
        allocatedCents += shareCents

        return Number((shareCents / 100).toFixed(2))
    })
}

export async function createFleetTrip(data: z.infer<typeof fleetTripSchema>) {
    try {
        await checkPermission('fleet-management', 'create')
        const tripNumber = await generateTripNumber()
        const isExternal = Boolean(data.isExternal)

        return await db.transaction(async (tx) => {
            // 1. Create Fleet Trip
            const [newTrip] = await tx.insert(fleetTrips)
                .values({
                    tripNumber,
                    driverId: isExternal ? null : (data.driverId ?? null),
                    vehicleId: isExternal ? null : (data.vehicleId ?? null),
                    status: data.status,
                    date: new Date(data.date),
                    notes: data.notes || null,
                    tripDestination: isExternal ? null : (data.tripDestination || null),
                    costGasolineDexlite: String(isExternal ? 0 : (data.costGasolineDexlite ?? 0)),
                    costGasolineBio: String(isExternal ? 0 : (data.costGasolineBio ?? 0)),
                    costToll: String(isExternal ? 0 : (data.costToll ?? 0)),
                    costParking: String(isExternal ? 0 : (data.costParking ?? 0)),
                    costMeals: String(isExternal ? 0 : (data.costMeals ?? 0)),
                    costMaintenance: String(isExternal ? 0 : (data.costMaintenance ?? 0)),
                    costOthers: String(isExternal ? 0 : (data.costOthers ?? 0)),
                    costRapidTest: String(isExternal ? 0 : (data.costRapidTest ?? 0)),
                    costFerry: String(isExternal ? 0 : (data.costFerry ?? 0)),
                    costPortal: String(isExternal ? 0 : (data.costPortal ?? 0)),
                    costWashing: String(isExternal ? 0 : (data.costWashing ?? 0)),
                    costEscort: String(isExternal ? 0 : (data.costEscort ?? 0)),
                })
                .returning()

            // 2. Fetch Driver & Vehicle details for denormalized fields in Delivery
            const driver = data.driverId
                ? await tx.query.fleetDrivers.findFirst({ where: eq(fleetDrivers.id, data.driverId) })
                : null
            const vehicle = data.vehicleId
                ? await tx.query.fleetVehicles.findFirst({ where: eq(fleetVehicles.id, data.vehicleId) })
                : null

            const pendingDeliveries: Array<{
                soId: number
                warehouseId: number | null
                itemsToDeliver: Array<{
                    salesOrderItemId: number
                    productId: number
                    remainingQuantity: number
                    productCategory: string | null
                }>
                totalQuantity: number
            }> = []

            // 3. Create Deliveries for each selected SO
            // First, get info about SO items to calculate remaining quantities
            for (const soId of data.salesOrderIds) {
                // Determine remaining items for this SO
                const soItems = await tx.query.salesOrderItems.findMany({
                    where: eq(salesOrderItems.salesOrderId, soId),
                    with: { product: true }
                })

                // Get already delivered quantities
                // This logic is duplicated from getSalesOrdersForDelivery, ideally refactor
                const deliveredItems = await tx.select({
                    salesOrderItemId: deliveryItems.salesOrderItemId,
                    totalDelivered: sql<number>`COALESCE(SUM(${deliveryItems.deliveredQuantity}), 0)`,
                })
                    .from(deliveryItems)
                    .where(inArray(deliveryItems.salesOrderItemId, soItems.map(i => i.id)))
                    .groupBy(deliveryItems.salesOrderItemId)

                const deliveredMap = new Map<number, number>()
                deliveredItems.forEach(d => deliveredMap.set(d.salesOrderItemId!, Number(d.totalDelivered)))

                const itemsToDeliver = soItems
                    .flatMap(item => {
                        if (item.productId === null || !item.product) {
                            return []
                        }

                        return [{
                            salesOrderItemId: item.id,
                            productId: item.productId,
                            remainingQuantity: item.quantity - (deliveredMap.get(item.id) || 0),
                            productCategory: item.product.category,
                        }]
                    })
                    .filter(item => item.remainingQuantity > 0)

                if (itemsToDeliver.length === 0) continue // Skip if fully delivered

                // Fetch warehouseId from SO
                const so = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, soId),
                    columns: { warehouseId: true }
                })

                pendingDeliveries.push({
                    soId,
                    warehouseId: so?.warehouseId ?? null,
                    itemsToDeliver,
                    totalQuantity: itemsToDeliver.reduce((sum, item) => sum + item.remainingQuantity, 0),
                })
            }

            const externalShippingShares = isExternal
                ? allocateSharedAmount(Number(data.shippingCost) || 0, pendingDeliveries.map((delivery) => delivery.totalQuantity))
                : []

            for (const [index, pendingDelivery] of pendingDeliveries.entries()) {
                // Generate unique delivery number manually to ensure uniqueness in loop/transaction
                const now = new Date()
                const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`

                // Use random suffix for simplicity and safety against race conditions in this context
                // In a high-volume production system, we'd use a sequence or atomic counter
                const randomSuffix = Math.floor(Math.random() * 1000000).toString().padStart(6, "0")
                const deliveryNumber = `DLV-${dateStr}-${randomSuffix}`

                const [newDelivery] = await tx.insert(deliveries)
                    .values({
                        deliveryNumber,
                        salesOrderId: pendingDelivery.soId,
                        scheduledDate: new Date(data.date),
                        status: "scheduled",
                        deliveryType: "full", // Defaulting to full
                        fleetTripId: newTrip.id,
                        driverName: isExternal ? null : (driver?.name || null),
                        vehicleNumber: isExternal ? null : (vehicle?.policeNumber || null),
                        vehicleType: isExternal ? null : (vehicle?.type || null),
                        isExternal,
                        vendorName: isExternal ? (data.vendorName || null) : null,
                        awbNumber: isExternal ? (data.awbNumber || null) : null,
                        shippingCost: isExternal ? String(externalShippingShares[index] ?? 0) : "0",
                        tripDestination: isExternal ? null : (data.tripDestination || null),
                        costGasoline: "0",
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

                        warehouseId: pendingDelivery.warehouseId,
                    })
                    .returning()

                // Create Delivery Items
                if (pendingDelivery.itemsToDeliver.length > 0) {
                    await tx.insert(deliveryItems)
                        .values(pendingDelivery.itemsToDeliver.map(item => ({
                            deliveryId: newDelivery.id,
                            salesOrderItemId: item.salesOrderItemId,
                            productId: item.productId,
                            orderedQuantity: item.remainingQuantity, // Default to remaining
                            deliveredQuantity: item.remainingQuantity, // Default to full delivery of remaining
                            serialNumbers: item.productCategory === 'TYRE' ? Array(item.remainingQuantity).fill('') : null
                        })))
                }
            }

            revalidatePath("/dashboard/deliveries")
            revalidatePath("/dashboard/fleet-management")
            return { success: true, id: newTrip.id } as const
        })
    } catch (error) {
        console.error("Failed to create fleet trip:", error)
        return { success: false, error: "Failed to create fleet trip" } as const
    }
}

export async function updateFleetTrip(id: number, data: z.infer<typeof fleetTripSchema>) {
    try {
        await checkPermission('fleet-management', 'edit')
        await db.transaction(async (tx) => {
            const isExternal = Boolean(data.isExternal)

            await tx.update(fleetTrips)
                .set({
                    tripNumber: data.tripNumber,
                    driverId: isExternal ? null : (data.driverId ?? null),
                    vehicleId: isExternal ? null : (data.vehicleId ?? null),
                    status: data.status,
                    date: new Date(data.date),
                    notes: data.notes || null,
                    tripDestination: isExternal ? null : (data.tripDestination || null),
                    costGasolineDexlite: String(isExternal ? 0 : (data.costGasolineDexlite ?? 0)),
                    costGasolineBio: String(isExternal ? 0 : (data.costGasolineBio ?? 0)),
                    costToll: String(isExternal ? 0 : (data.costToll ?? 0)),
                    costParking: String(isExternal ? 0 : (data.costParking ?? 0)),
                    costMeals: String(isExternal ? 0 : (data.costMeals ?? 0)),
                    costMaintenance: String(isExternal ? 0 : (data.costMaintenance ?? 0)),
                    costOthers: String(isExternal ? 0 : (data.costOthers ?? 0)),
                    costRapidTest: String(isExternal ? 0 : (data.costRapidTest ?? 0)),
                    costFerry: String(isExternal ? 0 : (data.costFerry ?? 0)),
                    costPortal: String(isExternal ? 0 : (data.costPortal ?? 0)),
                    costWashing: String(isExternal ? 0 : (data.costWashing ?? 0)),
                    costEscort: String(isExternal ? 0 : (data.costEscort ?? 0)),
                    updatedAt: new Date(),
                })
                .where(eq(fleetTrips.id, id))

            const driver = data.driverId
                ? await tx.query.fleetDrivers.findFirst({ where: eq(fleetDrivers.id, data.driverId) })
                : null
            const vehicle = data.vehicleId
                ? await tx.query.fleetVehicles.findFirst({ where: eq(fleetVehicles.id, data.vehicleId) })
                : null

            const linkedDeliveries = await tx.query.deliveries.findMany({
                where: eq(deliveries.fleetTripId, id),
                with: {
                    items: true,
                },
            })

            const shippingShares = isExternal
                ? allocateSharedAmount(
                    Number(data.shippingCost) || 0,
                    linkedDeliveries.map((delivery) =>
                        delivery.items.reduce((sum, item) => sum + Number(item.deliveredQuantity || 0), 0)
                    )
                )
                : []

            for (const [index, delivery] of linkedDeliveries.entries()) {
                await tx.update(deliveries)
                    .set({
                        driverName: isExternal ? null : (driver?.name || null),
                        vehicleNumber: isExternal ? null : (vehicle?.policeNumber || null),
                        vehicleType: isExternal ? null : (vehicle?.type || null),
                        isExternal,
                        vendorName: isExternal ? (data.vendorName || null) : null,
                        awbNumber: isExternal ? (data.awbNumber || null) : null,
                        shippingCost: isExternal ? String(shippingShares[index] ?? 0) : "0",
                        scheduledDate: new Date(data.date),
                        tripDestination: isExternal ? null : (data.tripDestination || null),
                        updatedAt: new Date(),
                    })
                    .where(eq(deliveries.id, delivery.id))
            }
        })

        revalidatePath("/dashboard/fleet-management")
        revalidatePath("/dashboard/deliveries")
        return { success: true }
    } catch (error) {
        console.error("Failed to update fleet trip:", error)
        return { success: false, error: "Failed to update fleet trip" }
    }
}

export async function deleteFleetTrip(id: number) {
    try {
        await checkPermission('fleet-management', 'delete')
        // Deleting trip should probably NOT delete deliveries? Or convert them to individual?
        // Or cascade delete?
        // If we cascade, we lose the deliveries.
        // If we nullify `fleetTripId`, they become individual deliveries.
        // Let's Unlink them.

        await db.transaction(async (tx) => {
            await tx.update(deliveries)
                .set({ fleetTripId: null })
                .where(eq(deliveries.fleetTripId, id))

            await tx.delete(fleetTrips).where(eq(fleetTrips.id, id))
        })

        revalidatePath("/dashboard/fleet-management")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete fleet trip" }
    }
}
export async function updateFleetTripStatus(id: number, status: string) {
    try {
        await checkPermission('fleet-management', 'edit')
        await db.update(fleetTrips)
            .set({ status, updatedAt: new Date() })
            .where(eq(fleetTrips.id, id))

        // Also update linked deliveries status? 
        // If trip is completed, deliveries should be delivered
        if (status === 'completed') {
            const trip = await db.query.fleetTrips.findFirst({
                where: eq(fleetTrips.id, id),
                with: { deliveries: true }
            })
            if (trip?.deliveries.length) {
                const deliveryIds = trip.deliveries.map(d => d.id)
                await db.update(deliveries)
                    .set({ status: 'delivered', updatedAt: new Date() })
                    .where(inArray(deliveries.id, deliveryIds))
            }
        }

        revalidatePath("/dashboard/fleet-management")
        revalidatePath("/dashboard/deliveries")
        return { success: true }
    } catch (error) {
        console.error("Failed to update fleet trip status:", error)
        return { success: false, error: "Failed to update status" }
    }
}
