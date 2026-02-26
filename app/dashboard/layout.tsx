import { cookies } from "next/headers"
import { db } from "@/db"
import { redirect } from "next/navigation"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"

import "@/app/dashboard/theme.css"

import { auth } from "@/lib/auth"
import { getPermissionsByRoleName } from "@/lib/rbac"
import { headers } from "next/headers"
import { PermissionsProvider } from "@/hooks/use-permissions"
import { getNavbarTheme } from "@/lib/navbar-theme"
import { getNavbarMenuSettingsAction } from "@/app/actions/navbar-menu"
import { toRuntimeNavigationConfig, type RuntimeNavSection } from "@/lib/navigation-menu"

// ... imports

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

  // Fetch session server-side
  const session = await auth.api.getSession({
    headers: await headers()
  })

  // Redirect unauthenticated users (defense-in-depth — middleware also handles this)
  if (!session?.user?.id) {
    redirect("/sign-in")
  }

  // Fetch permissions based on role
  let permissions: string[] = []
  let roleLower = ""
  const [navbarTheme, navbarMenuSettings] = await Promise.all([
    getNavbarTheme(),
    getNavbarMenuSettingsAction(),
  ])
  const runtimeNavigationSections = toRuntimeNavigationConfig(navbarMenuSettings)

  const user = session?.user as {
    name: string;
    email: string;
    image?: string | null;
  } | undefined

  if (session?.user?.id) {
    // Fetch user from DB to get the latest role
    const dbUser = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, session.user.id),
    })

    if (dbUser?.role) {
      permissions = await getPermissionsByRoleName(dbUser.role)
      roleLower = dbUser.role.toLowerCase()
      if (roleLower === 'admin' || roleLower === 'superuser') {
        permissions.push('admin:view')
      }
    }
  }

  const isAdminRole = roleLower === 'admin' || roleLower === 'superuser'
  const canViewResource = (resource?: string, url?: string) => {
    if (isAdminRole) {
      return true
    }
    if (url === "/dashboard/approvals") {
      return true
    }
    if (!resource) {
      return true
    }
    return permissions.includes(`${resource}:view`)
  }

  const navigationSections: RuntimeNavSection[] = runtimeNavigationSections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.hidden)
        .map((item) => ({
          ...item,
          items: (item.items ?? []).filter((subItem) => !subItem.hidden && canViewResource(subItem.resource, subItem.url)),
        }))
        .filter((item) => {
          const hasChildren = (item.items?.length ?? 0) > 0
          if (hasChildren) {
            return true
          }
          if (item.url === '#') {
            return false
          }
          return canViewResource(item.resource, item.url)
        }),
    }))
    .filter((section) => section.items.length > 0)

  const navigationSectionsWithStockSapNew: RuntimeNavSection[] = navigationSections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.resource !== "inventory-control") {
        return item
      }

      const subItems = item.items ?? []
      const hasStockSapNew = subItems.some((subItem) => subItem.url === "/dashboard/stocks-sap-new")
      const hasStockSapOld = subItems.some((subItem) => subItem.url === "/dashboard/stocks-sap")

      let normalizedSubItems = subItems

      if (!hasStockSapNew && hasStockSapOld) {
        normalizedSubItems = subItems.map((subItem) =>
          subItem.url === "/dashboard/stocks-sap"
            ? {
              ...subItem,
              id: subItem.id ?? "inventory-control-stock-sap-new",
              title: "Stock SAP New",
              url: "/dashboard/stocks-sap-new",
              resource: "stocks-sap",
            }
            : subItem,
        )
      }

      if (hasStockSapNew && hasStockSapOld) {
        normalizedSubItems = normalizedSubItems.filter((subItem) => subItem.url !== "/dashboard/stocks-sap")
      }

      if (!hasStockSapNew && !hasStockSapOld) {
        normalizedSubItems = [
          ...normalizedSubItems,
          {
            id: "inventory-control-stock-sap-new",
            title: "Stock SAP New",
            url: "/dashboard/stocks-sap-new",
            resource: "stocks-sap",
          },
        ]
      }

      return {
        ...item,
        items: normalizedSubItems,
      }
    }),
  }))

  return (
    <PermissionsProvider permissions={permissions}>
      <SidebarProvider
        defaultOpen={defaultOpen}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--sidebar": navbarTheme.navbarBg,
            "--sidebar-foreground": navbarTheme.fontColor,
            "--sidebar-accent": navbarTheme.activeBg,
            "--sidebar-accent-foreground": "#ffffff",
            "--app-navbar-active-bg": navbarTheme.activeBg,
            "--app-navbar-section-color": navbarTheme.sectionColor,
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" permissions={permissions} navigationSections={navigationSectionsWithStockSapNew} user={
          user ? {
            name: user.name,
            email: user.email,
            avatar: user.image || "",
          } : undefined
        } />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col" suppressHydrationWarning>{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </PermissionsProvider>
  )
}