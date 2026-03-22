import { cookies } from "next/headers"
import { db } from "@/db"
import { redirect } from "next/navigation"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardShortcutsCommand } from "@/components/dashboard-shortcuts-command"
import { SiteHeader } from "@/components/site-header"

import "@/app/dashboard/theme.css"

import { auth } from "@/lib/auth"
import { getPermissionsByRoleName } from "@/lib/rbac"
import { headers } from "next/headers"
import { PermissionsProvider } from "@/hooks/use-permissions"
import { getNavbarTheme } from "@/lib/navbar-theme"
import { getNavbarMenuSettingsAction } from "@/app/actions/navbar-menu"
import { toRuntimeNavigationConfig, type RuntimeNavSection } from "@/lib/navigation-menu"

const ensureLogisticsSettlementMenu = (sections: RuntimeNavSection[]): RuntimeNavSection[] => {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const isLogisticsGroup = item.title === "Logistics & Cost" || item.url === "/dashboard/logistics-costs"
      if (!isLogisticsGroup) {
        return item
      }

      const existingItems = item.items ?? []
      const hasLogisticsCostLog = existingItems.some((subItem) => subItem.url === "/dashboard/logistics-costs")
      const hasCostSettlement = existingItems.some((subItem) => subItem.url === "/dashboard/cost-settlements")

      const mergedItems = [...existingItems]
      if (!hasLogisticsCostLog) {
        mergedItems.unshift({
          id: `${item.id}-logistics-cost-log`,
          title: "Logistics Cost Log",
          url: "/dashboard/logistics-costs",
          resource: "logistics-costs",
          hidden: false,
        })
      }
      if (!hasCostSettlement) {
        mergedItems.push({
          id: `${item.id}-cost-settlement`,
          title: "Cost Settlement",
          url: "/dashboard/cost-settlements",
          resource: "cost-settlements",
          hidden: false,
        })
      }

      return {
        ...item,
        url: "#",
        resource: item.resource ?? "logistics-costs",
        items: mergedItems,
      }
    }),
  }))
}

const ensureMasterDataMenu = (sections: RuntimeNavSection[]): RuntimeNavSection[] => {
  const allowedMasterDataUrls = new Set([
    "/dashboard/products",
    "/dashboard/warehouse",
    "/dashboard/rfid-setup",
  ])

  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const isMasterDataGroup = item.title === "Master Data & Umum"
      if (!isMasterDataGroup) {
        return item
      }

      const seen = new Set<string>()
      const filteredItems = (item.items ?? [])
        .filter((subItem) => allowedMasterDataUrls.has(subItem.url))
        .filter((subItem) => {
          if (seen.has(subItem.url)) {
            return false
          }
          seen.add(subItem.url)
          return true
        })

      const hasWarehouse = filteredItems.some((subItem) => subItem.url === "/dashboard/warehouse")
      const hasRfidSetup = filteredItems.some((subItem) => subItem.url === "/dashboard/rfid-setup")

      const mergedItems = [...filteredItems]
      if (!hasWarehouse) {
        mergedItems.push({
          id: `${item.id}-warehouse`,
          title: "Warehouse",
          url: "/dashboard/warehouse",
          resource: "warehouses",
          hidden: false,
        })
      }
      if (!hasRfidSetup) {
        mergedItems.push({
          id: `${item.id}-rfid-setup`,
          title: "RFID Setup",
          url: "/dashboard/rfid-setup",
          resource: "warehouses",
          hidden: false,
        })
      }

      return {
        ...item,
        url: "#",
        items: mergedItems,
      }
    }),
  }))
}

const ensureInventoryControlMenu = (sections: RuntimeNavSection[]): RuntimeNavSection[] => {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const isInventoryGroup = item.title === "Inventory Control" || item.resource === "inventory-control"
      if (!isInventoryGroup) {
        return item
      }

      const existingItems = item.items ?? []
      const hasRfidMonitoring = existingItems.some((subItem) => subItem.url === "/dashboard/rfid-monitoring")
      const hasRfidExceptions = existingItems.some((subItem) => subItem.url === "/dashboard/rfid-exceptions")
      const hasRfidTaggedUnits = existingItems.some((subItem) => subItem.url === "/dashboard/rfid-tagged-units")
      const hasRfidTraceability = existingItems.some((subItem) => subItem.url === "/dashboard/rfid-traceability")

      if (hasRfidMonitoring && hasRfidExceptions && hasRfidTaggedUnits && hasRfidTraceability) {
        return item
      }

      const mergedItems = [...existingItems]
      if (!hasRfidMonitoring) {
        mergedItems.push({
          id: `${item.id}-rfid-monitoring`,
          title: "RFID Monitoring",
          url: "/dashboard/rfid-monitoring",
          resource: "inventory",
          hidden: false,
        })
      }
      if (!hasRfidExceptions) {
        mergedItems.push({
          id: `${item.id}-rfid-exceptions`,
          title: "RFID Exceptions",
          url: "/dashboard/rfid-exceptions",
          resource: "inventory",
          hidden: false,
        })
      }
      if (!hasRfidTaggedUnits) {
        mergedItems.push({
          id: `${item.id}-rfid-tagged-units`,
          title: "RFID Tagged Units",
          url: "/dashboard/rfid-tagged-units",
          resource: "inventory",
          hidden: false,
        })
      }
      if (!hasRfidTraceability) {
        mergedItems.push({
          id: `${item.id}-rfid-traceability`,
          title: "RFID Traceability",
          url: "/dashboard/rfid-traceability",
          resource: "inventory",
          hidden: false,
        })
      }

      return {
        ...item,
        url: "#",
        items: mergedItems,
      }
    }),
  }))
}

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
  const runtimeNavigationSections = ensureInventoryControlMenu(
    ensureMasterDataMenu(
      ensureLogisticsSettlementMenu(toRuntimeNavigationConfig(navbarMenuSettings)),
    ),
  )

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
              title: subItem.title,
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
        <DashboardShortcutsCommand navigationSections={navigationSectionsWithStockSapNew} />
        <SidebarInset suppressHydrationWarning>
          <SiteHeader />
          <div className="flex flex-1 flex-col" suppressHydrationWarning>{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </PermissionsProvider>
  )
}
