"use server"

import { db } from "@/db"
import { stockMovements, stockLevels, products } from "@/db/schema"
import { sql, eq, desc, and, gte } from "drizzle-orm"
import type { ABCProduct } from "@/lib/types"

/**
 * ABC Analysis based on movement quantity (volume of transactions).
 * A = top products contributing to 80% of total movement volume
 * B = next 15% (cumulative 80-95%)
 * C = bottom 5% (cumulative 95-100%)
 *
 * @param months - look-back period in months (default 12)
 */
export async function getABCAnalysis(months: number = 12): Promise<ABCProduct[]> {
    const since = new Date()
    since.setMonth(since.getMonth() - months)

    // 1. Aggregate total absolute movement qty per product in the period
    const movementAgg = await db
        .select({
            productId: stockMovements.productId,
            totalMovementQty: sql<number>`SUM(ABS(${stockMovements.quantity}))`.mapWith(Number),
            totalMovementCount: sql<number>`COUNT(*)`.mapWith(Number),
        })
        .from(stockMovements)
        .where(gte(stockMovements.createdAt, since))
        .groupBy(stockMovements.productId)
        .orderBy(desc(sql`SUM(ABS(${stockMovements.quantity}))`))

    if (movementAgg.length === 0) return []

    // 2. Get all product info and current stock in one query
    const allProducts = await db.query.products.findMany()
    const allStocks = await db.query.stockLevels.findMany()

    const productMap = new Map(allProducts.map((p) => [p.id, p]))

    // Sum stock levels per product across all warehouses
    const stockMap = new Map<number, { totalStock: number; minStock: number }>()
    for (const s of allStocks) {
        const existing = stockMap.get(s.productId) ?? { totalStock: 0, minStock: 0 }
        stockMap.set(s.productId, {
            totalStock: existing.totalStock + s.totalStock,
            minStock: Math.max(existing.minStock, s.minStock),
        })
    }

    const grandTotal = movementAgg.reduce((sum, r) => sum + r.totalMovementQty, 0)

    let cumulative = 0
    const result: ABCProduct[] = []

    for (const row of movementAgg) {
        const product = productMap.get(row.productId)
        if (!product) continue

        cumulative += row.totalMovementQty
        const cumulativePercentage = grandTotal > 0 ? (cumulative / grandTotal) * 100 : 0

        const stock = stockMap.get(row.productId) ?? { totalStock: 0, minStock: 0 }

        let abcClass: "A" | "B" | "C" = "C"
        if (cumulativePercentage <= 80) abcClass = "A"
        else if (cumulativePercentage <= 95) abcClass = "B"

        result.push({
            productId: row.productId,
            materialNumber: product.materialNumber,
            materialDescription: product.materialDescription ?? null,
            category: product.category,
            brand: product.brand ?? null,
            totalMovementQty: row.totalMovementQty,
            totalMovementCount: row.totalMovementCount,
            cumulativePercentage: Math.round(cumulativePercentage * 10) / 10,
            abcClass,
            currentStock: stock.totalStock,
            minStock: stock.minStock,
            isLowStock: stock.minStock > 0 && stock.totalStock <= stock.minStock,
        })
    }

    return result
}

/**
 * Returns summary counts per ABC class.
 */
export async function getABCSummary(months: number = 12) {
    const data = await getABCAnalysis(months)
    const countA = data.filter((d) => d.abcClass === "A").length
    const countB = data.filter((d) => d.abcClass === "B").length
    const countC = data.filter((d) => d.abcClass === "C").length
    const totalQty = data.reduce((s, d) => s + d.totalMovementQty, 0)
    return { countA, countB, countC, totalQty, totalProducts: data.length }
}
