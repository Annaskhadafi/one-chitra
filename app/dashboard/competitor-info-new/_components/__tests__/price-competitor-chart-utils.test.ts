import { describe, expect, it } from "vitest"

import { getMonthlyBrandTrendAverage, getMonthlyBrandTrendStats } from "../price-competitor-chart-utils"

describe("getMonthlyBrandTrendAverage", () => {
    it("averages valid brand prices across monthly trend rows", () => {
        const average = getMonthlyBrandTrendAverage(
            [
                { month: "2026-01", Bridgestone: 100, Michelin: 200, Yokohama: null },
                { month: "2026-02", Bridgestone: 0, Michelin: 300, Yokohama: "" },
            ],
            ["Bridgestone", "Michelin", "Yokohama"],
        )

        expect(average).toBe(200)
    })

    it("returns 0 when no valid brand prices exist", () => {
        const average = getMonthlyBrandTrendAverage(
            [{ month: "2026-01", Bridgestone: null, Michelin: 0 }],
            ["Bridgestone", "Michelin"],
        )

        expect(average).toBe(0)
    })

    it("calculates min, average, and max for one brand", () => {
        const stats = getMonthlyBrandTrendStats(
            [
                { month: "2026-01", Bridgestone: 180_000_000 },
                { month: "2026-02", Bridgestone: 0 },
                { month: "2026-03", Bridgestone: 220_000_000 },
            ],
            "Bridgestone",
        )

        expect(stats).toEqual({
            min: 180_000_000,
            average: 200_000_000,
            max: 220_000_000,
        })
    })
})
