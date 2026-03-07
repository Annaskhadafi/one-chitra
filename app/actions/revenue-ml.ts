"use server"

import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
import { eq, sql, and, gte, lte, asc, ilike } from "drizzle-orm"
import { getAuthenticatedSession } from "@/lib/rbac"

export async function getRevenueMLForecast(filters: {
    customer?: string,
    category?: string
}) {
    try {
        await getAuthenticatedSession("revenue-forecast", "view")

        // 1. Fetch historical data (aggregated by month)
        const baseQuery = db.select({
            month: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`,
            revenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
        }).from(salesRevenueSap)

        const conditions = []
        if (filters.customer) {
            conditions.push(sql`trim(${salesRevenueSap.customer}) = ${filters.customer.trim()}`)
        }
        if (filters.category) {
            conditions.push(sql`trim(${salesRevenueSap.materialGroup}) = ${filters.category.trim()}`)
        }

        const data = await baseQuery
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .groupBy(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`)
            .orderBy(asc(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`))

        if (data.length < 12) {
            // Butuh minimal 12 bulan (1 siklus) untuk baseline ML
            return { success: false, error: "Data historis tidak cukup (butuh minimal 12 bulan transaksi untuk kalkulasi AI)." }
        }

        const fullTimeSeries = data.map((d, i) => ({
            t: i + 1,
            y: Number(d.revenue),
            monthLabel: d.month,
            monthIndex: parseInt(d.month.split('-')[1]) - 1
        }))

        function calculateModel(points: any[]) {
            const n = points.length
            const sumT = points.reduce((acc, curr) => acc + curr.t, 0)
            const sumY = points.reduce((acc, curr) => acc + curr.y, 0)
            const sumTT = points.reduce((acc, curr) => acc + (curr.t * curr.t), 0)
            const sumTY = points.reduce((acc, curr) => acc + (curr.t * curr.y), 0)

            // Handle edge case where denominator is 0
            const denom = (n * sumTT - sumT * sumT)
            const b = denom !== 0 ? (n * sumTY - sumT * sumY) / denom : 0
            const a = (sumY - b * sumT) / n

            const mSums = new Array(12).fill(0); const mCounts = new Array(12).fill(0)
            points.forEach(p => { mSums[p.monthIndex] += p.y; mCounts[p.monthIndex]++ })
            const mAvgs = mSums.map((s, i) => mCounts[i] > 0 ? s / mCounts[i] : 0)
            const overallAvg = sumY / n
            const sIndices = mAvgs.map(avg => overallAvg > 0 ? avg / overallAvg : 1)

            return { a, b, sIndices }
        }

        // --- ML MODEL & ACCURACY (WMAPE) ---
        // Using all data for max robustness
        const finalModel = calculateModel(fullTimeSeries)

        let sumAbsError = 0
        let sumActual = 0
        fullTimeSeries.forEach((p) => {
            const pred = Math.max(0, (finalModel.a + finalModel.b * p.t) * finalModel.sIndices[p.monthIndex])
            sumAbsError += Math.abs(p.y - pred)
            sumActual += p.y
        })
        const WMAPE = sumActual > 0 ? (sumAbsError / sumActual) * 100 : 100
        const accuracy = Math.max(0, 100 - WMAPE)
        const n = fullTimeSeries.length
        const lastDateParts = data[n - 1].month.split('-')
        let lastYear = parseInt(lastDateParts[0]), lastMonth = parseInt(lastDateParts[1])

        const forecastData = []
        for (let i = 1; i <= 12; i++) {
            lastMonth++; if (lastMonth > 12) { lastMonth = 1; lastYear++ }
            const mIdx = lastMonth - 1
            const val = Math.max(0, (finalModel.a + finalModel.b * (n + i)) * finalModel.sIndices[mIdx])
            forecastData.push({
                month: `${lastYear}-${String(lastMonth).padStart(2, '0')}`,
                revenue: null,
                forecast: val,
                type: 'forecast'
            })
        }

        return {
            success: true,
            data: [...fullTimeSeries.map(d => ({ month: d.monthLabel, revenue: d.y, forecast: null, type: 'history' })), ...forecastData],
            accuracy: accuracy.toFixed(2),
            isReliable: accuracy > 70
        }

    } catch (error: any) {
        console.error("ML Forecast Error:", error)
        return { success: false, error: error.message || "Gagal membuat forecast" }
    }
}

export async function getMLFilters() {
    try {
        const categories = await db.select({
            id: sql<string>`trim(${salesRevenueSap.materialGroup})`,
            name: salesRevenueSap.matGrpDesc
        }).from(salesRevenueSap)
            .where(sql`${salesRevenueSap.materialGroup} IS NOT NULL`)
            .groupBy(sql`trim(${salesRevenueSap.materialGroup})`, salesRevenueSap.matGrpDesc)
            .orderBy(salesRevenueSap.matGrpDesc)
            .limit(1000)

        const customers = await db.select({
            id: sql<string>`trim(${salesRevenueSap.customer})`,
            name: salesRevenueSap.customerName
        }).from(salesRevenueSap)
            .where(sql`${salesRevenueSap.customer} IS NOT NULL`)
            .groupBy(sql`trim(${salesRevenueSap.customer})`, salesRevenueSap.customerName)
            .orderBy(salesRevenueSap.customerName)
            .limit(2000)

        return {
            success: true,
            categories: categories as { id: string; name: string | null }[],
            customers: customers as { id: string; name: string | null }[]
        }
    } catch (error) {
        return { success: false, error: "Gagal mengambil filter" }
    }
}
