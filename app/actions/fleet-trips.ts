"use server"

import { db } from "@/db"
import { fleetTrips, deliveries, deliveryItems, salesOrders, salesOrderItems, stockLevels, fleetDrivers, fleetVehicles } from "@/db/schema"
import { eq, desc, and, sql, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { fleetTripSchema } from "@/lib/schemas"
import { checkPermission } from "@/lib/rbac"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

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

export async function createFleetTrip(data: z.infer<typeof fleetTripSchema>) {
    try {
        await checkPermission('fleet-management', 'create')
        const tripNumber = await generateTripNumber()

        return await db.transaction(async (tx) => {
            // 1. Create Fleet Trip
            const [newTrip] = await tx.insert(fleetTrips)
                .values({
                    tripNumber,
                    driverId: data.driverId,
                    vehicleId: data.vehicleId,
                    status: data.status,
                    date: new Date(data.date),
                    notes: data.notes || null,
                    costGasoline: data.costGasoline ? String(data.costGasoline) : "0",
                    costToll: data.costToll ? String(data.costToll) : "0",
                    costParking: data.costParking ? String(data.costParking) : "0",
                    costMeals: data.costMeals ? String(data.costMeals) : "0",
                    costMaintenance: data.costMaintenance ? String(data.costMaintenance) : "0",
                    costOthers: data.costOthers ? String(data.costOthers) : "0",
                })
                .returning()

            // 2. Fetch Driver & Vehicle details for denormalized fields in Delivery
            const driver = await tx.query.fleetDrivers.findFirst({ where: eq(fleetDrivers.id, data.driverId) })
            const vehicle = await tx.query.fleetVehicles.findFirst({ where: eq(fleetVehicles.id, data.vehicleId) })

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

                // Generate unique delivery number manually to ensure uniqueness in loop/transaction
                const now = new Date()
                const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`

                // Use random suffix for simplicity and safety against race conditions in this context
                // In a high-volume production system, we'd use a sequence or atomic counter
                const randomSuffix = Math.floor(Math.random() * 1000000).toString().padStart(6, "0")
                const deliveryNumber = `DLV-${dateStr}-${randomSuffix}`

                // Fetch warehouseId from SO
                const so = await tx.query.salesOrders.findFirst({
                    where: eq(salesOrders.id, soId),
                    columns: { warehouseId: true }
                })

                const [newDelivery] = await tx.insert(deliveries)
                    .values({
                        deliveryNumber,
                        salesOrderId: soId,
                        scheduledDate: new Date(data.date),
                        status: "scheduled",
                        deliveryType: "full", // Defaulting to full
                        // Internal Fleet
                        fleetTripId: newTrip.id,
                        driverName: driver?.name,
                        vehicleNumber: vehicle?.policeNumber,
                        vehicleType: vehicle?.type,
                        isExternal: false,
                        shippingCost: "0", // Cost is on Trip
                        // Cost breakdown 0 on delivery
                        costGasoline: "0",
                        costToll: "0",
                        costParking: "0",
                        costMeals: "0",
                        costMaintenance: "0",
                        costOthers: "0",

                        warehouseId: so?.warehouseId,
                    })
                    .returning()

                // Oops, `generateDeliveryNumber` returns a string.
                // Let's just use `crypto.randomUUID` or similar if we don't care about sequential perfectly.
                // User expects sequential? "DLV-YYYYMMDD-XXXX".
                // I will update the delivery number AFTER loop or just use a placeholder and rely on trigger? No trigger.

                // Create Delivery Items
                if (itemsToDeliver.length > 0) {
                    await tx.insert(deliveryItems)
                        .values(itemsToDeliver.map(item => ({
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
            await tx.update(fleetTrips)
                .set({
                    tripNumber: data.tripNumber,
                    driverId: data.driverId,
                    vehicleId: data.vehicleId,
                    status: data.status,
                    date: new Date(data.date),
                    notes: data.notes || null,
                    costGasoline: data.costGasoline ? String(data.costGasoline) : "0",
                    costToll: data.costToll ? String(data.costToll) : "0",
                    costParking: data.costParking ? String(data.costParking) : "0",
                    costMeals: data.costMeals ? String(data.costMeals) : "0",
                    costMaintenance: data.costMaintenance ? String(data.costMaintenance) : "0",
                    costOthers: data.costOthers ? String(data.costOthers) : "0",
                    updatedAt: new Date(),
                })
                .where(eq(fleetTrips.id, id))

            // Sync driver/vehicle to linked deliveries?
            // Yes, if trip driver changes, deliveries should reflect that?
            // "Satu Armada bisa membawa beberapa Po". Yes.
            const driver = await tx.query.fleetDrivers.findFirst({ where: eq(fleetDrivers.id, data.driverId) })
            const vehicle = await tx.query.fleetVehicles.findFirst({ where: eq(fleetVehicles.id, data.vehicleId) })

            await tx.update(deliveries)
                .set({
                    driverName: driver?.name,
                    vehicleNumber: vehicle?.policeNumber,
                    vehicleType: vehicle?.type,
                    scheduledDate: new Date(data.date), // Sync date?
                })
                .where(eq(deliveries.fleetTripId, id))
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
    } catch (error) {
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
