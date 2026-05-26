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

export type TireSizeData = {
    tireSize: string
    qty: number
    amount: number
}

export type SlowMovingDashboardResult = {
    yearlyTrend: TrendData[]
    monthlyTrend: TrendData[]
    topSalesman: SalesmanData[]
    topCustomers: CustomerData[]
    topCategories: CategoryData[]
    topTireSizes: TireSizeData[]
    summary: {
        totalQty: number
        totalAmount: number
    }
}

export async function getSlowMovingDashboardData(
    selectedYears: string[] = ["2025", "2026"],
    selectedTireSize?: string,
    selectedCategory?: string
): Promise<SlowMovingDashboardResult> {
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
            topTireSizes: [],
            summary: { totalQty: 0, totalAmount: 0 }
        }
    }

    const upperKeys = keys.map(k => k.toUpperCase())
    const safeList = upperKeys.map(k => k.replace(/'/g, "''")).map(k => "'" + k + "'").join(",")

    // Base conditions
    const baseWhere = `billing_date IS NOT NULL AND (cancelled IS NULL OR cancelled = '') AND UPPER(TRIM(material_no)) = ANY(ARRAY[${safeList}])`
    
    // Extractor for Tire Size from material_description
    const TIRE_SIZE_EXTRACTOR = `COALESCE(
        SUBSTRING(material_description FROM '^[0-9]+(?:\\.[0-9]+)?(?:/[0-9]+)?\\s*[R\\-]\\s*[0-9]+(?:\\.[0-9]+)?(?:\\s*/[0-9]+(?:\\.[0-9]+)?)?'),
        size_dimen,
        'UNKNOWN'
    )`

    // Filter by selected years
    const yearCondition = selectedYears.length > 0 
        ? ` AND TO_CHAR(billing_date, 'YYYY') = ANY(ARRAY[${selectedYears.map(y => `'${y.replace(/'/g, "''")}'`).join(",")}])` 
        : ""

    // Filter by Tire Size and Category
    const filtersCondition = `
        ${selectedTireSize && selectedTireSize !== "ALL" ? ` AND ${TIRE_SIZE_EXTRACTOR} = '${selectedTireSize.replace(/'/g, "''")}'` : ""}
        ${selectedCategory && selectedCategory !== "ALL" ? ` AND COALESCE(mat_grp_desc, 'UNKNOWN') = '${selectedCategory.replace(/'/g, "''")}'` : ""}
    `

    // 1. Yearly Trend (Always get all years for high-level view)
    const yearlyTrendResult = await db.execute(sql.raw(`
        SELECT 
            TO_CHAR(billing_date, 'YYYY') AS period, 
            SUM(qty) AS total_qty, 
            SUM(revenue_in_doc_curr) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${filtersCondition}
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
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
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
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
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
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
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
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
    `))

    // 6. Top Categories
    const categoryResult = await db.execute(sql.raw(`
        SELECT 
            COALESCE(mat_grp_desc, 'UNKNOWN') AS category, 
            SUM(qty) AS total_qty, 
            SUM(revenue_in_doc_curr) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
        GROUP BY COALESCE(mat_grp_desc, 'UNKNOWN')
        ORDER BY SUM(revenue_in_doc_curr) DESC
        LIMIT 10
    `))

    // 7. Top Tire Sizes
    const tireSizeResult = await db.execute(sql.raw(`
        SELECT 
            ${TIRE_SIZE_EXTRACTOR} AS tireSize, 
            SUM(qty) AS total_qty, 
            SUM(revenue_in_doc_curr) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
        GROUP BY ${TIRE_SIZE_EXTRACTOR}
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
            totalAmount: Number(summaryResult.rows[0]?.total_amount) || 0,
        },
        topTireSizes: tireSizeResult.rows.map(r => ({
            tireSize: String(r.tiresize),
            qty: Number(r.total_qty),
            amount: Number(r.total_amount)
        }))
    }
}

