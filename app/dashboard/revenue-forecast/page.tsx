import { getDashboardRevenueForecast } from "@/app/actions/dashboard-revenue"
import { RevenueClient } from "./_components/revenue-client"

export const metadata = {
    title: "Revenue vs Forecast Dashboard - One Chitra",
}

export default async function RevenueForecastPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
    const params = await searchParams;
    const period = params.period || "02.2026"

    const response = await getDashboardRevenueForecast({ period })

    const defaultData = {
        period,
        isYearlyView: false,
        targets: {
            consolidate: { revenue: 0, forecast: 0 },
            primeProduct: { revenue: 0, forecast: 0 },
            service: { revenue: 0, forecast: 0 },
            pa: { revenue: 0, forecast: 0 },
            paService: { revenue: 0, forecast: 0 },
            ck: { revenue: 0, forecast: 0 },
            sis: { revenue: 0, forecast: 0 },
            ma_oc: { revenue: 0, forecast: 0 },
            ma_wis: { revenue: 0, forecast: 0 },
            ma_fq: { revenue: 0, forecast: 0 },
            ma_bur: { revenue: 0, forecast: 0 },
            ma_ag: { revenue: 0, forecast: 0 },
            ma_mic: { revenue: 0, forecast: 0 }
        },
        materials: [],
        revTypes: [],
        matGroups: [],
        ytdChart: []
    }

    const data = response.success && response.data ? response.data : defaultData

    return (
        <div className="flex-1 p-4 md:p-6 pt-4 relative flex flex-col bg-muted/20 min-h-screen">
            <div className="flex-1 min-h-0">
                <RevenueClient initialData={data} selectedPeriod={period} />
            </div>
        </div>
    )
}
