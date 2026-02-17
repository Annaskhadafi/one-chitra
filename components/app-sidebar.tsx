"use client"

import * as React from "react"
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
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
    SidebarSeparator,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    permissions?: string[]
    user?: {
        name: string
        email: string
        avatar: string
    }
}

export function AppSidebar({ permissions = [], user, ...props }: AppSidebarProps) {
    // Navigation items with resource mapping
    const dashboardItems = [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: Home,
            resource: null, // Always visible
        },
    ]

    const supplyChainItems = [
        {
            title: "Products",
            url: "/dashboard/products",
            icon: Package,
            resource: null,
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
            resource: null,
        },
        {
            title: "Good Receive",
            url: "/dashboard/good-receive",
            icon: ArrowDownToLine,
            resource: null,
        },
        {
            title: "Stocks",
            url: "/dashboard/stocks",
            icon: Box,
            resource: null,
        },
        {
            title: "Warehouse",
            url: "/dashboard/warehouse",
            icon: Warehouse,
            resource: null, // Make visible to all
        },
        {
            title: "Stock Transfer",
            url: "/dashboard/stock-transfers",
            icon: ArrowRightLeft,
            resource: null,
        },
        {
            title: "Deliveries",
            url: "/dashboard/deliveries",
            icon: Truck,
            resource: null,
        },
    ]

    const salesItems = [
        {
            title: "Customers",
            url: "/dashboard/customers",
            icon: Users,
            resource: null,
        },
        {
            title: "Quotations",
            url: "/dashboard/quotations",
            icon: FileText,
            resource: null,
        },
        {
            title: "Sales Order",
            url: "/dashboard/sales-orders",
            icon: ShoppingCart,
            resource: null,
        },
        {
            title: "Billing",
            url: "/dashboard/billing",
            icon: CreditCard,
            resource: "billing",
        },
    ]

    const adminItems = [
        {
            title: "User Management",
            url: "/dashboard/admin/users",
            icon: Users,
            resource: null,
        },
        {
            title: "Role Management",
            url: "/dashboard/admin/roles",
            icon: Shield,
            resource: null,
        },
    ]

    // Filter logic
    // Check if user has explicit 'resource:view' OR 'admin:view'
    const hasPermission = (resource: string | null) => {
        if (!resource) return true
        return permissions.includes(`${resource}:view`) || permissions.includes("admin:view")
    }

    const filteredDashboard = dashboardItems.filter(item => hasPermission(item.resource))
    const filteredSupplyChain = supplyChainItems.filter(item => hasPermission(item.resource))
    const filteredSales = salesItems.filter(item => hasPermission(item.resource))
    const filteredAdmin = adminItems.filter(item => hasPermission(item.resource))

    // Fallback user if not provided (though layout should provide it)
    const currentUser = user || {
        name: "User",
        email: "user@example.com",
        avatar: "",
    }

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <div className="flex items-center gap-2 px-4 py-2 text-sidebar-foreground">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                        <Package className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">One Chitra</span>
                        <span className="truncate text-xs">Management System</span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={filteredDashboard} />

                {filteredSupplyChain.length > 0 && (
                    <>
                        <SidebarSeparator className="mx-2" />
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Supply Chain
                        </div>
                        <NavMain items={filteredSupplyChain} />
                    </>
                )}

                {filteredSales.length > 0 && (
                    <>
                        <SidebarSeparator className="mx-2" />
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Sales & Distribution
                        </div>
                        <NavMain items={filteredSales} />
                    </>
                )}

                {filteredAdmin.length > 0 && (
                    <>
                        <SidebarSeparator className="mx-2" />
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Admin
                        </div>
                        <NavMain items={filteredAdmin} />
                    </>
                )}
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={currentUser} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
