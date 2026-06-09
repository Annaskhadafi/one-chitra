"use server"

import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
import { customers } from "@/db/schema"
import { sql, and, notIlike, isNotNull } from "drizzle-orm"
import { getMatGrpGroup, MAT_GRP_GROUP_LIST } from "@/lib/tire-history-groups"

export interface TireHistoryCustomer {
  customerId: number | null
  customerName: string
  businessCategory: string | null
  totalRevenue: number
  totalQty: number
  lastPurchaseDate: string | null
  matGroups: Record<string, { revenue: number; qty: number; lastDate: string | null; items: TireHistoryItem[] }>
}

export interface TireHistoryItem {
  matGrpDesc: string
  matGrpGroup: string
  materialDescription: string
  totalQty: number
  totalRevenue: number
  lastPurchaseDate: string | null
}

export interface TireHistoryFilters {
  search?: string
  matGrpGroups?: string[]
  businessCategories?: string[]
  years?: string[]
}

export async function getCustomerTireHistory(filters?: TireHistoryFilters): Promise<{
  success: true
  data: {
    customers: TireHistoryCustomer[]
    matGrpGroupList: string[]
    businessCategoryList: string[]
    yearList: string[]
    totalCustomers: number
    totalRevenue: number
  }
} | { success: false; error: string }> {
  try {
    const conditions = [
      isNotNull(salesRevenueSap.customerName),
      notIlike(salesRevenueSap.customerName, "%Chitra Paratama%"),
      notIlike(salesRevenueSap.customerName, "%TRANSITYRE%"),
      notIlike(salesRevenueSap.customer, "%ITC008%"),
      notIlike(salesRevenueSap.customer, "%1000289A%"),
      sql`${salesRevenueSap.plant} NOT IN ('2002','2002.0','20020')`,
      isNotNull(salesRevenueSap.matGrpDesc),
      sql`${salesRevenueSap.matGrpDesc} != ''`,
    ]

    if (filters?.years?.length) {
      const yearConds = filters.years.map(y => sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate}) = ${parseInt(y)}`)
      conditions.push(sql`(${sql.join(yearConds, sql` OR `)})`)
    }

    const rows = await db
      .select({
        customerName: salesRevenueSap.customerName,
        matGrpDesc: salesRevenueSap.matGrpDesc,
        materialDescription: salesRevenueSap.materialDescription,
        totalRevenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`,
        totalQty: sql<number>`SUM(COALESCE(${salesRevenueSap.qty}, 0))`,
        lastPurchaseDate: sql<string>`MAX(${salesRevenueSap.billingDate})`,
      })
      .from(salesRevenueSap)
      .where(and(...conditions))
      .groupBy(
        salesRevenueSap.customerName,
        salesRevenueSap.matGrpDesc,
        salesRevenueSap.materialDescription,
      )

    const customerRows = await db.select({
      id: customers.id,
      name: customers.name,
      businessCategory: customers.businessCategory,
    }).from(customers)

    function normName(n: string) {
      return n.toLowerCase()
        .replace(/\bpt\.?\s*/gi, "")
        .replace(/\bcv\.?\s*/gi, "")
        .replace(/\btbk\.?\s*/gi, "")
        .replace(/[.,\-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    }

    const catMap = new Map<string, string | null>()
    for (const c of customerRows) {
      catMap.set(normName(c.name), c.businessCategory)
      catMap.set(c.name.trim().toUpperCase(), c.businessCategory)
    }

    const custMap = new Map<string, TireHistoryCustomer>()
    const yearSet = new Set<string>()

    for (const row of rows) {
      const name = (row.customerName || "").trim()
      if (!name) continue

      const matGrp = (row.matGrpDesc || "").trim()
      const matDesc = (row.materialDescription || "").trim()
      const rev = Number(row.totalRevenue) || 0
      const qty = Number(row.totalQty) || 0
      const lastDate = row.lastPurchaseDate ? String(row.lastPurchaseDate) : null
      const group = getMatGrpGroup(matGrp)

      if (lastDate) {
        const yr = lastDate.substring(0, 4)
        if (yr) yearSet.add(yr)
      }

      const bizCat = catMap.get(name.toUpperCase()) ?? catMap.get(normName(name)) ?? null

      if (!custMap.has(name)) {
        const dbCust = customerRows.find(c => c.name.trim().toUpperCase() === name.toUpperCase() || normName(c.name) === normName(name))
        custMap.set(name, {
          customerId: dbCust?.id ?? null,
          customerName: name,
          businessCategory: bizCat,
          totalRevenue: 0,
          totalQty: 0,
          lastPurchaseDate: null,
          matGroups: {},
        })
      }

      const cust = custMap.get(name)!
      cust.totalRevenue += rev
      cust.totalQty += qty
      if (lastDate && (!cust.lastPurchaseDate || lastDate > cust.lastPurchaseDate)) {
        cust.lastPurchaseDate = lastDate
      }

      if (!cust.matGroups[group]) {
        cust.matGroups[group] = { revenue: 0, qty: 0, lastDate: null, items: [] }
      }
      const grp = cust.matGroups[group]
      grp.revenue += rev
      grp.qty += qty
      if (lastDate && (!grp.lastDate || lastDate > grp.lastDate)) grp.lastDate = lastDate

      const existingItem = grp.items.find(i => i.matGrpDesc === matGrp && i.materialDescription === matDesc)
      if (existingItem) {
        existingItem.totalRevenue += rev
        existingItem.totalQty += qty
        if (lastDate && (!existingItem.lastPurchaseDate || lastDate > existingItem.lastPurchaseDate)) {
          existingItem.lastPurchaseDate = lastDate
        }
      } else {
        grp.items.push({ matGrpDesc: matGrp, matGrpGroup: group, materialDescription: matDesc, totalQty: qty, totalRevenue: rev, lastPurchaseDate: lastDate })
      }
    }

    let result = Array.from(custMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue)

    if (filters?.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(c => c.customerName.toLowerCase().includes(q))
    }
    if (filters?.businessCategories?.length) {
      result = result.filter(c => filters.businessCategories!.includes(c.businessCategory || "Belum Dikategorikan"))
    }
    if (filters?.matGrpGroups?.length) {
      result = result.filter(c => filters.matGrpGroups!.some(g => c.matGroups[g]))
    }

    const businessCategoryList = Array.from(new Set(result.map(c => c.businessCategory || "Belum Dikategorikan"))).sort()
    const totalRevenue = result.reduce((s, c) => s + c.totalRevenue, 0)

    return {
      success: true,
      data: {
        customers: result,
        matGrpGroupList: MAT_GRP_GROUP_LIST,
        businessCategoryList,
        yearList: Array.from(yearSet).sort().reverse(),
        totalCustomers: result.length,
        totalRevenue,
      }
    }
  } catch (err) {
    console.error("[getCustomerTireHistory]", err)
    return { success: false, error: "Failed to fetch customer tire history" }
  }
}

export async function getReadyStockForMatching(): Promise<{ success: true; data: { materialDescription: string; totalStock: number }[] } | { success: false; error: string }> {
  try {
    const result = await db.execute(sql`
      SELECT 
        MAX(material_desc) as material_desc,
        SUM(total_stock) as total_stock
      FROM public.zmc9_stock_sap
      GROUP BY material_no, old_material_no
    `)
    
    const stocks = result.rows.map((row: any) => ({
      materialDescription: String(row.material_desc || ""),
      totalStock: Number(row.total_stock) || 0
    })).filter(s => s.totalStock > 0 && s.materialDescription)

    return { success: true, data: stocks }
  } catch (err) {
    console.error("[getReadyStockForMatching]", err)
    return { success: false, error: "Failed to fetch ready stock" }
  }
}
