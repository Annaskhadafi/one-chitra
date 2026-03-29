"use server"

import { ARIMA, AutoARIMA } from "ts-arima-forecast"
import { db } from "@/db"
import { stockLevels } from "@/db/schema/stock-levels"
import { products } from "@/db/schema/products"
import { salesRevenueSap } from "@/db/schema/sap"
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm"

export type ForecastGranularity = "weekly" | "monthly" | "quarterly" | "yearly"
export type ForecastingAlgorithm = "auto_arima" | "seasonal" | "moving_average" | "trend"

export type ProcurementNextFilters = {
    horizonMonths?: number
    chartGranularity?: ForecastGranularity
    forecastingAlgorithm?: ForecastingAlgorithm
}

export type ProcurementNextItem = {
    stockLevelId: number
    materialNumber: string
    description: string
    category: string
    currentStock: number
    minStock: number
    stockValue: number
    sold30d: number
    sold60d: number
    sold90d: number
    monthlyAvg: number
    dailyAvg30d: number
    dailyAvg60d: number
    dailyAvg90d: number
    daysCover30d: number | null
    daysCover60d: number | null
    daysCover90d: number | null
    lastSaleDate: string | null
    recommendedQty: number
    recommendedValue: number
    priority: "urgent" | "soon" | "healthy" | "watch"
}

type ForecastChartPoint = {
    label: string
    periodKey: string
    actualSales: number | null
    forecastSales: number | null
    projectedStock: number | null
    predictedLostSales: number | null
    isForecast: boolean
}

type ForecastComputationResult = {
    values: number[]
    effectiveAlgorithm: ForecastingAlgorithm | "fallback_moving_average"
    fallbackReason: string | null
}

type ProcurementNextResponse = {
    success: boolean
    data?: {
        filters: {
            horizonMonths: number
            chartGranularity: ForecastGranularity
            forecastingAlgorithm: ForecastingAlgorithm
        }
        summary: {
            totalItems: number
            urgentItems: number
            soonItems: number
            healthyItems: number
            watchItems: number
            totalStockValue: number
            totalRecommendedQty: number
            totalRecommendedValue: number
            averageDaysCover30d: number | null
            averageDaysCover60d: number | null
            averageDaysCover90d: number | null
            totalForecastQty: number
            totalPredictedLostSales: number
            effectiveForecastAlgorithm: string
            forecastFallbackReason: string | null
        }
        charts: {
            urgencyBreakdown: Array<{ name: string; value: number; fill: string }>
            forecastTrend: ForecastChartPoint[]
            topRecommendations: Array<{ name: string; qty: number; value: number; warehouseCount: number; label: string }>
            categoryRisk: Array<{ category: string; urgent: number; soon: number; healthy: number; watch: number }>
        }
        items: ProcurementNextItem[]
    }
    error?: string
}

const PRIORITY_META = {
    urgent: { label: "Urgent", fill: "#dc2626" },
    soon: { label: "Soon", fill: "#f59e0b" },
    watch: { label: "Watch", fill: "#0ea5e9" },
    healthy: { label: "Healthy", fill: "#16a34a" },
} as const

function monthKey(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
}

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, offset: number) {
    return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function startOfWeek(date: Date) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const day = result.getDay()
    const diff = day === 0 ? -6 : 1 - day
    result.setDate(result.getDate() + diff)
    result.setHours(0, 0, 0, 0)
    return result
}

function startOfQuarter(date: Date) {
    const quarterMonth = Math.floor(date.getMonth() / 3) * 3
    return new Date(date.getFullYear(), quarterMonth, 1)
}

function startOfYear(date: Date) {
    return new Date(date.getFullYear(), 0, 1)
}

function startOfGranularity(date: Date, granularity: ForecastGranularity) {
    if (granularity === "weekly") return startOfWeek(date)
    if (granularity === "monthly") return startOfMonth(date)
    if (granularity === "quarterly") return startOfQuarter(date)
    return startOfYear(date)
}

