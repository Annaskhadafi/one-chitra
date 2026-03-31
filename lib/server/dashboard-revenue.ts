import { getAuthenticatedSession } from "@/lib/rbac"
import type { DashboardRevenueFilters } from "@/app/actions/dashboard-revenue-logic"
import {
  fetchAllSalesRevenueData,
  fetchDashboardInventory,
  fetchDashboardRevenueForecast,
} from "@/app/actions/dashboard-revenue-logic"

export async function getDashboardRevenueForecastData(filters: DashboardRevenueFilters) {
  try {
    await getAuthenticatedSession("revenue-forecast", "view")
    return await fetchDashboardRevenueForecast(filters)
  } catch (error) {
    console.error("Failed to fetch dashboard revenue forecast:", error)
    return { success: false, error: "Failed to fetch dashboard data" }
  }
}

export async function getAllSalesRevenueDataForPage(filters: DashboardRevenueFilters) {
  try {
    await getAuthenticatedSession("revenue-forecast", "view")
    return await fetchAllSalesRevenueData(filters)
  } catch (error) {
    console.error("Failed to fetch all sales revenue data:", error)
    return { success: false, error: "Failed to fetch sales revenue data" }
  }
}

export async function getDashboardInventoryData() {
  try {
    await getAuthenticatedSession("revenue-forecast", "view")
    return await fetchDashboardInventory()
  } catch (error) {
    console.error("Failed to fetch dashboard inventory:", error)
    return { success: false, error: "Failed to fetch dashboard inventory" }
  }
}
