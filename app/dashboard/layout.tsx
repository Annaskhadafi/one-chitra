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

const slugifyNavKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const ensureUniqueNavId = (preferredId: string | undefined, fallbackId: string, seenIds: Set<string>) => {
  const baseId = preferredId?.trim() || fallbackId

  if (!seenIds.has(baseId)) {
    seenIds.add(baseId)
    return baseId
  }

  let counter = 2
  let candidate = `${baseId}-${counter}`
  while (seenIds.has(candidate)) {
    counter += 1
    candidate = `${baseId}-${counter}`
  }

  seenIds.add(candidate)
  return candidate
}

const sanitizeRuntimeNavigationSections = (sections: RuntimeNavSection[]): RuntimeNavSection[] => {
  return sections.map((section, sectionIndex) => {
    const mergedItems = new Map<string, RuntimeNavSection["items"][number]>()

    for (const item of section.items) {
      const identity = item.id || `${slugifyNavKey(item.title)}::${item.url || "#"}`
      const existing = mergedItems.get(identity)

      if (!existing) {
        mergedItems.set(identity, {
          ...item,
          items: [...(item.items ?? [])],
        })
        continue
      }

      const mergedSubItems = new Map<string, NonNullable<typeof existing.items>[number]>()
      for (const subItem of [...(existing.items ?? []), ...(item.items ?? [])]) {
        const subIdentity = subItem.id || `${slugifyNavKey(subItem.title)}::${subItem.url || "#"}`
        if (!mergedSubItems.has(subIdentity)) {
          mergedSubItems.set(subIdentity, { ...subItem })
        }
      }

      mergedItems.set(identity, {
        ...existing,
        ...item,
        id: existing.id || item.id,
        title: existing.title || item.title,
        url: existing.url === "#" && item.url !== "#" ? item.url : existing.url,
        resource: existing.resource || item.resource,
        iconName: existing.iconName || item.iconName,
        items: Array.from(mergedSubItems.values()),
      })
    }

    const seenItemIds = new Set<string>()

    return {
      ...section,
      items: Array.from(mergedItems.values()).map((item, itemIndex) => {
        const itemId = ensureUniqueNavId(
          item.id,
          `${section.id || `section-${sectionIndex}`}-item-${itemIndex}-${slugifyNavKey(item.title) || "entry"}`,
          seenItemIds,
        )

        const seenSubItemIds = new Set<string>()

        return {
          ...item,
          id: itemId,
          items: (item.items ?? []).map((subItem, subIndex) => ({
            ...subItem,
            id: ensureUniqueNavId(
              subItem.id,
              `${itemId}-sub-${subIndex}-${slugifyNavKey(subItem.title) || "entry"}`,
              seenSubItemIds,
            ),
          })),
        }
      }),
    }
  })
}

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

  const navigationSectionsWithStockSapNew: RuntimeNavSection[] = sanitizeRuntimeNavigationSections(
    navigationSections.map((section) => ({
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
    })),
  )

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
        <SidebarInset suppressHydrationWarning>
          <SiteHeader />
          <div className="flex flex-1 flex-col" suppressHydrationWarning>{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </PermissionsProvider>
  )
}
