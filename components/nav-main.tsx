"use client"
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { ChevronRight, type LucideIcon } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

interface NavItem {
  id?: string
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  openInNewTab?: boolean
  items?: {
    id?: string
    title: string
    url: string
    resource?: string
    openInNewTab?: boolean
  }[]
}

function CollapsedNavSubmenu({
  item,
  isActive,
  pathname,
}: {
  item: NavItem
  isActive: boolean
  pathname: string
}) {
  return (
    <HoverCard openDelay={80} closeDelay={120}>
      <SidebarMenuItem>
        <HoverCardTrigger asChild>
          <SidebarMenuButton isActive={isActive}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto group-data-[collapsible=icon]:hidden" />
          </SidebarMenuButton>
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={10}
          className="w-64 p-2"
        >
          <div className="px-2 py-1.5 text-sm font-semibold">{item.title}</div>
          <div className="mt-1 flex flex-col gap-1">
            {item.items?.map((subItem, subIndex) => (
              <Link
                key={subItem.id ?? `${subItem.title}-${subItem.url}-${subIndex}`}
                href={subItem.url}
                target={subItem.openInNewTab ? "_blank" : undefined}
                rel={subItem.openInNewTab ? "noopener noreferrer" : undefined}
                className={cn(
                  "flex min-h-9 items-center rounded-md px-3 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  pathname === subItem.url && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                )}
              >
                <span className="truncate">{subItem.title}</span>
              </Link>
            ))}
          </div>
        </HoverCardContent>
      </SidebarMenuItem>
    </HoverCard>
  )
}

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === "collapsed" && !isMobile

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-1">
        <SidebarMenu className="px-1">
          {items.map((item, itemIndex) => {
            const hasChildren = item.items && item.items.length > 0;
            const isChildActive = hasChildren && item.items?.some(child => pathname === child.url);
            const isActive = pathname === item.url || isChildActive;

            if (hasChildren) {
              if (isCollapsed) {
                return (
                  <CollapsedNavSubmenu
                    key={item.id ?? `${item.title}-${item.url}-${itemIndex}`}
                    item={item}
                    isActive={Boolean(isActive)}
                    pathname={pathname}
                  />
                )
              }

              return (
                <Collapsible
                  key={item.id ?? `${item.title}-${item.url}-${itemIndex}`}
                  asChild
                  defaultOpen={false}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isActive}
                      >
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem, subIndex) => (
                          <SidebarMenuSubItem key={subItem.id ?? `${subItem.title}-${subItem.url}-${subIndex}`}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === subItem.url}
                              className="ml-2"
                            >
                              <Link
                                href={subItem.url}
                                target={subItem.openInNewTab ? "_blank" : undefined}
                                rel={subItem.openInNewTab ? "noopener noreferrer" : undefined}
                              >
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            }

            return (
              <SidebarMenuItem key={item.id ?? `${item.title}-${item.url}-${itemIndex}`}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={pathname === item.url}
                >
                  <Link
                    href={item.url}
                    target={item.openInNewTab ? "_blank" : undefined}
                    rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
