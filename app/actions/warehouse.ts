"use server"

import { db } from "@/db"
import { warehouses } from "@/db/schema/warehouses"
import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export type Warehouse = typeof warehouses.$inferSelect

const warehouseSchema = z.object({
    sloc: z.string().min(1, "Sloc is required"),
    description: z.string().optional(),
})

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
    } catch (error) {
        console.error("Create Warehouse Error:", error)
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
    } catch (error) {
        return { success: false, error: "Failed to update warehouse" }
    }
}

export async function deleteWarehouse(id: number) {
    try {
        await db.delete(warehouses).where(eq(warehouses.id, id))
        revalidatePath("/dashboard/warehouse")
        return { success: true }
    } catch (error) {
        return { success: false, error: "Failed to delete warehouse" }
    }
}

export async function importWarehouses(items: { sloc: string, description?: string }[]) {
    try {
        let successCount = 0
        let errors = []

        for (const item of items) {
            // Basic validation
            if (!item.sloc) continue;

            // Check duplicate
            // Or upsert? User said "import data csv, yang langsung ke simpen ke database"
            // Usually imports overwrite or skip existing. I'll upsert based on sloc.

            await db.insert(warehouses)
                .values({
                    sloc: item.sloc,
                    description: item.description,
                })
                .onConflictDoUpdate({
                    target: warehouses.sloc,
                    set: {
                        description: item.description,
                        updatedAt: new Date()
                    }
                })

            successCount++
        }

        revalidatePath("/dashboard/warehouse")
        return { success: true, count: successCount }
    } catch (error) {
        console.error("Import Error:", error)
        return { success: false, error: "Import failed" }
    }
}
