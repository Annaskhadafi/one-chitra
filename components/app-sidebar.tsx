"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuSkeleton,
    SidebarRail,
    SidebarSeparator,
} from "@/components/ui/sidebar"
import { getIconByName, type RuntimeNavSection } from "../lib/navigation-menu"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    permissions?: string[]
    navigationSections: RuntimeNavSection[]
    user?: {
        name: string
        email: string
        avatar: string
    }
}

export function AppSidebar({ permissions: _perms = [], user, ...props }: AppSidebarProps) {
    const { navigationSections, ...sidebarProps } = props
    const [isHydrated, setIsHydrated] = React.useState(false)

    React.useEffect(() => {
        setIsHydrated(true)
    }, [])

    const sidebarConfig = navigationSections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
            ...item,
            icon: getIconByName(item.iconName ?? "Circle"),
        })),
    }))

    // Fallback user if not provided (though layout should provide it)
    const currentUser = user || {
        name: "User",
        email: "user@example.com",
        avatar: "",
    }

    return (
        <Sidebar
            {...sidebarProps}
            collapsible="icon"
            style={{
                ...sidebarProps.style,
                fontFamily: "var(--font-parkinsans), var(--font-geist-sans), sans-serif",
            }}
        >
            <SidebarContent>
                {isHydrated
                    ? sidebarConfig.map((section, index) => (
                        <React.Fragment key={section.title || index}>
                            {index > 0 && (
                                <>
                                    <SidebarSeparator className="mx-2" />
                                    <div
                                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: "var(--app-navbar-section-color)" }}
                                        suppressHydrationWarning
                                    >
                                        {section.title}
                                    </div>
                                </>
                            )}
                            <NavMain items={section.items} />
                        </React.Fragment>
                    ))
                    : sidebarConfig.map((section, index) => (
                        <React.Fragment key={`skeleton-${section.title || index}`}>
                            {index > 0 && (
                                <>
                                    <SidebarSeparator className="mx-2" />
                                    <div
                                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: "var(--app-navbar-section-color)" }}
                                        suppressHydrationWarning
                                    >
                                        {section.title}
                                    </div>
                                </>
                            )}
                            <SidebarGroup>
                                <SidebarGroupContent className="flex flex-col gap-1">
                                    <SidebarMenu className="px-1">
                                        {Array.from({ length: Math.min(Math.max(section.items.length, 1), 2) }).map((_, itemIndex) => (
                                            <SidebarMenuSkeleton key={`menu-skeleton-${section.title || index}-${itemIndex}`} showIcon />
                                        ))}
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </SidebarGroup>
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
