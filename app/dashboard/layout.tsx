import { cookies } from "next/headers"
import { db } from "@/db"
import { redirect } from "next/navigation"

import {
  SidebarInset,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardShortcutsCommand } from "@/components/dashboard-shortcuts-command"
import { SiteHeader } from "@/components/site-header"
import { DashboardThemeProvider } from "@/components/dashboard-theme-provider"

import "@/app/dashboard/theme.css"

import { auth } from "@/lib/auth"
import { getPermissionsByRoleName, getUserRoleCached } from "@/lib/rbac"
import { headers } from "next/headers"
import { PermissionsProvider } from "@/hooks/use-permissions"
import { getNavbarTheme } from "@/lib/navbar-theme"
import { getNavbarMenuSettings } from "@/lib/server/navbar-menu"
import { toRuntimeNavigationConfig, type RuntimeNavSection } from "@/lib/navigation-menu"
import { getDashboardRouteResource } from "@/lib/route-permissions"
import { ChatWidget } from "@/components/chat/chat-widget"
import { navigationConfig } from "@/lib/navigation"
import { Providers } from "@/components/providers"
import { IframeDetector } from "@/components/iframe-detector"

type RuntimeNavSubItem = NonNullable<RuntimeNavSection["items"][number]["items"]>[number]

const BUSINESS_SECTION_TITLE = "Business & Analytics"

const getBusinessDefaultGroup = (title: string) =>
  navigationConfig
    .find((section) => section.title === BUSINESS_SECTION_TITLE)
    ?.items.find((item) => item.title === title)

const marketingDefaultGroup = getBusinessDefaultGroup("Marketing")
const salesDefaultGroup = getBusinessDefaultGroup("Sales Preview")
const reportsDefaultGroup = getBusinessDefaultGroup("Reports & Analytics")

const marketingDefaultUrls = new Set((marketingDefaultGroup?.items ?? []).map((item) => item.url))
const salesDefaultUrls = new Set((salesDefaultGroup?.items ?? []).map((item) => item.url))
const reportsDefaultUrls = new Set((reportsDefaultGroup?.items ?? []).map((item) => item.url))
const businessKnownUrls = new Set([
  ...marketingDefaultUrls,
  ...salesDefaultUrls,
  ...reportsDefaultUrls,
])

const normalizeBusinessNavigation = (sections: RuntimeNavSection[]): RuntimeNavSection[] => {
  return sections.map((section) => {
    if (section.title !== BUSINESS_SECTION_TITLE) {
      return section
    }

    const marketingItem = section.items.find((item) => item.title === "Marketing")
    const salesItem = section.items.find((item) => item.title === "Sales" || item.title === "Sales Preview")
    const reportsItem = section.items.find((item) => item.title === "Reports & Analytics")

    const sourceByUrl = new Map<string, RuntimeNavSubItem>()
    for (const item of section.items) {
      for (const subItem of item.items ?? []) {
        if (!subItem.url || subItem.url === "#") continue
        if (!sourceByUrl.has(subItem.url)) {
          sourceByUrl.set(subItem.url, subItem)
        }
      }
    }

    const buildDefaultSubItems = (
      parentId: string,
      defaults: NonNullable<ReturnType<typeof getBusinessDefaultGroup>>["items"],
    ): RuntimeNavSubItem[] => {
      return (defaults ?? []).map((defaultItem, index) => {
        const existing = sourceByUrl.get(defaultItem.url)
        return {
          id: existing?.id ?? `${parentId}-sub-${index}`,
          title: existing?.title ?? defaultItem.title,
          url: defaultItem.url,
          resource: defaultItem.resource ?? existing?.resource,
          hidden: existing?.hidden ?? false,
          openInNewTab: existing?.openInNewTab ?? false,
          isCustom: existing?.isCustom ?? false,
          linkType: existing?.linkType ?? "internal",
          externalOpenMode: existing?.externalOpenMode ?? "new_tab",
          iframeManualEnabled: existing?.iframeManualEnabled ?? false,
        }
      })
    }

    const buildGroup = (
      currentItem: RuntimeNavSection["items"][number] | undefined,
      defaultGroup: NonNullable<ReturnType<typeof getBusinessDefaultGroup>>,
      fallbackId: string,
      knownUrls: Set<string>,
    ) => {
      const baseItem = currentItem ?? {
        id: fallbackId,
        title: defaultGroup.title,
        url: "#",
        iconName: "Circle",
        resource: defaultGroup.resource,
        hidden: false,
        items: [],
      }

      const defaultSubItems = buildDefaultSubItems(baseItem.id, defaultGroup.items ?? [])
      const extraSubItems = (currentItem?.items ?? []).filter((subItem) => {
        if (!subItem.url || subItem.url === "#") return false
        if (knownUrls.has(subItem.url)) return false
        return true
      })

      const combinedItems = [...defaultSubItems, ...extraSubItems]
      const seenUrls = new Set<string>()
      const dedupedItems = combinedItems.filter((subItem) => {
        if (!subItem.url || subItem.url === "#") return true
        if (seenUrls.has(subItem.url)) return false
        seenUrls.add(subItem.url)
        return true
      })

      return {
        ...baseItem,
        title: currentItem?.title ?? defaultGroup.title,
        url: "#",
        resource: currentItem?.resource ?? defaultGroup.resource,
        items: dedupedItems,
      }
    }

    const normalizedMarketing = marketingDefaultGroup
      ? buildGroup(marketingItem, marketingDefaultGroup, "business-marketing", businessKnownUrls)
      : marketingItem
    const normalizedSales = salesDefaultGroup
      ? buildGroup(salesItem, salesDefaultGroup, "business-sales", businessKnownUrls)
      : salesItem
    const normalizedReports = reportsDefaultGroup
      ? buildGroup(reportsItem, reportsDefaultGroup, "business-reports", businessKnownUrls)
      : reportsItem

    const otherItems = section.items.filter((item) => ![
      "Marketing",
      "Sales",
      "Sales Preview",
      "Reports & Analytics",
    ].includes(item.title))

    return {
      ...section,
      items: [
        normalizedMarketing,
        normalizedSales,
        normalizedReports,
        ...otherItems,
      ].filter((item): item is RuntimeNavSection["items"][number] => Boolean(item)),
    }
  })
}

