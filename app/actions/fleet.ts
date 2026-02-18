"use server"

import { db } from "@/db"
import { fleetDrivers, fleetVehicles } from "@/db/schema/fleet"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getDrivers() {
    return await db.select().from(fleetDrivers)
        .where(eq(fleetDrivers.isActive, true))
        .orderBy(desc(fleetDrivers.createdAt))
}

export async function createDriver(name: string) {
    try {
        const [driver] = await db.insert(fleetDrivers)
            .values({ name })
            .returning()
        revalidatePath("/dashboard/deliveries")
        return { success: true, data: driver }
    } catch (error) {
        console.error("Failed to create driver:", error)
        return { success: false, error: "Failed to create driver" }
    }
}

export async function getVehicles() {
    return await db.select().from(fleetVehicles)
        .where(eq(fleetVehicles.isActive, true))
        .orderBy(desc(fleetVehicles.createdAt))
}

export async function createVehicle(policeNumber: string, type: string) {
    try {
        const [vehicle] = await db.insert(fleetVehicles)
            .values({ policeNumber, type })
            .returning()
        revalidatePath("/dashboard/deliveries")
        return { success: true, data: vehicle }
    } catch (error) {
        console.error("Failed to create vehicle:", error)
        return { success: false, error: "Failed to create vehicle" }
    }
}
