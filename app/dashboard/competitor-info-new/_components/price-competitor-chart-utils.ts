export type MonthlyTrendRow = Record<string, string | number | null>

export function getMonthlyBrandTrendStats(data: MonthlyTrendRow[], brand: string) {
    const prices = data
        .map((row) => Number(row[brand] ?? 0))
        .filter((value) => Number.isFinite(value) && value > 0)

    if (!prices.length) {
        return { min: 0, average: 0, max: 0 }
    }

    return {
        min: Math.min(...prices),
        average: prices.reduce((sum, value) => sum + value, 0) / prices.length,
        max: Math.max(...prices),
    }
}

export function getMonthlyBrandTrendAverage(data: MonthlyTrendRow[], brands: string[]) {
    const prices = data.flatMap((row) => (
        brands
            .map((brand) => Number(row[brand] ?? 0))
            .filter((value) => Number.isFinite(value) && value > 0)
    ))

    if (!prices.length) return 0

    return prices.reduce((sum, value) => sum + value, 0) / prices.length
}
