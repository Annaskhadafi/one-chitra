"use server"

import { db } from "@/db"
import { products } from "@/db/schema/products"
import { customers } from "@/db/schema/customers"
import { quotations } from "@/db/schema/quotations"
import { salesOrders, salesOrderItems } from "@/db/schema/sales-orders"
import { deliveries } from "@/db/schema/deliveries"
import { stockLevels } from "@/db/schema/stock-levels"
import { warehouses } from "@/db/schema/warehouses"
import { count, eq, sql, desc, lte, sum } from "drizzle-orm"

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

export async function getDashboardStats(): Promise<DashboardStats> {
    // Run all queries in parallel for performance
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
        // Total products
        db.select({ count: count() }).from(products),

        // Total customers
        db.select({ count: count() }).from(customers),

        // Quotation stats
        db.select({
            total: count(),
            pending: sql<number>`count(*) filter (where ${quotations.status} = 'draft' or ${quotations.status} = 'pending')`,
            approved: sql<number>`count(*) filter (where ${quotations.status} = 'approved')`,
        }).from(quotations),

        // Total sales orders
        db.select({ count: count() }).from(salesOrders),

        // Pending deliveries
        db.select({ count: count() })
            .from(deliveries)
            .where(eq(deliveries.status, "scheduled")),

        // Low stock count
        db.select({ count: count() })
            .from(stockLevels)
            .where(sql`${stockLevels.totalStock} <= ${stockLevels.minStock} AND ${stockLevels.minStock} > 0`),

        // Monthly sales (last 6 months)
        db.select({
            month: sql<string>`to_char(${salesOrders.salesDate}, 'YYYY-MM')`,
            value: sql<number>`coalesce(sum(
                (${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric
            ), 0)`,
        })
            .from(salesOrders)
            .innerJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
            .where(sql`${salesOrders.salesDate} >= now() - interval '6 months'`)
            .groupBy(sql`to_char(${salesOrders.salesDate}, 'YYYY-MM')`)
            .orderBy(sql`to_char(${salesOrders.salesDate}, 'YYYY-MM')`),

        // Product category distribution
        db.select({
            category: products.category,
            count: count(),
        })
            .from(products)
            .groupBy(products.category)
            .orderBy(desc(count())),

        // Recent sales orders (last 5)
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
            GROUP BY so.id, so.invoice_number, c.name, so.sales_date, so.status
            ORDER BY so.created_at DESC
            LIMIT 5
        `),

        // Stock alerts
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
        monthlySales: monthlySalesData.map(row => ({
            month: row.month,
            value: Number(row.value),
        })),
        categoryDistribution: categoryData.map(row => ({
            category: row.category,
            count: row.count,
        })),
        recentOrders: (recentOrdersData.rows as any[]).map(row => ({
            id: row.id,
            invoiceNumber: row.invoice_number,
            customerName: row.customer_name ?? "Unknown",
            salesDate: new Date(row.sales_date),
            status: row.status,
            totalValue: Number(row.total_value ?? 0),
        })),
        stockAlerts: (stockAlertData.rows as any[]).map(row => ({
            productName: row.product_name ?? "Unknown Product",
            materialNumber: row.material_number,
            warehouseName: row.warehouse_name,
            currentStock: Number(row.current_stock),
            minStock: Number(row.min_stock),
        })),
    }
}
