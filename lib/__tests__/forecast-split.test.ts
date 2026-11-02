import { describe, expect, it } from "vitest"
import { shouldFillMonthlyForecast, splitAnnualAmount } from "../forecast-split"

describe("splitAnnualAmount", () => {
    it("returns twelve cent-accurate monthly amounts with the remainder in December", () => {
        const months = splitAnnualAmount(100)
        expect(months).toHaveLength(12)
        expect(months.slice(0, 11)).toEqual(Array(11).fill(8.33))
        expect(months[11]).toBe(8.37)
        expect(Math.round(months.reduce((total, amount) => total + amount, 0) * 100)).toBe(10000)
    })

    it("fills missing and zero targets without replacing an existing monthly value", () => {
        expect(shouldFillMonthlyForecast([])).toBe(true)
        expect(shouldFillMonthlyForecast([0])).toBe(true)
        expect(shouldFillMonthlyForecast([0, 42])).toBe(false)
    })
})
