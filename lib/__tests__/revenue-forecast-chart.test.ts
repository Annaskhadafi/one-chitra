import { describe, expect, it } from "vitest"
import { buildSegmentTrendData, getOtherBrandRankingPeriod } from "../revenue-forecast-chart"

describe("buildSegmentTrendData", () => {
    it("keeps empty months while accumulating actual revenue and forecast", () => {
        const result = buildSegmentTrendData([
            { name: "01.2026", revenue: 1000, forecast: 2000 },
            { name: "02.2026", revenue: 0, forecast: 2000 },
            { name: "03.2026", revenue: 3000, forecast: 0 },
        ])
        expect(result.map(row => [row.month, row.revenueYtdK, row.forecastYtdK, row.achievement])).toEqual([
            ["Jan", 1, 2, 50],
            ["Feb", 1, 4, 0],
            ["Mar", 4, 4, 0],
        ])
    })

    it("uses the annual master target for the YTD line while keeping monthly achievement", () => {
        const months = Array.from({ length: 12 }, (_, index) => ({
            name: `${String(index + 1).padStart(2, "0")}.2026`, revenue: 963750, forecast: 963750,
        }))
        const result = buildSegmentTrendData(months, 18583000)
        expect(result[0].forecastYtdK).toBeCloseTo(1548.58333, 4)
        expect(result[9].forecastYtdK).toBeCloseTo(15485.83333, 4)
        expect(result[11].forecastYtdK).toBe(18583)
        expect(result[9].achievement).toBe(100)
    })

    it("uses the selected month or the latest active month in a yearly view", () => {
        const months = [
            { name: "09.2026", revenue: 100 },
            { name: "10.2026", revenue: 50 },
            { name: "11.2026", revenue: 0 },
            { name: "12.2026", revenue: 0 },
        ]
        expect(getOtherBrandRankingPeriod("09.2026", months)).toBe("09.2026")
        expect(getOtherBrandRankingPeriod("2026", months)).toBe("10.2026")
    })
})
