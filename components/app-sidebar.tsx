"use client"

import * as React from "react"
import {
    CheckIcon,
    ChevronDown,
    ChevronRight,
    Search,
    LayoutDashboard,
    Warehouse,
    Package,
    Database,
    Users,
    Box,
    FileText,
    Truck,
    Receipt,
    History,
    Settings,
    Home,
    CreditCard,
    Shield,
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
    const mainNavItems = [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: Home,
            resource: null, // Always visible
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
            title: "Stocks",
            url: "/dashboard/stocks",
            icon: Box,
            resource: null,
        },
        {
            title: "Customers",
            url: "/dashboard/customers",
            icon: Users,
            resource: null,
        },
        {
            title: "Products",
            url: "/dashboard/products",
            icon: Package,
            resource: null,
        },
        {
            title: "Quotations",
            url: "/dashboard/quotations",
            icon: FileText,
            resource: "quotations",
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
        {
            title: "Warehouse",
            url: "/dashboard/warehouse",
            icon: Warehouse,
            resource: null, // Make visible to all
        },
    ]

    const adminNavItems = [
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
    ]

    // Filter logic
    // Check if user has explicit 'resource:view' OR 'admin:view'
    const hasPermission = (resource: string | null) => {
        if (!resource) return true
        return permissions.includes(`${resource}:view`) || permissions.includes("admin:view")
    }

    const filteredMain = mainNavItems.filter(item => hasPermission(item.resource))
    const filteredAdmin = adminNavItems.filter(item => hasPermission(item.resource))

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
                <NavMain items={filteredMain} />

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
