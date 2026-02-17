"use server"

import { db } from "@/db"
import { warehouses } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"



import { warehouseSchema } from "@/lib/schemas"

export async function getWarehouses() {
    return await db.select().from(warehouses).orderBy(warehouses.sloc)
}

export async function createWarehouse(data: z.infer<typeof warehouseSchema>) {
    try {
        const existing = await db.select().from(warehouses).where(eq(warehouses.sloc, data.sloc)).limit(1)
        if (existing.length > 0) {
            return { success: false, error: "Warehouse with this Sloc already exists" }
        }

        await db.insert(warehouses).values(data)
        revalidatePath("/dashboard/warehouse")
        return { success: true }
    } catch (_error) {
        console.error("Create Warehouse Error:", _error)
        return { success: false, error: "Failed to create warehouse" }
    }
}

export async function updateWarehouse(id: number, data: z.infer<typeof warehouseSchema>) {
    try {
        const existing = await db.select().from(warehouses).where(eq(warehouses.sloc, data.sloc)).limit(1)
        if (existing.length > 0 && existing[0].id !== id) {
            return { success: false, error: "Sloc already taken by another warehouse" }
        }

        await db.update(warehouses)
            .set({
                sloc: data.sloc,
                description: data.description,
                updatedAt: new Date()
            })
            .where(eq(warehouses.id, id))

        revalidatePath("/dashboard/warehouse")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to update warehouse" }
    }
}

export async function deleteWarehouse(id: number) {
    try {
        await db.delete(warehouses).where(eq(warehouses.id, id))
        revalidatePath("/dashboard/warehouse")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete warehouse" }
    }
}

export async function bulkDeleteWarehouses(ids: number[]) {
    try {
        await db.delete(warehouses).where(inArray(warehouses.id, ids))
        revalidatePath("/dashboard/warehouse")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete warehouses" }
    }
}

export async function importWarehouses(data: (typeof warehouses.$inferInsert)[]) {
    try {
        if (data.length === 0) return { success: true }

        let successCount = 0
        const _errors: string[] = []

        for (const item of data) {
            if (!item.sloc || !item.description) continue

            try {
                await db.insert(warehouses)
                    .values(item)
                    .onConflictDoUpdate({
                        target: warehouses.sloc,
                        set: {
                            description: item.description,
                        }
                    })
                successCount++
            } catch (err) {
                console.error(`Failed to import warehouse ${item.sloc}:`, err)
            }
        }

        revalidatePath("/dashboard/warehouse")
        return { success: true, count: successCount }
    } catch (_error) {
        console.error("Import error:", _error)
        return { success: false, error: "Failed to import warehouses" }
    }
}
