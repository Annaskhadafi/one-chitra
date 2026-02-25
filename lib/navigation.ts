import {
    Warehouse,
    Package,
    Database,
    Box,
    Truck,
    Home,
    CreditCard,
    ShoppingCart,
    ArrowRightLeft,
    ArrowDownToLine,
    BarChart3,
    LayoutGrid,
    Mail,
    AlertTriangle,
    ClipboardList,
    Lock,
    type LucideIcon
} from "lucide-react"

export type NavItem = {
    title: string
    url: string
    icon: LucideIcon
    resource: string // Used for permission checking (e.g. 'inventory:view')
    items?: {
        title: string
        url: string
        resource: string
    }[]
}

export type NavSection = {
    title: string
    items: NavItem[]
}

export const navigationConfig: NavSection[] = [
    {
        title: "Main",
        items: [
            {
                title: "Dashboard",
                url: "/dashboard",
                icon: Home,
                resource: "dashboard",
            },
            {
                title: "Portal",
                url: "/dashboard/portal",
                icon: LayoutGrid,
                resource: "portal-items",
            },
        ],
    },
    {
        title: "SCM Management",
        items: [
            {
                title: "Master Data & Umum",
                url: "#",
                icon: Database,
                resource: "master-data",
                items: [
                    {
                        title: "Products",
                        url: "/dashboard/products",
                        resource: "products",
                    },
                    {
                        title: "Warehouse",
                        url: "/dashboard/warehouse",
                        resource: "warehouses",
                    },
                ],
            },
            {
                title: "Inbound & Receiving",
                url: "#",
                icon: ArrowDownToLine,
                resource: "inbound",
                items: [
                    {
                        title: "Good Receive SAP",
                        url: "/dashboard/good-receive",
                        resource: "good-receive",
                    },
                    {
                        title: "Good Receive Manual",
                        url: "/dashboard/good-receive-manual",
                        resource: "good-receive-manual",
                    },
                ],
            },
            {
                title: "Outbound & Operations",
                url: "#",
                icon: Truck,
                resource: "outbound",
                items: [
                    {
                        title: "Sales Order",
                        url: "/dashboard/sales-orders",
                        resource: "sales-orders",
                    },
                    {
                        title: "Deliveries",
                        url: "/dashboard/deliveries",
                        resource: "deliveries",
                    },
                    {
                        title: "DO Monitoring",
                        url: "/dashboard/do-monitoring",
                        resource: "deliveries",
                    },
                    {
                        title: "Billing",
                        url: "/dashboard/billing",
                        resource: "billing",
                    },
                    {
                        title: "Fleet Management",
                        url: "/dashboard/fleet-management",
                        resource: "fleet-management",
                    },
                    {
                        title: "Stock Transfer",
                        url: "/dashboard/stock-transfers",
                        resource: "stock-transfers",
                    },
                ],
            },
            {
                title: "Inventory Control",
                url: "#",
                icon: Box,
                resource: "inventory-control",
                items: [
                    {
                        title: "Inventory",
                        url: "/dashboard/inventory",
                        resource: "inventory",
                    },
                    {
                        title: "Stocks",
                        url: "/dashboard/stocks",
                        resource: "stocks",
                    },
                    {
                        title: "Stock SAP",
                        url: "/dashboard/stocks-sap",
                        resource: "stocks-sap",
                    },
                    {
                        title: "Stock Opname",
                        url: "/dashboard/stock-opname",
                        resource: "stock-opname",
                    },
                    {
                        title: "Stock Movement Log",
                        url: "/dashboard/stock-movements",
                        resource: "stock-movements",
                    },
                    {
                        title: "Reorder Alerts",
                        url: "/dashboard/stock-alerts",
                        resource: "stock-alerts",
                    },
                ],
            },
            {
                title: "Logistics & Cost",
                url: "/dashboard/logistics-costs",
                icon: BarChart3,
                resource: "logistics-costs",
            },
        ],
    },
    {
        title: "Business & Analytics",
        items: [
            {
                title: "Sales & Marketing",
                url: "#",
                icon: ShoppingCart,
                resource: "sales-marketing",
                items: [
                    {
                        title: "Marketing Calendar",
                        url: "/dashboard/calendar",
                        resource: "calendar-events",
                    },
                    {
                        title: "Competitor Info New",
                        url: "/dashboard/competitor-info-new",
                        resource: "competitor-info-new",
                    },
                    {
                        title: "Segmentasi Customer",
                        url: "/dashboard/customer-segmentation",
                        resource: "customer-segmentation",
                    },
                    {
                        title: "Customers",
                        url: "/dashboard/customers",
                        resource: "customers",
                    },
                    {
                        title: "Price Management",
                        url: "/dashboard/price-management",
                        resource: "price-management",
                    },
                    {
                        title: "Quotations",
                        url: "/dashboard/quotations",
                        resource: "quotations",
                    },
                    {
                        title: "Sales Document",
                        url: "/dashboard/sales-documents",
                        resource: "sales-documents",
                    },
                    {
                        title: "Fleetlist",
                        url: "/dashboard/fleetlist",
                        resource: "fleetlist",
                    },
                    {
                        title: "History Order",
                        url: "/dashboard/history-order",
                        resource: "history-order",
                    },
                    {
                        title: "Master Data Forecast",
                        url: "/dashboard/forecasts",
                        resource: "forecast-management",
                    },
                ],
            },
            {
                title: "Reports & Analytics",
                url: "#",
                icon: BarChart3,
                resource: "reports-analytics",
                items: [
                    {
                        title: "Sales Dashboard",
                        url: "/dashboard/sales-dashboard",
                        resource: "sales-dashboard",
                    },
                    {
                        title: "Dashboard R49 Tire",
                        url: "/dashboard/r49-dashboard",
                        resource: "r49-dashboard",
                    },
                    {
                        title: "Revenue vs Forecast",
                        url: "/dashboard/revenue-forecast",
                        resource: "revenue-forecast",
                    },
                    {
                        title: "Reports Hub",
                        url: "/dashboard/reports",
                        resource: "reports",
                    },
                    {
                        title: "ABC Analysis",
                        url: "/dashboard/abc-analysis",
                        resource: "abc-analysis",
                    },
                ],
            },
        ],
    },
    {
        title: "System Management",
        items: [
            {
                title: "Security",
                url: "#",
                icon: Lock,
                resource: "security",
                items: [
                    {
                        title: "Security Overview",
                        url: "/dashboard/security",
                        resource: "security",
                    },
                    {
                        title: "User Management",
                        url: "/dashboard/security/users",
                        resource: "security",
                    },
                    {
                        title: "Roles & Permissions",
                        url: "/dashboard/security/roles",
                        resource: "security",
                    },
                    {
                        title: "Audit Logs",
                        url: "/dashboard/security/audit-logs",
                        resource: "security",
                    },
                    {
                        title: "Sessions",
                        url: "/dashboard/security/sessions",
                        resource: "security",
                    },
                ],
            },
            {
                title: "Admin",
                url: "#",
                icon: Mail,
                resource: "admin",
                items: [
                    {
                        title: "Navbar Settings",
                        url: "/dashboard/settings/navbar",
                        resource: "admin",
                    },
                    {
                        title: "Email Settings",
                        url: "/dashboard/settings/email",
                        resource: "email-settings",
                    },
                ],
            },
        ],
    },
]
