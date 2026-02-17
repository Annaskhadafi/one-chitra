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
        title: "Supply Chain",
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
                title: "Stock SAP",
                url: "/dashboard/stocks-sap",
                icon: Database,
                resource: "stocks-sap",
            },
            {
                title: "Good Receive",
                url: "/dashboard/good-receive",
                icon: ArrowDownToLine,
                resource: "good-receive",
            },
            {
                title: "Stocks",
                url: "/dashboard/stocks",
                icon: Box,
                resource: "stocks",
            },
            {
                title: "Warehouse",
                url: "/dashboard/warehouse",
                icon: Warehouse,
                resource: "warehouses",
            },
            {
                title: "Stock Transfer",
                url: "/dashboard/stock-transfers",
                icon: ArrowRightLeft,
                resource: "stock-transfers",
            },
            {
                title: "Deliveries",
                url: "/dashboard/deliveries",
                icon: Truck,
                resource: "deliveries",
            },
        ],
    },
    {
        title: "Sales & Distribution",
        items: [
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
            {
                title: "Sales Order",
                url: "/dashboard/sales-orders",
                icon: ShoppingCart,
                resource: "sales-orders",
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
