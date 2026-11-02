export function splitAnnualAmount(amount: number): number[] {
    const cents = Math.round(amount * 100)
    const monthlyCents = Math.floor(cents / 12)
    return Array.from({ length: 12 }, (_, month) =>
        (month === 11 ? cents - monthlyCents * 11 : monthlyCents) / 100
    )
}

export function shouldFillMonthlyForecast(existingAmounts: number[]): boolean {
    return existingAmounts.every(amount => amount === 0)
}
