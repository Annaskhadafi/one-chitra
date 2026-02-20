"use client"

import * as React from "react"
import { Package } from "lucide-react"

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
import { navigationConfig } from "@/lib/navigation"
import { usePermissions } from "@/hooks/use-permissions"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    permissions?: string[]
    user?: {
        name: string
        email: string
        avatar: string
    }
}

export function AppSidebar({ permissions: _perms = [], user, ...props }: AppSidebarProps) {
    const { hasResourcePermission } = usePermissions()

    // Filter logic
    const filteredConfig = navigationConfig.map(section => ({
        ...section,
        items: section.items.filter(item => hasResourcePermission(item.resource, 'view'))
    })).filter(section => section.items.length > 0)

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
                        <span className="truncate text-xs">All In One Apps Chitra Paratama</span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                {filteredConfig.map((section, index) => (
                    <React.Fragment key={section.title || index}>
                        {/* Don't show separator/title for the very first section if it's "Main" or similar generic */}
                        {index > 0 && (
                            <>
                                <SidebarSeparator className="mx-2" />
                                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {section.title}
                                </div>
                            </>
                        )}
                        <NavMain items={section.items} />
                    </React.Fragment>
                ))}
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={currentUser} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
