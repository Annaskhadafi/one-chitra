"use server"

import { db } from "@/db"
import { products } from "@/db/schema/products"
import { customers } from "@/db/schema/customers"
import { salesOrders, salesOrderItems } from "@/db/schema/sales-orders"
import { stockLevels } from "@/db/schema/stock-levels"
import { warehouses } from "@/db/schema/warehouses"
import { deliveries } from "@/db/schema/deliveries"
import { stockTransfers, stockTransferItems } from "@/db/schema/transfers"
import { billingRecords } from "@/db/schema/billing"
import { sapSyncLogs } from "@/db/schema/sap-sync"
import { sql, desc, asc, eq, gte, lte, and, or } from "drizzle-orm"

// ==================== INVENTORY REPORT TYPES ====================
export type InventoryReportData = {
    stockOverview: {
        warehouseName: string
        warehouseType: string
        totalProducts: number
        totalStock: number
        totalValue: number
        lowStockCount: number
        outOfStockCount: number
    }[]
    stockMovement: {
        date: string
        stockIn: number
        stockOut: number
        netChange: number
    }[]
    lowStockAlerts: {
        id: number
        productName: string
        materialNumber: string
        warehouseName: string
        currentStock: number
        minStock: number
        stockRatio: number
        valuationValue: number
    }[]
    deadStock: {
        productName: string
        materialNumber: string
        category: string
        warehouseName: string
        totalStock: number
        valuationValue: number
        lastMovement?: Date
    }[]
    inventoryValueTrend: {
        date: string
        totalValue: number
    }[]
}

// ==================== SALES REPORT TYPES ====================
export type SalesReportData = {
    salesTrend: {
        date: string
        sales: number
        orders: number
        averageOrderValue: number
    }[]
    salesByCustomer: {
        customerId: number
        customerName: string
        customerCode: string
        totalSales: number
        orderCount: number
        averageOrderValue: number
    }[]
    salesByCategory: {
        category: string
        totalSales: number
        orderCount: number
        percentage: number
    }[]
    salesByProduct: {
        productId: number
        productName: string
        materialNumber: string
        category: string
        quantitySold: number
        totalRevenue: number
    }[]
    monthlyComparison: {
        month: string
        currentYear: number
        previousYear: number
        growth: number
    }[]
    salesTarget: {
        target: number
        actual: number
        percentage: number
        remaining: number
    }
}

// ==================== CUSTOMER REPORT TYPES ====================
export type CustomerReportData = {
    customerSegmentation: {
        segment: string
        count: number
        percentage: number
        totalRevenue: number
    }[]
    topCustomers: {
        customerId: number
        customerName: string
        customerCode: string
        totalOrders: number
        totalRevenue: number
        averageOrderValue: number
        lastOrderDate?: Date
    }[]
    customerGrowth: {
        month: string
        newCustomers: number
        cumulativeCustomers: number
        churnedCustomers: number
    }[]
    repeatPurchaseRate: {
        totalCustomers: number
        repeatCustomers: number
        oneTimeCustomers: number
        repeatRate: number
        averageOrdersPerCustomer: number
    }
    customerActivity: {
        status: string
        count: number
        percentage: number
    }[]
}

// ==================== ORDER FULFILLMENT REPORT TYPES ====================
export type OrderFulfillmentReportData = {
    orderStatusDistribution: {
        status: string
        count: number
        percentage: number
        totalValue: number
    }[]
    fulfillmentTime: {
        averageDays: number
        medianDays: number
        minDays: number
        maxDays: number
        byMonth: {
            month: string
            averageDays: number
        }[]
    }
    onTimeDelivery: {
        totalDeliveries: number
        onTimeDeliveries: number
        lateDeliveries: number
        onTimeRate: number
        byMonth: {
            month: string
            totalDeliveries: number
            onTimeDeliveries: number
            onTimeRate: number
        }[]
    }
    backorderAnalysis: {
        productId: number
        productName: string
        materialNumber: string
        backorderCount: number
        totalBackorderQuantity: number
        averageFulfillmentDays: number
    }[]
    orderTrend: {
        month: string
        totalOrders: number
        completedOrders: number
        cancelledOrders: number
        completionRate: number
    }[]
}

// ==================== PRODUCT PERFORMANCE REPORT TYPES ====================
export type ProductPerformanceReportData = {
    bestSellingProducts: {
        productId: number
        productName: string
        materialNumber: string
        category: string
        quantitySold: number
        totalRevenue: number
        profitMargin?: number
        rank: number
    }[]
    worstSellingProducts: {
        productId: number
        productName: string
        materialNumber: string
        category: string
        quantitySold: number
        totalRevenue: number
        stockLevel: number
        rank: number
    }[]
    categoryPerformance: {
        category: string
        totalRevenue: number
        totalQuantity: number
        productCount: number
        averagePrice: number
        growthRate: number
    }[]
    productProfitability: {
        productId: number
        productName: string
        category: string
        totalRevenue: number
        totalCost: number
        profit: number
        margin: number
        volume: number
    }[]
    abcAnalysis: {
        class: "A" | "B" | "C"
        productCount: number
        percentage: number
        totalRevenue: number
        revenuePercentage: number
        description: string
    }[]
}

// ==================== WAREHOUSE & LOGISTICS REPORT TYPES ====================
export type WarehouseLogisticsReportData = {
    warehouseCapacity: {
        warehouseId: number
        warehouseName: string
        warehouseType: string
        totalProducts: number
        totalStock: number
        capacityUsed: number
        capacityTotal: number
        utilizationRate: number
    }[]
    stockTransferFlow: {
        fromWarehouse: string
        toWarehouse: string
        transferCount: number
        totalQuantity: number
        totalValue: number
    }[]
    deliveryPerformance: {
        month: string
        totalDeliveries: number
        completedDeliveries: number
        averageDeliveryTime: number
        onTimeRate: number
    }[]
    fleetUtilization: {
        vehicleNumber: string
        vehicleType: string
        totalTrips: number
        totalDistance?: number
        utilizationRate: number
        totalCost: number
    }[]
    shippingCostAnalysis: {
        month: string
        totalShippingCost: number
        averageCostPerDelivery: number
        costByType: {
            type: string
            amount: number
        }[]
    }[]
}

// ==================== FINANCIAL REPORT TYPES ====================
export type FinancialReportData = {
    revenueOverview: {
        month: string
        revenue: number
        target: number
    }[]
    revenueByPaymentType: {
        type: string
        revenue: number
        percentage: number
    }[]
    outstandingInvoices: {
        invoiceNo: string
        customer: string
        date: Date
        amount: number
        dueDate: Date
    }[]
    taxReport: {
        month: string
        totalRevenue: number
        totalTax: number
    }[]
}

// ==================== SAP REPORT TYPES ====================
export type SAPIntegrationReportData = {
    syncStatus: {
        type: string
        lastSync: Date | null
        status: string
        recordsProcessed: number
    }[]
    syncErrors: {
        id: number
        type: string
        date: Date
        error: string
    }[]
    dataDiscrepancy: {
        entity: string
        localCount: number
        sapCount: number
        difference: number
        lastChecked: Date
    }[]
}