const dedupeRuntimeNavigationUrls = (sections: RuntimeNavSection[]): RuntimeNavSection[] => {
  const seenTopLevelUrls = new Set<string>()
  const seenSubUrls = new Set<string>()

  return sections.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => {
        if (!item.url || item.url === "#") return true
        if (seenTopLevelUrls.has(item.url)) return false
        seenTopLevelUrls.add(item.url)
        return true
      })
      .map((item) => ({
        ...item,
        items: (item.items ?? []).filter((subItem) => {
          if (!subItem.url || subItem.url === "#") return true
          if (seenSubUrls.has(subItem.url)) return false
          seenSubUrls.add(subItem.url)
          return true
        }),
      })),
  }))
}

const ensureLogisticsSettlementMenu = (sections: RuntimeNavSection[]): RuntimeNavSection[] => {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const normalizedTitle = item.title.trim().toLowerCase()
      const isLogisticsGroup =
        normalizedTitle === "logistics & cost" ||
        normalizedTitle === "logistics" ||
        normalizedTitle === "logistic" ||
        item.url === "/dashboard/logistics-costs"
      if (!isLogisticsGroup) {
        return item
      }

      const existingItems = item.items ?? []
      const hasLogisticsCostLog = existingItems.some((subItem) => subItem.url === "/dashboard/logistics-costs")
      const visibleItems = existingItems.filter((subItem) => subItem.url !== "/dashboard/cost-settlements")
      
      const mergedItems = [...visibleItems]
      if (!hasLogisticsCostLog) {
        mergedItems.unshift({
          id: `${item.id}-logistics-cost-log`,
          title: "Logistics Cost Log",
          url: "/dashboard/logistics-costs",
          resource: "logistics-costs",
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

const placeCentralServicesBeforeApproval = (sections: RuntimeNavSection[]): RuntimeNavSection[] => {
  const centralServicesIndex = sections.findIndex((section) => section.title === "Central Services")
  const approvalIndex = sections.findIndex((section) => section.title === "Approval")

  if (centralServicesIndex === -1 || approvalIndex === -1 || centralServicesIndex === approvalIndex - 1) {
    return sections
  }

  const orderedSections = [...sections]
  const [centralServicesSection] = orderedSections.splice(centralServicesIndex, 1)
  const targetApprovalIndex = orderedSections.findIndex((section) => section.title === "Approval")

  orderedSections.splice(targetApprovalIndex, 0, centralServicesSection)

  return orderedSections
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

  // Fetch session server-side
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders
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
    getNavbarMenuSettings(),
  ])
  const runtimeNavigationSections = dedupeRuntimeNavigationUrls(
    placeCentralServicesBeforeApproval(
      normalizeBusinessNavigation(
        ensureMasterDataMenu(
          ensureLogisticsSettlementMenu(toRuntimeNavigationConfig(navbarMenuSettings)),
        ),
      ),
    ),
  )

  const user = session?.user as {
    name: string;
    email: string;
    image?: string | null;
  } | undefined

  if (session?.user?.id) {
    // Fetch user role (with in-memory cache) to prevent repeated remote DB roundtrips
    const userRole = await getUserRoleCached(session.user.id)

    if (userRole) {
      permissions = await getPermissionsByRoleName(userRole)
      roleLower = userRole.toLowerCase()
      if (roleLower === 'admin' || roleLower === 'superuser') {
        permissions.push('admin:view')
      }
    }
  }

  const isAdminRole = roleLower === 'admin' || roleLower === 'superuser'
  const currentPathname = requestHeaders.get("x-pathname") ?? "/dashboard"
  const currentRouteResource = getDashboardRouteResource(currentPathname)
  const canViewResource = (resource?: string, url?: string) => {
    if (isAdminRole) {
      return true
    }
    if (resource === "dashboard" || url === "/dashboard") {
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

  if (currentRouteResource && !canViewResource(currentRouteResource, currentPathname)) {
    redirect("/dashboard")
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
      <IframeDetector />
      <Providers>
        <DashboardThemeProvider
          defaultOpen={defaultOpen}
          navbarTheme={navbarTheme}
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
            <ChatWidget currentUserId={session.user.id} />
          </SidebarInset>
        </DashboardThemeProvider>
      </Providers>
    </PermissionsProvider>
  )
}
