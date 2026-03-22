export type RevenueTrendDirection = "up" | "down" | "stable"
export type RevenueConfidenceTier = "high" | "medium" | "low"
export type RevenueDriverDirection = "positive" | "negative" | "neutral"
export type RevenueStockAlertLevel = "healthy" | "watch" | "restock" | "unknown"

export interface RevenueMLInputPoint {
    month: string
    revenue: number
    qty: number
}

export interface RevenueMLStockSnapshot {
    currentStockUnits: number
    stockValue: number
    trackedMaterials: number
    stockedMaterials: number
}

export interface RevenueMLForecastPoint {
    month: string
    revenue: number | null
    forecast: number | null
    upper: number | null
    lower: number | null
    type: "history" | "forecast"
    isAnomaly: boolean
    anomalyValue: number | null
}

export interface RevenueMLDriver {
    id: string
    label: string
    direction: RevenueDriverDirection
    impactScore: number
    valueLabel: string
    insight: string
}

export interface RevenueMLAnomaly {
    month: string
    label: string
    actualRevenue: number
    expectedRevenue: number
    impactPct: number
    severity: "medium" | "high"
    shortReason: string
    reason: string
}

export interface RevenueMLConfidence {
    tier: RevenueConfidenceTier
    label: string
    note: string
}

export interface RevenueMLStockInsight {
    alertLevel: RevenueStockAlertLevel
    title: string
    message: string
    actionLabel: string
    currentStockUnits: number
    stockValue: number
    coverageMonths: number | null
    coverageLabel: string
    recommendedRestockUnits: number
    trackedMaterials: number
    stockedMaterials: number
    stockDataCoveragePct: number
}

export interface RevenueMLSimulation {
    baselineCoverageMonths: number | null
    targetCoverageMonths: number
    elasticity: number
    recommendedStockChangePct: number
    baselineMultiplier: number
}

export interface RevenueMLInsightSummary {
    trend: RevenueTrendDirection
    trendPctAvg: number
    recentTrendPct: number
    volatilityCv: number
    seasonalityStrength: number
    anomalyCount: number
    narrative: string
    executiveSummary: string
}

export interface RevenueMLDiagnostics {
    historyMonths: number
    forecastMonths: number
    validationMonths: number
    businessDayAdjustment: boolean
    hybridWeights: {
        trendSeasonal: number
        adaptiveRecency: number
        seasonalNaive: number
    }
}

export interface RevenueMLComputation {
    data: RevenueMLForecastPoint[]
    accuracy: string
    isReliable: boolean
    confidence: RevenueMLConfidence
    insightSummary: RevenueMLInsightSummary
    drivers: RevenueMLDriver[]
    anomalies: RevenueMLAnomaly[]
    stockInsight: RevenueMLStockInsight
    simulation: RevenueMLSimulation
    diagnostics: RevenueMLDiagnostics
}

type ModelKey = "trendSeasonal" | "adaptiveRecency" | "seasonalNaive"