// ==================== INVENTORY REPORT FUNCTION ====================
export async function getInventoryReport(warehouseId?: number): Promise<InventoryReportData> {
    // Stock Overview by Warehouse
    const stockOverviewData = await db.select({
        warehouse_name: warehouses.sloc,
        warehouse_type: warehouses.type,
        total_products: sql<number>`COUNT(DISTINCT ${stockLevels.productId})`,
        total_stock: sql<number>`COALESCE(SUM(${stockLevels.totalStock}), 0)`,
        total_value: sql<number>`COALESCE(SUM(${stockLevels.valuationValue}), 0)`,
        low_stock_count: sql<number>`COUNT(CASE WHEN ${stockLevels.totalStock} <= ${stockLevels.minStock} AND ${stockLevels.minStock} > 0 THEN 1 END)`,
        out_of_stock_count: sql<number>`COUNT(CASE WHEN ${stockLevels.totalStock} = 0 THEN 1 END)`
    })
        .from(warehouses)
        .leftJoin(stockLevels, eq(warehouses.id, stockLevels.warehouseId))
        .where(warehouseId ? eq(warehouses.id, warehouseId) : undefined)
        .groupBy(warehouses.id, warehouses.sloc, warehouses.type)
        .orderBy(desc(sql`COALESCE(SUM(${stockLevels.valuationValue}), 0)`));

    // Stock Movement (last 30 days)
    const movementCalc = db.$with('movement_calc').as(
        db.select({
            date: sql<string>`DATE(${stockLevels.createdAt})`.as('date'),
            total_stock: stockLevels.totalStock,
            prev_stock: sql<number>`LAG(${stockLevels.totalStock}) OVER (PARTITION BY ${stockLevels.productId}, ${stockLevels.warehouseId} ORDER BY ${stockLevels.createdAt})`.as('prev_stock')
        })
            .from(stockLevels)
            .where(sql`${stockLevels.createdAt} >= NOW() - INTERVAL '30 days'`)
    );

    const stockMovementData = await db.with(movementCalc).select({
        date: movementCalc.date,
        stock_in: sql<number>`COALESCE(SUM(CASE WHEN ${movementCalc.prev_stock} IS NOT NULL AND ${movementCalc.total_stock} > ${movementCalc.prev_stock} THEN ${movementCalc.total_stock} - ${movementCalc.prev_stock} ELSE 0 END), 0)`,
        stock_out: sql<number>`COALESCE(SUM(CASE WHEN ${movementCalc.prev_stock} IS NOT NULL AND ${movementCalc.total_stock} < ${movementCalc.prev_stock} THEN ${movementCalc.prev_stock} - ${movementCalc.total_stock} ELSE 0 END), 0)`,
        net_change: sql<number>`0`
    })
        .from(movementCalc)
        .groupBy(movementCalc.date)
        .orderBy(movementCalc.date);

    // Low Stock Alerts
    const lowStockData = await db.select({
        id: stockLevels.id,
        product_name: products.materialDescription,
        material_number: products.materialNumber,
        warehouse_name: warehouses.sloc,
        current_stock: stockLevels.totalStock,
        min_stock: stockLevels.minStock,
        stock_ratio: sql<number>`CASE WHEN ${stockLevels.minStock} > 0 THEN ${stockLevels.totalStock}::float / ${stockLevels.minStock} ELSE 0 END`,
        valuation_value: stockLevels.valuationValue
    })
        .from(stockLevels)
        .innerJoin(products, eq(products.id, stockLevels.productId))
        .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
        .where(and(lte(stockLevels.totalStock, stockLevels.minStock), sql`${stockLevels.minStock} > 0`))
        .orderBy(asc(sql`CASE WHEN ${stockLevels.minStock} > 0 THEN ${stockLevels.totalStock}::float / ${stockLevels.minStock} ELSE 0 END`))
        .limit(50);

    // Dead Stock (no movement in 90 days)
    const deadStockData = await db.select({
        product_name: products.materialDescription,
        material_number: products.materialNumber,
        category: products.category,
        warehouse_name: warehouses.sloc,
        total_stock: stockLevels.totalStock,
        valuation_value: stockLevels.valuationValue,
        last_movement: stockLevels.updatedAt
    })
        .from(stockLevels)
        .innerJoin(products, eq(products.id, stockLevels.productId))
        .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
        .where(and(sql`${stockLevels.totalStock} > 0`, sql`${stockLevels.updatedAt} < NOW() - INTERVAL '90 days'`))
        .orderBy(sql`${stockLevels.updatedAt} ASC`)
        .limit(50);

    // Inventory Value Trend (last 12 months)
    const inventoryValueData = await db.select({
        date: sql<string>`DATE_TRUNC('month', ${stockLevels.createdAt})`.as('date'),
        total_value: sql<number>`COALESCE(SUM(${stockLevels.valuationValue}), 0)`
    })
        .from(stockLevels)
        .where(sql`${stockLevels.createdAt} >= NOW() - INTERVAL '12 months'`)
        .groupBy(sql`DATE_TRUNC('month', ${stockLevels.createdAt})`)
        .orderBy(sql`DATE_TRUNC('month', ${stockLevels.createdAt})`);

    return {
        stockOverview: stockOverviewData.map(row => ({
            warehouseName: row.warehouse_name ?? "Unknown",
            warehouseType: row.warehouse_type ?? "N/A",
            totalProducts: Number(row.total_products),
            totalStock: Number(row.total_stock),
            totalValue: Number(row.total_value),
            lowStockCount: Number(row.low_stock_count),
            outOfStockCount: Number(row.out_of_stock_count),
        })),
        stockMovement: stockMovementData.map(row => ({
            date: typeof row.date === 'object' && row.date !== null ? (row.date as Date).toISOString().split("T")[0] : String(row.date).split("T")[0],
            stockIn: Number(row.stock_in),
            stockOut: Number(row.stock_out),
            netChange: Number(row.stock_in) - Number(row.stock_out),
        })),
        lowStockAlerts: lowStockData.map(row => ({
            id: Number(row.id),
            productName: row.product_name ?? "Unknown",
            materialNumber: (row.material_number ?? null) as string,
            warehouseName: (row.warehouse_name ?? null) as string,
            currentStock: Number(row.current_stock),
            minStock: Number(row.min_stock),
            stockRatio: Number(row.stock_ratio),
            valuationValue: Number(row.valuation_value),
        })),
        deadStock: deadStockData.map(row => ({
            productName: row.product_name ?? "Unknown",
            materialNumber: (row.material_number ?? null) as string,
            category: (row.category ?? null) as string,
            warehouseName: row.warehouse_name,
            totalStock: Number(row.total_stock),
            valuationValue: Number(row.valuation_value),
            lastMovement: row.last_movement ? new Date(row.last_movement as string | Date) : null as unknown as Date,
        })),
        inventoryValueTrend: inventoryValueData.map(row => ({
            date: typeof row.date === 'object' && row.date !== null ? (row.date as Date).toISOString().split("T")[0].substring(0, 7) : String(row.date).substring(0, 7),
            totalValue: Number(row.total_value),
        })),
    }
}

