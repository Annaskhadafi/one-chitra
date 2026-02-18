"use server"

import { db } from "@/db"
import { products } from "@/db/schema"
import { eq, sql, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"



import { productSchema } from "@/lib/schemas"

export async function getProducts() {
    return await db.select().from(products).orderBy(products.materialNumber)
}

export async function createProduct(data: z.infer<typeof productSchema>) {
    return await upsertProduct(data)
}

export async function updateProduct(id: number, data: z.infer<typeof productSchema>) {
    return await upsertProduct(data, id)
}

export async function upsertProduct(data: z.infer<typeof productSchema>, id?: number) {
    try {
        if (id) {
            const existing = await db.select().from(products).where(eq(products.materialNumber, data.materialNumber)).limit(1)
            if (existing.length > 0 && existing[0].id !== id) {
                return { success: false, error: "Material Number already taken by another product" }
            }

            await db.update(products)
                .set({
                    category: data.category,
                    materialNumber: data.materialNumber,
                    oldMaterialNo: data.oldMaterialNo,
                    materialDescription: data.materialDescription,
                    costSap: data.costSap,
                    imageUrl: data.imageUrl,
                    updatedAt: new Date()
                })
                .where(eq(products.id, id))
        } else {
            const existing = await db.select().from(products).where(eq(products.materialNumber, data.materialNumber)).limit(1)
            if (existing.length > 0) {
                return { success: false, error: "Product with this Material Number already exists" }
            }
            await db.insert(products).values({
                category: data.category,
                materialNumber: data.materialNumber,
                oldMaterialNo: data.oldMaterialNo,
                materialDescription: data.materialDescription,
                costSap: data.costSap,
                imageUrl: data.imageUrl,
            })
        }

        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        console.error("Upsert Product Error:", _error)
        return { success: false, error: "Failed to upsert product" }
    }
}

export async function deleteProduct(id: number) {
    try {
        await db.delete(products).where(eq(products.id, id))
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete product" }
    }
}

export async function importProducts(data: (typeof products.$inferInsert)[]) {
    try {
        if (data.length === 0) return { success: true }

        await db.insert(products)
            .values(data)
            .onConflictDoUpdate({
                target: products.materialNumber,
                set: {
                    category: sql`excluded.category`,
                    oldMaterialNo: sql`excluded.old_material_no`,
                    materialDescription: sql`excluded.material_description`,
                    costSap: sql`excluded.cost_sap`,
                    imageUrl: sql`excluded.image_url`,
                    updatedAt: new Date()
                }
            })

        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        console.error("Import error:", _error)
        return { success: false, error: "Failed to import products" }
    }
}

export async function getProductByMaterialNumber(materialNumber: string) {
    return await db.query.products.findFirst({
        where: eq(products.materialNumber, materialNumber)
    })
}

export async function getProductStats() {
    const allProducts = await getProducts()
    return {
        total: allProducts.length
    }
}

export async function updateProductField(id: number, field: keyof typeof products.$inferSelect, value: string | number | Date | null) {
    try {
        await db.update(products)
            .set({
                [field]: value,
                updatedAt: new Date()
            })
            .where(eq(products.id, id))

        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to update product" }
    }
}

export async function bulkDeleteProducts(ids: number[]) {
    try {
        await db.delete(products).where(inArray(products.id, ids))
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        console.error("Bulk delete error:", _error)
        return { success: false, error: "Failed to delete products" }
    }
}

export async function bulkUpdateProductCategory(ids: number[], category: string) {
    try {
        await db.update(products)
            .set({ category, updatedAt: new Date() })
            .where(inArray(products.id, ids))
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        console.error("Bulk update category error:", _error)
        return { success: false, error: "Failed to update product categories" }
    }
}
