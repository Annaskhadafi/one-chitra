"use server"

import { db } from "@/db"
import { getAuthenticatedSession } from "@/lib/rbac"
import { sql } from "drizzle-orm"
import { buildPnlMonitoringRows } from "./pnl-monitoring-utils"

const PROFIT_MARGIN_EXPR = "COALESCE(NULLIF(profit_margin, 'NaN'::float8), 0)"
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

export type PnlMonitoringFilters = {
    year: string
    month: string
    customers: string[]
}

export type PnlMonitoringRow = {
    customerName: string
    type: string
    monthlyLosses: Record<string, number>
    totalLoss: number
}

export type PnlMonitoringResult = {
    availableYears: string[]
    availableCustomers: string[]
    months: { key: string; label: string }[]
    rows: PnlMonitoringRow[]
    summary: {
        totalLoss: number
        rowCount: number
        customerCount: number
        typeCount: number
    }
    appliedFilters: PnlMonitoringFilters
}

const escapeLikeValue = (value: string) =>
    value
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_")
        .replace(/'/g, "''")

const normalizeYear = (value: string) => (/^\d{4}$/.test(value) ? value : new Date().getFullYear().toString())

const normalizeMonth = (value: string) => {
    if (value === "ALL") return "ALL"
    const month = Number(value)
    return month >= 1 && month <= 12 ? String(month).padStart(2, "0") : "ALL"
}

const normalizeCustomers = (values: string[]) => {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

const buildMonths = (monthValue: string) => {
    const limit = monthValue === "ALL" ? 12 : Number(monthValue)
    return Array.from({ length: limit }, (_, index) => {
        const key = String(index + 1).padStart(2, "0")
        return {
            key,
            label: MONTH_LABELS[index] ?? key,
        }
    })
}

const buildCustomerCondition = (customers: string[]) => {
    const selectedCustomers = normalizeCustomers(customers)
    if (selectedCustomers.length === 0) return ""
    const safeList = selectedCustomers.map((value) => `'${escapeLikeValue(value.toUpperCase())}'`).join(", ")
    return ` AND UPPER(TRIM(COALESCE(NULLIF(customer_name, ''), 'UNKNOWN'))) = ANY(ARRAY[${safeList}])`
}

const buildQuery = (year: string, month: string, customers: string[]) => {
    const monthCondition = month === "ALL" ? "" : ` AND EXTRACT(MONTH FROM billing_date)::int <= ${Number(month)}`
    const customerCondition = buildCustomerCondition(customers)

    return sql.raw(`
        SELECT
            COALESCE(NULLIF(customer_name, ''), 'UNKNOWN') AS customer_name,
            COALESCE(NULLIF(mat_grp_desc, ''), 'UNKNOWN') AS type_name,
            TO_CHAR(billing_date, 'MM') AS month,
            SUM(${PROFIT_MARGIN_EXPR}) AS total_loss
        FROM sales_revenue_sap
        WHERE billing_date IS NOT NULL
          AND ${PROFIT_MARGIN_EXPR} < 0
          AND TO_CHAR(billing_date, 'YYYY') = '${year.replace(/'/g, "''")}'
          ${monthCondition}
          ${customerCondition}
        GROUP BY 1, 2, 3
        HAVING SUM(${PROFIT_MARGIN_EXPR}) < 0
        ORDER BY 1, 2, 3
    `)
}

export async function getPnlMonitoringBootstrap() {
    await getAuthenticatedSession("marketing", "view")

    const yearsResult = await db.execute(sql.raw(`
        SELECT DISTINCT TO_CHAR(billing_date, 'YYYY') AS year
        FROM sales_revenue_sap
        WHERE billing_date IS NOT NULL
          AND ${PROFIT_MARGIN_EXPR} < 0
        ORDER BY year DESC
    `))
    const customersResult = await db.execute(sql.raw(`
        SELECT DISTINCT COALESCE(NULLIF(customer_name, ''), 'UNKNOWN') AS customer_name
        FROM sales_revenue_sap
        WHERE billing_date IS NOT NULL
          AND ${PROFIT_MARGIN_EXPR} < 0
        ORDER BY customer_name
    `))

    const availableYears = (yearsResult.rows as { year: string }[]).map((row) => row.year).filter(Boolean)
    const availableCustomers = (customersResult.rows as { customer_name: string }[]).map((row) => row.customer_name).filter(Boolean)
    const currentYear = new Date().getFullYear().toString()
    const initialYear = availableYears.includes(currentYear) ? currentYear : (availableYears[0] ?? currentYear)

    const initialData = await getPnlMonitoringData({
        year: initialYear,
        month: "ALL",
        customers: [],
    })

    return {
        availableYears,
        availableCustomers,
        initialYear,
        initialData,
    }
}

export async function getPnlMonitoringData(filters: PnlMonitoringFilters): Promise<PnlMonitoringResult> {
    await getAuthenticatedSession("marketing", "view")

    const year = normalizeYear(filters.year)
    const month = normalizeMonth(filters.month)
    const months = buildMonths(month)
    const customers = normalizeCustomers(filters.customers)
    const query = buildQuery(year, month, customers)

    const [yearsResult, customersResult, dataResult] = await Promise.all([
        db.execute(sql.raw(`
            SELECT DISTINCT TO_CHAR(billing_date, 'YYYY') AS year
            FROM sales_revenue_sap
            WHERE billing_date IS NOT NULL
              AND ${PROFIT_MARGIN_EXPR} < 0
            ORDER BY year DESC
        `)),
        db.execute(sql.raw(`
            SELECT DISTINCT COALESCE(NULLIF(customer_name, ''), 'UNKNOWN') AS customer_name
            FROM sales_revenue_sap
            WHERE billing_date IS NOT NULL
              AND ${PROFIT_MARGIN_EXPR} < 0
              ${month === "ALL" ? "" : ` AND EXTRACT(MONTH FROM billing_date)::int <= ${Number(month)}`}
              AND TO_CHAR(billing_date, 'YYYY') = '${year.replace(/'/g, "''")}'
            ORDER BY customer_name
        `)),
        db.execute(query),
    ])

    const availableYears = (yearsResult.rows as { year: string }[]).map((row) => row.year).filter(Boolean)
    const availableCustomers = (customersResult.rows as { customer_name: string }[]).map((row) => row.customer_name).filter(Boolean)
    const rows = buildPnlMonitoringRows(dataResult.rows as Parameters<typeof buildPnlMonitoringRows>[0], months)

    const customerCount = new Set(rows.map((row) => row.customerName)).size
    const typeCount = new Set(rows.map((row) => row.type)).size
    const totalLoss = rows.reduce((sum, row) => sum + row.totalLoss, 0)

    return {
        availableYears,
        availableCustomers,
        months,
        rows,
        summary: {
            totalLoss,
            rowCount: rows.length,
            customerCount,
            typeCount,
        },
        appliedFilters: {
            year,
            month,
            customers,
        },
    }
}
