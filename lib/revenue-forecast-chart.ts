import { splitAnnualAmount } from "./forecast-split"

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

export const MVC_COMPANIES = [
    "PT. CIPTA KRIDA BAHARI",
    "PT. CIPTA KRIDATAMA",
    "PT. TRAKINDO UTAMA",
    "PT. RODA NUSANTARA GTJ",
    "PT. SANGGAR SARANA BAJA",
] as const

export function getOtherBrandRankingPeriod(period: string, months: Array<{ name: string; revenue: number }>) {
    return period.includes(".")
        ? period
        : [...months].reverse().find(month => month.revenue !== 0)?.name || `12.${period}`
}

export function buildSegmentTrendData(data: Array<{ name: string; revenue: number; forecast: number }>, annualForecast?: number) {
    let revenueYtd = 0
    let forecastYtd = 0
    // ponytail: annual master target controls the YTD line; monthly targets still control monthly achievement.
    const ytdMonths = annualForecast === undefined ? undefined : splitAnnualAmount(annualForecast)
    return data.map((month, index) => {
        revenueYtd += month.revenue
        forecastYtd = ytdMonths
            ? Math.round((forecastYtd + ytdMonths[index]) * 100) / 100
            : forecastYtd + month.forecast
        return {
            ...month,
            month: monthLabels[index],
            revenueYtdK: revenueYtd / 1000,
            forecastYtdK: forecastYtd / 1000,
            achievement: month.forecast > 0 ? Math.min(month.revenue / month.forecast * 100, 999) : 0,
        }
    })
}
