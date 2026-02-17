"use server"

import { db } from "@/db"
import { products } from "@/db/schema/products"
import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export type Product = typeof products.$inferSelect

const productSchema = z.object({
    category: z.enum(["ACC", "FLAP", "IMT PART", "TUBE", "TYRE", "WHEEL & RIM"]),
    materialNumber: z.string().min(1, "Material Number is required"),
    oldMaterialNo: z.string().optional(),
    materialDescription: z.string().optional(),
})

export async function getProducts() {
    return await db.select().from(products).orderBy(products.materialNumber)
}

export async function createProduct(data: z.infer<typeof productSchema>) {
    try {
        const existing = await db.select().from(products).where(eq(products.materialNumber, data.materialNumber)).limit(1)
        if (existing.length > 0) {
            return { success: false, error: "Product with this Material Number already exists" }
        }

        await db.insert(products).values(data)
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (error) {
        console.error("Create Product Error:", error)
        return { success: false, error: "Failed to create product" }
    }
}

export async function updateProduct(id: number, data: z.infer<typeof productSchema>) {
    try {
        const existing = await db.select().from(products).where(eq(products.materialNumber, data.materialNumber)).limit(1)
        if (existing.length > 0 && existing[0].id !== id) {
            return { success: false, error: "Material Number already taken by another product" }
        }

        await db.update(products)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(eq(products.id, id))

        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (error) {
        console.error("Update Product Error:", error)
        return { success: false, error: "Failed to update product" }
    }
}

export async function deleteProduct(id: number) {
    try {
        await db.delete(products).where(eq(products.id, id))
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (error) {
        return { success: false, error: "Failed to delete product" }
    }
}

export async function importProducts(items: any[]) {
    try {
        let successCount = 0
        const categories = ["ACC", "FLAP", "IMT PART", "TUBE", "TYRE", "WHEEL & RIM"]

        for (const item of items) {
            if (!item.materialNumber) continue;

            // Validate category or set default
            let category = (item.category || "").toUpperCase()
            if (!categories.includes(category)) {
                category = "TYRE" // Default or skip? I'll use TYRE as seen in screenshot
            }

            await db.insert(products)
                .values({
                    category: category as any,
                    materialNumber: item.materialNumber,
                    oldMaterialNo: item.oldMaterialNo,
                    materialDescription: item.materialDescription,
                })
                .onConflictDoUpdate({
                    target: products.materialNumber,
                    set: {
                        category: category as any,
                        oldMaterialNo: item.oldMaterialNo,
                        materialDescription: item.materialDescription,
                        updatedAt: new Date()
                    }
                })

            successCount++
        }

        revalidatePath("/dashboard/products")
        return { success: true, count: successCount }
    } catch (error) {
        console.error("Import Error:", error)
        return { success: false, error: "Import failed" }
    }
}
