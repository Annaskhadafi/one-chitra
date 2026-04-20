"use server"

import { db } from "@/db"
import { slowMovingProducts } from "@/db/schema"
import { getAuthenticatedSession } from "@/lib/rbac"
import { asc, eq, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const slowMovingProductSchema = z.object({
    materialKey: z.string().trim().min(1).max(150),
    materialNumber: z.string().trim().min(1).max(150),
    description: z.string().trim().optional().nullable(),
})

export type SlowMovingProductInput = z.infer<typeof slowMovingProductSchema>

async function ensureSlowMovingProductsTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "slow_moving_products" (
            "id" serial PRIMARY KEY NOT NULL,
            "material_key" varchar(150) NOT NULL UNIQUE,
            "material_number" varchar(150) NOT NULL,
            "description" text,
            "created_by" text REFERENCES "user"("id"),
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        )
    `)
}

export async function getSlowMovingProducts() {
    await getAuthenticatedSession("marketing", "view")
    await ensureSlowMovingProductsTable()

    return await db
        .select({
            id: slowMovingProducts.id,
            materialKey: slowMovingProducts.materialKey,
            materialNumber: slowMovingProducts.materialNumber,
            description: slowMovingProducts.description,
            createdAt: slowMovingProducts.createdAt,
            updatedAt: slowMovingProducts.updatedAt,
        })
        .from(slowMovingProducts)
        .orderBy(asc(slowMovingProducts.materialNumber))
}

export async function importSlowMovingProducts(items: SlowMovingProductInput[]) {
    try {
        const session = await getAuthenticatedSession("marketing", "create")
        await ensureSlowMovingProductsTable()

        const parsedItems = z.array(slowMovingProductSchema).parse(items)
        const uniqueItems = Array.from(
            new Map(parsedItems.map((item) => [item.materialKey, item])).values()
        )

        if (uniqueItems.length === 0) {
            return { success: false, error: "Tidak ada product untuk diimport" }
        }

        for (const item of uniqueItems) {
            await db
                .insert(slowMovingProducts)
                .values({
                    materialKey: item.materialKey,
                    materialNumber: item.materialNumber,
                    description: item.description || null,
                    createdBy: session.user.id,
                })
                .onConflictDoUpdate({
                    target: slowMovingProducts.materialKey,
                    set: {
                        materialNumber: item.materialNumber,
                        description: item.description || null,
                        updatedAt: new Date(),
                    },
                })
        }

        revalidatePath("/dashboard/marketing/slow-moving")
        return { success: true, count: uniqueItems.length }
    } catch (error) {
        console.error("Import slow moving products error:", error)
        return { success: false, error: "Gagal menyimpan product slow moving" }
    }
}

export async function deleteSlowMovingProduct(materialKey: string) {
    try {
        await getAuthenticatedSession("marketing", "delete")
        await ensureSlowMovingProductsTable()

        await db
            .delete(slowMovingProducts)
            .where(eq(slowMovingProducts.materialKey, materialKey))

        revalidatePath("/dashboard/marketing/slow-moving")
        return { success: true }
    } catch (error) {
        console.error("Delete slow moving product error:", error)
        return { success: false, error: "Gagal menghapus product slow moving" }
    }
}

export async function deleteSlowMovingProducts(materialKeys: string[]) {
    try {
        await getAuthenticatedSession("marketing", "delete")
        await ensureSlowMovingProductsTable()

        const keys = Array.from(new Set(materialKeys.map((key) => key.trim()).filter(Boolean)))
        if (keys.length === 0) {
            return { success: true }
        }

        await db
            .delete(slowMovingProducts)
            .where(inArray(slowMovingProducts.materialKey, keys))

        revalidatePath("/dashboard/marketing/slow-moving")
        return { success: true }
    } catch (error) {
        console.error("Delete slow moving products error:", error)
        return { success: false, error: "Gagal menghapus product slow moving" }
    }
}
