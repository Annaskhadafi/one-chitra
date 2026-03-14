import { describe, expect, it } from "vitest"

import { buildRevenueMLForecast, simulateRevenueScenario } from "../revenue-ml-forecast"

const buildSyntheticSeries = () => {
    const seasonality = [0.92, 0.96, 1.02, 1.04, 1.08, 1.12, 1.06, 1.03, 0.99, 1.01, 1.05, 1.14]

    return Array.from({ length: 48 }, (_, index) => {
        const date = new Date(2021, index, 1)
        const base = 140_000 + (index * 4_800)
        let revenue = base * seasonality[date.getMonth()]

        if (index === 11) revenue *= 0.58
        if (index === 28) revenue *= 1.42

        return {
            month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
            revenue,
            qty: 90 + (date.getMonth() * 3) + index,
        }
    })
}

describe("revenue-ml-forecast", () => {
    it("builds a full forecast package with anomalies, drivers, and confidence", () => {
        const result = buildRevenueMLForecast(buildSyntheticSeries(), {
            currentStockUnits: 780,
            stockValue: 450_000_000,
            trackedMaterials: 24,
            stockedMaterials: 20,
        })

        const accuracy = Number(result.accuracy)

        expect(result.data.filter((point) => point.type === "forecast")).toHaveLength(12)
        expect(result.drivers).toHaveLength(4)
        expect(result.anomalies.length).toBeGreaterThan(0)
        expect(result.confidence.label.length).toBeGreaterThan(0)
        expect(accuracy).toBeGreaterThan(60)
    })

    it("raises a restock signal and improves scenario revenue when stock is increased", () => {
        const result = buildRevenueMLForecast(buildSyntheticSeries(), {
            currentStockUnits: 120,
            stockValue: 90_000_000,
            trackedMaterials: 24,
            stockedMaterials: 20,
        })

        const firstForecastPoint = result.data.find((point) => point.type === "forecast")
        const simulated = simulateRevenueScenario(firstForecastPoint?.forecast || 0, result.simulation, 20)

        expect(result.stockInsight.alertLevel).toBe("restock")
        expect(simulated).toBeGreaterThan(firstForecastPoint?.forecast || 0)
    })

    it("keeps stock alert neutral when stock mapping is not available", () => {
        const result = buildRevenueMLForecast(buildSyntheticSeries())

        expect(result.stockInsight.alertLevel).toBe("unknown")
        expect(result.simulation.baselineCoverageMonths).toBeNull()
    })
})
