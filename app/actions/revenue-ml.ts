"use server"

import { and, asc, sql } from "drizzle-orm"

import { db } from "@/db"
import { salesRevenueSap, zmc9StockSap } from "@/db/schema/sap"
import { buildRevenueMLForecast } from "@/lib/revenue-ml-forecast"
import { getAuthenticatedSession } from "@/lib/rbac"
import { salesRevenueCountableQty } from "@/lib/sales-revenue-sql"

const nonCancelledSalesRevenueCondition = sql`upper(trim(coalesce(${salesRevenueSap.cancelled}, ''))) != 'X'`

export async function getRevenueMLForecast(filters: {
    customer?: string,
    category?: string
}) {
    try {
        await getAuthenticatedSession("revenue-forecast", "view")

        const revenueConditions = [
            sql`${salesRevenueSap.billingDate} IS NOT NULL`,
            nonCancelledSalesRevenueCondition,
        ]

        if (filters.customer) {
            revenueConditions.push(sql`trim(${salesRevenueSap.customer}) = ${filters.customer.trim()}`)
        }
        if (filters.category) {
            revenueConditions.push(sql`trim(${salesRevenueSap.materialGroup}) = ${filters.category.trim()}`)
        }

        const data = await db.select({
            month: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`,
            revenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`,
            qty: sql<number>`SUM(${salesRevenueCountableQty})`,
        }).from(salesRevenueSap)
            .where(and(...revenueConditions))
            .groupBy(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`)
            .orderBy(asc(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`))

        if (data.length < 12) {
            return { success: false, error: "Data historis tidak cukup (butuh minimal 12 bulan transaksi untuk kalkulasi AI)." }
        }

        const stockConditions = [nonCancelledSalesRevenueCondition]
        if (filters.customer) {
            stockConditions.push(sql`trim(${salesRevenueSap.customer}) = ${filters.customer.trim()}`)
        }
        if (filters.category) {
            stockConditions.push(sql`trim(${salesRevenueSap.materialGroup}) = ${filters.category.trim()}`)
        }
        stockConditions.push(sql`${salesRevenueSap.materialNo} IS NOT NULL`)

        const segmentMaterials = db.select({
            materialNo: sql<string>`trim(${salesRevenueSap.materialNo})`.as("material_no"),
        }).from(salesRevenueSap)
            .where(and(...stockConditions))
            .groupBy(sql`trim(${salesRevenueSap.materialNo})`)
            .as("segment_materials")

        const trackedMaterialsResult = await db.select({
            trackedMaterials: sql<number>`COUNT(*)`,
        }).from(segmentMaterials)

        const stockSummaryResult = await db.select({
            currentStockUnits: sql<number>`COALESCE(SUM(COALESCE(${zmc9StockSap.totalStock}, 0)), 0)`,
            stockValue: sql<number>`COALESCE(SUM(COALESCE(${zmc9StockSap.valueStock}, 0)), 0)`,
            stockedMaterials: sql<number>`COUNT(DISTINCT trim(${zmc9StockSap.materialNo}))`,
        }).from(zmc9StockSap)
            .innerJoin(segmentMaterials, sql`trim(${zmc9StockSap.materialNo}) = ${sql.raw('"segment_materials"."material_no"')}`)

        const forecast = buildRevenueMLForecast(
            data.map((point) => ({
                month: point.month,
                revenue: Number(point.revenue),
                qty: Number(point.qty),
            })),
            {
                currentStockUnits: Number(stockSummaryResult[0]?.currentStockUnits ?? 0),
                stockValue: Number(stockSummaryResult[0]?.stockValue ?? 0),
                trackedMaterials: Number(trackedMaterialsResult[0]?.trackedMaterials ?? 0),
                stockedMaterials: Number(stockSummaryResult[0]?.stockedMaterials ?? 0),
            }
        )

        return {
            success: true,
            ...forecast,
        }
    } catch (error: unknown) {
        console.error("ML Forecast Error:", error)
        const message = error instanceof Error ? error.message : "Gagal membuat forecast"
        return { success: false, error: message }
    }
}

export async function getMLFilters() {
    try {
        const categories = await db.select({
            id: sql<string>`trim(${salesRevenueSap.materialGroup})`,
            name: salesRevenueSap.matGrpDesc,
        }).from(salesRevenueSap)
            .where(sql`${salesRevenueSap.materialGroup} IS NOT NULL`)
            .groupBy(sql`trim(${salesRevenueSap.materialGroup})`, salesRevenueSap.matGrpDesc)
            .orderBy(salesRevenueSap.matGrpDesc)
            .limit(1000)

        const customers = await db.select({
            id: sql<string>`trim(${salesRevenueSap.customer})`,
            name: salesRevenueSap.customerName,
        }).from(salesRevenueSap)
            .where(sql`${salesRevenueSap.customer} IS NOT NULL`)
            .groupBy(sql`trim(${salesRevenueSap.customer})`, salesRevenueSap.customerName)
            .orderBy(salesRevenueSap.customerName)
            .limit(2000)

        return {
            success: true,
            categories: categories as { id: string; name: string | null }[],
            customers: customers as { id: string; name: string | null }[],
        }
    } catch {
        return { success: false, error: "Gagal mengambil filter" }
    }
}
