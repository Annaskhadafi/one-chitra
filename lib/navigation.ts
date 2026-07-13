import {
    Database,
    Box,
    Truck,
    Home,
    ShoppingCart,
    ArrowDownToLine,
    BarChart3,
    LayoutGrid,
    Mail,
    ClipboardList,
    Lock,
    Wrench,
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
                        title: "Product Bundling",
                        url: "/dashboard/bundling",
                        resource: "bundling",
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
                    {
                        title: "EPR Integrasi",
                        url: "/dashboard/epr-integrasi",
                        resource: "good-receive-manual",
                    },
                    {
                        title: "Database Quotation Vendor",
                        url: "/dashboard/vendor-quotations",
                        resource: "vendor-quotations",
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
                        title: "Delivery Planning Board",
                        url: "/dashboard/delivery-planning-board",
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
                    {
                        title: "E-VHS",
                        url: "/dashboard/evhs",
                        resource: "evhs",
                    },
                    {
                        title: "Serial Number History",
                        url: "/dashboard/serial-number-history",
                        resource: "serial-number-history",
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
                        title: "RFID",
                        url: "/dashboard/rfid",
                        resource: "rfid",
                    },
                    {
                        title: "Stock Card",
                        url: "/dashboard/stock-card",
                        resource: "stocks",
                    },
                    {
                        title: "Stock SAP New",
                        url: "/dashboard/stocks-sap-new",
                        resource: "stocks-sap",
                    },
                    {
                        title: "Stock Opname",
                        url: "/dashboard/stock-opname",
                        resource: "stock-opname",
                    },
                    {
                        title: "Stock Opname Aktual",
                        url: "/dashboard/stock-opname-aktual",
                        resource: "stock-opname-aktual",
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
                    {
                        title: "Dead Stock Analysis",
                        url: "/dashboard/inventory/dead-stock",
                        resource: "inventory",
                    },
                    {
                        title: "Dynamic Safety Stock",
                        url: "/dashboard/inventory-ml",
                        resource: "inventory",
                    },
                    {
                        title: "Procurement Next",
                        url: "/dashboard/procurement-next",
                        resource: "inventory",
                    },
                    {
                        title: "Vendor Delivery Setup",
                        url: "/dashboard/inventory-ml/vendors",
                        resource: "inventory",
                    },
                ],
            },
            {
                title: "Logistics & Cost",
                url: "#",
                icon: BarChart3,
                resource: "logistics-costs",
                items: [
                    {
                        title: "Logistics Cost Log",
                        url: "/dashboard/logistics-costs",
                        resource: "logistics-costs",
                    },
                    {
                        title: "Master Price Delivery",
                        url: "/dashboard/logistics-costs/master-price",
                        resource: "logistics-costs",
                    },
                    {
                        title: "Request Cost Delivery",
                        url: "/dashboard/delivery-cost-request",
                        resource: "delivery-cost-request",
                    },
                    {
                        title: "Cost Fuel",
                        url: "/dashboard/cost-fuel",
                        resource: "delivery-cost-request",
                    },
                ],
            },
        ],
    },
    {
        title: "Business & Analytics",
        items: [
            {
                title: "Marketing",
                url: "#",
                icon: LayoutGrid,
                resource: "marketing",
                items: [
                    {
                        title: "Customer History Tire",
                        url: "/dashboard/marketing/customer-tire-history",
                        resource: "marketing",
                    },
                    {
                        title: "Campaign Manager",
                        url: "/dashboard/marketing/campaigns",
                        resource: "marketing",
                    },
                    {
                        title: "Instagram Generator",
                        url: "/dashboard/marketing/instagram-generator",
                        resource: "marketing",
                    },
                    {
                        title: "Contact & Grup Email",
                        url: "/dashboard/marketing/email-lists",
                        resource: "marketing",
                    },
                    {
                        title: "Slow Moving",
                        url: "/dashboard/marketing/slow-moving",
                        resource: "marketing",
                    },
                    {
                        title: "P&L Monitoring",
                        url: "/dashboard/marketing/pnl-monitoring",
                        resource: "marketing",
                    },
                    {
                        title: "A2R Competition",
                        url: "/dashboard/sales-dashboard/a2r-competition",
                        resource: "sales-dashboard",
                    },
                    {
                        title: "Marketing Calendar",
                        url: "/dashboard/calendar",
                        resource: "calendar-events",
                    },
                    {
                        title: "Form & Survey Builder",
                        url: "/dashboard/forms",
                        resource: "forms-surveys",
                    },
                ],
            },
            {
                title: "Sales",
                url: "#",
                icon: ShoppingCart,
                resource: "sales",
                items: [
                    {
                        title: "Quotations",
                        url: "/dashboard/quotations",
                        resource: "quotations",
                    },
                    {
                        title: "Sales Dashboard",
                        url: "/dashboard/sales-dashboard",
                        resource: "sales-dashboard",
                    },
                    {
                        title: "GP Campign",
                        url: "/dashboard/campaigns",
                        resource: "campaigns",
                    },
                    {
                        title: "Competitor",
                        url: "/dashboard/competitor-info-new",
                        resource: "competitor-info-new",
                    },
                    {
                        title: "Top 15 Customer",
                        url: "/dashboard/top-customers",
                        resource: "sales-dashboard",
                    },
                    {
                        title: "Form Competitor",
                        url: "/dashboard/competitor-form",
                        resource: "competitor-info-new",
                    },
                    {
                        title: "Tire Performance",
                        url: "/dashboard/tire-performance",
                        resource: "sales-dashboard",
                    },
                    {
                        title: "Sales Order Summary",
                        url: "/dashboard/summary-order",
                        resource: "sales-order-summary",
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
                        title: "Customer 360 Workspace",
                        url: "/dashboard/customer-360",
                        resource: "customers",
                    },
                    {
                        title: "Customer Segmentasi",
                        url: "/dashboard/customer-segmentation",
                        resource: "customer-segmentation",
                    },
                    {
                        title: "Customer Industry Mapping",
                        url: "/dashboard/customer-industry",
                        resource: "customer-segmentation",
                    },
                    {
                        title: "Harga Acuan Minerba",
                        url: "/dashboard/harga-acuan-minerba",
                        resource: "sales-documents",
                    },
                    {
                        title: "Business Card Scanner",
                        url: "/dashboard/business-cards",
                        resource: "business-cards",
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
                        title: "Dashboard R49 Tire",
                        url: "/dashboard/r49-dashboard",
                        resource: "r49-dashboard",
                    },
                    {
                        title: "Sales Revenue",
                        url: "/dashboard/revenue-forecast",
                        resource: "revenue-forecast",
                    },
                    {
                        title: "ML Revenue Forecast",
                        url: "/dashboard/revenue-ml",
                        resource: "revenue-forecast",
                    },
                    {
                        title: "RMI & Kurs Quarterly",
                        url: "/dashboard/rmi",
                        resource: "rmi-dashboard",
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
                    {
                        title: "Quotation Analysis",
                        url: "/dashboard/quotation-analysis",
                        resource: "quotation-analysis",
                    },
                ],
            },
        ],
    },
    {
        title: "Central Services",
        items: [
            {
                title: "WIP Repair",
                url: "#",
                icon: Wrench,
                resource: "wip-repair",
                items: [
                    {
                        title: "WIP Dashboard",
                        url: "/dashboard/wip-repair/dashboard",
                        resource: "wip-repair",
                    },
                    {
                        title: "WIP Repair Table",
                        url: "/dashboard/wip-repair",
                        resource: "wip-repair",
                    },
                    {
                        title: "Master Barang Repair",
                        url: "/dashboard/master-barang-repair",
                        resource: "products",
                    },
                ],
            },
        ],
    },
    {
        title: "Approval",
        items: [
            {
                title: "Approval",
                url: "#",
                icon: ClipboardList,
                resource: "approvals",
                items: [
                    {
                        title: "Approval Inbox",
                        url: "/dashboard/approvals",
                        resource: "approvals-inbox",
                    },
                    {
                        title: "Approval Settings",
                        url: "/dashboard/settings/approvals",
                        resource: "approvals-settings",
                    },
                    {
                        title: "Matrix Approval",
                        url: "/dashboard/approvals/matrix",
                        resource: "approvals-matrix",
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
                        title: "Sessions",
                        url: "/dashboard/security/sessions",
                        resource: "security",
                    },
                ],
            },
            {
                title: "Integration & Sync",
                url: "#",
                icon: Database,
                resource: "admin",
                items: [
                    {
                        title: "SAP Stock Feed (Live API)",
                        url: "/dashboard/stocks-sap",
                        resource: "stocks-sap",
                    },
                    {
                        title: "SAP Sync Report",
                        url: "/dashboard/reports/sap",
                        resource: "reports",
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
                        title: "Knowledge Chitra Jenius",
                        url: "/dashboard/chitra-knowledge",
                        resource: "admin",
                    },
                    {
                        title: "Operational Activity Log",
                        url: "/dashboard/admin/operational-activity-log",
                        resource: "admin",
                    },
                ],
            },
        ],
    },
]


