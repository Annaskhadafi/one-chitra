"use server"

import { db } from "@/db"
import { customers, customerAddresses } from "@/db/schema"
import { eq, inArray, and, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"



import { customerSchema } from "@/lib/schemas"

export async function getCustomers() {
    return await db.select().from(customers).orderBy(customers.customerCode)
}

export async function createCustomer(data: z.infer<typeof customerSchema>) {
    return await upsertCustomer(undefined, data)
}

export async function updateCustomer(id: number, data: z.infer<typeof customerSchema>) {
    return await upsertCustomer(id, data)
}

export async function upsertCustomer(id: number | undefined, data: z.infer<typeof customerSchema>) {
    try {
        if (id) {
            const existing = await db.select().from(customers).where(eq(customers.customerCode, data.customerCode)).limit(1)
            if (existing.length > 0 && existing[0].id !== id) {
                return { success: false, error: "Customer code already taken" }
            }

            await db.update(customers)
                .set({
                    ...data,
                    updatedAt: new Date()
                })
                .where(eq(customers.id, id))
        } else {
            const existing = await db.select().from(customers).where(eq(customers.customerCode, data.customerCode)).limit(1)
            if (existing.length > 0) {
                return { success: false, error: "Customer with this code already exists" }
            }
            await db.insert(customers).values(data)
        }

        revalidatePath("/dashboard/customers")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to upsert customer" }
    }
}

export async function deleteCustomer(id: number) {
    try {
        await db.delete(customers).where(eq(customers.id, id))
        revalidatePath("/dashboard/customers")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete customer" }
    }
}

export async function bulkDeleteCustomers(ids: number[]) {
    try {
        await db.delete(customers).where(inArray(customers.id, ids))
        revalidatePath("/dashboard/customers")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete customers" }
    }
}

export async function importCustomers(data: (typeof customers.$inferInsert)[]) {
    try {
        if (data.length === 0) return { success: true }

        let successCount = 0

        for (const item of data) {
            if (!item.customerCode || !item.name) continue;

            await db.insert(customers)
                .values({
                    customerCode: item.customerCode.toString(),
                    name: item.name.toString(),
                    contactName: item.contactName?.toString() || null,
                    email: item.email?.toString() || null,
                    birthday: item.birthday?.toString() || null,
                    address1: item.address1?.toString() || null,
                    address2: item.address2?.toString() || null,
                    address3: item.address3?.toString() || null,
                    address4: item.address4?.toString() || null,
                    address5: item.address5?.toString() || null,
                })
                .onConflictDoUpdate({
                    target: customers.customerCode,
                    set: {
                        name: item.name.toString(),
                        contactName: item.contactName?.toString() || null,
                        email: item.email?.toString() || null,
                        birthday: item.birthday?.toString() || null,
                        address1: item.address1?.toString() || null,
                        address2: item.address2?.toString() || null,
                        address3: item.address3?.toString() || null,
                        address4: item.address4?.toString() || null,
                        address5: item.address5?.toString() || null,
                        updatedAt: new Date()
                    }
                })

            successCount++
        }

        revalidatePath("/dashboard/customers")
        return { success: true, count: successCount }
    } catch (_error) {
        console.error("Import Customer Error:", _error)
        return { success: false, error: "Customer import failed" }
    }
}

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
