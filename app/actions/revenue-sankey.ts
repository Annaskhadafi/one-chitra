"use server"

import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
import { getAuthenticatedSession } from "@/lib/rbac"
import { and, desc, isNotNull, or, notIlike, sql, inArray } from "drizzle-orm"

// Exclude cancelled invoices
const nonCancelledSalesRevenueCondition = sql`
  NULLIF(BTRIM(COALESCE(${salesRevenueSap.c}, '')), '') IS NULL 
  AND NULLIF(BTRIM(COALESCE(${salesRevenueSap.cancelled}, '')), '') IS NULL
`

// Standard Corporate Exclusions
const corporateExclusions = and(
  or(
    sql`${salesRevenueSap.customerName} IS NULL`,
    notIlike(salesRevenueSap.customerName, "%Chitra Paratama Singapore Branch%")
  ),
  notIlike(salesRevenueSap.customer, "%ITC008%"),
  notIlike(salesRevenueSap.customer, "%1000289A%"),
  notIlike(salesRevenueSap.customerName, "%Chitra Paratama%"),
  notIlike(salesRevenueSap.customerName, "%Transityre b.v%")
)

export interface SankeyFilters {
  years: string[]
  months: string[]
  materialGroups: string[]
  currencyMode: "usd" | "idr"
}

export async function getSankeyFilters() {
  try {
    await getAuthenticatedSession("revenue-forecast", "view")

    // Get distinct years from billingDate
    const yearsResult = await db.select({
      year: sql<string>`DISTINCT TO_CHAR(${salesRevenueSap.billingDate}, 'YYYY')`
    }).from(salesRevenueSap)
      .where(isNotNull(salesRevenueSap.billingDate))
      .orderBy(sql`TO_CHAR(${salesRevenueSap.billingDate}, 'YYYY') DESC`)

    const years = yearsResult.map(r => r.year).filter(Boolean)

    // Get distinct matGrpDesc
    const groupsResult = await db.select({
      matGrpDesc: sql<string>`DISTINCT TRIM(${salesRevenueSap.matGrpDesc})`
    }).from(salesRevenueSap)
      .where(sql`NULLIF(TRIM(${salesRevenueSap.matGrpDesc}), '') IS NOT NULL`)
      .orderBy(sql`TRIM(${salesRevenueSap.matGrpDesc}) ASC`)

    const materialGroups = groupsResult.map(r => r.matGrpDesc).filter(Boolean)

    return {
      success: true,
      years,
      materialGroups
    }
  } catch (error) {
    console.error("Failed to fetch Sankey filters:", error)
    return { success: false, error: "Gagal mengambil data filter." }
  }
}

function buildSankeyConditions(filters: SankeyFilters) {
  const conditions = [
    isNotNull(salesRevenueSap.billingDate),
    nonCancelledSalesRevenueCondition,
    corporateExclusions
  ]

  if (filters.years && filters.years.length > 0) {
    conditions.push(inArray(sql`TO_CHAR(${salesRevenueSap.billingDate}, 'YYYY')`, filters.years))
  }

  if (filters.months && filters.months.length > 0) {
    conditions.push(inArray(sql`TO_CHAR(${salesRevenueSap.billingDate}, 'MM')`, filters.months))
  }

  if (filters.materialGroups && filters.materialGroups.length > 0) {
    conditions.push(inArray(sql`TRIM(${salesRevenueSap.matGrpDesc})`, filters.materialGroups))
  }

  return conditions
}

