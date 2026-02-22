import {
    Warehouse,
    Package,
    Database,
    Users,
    Box,
    FileText,
    Truck,
    Home,
    CreditCard,
    Shield,
    ShoppingCart,
    ArrowRightLeft,
    ArrowDownToLine,
    TrendingUp,
    History,
    UsersRound,
    BarChart3,
    LayoutGrid,
    Mail,
    AlertTriangle,
    ClipboardList,
    Activity,
    Tags,
    type LucideIcon
} from "lucide-react"

export type NavItem = {
    title: string
    url: string
    icon: LucideIcon
    resource: string // Used for permission checking (e.g. 'inventory:view')
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
                title: "Products",
                url: "/dashboard/products",
                icon: Package,
                resource: "products",
            },
            {
                title: "Inventory",
                url: "/dashboard/inventory",
                icon: Box,
                resource: "inventory",
            },
            {
                title: "Stocks",
                url: "/dashboard/stocks",
                icon: Box,
                resource: "stocks",
            },
            {
                title: "Stock SAP",
                url: "/dashboard/stocks-sap",
                icon: Database,
                resource: "stocks-sap",
            },
            {
                title: "Warehouse",
                url: "/dashboard/warehouse",
                icon: Warehouse,
                resource: "warehouses",
            },
            {
                title: "Good Receive Manual",
                url: "/dashboard/good-receive-manual",
                icon: ArrowDownToLine,
                resource: "good-receive-manual",
            },
            {
                title: "Good Receive SAP",
                url: "/dashboard/good-receive",
                icon: ArrowDownToLine,
                resource: "good-receive",
            },
            {
                title: "Stock Transfer",
                url: "/dashboard/stock-transfers",
                icon: ArrowRightLeft,
                resource: "stock-transfers",
            },
            {
                title: "Sales Order",
                url: "/dashboard/sales-orders",
                icon: ShoppingCart,
                resource: "sales-orders",
            },
            {
                title: "Deliveries",
                url: "/dashboard/deliveries",
                icon: Truck,
                resource: "deliveries",
            },
            {
                title: "DO Monitoring",
                url: "/dashboard/do-monitoring",
                icon: FileText,
                resource: "deliveries",
            },
            {
                title: "Stock Movement Log",
                url: "/dashboard/stock-movements",
                icon: History,
                resource: "stock-movements",
            },
            {
                title: "Reorder Alerts",
                url: "/dashboard/stock-alerts",
                icon: AlertTriangle,
                resource: "stock-alerts",
            },
            {
                title: "Stock Opname",
                url: "/dashboard/stock-opname",
                icon: ClipboardList,
                resource: "stock-opname",
            },
            {
                title: "Fleet Management",
                url: "/dashboard/fleet-management",
                icon: Truck,
                resource: "fleet-management",
            },
            {
                title: "Billing",
                url: "/dashboard/billing",
                icon: CreditCard,
                resource: "billing",
            },
        ],
    },
    {
        title: "Sales & marketing Operation",
        items: [
            {
                title: "Fleetlist",
                url: "/dashboard/fleetlist",
                icon: Truck,
                resource: "fleetlist",
            },
            /*
                        {
                            title: "Competitor Info",
                            url: "/dashboard/competitor-info",
                            icon: TrendingUp,
                            resource: "competitor-info",
                        },
            */
            {
                title: "Competitor Info New",
                url: "/dashboard/competitor-info-new",
                icon: TrendingUp,
                resource: "competitor-info-new",
            },
            {
                title: "History Order",
                url: "/dashboard/history-order",
                icon: History,
                resource: "history-order",
            },
            {
                title: "Segmentasi Customer",
                url: "/dashboard/customer-segmentation",
                icon: UsersRound,
                resource: "customer-segmentation",
            },
            {
                title: "Customers",
                url: "/dashboard/customers",
                icon: Users,
                resource: "customers",
            },
            {
                title: "Price Management",
                url: "/dashboard/price-management",
                icon: Tags,
                resource: "price-management",
            },
            {
                title: "Quotations",
                url: "/dashboard/quotations",
                icon: FileText,
                resource: "quotations",
            },
            {
                title: "Sales Document",
                url: "/dashboard/sales-documents",
                icon: FileText,
                resource: "sales-documents",
            },
        ],
    },
    {
        title: "Reports & Analytics",
        items: [
            {
                title: "Sales Dashboard",
                url: "/dashboard/sales-dashboard",
                icon: BarChart3,
                resource: "sales-dashboard",
            },
            {
                title: "Dashboard R49 Tire",
                url: "/dashboard/r49-dashboard",
                icon: BarChart3,
                resource: "r49-dashboard",
            },
            {
                title: "Reports Hub",
                url: "/dashboard/reports",
                icon: BarChart3,
                resource: "reports",
            },
            {
                title: "ABC Analysis",
                url: "/dashboard/abc-analysis",
                icon: Activity,
                resource: "abc-analysis",
            },
        ],
    },
    {
        title: "Admin",
        items: [
            {
                title: "User Management",
                url: "/dashboard/admin/users",
                icon: Users,
                resource: "users",
            },
            {
                title: "Role Management",
                url: "/dashboard/admin/roles",
                icon: Shield,
                resource: "roles",
            },
            {
                title: "Email Settings",
                url: "/dashboard/settings/email",
                icon: Mail,
                resource: "email-settings",
            },
        ],
    },
]
