"use server"

import { db } from "@/db"
import { customers } from "@/db/schema/customers"
import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export type Customer = typeof customers.$inferSelect

const customerSchema = z.object({
    customerCode: z.string().min(1, "Customer Code is required"),
    name: z.string().min(1, "Customer Name is required"),
    contactName: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    address1: z.string().optional(),
    address2: z.string().optional(),
    address3: z.string().optional(),
    address4: z.string().optional(),
    address5: z.string().optional(),
})

export async function getCustomers() {
    return await db.select().from(customers).orderBy(customers.customerCode)
}

export async function createCustomer(data: z.infer<typeof customerSchema>) {
    try {
        const existing = await db.select().from(customers).where(eq(customers.customerCode, data.customerCode)).limit(1)
        if (existing.length > 0) {
            return { success: false, error: "Customer with this code already exists" }
        }

        await db.insert(customers).values(data)
        revalidatePath("/dashboard/customers")
        return { success: true }
    } catch (error) {
        console.error("Create Customer Error:", error)
        return { success: false, error: "Failed to create customer" }
    }
}

export async function updateCustomer(id: number, data: z.infer<typeof customerSchema>) {
    try {
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

        revalidatePath("/dashboard/customers")
        return { success: true }
    } catch (error) {
        return { success: false, error: "Failed to update customer" }
    }
}

export async function deleteCustomer(id: number) {
    try {
        await db.delete(customers).where(eq(customers.id, id))
        revalidatePath("/dashboard/customers")
        return { success: true }
    } catch (error) {
        return { success: false, error: "Failed to delete customer" }
    }
}

export async function importCustomers(items: any[]) {
    try {
        let successCount = 0

        for (const item of items) {
            if (!item.customerCode || !item.name) continue;

            await db.insert(customers)
                .values({
                    customerCode: item.customerCode.toString(),
                    name: item.name.toString(),
                    contactName: item.contactName?.toString() || null,
                    email: item.email?.toString() || null,
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
    } catch (error) {
        console.error("Import Customer Error:", error)
        return { success: false, error: "Customer import failed" }
    }
}
