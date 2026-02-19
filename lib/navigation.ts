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
            {
                title: "Competitor Info",
                url: "/dashboard/competitor-info",
                icon: TrendingUp,
                resource: "competitor-info",
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
                title: "Quotations",
                url: "/dashboard/quotations",
                icon: FileText,
                resource: "quotations",
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
        ],
    },
]
