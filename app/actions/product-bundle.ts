"use server"

import { db } from "@/db"
import { products, productBundleItems } from "@/db/schema"
import { eq, sql, and, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { productBundleSchema } from "@/lib/schemas"
import { checkPermission, getAuthenticatedSession } from "@/lib/rbac"

export async function getBundles() {
    return await db.query.products.findMany({
        where: eq(products.isBundle, true),
        with: {
            bundleItems: {
                with: {
                    childProduct: true
                }
            }
        },
        orderBy: [products.materialNumber]
    })
}

export async function getBundleDetail(id: number) {
    return await db.query.products.findFirst({
        where: and(eq(products.id, id), eq(products.isBundle, true)),
        with: {
            bundleItems: {
                with: {
                    childProduct: true
                }
            }
        }
    })
}

export async function saveBundle(data: z.infer<typeof productBundleSchema>, id?: number) {
    try {
        await checkPermission('bundling', id ? 'edit' : 'create')
        const session = await getAuthenticatedSession()
        const userId = session.user.id

        return await db.transaction(async (tx) => {
            let bundleProductId = id

            if (id) {
                // Update existing product
                await tx.update(products)
                    .set({
                        materialNumber: data.materialNumber.trim().toUpperCase(),
                        materialDescription: data.materialDescription.trim(),
                        category: data.category,
                        updatedAt: new Date()
                    })
                    .where(eq(products.id, id))

                // Delete old items
                await tx.delete(productBundleItems).where(eq(productBundleItems.parentProductId, id))
            } else {
                // Create new product as bundle
                const [newProduct] = await tx.insert(products)
                    .values({
                        materialNumber: data.materialNumber.trim().toUpperCase(),
                        materialDescription: data.materialDescription.trim(),
                        category: data.category,
                        isBundle: true,
                        // Default sloc for bundle? Or leave null? 
                        // Bundles usually don't have physical stock itself.
                        sloc: "BUNDLE", 
                        slocDescription: "Product Bundle Placeholder"
                    })
                    .returning()
                bundleProductId = newProduct.id
            }

            // Insert bundle items
            if (data.items.length > 0) {
                await tx.insert(productBundleItems)
                    .values(data.items.map(item => ({
                        parentProductId: bundleProductId!,
                        childProductId: item.childProductId,
                        quantity: item.quantity,
                    })))
            }

            revalidatePath("/dashboard/bundling")
            revalidatePath("/dashboard/products")
            return { success: true, id: bundleProductId }
        })
    } catch (error) {
        console.error("Save Bundle Error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to save bundle" }
    }
}

export async function deleteBundle(id: number) {
    try {
        await checkPermission('bundling', 'delete')
        
        return await db.transaction(async (tx) => {
            // Check if product is indeed a bundle
            const bundle = await tx.query.products.findFirst({
                where: and(eq(products.id, id), eq(products.isBundle, true))
            })

            if (!bundle) {
                return { success: false, error: "Bundle not found" }
            }

            // Delete components
            await tx.delete(productBundleItems).where(eq(productBundleItems.parentProductId, id))
            
            // Delete the product itself
            await tx.delete(products).where(eq(products.id, id))

            revalidatePath("/dashboard/bundling")
            revalidatePath("/dashboard/products")
            return { success: true }
        })
    } catch (error) {
        console.error("Delete Bundle Error:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to delete bundle" }
    }
}

export async function getBundleItemsForExpansion(bundleId: number) {
    const items = await db.query.productBundleItems.findMany({
        where: eq(productBundleItems.parentProductId, bundleId),
        with: {
            childProduct: true
        }
    })
    return items
}