interface HistoricalFeaturePoint extends RevenueMLInputPoint {
    t: number
    monthIndex: number
    businessDays: number
    revenuePerBusinessDay: number
    baselineRevenue: number
    adjustedRevenue: number
    adjustedRevenuePerBusinessDay: number
    isAnomaly: boolean
    anomalyImpactPct: number
    qtyChangePct: number
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const TARGET_STOCK_COVERAGE_MONTHS = 3

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const average = (values: number[]) => {
    if (values.length === 0) return 0
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

const standardDeviation = (values: number[]) => {
    if (values.length === 0) return 0
    const mean = average(values)
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length
    return Math.sqrt(variance)
}

const median = (values: number[]) => {
    if (values.length === 0) return 0
    const sorted = [...values].sort((left, right) => left - right)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle]
}

const parseMonthKey = (month: string) => {
    const [yearText, monthText] = month.split("-")
    return new Date(Number(yearText), Number(monthText) - 1, 1)
}

const toMonthKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

const addMonths = (date: Date, months: number) => new Date(date.getFullYear(), date.getMonth() + months, 1)

const formatMonthLabel = (month: string) => {
    const date = parseMonthKey(month)
    return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`
}

const getBusinessDays = (date: Date) => {
    const cursor = new Date(date.getFullYear(), date.getMonth(), 1)
    let total = 0
    while (cursor.getMonth() === date.getMonth()) {
        const day = cursor.getDay()
        if (day !== 0 && day !== 6) {
            total += 1
        }
        cursor.setDate(cursor.getDate() + 1)
    }
    return total
}

const formatCompactNumber = (value: number) => {
    if (!Number.isFinite(value)) return "0"
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toFixed(0)
}

const weightedRecentAverage = (values: number[]) => {
    if (values.length === 0) return 0
    const weights = [0.55, 0.3, 0.15]
    const reversed = [...values].slice(-3).reverse()
    let weightSum = 0
    let total = 0
    reversed.forEach((value, index) => {
        const weight = weights[index] || weights[weights.length - 1]
        total += value * weight
        weightSum += weight
    })
    return weightSum > 0 ? total / weightSum : 0
}

const calculateGrowthSeries = (values: number[]) => {
    const growth: number[] = []
    for (let index = 1; index < values.length; index += 1) {
        const previous = values[index - 1]
        if (previous > 0) {
            growth.push(((values[index] - previous) / previous) * 100)
        }
    }
    return growth
}

const describeTrend = (trend: RevenueTrendDirection) => {
    if (trend === "up") return "meningkat"
    if (trend === "down") return "menurun"
    return "stabil"
}

const describeConfidence = (tier: RevenueConfidenceTier) => {
    if (tier === "high") return "High Confidence"
    if (tier === "medium") return "Medium Confidence"
    return "Low Confidence"
}

const buildHistoricalFeatures = (series: RevenueMLInputPoint[]): HistoricalFeaturePoint[] => {
    const prepared = series.map((point, index) => {
        const date = parseMonthKey(point.month)
        const businessDays = getBusinessDays(date)
        return {
            ...point,
            t: index + 1,
            monthIndex: date.getMonth(),
            businessDays,
            revenuePerBusinessDay: businessDays > 0 ? point.revenue / businessDays : point.revenue,
        }
    })

    const globalPerDayAverage = average(prepared.map((point) => point.revenuePerBusinessDay))
    const allPerDayValues = prepared.map((point) => point.revenuePerBusinessDay)
    const perDayMedian = median(allPerDayValues)
    const perDayMad = median(allPerDayValues.map((value) => Math.abs(value - perDayMedian)))
    const perDayStdDev = standardDeviation(allPerDayValues)
    const robustScale = perDayMad > 0 ? perDayMad * 1.4826 : perDayStdDev

    return prepared.map((point, index) => {
        const sameMonthValues = prepared
            .filter((candidate, candidateIndex) => candidate.monthIndex === point.monthIndex && candidateIndex !== index)
            .map((candidate) => candidate.revenuePerBusinessDay)
        const sameMonthAverage = sameMonthValues.length > 0 ? average(sameMonthValues) : globalPerDayAverage
        const recentWindow = prepared
            .slice(Math.max(0, index - 3), index)
            .map((candidate) => candidate.revenuePerBusinessDay)
        const recentAverage = recentWindow.length > 0 ? average(recentWindow) : globalPerDayAverage
        const baselinePerDay = (sameMonthAverage * 0.55) + (recentAverage * 0.45)
        const residual = point.revenuePerBusinessDay - baselinePerDay
        const deviationPct = baselinePerDay > 0 ? (residual / baselinePerDay) * 100 : 0
        const robustZ = robustScale > 0 ? residual / robustScale : 0
        const quantityPrevious = index > 0 ? prepared[index - 1].qty : point.qty
        const qtyChangePct = quantityPrevious > 0 ? ((point.qty - quantityPrevious) / quantityPrevious) * 100 : 0
        const isAnomaly = Math.abs(deviationPct) >= 32 && (Math.abs(robustZ) >= 1.9 || Math.abs(residual) >= perDayStdDev * 0.8)
        const dampedPerDay = isAnomaly
            ? baselinePerDay + (residual * 0.35)
            : point.revenuePerBusinessDay

        return {
            ...point,
            baselineRevenue: baselinePerDay * point.businessDays,
            adjustedRevenue: Math.max(0, dampedPerDay * point.businessDays),
            adjustedRevenuePerBusinessDay: Math.max(0, dampedPerDay),
            isAnomaly,
            anomalyImpactPct: deviationPct,
            qtyChangePct,
        }
    })
}

const predictTrendSeasonal = (points: HistoricalFeaturePoint[], targetDate: Date) => {
    const n = points.length
    const values = points.map((point) => point.adjustedRevenuePerBusinessDay)
    const sumT = points.reduce((sum, point) => sum + point.t, 0)
    const sumY = values.reduce((sum, value) => sum + value, 0)
    const sumTT = points.reduce((sum, point) => sum + (point.t * point.t), 0)
    const sumTY = points.reduce((sum, point) => sum + (point.t * point.adjustedRevenuePerBusinessDay), 0)
    const denominator = (n * sumTT) - (sumT * sumT)
    const slope = denominator !== 0 ? ((n * sumTY) - (sumT * sumY)) / denominator : 0
    const intercept = n > 0 ? (sumY - (slope * sumT)) / n : 0

    const monthSums = new Array(12).fill(0)
    const monthCounts = new Array(12).fill(0)
    points.forEach((point) => {
        monthSums[point.monthIndex] += point.adjustedRevenuePerBusinessDay
        monthCounts[point.monthIndex] += 1
    })
    const overallAverage = n > 0 ? sumY / n : 0
    const seasonalIndices = monthSums.map((sum, index) => {
        if (monthCounts[index] === 0 || overallAverage <= 0) return 1
        return sum / monthCounts[index] / overallAverage
    })

    const nextT = n + 1
    const targetMonth = targetDate.getMonth()
    const businessDays = getBusinessDays(targetDate)
    const predictedPerDay = Math.max(0, intercept + (slope * nextT))
    return Math.max(0, predictedPerDay * (seasonalIndices[targetMonth] || 1) * businessDays)
}

const predictAdaptiveRecency = (points: HistoricalFeaturePoint[], targetDate: Date) => {
    const recentValues = points.slice(-3).map((point) => point.adjustedRevenue)
    const recentWeighted = weightedRecentAverage(recentValues)
    const sameMonthValues = points
        .filter((point) => point.monthIndex === targetDate.getMonth())
        .map((point) => point.adjustedRevenue)
    const sameMonthAverage = sameMonthValues.length > 0
        ? average(sameMonthValues)
        : average(points.map((point) => point.adjustedRevenue))
    const lastValue = points[points.length - 1]?.adjustedRevenue || sameMonthAverage
    const recentGrowth = average(calculateGrowthSeries(points.slice(-4).map((point) => point.adjustedRevenue)).slice(-3))
    const growthFactor = clamp(1 + ((recentGrowth || 0) / 100) * 0.35, 0.82, 1.18)
    const averageBusinessDays = average(points.slice(-12).map((point) => point.businessDays))
    const businessDayRatio = averageBusinessDays > 0 ? getBusinessDays(targetDate) / averageBusinessDays : 1

    return Math.max(
        0,
        ((recentWeighted * 0.5) + (sameMonthAverage * 0.35) + (lastValue * 0.15)) * growthFactor * businessDayRatio
    )
}

const predictSeasonalNaive = (points: HistoricalFeaturePoint[], targetDate: Date) => {
    const sameMonthValues = points
        .filter((point) => point.monthIndex === targetDate.getMonth())
        .map((point) => point.adjustedRevenue)
    const baseline = sameMonthValues.length > 0
        ? sameMonthValues[sameMonthValues.length - 1]
        : average(points.map((point) => point.adjustedRevenue))

    const recentTwelve = average(points.slice(-12).map((point) => point.adjustedRevenue))
    const priorTwelve = average(points.slice(-24, -12).map((point) => point.adjustedRevenue))
    const trendFactor = priorTwelve > 0
        ? clamp(recentTwelve / priorTwelve, 0.8, 1.2)
        : 1

    const averageBusinessDays = average(points
        .filter((point) => point.monthIndex === targetDate.getMonth())
        .map((point) => point.businessDays))
    const businessDayRatio = averageBusinessDays > 0 ? getBusinessDays(targetDate) / averageBusinessDays : 1

    return Math.max(0, baseline * trendFactor * businessDayRatio)
}

const modelPredictors: Record<ModelKey, (points: HistoricalFeaturePoint[], targetDate: Date) => number> = {
    trendSeasonal: predictTrendSeasonal,
    adaptiveRecency: predictAdaptiveRecency,
    seasonalNaive: predictSeasonalNaive,
}

const defaultWeights: Record<ModelKey, number> = {
    trendSeasonal: 0.45,
    adaptiveRecency: 0.35,
    seasonalNaive: 0.2,
}

const evaluateHybridWeights = (points: HistoricalFeaturePoint[]) => {
    const minimumTrainMonths = Math.min(12, Math.max(6, Math.floor(points.length / 2)))
    const holdoutMonths = Math.min(12, Math.max(6, Math.floor(points.length / 4)))
    const validationStart = Math.max(minimumTrainMonths, points.length - holdoutMonths)
    const modelErrors: Record<ModelKey, number> = {
        trendSeasonal: 0,
        adaptiveRecency: 0,
        seasonalNaive: 0,
    }
    const predictionLog: Array<{ actual: number } & Record<ModelKey, number>> = []

    for (let targetIndex = validationStart; targetIndex < points.length; targetIndex += 1) {
        const train = points.slice(0, targetIndex)
        if (train.length < minimumTrainMonths) continue

        const targetDate = parseMonthKey(points[targetIndex].month)
        const actual = points[targetIndex].revenue
        const trendSeasonal = predictTrendSeasonal(train, targetDate)
        const adaptiveRecency = predictAdaptiveRecency(train, targetDate)
        const seasonalNaive = predictSeasonalNaive(train, targetDate)

        modelErrors.trendSeasonal += Math.abs(actual - trendSeasonal)
        modelErrors.adaptiveRecency += Math.abs(actual - adaptiveRecency)
        modelErrors.seasonalNaive += Math.abs(actual - seasonalNaive)

        predictionLog.push({
            actual,
            trendSeasonal,
            adaptiveRecency,
            seasonalNaive,
        })
    }

    const sumActual = predictionLog.reduce((sum, entry) => sum + entry.actual, 0)
    if (predictionLog.length === 0 || sumActual <= 0) {
        return {
            weights: defaultWeights,
            accuracy: 0,
            residualStdDev: standardDeviation(points.map((point) => point.revenue - point.adjustedRevenue)),
            validationMonths: 0,
        }
    }

    const rawWeights = {
        trendSeasonal: 1 / Math.max(modelErrors.trendSeasonal / sumActual, 0.01),
        adaptiveRecency: 1 / Math.max(modelErrors.adaptiveRecency / sumActual, 0.01),
        seasonalNaive: 1 / Math.max(modelErrors.seasonalNaive / sumActual, 0.01),
    }

    const weightTotal = rawWeights.trendSeasonal + rawWeights.adaptiveRecency + rawWeights.seasonalNaive
    const weights = {
        trendSeasonal: rawWeights.trendSeasonal / weightTotal,
        adaptiveRecency: rawWeights.adaptiveRecency / weightTotal,
        seasonalNaive: rawWeights.seasonalNaive / weightTotal,
    }

    const residuals = predictionLog.map((entry) => {
        const combined =
            (entry.trendSeasonal * weights.trendSeasonal) +
            (entry.adaptiveRecency * weights.adaptiveRecency) +
            (entry.seasonalNaive * weights.seasonalNaive)
        return entry.actual - combined
    })
    const combinedError = predictionLog.reduce((sum, entry) => {
        const combined =
            (entry.trendSeasonal * weights.trendSeasonal) +
            (entry.adaptiveRecency * weights.adaptiveRecency) +
            (entry.seasonalNaive * weights.seasonalNaive)
        return sum + Math.abs(entry.actual - combined)
    }, 0)

    return {
        weights,
        accuracy: clamp(100 - ((combinedError / sumActual) * 100), 0, 100),
        residualStdDev: standardDeviation(residuals),
        validationMonths: predictionLog.length,
    }
}

const estimateNextQty = (points: HistoricalFeaturePoint[], targetMonthIndex: number) => {
    const recentAverageQty = average(points.slice(-6).map((point) => point.qty))
    const sameMonthQty = average(points.filter((point) => point.monthIndex === targetMonthIndex).map((point) => point.qty))
    return Math.max(0, (recentAverageQty * 0.6) + (sameMonthQty * 0.4))
}

const calculateStockMultiplier = (
    baselineCoverageMonths: number | null,
    targetCoverageMonths: number,
    adjustmentPct: number,
    elasticity: number
) => {
    if (baselineCoverageMonths === null) return 1
    const adjustedCoverage = Math.max(0, baselineCoverageMonths * (1 + (adjustmentPct / 100)))
    const gapRatio = (adjustedCoverage - targetCoverageMonths) / targetCoverageMonths
    return clamp(1 + (gapRatio * elasticity), 0.82, 1.12)
}

export const simulateRevenueScenario = (
    baseForecast: number,
    simulation: RevenueMLSimulation,
    stockAdjustmentPct: number
) => {
    if (!Number.isFinite(baseForecast) || baseForecast <= 0) return 0
    if (simulation.baselineCoverageMonths === null) return baseForecast

    const scenarioMultiplier = calculateStockMultiplier(
        simulation.baselineCoverageMonths,
        simulation.targetCoverageMonths,
        stockAdjustmentPct,
        simulation.elasticity
    )

    if (simulation.baselineMultiplier <= 0) {
        return baseForecast
    }

    return Math.max(0, baseForecast * (scenarioMultiplier / simulation.baselineMultiplier))
}

const buildStockInsight = (
    stock: RevenueMLStockSnapshot,
    points: HistoricalFeaturePoint[],
    nextQuarterForecast: number
) => {
    const recentAverageQty = average(points.slice(-6).map((point) => point.qty).filter((value) => value > 0))
    const coverageMonths = recentAverageQty > 0 ? stock.currentStockUnits / recentAverageQty : null
    const stockDataCoveragePct = stock.trackedMaterials > 0
        ? (stock.stockedMaterials / stock.trackedMaterials) * 100
        : 0
    const recommendedRestockUnits = coverageMonths === null
        ? 0
        : Math.max(0, Math.ceil((TARGET_STOCK_COVERAGE_MONTHS * recentAverageQty) - stock.currentStockUnits))

    if (coverageMonths === null || stock.stockedMaterials === 0) {
        return {
            insight: {
                alertLevel: "unknown" as const,
                title: "Stock mapping belum lengkap",
                message: "Forecast tetap dihitung, tetapi alert restock belum bisa dipastikan karena material yang terhubung ke stok masih terbatas.",
                actionLabel: "Lengkapi mapping material stok",
                currentStockUnits: stock.currentStockUnits,
                stockValue: stock.stockValue,
                coverageMonths: null,
                coverageLabel: "Belum tersedia",
                recommendedRestockUnits: 0,
                trackedMaterials: stock.trackedMaterials,
                stockedMaterials: stock.stockedMaterials,
                stockDataCoveragePct: Number(stockDataCoveragePct.toFixed(1)),
            },
            simulation: {
                baselineCoverageMonths: null,
                targetCoverageMonths: TARGET_STOCK_COVERAGE_MONTHS,
                elasticity: 0.12,
                recommendedStockChangePct: 0,
                baselineMultiplier: 1,
            },
        }
    }

    const elasticity = coverageMonths < 1.5 ? 0.16 : coverageMonths < TARGET_STOCK_COVERAGE_MONTHS ? 0.12 : 0.08
    const recommendedStockChangePct = coverageMonths > 0
        ? clamp(Math.round(((TARGET_STOCK_COVERAGE_MONTHS - coverageMonths) / coverageMonths) * 100), 0, 100)
        : 100
    const baselineMultiplier = calculateStockMultiplier(
        coverageMonths,
        TARGET_STOCK_COVERAGE_MONTHS,
        0,
        elasticity
    )

    if (coverageMonths < 1.5) {
        return {
            insight: {
                alertLevel: "restock" as const,
                title: "Restock needed untuk menjaga target forecast",
                message: `Cakupan stok hanya ${coverageMonths.toFixed(1)} bulan, sementara kebutuhan ideal minimal ${TARGET_STOCK_COVERAGE_MONTHS} bulan. Forecast kuartal berikutnya senilai ${formatCompactNumber(nextQuarterForecast)} berisiko tertahan oleh ketersediaan barang.`,
                actionLabel: `Tambah sekitar ${formatCompactNumber(recommendedRestockUnits)} unit`,
                currentStockUnits: stock.currentStockUnits,
                stockValue: stock.stockValue,
                coverageMonths: Number(coverageMonths.toFixed(2)),
                coverageLabel: `${coverageMonths.toFixed(1)} months cover`,
                recommendedRestockUnits,
                trackedMaterials: stock.trackedMaterials,
                stockedMaterials: stock.stockedMaterials,
                stockDataCoveragePct: Number(stockDataCoveragePct.toFixed(1)),
            },
            simulation: {
                baselineCoverageMonths: Number(coverageMonths.toFixed(2)),
                targetCoverageMonths: TARGET_STOCK_COVERAGE_MONTHS,
                elasticity,
                recommendedStockChangePct,
                baselineMultiplier,
            },
        }
    }

    if (coverageMonths < TARGET_STOCK_COVERAGE_MONTHS) {
        return {
            insight: {
                alertLevel: "watch" as const,
                title: "Forecast bisa tercapai, tetapi buffer stok tipis",
                message: `Cakupan stok berada di ${coverageMonths.toFixed(1)} bulan. Forecast tetap sehat, namun tambahan buffer akan membantu menjaga service level ketika demand melonjak.`,
                actionLabel: `Pertimbangkan tambahan ${formatCompactNumber(recommendedRestockUnits)} unit`,
                currentStockUnits: stock.currentStockUnits,
                stockValue: stock.stockValue,
                coverageMonths: Number(coverageMonths.toFixed(2)),
                coverageLabel: `${coverageMonths.toFixed(1)} months cover`,
                recommendedRestockUnits,
                trackedMaterials: stock.trackedMaterials,
                stockedMaterials: stock.stockedMaterials,
                stockDataCoveragePct: Number(stockDataCoveragePct.toFixed(1)),
            },
            simulation: {
                baselineCoverageMonths: Number(coverageMonths.toFixed(2)),
                targetCoverageMonths: TARGET_STOCK_COVERAGE_MONTHS,
                elasticity,
                recommendedStockChangePct,
                baselineMultiplier,
            },
        }
    }

    return {
        insight: {
            alertLevel: "healthy" as const,
            title: "Stock coverage mendukung forecast",
            message: `Cakupan stok sekitar ${coverageMonths.toFixed(1)} bulan sehingga target forecast memiliki buffer eksekusi yang baik untuk kuartal berikutnya.`,
            actionLabel: "Pertahankan pola replenishment",
            currentStockUnits: stock.currentStockUnits,
            stockValue: stock.stockValue,
            coverageMonths: Number(coverageMonths.toFixed(2)),
            coverageLabel: `${coverageMonths.toFixed(1)} months cover`,
            recommendedRestockUnits: 0,
            trackedMaterials: stock.trackedMaterials,
            stockedMaterials: stock.stockedMaterials,
            stockDataCoveragePct: Number(stockDataCoveragePct.toFixed(1)),
        },
        simulation: {
            baselineCoverageMonths: Number(coverageMonths.toFixed(2)),
            targetCoverageMonths: TARGET_STOCK_COVERAGE_MONTHS,
            elasticity,
            recommendedStockChangePct: 0,
            baselineMultiplier,
        },
    }
}

const buildDrivers = (
    points: HistoricalFeaturePoint[],
    weights: Record<ModelKey, number>,
    stockInsight: RevenueMLStockInsight,
    upcomingSeasonalityPct: number,
    recentTrendPct: number,
    averageTrendPct: number
) => {
    const anomalyRatio = points.length > 0
        ? points.filter((point) => point.isAnomaly).length / points.length
        : 0
    const businessDayAverage = average(points.map((point) => point.businessDays))
    const nextQuarterBusinessDayAverage = average(
        [1, 2, 3].map((monthOffset) => getBusinessDays(addMonths(parseMonthKey(points[points.length - 1].month), monthOffset)))
    )
    const businessDayDeltaPct = businessDayAverage > 0
        ? ((nextQuarterBusinessDayAverage - businessDayAverage) / businessDayAverage) * 100
        : 0
    const stockCoverage = stockInsight.coverageMonths

    const drivers: RevenueMLDriver[] = [
        {
            id: "trend",
            label: "Demand Momentum",
            direction: recentTrendPct > 2 ? "positive" : recentTrendPct < -2 ? "negative" : "neutral",
            impactScore: clamp(Math.abs(recentTrendPct) * 3.2, 18, 92),
            valueLabel: `${recentTrendPct.toFixed(1)}% last 3m`,
            insight: recentTrendPct > 2
                ? "Tren tiga bulan terakhir mengangkat baseline forecast."
                : recentTrendPct < -2
                    ? "Permintaan terbaru masih menekan baseline forecast."
                    : "Tren permintaan relatif datar dan tidak banyak menggeser baseline.",
        },
        {
            id: "seasonality",
            label: "Seasonality Window",
            direction: upcomingSeasonalityPct > 3 ? "positive" : upcomingSeasonalityPct < -3 ? "negative" : "neutral",
            impactScore: clamp(Math.abs(upcomingSeasonalityPct) * 2.8, 16, 88),
            valueLabel: `${upcomingSeasonalityPct.toFixed(1)}% vs annual`,
            insight: upcomingSeasonalityPct > 3
                ? "Bulan-bulan berikutnya masuk fase musiman yang biasanya lebih kuat."
                : upcomingSeasonalityPct < -3
                    ? "Bulan-bulan berikutnya berada di fase musiman yang biasanya lebih lemah."
                    : "Pengaruh musiman berikutnya cenderung netral.",
        },
        {
            id: "calendar",
            label: "Working Day Effect",
            direction: businessDayDeltaPct > 1.5 ? "positive" : businessDayDeltaPct < -1.5 ? "negative" : "neutral",
            impactScore: clamp(Math.abs(businessDayDeltaPct) * 6, 10, 70),
            valueLabel: `${businessDayDeltaPct.toFixed(1)}% workday delta`,
            insight: businessDayDeltaPct > 1.5
                ? "Jumlah hari kerja kuartal depan sedikit lebih panjang dari rata-rata historis."
                : businessDayDeltaPct < -1.5
                    ? "Jumlah hari kerja kuartal depan lebih pendek dan dapat menahan revenue."
                    : "Kalender kerja kuartal depan relatif mirip dengan pola historis.",
        },
        {
            id: "stock",
            label: "Inventory Readiness",
            direction: stockCoverage === null
                ? "neutral"
                : stockCoverage >= TARGET_STOCK_COVERAGE_MONTHS
                    ? "positive"
                    : "negative",
            impactScore: stockCoverage === null
                ? 20
                : clamp(Math.abs(stockCoverage - TARGET_STOCK_COVERAGE_MONTHS) * 18, 18, 90),
            valueLabel: stockCoverage === null ? "mapping terbatas" : `${stockCoverage.toFixed(1)} months cover`,
            insight: stockCoverage === null
                ? "Belum semua material berhasil dipetakan ke stok sehingga dampak inventory dibaca secara konservatif."
                : stockCoverage >= TARGET_STOCK_COVERAGE_MONTHS
                    ? "Buffer stok cukup untuk mendukung realisasi forecast."
                    : "Buffer stok di bawah target sehingga potensi sales bisa tertahan bila demand menguat.",
        },
        {
            id: "noise",
            label: "Noise and Anomaly Drag",
            direction: anomalyRatio > 0.12 ? "negative" : "neutral",
            impactScore: clamp(anomalyRatio * 400, 12, 86),
            valueLabel: `${(anomalyRatio * 100).toFixed(1)}% anomaly months`,
            insight: anomalyRatio > 0.12
                ? "Banyak bulan anomali membuat confidence model turun walaupun tren utama tetap terbaca."
                : "Noise historis relatif terjaga sehingga model lebih stabil.",
        },
        {
            id: "ensemble",
            label: "Hybrid Model Balance",
            direction: "positive",
            impactScore: clamp((weights.trendSeasonal * 100) + (weights.adaptiveRecency * 40), 20, 85),
            valueLabel: `${(weights.trendSeasonal * 100).toFixed(0)}/${(weights.adaptiveRecency * 100).toFixed(0)}/${(weights.seasonalNaive * 100).toFixed(0)}`,
            insight: `Bobot hybrid saat ini menyeimbangkan tren jangka panjang ${averageTrendPct >= 0 ? "dengan" : "meski"} pergerakan terbaru untuk mengurangi bias.`,
        },
    ]

    return drivers
        .sort((left, right) => right.impactScore - left.impactScore)
        .slice(0, 4)
}

const buildAnomalies = (
    points: HistoricalFeaturePoint[],
    stockInsight: RevenueMLStockInsight
) => {
    const averageBusinessDays = average(points.map((point) => point.businessDays))

    return points
        .filter((point) => point.isAnomaly)
        .map((point, index, anomalies) => {
            const isNegative = point.anomalyImpactPct < 0
            const businessDayGap = point.businessDays - averageBusinessDays

            let shortReason = "Pola transaksi tidak biasa"
            let reason = `Revenue aktual ${formatCompactNumber(point.revenue)} menyimpang ${Math.abs(point.anomalyImpactPct).toFixed(1)}% dari baseline ${formatCompactNumber(point.baselineRevenue)}.`

            if (isNegative && point.qtyChangePct <= -20) {
                shortReason = "Volume order turun tajam"
                reason += " Volume order melemah signifikan dibanding bulan sebelumnya, sehingga penurunan lebih dalam dari pola musiman normal."
            } else if (isNegative && businessDayGap <= -2) {
                shortReason = "Hari kerja lebih pendek"
                reason += " Jumlah hari kerja lebih sedikit dari pola rata-rata, sehingga momentum revenue ikut tertekan."
            } else if (isNegative && stockInsight.coverageMonths !== null && stockInsight.coverageMonths < 1.5 && index >= anomalies.length - 3) {
                shortReason = "Ada tekanan ketersediaan stok"
                reason += " Dengan coverage stok yang saat ini tipis, pola ini berpotensi terkait hambatan suplai pada material utama."
            } else if (!isNegative && point.qtyChangePct >= 25) {
                shortReason = "Lonjakan proyek atau bulk order"
                reason += " Kenaikan kuantitas yang kuat mengindikasikan adanya order proyek atau transaksi besar satu kali."
            } else if (!isNegative) {
                shortReason = "Revenue melampaui pola normal"
                reason += " Revenue naik di atas baseline musiman, kemungkinan dipicu mix produk atau order khusus."
            }

            return {
                month: point.month,
                label: formatMonthLabel(point.month),
                actualRevenue: point.revenue,
                expectedRevenue: point.baselineRevenue,
                impactPct: Number(point.anomalyImpactPct.toFixed(1)),
                severity: (Math.abs(point.anomalyImpactPct) >= 55 ? "high" : "medium") as "high" | "medium",
                shortReason,
                reason,
            }
        })
        .sort((left, right) => Math.abs(right.impactPct) - Math.abs(left.impactPct))
        .slice(0, 10)
}

const buildConfidence = (
    accuracy: number,
    volatilityCv: number,
    anomalyRatio: number,
    stockInsight: RevenueMLStockInsight
): RevenueMLConfidence => {
    const stockPenalty = stockInsight.alertLevel === "restock" ? 8 : stockInsight.alertLevel === "watch" ? 4 : 0
    const confidenceScore = accuracy - (Math.max(0, volatilityCv - 20) * 0.45) - (anomalyRatio * 55) - stockPenalty

    if (confidenceScore >= 76) {
        return {
            tier: "high",
            label: "High Confidence",
            note: "Pattern historis relatif konsisten dan noise masih terkendali, sehingga forecast layak dipakai sebagai baseline keputusan.",
        }
    }

    if (confidenceScore >= 60) {
        return {
            tier: "medium",
            label: "Medium Confidence",
            note: "Forecast cukup layak dibaca, tetapi tetap perlu dikawal oleh update transaksi terbaru, anomali, dan kesiapan stok.",
        }
    }

    return {
        tier: "low",
        label: "Low Confidence",
        note: "Akurasi masih rentan dipengaruhi fluktuasi historis, jadi forecast sebaiknya dipakai sebagai arah, bukan angka komitmen final.",
    }
}

export function buildRevenueMLForecast(
    series: RevenueMLInputPoint[],
    stockSnapshot?: RevenueMLStockSnapshot
): RevenueMLComputation {
    const features = buildHistoricalFeatures(series)
    const historicalRevenue = features.map((point) => point.revenue)
    const growthSeries = calculateGrowthSeries(historicalRevenue)
    const averageTrendPct = average(growthSeries)
    const recentTrendPct = average(growthSeries.slice(-3))
    const meanRevenue = average(historicalRevenue)
    const volatilityCv = meanRevenue > 0
        ? (standardDeviation(historicalRevenue) / meanRevenue) * 100
        : 0

    const monthAverages = new Array(12).fill(0).map((_, monthIndex) => {
        const values = features
            .filter((point) => point.monthIndex === monthIndex)
            .map((point) => point.revenue)
        return values.length > 0 ? average(values) : 0
    })
    const seasonalityStrength = meanRevenue > 0
        ? ((Math.max(...monthAverages) - Math.min(...monthAverages)) / meanRevenue) * 100
        : 0

    const hybrid = evaluateHybridWeights(features)
    const lastHistoricalMonth = parseMonthKey(features[features.length - 1].month)

    const preliminaryForecast: Array<{ month: string; forecast: number }> = []
    const modelWorkingSeries: Record<ModelKey, HistoricalFeaturePoint[]> = {
        trendSeasonal: [...features],
        adaptiveRecency: [...features],
        seasonalNaive: [...features],
    }

    for (let index = 1; index <= 12; index += 1) {
        const targetDate = addMonths(lastHistoricalMonth, index)
        const targetMonth = toMonthKey(targetDate)
        const trendSeasonal = modelPredictors.trendSeasonal(modelWorkingSeries.trendSeasonal, targetDate)
        const adaptiveRecency = modelPredictors.adaptiveRecency(modelWorkingSeries.adaptiveRecency, targetDate)
        const seasonalNaive = modelPredictors.seasonalNaive(modelWorkingSeries.seasonalNaive, targetDate)
        const combinedForecast =
            (trendSeasonal * hybrid.weights.trendSeasonal) +
            (adaptiveRecency * hybrid.weights.adaptiveRecency) +
            (seasonalNaive * hybrid.weights.seasonalNaive)

        preliminaryForecast.push({
            month: targetMonth,
            forecast: Math.max(0, combinedForecast),
        })

        const monthIndex = targetDate.getMonth()
        const estimatedQty = estimateNextQty(modelWorkingSeries.trendSeasonal, monthIndex)
        const businessDays = getBusinessDays(targetDate)
        const syntheticPoint: HistoricalFeaturePoint = {
            month: targetMonth,
            revenue: combinedForecast,
            qty: estimatedQty,
            t: modelWorkingSeries.trendSeasonal.length + 1,
            monthIndex,
            businessDays,
            revenuePerBusinessDay: businessDays > 0 ? combinedForecast / businessDays : combinedForecast,
            baselineRevenue: combinedForecast,
            adjustedRevenue: combinedForecast,
            adjustedRevenuePerBusinessDay: businessDays > 0 ? combinedForecast / businessDays : combinedForecast,
            isAnomaly: false,
            anomalyImpactPct: 0,
            qtyChangePct: 0,
        }

        modelWorkingSeries.trendSeasonal.push(syntheticPoint)
        modelWorkingSeries.adaptiveRecency.push(syntheticPoint)
        modelWorkingSeries.seasonalNaive.push(syntheticPoint)
    }

    const nextQuarterForecast = preliminaryForecast
        .slice(0, 3)
        .reduce((sum, point) => sum + point.forecast, 0)
    const stock = buildStockInsight(
        stockSnapshot || {
            currentStockUnits: 0,
            stockValue: 0,
            trackedMaterials: 0,
            stockedMaterials: 0,
        },
        features,
        nextQuarterForecast
    )

    const forecastData = preliminaryForecast.map((point, index) => {
        const adjustedForecast = simulateRevenueScenario(
            point.forecast,
            stock.simulation,
            0
        )
        const uncertaintyFactor = stock.insight.alertLevel === "restock" ? 1.15 : 1
        const confidenceInterval = hybrid.residualStdDev * 1.96 * Math.sqrt(index + 1) * uncertaintyFactor
        return {
            month: point.month,
            revenue: null,
            forecast: Number(adjustedForecast.toFixed(0)),
            upper: Number(Math.max(0, adjustedForecast + confidenceInterval).toFixed(0)),
            lower: Number(Math.max(0, adjustedForecast - confidenceInterval).toFixed(0)),
            type: "forecast" as const,
            isAnomaly: false,
            anomalyValue: null,
        }
    })

    const anomalyRatio = features.length > 0
        ? features.filter((point) => point.isAnomaly).length / features.length
        : 0
    const confidence = buildConfidence(hybrid.accuracy, volatilityCv, anomalyRatio, stock.insight)
    const trend: RevenueTrendDirection = recentTrendPct > 2 ? "up" : recentTrendPct < -2 ? "down" : "stable"
    const lastQuarterAverage = average(features.slice(-3).map((point) => point.revenue))
    const futureQuarterAverage = average(forecastData.slice(0, 3).map((point) => point.forecast || 0))
    const upcomingSeasonalityPct = meanRevenue > 0
        ? ((futureQuarterAverage - lastQuarterAverage) / meanRevenue) * 100
        : 0
    const drivers = buildDrivers(
        features,
        hybrid.weights,
        stock.insight,
        upcomingSeasonalityPct,
        recentTrendPct,
        averageTrendPct
    )
    const anomalies = buildAnomalies(features, stock.insight)

    const narrative = `Revenue historis cenderung ${describeTrend(trend)} (${recentTrendPct.toFixed(1)}% pada 3 bulan terakhir), volatilitas ${volatilityCv > 35 ? "tinggi" : volatilityCv > 20 ? "sedang" : "rendah"} (CV ${volatilityCv.toFixed(1)}%), dengan pola musiman ${seasonalityStrength > 45 ? "kuat" : seasonalityStrength > 20 ? "sedang" : "lemah"}. Terdeteksi ${features.filter((point) => point.isAnomaly).length} bulan anomali dari riwayat transaksi.`
    const executiveSummary = [
        `Dengan ${features.length} bulan histori, forecast 12 bulan ke depan bergerak ${describeTrend(trend)} dengan ${describeConfidence(confidence.tier)} (${hybrid.accuracy.toFixed(2)}%).`,
        `Driver utama saat ini adalah ${drivers[0]?.label.toLowerCase() || "pola historis"}, ${drivers[1]?.label.toLowerCase() || "seasonality"}, dan ${stock.insight.alertLevel === "healthy" ? "kesiapan stok yang mendukung" : "kesiapan stok yang perlu dijaga"}.`,
        stock.insight.alertLevel === "restock"
            ? "Prioritas tindakan: tambah buffer stok agar peluang revenue kuartal depan tidak tertahan."
            : stock.insight.alertLevel === "watch"
                ? "Prioritas tindakan: monitor coverage stok dan siapkan replenishment untuk menjaga service level."
                : "Prioritas tindakan: pertahankan ritme replenishment sambil fokus ke bulan-bulan anomali."
    ].join(" ")

    return {
        data: [
            ...features.map((point) => ({
                month: point.month,
                revenue: Number(point.revenue.toFixed(0)),
                forecast: null,
                upper: null,
                lower: null,
                type: "history" as const,
                isAnomaly: point.isAnomaly,
                anomalyValue: point.isAnomaly ? Number(point.revenue.toFixed(0)) : null,
            })),
            ...forecastData,
        ],
        accuracy: hybrid.accuracy.toFixed(2),
        isReliable: confidence.tier !== "low" || hybrid.accuracy >= 70,
        confidence,
        insightSummary: {
            trend,
            trendPctAvg: Number(averageTrendPct.toFixed(2)),
            recentTrendPct: Number(recentTrendPct.toFixed(2)),
            volatilityCv: Number(volatilityCv.toFixed(2)),
            seasonalityStrength: Number(seasonalityStrength.toFixed(2)),
            anomalyCount: features.filter((point) => point.isAnomaly).length,
            narrative,
            executiveSummary,
        },
        drivers,
        anomalies,
        stockInsight: stock.insight,
        simulation: stock.simulation,
        diagnostics: {
            historyMonths: features.length,
            forecastMonths: forecastData.length,
            validationMonths: hybrid.validationMonths,
            businessDayAdjustment: true,
            hybridWeights: {
                trendSeasonal: Number(hybrid.weights.trendSeasonal.toFixed(2)),
                adaptiveRecency: Number(hybrid.weights.adaptiveRecency.toFixed(2)),
                seasonalNaive: Number(hybrid.weights.seasonalNaive.toFixed(2)),
            },
        },
    }
}
