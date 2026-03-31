import {
    getAllSalesRevenueDataForPage,
    getDashboardInventoryData,
    getDashboardRevenueForecastData,
} from "@/lib/server/dashboard-revenue"
import { RevenueClient } from "./_components/revenue-client"
import { SalesRevenueTable } from "./_components/sales-revenue-table"
import { format } from "date-fns"

export const metadata = {
    title: "Revenue vs Forecast Dashboard - One Chitra",
}

export default async function RevenueForecastPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
    const params = await searchParams;
    const period = params.period || format(new Date(), 'MM.yyyy')

    const response = await getDashboardRevenueForecastData({ period })
    const salesRevenueResponse = await getAllSalesRevenueDataForPage({ period })
    const inventoryResponse = await getDashboardInventoryData()

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
            ma_ws: { revenue: 0, forecast: 0 },
            ma_fq: { revenue: 0, forecast: 0 },
            ma_br: { revenue: 0, forecast: 0 },
            ma_ag: { revenue: 0, forecast: 0 },
            ma_mc: { revenue: 0, forecast: 0 }
        },
        materials: [],
        revTypes: [],
        matGroups: [],
        ytdChart: [] as Array<{ name: string; revenue: number; forecast: number }>
    }

    const data = response.success && response.data ? response.data : defaultData
    const salesRevenueData = salesRevenueResponse.success && salesRevenueResponse.data ? salesRevenueResponse.data : []
    const salesRevenueTotal = salesRevenueResponse.success && salesRevenueResponse.total !== undefined ? salesRevenueResponse.total : 0
    const salesRevenueCount = salesRevenueResponse.success && salesRevenueResponse.count !== undefined ? salesRevenueResponse.count : 0

    return (
        <div className="flex-1 p-4 md:p-6 pt-4 relative flex flex-col bg-muted/20 min-h-screen">
            <div className="flex-1 min-h-0 space-y-4">
                <RevenueClient initialData={data} selectedPeriod={period} inventoryData={inventoryResponse.success && inventoryResponse.data ? inventoryResponse.data : null} />
                <SalesRevenueTable 
                    data={salesRevenueData} 
                    total={salesRevenueTotal} 
                    count={salesRevenueCount}
                    period={period}
                />
            </div>
        </div>
    )
}
