import { db } from "@/db"
import { products } from "@/db/schema/products"
import { customers } from "@/db/schema/customers"
import { quotations } from "@/db/schema/quotations"
import { salesOrders, salesOrderItems } from "@/db/schema/sales-orders"
import { deliveries } from "@/db/schema/deliveries"
import { stockLevels } from "@/db/schema/stock-levels"
import { and, count, desc, eq, sql } from "drizzle-orm"

export type DashboardOverviewRange = "this-week" | "this-month" | "this-quarter"

export type DashboardStats = {
  totalProducts: number
  totalCustomers: number
  totalQuotations: number
  pendingQuotations: number
  approvedQuotations: number
  totalSalesOrders: number
  pendingDeliveries: number
  lowStockItems: number
  monthlySales: { month: string; value: number }[]
  categoryDistribution: { category: string; count: number }[]
  recentOrders: {
    id: number
    invoiceNumber: string | null
    customerName: string
    salesDate: Date
    status: string
    totalValue: number
  }[]
  stockAlerts: {
    productName: string
    materialNumber: string
    warehouseName: string
    currentStock: number
    minStock: number
  }[]
}

function getRangeBounds(range: DashboardOverviewRange) {
  const now = new Date()
  const endDate = new Date(now)

  if (range === "this-week") {
    const startDate = new Date(now)
    startDate.setDate(now.getDate() - 6)
    startDate.setHours(0, 0, 0, 0)
    return { startDate, endDate }
  }

  if (range === "this-quarter") {
    const startMonth = Math.floor(now.getMonth() / 3) * 3
    const startDate = new Date(now.getFullYear(), startMonth, 1)
    startDate.setHours(0, 0, 0, 0)
    return { startDate, endDate }
  }

  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  startDate.setHours(0, 0, 0, 0)
  return { startDate, endDate }
}