function addPeriods(date: Date, granularity: ForecastGranularity, offset: number) {
    if (granularity === "weekly") {
        const next = new Date(date)
        next.setDate(next.getDate() + (offset * 7))
        return startOfWeek(next)
    }
    if (granularity === "monthly") {
        return addMonths(date, offset)
    }
    if (granularity === "quarterly") {
        return new Date(date.getFullYear(), date.getMonth() + (offset * 3), 1)
    }
    return new Date(date.getFullYear() + offset, 0, 1)
}

function periodKey(date: Date, granularity: ForecastGranularity) {
    if (granularity === "weekly") {
        return startOfWeek(date).toISOString().slice(0, 10)
    }
    if (granularity === "monthly") {
        return monthKey(date)
    }
    if (granularity === "quarterly") {
        const quarter = Math.floor(date.getMonth() / 3) + 1
        return `${date.getFullYear()}-Q${quarter}`
    }
    return String(date.getFullYear())
}

function formatPeriodLabel(date: Date, granularity: ForecastGranularity) {
    if (granularity === "weekly") {
        const end = new Date(date)
        end.setDate(end.getDate() + 6)
        return `${String(date.getDate()).padStart(2, "0")} ${date.toLocaleString("en-US", { month: "short" })}`
            + ` - ${String(end.getDate()).padStart(2, "0")} ${end.toLocaleString("en-US", { month: "short" })}`
    }
    if (granularity === "monthly") {
        return date.toLocaleString("en-US", { month: "short", year: "2-digit" })
    }
    if (granularity === "quarterly") {
        return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
    }
    return String(date.getFullYear())
}

function normalizeNumber(value: unknown) {
    const num = Number(value ?? 0)
    return Number.isFinite(num) ? num : 0
}

function sanitizeSeries(values: number[]) {
    return values.map((value) => {
        if (!Number.isFinite(value) || Number.isNaN(value)) return 0
        return Math.max(Number(value.toFixed(1)), 0)
    })
}

function getFuturePeriods(granularity: ForecastGranularity) {
    if (granularity === "weekly") return 8
    if (granularity === "monthly") return 6
    if (granularity === "quarterly") return 4
    return 3
}

function getWindowSize(granularity: ForecastGranularity) {
    if (granularity === "weekly") return 4
    if (granularity === "monthly") return 3
    if (granularity === "quarterly") return 2
    return 2
}

function getSeasonLength(granularity: ForecastGranularity) {
    if (granularity === "weekly") return 4
    if (granularity === "monthly") return 3
    if (granularity === "quarterly") return 4
    return 2
}

