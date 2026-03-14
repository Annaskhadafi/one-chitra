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

        const buildInsightSummary = (points: { t: number; y: number; monthLabel: string; monthIndex: number }[]) => {
            if (points.length < 2) {
                return {
                    trend: "stable",
                    trendPctAvg: 0,
                    recentTrendPct: 0,
                    volatilityCv: 0,
                    seasonalityStrength: 0,
                    anomalyCount: 0,
                    narrative: "Data historis belum cukup untuk menghasilkan insight yang komprehensif."
                }
            }

            const momGrowth: number[] = []
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1].y
                const current = points[i].y
                if (prev > 0) {
                    momGrowth.push(((current - prev) / prev) * 100)
                }
            }

            const avgGrowth = momGrowth.length > 0 ? momGrowth.reduce((sum, value) => sum + value, 0) / momGrowth.length : 0
            const recentWindow = momGrowth.slice(-3)
            const recentGrowth = recentWindow.length > 0
                ? recentWindow.reduce((sum, value) => sum + value, 0) / recentWindow.length
                : avgGrowth

            const mean = points.reduce((sum, point) => sum + point.y, 0) / points.length
            const variance = points.reduce((sum, point) => sum + ((point.y - mean) ** 2), 0) / points.length
            const stdDev = Math.sqrt(variance)
            const volatilityCv = mean > 0 ? (stdDev / mean) * 100 : 0

            const monthSums = new Array(12).fill(0)
            const monthCounts = new Array(12).fill(0)
            points.forEach((point) => {
                monthSums[point.monthIndex] += point.y
                monthCounts[point.monthIndex] += 1
            })
            const monthAverages = monthSums.map((sum, idx) => monthCounts[idx] > 0 ? sum / monthCounts[idx] : 0)
            const seasonalityStrength = mean > 0
                ? (Math.max(...monthAverages) - Math.min(...monthAverages)) / mean
                : 0

            const anomalyThreshold = stdDev * 1.8
            const anomalyCount = points.filter((point) => Math.abs(point.y - mean) > anomalyThreshold).length

            const trend = recentGrowth > 2 ? "up" : recentGrowth < -2 ? "down" : "stable"
            const trendLabel = trend === "up" ? "meningkat" : trend === "down" ? "menurun" : "stabil"
            const volatilityLabel = volatilityCv > 35 ? "tinggi" : volatilityCv > 20 ? "sedang" : "rendah"
            const seasonalityLabel = seasonalityStrength > 0.45 ? "kuat" : seasonalityStrength > 0.2 ? "sedang" : "lemah"

            return {
                trend,
                trendPctAvg: Number(avgGrowth.toFixed(2)),
                recentTrendPct: Number(recentGrowth.toFixed(2)),
                volatilityCv: Number(volatilityCv.toFixed(2)),
                seasonalityStrength: Number((seasonalityStrength * 100).toFixed(2)),
                anomalyCount,
                narrative: `Revenue historis cenderung ${trendLabel} (${recentGrowth.toFixed(1)}% pada 3 bulan terakhir), volatilitas ${volatilityLabel} (CV ${volatilityCv.toFixed(1)}%), dengan pola musiman ${seasonalityLabel}. Terdeteksi ${anomalyCount} bulan anomali dari riwayat transaksi.`
            }
        }

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

        const residuals = fullTimeSeries.map((p) => {
            const pred = Math.max(0, (finalModel.a + finalModel.b * p.t) * finalModel.sIndices[p.monthIndex])
            return p.y - pred
        })
        const residualMean = residuals.reduce((sum, value) => sum + value, 0) / residuals.length
        const residualVariance = residuals.reduce((sum, value) => sum + ((value - residualMean) ** 2), 0) / residuals.length
        const residualStdDev = Math.sqrt(residualVariance)

        const WMAPE = sumActual > 0 ? (sumAbsError / sumActual) * 100 : 100
        const accuracy = Math.max(0, 100 - WMAPE)
        const insightSummary = buildInsightSummary(fullTimeSeries)
        const n = fullTimeSeries.length
        const lastDateParts = data[n - 1].month.split('-')
        let lastYear = parseInt(lastDateParts[0]), lastMonth = parseInt(lastDateParts[1])

        const forecastData = []
        for (let i = 1; i <= 12; i++) {
            lastMonth++; if (lastMonth > 12) { lastMonth = 1; lastYear++ }
            const mIdx = lastMonth - 1
            const val = Math.max(0, (finalModel.a + finalModel.b * (n + i)) * finalModel.sIndices[mIdx])
            const horizonFactor = Math.sqrt(i)
            const ci95 = residualStdDev * 1.96 * horizonFactor
            forecastData.push({
                month: `${lastYear}-${String(lastMonth).padStart(2, '0')}`,
                revenue: null,
                forecast: val,
                upper: Math.max(0, val + ci95),
                lower: Math.max(0, val - ci95),
                type: 'forecast'
            })
        }

        return {
            success: true,
            data: [
                ...fullTimeSeries.map(d => ({ month: d.monthLabel, revenue: d.y, forecast: null, upper: null, lower: null, type: 'history' })),
                ...forecastData
            ],
            accuracy: accuracy.toFixed(2),
            isReliable: accuracy > 70,
            insightSummary
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
