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

export function isRepairRecord(record: {
    brand?: string | null
    category?: string | null
    size?: string | null
    deliveryPoint?: string | null
}): boolean {
    const brand = (record.brand ?? "").toLowerCase()
    const category = (record.category ?? "").toLowerCase()
    const size = (record.size ?? "").toLowerCase()
    const remark = (record.deliveryPoint ?? "").toLowerCase()

    return (
        brand.includes("repair") ||
        category.includes("repair") ||
        size.includes("repair") ||
        remark.includes("repair")
    )
}

export function filterNonRepairRecords<T extends {
    brand?: string | null
    category?: string | null
    size?: string | null
    deliveryPoint?: string | null
}>(records: T[]): T[] {
    return records.filter((record) => !isRepairRecord(record))
}

export function filterRepairRecords<T extends {
    brand?: string | null
    category?: string | null
    size?: string | null
    deliveryPoint?: string | null
}>(records: T[]): T[] {
    return records.filter((record) => isRepairRecord(record))
}

export function cleanRepairSize(size?: string | null): string {
    return (size ?? "").replace(/^repair\s*/i, "").replace(/\s+/g, "").trim()
}


