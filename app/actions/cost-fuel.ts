"use server"

import { desc, isNotNull } from "drizzle-orm"
import { unstable_noStore as noStore } from "next/cache"

import { db } from "@/db"
import { deliveries } from "@/db/schema"
import { getAuthenticatedSession } from "@/lib/rbac"

export type CostFuelDeliveryOption = {
    id: number
    deliveryNumber: string
    driverName: string
    vehicleNumber: string
    customerName: string
    destination: string
    scheduledDate: string | null
}

export type CostFuelMasterData = {
    deliveries: CostFuelDeliveryOption[]
    drivers: string[]
    vehicles: string[]
}

export async function getCostFuelMasterData(): Promise<CostFuelMasterData> {
    noStore()
    await getAuthenticatedSession("delivery-cost-request", "view")

    const rows = await db.query.deliveries.findMany({
        columns: {
            id: true,
            deliveryNumber: true,
            driverName: true,
            vehicleNumber: true,
            tripDestination: true,
            shippingAddress: true,
            scheduledDate: true,
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
        where: isNotNull(deliveries.deliveryNumber),
        orderBy: [desc(deliveries.scheduledDate), desc(deliveries.createdAt)],
    })

    const mappedDeliveries = rows
        .filter((row) => row.deliveryNumber && row.driverName && row.vehicleNumber)
        .map((row) => ({
            id: row.id,
            deliveryNumber: row.deliveryNumber ?? `DLV-${row.id}`,
            driverName: row.driverName ?? "-",
            vehicleNumber: row.vehicleNumber ?? "-",
            customerName: row.salesOrder?.customer?.name ?? "-",
            destination: row.tripDestination ?? row.shippingAddress ?? row.salesOrder?.customer?.name ?? "-",
            scheduledDate: row.scheduledDate ? row.scheduledDate.toISOString() : null,
        }))

    const uniqueDrivers = Array.from(new Set(mappedDeliveries.map((item) => item.driverName))).sort((a, b) => a.localeCompare(b))
    const uniqueVehicles = Array.from(new Set(mappedDeliveries.map((item) => item.vehicleNumber))).sort((a, b) => a.localeCompare(b))

    return {
        deliveries: mappedDeliveries,
        drivers: uniqueDrivers,
        vehicles: uniqueVehicles,
    }
}
