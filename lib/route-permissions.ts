export type DashboardRoutePermissionRule = {
    prefix: string
    resource: string | null
}

export const dashboardRoutePermissionRules: DashboardRoutePermissionRule[] = [
    { prefix: "/dashboard/account", resource: null },
    { prefix: "/dashboard/admin/users", resource: "users" },
    { prefix: "/dashboard/admin/roles", resource: "roles" },
    { prefix: "/dashboard/admin/operational-activity-log", resource: "admin" },
    { prefix: "/dashboard/chitra-knowledge", resource: "admin" },
    { prefix: "/dashboard/security/audit-logs", resource: "admin" },
    { prefix: "/dashboard/abc-analysis", resource: "abc-analysis" },
    { prefix: "/dashboard/approvals/matrix", resource: "approvals-matrix" },
    { prefix: "/dashboard/approvals", resource: "approvals-inbox" },
    { prefix: "/dashboard/billing", resource: "billing" },
    { prefix: "/dashboard/bundling", resource: "bundling" },
    { prefix: "/dashboard/calculator", resource: "bundling-calculator" },
    { prefix: "/dashboard/calendar", resource: "calendar-events" },
    { prefix: "/dashboard/competitor-info-new", resource: "marketing" },
    { prefix: "/dashboard/competitor-info", resource: "marketing" },
    { prefix: "/dashboard/cost-settlements", resource: "cost-settlements" },
    { prefix: "/dashboard/cost-fuel", resource: "delivery-cost-request" },
    { prefix: "/dashboard/cover-letter", resource: "cover-letter" },
    { prefix: "/dashboard/customer-segmentation", resource: "customer-segmentation" },
    { prefix: "/dashboard/customer-360", resource: "customers" },
    { prefix: "/dashboard/customers", resource: "customers" },
    { prefix: "/dashboard/debug-session", resource: "admin" },
    { prefix: "/dashboard/deliveries", resource: "deliveries" },
    { prefix: "/dashboard/delivery-planning-board", resource: "deliveries" },
    { prefix: "/dashboard/delivery-cost-request", resource: "delivery-cost-request" },
    { prefix: "/dashboard/do-monitoring", resource: "deliveries" },
    { prefix: "/dashboard/epr-integrasi", resource: "good-receive-manual" },
    { prefix: "/dashboard/evhs", resource: "evhs" },
    { prefix: "/dashboard/external-frame", resource: "admin" },
    { prefix: "/dashboard/fleet-management", resource: "fleet-management" },
    { prefix: "/dashboard/fleetlist", resource: "fleetlist" },
    { prefix: "/dashboard/forecasts", resource: "forecasts" },
    { prefix: "/dashboard/forms", resource: "forms-surveys" },
    { prefix: "/dashboard/good-receive-manual", resource: "good-receive-manual" },
    { prefix: "/dashboard/good-receive", resource: "good-receive" },
    { prefix: "/dashboard/harga-acuan-minerba", resource: "sales-documents" },
    { prefix: "/dashboard/history-order", resource: "history-order" },
    { prefix: "/dashboard/inventory-ml/settings", resource: "inventory" },
    { prefix: "/dashboard/inventory-ml", resource: "inventory" },
    { prefix: "/dashboard/inventory", resource: "inventory" },
    { prefix: "/dashboard/procurement-next", resource: "inventory" },
    { prefix: "/dashboard/logistics-costs", resource: "logistics-costs" },
    { prefix: "/dashboard/marketing/campaigns", resource: "marketing" },
    { prefix: "/dashboard/marketing/email-lists", resource: "marketing" },
    { prefix: "/dashboard/marketing/slow-moving", resource: "marketing" },
    { prefix: "/dashboard/portal", resource: "portal-items" },
    { prefix: "/dashboard/price-management", resource: "price-management" },
    { prefix: "/dashboard/products", resource: "products" },
    { prefix: "/dashboard/quotation-analysis", resource: "quotation-analysis" },
    { prefix: "/dashboard/quotations", resource: "quotations" },
    { prefix: "/dashboard/r49-dashboard", resource: "r49-dashboard" },
    { prefix: "/dashboard/reports", resource: "reports" },
    { prefix: "/dashboard/revenue-forecast", resource: "revenue-forecast" },
    { prefix: "/dashboard/revenue-ml", resource: "revenue-forecast" },
    { prefix: "/dashboard/sales-dashboard", resource: "sales-dashboard" },
    { prefix: "/dashboard/sales-documents", resource: "sales-documents" },
    { prefix: "/dashboard/sales-orders", resource: "sales-orders" },
    { prefix: "/dashboard/summary-order", resource: "sales-order-summary" },
    { prefix: "/dashboard/security", resource: "security" },
    { prefix: "/dashboard/settings/approvals", resource: "approvals-settings" },
    { prefix: "/dashboard/settings/email", resource: "email-settings" },
    { prefix: "/dashboard/settings/navbar", resource: "admin" },
    { prefix: "/dashboard/stock-alerts", resource: "stock-alerts" },
    { prefix: "/dashboard/stock-card", resource: "stocks" },
    { prefix: "/dashboard/stock-movements", resource: "stock-movements" },
    { prefix: "/dashboard/stock-opname-aktual", resource: "stock-opname-aktual" },
    { prefix: "/dashboard/stock-opname", resource: "stock-opname" },
    { prefix: "/dashboard/stock-transfers", resource: "stock-transfers" },
    { prefix: "/dashboard/stocks-sap-new", resource: "stocks-sap" },
    { prefix: "/dashboard/stocks-sap", resource: "stocks-sap" },
    { prefix: "/dashboard/stocks", resource: "stocks" },
    { prefix: "/dashboard/test-delivery-page", resource: "deliveries" },
    { prefix: "/dashboard/warehouse", resource: "warehouses" },
    { prefix: "/dashboard", resource: "dashboard" },
]

export function getDashboardRouteResource(pathname: string) {
    const normalizedPath = pathname.split("?")[0]?.split("#")[0] ?? pathname
    const matchedRule = [...dashboardRoutePermissionRules]
        .sort((left, right) => right.prefix.length - left.prefix.length)
        .find((rule) => normalizedPath === rule.prefix || normalizedPath.startsWith(`${rule.prefix}/`))

    return matchedRule?.resource ?? null
}

export function collectDashboardPermissionResources() {
    return Array.from(
        new Set(
            dashboardRoutePermissionRules
                .map((rule) => rule.resource)
                .filter((resource): resource is string => Boolean(resource))
        )
    )
}
