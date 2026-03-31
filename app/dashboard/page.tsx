import { getDashboardStats } from "@/lib/server/dashboard-overview"
import { getDashboardRevenueForecastData } from "@/lib/server/dashboard-revenue"
import { DashboardModernOverview } from "@/components/dashboard/dashboard-modern-overview"

type RangeOption = "this-week" | "this-month" | "this-quarter"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>
}) {
  const params = await searchParams
  const selectedRange: RangeOption =
    params?.range === "this-week" || params?.range === "this-quarter" || params?.range === "this-month"
      ? params.range
      : "this-month"

  const now = new Date()
  const period =
    selectedRange === "this-quarter"
      ? `${now.getFullYear()}`
      : `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`

  const [stats, revenueVsForecastResponse] = await Promise.all([
    getDashboardStats(selectedRange),
    getDashboardRevenueForecastData({ period, range: selectedRange }),
  ])

    const dashboardData = (revenueVsForecastResponse as any).success 
        ? (revenueVsForecastResponse as any).data 
        : null

    const revenueVsForecastYtd = dashboardData?.ytdChart ?? []
    const topCustomersLocCurr = dashboardData?.topCustomersLocCurr ?? []

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">
      <DashboardModernOverview
        stats={stats}
        revenueVsForecastYtd={revenueVsForecastYtd}
        topCustomersLocCurr={topCustomersLocCurr}
        selectedRange={selectedRange}
      />
    </div>
  )
}
