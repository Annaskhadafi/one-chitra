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

export type MonthlySellingQty = {
    materialKey: string
    monthlyQty: Record<string, number>
    monthlyRevenue: Record<string, number>
    details: SellingOutDetail[]
    totalQtySold: number
    totalRevenue: number
}

export type SellingOutDetail = {
    month: string
    billingDate: string | null
    billingNo: string | null
    qty: number
    revenueInDocCurr: number
    total: number
    sales: string | null
    customer: string | null
}

export async function getSellingOutByMonth(materialKeys: string[]): Promise<MonthlySellingQty[]> {
    if (materialKeys.length === 0) return []

    const upperKeys = materialKeys.map((k) => k.toUpperCase())
    const safeList = upperKeys.map((k) => k.replace(/'/g, "''")).map((k) => "'" + k + "'").join(",")

    const monthlyResult = await db.execute(
        sql.raw(
            "SELECT UPPER(TRIM(material_no)) AS material_key, TO_CHAR(billing_date, 'YYYY-MM') AS month, billing_date, billing_no, qty, revenue_in_doc_curr, salesman, customer_name FROM sales_revenue_sap WHERE billing_date IS NOT NULL AND (cancelled IS NULL OR cancelled = '') AND UPPER(TRIM(material_no)) = ANY(ARRAY[" + safeList + "]) ORDER BY UPPER(TRIM(material_no)), billing_date DESC, billing_no"
        )
    )

    const monthlyMap = new Map<string, Record<string, number>>()
    const monthlyRevenueMap = new Map<string, Record<string, number>>()
    const summaryMap = new Map<string, { totalQtySold: number; totalRevenue: number }>()
    const detailMap = new Map<string, SellingOutDetail[]>()
    for (const row of monthlyResult.rows as { material_key: string; month: string; billing_date: string | Date | null; billing_no: string | null; qty: string | number | null; revenue_in_doc_curr: string | number | null; salesman: string | null; customer_name: string | null }[]) {
        const key = row.material_key
        const qty = Number(row.qty) || 0
        const revenue = Number(row.revenue_in_doc_curr) || 0
        if (!monthlyMap.has(key)) monthlyMap.set(key, {})
        if (!monthlyRevenueMap.has(key)) monthlyRevenueMap.set(key, {})
        if (!detailMap.has(key)) detailMap.set(key, [])
        monthlyMap.get(key)![row.month] = (monthlyMap.get(key)![row.month] ?? 0) + qty
        monthlyRevenueMap.get(key)![row.month] = (monthlyRevenueMap.get(key)![row.month] ?? 0) + revenue
        detailMap.get(key)!.push({
            month: row.month,
            billingDate: row.billing_date instanceof Date ? row.billing_date.toISOString().slice(0, 10) : row.billing_date,
            billingNo: row.billing_no,
            qty,
            revenueInDocCurr: revenue,
            total: revenue,
            sales: row.salesman,
            customer: row.customer_name,
        })
        const current = summaryMap.get(key) ?? { totalQtySold: 0, totalRevenue: 0 }
        summaryMap.set(key, {
            totalQtySold: current.totalQtySold + qty,
            totalRevenue: current.totalRevenue + revenue,
        })
    }

    return upperKeys.map((k) => ({
        materialKey: k,
        monthlyQty: monthlyMap.get(k) ?? {},
        monthlyRevenue: monthlyRevenueMap.get(k) ?? {},
        details: detailMap.get(k) ?? [],
        totalQtySold: summaryMap.get(k)?.totalQtySold ?? 0,
        totalRevenue: summaryMap.get(k)?.totalRevenue ?? 0,
    }))
}