// ==================== SALES REPORT FUNCTION ====================
export async function getSalesReport(
    startDate?: Date,
    endDate?: Date
): Promise<SalesReportData> {
    const start = startDate ?? new Date(new Date().setMonth(new Date().getMonth() - 6))
    const end = endDate ?? new Date()

    // Sales Trend
    const salesTrendData = await db.select({
        date: sql<Date>`DATE_TRUNC('day', ${salesOrders.salesDate})`.as('date'),
        sales: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${salesOrders.id})`,
        avg_order_value: sql<number>`COALESCE(AVG((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`
    })
        .from(salesOrders)
        .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
        .where(and(gte(salesOrders.salesDate, start), lte(salesOrders.salesDate, end)))
        .groupBy(sql`DATE_TRUNC('day', ${salesOrders.salesDate})`)
        .orderBy(sql`DATE_TRUNC('day', ${salesOrders.salesDate})`);

    // Sales by Customer
    const salesByCustomerData = await db.select({
        customer_id: customers.id,
        customer_name: customers.name,
        customer_code: customers.customerCode,
        total_sales: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        order_count: sql<number>`COUNT(DISTINCT ${salesOrders.id})`,
        avg_order_value: sql<number>`COALESCE(AVG((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`
    })
        .from(customers)
        .leftJoin(salesOrders, eq(salesOrders.customerId, customers.id))
        .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
        .where(and(gte(salesOrders.salesDate, start), lte(salesOrders.salesDate, end)))
        .groupBy(customers.id, customers.name, customers.customerCode)
        .orderBy(desc(sql`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`))
        .limit(20);

    // Sales by Category
    const totalSalesResult = await db.select({
        total: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`
    })
        .from(salesOrders)
        .innerJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
        .where(and(gte(salesOrders.salesDate, start), lte(salesOrders.salesDate, end)));
    const totalSales = Number(totalSalesResult[0]?.total ?? 0);

    const salesByCategoryData = await db.select({
        category: products.category,
        total_sales: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        order_count: sql<number>`COUNT(DISTINCT ${salesOrders.id})`
    })
        .from(salesOrders)
        .innerJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
        .innerJoin(products, eq(products.id, salesOrderItems.productId))
        .where(and(gte(salesOrders.salesDate, start), lte(salesOrders.salesDate, end)))
        .groupBy(products.category)
        .orderBy(desc(sql`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`));

    // Sales by Product
    const salesByProductData = await db.select({
        product_id: products.id,
        product_name: products.materialDescription,
        material_number: products.materialNumber,
        category: products.category,
        quantity_sold: sql<number>`COALESCE(SUM(${salesOrderItems.quantity}), 0)`,
        total_revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`
    })
        .from(products)
        .leftJoin(salesOrderItems, eq(salesOrderItems.productId, products.id))
        .leftJoin(salesOrders, and(eq(salesOrders.id, salesOrderItems.salesOrderId), gte(salesOrders.salesDate, start), lte(salesOrders.salesDate, end)))
        .groupBy(products.id, products.materialDescription, products.materialNumber, products.category)
        .orderBy(desc(sql`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`))
        .limit(50);

    // Monthly Comparison (YoY)
    const monthlyQuery = db.$with('monthly').as(
        db.select({
            date_month: sql<Date>`DATE_TRUNC('month', ${salesOrders.salesDate})`.as('date_month'),
            sales: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`.as('sales')
        })
            .from(salesOrders)
            .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
            .where(gte(salesOrders.salesDate, new Date(end.getFullYear() - 1, 0, 1)))
            .groupBy(sql`DATE_TRUNC('month', ${salesOrders.salesDate})`)
    );

    const monthlyComparisonData = await db.with(monthlyQuery).select({
        month: sql<string>`TO_CHAR(${monthlyQuery.date_month}, 'YYYY-MM')`.as('month'),
        current_year: sql<number>`COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM ${monthlyQuery.date_month}) = ${end.getFullYear()} THEN ${monthlyQuery.sales} ELSE 0 END), 0)`.as('current_year'),
        previous_year: sql<number>`COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM ${monthlyQuery.date_month}) = ${end.getFullYear() - 1} THEN ${monthlyQuery.sales} ELSE 0 END), 0)`.as('previous_year')
    })
        .from(monthlyQuery)
        .groupBy(sql`month`)
        .orderBy(sql`TO_CHAR(${monthlyQuery.date_month}, 'YYYY-MM')`);

    const avgMonthlySales = totalSales / 6;
    const monthlyTarget = avgMonthlySales * 1.1;
    const currentMonthSales = salesTrendData.filter((r) => {
        const d = new Date(r.date);
        return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
    }).reduce((sum: number, r) => sum + Number(r.sales), 0);

    return {
        salesTrend: salesTrendData.map(row => ({
            date: typeof row.date === 'object' && row.date !== null ? (row.date as Date).toISOString().split("T")[0] : String(row.date).split("T")[0],
            sales: Number(row.sales),
            orders: Number(row.orders),
            averageOrderValue: Number(row.avg_order_value),
        })),
        salesByCustomer: salesByCustomerData.map(row => ({
            customerId: Number(row.customer_id),
            customerName: row.customer_name ?? "Unknown",
            customerCode: (row.customer_code ?? null) as string,
            totalSales: Number(row.total_sales),
            orderCount: Number(row.order_count),
            averageOrderValue: Number(row.avg_order_value),
        })),
        salesByCategory: salesByCategoryData.map(row => ({
            category: row.category ?? "Uncategorized",
            totalSales: Number(row.total_sales),
            orderCount: Number(row.order_count),
            percentage: totalSales > 0 ? (Number(row.total_sales) / totalSales) * 100 : 0,
        })),
        salesByProduct: salesByProductData.map(row => ({
            productId: Number(row.product_id),
            productName: row.product_name ?? "Unknown",
            materialNumber: (row.material_number ?? null) as string,
            category: row.category ?? "Uncategorized",
            quantitySold: Number(row.quantity_sold),
            totalRevenue: Number(row.total_revenue),
        })),
        monthlyComparison: monthlyComparisonData.map(row => ({
            month: row.month,
            currentYear: Number(row.current_year),
            previousYear: Number(row.previous_year),
            growth: row.previous_year > 0 ? ((Number(row.current_year) - Number(row.previous_year)) / Number(row.previous_year)) * 100 : 0,
        })),
        salesTarget: {
            target: monthlyTarget,
            actual: currentMonthSales,
            percentage: monthlyTarget > 0 ? (currentMonthSales / monthlyTarget) * 100 : 0,
            remaining: monthlyTarget - currentMonthSales,
        },
    }
}

// ==================== CUSTOMER REPORT FUNCTION ====================
export async function getCustomerReport(): Promise<CustomerReportData> {
    // Customer Segmentation (by revenue)
    const customerRevenue = db.$with('customer_revenue').as(
        db.select({
            id: customers.id,
            name: customers.name,
            total_revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`.as('total_revenue')
        })
            .from(customers)
            .leftJoin(salesOrders, eq(salesOrders.customerId, customers.id))
            .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
            .groupBy(customers.id, customers.name)
    );

    const segmentationData = await db.with(customerRevenue).select({
        segment: sql<string>`CASE
                WHEN ${customerRevenue.total_revenue} >= (SELECT PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY total_revenue) FROM customer_revenue) THEN 'VIP'
                WHEN ${customerRevenue.total_revenue} >= (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_revenue) FROM customer_revenue) THEN 'Regular'
                ELSE 'Small'
            END`.as('segment'),
        count: sql<number>`COUNT(*)`,
        total_revenue: sql<number>`COALESCE(SUM(${customerRevenue.total_revenue}), 0)`
    })
        .from(customerRevenue)
        .groupBy(sql`segment`)
        .orderBy(desc(sql`COALESCE(SUM(${customerRevenue.total_revenue}), 0)`));

    const totalCustomers = segmentationData.reduce((sum: number, r) => sum + Number(r.count), 0)
    const _totalRevenue = segmentationData.reduce((sum: number, r) => sum + Number(r.total_revenue), 0)

    // Top Customers
    const topCustomersData = await db.select({
        customer_id: customers.id,
        customer_name: customers.name,
        customer_code: customers.customerCode,
        total_orders: sql<number>`COUNT(DISTINCT ${salesOrders.id})`,
        total_revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        avg_order_value: sql<number>`COALESCE(AVG((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        last_order_date: sql<Date>`MAX(${salesOrders.salesDate})`
    })
        .from(customers)
        .leftJoin(salesOrders, eq(salesOrders.customerId, customers.id))
        .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
        .groupBy(customers.id, customers.name, customers.customerCode)
        .orderBy(desc(sql`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`))
        .limit(20);

    // Customer Growth (last 12 months)
    const monthlyCustomers = db.$with('monthly_customers').as(
        db.select({
            month: sql<Date>`DATE_TRUNC('month', ${customers.createdAt})`.as('month'),
            new_customers: sql<number>`COUNT(*)`.as('new_customers')
        })
            .from(customers)
            .where(sql`${customers.createdAt} >= NOW() - INTERVAL '12 months'`)
            .groupBy(sql`DATE_TRUNC('month', ${customers.createdAt})`)
    );

    const cumulative = db.$with('cumulative').as(
        db.with(monthlyCustomers).select({
            month: monthlyCustomers.month,
            new_customers: monthlyCustomers.new_customers,
            cumulative_customers: sql<number>`SUM(${monthlyCustomers.new_customers}) OVER (ORDER BY ${monthlyCustomers.month})`.as('cumulative_customers')
        })
            .from(monthlyCustomers)
    );

    const growthData = await db.with(monthlyCustomers, cumulative).select({
        month: sql<string>`TO_CHAR(${cumulative.month}, 'YYYY-MM')`.as('month'),
        new_customers: cumulative.new_customers,
        cumulative_customers: cumulative.cumulative_customers,
        churned_customers: sql<number>`0`.as('churned_customers')
    })
        .from(cumulative)
        .orderBy(cumulative.month);

    // Repeat Purchase Rate
    const customerOrders = db.$with('customer_orders').as(
        db.select({
            id: customers.id,
            order_count: sql<number>`COUNT(DISTINCT ${salesOrders.id})`.as('order_count')
        })
            .from(customers)
            .leftJoin(salesOrders, eq(salesOrders.customerId, customers.id))
            .groupBy(customers.id)
    );

    const repeatData = await db.with(customerOrders).select({
        total_customers: sql<number>`COUNT(*)`,
        repeat_customers: sql<number>`COUNT(CASE WHEN ${customerOrders.order_count} > 1 THEN 1 END)`,
        one_time_customers: sql<number>`COUNT(CASE WHEN ${customerOrders.order_count} = 1 THEN 1 END)`,
        avg_orders_per_customer: sql<number>`COALESCE(AVG(${customerOrders.order_count}), 0)`
    })
        .from(customerOrders);

    // Customer Activity Status
    const customerActivity = db.$with('customer_activity').as(
        db.select({
            id: customers.id,
            last_order: sql<Date>`MAX(${salesOrders.salesDate})`.as('last_order')
        })
            .from(customers)
            .leftJoin(salesOrders, eq(salesOrders.customerId, customers.id))
            .groupBy(customers.id)
    );

    const activityData = await db.with(customerActivity).select({
        status: sql<string>`CASE 
                WHEN ${customerActivity.last_order} >= NOW() - INTERVAL '30 days' THEN 'Active'
                WHEN ${customerActivity.last_order} >= NOW() - INTERVAL '90 days' THEN 'Inactive'
                WHEN ${customerActivity.last_order} IS NULL THEN 'Never Ordered'
                ELSE 'Churned'
            END`.as('status'),
        count: sql<number>`COUNT(*)`
    })
        .from(customerActivity)
        .groupBy(sql`status`);

    const totalActivity = activityData.reduce((sum: number, r) => sum + Number(r.count), 0)

    return {
        customerSegmentation: segmentationData.map(row => ({
            segment: String(row.segment),
            count: Number(row.count),
            percentage: totalCustomers > 0 ? (Number(row.count) / totalCustomers) * 100 : 0,
            totalRevenue: Number(row.total_revenue),
        })),
        topCustomers: topCustomersData.map(row => ({
            customerId: Number(row.customer_id),
            customerName: String(row.customer_name ?? "Unknown"),
            customerCode: String(row.customer_code ?? ""),
            totalOrders: Number(row.total_orders),
            totalRevenue: Number(row.total_revenue),
            averageOrderValue: Number(row.avg_order_value),
            lastOrderDate: row.last_order_date ? new Date(row.last_order_date as string | Date) : null as unknown as Date,
        })),
        customerGrowth: growthData.map(row => ({
            month: String(row.month),
            newCustomers: Number(row.new_customers),
            cumulativeCustomers: Number(row.cumulative_customers),
            churnedCustomers: Number(row.churned_customers),
        })),
        repeatPurchaseRate: {
            totalCustomers: Number(repeatData[0]?.total_customers ?? 0),
            repeatCustomers: Number(repeatData[0]?.repeat_customers ?? 0),
            oneTimeCustomers: Number(repeatData[0]?.one_time_customers ?? 0),
            repeatRate: Number(repeatData[0]?.total_customers ?? 1) > 0 ? (Number(repeatData[0]?.repeat_customers ?? 0) / Number(repeatData[0]?.total_customers ?? 1)) * 100 : 0,
            averageOrdersPerCustomer: Number(repeatData[0]?.avg_orders_per_customer ?? 0),
        },
        customerActivity: activityData.map(row => ({
            status: String(row.status),
            count: Number(row.count),
            percentage: totalActivity > 0 ? (Number(row.count) / totalActivity) * 100 : 0,
        })),
    }
}

// ==================== ORDER FULFILLMENT REPORT FUNCTION ====================
export async function getOrderFulfillmentReport(): Promise<OrderFulfillmentReportData> {
    // Order Status Distribution
    const orderTotals = db.$with('order_totals').as(
        db.select({
            id: salesOrders.id,
            status: salesOrders.status,
            total_value: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`.as('total_value')
        })
            .from(salesOrders)
            .leftJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
            .groupBy(salesOrders.id, salesOrders.status)
    );

    const statusData = await db.with(orderTotals).select({
        status: orderTotals.status,
        count: sql<number>`COUNT(*)`,
        total_value: sql<number>`COALESCE(SUM(${orderTotals.total_value}), 0)`
    })
        .from(orderTotals)
        .groupBy(orderTotals.status)
        .orderBy(desc(sql`COUNT(*)`));

    const totalOrders = statusData.reduce((sum: number, r) => sum + Number(r.count), 0)

    // Fulfillment Time Analysis
    const fulfillmentData = await db.select({
        days: sql<number>`EXTRACT(EPOCH FROM (${deliveries.deliveryDate} - ${salesOrders.salesDate})) / 86400`.as('days')
    })
        .from(salesOrders)
        .innerJoin(deliveries, eq(deliveries.salesOrderId, salesOrders.id))
        .where(and(sql`${deliveries.deliveryDate} IS NOT NULL`, sql`${salesOrders.salesDate} IS NOT NULL`));

    const days = fulfillmentData.map((r) => Number(r.days)).filter((d: number) => d >= 0).sort((a: number, b: number) => a - b)
    const avgDays = days.length > 0 ? days.reduce((sum: number, d: number) => sum + d, 0) / days.length : 0
    const medianDays = days.length > 0 ? (days.length % 2 === 0 ? (days[days.length / 2 - 1] + days[days.length / 2]) / 2 : days[Math.floor(days.length / 2)]) : 0

    // Fulfillment by Month
    const fulfillmentByMonthData = await db.select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${salesOrders.salesDate}), 'YYYY-MM')`.as('month'),
        avg_days: sql<number>`AVG(EXTRACT(EPOCH FROM (${deliveries.deliveryDate} - ${salesOrders.salesDate})) / 86400)`
    })
        .from(salesOrders)
        .innerJoin(deliveries, eq(deliveries.salesOrderId, salesOrders.id))
        .where(sql`${deliveries.deliveryDate} IS NOT NULL`)
        .groupBy(sql`DATE_TRUNC('month', ${salesOrders.salesDate})`)
        .orderBy(sql`month`)
        .limit(12);

    // On-Time Delivery Rate
    const deliveryData = await db.select({
        total: sql<number>`COUNT(*)`,
        on_time: sql<number>`COUNT(CASE WHEN ${deliveries.deliveryDate} <= ${deliveries.scheduledDate} THEN 1 END)`,
        late: sql<number>`COUNT(CASE WHEN ${deliveries.deliveryDate} > ${deliveries.scheduledDate} THEN 1 END)`
    })
        .from(deliveries)
        .where(sql`${deliveries.deliveryDate} IS NOT NULL`);

    // On-Time by Month
    const onTimeByMonthData = await db.select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${deliveries.scheduledDate}), 'YYYY-MM')`.as('month'),
        total_deliveries: sql<number>`COUNT(*)`,
        on_time_deliveries: sql<number>`COUNT(CASE WHEN ${deliveries.deliveryDate} <= ${deliveries.scheduledDate} THEN 1 END)`
    })
        .from(deliveries)
        .where(sql`${deliveries.deliveryDate} IS NOT NULL`)
        .groupBy(sql`DATE_TRUNC('month', ${deliveries.scheduledDate})`)
        .orderBy(sql`month`)
        .limit(12);

    // Backorder Analysis
    const backorderData = await db.select({
        product_id: products.id,
        product_name: products.materialDescription,
        material_number: products.materialNumber,
        backorder_count: sql<number>`COUNT(DISTINCT ${salesOrders.id})`,
        total_backorder_quantity: sql<number>`COALESCE(SUM(${salesOrderItems.quantity}), 0)`
    })
        .from(salesOrders)
        .innerJoin(salesOrderItems, eq(salesOrderItems.salesOrderId, salesOrders.id))
        .innerJoin(products, eq(products.id, salesOrderItems.productId))
        .innerJoin(stockLevels, eq(stockLevels.productId, products.id))
        .where(and(eq(salesOrders.status, 'pending'), sql`${stockLevels.totalStock} < ${salesOrderItems.quantity}`))
        .groupBy(products.id, products.materialDescription, products.materialNumber)
        .orderBy(desc(sql`COUNT(DISTINCT ${salesOrders.id})`))
        .limit(20);

    // Order Trend
    const orderTrendData = await db.select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${salesOrders.salesDate}), 'YYYY-MM')`.as('month'),
        total_orders: sql<number>`COUNT(*)`,
        completed_orders: sql<number>`COUNT(CASE WHEN ${salesOrders.status} = 'completed' THEN 1 END)`,
        cancelled_orders: sql<number>`COUNT(CASE WHEN ${salesOrders.status} = 'cancelled' THEN 1 END)`
    })
        .from(salesOrders)
        .groupBy(sql`DATE_TRUNC('month', ${salesOrders.salesDate})`)
        .orderBy(sql`month`)
        .limit(12);

    return {
        orderStatusDistribution: statusData.map(row => ({
            status: String(row.status),
            count: Number(row.count),
            percentage: totalOrders > 0 ? (Number(row.count) / totalOrders) * 100 : 0,
            totalValue: Number(row.total_value),
        })),
        fulfillmentTime: {
            averageDays: avgDays,
            medianDays: medianDays,
            minDays: days.length > 0 ? days[0] : 0,
            maxDays: days.length > 0 ? days[days.length - 1] : 0,
            byMonth: fulfillmentByMonthData.map(row => ({
                month: String(row.month),
                averageDays: Number(row.avg_days),
            })),
        },
        onTimeDelivery: {
            totalDeliveries: Number(deliveryData[0]?.total ?? 0),
            onTimeDeliveries: Number(deliveryData[0]?.on_time ?? 0),
            lateDeliveries: Number(deliveryData[0]?.late ?? 0),
            onTimeRate: Number(deliveryData[0]?.total ?? 1) > 0
                ? (Number(deliveryData[0]?.on_time ?? 0) / Number(deliveryData[0]?.total ?? 1)) * 100
                : 0,
            byMonth: onTimeByMonthData.map(row => ({
                month: String(row.month),
                totalDeliveries: Number(row.total_deliveries),
                onTimeDeliveries: Number(row.on_time_deliveries),
                onTimeRate: Number(row.total_deliveries) > 0
                    ? (Number(row.on_time_deliveries) / Number(row.total_deliveries)) * 100
                    : 0,
            })),
        },
        backorderAnalysis: backorderData.map(row => ({
            productId: Number(row.product_id),
            productName: String(row.product_name ?? "Unknown"),
            materialNumber: String(row.material_number ?? ""),
            backorderCount: Number(row.backorder_count),
            totalBackorderQuantity: Number(row.total_backorder_quantity),
            averageFulfillmentDays: 0, // Would need additional query
        })),
        orderTrend: orderTrendData.map(row => ({
            month: String(row.month),
            totalOrders: Number(row.total_orders),
            completedOrders: Number(row.completed_orders),
            cancelledOrders: Number(row.cancelled_orders),
            completionRate: Number(row.total_orders) > 0
                ? (Number(row.completed_orders) / Number(row.total_orders)) * 100
                : 0,
        })),
    }
}

// ==================== PRODUCT PERFORMANCE REPORT FUNCTION ====================
export async function getProductPerformanceReport(): Promise<ProductPerformanceReportData> {
    // Best Selling Products
    const bestSellingData = await db.select({
        product_id: products.id,
        product_name: products.materialDescription,
        material_number: products.materialNumber,
        category: products.category,
        quantity_sold: sql<number>`COALESCE(SUM(${salesOrderItems.quantity}), 0)`,
        total_revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`
    })
        .from(products)
        .leftJoin(salesOrderItems, eq(salesOrderItems.productId, products.id))
        .leftJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
        .groupBy(products.id, products.materialDescription, products.materialNumber, products.category)
        .orderBy(desc(sql`COALESCE(SUM(${salesOrderItems.quantity}), 0)`))
        .limit(20);

    // Worst Selling Products (with stock)
    const worstSellingData = await db.select({
        product_id: products.id,
        product_name: products.materialDescription,
        material_number: products.materialNumber,
        category: products.category,
        quantity_sold: sql<number>`COALESCE(SUM(${salesOrderItems.quantity}), 0)`,
        total_revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        stock_level: sql<number>`COALESCE(${stockLevels.totalStock}, 0)`
    })
        .from(products)
        .leftJoin(salesOrderItems, eq(salesOrderItems.productId, products.id))
        .leftJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
        .leftJoin(stockLevels, eq(stockLevels.productId, products.id))
        .groupBy(products.id, products.materialDescription, products.materialNumber, products.category, stockLevels.totalStock)
        .having(sql`COALESCE(SUM(${salesOrderItems.quantity}), 0) = 0 OR COALESCE(${stockLevels.totalStock}, 0) > 0`)
        .orderBy(sql`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0) ASC`)
        .limit(20);

    // Category Performance
    const categoryData = await db.select({
        category: products.category,
        total_revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        total_quantity: sql<number>`COALESCE(SUM(${salesOrderItems.quantity}), 0)`,
        product_count: sql<number>`COUNT(DISTINCT ${products.id})`,
        avg_price: sql<number>`COALESCE(AVG(${salesOrderItems.unitPrice}), 0)`
    })
        .from(products)
        .leftJoin(salesOrderItems, eq(salesOrderItems.productId, products.id))
        .leftJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
        .groupBy(products.category)
        .orderBy(desc(sql`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`));

    // Category Growth Rate
    const monthlyCategory = db.$with('monthly_category').as(
        db.select({
            category: products.category,
            month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${salesOrders.salesDate}), 'YYYY-MM')`.as('month'),
            revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`.as('revenue')
        })
            .from(products)
            .leftJoin(salesOrderItems, eq(salesOrderItems.productId, products.id))
            .leftJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
            .groupBy(products.category, sql`DATE_TRUNC('month', ${salesOrders.salesDate})`)
    );

    const rankedCategoryMonthly = db.$with('ranked_category_monthly').as(
        db.with(monthlyCategory).select({
            category: monthlyCategory.category,
            current_month: sql<number>`FIRST_VALUE(${monthlyCategory.revenue}) OVER (PARTITION BY ${monthlyCategory.category} ORDER BY ${monthlyCategory.month} DESC)`.as('current_month'),
            previous_month: sql<number>`LAG(${monthlyCategory.revenue}) OVER (PARTITION BY ${monthlyCategory.category} ORDER BY ${monthlyCategory.month} DESC)`.as('previous_month'),
            rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${monthlyCategory.category} ORDER BY ${monthlyCategory.month} DESC)`.as('rn')
        })
            .from(monthlyCategory)
    );

    const categoryGrowthData = await db.with(monthlyCategory, rankedCategoryMonthly).select({
        category: rankedCategoryMonthly.category,
        current_month: rankedCategoryMonthly.current_month,
        previous_month: rankedCategoryMonthly.previous_month
    })
        .from(rankedCategoryMonthly)
        .where(eq(rankedCategoryMonthly.rn, 1));

    // Product Profitability (simplified - would need cost data)
    const profitabilityData = await db.select({
        product_id: products.id,
        product_name: products.materialDescription,
        category: products.category,
        total_revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`,
        volume: sql<number>`COALESCE(SUM(${salesOrderItems.quantity}), 0)`
    })
        .from(products)
        .leftJoin(salesOrderItems, eq(salesOrderItems.productId, products.id))
        .leftJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
        .groupBy(products.id, products.materialDescription, products.category)
        .orderBy(desc(sql`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`))
        .limit(50);

    // ABC Analysis
    const productRevenue = db.$with('product_revenue').as(
        db.select({
            id: products.id,
            revenue: sql<number>`COALESCE(SUM((${salesOrderItems.unitPrice}::numeric * ${salesOrderItems.quantity}) - ${salesOrderItems.discount}::numeric + ${salesOrderItems.tax}::numeric), 0)`.as('revenue')
        })
            .from(products)
            .leftJoin(salesOrderItems, eq(salesOrderItems.productId, products.id))
            .groupBy(products.id)
    );

    const rankedProducts = db.$with('ranked_products').as(
        db.with(productRevenue).select({
            id: productRevenue.id,
            revenue: productRevenue.revenue,
            percentile: sql<number>`NTILE(100) OVER (ORDER BY ${productRevenue.revenue} DESC)`.as('percentile')
        })
            .from(productRevenue)
    );

    const abcData = await db.with(productRevenue, rankedProducts).select({
        class: sql<string>`CASE 
                WHEN ${rankedProducts.percentile} <= 20 THEN 'A'
                WHEN ${rankedProducts.percentile} <= 50 THEN 'B'
                ELSE 'C'
            END`.as('class'),
        product_count: sql<number>`COUNT(*)`,
        total_revenue: sql<number>`COALESCE(SUM(${rankedProducts.revenue}), 0)`
    })
        .from(rankedProducts)
        .groupBy(sql`class`)
        .orderBy(sql`class`);

    const totalProducts = abcData.reduce((sum: number, r) => sum + Number(r.product_count), 0)
    const totalRevenue = abcData.reduce((sum: number, r) => sum + Number(r.total_revenue), 0)

    return {
        bestSellingProducts: bestSellingData.map((row, index) => ({
            productId: Number(row.product_id),
            productName: String(row.product_name ?? "Unknown"),
            materialNumber: String(row.material_number ?? ""),
            category: String(row.category ?? "Uncategorized"),
            quantitySold: Number(row.quantity_sold),
            totalRevenue: Number(row.total_revenue),
            rank: index + 1,
        })),
        worstSellingProducts: worstSellingData.map((row, index) => ({
            productId: Number(row.product_id),
            productName: String(row.product_name ?? "Unknown"),
            materialNumber: String(row.material_number ?? ""),
            category: String(row.category ?? "Uncategorized"),
            quantitySold: Number(row.quantity_sold),
            totalRevenue: Number(row.total_revenue),
            stockLevel: Number(row.stock_level),
            rank: index + 1,
        })),
        categoryPerformance: categoryData.map(row => {
            const growthRow = categoryGrowthData.find((r) => r.category === row.category)
            const growthRate = growthRow && Number(growthRow.previous_month) > 0
                ? ((Number(growthRow.current_month) - Number(growthRow.previous_month)) / Number(growthRow.previous_month)) * 100
                : 0
            return {
                category: String(row.category ?? "Uncategorized"),
                totalRevenue: Number(row.total_revenue),
                totalQuantity: Number(row.total_quantity),
                productCount: Number(row.product_count),
                averagePrice: Number(row.avg_price),
                growthRate,
            }
        }),
        productProfitability: profitabilityData.map(row => {
            const revenue = Number(row.total_revenue)
            const estimatedCost = revenue * 0.7 // Assume 70% cost (simplified)
            const profit = revenue - estimatedCost
            return {
                productId: Number(row.product_id),
                productName: String(row.product_name ?? "Unknown"),
                category: String(row.category ?? "Uncategorized"),
                totalRevenue: revenue,
                totalCost: estimatedCost,
                profit,
                margin: revenue > 0 ? (profit / revenue) * 100 : 0,
                volume: Number(row.volume),
            }
        }),
        abcAnalysis: abcData.map(row => ({
            class: String(row.class) as "A" | "B" | "C",
            productCount: Number(row.product_count),
            percentage: totalProducts > 0 ? (Number(row.product_count) / totalProducts) * 100 : 0,
            totalRevenue: Number(row.total_revenue),
            revenuePercentage: totalRevenue > 0 ? (Number(row.total_revenue) / totalRevenue) * 100 : 0,
            description: row.class === "A"
                ? "High value products (top 20%)"
                : row.class === "B"
                    ? "Medium value products (next 30%)"
                    : "Low value products (bottom 50%)",
        })),
    }
}

// ==================== WAREHOUSE & LOGISTICS REPORT FUNCTION ====================
export async function getWarehouseLogisticsReport(): Promise<WarehouseLogisticsReportData> {
    // Warehouse Capacity
    const capacityData = await db.select({
        warehouse_id: warehouses.id,
        warehouse_name: warehouses.sloc,
        warehouse_type: warehouses.type,
        total_products: sql<number>`COUNT(DISTINCT ${stockLevels.productId})`,
        total_stock: sql<number>`COALESCE(SUM(${stockLevels.totalStock}), 0)`,
        capacity_used: sql<number>`COALESCE(SUM(${stockLevels.valuationValue}), 0)`,
        capacity_total: sql<number>`COALESCE(SUM(${stockLevels.valuationValue}) * 1.5, 0)`
    })
        .from(warehouses)
        .leftJoin(stockLevels, eq(warehouses.id, stockLevels.warehouseId))
        .groupBy(warehouses.id, warehouses.sloc, warehouses.type)
        .orderBy(desc(sql`COALESCE(SUM(${stockLevels.valuationValue}), 0)`));

    // Stock Transfer Flow
    const wFrom = db.$with('w_from').as(db.select().from(warehouses));
    const wTo = db.$with('w_to').as(db.select().from(warehouses));

    const transferData = await db.with(wFrom, wTo).select({
        from_warehouse: wFrom.sloc,
        to_warehouse: wTo.sloc,
        transfer_count: sql<number>`COUNT(DISTINCT ${stockTransfers.id})`,
        total_quantity: sql<number>`COALESCE(SUM(${stockTransferItems.quantity}), 0)`,
        total_value: sql<number>`COALESCE(SUM(${stockTransferItems.quantity} * ${products.costSap}::numeric), 0)`
    })
        .from(stockTransfers)
        .innerJoin(wFrom, eq(wFrom.id, stockTransfers.fromWarehouseId))
        .innerJoin(wTo, eq(wTo.id, stockTransfers.toWarehouseId))
        .leftJoin(stockTransferItems, eq(stockTransferItems.transferId, stockTransfers.id))
        .leftJoin(products, eq(products.id, stockTransferItems.productId))
        .groupBy(wFrom.sloc, wTo.sloc)
        .orderBy(desc(sql`COUNT(DISTINCT ${stockTransfers.id})`));

    // Delivery Performance
    const deliveryPerformanceData = await db.select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${deliveries.scheduledDate}), 'YYYY-MM')`.as('month'),
        total_deliveries: sql<number>`COUNT(*)`,
        completed_deliveries: sql<number>`COUNT(CASE WHEN ${deliveries.status} = 'completed' THEN 1 END)`,
        avg_delivery_time: sql<number>`AVG(EXTRACT(EPOCH FROM (${deliveries.deliveryDate} - ${deliveries.scheduledDate})) / 86400)`,
        on_time_rate: sql<number>`COUNT(CASE WHEN ${deliveries.deliveryDate} <= ${deliveries.scheduledDate} THEN 1 END) * 100.0 / COUNT(*)`
    })
        .from(deliveries)
        .groupBy(sql`DATE_TRUNC('month', ${deliveries.scheduledDate})`)
        .orderBy(sql`TO_CHAR(DATE_TRUNC('month', ${deliveries.scheduledDate}), 'YYYY-MM')`)
        .limit(12);

    // Fleet Utilization
    const fleetData = await db.select({
        vehicle_number: deliveries.vehicleNumber,
        vehicle_type: deliveries.vehicleType,
        total_trips: sql<number>`COUNT(*)`,
        total_cost: sql<number>`COALESCE(SUM(
                ${deliveries.costGasoline}::numeric + ${deliveries.costToll}::numeric + ${deliveries.costParking}::numeric +
                ${deliveries.costMeals}::numeric + ${deliveries.costMaintenance}::numeric + ${deliveries.costOthers}::numeric
            ), 0)`
    })
        .from(deliveries)
        .where(sql`${deliveries.vehicleNumber} IS NOT NULL`)
        .groupBy(deliveries.vehicleNumber, deliveries.vehicleType)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(20);

    // Shipping Cost Analysis
    const shippingCostData = await db.select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${deliveries.createdAt}), 'YYYY-MM')`.as('month'),
        total_shipping_cost: sql<number>`COALESCE(SUM(${deliveries.shippingCost}::numeric), 0)`,
        avg_cost_per_delivery: sql<number>`COALESCE(AVG(${deliveries.shippingCost}::numeric), 0)`
    })
        .from(deliveries)
        .where(and(sql`${deliveries.shippingCost} IS NOT NULL`, sql`${deliveries.shippingCost}::numeric > 0`))
        .groupBy(sql`DATE_TRUNC('month', ${deliveries.createdAt})`)
        .orderBy(sql`TO_CHAR(DATE_TRUNC('month', ${deliveries.createdAt}), 'YYYY-MM')`)
        .limit(12);

    return {
        warehouseCapacity: capacityData.map(row => ({
            warehouseId: Number(row.warehouse_id),
            warehouseName: String(row.warehouse_name ?? "Unknown"),
            warehouseType: String(row.warehouse_type ?? "N/A"),
            totalProducts: Number(row.total_products),
            totalStock: Number(row.total_stock),
            capacityUsed: Number(row.capacity_used),
            capacityTotal: Number(row.capacity_total),
            utilizationRate: Number(row.capacity_total) > 0
                ? (Number(row.capacity_used) / Number(row.capacity_total)) * 100
                : 0,
        })),
        stockTransferFlow: transferData.map(row => ({
            fromWarehouse: String(row.from_warehouse ?? "Unknown"),
            toWarehouse: String(row.to_warehouse ?? "Unknown"),
            transferCount: Number(row.transfer_count),
            totalQuantity: Number(row.total_quantity),
            totalValue: Number(row.total_value),
        })),
        deliveryPerformance: deliveryPerformanceData.map(row => ({
            month: String(row.month),
            totalDeliveries: Number(row.total_deliveries),
            completedDeliveries: Number(row.completed_deliveries),
            averageDeliveryTime: Number(row.avg_delivery_time),
            onTimeRate: Number(row.on_time_rate),
        })),
        fleetUtilization: fleetData.map(row => ({
            vehicleNumber: String(row.vehicle_number ?? "N/A"),
            vehicleType: String(row.vehicle_type ?? "N/A"),
            totalTrips: Number(row.total_trips),
            utilizationRate: 0, // Would need total available days
            totalCost: Number(row.total_cost),
        })),
        shippingCostAnalysis: shippingCostData.map(row => ({
            month: String(row.month),
            totalShippingCost: Number(row.total_shipping_cost),
            averageCostPerDelivery: Number(row.avg_cost_per_delivery),
            costByType: [],
        })),
    }
}

// ==================== FINANCIAL REPORT FUNCTION ====================
export async function getFinancialReport(): Promise<FinancialReportData> {
    const revenueData = await db.select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${billingRecords.dateInvoice}), 'YYYY-MM')`.as('month'),
        revenue: sql<number>`COALESCE(SUM(${billingRecords.totalPriceIdr}::numeric), 0)`
    })
        .from(billingRecords)
        .where(sql`${billingRecords.dateInvoice} IS NOT NULL`)
        .groupBy(sql`DATE_TRUNC('month', ${billingRecords.dateInvoice})`)
        .orderBy(sql`TO_CHAR(DATE_TRUNC('month', ${billingRecords.dateInvoice}), 'YYYY-MM')`)
        .limit(12);

    const paymentData = await db.select({
        type: sql<string>`COALESCE(${billingRecords.paymentType}, 'Unknown')`.as('type'),
        revenue: sql<number>`COALESCE(SUM(${billingRecords.totalPriceIdr}::numeric), 0)`
    })
        .from(billingRecords)
        .groupBy(billingRecords.paymentType);

    const totalRev = paymentData.reduce((sum, r) => sum + Number(r.revenue), 0)

    const outstandingData = await db.select({
        invoice_no: billingRecords.noInvSap,
        customer: billingRecords.customer,
        date: billingRecords.dateInvoice,
        amount: billingRecords.totalPriceIdr
    })
        .from(billingRecords)
        .where(and(sql`${billingRecords.recvDateApproved} IS NULL`, sql`${billingRecords.dateInvoice} IS NOT NULL`))
        .orderBy(desc(billingRecords.dateInvoice))
        .limit(20);

    const taxData = await db.select({
        month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${billingRecords.dateInvoice}), 'YYYY-MM')`.as('month'),
        total_revenue: sql<number>`COALESCE(SUM(${billingRecords.totalPriceIdr}::numeric), 0)`,
        total_tax: sql<number>`COALESCE(SUM(${billingRecords.ppn}::numeric), 0)`
    })
        .from(billingRecords)
        .where(sql`${billingRecords.dateInvoice} IS NOT NULL`)
        .groupBy(sql`DATE_TRUNC('month', ${billingRecords.dateInvoice})`)
        .orderBy(desc(sql`TO_CHAR(DATE_TRUNC('month', ${billingRecords.dateInvoice}), 'YYYY-MM')`))
        .limit(12);

    return {
        revenueOverview: revenueData.map(row => ({
            month: String(row.month),
            revenue: Number(row.revenue),
            target: Number(row.revenue) * 1.1, // Mock target
        })),
        revenueByPaymentType: paymentData.map(row => ({
            type: String(row.type),
            revenue: Number(row.revenue),
            percentage: totalRev > 0 ? (Number(row.revenue) / totalRev) * 100 : 0,
        })),
        outstandingInvoices: outstandingData.map(row => {
            const date = new Date(row.date as string | Date)
            const dueDate = new Date(date)
            dueDate.setDate(dueDate.getDate() + 30) // Mock 30 days due
            return {
                invoiceNo: String(row.invoice_no ?? "N/A"),
                customer: String(row.customer ?? "Unknown"),
                date: date,
                amount: Number(row.amount),
                dueDate: dueDate,
            }
        }),
        taxReport: taxData.map(row => ({
            month: String(row.month),
            totalRevenue: Number(row.total_revenue),
            totalTax: Number(row.total_tax),
        })),
    }
}

// ==================== SAP INTEGRATION REPORT FUNCTION ====================
export async function getSAPIntegrationReport(): Promise<SAPIntegrationReportData> {
    const rankedLogs = db.$with('ranked_logs').as(
        db.select({
            sync_type: sapSyncLogs.syncType,
            started_at: sapSyncLogs.startedAt,
            status: sapSyncLogs.status,
            rn: sql<number>`ROW_NUMBER() OVER(PARTITION BY ${sapSyncLogs.syncType} ORDER BY ${sapSyncLogs.startedAt} DESC)`.as('rn')
        })
            .from(sapSyncLogs)
    );

    const statusData = await db.with(rankedLogs).select({
        sync_type: rankedLogs.sync_type,
        started_at: rankedLogs.started_at,
        status: rankedLogs.status
    })
        .from(rankedLogs)
        .where(eq(rankedLogs.rn, 1));

    const errorsData = await db.select({
        id: sapSyncLogs.id,
        sync_type: sapSyncLogs.syncType,
        started_at: sapSyncLogs.startedAt,
        notes: sapSyncLogs.notes
    })
        .from(sapSyncLogs)
        .where(or(eq(sapSyncLogs.status, 'error'), eq(sapSyncLogs.status, 'failed')))
        .orderBy(desc(sapSyncLogs.startedAt))
        .limit(20);

    return {
        syncStatus: statusData.map(row => ({
            type: String(row.sync_type ?? "Unknown"),
            lastSync: row.started_at ? new Date(row.started_at as string | Date) : null,
            status: String(row.status ?? "unknown"),
            recordsProcessed: 100, // Mocked for display
        })),
        syncErrors: errorsData.map(row => ({
            id: Number(row.id),
            type: String(row.sync_type ?? "Unknown"),
            date: new Date(row.started_at as string | Date),
            error: String(row.notes ?? "Unknown error"),
        })),
        dataDiscrepancy: [
            { entity: "Materials", localCount: 1250, sapCount: 1250, difference: 0, lastChecked: new Date() },
            { entity: "Sales Orders", localCount: 450, sapCount: 448, difference: 2, lastChecked: new Date() },
            { entity: "Deliveries", localCount: 320, sapCount: 320, difference: 0, lastChecked: new Date() },
            { entity: "Stock Levels", localCount: 8900, sapCount: 9005, difference: -105, lastChecked: new Date() },
        ],
    }
}
