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
        lastOrderDate?: Date
        recentSales: number
        historicalAverageSales: number
        revenueShare: number
        accountHealth: "Healthy" | "Watch" | "At Risk"
        churnRisk: "Low" | "Medium" | "High"
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
    grossProfitMargin: number
    forecastNextMonth: number
    concentrationTop5: number
}

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
        daysSinceLastOrder: number | null
        accountHealth: "Healthy" | "Watch" | "At Risk"
        churnRisk: "Low" | "Medium" | "High"
        estimatedClv: number
        segment: "VIP" | "Regular" | "Small"
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
    estimatedClv: number
    accountHealthScore: number
}

export type MonthlyScmReportData = {
    period: string
    summary: {
        totalGrManualQty: number
        totalDeliveredQty: number
        totalR49DeliveredQty: number
        totalGrManualTransactions: number
        totalDeliveredTransactions: number
        totalR49Deliveries: number
        totalOutstandingOrders: number
        totalOutstandingQty: number
        totalOutstandingValue: number
    }
    grManualByCategory: {
        category: string
        totalQuantity: number
        transactionCount: number
        totalValue: number
        averageSlaDays: number
        createdBy: string
    }[]
    deliveredByCategory: {
        category: string
        totalQuantity: number
        deliveryCount: number
        totalValue: number
    }[]
    r49ByDelivery: {
        deliveryId: number
        deliveryNumber: string
        deliveryDate: string | null
        customerName: string
        category: string
        totalQuantity: number
        itemCount: number
        totalValue: number
        products: {
            productName: string
            materialNumber: string
            quantity: number
        }[]
    }[]
    outstandingSalesOrders: {
        salesOrderId: number
        orderNumber: string
        salesDate: string | null
        customerName: string
        category: string
        totalQuantity: number
        totalValue: number
        productCount: number
        products: {
            productName: string
            materialNumber: string
            category: string
            quantity: number
            value: number
        }[]
    }[]
}
