import os
base = r"D:/[01] PROJECT/one-chitra"

# 1. Write a shared helper file (no "use server")
helper = '''export const MAT_GRP_GROUPS: Record<string, string[]> = {
  "Earthmover": ["EARTHMOVER TIRES", "E/MOVER TYR", "EARTHMOVER"],
  "Truck & Bus": ["TRUCK&BUS TIRES", "TRCK & BUS TYR", "TRUCK & BUS"],
  "Industrial": ["INDUSTRIAL TIRES", "INDUSTRIAL TYRES", "INDUSTRIAL TYR"],
  "Passenger": ["PASSENGER TIRES", "P/CAR TYR", "P/ WORKS TYR"],
  "Bias": ["BIAS"],
  "Radial": ["RADIAL"],
  "Accessories": ["CP ACCESSORIES", "CP WHEEL & RIM", "CP TOOLS", "CP EQUIPMENT", "CP CONSUMABLE"],
  "Services": ["CP SERVICE", "Services", "SERVICE", "REPAIR", "CEMENT", "GREASE", "TOOLS", "GENERAL"],
}

export function getMatGrpGroup(matGrpDesc: string): string {
  if (!matGrpDesc) return "Lainnya"
  const upper = matGrpDesc.toUpperCase()
  for (const [group, keywords] of Object.entries(MAT_GRP_GROUPS)) {
    for (const kw of keywords) {
      if (upper.includes(kw.toUpperCase())) return group
    }
  }
  return "Lainnya"
}

export const MAT_GRP_GROUP_LIST = [...Object.keys(MAT_GRP_GROUPS), "Lainnya"]
'''

helper_path = os.path.join(base, "lib/tire-history-groups.ts")
with open(helper_path, "w", encoding="utf-8") as f:
    f.write(helper)
print("written lib/tire-history-groups.ts")

# 2. Rewrite the server action importing from the helper
action = '''"use server"

import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
import { customers } from "@/db/schema"
import { sql, and, notIlike, isNotNull } from "drizzle-orm"
import { getMatGrpGroup, MAT_GRP_GROUP_LIST } from "@/lib/tire-history-groups"

export interface TireHistoryCustomer {
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
      sql`${salesRevenueSap.plant} NOT IN (\'2002\',\'2002.0\',\'20020\')`,
      isNotNull(salesRevenueSap.matGrpDesc),
      sql`${salesRevenueSap.matGrpDesc} != \'\'`,
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
      name: customers.name,
      businessCategory: customers.businessCategory,
    }).from(customers)

    function normName(n: string) {
      return n.toLowerCase()
        .replace(/\\bpt\\.?\\s*/gi, "")
        .replace(/\\bcv\\.?\\s*/gi, "")
        .replace(/\\btbk\\.?\\s*/gi, "")
        .replace(/[.,\\-_]/g, " ")
        .replace(/\\s+/g, " ")
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
        custMap.set(name, {
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
'''

action_path = os.path.join(base, "app/actions/customer-tire-history.ts")
with open(action_path, "w", encoding="utf-8") as f:
    f.write(action)
print("written app/actions/customer-tire-history.ts")

# Touch client to reload
client_path = os.path.join(base, "app/dashboard/marketing/customer-tire-history/_components/customer-tire-history-client.tsx")
with open(client_path, "r", encoding="utf-8") as f:
    c = f.read()
with open(client_path, "w", encoding="utf-8") as f:
    f.write(c)
print("touched client")
