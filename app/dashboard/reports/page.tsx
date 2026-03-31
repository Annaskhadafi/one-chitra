import { getDashboardStats } from "@/lib/server/dashboard-overview"
import { ReportsHubClient } from "./reports-hub-client"

function clamp(value: number, min = 0, max = 100) {
    return Math.min(Math.max(value, min), max)
}

export default async function ReportsHubPage() {
    const dashboardStats = await getDashboardStats()
    const salesValues = dashboardStats.monthlySales.map((item) => item.value)
    const latestSales = salesValues.at(-1) ?? 0
    const previousSales = salesValues.at(-2) ?? 0
    const totalRevenue = salesValues.reduce((sum, value) => sum + value, 0)
    const averageSales = salesValues.length > 0 ? totalRevenue / salesValues.length : 0
    const salesMomentum = previousSales > 0 ? ((latestSales - previousSales) / previousSales) * 100 : 0
    const stockRisk = dashboardStats.totalProducts > 0 ? (dashboardStats.lowStockItems / dashboardStats.totalProducts) * 100 : 0
    const deliveryPressure = dashboardStats.totalSalesOrders > 0 ? (dashboardStats.pendingDeliveries / dashboardStats.totalSalesOrders) * 100 : 0
    const approvalRate = dashboardStats.totalQuotations > 0 ? (dashboardStats.approvedQuotations / dashboardStats.totalQuotations) * 100 : 0
    const quotationPipeline = dashboardStats.totalQuotations > 0 ? (dashboardStats.pendingQuotations / dashboardStats.totalQuotations) * 100 : 0
    const topCategory = dashboardStats.categoryDistribution[0]
    const totalCategoryCount = dashboardStats.categoryDistribution.reduce((sum, item) => sum + item.count, 0)
    const topCategoryShare = topCategory && totalCategoryCount > 0 ? (topCategory.count / totalCategoryCount) * 100 : 0

    const revenueScore = latestSales > 0 && averageSales > 0
        ? clamp((latestSales / averageSales) * 60 + (salesMomentum > 0 ? 25 : 10))
        : 38
    const serviceScore = clamp(100 - deliveryPressure * 1.8)
    const inventoryScore = clamp(100 - stockRisk * 3)
    const commercialScore = clamp(approvalRate * 0.7 + (dashboardStats.totalCustomers > 0 ? 25 : 0))

    return (
        <ReportsHubClient
            metrics={{
                totalRevenue,
                totalCustomers: dashboardStats.totalCustomers,
                totalSalesOrders: dashboardStats.totalSalesOrders,
                lowStockItems: dashboardStats.lowStockItems,
                totalProducts: dashboardStats.totalProducts,
                pendingDeliveries: dashboardStats.pendingDeliveries,
                pendingQuotations: dashboardStats.pendingQuotations,
                approvalRate,
                quotationPipeline,
                salesMomentum,
                stockRisk,
                deliveryPressure,
                topCategoryShare,
                topCategoryName: topCategory?.category ?? null,
                latestSales,
                averageSales,
                revenueScore,
                serviceScore,
                inventoryScore,
                commercialScore,
            }}
            salesSeries={dashboardStats.monthlySales.map((item) => ({
                month: item.month,
                value: item.value,
            }))}
            categorySeries={dashboardStats.categoryDistribution.map((item) => ({
                category: item.category,
                count: item.count,
            }))}
            recentOrders={dashboardStats.recentOrders.map((order) => ({
                id: order.id,
                invoiceNumber: order.invoiceNumber,
                customerName: order.customerName,
                salesDate: order.salesDate.toISOString(),
                status: order.status,
                totalValue: order.totalValue,
            }))}
            stockAlerts={dashboardStats.stockAlerts.map((item) => ({
                productName: item.productName,
                materialNumber: item.materialNumber,
                warehouseName: item.warehouseName,
                currentStock: item.currentStock,
                minStock: item.minStock,
            }))}
        />
    )
}
