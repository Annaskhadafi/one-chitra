import { fetchDashboardRevenueForecast, fetchAllSalesRevenueData, fetchDashboardInventory } from "@/app/actions/dashboard-revenue-logic"
import { RevenueClient } from "@/app/dashboard/revenue-forecast/_components/revenue-client"
import { SalesRevenueTable } from "@/app/dashboard/revenue-forecast/_components/sales-revenue-table"
import { notFound } from "next/navigation"
import type { ComponentProps } from "react"

export const dynamic = "force-dynamic"

type SnapshotRevenueData = ComponentProps<typeof RevenueClient>["initialData"]
type SnapshotSalesRevenueData = ComponentProps<typeof SalesRevenueTable>["data"]

export default async function RevenueSnapshotPage({
    searchParams,
}: {
    searchParams: Promise<{ period?: string; token?: string }>
}) {
    const params = await searchParams
    const { period, token } = params

    // 1. Security check
    const cronSecret = process.env.CRON_SECRET || "one-chitra-internal-secret-2026"
    if (!token || token !== cronSecret) {
        console.warn(`[Snapshot] Unauthorized access attempt with token: ${token}`)
        return notFound()
    }

    if (!period) {
        return <div>Period is required</div>
    }

    // 2. Fetch Data (Using logic-only functions to bypass auth)
    const [response, salesRevenueResponse, inventoryResponse] = await Promise.all([
        fetchDashboardRevenueForecast({ period }),
        fetchAllSalesRevenueData({ period }),
        fetchDashboardInventory()
    ])

    const defaultData: SnapshotRevenueData = {
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
    const salesRevenueData: SnapshotSalesRevenueData = salesRevenueResponse.success && salesRevenueResponse.data ? salesRevenueResponse.data : []
    const salesRevenueTotal = salesRevenueResponse.success && salesRevenueResponse.total !== undefined ? salesRevenueResponse.total : 0
    const salesRevenueCount = salesRevenueResponse.success && salesRevenueResponse.count !== undefined ? salesRevenueResponse.count : 0

    return (
        <div id="revenue-report-pdf-root" className="bg-white p-4" style={{ width: "1280px" }}>
            <div className="space-y-4">
                <RevenueClient 
                    initialData={data} 
                    selectedPeriod={period} 
                    inventoryData={inventoryResponse.success && inventoryResponse.data ? inventoryResponse.data : null} 
                    isExporting={true}
                />
                <SalesRevenueTable 
                    data={salesRevenueData} 
                    total={salesRevenueTotal} 
                    count={salesRevenueCount}
                    period={period}
                    defaultExpanded={true}
                />
            </div>
            
            <div className="mt-8 text-center text-[10px] text-muted-foreground border-t pt-4">
                One Chitra - All In One Apps Chitra Paratama · Document generated automatically
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .export-button-hide { display: none !important; }
                html, body { background-color: white !important; overflow-x: hidden !important; width: 1280px !important; margin: 0 !important; padding: 0 !important; min-height: 0 !important; height: auto !important; }
                .p-4 { padding: 1rem !important; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            ` }} />
        </div>
    )
}
