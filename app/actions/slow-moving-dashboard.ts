"use server"

import { db } from "@/db"
import { getAuthenticatedSession } from "@/lib/rbac"
import { sql } from "drizzle-orm"

export type TrendData = {
    period: string
    qty: number
    amount: number
}

export type SalesmanData = {
    salesman: string
    qty: number
    amount: number
}

export type CustomerData = {
    customerName: string
    qty: number
    amount: number
}

export type CategoryData = {
    category: string
    qty: number
    amount: number
}

export type SlowMovingDashboardResult = {
    yearlyTrend: TrendData[]
    monthlyTrend: TrendData[]
    topSalesman: SalesmanData[]
    topCustomers: CustomerData[]
    topCategories: CategoryData[]
    summary: {
        totalQty: number
        totalAmount: number
    }
}

export async function getSlowMovingDashboardData(selectedYears: string[] = ["2025", "2026"]): Promise<SlowMovingDashboardResult> {
    await getAuthenticatedSession("marketing", "view")

    // Get slow moving material keys
    const products = await db.execute(sql`SELECT material_key FROM slow_moving_products`)
    const keys = (products.rows as { material_key: string }[]).map(r => r.material_key)
    
    if (keys.length === 0) {
        return {
            yearlyTrend: [],
            monthlyTrend: [],
            topSalesman: [],
            topCustomers: [],
            topCategories: [],
            summary: { totalQty: 0, totalAmount: 0 }
        }
    }

    const upperKeys = keys.map(k => k.toUpperCase())
    const safeList = upperKeys.map(k => k.replace(/'/g, "''")).map(k => "'" + k + "'").join(",")

    // Base conditions
    const baseWhere = `billing_date IS NOT NULL AND (cancelled IS NULL OR cancelled = '') AND UPPER(TRIM(material_no)) = ANY(ARRAY[${safeList}])`
    
    // Filter by selected years
    const yearCondition = selectedYears.length > 0 
        ? ` AND TO_CHAR(billing_date, 'YYYY') = ANY(ARRAY[${selectedYears.map(y => `'${y.replace(/'/g, "''")}'`).join(",")}])` 
        : ""

    // 1. Yearly Trend (Always get all years for high-level view)
    const yearlyTrendResult = await db.execute(sql.raw(`
        SELECT 
            TO_CHAR(billing_date, 'YYYY') AS period, 
            SUM(qty) AS total_qty, 
            SUM(revenue_in_doc_curr) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere}
        GROUP BY TO_CHAR(billing_date, 'YYYY')
        ORDER BY TO_CHAR(billing_date, 'YYYY')
    `))

    // 2. Monthly Trend (Based on selected year, or all if none)
    const monthlyTrendResult = await db.execute(sql.raw(`
        SELECT 
            TO_CHAR(billing_date, 'YYYY-MM') AS period, 
            SUM(qty) AS total_qty, 
            SUM(revenue_in_doc_curr) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${yearCondition}
        GROUP BY TO_CHAR(billing_date, 'YYYY-MM')
        ORDER BY TO_CHAR(billing_date, 'YYYY-MM')
    `))

    // 3. Top Salesman
    const salesmanResult = await db.execute(sql.raw(`
        SELECT 
            COALESCE(salesman, 'UNKNOWN') AS salesman, 
            SUM(qty) AS total_qty, 
            SUM(revenue_in_doc_curr) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${yearCondition}
        GROUP BY COALESCE(salesman, 'UNKNOWN')
        ORDER BY SUM(revenue_in_doc_curr) DESC
        LIMIT 15
    `))

    // 4. Top Customers
    const customerResult = await db.execute(sql.raw(`
        SELECT 
            COALESCE(customer_name, 'UNKNOWN') AS customer_name, 
            SUM(qty) AS total_qty, 
            SUM(revenue_in_doc_curr) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${yearCondition}
        GROUP BY COALESCE(customer_name, 'UNKNOWN')
        ORDER BY SUM(revenue_in_doc_curr) DESC
        LIMIT 10
    `))

    // 5. Summary Total
    const summaryResult = await db.execute(sql.raw(`
        SELECT 
            SUM(qty) AS total_qty, 
            SUM(revenue_in_doc_curr) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${yearCondition}
    `))

    // 6. Top Categories
    const categoryResult = await db.execute(sql.raw(`
        SELECT 
            COALESCE(mat_grp_desc, 'UNKNOWN') AS category, 
            SUM(qty) AS total_qty, 
            SUM(revenue_in_doc_curr) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${yearCondition}
        GROUP BY COALESCE(mat_grp_desc, 'UNKNOWN')
        ORDER BY SUM(revenue_in_doc_curr) DESC
        LIMIT 10
    `))

    const mapRow = (r: any, nameField: string) => ({
        [nameField]: r.period || r[nameField],
        qty: Number(r.total_qty) || 0,
        amount: Number(r.total_amount) || 0
    })

    return {
        yearlyTrend: yearlyTrendResult.rows.map(r => mapRow(r, "period")) as TrendData[],
        monthlyTrend: monthlyTrendResult.rows.map(r => mapRow(r, "period")) as TrendData[],
        topSalesman: salesmanResult.rows.map(r => mapRow(r, "salesman")) as SalesmanData[],
        topCustomers: customerResult.rows.map(r => mapRow(r, "customerName")) as CustomerData[],
        topCategories: categoryResult.rows.map(r => mapRow(r, "category")) as CategoryData[],
        summary: {
            totalQty: Number(summaryResult.rows[0]?.total_qty) || 0,
            totalAmount: Number(summaryResult.rows[0]?.total_amount) || 0
        }
    }
}
