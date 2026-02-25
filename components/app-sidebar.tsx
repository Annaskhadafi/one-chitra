"use client"

import * as React from "react"
import Image from "next/image"
import logo from "@/public/logo.png"

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
import { usePermissions } from "@/hooks/use-permissions"
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
    const { hasResourcePermission } = usePermissions()
    const { navigationSections, ...sidebarProps } = props

    const filteredConfig = navigationSections.map(section => ({
        ...section,
        items: section.items
            .map(item => {
                if (item.hidden) {
                    return null
                }

                if (item.items && item.items.length > 0) {
                    const filteredSubItems = item.items.filter(subItem => {
                        if (subItem.hidden) {
                            return false
                        }

                        if (!subItem.resource) {
                            return true
                        }

                        return hasResourcePermission(subItem.resource, 'view')
                    })

                    return {
                        ...item,
                        items: filteredSubItems,
                    }
                }

                return item
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .filter(item => {
                if (item.items && item.items.length > 0) {
                    return true
                }

                if (item.url === "#") {
                    return false
                }

                if (!item.resource) {
                    return true
                }

                return hasResourcePermission(item.resource, 'view')
            })
    })).filter(section => section.items.length > 0)

    const sidebarConfig = filteredConfig.map((section) => ({
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
            <SidebarHeader>
                <div className="flex items-center gap-2 px-4 py-2 text-sidebar-foreground">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white shadow-md overflow-hidden border border-white/10 dark:bg-white">
                        <Image
                            src={logo}
                            alt="One Chitra Logo"
                            width={32}
                            height={32}
                            className="object-contain p-1"
                        />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">One Chitra</span>
                        <span className="truncate text-xs">All In One Apps Chitra Paratama</span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                {sidebarConfig.map((section, index) => (
                    <React.Fragment key={section.title || index}>
                        {/* Don't show separator/title for the very first section if it's "Main" or similar generic */}
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
                ))}
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={currentUser} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