export async function getSankeyDashboardData(filters: SankeyFilters) {
  try {
    await getAuthenticatedSession("revenue-forecast", "view")

    const conditions = buildSankeyConditions(filters)
    const currencyMode = filters.currencyMode || "idr"

    // Query aggregated data by customer name, matGrpDesc, revType
    const aggregatedRows = await db.select({
      customerName: sql<string>`COALESCE(NULLIF(TRIM(${salesRevenueSap.customerName}), ''), 'UNKNOWN')`,
      matGrpDesc: sql<string>`COALESCE(NULLIF(TRIM(${salesRevenueSap.matGrpDesc}), ''), 'UNKNOWN')`,
      revType: sql<string>`COALESCE(NULLIF(TRIM(${salesRevenueSap.revType}), ''), 'UNKNOWN')`,
      totalQty: sql<number>`SUM(COALESCE(${salesRevenueSap.qty}, 0))`,
      totalRevenueInLocCurr: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`,
      totalRevenueInDocCurr: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
    }).from(salesRevenueSap)
      .where(and(...conditions))
      .groupBy(
        sql`COALESCE(NULLIF(TRIM(${salesRevenueSap.customerName}), ''), 'UNKNOWN')`,
        sql`COALESCE(NULLIF(TRIM(${salesRevenueSap.matGrpDesc}), ''), 'UNKNOWN')`,
        sql`COALESCE(NULLIF(TRIM(${salesRevenueSap.revType}), ''), 'UNKNOWN')`
      )

    // Classify rows and calculate totals
    let totalRevenue = 0
    let totalQty = 0
    const customerRevenueMap = new Map<string, { qty: number; revenue: number }>()
    const typeRevenueMap = new Map<string, { qty: number; revenue: number }>()

    // Detail map for Sankey Links: Source (Customer) -> Target (Grouped Category)
    const linksMap = new Map<string, number>()
    const summaryMap = new Map<string, { customerName: string; category: string; qty: number; revenue: number }>()

    aggregatedRows.forEach(row => {
      const revTypeUpper = row.revType.toUpperCase()
      const matGrpUpper = row.matGrpDesc.toUpperCase()

      // Classification logic: Prime Product vs PA vs Service
      let category = "Service"
      if (revTypeUpper === "TRADING") {
        const isTire = (matGrpUpper.includes("TIRE") || matGrpUpper.includes("TYRE") || matGrpUpper.includes("TYR")) && !matGrpUpper.includes("ACCESS")
        if (isTire) {
          category = "Prime Product"
        } else {
          category = "PA"
        }
      }

      // Currency choice
      const revenue = currencyMode === "usd" ? Number(row.totalRevenueInLocCurr || 0) : Number(row.totalRevenueInDocCurr || 0)
      const qty = Number(row.totalQty || 0)

      totalRevenue += revenue
      totalQty += qty

      // Agregasi Customer
      const custVal = customerRevenueMap.get(row.customerName) || { qty: 0, revenue: 0 }
      customerRevenueMap.set(row.customerName, { qty: custVal.qty + qty, revenue: custVal.revenue + revenue })

      // Agregasi Category
      const catVal = typeRevenueMap.get(category) || { qty: 0, revenue: 0 }
      typeRevenueMap.set(category, { qty: catVal.qty + qty, revenue: catVal.revenue + revenue })

      // Sankey connection: Customer -> Category
      const linkKey = `${row.customerName}||${category}`
      linksMap.set(linkKey, (linksMap.get(linkKey) || 0) + revenue)

      // Summary table entry
      const summaryKey = `${row.customerName}||${category}`
      const summVal = summaryMap.get(summaryKey) || { customerName: row.customerName, category, qty: 0, revenue: 0 }
      summaryMap.set(summaryKey, {
        customerName: row.customerName,
        category,
        qty: summVal.qty + qty,
        revenue: summVal.revenue + revenue
      })
    })

    // Get Top 15 customers by revenue to avoid cluttering Sankey
    const sortedCustomers = Array.from(customerRevenueMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)

    const top15CustNames = new Set(sortedCustomers.slice(0, 15).map(c => c[0]))

    // Build Sankey Nodes and Links
    const nodesMap = new Map<string, number>()
    const nodes: { name: string }[] = []

    const getNodeIdx = (name: string) => {
      if (!nodesMap.has(name)) {
        nodesMap.set(name, nodes.length)
        nodes.push({ name })
      }
      return nodesMap.get(name)!
    }

    const sankeyLinks: { source: number; target: number; value: number }[] = []

    // Map links, grouping non-top 15 customers into "OTHERS"
    const groupedLinksMap = new Map<string, number>()
    linksMap.forEach((revenue, key) => {
      const [customer, category] = key.split("||")
      const finalCustomer = top15CustNames.has(customer) ? customer : "OTHERS"
      const groupedKey = `${finalCustomer}||${category}`
      groupedLinksMap.set(groupedKey, (groupedLinksMap.get(groupedKey) || 0) + revenue)
    })

    // Add nodes for categories
    const categoriesList = ["Prime Product", "PA", "Service"]
    categoriesList.forEach(cat => getNodeIdx(cat))

    // Add nodes and links for top customers and OTHERS
    groupedLinksMap.forEach((revenue, key) => {
      const [customer, category] = key.split("||")
      if (revenue <= 0) return // Skip empty links
      const sIdx = getNodeIdx(customer)
      const tIdx = getNodeIdx(category)
      sankeyLinks.push({
        source: sIdx,
        target: tIdx,
        value: Number(revenue.toFixed(2))
      })
    })

    // Scorecards
    const avgPrice = totalQty > 0 ? totalRevenue / totalQty : 0
    const scorecards = {
      totalRevenue,
      totalQty,
      avgPrice,
      activeCustomers: customerRevenueMap.size
    }

    // Summary Rows (all entries)
    const summaryRows = Array.from(summaryMap.values())
      .sort((a, b) => b.revenue - a.revenue)

    return {
      success: true,
      scorecards,
      sankeyData: {
        nodes,
        links: sankeyLinks
      },
      summaryRows
    }
  } catch (error) {
    console.error("Failed to load Sankey Dashboard Data:", error)
    return { success: false, error: "Gagal memuat data dashboard." }
  }
}

export async function getSankeyDetailData(
  filters: SankeyFilters,
  page = 1,
  pageSize = 100
) {
  try {
    await getAuthenticatedSession("revenue-forecast", "view")

    const conditions = buildSankeyConditions(filters)
    const currencyMode = filters.currencyMode || "idr"

    const offset = (page - 1) * pageSize

    // Total Count
    const countResult = await db.select({
      count: sql<number>`COUNT(*)`
    }).from(salesRevenueSap)
      .where(and(...conditions))

    const totalCount = Number(countResult[0]?.count || 0)

    // Raw Detail records
    const records = await db.select({
      salesRevId: salesRevenueSap.salesRevId,
      billingNo: salesRevenueSap.billingNo,
      billingDate: salesRevenueSap.billingDate,
      customerName: salesRevenueSap.customerName,
      salesman: salesRevenueSap.salesman,
      materialDescription: salesRevenueSap.materialDescription,
      qty: salesRevenueSap.qty,
      revenueInLocCurr: salesRevenueSap.revenueInLocCurr,
      revenueInDocCurr: salesRevenueSap.revenueInDocCurr,
      curr: salesRevenueSap.curr
    }).from(salesRevenueSap)
      .where(and(...conditions))
      .orderBy(desc(salesRevenueSap.billingDate), desc(salesRevenueSap.salesRevId))
      .limit(pageSize)
      .offset(offset)

    const formattedRecords = records.map(r => {
      const revenue = currencyMode === "usd" ? Number(r.revenueInLocCurr || 0) : Number(r.revenueInDocCurr || 0)
      return {
        salesRevId: r.salesRevId,
        billingNo: r.billingNo?.endsWith(".0") ? r.billingNo.slice(0, -2) : r.billingNo,
        billingDate: r.billingDate,
        customerName: r.customerName || "Unknown",
        salesman: r.salesman || "Unknown",
        materialDescription: r.materialDescription || "Unknown",
        qty: Number(r.qty || 0),
        revenue,
        curr: r.curr
      }
    })

    return {
      success: true,
      records: formattedRecords,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize)
    }
  } catch (error) {
    console.error("Failed to load Sankey Detail Data:", error)
    return { success: false, error: "Gagal memuat data detail." }
  }
}
