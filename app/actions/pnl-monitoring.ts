"use server"

import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
import { getAuthenticatedSession } from "@/lib/rbac"
import { getTableColumns, sql } from "drizzle-orm"
import { buildPnlMonitoringRows } from "./pnl-monitoring-utils"

const PROFIT_MARGIN_EXPR = "COALESCE(NULLIF(profit_margin, 'NaN'::float8), 0)"
const NON_CANCELLED_REVENUE_CONDITION = `
          AND COALESCE(UPPER(TRIM(c)), '') <> 'X'
          AND NULLIF(TRIM(cancelled), '') IS NULL`
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
const DETAIL_COLUMNS = Object.values(getTableColumns(salesRevenueSap)).map((column) => column.name)

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
          ${NON_CANCELLED_REVENUE_CONDITION}
          AND TO_CHAR(billing_date, 'YYYY') = '${year.replace(/'/g, "''")}'
          ${monthCondition}
          ${customerCondition}
        GROUP BY 1, 2, 3
        HAVING SUM(${PROFIT_MARGIN_EXPR}) < 0
        ORDER BY 1, 2, 3
    `)
}

const buildDetailCondition = (filters: PnlMonitoringFilters) => {
    const year = normalizeYear(filters.year)
    const month = normalizeMonth(filters.month)
    const monthCondition = month === "ALL" ? "" : ` AND EXTRACT(MONTH FROM billing_date)::int <= ${Number(month)}`

    return `
        WHERE billing_date IS NOT NULL
          AND ${PROFIT_MARGIN_EXPR} < 0
          ${NON_CANCELLED_REVENUE_CONDITION}
          AND TO_CHAR(billing_date, 'YYYY') = '${year.replace(/'/g, "''")}'
          ${monthCondition}
          ${buildCustomerCondition(filters.customers)}`
}

export async function getPnlMonitoringDetailData(
    filters: PnlMonitoringFilters,
    requestedPage = 1,
    requestedPageSize: 100 | "ALL" = 100,
) {
    await getAuthenticatedSession("marketing", "view")

    const pageSize = 100
    const showAll = requestedPageSize === "ALL"
    const page = showAll ? 1 : Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1
    const condition = buildDetailCondition(filters)
    const [countResult, dataResult] = await Promise.all([
        db.execute(sql.raw(`SELECT COUNT(*)::int AS total_count FROM sales_revenue_sap ${condition}`)),
        db.execute(sql.raw(`
            SELECT * FROM sales_revenue_sap
            ${condition}
            ORDER BY billing_date DESC NULLS LAST, sales_rev_id DESC
            ${showAll ? "" : `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`}
        `)),
    ])
    const totalCount = Number((countResult.rows[0] as { total_count?: number } | undefined)?.total_count ?? 0)

    return {
        columns: DETAIL_COLUMNS,
        rows: dataResult.rows as Record<string, unknown>[],
        page,
        pageSize: showAll ? "ALL" : pageSize,
        totalCount,
        totalPages: showAll ? 1 : Math.max(1, Math.ceil(totalCount / pageSize)),
    }
}

export async function getPnlMonitoringDetailExport(filters: PnlMonitoringFilters) {
    await getAuthenticatedSession("marketing", "view")

    const dataResult = await db.execute(sql.raw(`
        SELECT * FROM sales_revenue_sap
        ${buildDetailCondition(filters)}
        ORDER BY billing_date DESC NULLS LAST, sales_rev_id DESC
    `))

    return {
        columns: DETAIL_COLUMNS,
        rows: dataResult.rows as Record<string, unknown>[],
    }
}

export async function getPnlMonitoringBootstrap() {
    await getAuthenticatedSession("marketing", "view")

    const yearsResult = await db.execute(sql.raw(`
        SELECT DISTINCT TO_CHAR(billing_date, 'YYYY') AS year
        FROM sales_revenue_sap
        WHERE billing_date IS NOT NULL
          AND ${PROFIT_MARGIN_EXPR} < 0
          ${NON_CANCELLED_REVENUE_CONDITION}
        ORDER BY year DESC
    `))
    const customersResult = await db.execute(sql.raw(`
        SELECT DISTINCT COALESCE(NULLIF(customer_name, ''), 'UNKNOWN') AS customer_name
        FROM sales_revenue_sap
        WHERE billing_date IS NOT NULL
          AND ${PROFIT_MARGIN_EXPR} < 0
          ${NON_CANCELLED_REVENUE_CONDITION}
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
              ${NON_CANCELLED_REVENUE_CONDITION}
            ORDER BY year DESC
        `)),
        db.execute(sql.raw(`
            SELECT DISTINCT COALESCE(NULLIF(customer_name, ''), 'UNKNOWN') AS customer_name
            FROM sales_revenue_sap
            WHERE billing_date IS NOT NULL
              AND ${PROFIT_MARGIN_EXPR} < 0
              ${NON_CANCELLED_REVENUE_CONDITION}
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
