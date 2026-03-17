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
  const allowedMasterDataUrls = new Set(["/dashboard/products", "/dashboard/warehouse"])

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

      return {
        ...item,
        url: "#",
        items: filteredItems,
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
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error"

    const cause = (error as { cause?: unknown } | null)?.cause
    const causeMessage =
      cause instanceof Error
        ? cause.message
        : typeof cause === "string"
          ? cause
          : null

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-lg border bg-background p-6">
          <div className="text-lg font-semibold">Gagal memuat session</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Aplikasi tidak bisa mengakses database untuk validasi session. Pastikan koneksi database aktif dan environment DATABASE_URL dapat dijangkau.
          </div>
          <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-words">
            {causeMessage ? `${message}\n\nCause: ${causeMessage}` : message}
          </div>
        </div>
      </div>
    )
  }

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
  const runtimeNavigationSections = ensureMasterDataMenu(
    ensureLogisticsSettlementMenu(toRuntimeNavigationConfig(navbarMenuSettings)),
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
    if (url === "/dashboard/stock-opname-aktual") {
      return (
        permissions.includes("stock-opname-aktual:view")
        || permissions.includes("stock-opname:view")
      )
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

  const navigationSectionsWithInventoryMenu: RuntimeNavSection[] = navigationSections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.resource !== "inventory-control") {
        return item
      }

      const subItems = item.items ?? []
      const hasStockSapNew = subItems.some((subItem) => subItem.url === "/dashboard/stocks-sap-new")
      const hasStockSapOld = subItems.some((subItem) => subItem.url === "/dashboard/stocks-sap")
      const hasStockOpnameAktual = subItems.some((subItem) => subItem.url === "/dashboard/stock-opname-aktual")

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

      if (!hasStockOpnameAktual) {
        const stockOpnameIndex = normalizedSubItems.findIndex((subItem) => subItem.url === "/dashboard/stock-opname")
        const opnameAktualItem = {
          id: "inventory-control-stock-opname-aktual",
          title: "Stock Opname Aktual",
          url: "/dashboard/stock-opname-aktual",
          resource: "stock-opname-aktual",
        }

        if (stockOpnameIndex >= 0) {
          normalizedSubItems = [
            ...normalizedSubItems.slice(0, stockOpnameIndex + 1),
            opnameAktualItem,
            ...normalizedSubItems.slice(stockOpnameIndex + 1),
          ]
        } else {
          normalizedSubItems = [
            ...normalizedSubItems,
            opnameAktualItem,
          ]
        }
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
        <AppSidebar variant="inset" permissions={permissions} navigationSections={navigationSectionsWithInventoryMenu} user={
          user ? {
            name: user.name,
            email: user.email,
            avatar: user.image || "",
          } : undefined
        } />
        <DashboardShortcutsCommand navigationSections={navigationSectionsWithInventoryMenu} />
        <SidebarInset suppressHydrationWarning>
          <SiteHeader />
          <div className="flex flex-1 flex-col" suppressHydrationWarning>{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </PermissionsProvider>
  )
}