export async function getDashboardStats(
  range: DashboardOverviewRange = "this-month",
): Promise<DashboardStats> {
  const { startDate, endDate } = getRangeBounds(range)

  const productDateFilter = and(
    sql`${products.createdAt} >= ${startDate}`,
    sql`${products.createdAt} <= ${endDate}`,
  )
  const customerDateFilter = and(
    sql`${customers.createdAt} >= ${startDate}`,
    sql`${customers.createdAt} <= ${endDate}`,
  )
  const quotationDateFilter = and(
    sql`${quotations.quotationDate} >= ${startDate}`,
    sql`${quotations.quotationDate} <= ${endDate}`,
  )
  const salesDateFilter = and(
    sql`${salesOrders.salesDate} >= ${startDate}`,
    sql`${salesOrders.salesDate} <= ${endDate}`,
  )
  const deliveryDateFilter = and(
    sql`${deliveries.scheduledDate} >= ${startDate}`,
    sql`${deliveries.scheduledDate} <= ${endDate}`,
  )
  const stockDateFilter = and(
    sql`${stockLevels.updatedAt} >= ${startDate}`,
    sql`${stockLevels.updatedAt} <= ${endDate}`,
  )

  const [
    productCount,
    customerCount,
    quotationStats,
    salesOrderCount,
    pendingDeliveryCount,
    lowStockCount,
    monthlySalesData,
    categoryData,
    recentOrdersData,
    stockAlertData,
  ] = await Promise.all([
    db.select({ count: count() }).from(products).where(productDateFilter),
    db.select({ count: count() }).from(customers).where(customerDateFilter),
    db
      .select({
        total: count(),
        pending: sql<number>`count(*) filter (where ${quotations.status} = 'draft' or ${quotations.status} = 'pending')`,
        approved: sql<number>`count(*) filter (where ${quotations.status} = 'approved')`,
      })
      .from(quotations)
      .where(quotationDateFilter),
    db.select({ count: count() }).from(salesOrders).where(salesDateFilter),
    db
      .select({ count: count() })
      .from(deliveries)
      .where(and(eq(deliveries.status, "scheduled"), deliveryDateFilter)),
    db
      .select({ count: count() })
      .from(stockLevels)
      .where(
        and(
          stockDateFilter,
          sql`${stockLevels.totalStock} <= ${stockLevels.minStock} AND ${stockLevels.minStock} > 0`,
        ),
      ),
    db
      .select({
        month: sql<string>`to_char(${salesOrders.salesDate}, 'YYYY-MM')`,
        value: sql<number>`coalesce(sum(
                (${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric
            ), 0)`,
      })
      .from(salesOrders)
      .innerJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
      .where(salesDateFilter)
      .groupBy(sql`to_char(${salesOrders.salesDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${salesOrders.salesDate}, 'YYYY-MM')`),
    db
      .select({
        category: products.category,
        count: count(),
      })
      .from(products)
      .where(productDateFilter)
      .groupBy(products.category)
      .orderBy(desc(count())),
    db.execute(sql`
            SELECT 
                so.id,
                so.invoice_number,
                c.name as customer_name,
                so.sales_date,
                so.status,
                coalesce(sum(
                    (soi.unit_price::numeric * soi.quantity) - soi.discount::numeric + soi.tax::numeric
                ), 0) as total_value
            FROM sales_orders so
            LEFT JOIN customers c ON c.id = so.customer_id
            LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
            WHERE so.sales_date >= ${startDate} AND so.sales_date <= ${endDate}
            GROUP BY so.id, so.invoice_number, c.name, so.sales_date, so.status
            ORDER BY so.created_at DESC
            LIMIT 5
        `),
    db.execute(sql`
            SELECT 
                p.material_description as product_name,
                p.material_number,
                w.sloc as warehouse_name,
                sl.total_stock as current_stock,
                sl.min_stock
            FROM stock_levels sl
            JOIN products p ON p.id = sl.product_id
            JOIN warehouses w ON w.id = sl.warehouse_id
            WHERE sl.total_stock <= sl.min_stock AND sl.min_stock > 0
                            AND sl.updated_at >= ${startDate} AND sl.updated_at <= ${endDate}
            ORDER BY (sl.total_stock::float / NULLIF(sl.min_stock, 0)) ASC
            LIMIT 10
        `),
  ])

  return {
    totalProducts: productCount[0]?.count ?? 0,
    totalCustomers: customerCount[0]?.count ?? 0,
    totalQuotations: quotationStats[0]?.total ?? 0,
    pendingQuotations: Number(quotationStats[0]?.pending ?? 0),
    approvedQuotations: Number(quotationStats[0]?.approved ?? 0),
    totalSalesOrders: salesOrderCount[0]?.count ?? 0,
    pendingDeliveries: pendingDeliveryCount[0]?.count ?? 0,
    lowStockItems: lowStockCount[0]?.count ?? 0,
    monthlySales: monthlySalesData.map((row) => ({
      month: row.month,
      value: Number(row.value),
    })),
    categoryDistribution: categoryData.map((row) => ({
      category: row.category,
      count: row.count,
    })),
    recentOrders: (recentOrdersData.rows as Record<string, unknown>[]).map((row) => ({
      id: Number(row.id ?? 0),
      invoiceNumber: (row.invoice_number as string | null) ?? null,
      customerName: String(row.customer_name ?? "Unknown"),
      salesDate: new Date(String(row.sales_date ?? new Date().toISOString())),
      status: String(row.status ?? "unknown"),
      totalValue: Number(row.total_value ?? 0),
    })),
    stockAlerts: (stockAlertData.rows as Record<string, unknown>[]).map((row) => ({
      productName: String(row.product_name ?? "Unknown Product"),
      materialNumber: String(row.material_number ?? ""),
      warehouseName: String(row.warehouse_name ?? ""),
      currentStock: Number(row.current_stock),
      minStock: Number(row.min_stock),
    })),
  }
}
