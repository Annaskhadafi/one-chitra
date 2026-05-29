"use server"

import { db } from "@/db"
import { salesRevenueSap, zmc9StockSap } from "@/db/schema/sap"
import { desc, sql, and, inArray, ne } from "drizzle-orm"

export interface TopCustomerFilter {
  year?: string;
  from?: Date;
  to?: Date;
}

export async function getTopCustomersThisYear(filter?: TopCustomerFilter) {
  const conditions = [ne(salesRevenueSap.customerName, 'TRANSITYRE B.V')]
  
  if (filter?.from && filter?.to) {
    const fromStr = new Date(filter.from).toISOString().split('T')[0]
    const toStr = new Date(filter.to).toISOString().split('T')[0]
    conditions.push(sql`${salesRevenueSap.billingDate} >= ${fromStr}::date`)
    conditions.push(sql`${salesRevenueSap.billingDate} <= ${toStr}::date`)
  } else {
    const targetYear = filter?.year ? parseInt(filter.year, 10) : new Date().getFullYear()
    conditions.push(sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate}) = ${targetYear}`)
  }

  const whereCondition = and(...conditions)

  const totalRevenueData = await db
    .select({
      totalRevenueAll: sql<number>`coalesce(sum(${salesRevenueSap.revenueInDocCurr}), 0)`.mapWith(Number),
    })
    .from(salesRevenueSap)
    .where(whereCondition)

  const totalRevenueAll = Number(totalRevenueData[0]?.totalRevenueAll) || 0

  // 1. Get Top 15 Customers by Revenue
  const topCustomersData = await db
    .select({
      customerName: salesRevenueSap.customerName,
      totalRevenue: sql<number>`sum(${salesRevenueSap.revenueInDocCurr})`,
    })
    .from(salesRevenueSap)
    .where(whereCondition)
    .groupBy(salesRevenueSap.customerName)
    .orderBy(desc(sql`sum(${salesRevenueSap.revenueInDocCurr})`))
    .limit(15)

  if (!topCustomersData || topCustomersData.length === 0) {
    return { customers: [], topProducts: [], totalRevenueAll }
  }

  const customerNames = topCustomersData.map((c) => c.customerName).filter(Boolean) as string[]

  // 2. Get items bought by these customers this year
  const itemsData = await db
    .select({
      customerName: salesRevenueSap.customerName,
      materialNo: salesRevenueSap.materialNo,
      materialDescription: salesRevenueSap.materialDescription,
      revType: sql<string>`max(${salesRevenueSap.revType})`,
      totalQty: sql<number>`sum(${salesRevenueSap.qty})`.mapWith(Number),
      itemRevenue: sql<number>`sum(${salesRevenueSap.revenueInDocCurr})`.mapWith(Number),
    })
    .from(salesRevenueSap)
    .where(
      and(
        whereCondition,
        inArray(salesRevenueSap.customerName, customerNames)
      )
    )
    .groupBy(
      salesRevenueSap.customerName,
      salesRevenueSap.materialNo,
      salesRevenueSap.materialDescription
    )
    .orderBy(desc(sql`sum(${salesRevenueSap.revenueInDocCurr})`))

  // 3. Get Stock info for all related materials
  const materialNos = Array.from(new Set(itemsData.map((i) => i.materialNo).filter(Boolean))) as string[]
  
  let stockData: { materialNo: string | null; totalStock: number | null }[] = []
  if (materialNos.length > 0) {
    stockData = await db
      .select({
        materialNo: zmc9StockSap.materialNo,
        totalStock: sql<number>`sum(${zmc9StockSap.totalStock})`,
      })
      .from(zmc9StockSap)
      .where(inArray(zmc9StockSap.materialNo, materialNos))
      .groupBy(zmc9StockSap.materialNo)
  }

  const stockMap = new Map()
  stockData.forEach((s) => {
    if (s.materialNo) {
      stockMap.set(s.materialNo, Number(s.totalStock) || 0)
    }
  })

  // 4. Combine data
  // For each customer, find their top 3 most bought items and attach stock
  const result = topCustomersData.map((customer) => {
    const customerItems = itemsData
      .filter((i) => i.customerName === customer.customerName)
      .slice(0, 20) // Top 20 items per customer
      .map((item) => {
        const isTrading = item.revType?.toLowerCase() === 'trading'
        return {
          materialNo: item.materialNo,
          materialDescription: item.materialDescription,
          qty: Number(item.totalQty) || 0,
          itemRevenue: Number(item.itemRevenue) || 0,
          currentStock: item.materialNo ? (stockMap.get(item.materialNo) || 0) : 0,
          isReady: !isTrading, // Jika selain Trading, selalu Ready
        }
      })
      .sort((a, b) => b.itemRevenue - a.itemRevenue)

    return {
      customerName: customer.customerName,
      totalRevenue: Number(customer.totalRevenue) || 0,
      topItems: customerItems,
    }
  })

  // 5. Build global top 15 products for these 15 customers
  const productMap = new Map()
  itemsData.forEach((item) => {
    const key = item.materialNo || item.materialDescription
    if (!key) return
    
    if (!productMap.has(key)) {
      const isTrading = item.revType?.toLowerCase() === 'trading'
      productMap.set(key, {
        materialNo: item.materialNo,
        materialDescription: item.materialDescription,
        qty: 0,
        itemRevenue: 0,
        currentStock: item.materialNo ? (stockMap.get(item.materialNo) || 0) : 0,
        isReady: !isTrading,
      })
    }
    
    const existing = productMap.get(key)
    existing.qty += Number(item.totalQty) || 0
    existing.itemRevenue += Number(item.itemRevenue) || 0
  })

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.itemRevenue - a.itemRevenue)
    .slice(0, 15)

  return { customers: result, topProducts, totalRevenueAll }
}
