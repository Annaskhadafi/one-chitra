"use server"

import { db } from "@/db"
import { customerAddresses } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getCustomerAddresses(customerId: number) {
    try {
        const results = await db.select()
            .from(customerAddresses)
            .where(eq(customerAddresses.customerId, customerId))
            .orderBy(sql`${customerAddresses.updatedAt} DESC`)

        return { success: true, data: results }
    } catch (error) {
        console.error("Get Customer Addresses Error:", error)
        return { success: false, error: "Failed to fetch customer addresses" }
    }
}

export async function saveCustomerAddress(customerId: number, address: string, label?: string) {
    if (!address || !customerId) return { success: false, error: "Missing customerId or address" }

    try {
        // Check if address already exists for this customer
        const existing = await db.select()
            .from(customerAddresses)
            .where(
                and(
                    eq(customerAddresses.customerId, customerId),
                    eq(customerAddresses.address, address)
                )
            )
            .limit(1)

        if (existing.length > 0) {
            // Update timestamp if exists
            await db.update(customerAddresses)
                .set({ updatedAt: new Date() })
                .where(eq(customerAddresses.id, existing[0].id))
            return { success: true, data: existing[0] }
        }

        // Insert new address
        const [newAddress] = await db.insert(customerAddresses)
            .values({
                customerId,
                address,
                label: label || null,
            })
            .returning()

        return { success: true, data: newAddress }
    } catch (error) {
        console.error("Save Customer Address Error:", error)
        return { success: false, error: "Failed to save customer address" }
    }
}