function average(values: number[]) {
    if (values.length === 0) return 0
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

function isForecastShapeReasonable(history: number[], forecast: number[]) {
    if (forecast.length === 0) return false

    const recentWindow = history.slice(-Math.min(4, history.length))
    const recentAverage = average(recentWindow)
    const maxHistory = Math.max(...history, 0)
    const zeroLikeCount = forecast.filter((value) => value <= Math.max(recentAverage * 0.05, 1)).length
    const allZeroLike = zeroLikeCount === forecast.length
    const hasExtremeSpike = maxHistory > 0 && forecast.some((value) => value > maxHistory * 1.75)
    const collapsesAfterFirstSpike =
        forecast.length >= 3
        && forecast[0] > Math.max(recentAverage * 1.2, 1)
        && forecast.slice(1).every((value) => value <= Math.max(recentAverage * 0.05, 1))

    if (allZeroLike && recentAverage > 0) return false
    if (hasExtremeSpike) return false
    if (collapsesAfterFirstSpike) return false

    return true
}

function linearRegressionForecast(series: number[], futurePeriods: number) {
    if (series.length === 0) return Array.from({ length: futurePeriods }, () => 0)
    if (series.length === 1) return Array.from({ length: futurePeriods }, () => series[0])

    const n = series.length
    const sumX = ((n - 1) * n) / 2
    const sumY = series.reduce((sum, value) => sum + value, 0)
    const sumXY = series.reduce((sum, value, index) => sum + (index * value), 0)
    const sumXX = series.reduce((sum, _value, index) => sum + (index * index), 0)
    const denominator = (n * sumXX) - (sumX * sumX)

    if (denominator === 0) {
        return Array.from({ length: futurePeriods }, () => average(series))
    }

    const slope = ((n * sumXY) - (sumX * sumY)) / denominator
    const intercept = (sumY - (slope * sumX)) / n

    return Array.from({ length: futurePeriods }, (_value, index) => {
        const forecast = intercept + (slope * (n + index))
        return Math.max(Number(forecast.toFixed(1)), 0)
    })
}

function buildAutoArimaForecastValues(series: number[], futurePeriods: number) {
    if (series.length < 6) {
        return null
    }

    const uniquePoints = new Set(series.map((value) => Number(value.toFixed(4)))).size
    if (uniquePoints < 2) {
        return null
    }

    try {
        const maxP = series.length >= 18 ? 3 : 2
        const maxQ = series.length >= 18 ? 3 : 2
        const selected = AutoARIMA.findBestARIMA(series, maxP, 2, maxQ, "aic")
        const params = selected?.bestParams

        if (
            !params
            || typeof params.p !== "number"
            || typeof params.d !== "number"
            || typeof params.q !== "number"
        ) {
            return null
        }

        const model = new ARIMA({
            p: params.p,
            d: params.d,
            q: params.q,
        })

        model.fit(series)
        const forecast = model.forecast(futurePeriods, 0.95)
        const normalized = sanitizeSeries(forecast.forecast)

        if (normalized.some((value) => !Number.isFinite(value) || Number.isNaN(value))) {
            return null
        }

        return normalized
    } catch (error) {
        console.error("Auto ARIMA forecast failed, fallback to moving average:", error)
        return null
    }
}

function buildForecastValues(
    series: number[],
    granularity: ForecastGranularity,
    algorithm: ForecastingAlgorithm
): ForecastComputationResult {
    const futurePeriods = getFuturePeriods(granularity)
    const fallback = average(series.slice(-Math.max(getWindowSize(granularity), 1)))
    if (series.length === 0) {
        return {
            values: Array.from({ length: futurePeriods }, () => 0),
            effectiveAlgorithm: algorithm,
            fallbackReason: null,
        }
    }

    if (algorithm === "auto_arima") {
        const autoArimaForecast = buildAutoArimaForecastValues(series, futurePeriods)
        if (autoArimaForecast && isForecastShapeReasonable(series, autoArimaForecast)) {
            return {
                values: sanitizeSeries(autoArimaForecast),
                effectiveAlgorithm: "auto_arima",
                fallbackReason: null,
            }
        }

        const rolling = [...series]
        const fallbackValues = sanitizeSeries(Array.from({ length: futurePeriods }, () => {
            const window = rolling.slice(-getWindowSize(granularity))
            const forecast = Number(average(window).toFixed(1))
            rolling.push(forecast)
            return forecast
        }))

        return {
            values: fallbackValues,
            effectiveAlgorithm: "fallback_moving_average",
            fallbackReason: "Auto ARIMA menghasilkan pola forecast yang tidak stabil untuk histori saat ini.",
        }
    }

    if (algorithm === "trend") {
        return {
            values: sanitizeSeries(linearRegressionForecast(series, futurePeriods)),
            effectiveAlgorithm: "trend",
            fallbackReason: null,
        }
    }

    if (algorithm === "seasonal") {
        const seasonLength = Math.min(getSeasonLength(granularity), series.length)
        return {
            values: sanitizeSeries(Array.from({ length: futurePeriods }, (_value, index) => {
                const seasonalValue = series[series.length - seasonLength + (index % seasonLength)]
                return Number((seasonalValue ?? fallback).toFixed(1))
            })),
            effectiveAlgorithm: "seasonal",
            fallbackReason: null,
        }
    }

    const rolling = [...series]
    return {
        values: sanitizeSeries(Array.from({ length: futurePeriods }, () => {
            const window = rolling.slice(-getWindowSize(granularity))
            const forecast = Number(average(window).toFixed(1))
            rolling.push(forecast)
            return forecast
        })),
        effectiveAlgorithm: "moving_average",
        fallbackReason: null,
    }
}

export async function getProcurementNextAnalytics(
    filters: ProcurementNextFilters = {}
): Promise<ProcurementNextResponse> {
    try {
        const horizonMonths = Math.min(Math.max(Number(filters.horizonMonths ?? 6), 3), 18)
        const chartGranularity: ForecastGranularity = filters.chartGranularity ?? "monthly"
        const forecastingAlgorithm: ForecastingAlgorithm = filters.forecastingAlgorithm ?? "auto_arima"

        const stockRows = await db
            .select({
                stockLevelId: stockLevels.id,
                currentStock: stockLevels.totalStock,
                minStock: stockLevels.minStock,
                valuationValue: stockLevels.valuationValue,
                materialNumber: products.materialNumber,
                oldMaterialNo: products.oldMaterialNo,
                description: products.materialDescription,
                category: products.category,
            })
            .from(stockLevels)
            .innerJoin(products, eq(products.id, stockLevels.productId))
            .orderBy(desc(stockLevels.totalStock))

        const aliases = Array.from(
            new Set(
                stockRows.flatMap((row) =>
                    [row.materialNumber, row.oldMaterialNo]
                        .map((value) => value?.trim())
                        .filter((value): value is string => Boolean(value))
                )
            )
        )

        const monthsStart = startOfMonth(addMonths(new Date(), -(horizonMonths - 1)))

        const salesWhere = aliases.length > 0
            ? and(
                gte(salesRevenueSap.billingDate, monthsStart.toISOString().slice(0, 10)),
                inArray(salesRevenueSap.materialNo, aliases)
            )
            : undefined

        const salesRows = salesWhere
            ? await db
                .select({
                    materialNo: salesRevenueSap.materialNo,
                    billingDate: salesRevenueSap.billingDate,
                    qty: sql<number>`COALESCE(${salesRevenueSap.qty}, 0)`,
                    revenue: sql<number>`COALESCE(${salesRevenueSap.revenueInDocCurr}, 0)`,
                })
                .from(salesRevenueSap)
                .where(salesWhere)
            : []

        const today = new Date()
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 30)
        const last60 = new Date(today)
        last60.setDate(last60.getDate() - 60)
        const last90 = new Date(today)
        last90.setDate(last90.getDate() - 90)

        const salesByMaterial = new Map<
            string,
            {
                sold30d: number
                sold60d: number
                sold90d: number
                totalQty: number
                totalRevenue: number
                lastSaleDate: string | null
            }
        >()

        const historicalPeriodStart = startOfGranularity(monthsStart, chartGranularity)
        const currentPeriodStart = startOfGranularity(today, chartGranularity)
        const historicalPeriodMap = new Map<string, { periodStart: Date; qty: number; revenue: number }>()

        for (
            let cursor = new Date(historicalPeriodStart);
            cursor <= currentPeriodStart;
            cursor = addPeriods(cursor, chartGranularity, 1)
        ) {
            historicalPeriodMap.set(periodKey(cursor, chartGranularity), {
                periodStart: new Date(cursor),
                qty: 0,
                revenue: 0,
            })
        }

        for (const row of salesRows) {
            const materialNo = row.materialNo?.trim()
            const billingDate = row.billingDate ? new Date(row.billingDate) : null
            if (!materialNo || !billingDate || Number.isNaN(billingDate.getTime())) continue

            const existing = salesByMaterial.get(materialNo) ?? {
                sold30d: 0,
                sold60d: 0,
                sold90d: 0,
                totalQty: 0,
                totalRevenue: 0,
                lastSaleDate: null,
            }

            const qty = normalizeNumber(row.qty)
            const revenue = normalizeNumber(row.revenue)
            existing.totalQty += qty
            existing.totalRevenue += revenue
            if (billingDate >= last30) existing.sold30d += qty
            if (billingDate >= last60) existing.sold60d += qty
            if (billingDate >= last90) existing.sold90d += qty

            if (!existing.lastSaleDate || billingDate > new Date(existing.lastSaleDate)) {
                existing.lastSaleDate = billingDate.toISOString()
            }

            salesByMaterial.set(materialNo, existing)

            const grouped = historicalPeriodMap.get(periodKey(billingDate, chartGranularity))
            if (grouped) {
                grouped.qty += qty
                grouped.revenue += revenue
            }
        }

        const groupedStockRows = Array.from(
            stockRows.reduce((map, row) => {
                const key = row.materialNumber || row.oldMaterialNo || `stock-${row.stockLevelId}`
                const existing = map.get(key) ?? {
                    stockLevelId: row.stockLevelId,
                    materialNumber: row.materialNumber || "-",
                    oldMaterialNo: row.oldMaterialNo,
                    description: row.description || "-",
                    category: row.category || "Uncategorized",
                    currentStock: 0,
                    minStock: 0,
                    stockValue: 0,
                }

                existing.currentStock += normalizeNumber(row.currentStock)
                existing.minStock += normalizeNumber(row.minStock)
                existing.stockValue += normalizeNumber(row.valuationValue)
                map.set(key, existing)
                return map
            }, new Map<string, {
                stockLevelId: number
                materialNumber: string
                oldMaterialNo: string | null
                description: string
                category: string
                currentStock: number
                minStock: number
                stockValue: number
            }>())
        ).map(([, row]) => row)

        const items: ProcurementNextItem[] = groupedStockRows.map((row) => {
            const aliasesToCheck = [row.materialNumber, row.oldMaterialNo]
                .map((value) => value?.trim())
                .filter((value): value is string => Boolean(value))

            const mergedSales = aliasesToCheck.reduce(
                (acc, alias) => {
                    const stats = salesByMaterial.get(alias)
                    if (!stats) return acc
                    acc.sold30d += stats.sold30d
                    acc.sold60d += stats.sold60d
                    acc.sold90d += stats.sold90d
                    acc.totalQty += stats.totalQty
                    acc.totalRevenue += stats.totalRevenue
                    if (!acc.lastSaleDate || (stats.lastSaleDate && new Date(stats.lastSaleDate) > new Date(acc.lastSaleDate))) {
                        acc.lastSaleDate = stats.lastSaleDate
                    }
                    return acc
                },
                { sold30d: 0, sold60d: 0, sold90d: 0, totalQty: 0, totalRevenue: 0, lastSaleDate: null as string | null }
            )

            const currentStock = normalizeNumber(row.currentStock)
            const minStock = normalizeNumber(row.minStock)
            const stockValue = normalizeNumber(row.stockValue)
            const dailyAvg30d = mergedSales.sold30d > 0 ? mergedSales.sold30d / 30 : 0
            const dailyAvg60d = mergedSales.sold60d > 0 ? mergedSales.sold60d / 60 : 0
            const dailyAvg90d = mergedSales.sold90d > 0 ? mergedSales.sold90d / 90 : 0
            const monthlyAvg = mergedSales.totalQty / horizonMonths
            const daysCover30d = dailyAvg30d > 0 && currentStock > 0 ? Number((currentStock / dailyAvg30d).toFixed(1)) : null
            const daysCover60d = dailyAvg60d > 0 && currentStock > 0 ? Number((currentStock / dailyAvg60d).toFixed(1)) : null
            const daysCover90d = dailyAvg90d > 0 && currentStock > 0 ? Number((currentStock / dailyAvg90d).toFixed(1)) : null
            const targetStock = Math.max(minStock, Math.ceil(dailyAvg60d * 60))
            const recommendedQty = Math.max(targetStock - currentStock, 0)
            const unitValue = currentStock > 0 ? stockValue / currentStock : 0
            const recommendedValue = recommendedQty * unitValue

            let priority: ProcurementNextItem["priority"] = "healthy"
            if (currentStock <= 0 && mergedSales.sold90d > 0) {
                priority = "urgent"
            } else if (daysCover60d !== null && daysCover60d <= 14) {
                priority = "urgent"
            } else if (currentStock <= minStock || (daysCover60d !== null && daysCover60d <= 30)) {
                priority = "soon"
            } else if (mergedSales.sold90d > 0 && daysCover60d !== null && daysCover60d <= 60) {
                priority = "watch"
            }

            return {
                stockLevelId: row.stockLevelId,
                materialNumber: row.materialNumber || "-",
                description: row.description || "-",
                category: row.category || "Uncategorized",
                currentStock,
                minStock,
                stockValue,
                sold30d: mergedSales.sold30d,
                sold60d: mergedSales.sold60d,
                sold90d: mergedSales.sold90d,
                monthlyAvg: Number(monthlyAvg.toFixed(1)),
                dailyAvg30d: Number(dailyAvg30d.toFixed(2)),
                dailyAvg60d: Number(dailyAvg60d.toFixed(2)),
                dailyAvg90d: Number(dailyAvg90d.toFixed(2)),
                daysCover30d,
                daysCover60d,
                daysCover90d,
                lastSaleDate: mergedSales.lastSaleDate ? mergedSales.lastSaleDate.slice(0, 10) : null,
                recommendedQty,
                recommendedValue,
                priority,
            }
        })

        items.sort((left, right) => {
            const priorityRank = { urgent: 0, soon: 1, watch: 2, healthy: 3 }
            const rankDiff = priorityRank[left.priority] - priorityRank[right.priority]
            if (rankDiff !== 0) return rankDiff
            if (right.recommendedQty !== left.recommendedQty) return right.recommendedQty - left.recommendedQty
            return right.sold90d - left.sold90d
        })

        const totalCurrentStock = items.reduce((sum, item) => sum + item.currentStock, 0)
        const historicalSeries = Array.from(historicalPeriodMap.values())
            .sort((left, right) => left.periodStart.getTime() - right.periodStart.getTime())
        const historicalSalesValues = historicalSeries.map((point) => Number(point.qty.toFixed(1)))
        const forecastComputation = buildForecastValues(historicalSalesValues, chartGranularity, forecastingAlgorithm)
        const forecastValues = forecastComputation.values

        let runningProjectedStock = totalCurrentStock
        const futurePoints = forecastValues.map((forecastQty, index) => {
            const pointDate = addPeriods(currentPeriodStart, chartGranularity, index + 1)
            const predictedLostSales = Math.max(forecastQty - runningProjectedStock, 0)
            runningProjectedStock = Math.max(runningProjectedStock - forecastQty, 0)

            return {
                label: formatPeriodLabel(pointDate, chartGranularity),
                periodKey: periodKey(pointDate, chartGranularity),
                actualSales: null,
                forecastSales: Number(forecastQty.toFixed(1)),
                projectedStock: Number(runningProjectedStock.toFixed(1)),
                predictedLostSales: Number(predictedLostSales.toFixed(1)),
                isForecast: true,
            }
        })

        const forecastTrend: ForecastChartPoint[] = [
            ...historicalSeries.map((point) => ({
                label: formatPeriodLabel(point.periodStart, chartGranularity),
                periodKey: periodKey(point.periodStart, chartGranularity),
                actualSales: Number(point.qty.toFixed(1)),
                forecastSales: null,
                projectedStock: null,
                predictedLostSales: null,
                isForecast: false,
            })),
            ...futurePoints,
        ]

        const summary = {
            totalItems: items.length,
            urgentItems: items.filter((item) => item.priority === "urgent").length,
            soonItems: items.filter((item) => item.priority === "soon").length,
            watchItems: items.filter((item) => item.priority === "watch").length,
            healthyItems: items.filter((item) => item.priority === "healthy").length,
            totalStockValue: items.reduce((sum, item) => sum + item.stockValue, 0),
            totalRecommendedQty: items.reduce((sum, item) => sum + item.recommendedQty, 0),
            totalRecommendedValue: items.reduce((sum, item) => sum + item.recommendedValue, 0),
            averageDaysCover30d: (() => {
                const valid = items.filter((item) => item.daysCover30d !== null).map((item) => item.daysCover30d as number)
                if (valid.length === 0) return null
                return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1))
            })(),
            averageDaysCover60d: (() => {
                const valid = items.filter((item) => item.daysCover60d !== null).map((item) => item.daysCover60d as number)
                if (valid.length === 0) return null
                return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1))
            })(),
            averageDaysCover90d: (() => {
                const valid = items.filter((item) => item.daysCover90d !== null).map((item) => item.daysCover90d as number)
                if (valid.length === 0) return null
                return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1))
            })(),
            totalForecastQty: Number(forecastValues.reduce((sum, value) => sum + value, 0).toFixed(1)),
            totalPredictedLostSales: Number(futurePoints.reduce((sum, point) => sum + (point.predictedLostSales ?? 0), 0).toFixed(1)),
            effectiveForecastAlgorithm: forecastComputation.effectiveAlgorithm,
            forecastFallbackReason: forecastComputation.fallbackReason,
        }

        const urgencyBreakdown = (Object.keys(PRIORITY_META) as Array<keyof typeof PRIORITY_META>)
            .map((key) => ({
                name: PRIORITY_META[key].label,
                value: items.filter((item) => item.priority === key).length,
                fill: PRIORITY_META[key].fill,
            }))
            .filter((item) => item.value > 0)

        const topRecommendationMap = new Map<string, { name: string; qty: number; value: number }>()
        for (const item of items.filter((entry) => entry.recommendedQty > 0)) {
            const name = item.description !== "-" ? item.description : item.materialNumber
            const existing = topRecommendationMap.get(name) ?? { name, qty: 0, value: 0 }
            existing.qty += item.recommendedQty
            existing.value += item.recommendedValue
            topRecommendationMap.set(name, existing)
        }

        const topRecommendations = Array.from(topRecommendationMap.values())
            .sort((left, right) => right.qty - left.qty || right.value - left.value)
            .slice(0, 8)
            .map((item) => ({
                name: item.name,
                qty: item.qty,
                value: Number(item.value.toFixed(0)),
                warehouseCount: 0,
                label: `${item.name} | ${item.qty} qty`,
            }))

        const categoryRiskMap = new Map<string, { urgent: number; soon: number; healthy: number; watch: number }>()
        for (const item of items) {
            const existing = categoryRiskMap.get(item.category) ?? { urgent: 0, soon: 0, healthy: 0, watch: 0 }
            existing[item.priority] += 1
            categoryRiskMap.set(item.category, existing)
        }

        const categoryRisk = Array.from(categoryRiskMap.entries())
            .map(([category, values]) => ({ category, ...values }))
            .sort((left, right) => (right.urgent + right.soon) - (left.urgent + left.soon))
            .slice(0, 8)

        return {
            success: true,
            data: {
                filters: {
                    horizonMonths,
                    chartGranularity,
                    forecastingAlgorithm,
                },
                summary,
                charts: {
                    urgencyBreakdown,
                    forecastTrend,
                    topRecommendations,
                    categoryRisk,
                },
                items,
            },
        }
    } catch (error) {
        console.error("Failed to build procurement next analytics:", error)
        return {
            success: false,
            error: "Failed to load procurement analytics",
        }
    }
}
