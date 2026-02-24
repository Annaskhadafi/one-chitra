"use server"

import { db } from "@/db"
import { products, stockLevels } from "@/db/schema"
import { eq, sql, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { productSchema } from "@/lib/schemas"

export async function getProducts() {
    const aggregatedStock = db.select({
        productId: stockLevels.productId,
        totalStockSum: sql<number>`sum(${stockLevels.totalStock})`.as('total_stock_sum')
    })
        .from(stockLevels)
        .groupBy(stockLevels.productId)
        .as('aggregated_stock')

    const results = await db.select({
        id: products.id,
        category: products.category,
        materialNumber: products.materialNumber,
        oldMaterialNo: products.oldMaterialNo,
        materialDescription: products.materialDescription,
        brand: products.brand,
        costSap: products.costSap,
        plant: products.plant,
        sloc: products.sloc,
        slocDescription: products.slocDescription,
        typeWarehouse: products.typeWarehouse,
        imageUrl: products.imageUrl,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        isConsignment: products.isConsignment,
        totalStock: sql<number>`coalesce(${aggregatedStock.totalStockSum}, 0)`.mapWith(Number),
    })
        .from(products)
        .leftJoin(aggregatedStock, eq(products.id, aggregatedStock.productId))
        .orderBy(products.materialNumber)

    return results
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
            const existing = await db.select().from(products)
                .where(sql`${products.materialNumber} = ${data.materialNumber} AND ${products.sloc} = ${data.sloc || ''}`)
                .limit(1)
            if (existing.length > 0 && existing[0].id !== id) {
                return { success: false, error: "Product with this Material Number and Sloc already exists" }
            }

            await db.update(products)
                .set({
                    category: data.category,
                    materialNumber: data.materialNumber,
                    oldMaterialNo: data.oldMaterialNo,
                    materialDescription: data.materialDescription,
                    brand: data.brand,
                    costSap: data.costSap,
                    plant: data.plant,
                    sloc: data.sloc,
                    slocDescription: data.slocDescription,
                    imageUrl: data.imageUrl,
                    updatedAt: new Date()
                })
                .where(eq(products.id, id))
        } else {
            const existing = await db.select().from(products)
                .where(sql`${products.materialNumber} = ${data.materialNumber} AND ${products.sloc} = ${data.sloc || ''}`)
                .limit(1)
            if (existing.length > 0) {
                return { success: false, error: "Product with this Material Number and Sloc already exists" }
            }
            await db.insert(products).values({
                category: data.category,
                materialNumber: data.materialNumber,
                oldMaterialNo: data.oldMaterialNo,
                materialDescription: data.materialDescription,
                brand: data.brand,
                costSap: data.costSap,
                plant: data.plant,
                sloc: data.sloc,
                slocDescription: data.slocDescription,
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
                target: [products.materialNumber, products.sloc],
                set: {
                    category: sql`excluded.category`,
                    oldMaterialNo: sql`excluded.old_material_no`,
                    materialDescription: sql`excluded.material_description`,
                    brand: sql`excluded.brand`,
                    costSap: sql`excluded.cost_sap`,
                    plant: sql`excluded.plant`,
                    slocDescription: sql`excluded.sloc_description`,
                    typeWarehouse: sql`excluded.type_warehouse`,
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
