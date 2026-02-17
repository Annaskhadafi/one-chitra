import { getDashboardStats } from "@/app/actions/dashboard"
import { DashboardStatsCards } from "@/components/dashboard/dashboard-stats-cards"
import { DashboardSalesChart } from "@/components/dashboard/dashboard-sales-chart"
import { DashboardCategoryChart } from "@/components/dashboard/dashboard-category-chart"
import { DashboardRecentOrders } from "@/components/dashboard/dashboard-recent-orders"
import { DashboardStockAlerts } from "@/components/dashboard/dashboard-stock-alerts"

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {/* Header */}
        <div className="px-4 lg:px-6">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your business operations
          </p>
        </div>

        {/* KPI Cards */}
        <DashboardStatsCards stats={stats} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-7 lg:px-6">
          <div className="lg:col-span-4">
            <DashboardSalesChart data={stats.monthlySales} />
          </div>
          <div className="lg:col-span-3">
            <DashboardCategoryChart data={stats.categoryDistribution} />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
          <DashboardRecentOrders orders={stats.recentOrders} />
          <DashboardStockAlerts alerts={stats.stockAlerts} />
        </div>
      </div>
    </div>
  )
}