export async function getSlowMovingFilters() {
    await getAuthenticatedSession("marketing", "view")

    // Get slow moving material keys
    const products = await db.execute(sql`SELECT material_key FROM slow_moving_products`)
    const keys = (products.rows as { material_key: string }[]).map(r => r.material_key)
    
    if (keys.length === 0) return { tireSizes: [], categories: [] }

    const upperKeys = keys.map(k => k.toUpperCase())
    const safeList = upperKeys.map(k => k.replace(/'/g, "''")).map(k => "'" + k + "'").join(",")
    const baseWhere = `billing_date IS NOT NULL AND (cancelled IS NULL OR cancelled = '') AND UPPER(TRIM(material_no)) = ANY(ARRAY[${safeList}])`

    const TIRE_SIZE_EXTRACTOR = `COALESCE(
        SUBSTRING(material_description FROM '^[0-9]+(?:\\.[0-9]+)?(?:/[0-9]+)?\\s*[R\\-]\\s*[0-9]+(?:\\.[0-9]+)?(?:\\s*/[0-9]+(?:\\.[0-9]+)?)?'),
        size_dimen,
        'UNKNOWN'
    )`

    const sizesResult = await db.execute(sql.raw(`
        SELECT DISTINCT ${TIRE_SIZE_EXTRACTOR} AS size_dimen
        FROM sales_revenue_sap
        WHERE ${baseWhere} AND ${TIRE_SIZE_EXTRACTOR} != 'UNKNOWN'
        ORDER BY size_dimen
    `))

    const categoriesResult = await db.execute(sql.raw(`
        SELECT DISTINCT COALESCE(mat_grp_desc, 'UNKNOWN') AS category
        FROM sales_revenue_sap
        WHERE ${baseWhere}
        ORDER BY category
    `))

    return {
        tireSizes: sizesResult.rows.map(r => String(r.size_dimen)),
        categories: categoriesResult.rows.map(r => String(r.category))
    }
}


export async function generateSlowMovingYoYInsight(trendData: any[], selectedYears: string[]): Promise<{ success: boolean; insight?: string; error?: string }> {
    try {
        await getAuthenticatedSession("marketing", "view")

        const endpoint = process.env.NINEROUTER_URL 
            ? `${process.env.NINEROUTER_URL.replace(/\/$/, "")}/chat/completions` 
            : "https://9router.chitraparatama.com/v1/chat/completions"
        const apiKey = process.env.NINEROUTER_KEY || "sk-ee87ff36bc463f56-sxrwh0-272f06c4"
        const aiModel = "combo"

        const dataStr = trendData.map(m => {
            let row = `Bulan ${m.month}: `
            selectedYears.forEach(y => {
                row += `[Thn ${y} -> Qty: ${m[`qty_${y}`] || 0}, Revenue: Rp${m[`amount_${y}`] || 0}] `
            })
            return row
        }).join("\n")

        const prompt = `Sebagai Senior Data Analyst di One Chitra, berikan insight ringkas dan tajam mengenai tren Year-over-Year (YoY) performa barang slow moving berikut.\n\nData Per Bulan:\n${dataStr}\n\nTugas Anda:
1. Bandingkan performa antar tahun (${selectedYears.join(" vs ")}).
2. Temukan pola lonjakan atau penurunan drastis.
3. Berikan rekomendasi singkat untuk strategi cuci gudang/promosi.
Aturan: Gunakan bahasa Indonesia profesional dan padat. Format output menggunakan HTML ringan (seperti <b>, <ul><li>, <br>) agar rapi di UI. Jangan pakai markdown backticks.`

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: aiModel,
                messages: [{ role: "user", content: prompt }],
                stream: false,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error("9Router HTTP Error:", response.status, errorText)
            throw new Error(`Status ${response.status}: ${errorText}`)
        }

        const json = await response.json()
        let content = String(json.choices?.[0]?.message?.content || json.message?.content || "")
        
        // Clean up markdown block if present
        content = content.replace(/```html/gi, "").replace(/```/g, "").trim()

        return { success: true, insight: content }
    } catch (err: any) {
        console.error("YoY AI Insight Error:", err)
        return { success: false, error: err.message || "Terjadi kesalahan pada AI Service" }
    }
}
