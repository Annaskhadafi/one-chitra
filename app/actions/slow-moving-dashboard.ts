"use server"

import { db } from "@/db"
import { getAuthenticatedSession } from "@/lib/rbac"
import { sql } from "drizzle-orm"

const REVENUE_DOC_CURR_AMOUNT = "COALESCE(NULLIF(revenue_in_doc_curr, 'NaN'::float8), 0)"

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

export type MonthlyTireDetail = {
    tireSize: string
    productName: string
    salesman: string
    qty: number
    amount: number
}

export type WatchProduct = {
    materialKey: string
    description: string
    initialStock: number
    totalSold: number
    remainingStock: number
    soldAmount: number
    remainingValue: number
}

export type SlowMovingDashboardResult = {
    yearlyTrend: TrendData[]
    monthlyTrend: TrendData[]
    topSalesman: SalesmanData[]
    topCustomers: CustomerData[]
    topCategories: CategoryData[]
    topTireSizes: TireSizeData[]
    monthlyTireDetail: MonthlyTireDetail[]
    watchProducts: WatchProduct[]
    summary: {
        totalQty: number
        totalAmount: number
    }
}

export async function getSlowMovingDashboardData(
    selectedYears: string[] = ["2025", "2026"],
    selectedTireSize?: string,
    selectedCategory?: string,
    filterMonth?: string
): Promise<SlowMovingDashboardResult> {
    const emptyResult: SlowMovingDashboardResult = {
        yearlyTrend: [],
        monthlyTrend: [],
        topSalesman: [],
        topCustomers: [],
        topCategories: [],
        topTireSizes: [],
        monthlyTireDetail: [],
        watchProducts: [],
        summary: { totalQty: 0, totalAmount: 0 }
    }

    try {
        await getAuthenticatedSession("marketing", "view")
    } catch {
        try {
            await getAuthenticatedSession()
        } catch {
            return emptyResult
        }
    }

    try {
    // Ensure table exists
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "slow_moving_products" (
            "id" serial PRIMARY KEY NOT NULL,
            "material_key" varchar(150) NOT NULL UNIQUE,
            "material_number" varchar(150) NOT NULL,
            "description" text,
            "created_by" text REFERENCES "user"("id"),
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        )
    `)
    await db.execute(sql`ALTER TABLE "slow_moving_products" ADD COLUMN IF NOT EXISTS "initial_stock" integer DEFAULT 0 NOT NULL;`)

    // Get slow moving material keys
    const products = await db.execute(sql`SELECT material_key FROM slow_moving_products`)
    const keys = (products.rows as { material_key: string }[]).map(r => r.material_key)
    
    const upperKeys = keys.map(k => k.toUpperCase())
    const safeList = upperKeys.map(k => k.replace(/'/g, "''")).map(k => "'" + k + "'").join(",")

    // Base conditions (only if we have product keys)
    const baseWhere = keys.length > 0
        ? `billing_date IS NOT NULL AND (cancelled IS NULL OR cancelled = '') AND UPPER(TRIM(material_no)) = ANY(ARRAY[${safeList}])`
        : `billing_date IS NOT NULL AND (cancelled IS NULL OR cancelled = '')`
    
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

    // If no slow moving products, return early with empty result
    if (keys.length === 0) {
        // Still try to get monthly tire detail for the filtered month
        let monthlyTireDetail: MonthlyTireDetail[] = []
        if (filterMonth) {
            try {
                const monthCondition = ` AND TO_CHAR(billing_date, 'YYYY-MM') = '${filterMonth.replace(/'/g, "''")}'`
                const monthlyTireResult = await db.execute(sql.raw(`
                    SELECT 
                        COALESCE(NULLIF(material_description, ''), material_no) AS product_name,
                        ${TIRE_SIZE_EXTRACTOR} AS tireSize, 
                        COALESCE(salesman, 'Unknown') AS sales,
                        SUM(qty) AS total_qty, 
                        SUM(${REVENUE_DOC_CURR_AMOUNT}) AS total_amount
                    FROM sales_revenue_sap 
                    WHERE ${baseWhere} ${monthCondition}
                    GROUP BY COALESCE(NULLIF(material_description, ''), material_no), ${TIRE_SIZE_EXTRACTOR}, COALESCE(salesman, 'Unknown')
                    ORDER BY SUM(${REVENUE_DOC_CURR_AMOUNT}) DESC
                    LIMIT 15
                `))
                monthlyTireDetail = monthlyTireResult.rows.map(r => ({
                    tireSize: String(r.tiresize),
                    productName: String(r.product_name || "-"),
                    salesman: String(r.sales || "-"),
                    qty: Number(r.total_qty),
                    amount: Number(r.total_amount)
                }))
            } catch {}
        }
        return {
            yearlyTrend: [],
            monthlyTrend: [],
            topSalesman: [],
            topCustomers: [],
            topCategories: [],
            topTireSizes: [],
            monthlyTireDetail,
            watchProducts: [],
            summary: { totalQty: 0, totalAmount: 0 }
        }
    }

    // 1. Yearly Trend (Always get all years for high-level view)
    const yearlyTrendResult = await db.execute(sql.raw(`
        SELECT 
            TO_CHAR(billing_date, 'YYYY') AS period, 
            SUM(qty) AS total_qty, 
            SUM(${REVENUE_DOC_CURR_AMOUNT}) AS total_amount
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
            SUM(${REVENUE_DOC_CURR_AMOUNT}) AS total_amount
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
            SUM(${REVENUE_DOC_CURR_AMOUNT}) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
        GROUP BY COALESCE(salesman, 'UNKNOWN')
        ORDER BY SUM(${REVENUE_DOC_CURR_AMOUNT}) DESC
        LIMIT 15
    `))

    // 4. Top Customers
    const customerResult = await db.execute(sql.raw(`
        SELECT 
            COALESCE(customer_name, 'UNKNOWN') AS customer_name, 
            SUM(qty) AS total_qty, 
            SUM(${REVENUE_DOC_CURR_AMOUNT}) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
        GROUP BY COALESCE(customer_name, 'UNKNOWN')
        ORDER BY SUM(${REVENUE_DOC_CURR_AMOUNT}) DESC
        LIMIT 10
    `))

    // 5. Summary Total
    const summaryResult = await db.execute(sql.raw(`
        SELECT 
            SUM(qty) AS total_qty, 
            SUM(${REVENUE_DOC_CURR_AMOUNT}) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
    `))

    // 6. Top Categories
    const categoryResult = await db.execute(sql.raw(`
        SELECT 
            COALESCE(mat_grp_desc, 'UNKNOWN') AS category, 
            SUM(qty) AS total_qty, 
            SUM(${REVENUE_DOC_CURR_AMOUNT}) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
        GROUP BY COALESCE(mat_grp_desc, 'UNKNOWN')
        ORDER BY SUM(${REVENUE_DOC_CURR_AMOUNT}) DESC
        LIMIT 10
    `))

    // 7. Top Tire Sizes
    const tireSizeResult = await db.execute(sql.raw(`
        SELECT 
            ${TIRE_SIZE_EXTRACTOR} AS tireSize, 
            SUM(qty) AS total_qty, 
            SUM(${REVENUE_DOC_CURR_AMOUNT}) AS total_amount
        FROM sales_revenue_sap 
        WHERE ${baseWhere} ${filtersCondition} ${yearCondition}
        GROUP BY ${TIRE_SIZE_EXTRACTOR}
        ORDER BY SUM(${REVENUE_DOC_CURR_AMOUNT}) DESC
        LIMIT 10
    `))

    // 8. Monthly Tire Detail (filtered by month if provided)
    let monthlyTireDetail: MonthlyTireDetail[] = []
    if (filterMonth) {
        const monthCondition = ` AND TO_CHAR(billing_date, 'YYYY-MM') = '${filterMonth.replace(/'/g, "''")}'`
        const monthlyTireResult = await db.execute(sql.raw(`
            SELECT 
                COALESCE(NULLIF(material_description, ''), material_no) AS product_name,
                ${TIRE_SIZE_EXTRACTOR} AS tireSize, 
                COALESCE(salesman, 'Unknown') AS sales,
                SUM(qty) AS total_qty, 
                SUM(${REVENUE_DOC_CURR_AMOUNT}) AS total_amount
            FROM sales_revenue_sap 
            WHERE ${baseWhere} ${filtersCondition} ${monthCondition}
            GROUP BY COALESCE(NULLIF(material_description, ''), material_no), ${TIRE_SIZE_EXTRACTOR}, COALESCE(salesman, 'Unknown')
            ORDER BY SUM(${REVENUE_DOC_CURR_AMOUNT}) DESC
            LIMIT 15
        `))
        monthlyTireDetail = monthlyTireResult.rows.map(r => ({
            tireSize: String(r.tiresize),
            productName: String(r.product_name || "-"),
            salesman: String(r.sales || "-"),
            qty: Number(r.total_qty),
            amount: Number(r.total_amount)
        }))
    }

    // 9. Watch Products: high stock from SAP (top 8 by valuation)
    let watchProducts: WatchProduct[] = []
    try {
        const watchResult = await db.execute(sql`
            SELECT 
                sm.material_key,
                COALESCE(NULLIF(sm.description, ''), sm.material_number) AS description,
                COALESCE(sm.initial_stock, 0) AS initial_stock,
                COALESCE(sap.total_stock, 0) AS current_stock,
                COALESCE(sap.total_value, 0) AS valuation
            FROM slow_moving_products sm
            LEFT JOIN (
                SELECT 
                    UPPER(TRIM(material_no)) AS mat_no,
                    SUM(total_stock) AS total_stock,
                    SUM(value_stock) AS total_value
                FROM zmc9_stock_sap
                GROUP BY UPPER(TRIM(material_no))
            ) sap ON UPPER(TRIM(sm.material_key)) = sap.mat_no
            WHERE sm.material_key IS NOT NULL
            ORDER BY COALESCE(sap.total_value, 0) DESC
            LIMIT 11
        `)
        watchProducts = watchResult.rows.map(r => {
            const initialStock = Number(r.initial_stock) || 0
            const currentStock = Number(r.current_stock) || 0
            const valuation = Number(r.valuation) || 0
            return {
                materialKey: String(r.material_key || "Unknown"),
                description: String(r.description || "-"),
                initialStock,
                totalSold: Math.max(0, initialStock - currentStock),
                remainingStock: currentStock,
                soldAmount: 0,
                remainingValue: valuation
            }
        })
    } catch (e) {
        console.error("Watch products query error:", e)
    }

    const mapRow = (r: any, nameField: string) => ({
        [nameField]: r.period || r[nameField],
        qty: Number(r.total_qty) || 0,
        amount: Number(r.total_amount) || 0
    })

    return {
        yearlyTrend: yearlyTrendResult.rows.map(r => mapRow(r, "period")) as TrendData[],
        monthlyTrend: monthlyTrendResult.rows.map(r => mapRow(r, "period")) as TrendData[],
        topSalesman: salesmanResult.rows.map(r => mapRow(r, "salesman")) as SalesmanData[],
        topCustomers: customerResult.rows.map(r => ({
            customerName: r.customer_name || "Unknown",
            qty: Number(r.total_qty) || 0,
            amount: Number(r.total_amount) || 0
        })) as CustomerData[],
        topCategories: categoryResult.rows.map(r => mapRow(r, "category")) as CategoryData[],
        summary: {
            totalQty: Number(summaryResult.rows[0]?.total_qty) || 0,
            totalAmount: Number(summaryResult.rows[0]?.total_amount) || 0,
        },
        topTireSizes: tireSizeResult.rows.map(r => ({
            tireSize: String(r.tiresize),
            qty: Number(r.total_qty),
            amount: Number(r.total_amount)
        })),
        monthlyTireDetail,
        watchProducts
    }
    } catch (e) {
        console.error("getSlowMovingDashboardData error:", e)
        return emptyResult
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

        const sortedYears = [...selectedYears].sort((a, b) => Number(b) - Number(a))
        const latestYear = sortedYears[0]

        let maxMonth = 12
        if (latestYear) {
            for (let i = 12; i >= 1; i--) {
                const monthStr = i.toString().padStart(2, "0")
                const monthData = trendData.find(m => m.month === monthStr)
                if (monthData && (monthData[`qty_${latestYear}`] > 0 || monthData[`amount_${latestYear}`] > 0)) {
                    maxMonth = i
                    break
                }
            }
        }

        const filteredTrendData = trendData.filter(m => Number(m.month) <= maxMonth)

        const dataStr = filteredTrendData.map(m => {
            let row = `Bulan ${m.month}: `
            selectedYears.forEach(y => {
                row += `[Thn ${y} -> Qty: ${m[`qty_${y}`] || 0}, Revenue: Rp${m[`amount_${y}`] || 0}] `
            })
            return row
        }).join("\n")

        const prompt = `Sebagai Senior Data Analyst di One Chitra, berikan insight ringkas dan tajam mengenai tren Year-over-Year (YoY) performa barang slow moving berikut.\n\nData Per Bulan (Hanya bulan 1 s/d ${maxMonth} untuk perbandingan apple-to-apple):\n${dataStr}\n\nTugas Anda:
1. Bandingkan performa antar tahun (${selectedYears.join(" vs ")}) hanya untuk periode bulan 1 s/d ${maxMonth}.
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
