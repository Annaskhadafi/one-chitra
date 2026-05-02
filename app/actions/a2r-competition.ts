"use server"

import { db } from "@/db"
import { getAuthenticatedSession } from "@/lib/rbac"
import { sql } from "drizzle-orm"
import { z } from "zod"

const A2R_START_MONTH = 4
const POINT_REVENUE_CAP = 120
const POINT_R49_HIGH = 100
const POINT_R49_MID = 50
const POINT_COSMETIC = 50
const POINT_INVENTORY = 10
const POINT_SLOW_MOVING = 20
const R49_HIGH_THRESHOLD = 215_000_000
const R49_MID_THRESHOLD = 190_000_000
const A2R_SALESMAN_ALIASES = new Map<string, string>([
    ["TOMMY INDRA ALDINY RAMBE", "OCKY HEGAR PRATAMA"],
])

const a2rCompetitionFiltersSchema = z.object({
    year: z.coerce.number().int().min(2020).max(2100),
    months: z.array(z.string().regex(/^(0[1-9]|1[0-2])$/)).optional().default([]),
})

const a2rSalesTargetItemSchema = z.object({
    salesman: z.string().trim().min(1).max(255),
    targetRevenue: z.coerce.number().min(0),
})

function monthKey(year: number, month: number) {
    return `${String(month).padStart(2, "0")}.${year}`
}

function monthLabel(period: string) {
    const [month, year] = period.split(".")
    const labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    const monthIndex = Number(month) - 1
    return `${labels[monthIndex] || month} ${year}`
}

function normalizeText(value: string | null | undefined) {
    return String(value ?? "").trim().toUpperCase()
}

function normalizeA2RSalesman(value: string | null | undefined) {
    const trimmed = String(value ?? "").trim()
    if (!trimmed) {
        return ""
    }

    return A2R_SALESMAN_ALIASES.get(normalizeText(trimmed)) || trimmed
}

function normalizeCustomerKey(value: string | null | undefined) {
    return normalizeText(value) || "UNKNOWN"
}

function normalizeMaterialKey(value: string | null | undefined) {
    return normalizeText(value)
}

function normalizeCategoryKey(value: string | null | undefined) {
    return normalizeText(value)
}

function normalizeDeliveryKey(value: string | null | undefined) {
    const trimmed = String(value ?? "").trim().toUpperCase()
    if (!trimmed) {
        return ""
    }

    return trimmed.replace(/\.0$/, "")
}

/**
 * Normalizes a serial number for fuzzy matching.
 * Removes all whitespace characters and converts to uppercase.
 * This allows matching between SN with spaces (e.g., "ABC 123") and without spaces (e.g., "ABC123").
 * Example: " ABC  123 " -> "ABC123"
 */
function normalizeSerialKey(value: string | null | undefined) {
    return normalizeText(value).replace(/\s+/g, "")
}

function matchesR49(value: string) {
    const compact = value.replace(/\s+/g, "").toUpperCase()
    return compact.includes("27.00R49") || compact.includes("27.00X49") || compact.includes("2700R49") || compact.includes("2700X49")
}

function isR49Material(materialDescription: string | null | undefined, sizeDimen: string | null | undefined) {
    return matchesR49(String(materialDescription ?? "")) || matchesR49(String(sizeDimen ?? ""))
}

function isRepairMaterial(materialDescription: string | null | undefined) {
    return normalizeText(materialDescription).includes("REPAIR")
}

function isTyreCategory(category: string | null | undefined) {
    return normalizeCategoryKey(category) === "TYRE"
}

function getR49UnitPrice(revenue: number, qty: number) {
    if (!Number.isFinite(revenue) || !Number.isFinite(qty) || qty <= 0) {
        return 0
    }

    return revenue / qty
}

function getR49PointsFromUnitPrice(unitPrice: number) {
    if (unitPrice >= R49_HIGH_THRESHOLD) {
        return POINT_R49_HIGH
    }

    if (unitPrice >= R49_MID_THRESHOLD) {
        return POINT_R49_MID
    }

    return 0
}

async function ensureA2RSalesTargetsTable() {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "a2r_sales_targets" (
            "id" serial PRIMARY KEY NOT NULL,
            "period" varchar(7) NOT NULL,
            "salesman" varchar(255) NOT NULL,
            "target_revenue" double precision DEFAULT 0 NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
        )
    `)

    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "a2r_sales_targets_period_salesman_uidx"
        ON "a2r_sales_targets" ("period", "salesman")
    `)
}

function buildSelectedMonths(year: number, requestedMonths: string[]) {
    const deduped = Array.from(new Set(
        requestedMonths
            .map((month) => Number(month))
            .filter((month) => Number.isFinite(month) && month >= A2R_START_MONTH && month <= 12)
    )).sort((left, right) => left - right)

    if (deduped.length > 0) {
        return deduped
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const endMonth = year === currentYear ? Math.max(A2R_START_MONTH, currentMonth) : 12

    return Array.from({ length: endMonth - A2R_START_MONTH + 1 }, (_, index) => A2R_START_MONTH + index)
}

function getRangeBounds(year: number, months: number[]) {
    const firstMonth = Math.min(...months)
    const lastMonth = Math.max(...months)

    const startDate = `${year}-${String(firstMonth).padStart(2, "0")}-01`
    const endYear = lastMonth === 12 ? year + 1 : year
    const endMonth = lastMonth === 12 ? 1 : lastMonth + 1
    const endDateExclusive = `${endYear}-${String(endMonth).padStart(2, "0")}-01`

    return {
        startDate,
        endDateExclusive,
    }
}

type SalesRow = {
    period: string
    salesman: string
    customerName: string | null
    materialNo: string | null
    materialDescription: string | null
    sizeDimen: string | null
    qty: number
    revenueInDocCurr: number
    deliveryNo: string | null
}

type TargetRow = {
    period: string
    salesman: string
    targetRevenue: number
}

type MonthlySalesmanAccumulator = {
    period: string
    salesman: string
    revenueActual: number
    revenueTarget: number
    inventoryMaterialKeys: Set<string>
    slowMovingMaterialKeys: Set<string>
    cosmeticCustomerBuckets: Map<string, {
        customerName: string
        materials: Map<string, {
            materialKey: string
            materialNo: string
            materialDescription: string
            category: string
            revenue: number
        }>
    }>
    r49CustomerBuckets: Map<string, {
        customerName: string
        revenue: number
        qty: number
        materials: Map<string, {
            materialKey: string
            materialNo: string
            materialDescription: string
            category: string
            revenue: number
            qty: number
        }>
    }>
}

type MonthlySalesmanScore = {
    period: string
    salesman: string
    revenueActual: number
    revenueTarget: number
    achievementPct: number
    revenuePoints: number
    r49HighCustomers: number
    r49MidCustomers: number
    r49Points: number
    cosmeticCustomers: number
    cosmeticPoints: number
    inventoryItems: number
    inventoryPoints: number
    slowMovingItems: number
    slowMovingPoints: number
    totalPoints: number
}

type SalesProductDetail = {
    materialNo: string
    materialDescription: string
    category: string
    qty: number
    revenue: number
    customerCount: number
    customers: string[]
    periods: string[]
    r49Points: number
    cosmeticPoints: number
    inventoryPoints: number
    slowMovingPoints: number
    totalPoints: number
}

function buildMonthlyScore(accumulator: MonthlySalesmanAccumulator) {
    const achievementPct = accumulator.revenueTarget > 0
        ? (accumulator.revenueActual / accumulator.revenueTarget) * 100
        : 0

    const revenuePoints = accumulator.revenueTarget > 0
        ? Math.min(POINT_REVENUE_CAP, Math.round(achievementPct))
        : 0

    let r49HighCustomers = 0
    let r49MidCustomers = 0

    for (const customerBucket of accumulator.r49CustomerBuckets.values()) {
        if (customerBucket.qty <= 0) {
            continue
        }

        const unitPrice = getR49UnitPrice(customerBucket.revenue, customerBucket.qty)
        const points = getR49PointsFromUnitPrice(unitPrice)

        if (points === POINT_R49_HIGH) {
            r49HighCustomers += 1
            continue
        }

        if (points === POINT_R49_MID) {
            r49MidCustomers += 1
        }
    }

    const r49Points = (r49HighCustomers * POINT_R49_HIGH) + (r49MidCustomers * POINT_R49_MID)
    const cosmeticCustomers = accumulator.cosmeticCustomerBuckets.size
    const cosmeticPoints = cosmeticCustomers * POINT_COSMETIC
    const inventoryItems = accumulator.inventoryMaterialKeys.size
    const inventoryPoints = inventoryItems * POINT_INVENTORY
    const slowMovingItems = accumulator.slowMovingMaterialKeys.size
    const slowMovingPoints = slowMovingItems * POINT_SLOW_MOVING
    const totalPoints = revenuePoints + r49Points + cosmeticPoints + inventoryPoints + slowMovingPoints

    return {
        period: accumulator.period,
        salesman: accumulator.salesman,
        revenueActual: accumulator.revenueActual,
        revenueTarget: accumulator.revenueTarget,
        achievementPct,
        revenuePoints,
        r49HighCustomers,
        r49MidCustomers,
        r49Points,
        cosmeticCustomers,
        cosmeticPoints,
        inventoryItems,
        inventoryPoints,
        slowMovingItems,
        slowMovingPoints,
        totalPoints,
    } satisfies MonthlySalesmanScore
}

export async function getA2RCompetitionFilterOptions() {
    await getAuthenticatedSession("sales-dashboard", "view")

    const result = await db.execute(sql`
        SELECT DISTINCT
            EXTRACT(YEAR FROM billing_date)::int AS year,
            TO_CHAR(billing_date, 'MM') AS month
        FROM sales_revenue_sap
        WHERE billing_date IS NOT NULL
          AND billing_date >= DATE '2026-04-01'
          AND (
            customer_name IS NULL
            OR customer_name NOT ILIKE '%Chitra Paratama Singapore Branch%'
          )
          AND customer NOT ILIKE '%ITC008%'
          AND customer NOT ILIKE '%1000289A%'
          AND customer_name NOT ILIKE '%Chitra Paratama%'
          AND customer_name NOT ILIKE '%Transityre b.v%'
          AND customer_name NOT ILIKE '%TRANSITYRE B.V%'
        ORDER BY year DESC, month ASC
    `)

    const yearMap = new Map<number, string[]>()

    for (const row of result.rows as Array<{ year: number; month: string }>) {
        const months = yearMap.get(row.year) || []
        if (!months.includes(row.month)) {
            months.push(row.month)
        }
        yearMap.set(row.year, months)
    }

    const years = Array.from(yearMap.keys()).sort((left, right) => right - left)

    return {
        success: true,
        data: {
            years,
            monthsByYear: Object.fromEntries(
                years.map((year) => [
                    year,
                    (yearMap.get(year) || []).filter((month) => Number(month) >= A2R_START_MONTH),
                ])
            ),
        },
    }
}

export async function getA2RCompetitionTargetSetup(period: string) {
    await getAuthenticatedSession("sales-dashboard", "view")
    await ensureA2RSalesTargetsTable()

    const [monthPart, yearPart] = period.split(".")
    const month = Number(monthPart)
    const year = Number(yearPart)

    if (!month || !year) {
        return { success: false, error: "Periode target tidak valid" }
    }

    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`
    const nextYear = month === 12 ? year + 1 : year
    const nextMonth = month === 12 ? 1 : month + 1
    const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
    const yearStart = `${year}-${String(A2R_START_MONTH).padStart(2, "0")}-01`
    const yearEnd = `${year + 1}-01-01`

    const activeSalesmenResult = await db.execute(sql`
        SELECT DISTINCT TRIM(salesman) AS salesman
        FROM sales_revenue_sap
        WHERE billing_date >= ${periodStart}::date
          AND billing_date < ${periodEnd}::date
          AND salesman IS NOT NULL
          AND TRIM(salesman) <> ''
        ORDER BY salesman ASC
    `)

    const fallbackSalesmenResult = await db.execute(sql`
        SELECT DISTINCT TRIM(salesman) AS salesman
        FROM sales_revenue_sap
        WHERE billing_date >= ${yearStart}::date
          AND billing_date < ${yearEnd}::date
          AND salesman IS NOT NULL
          AND TRIM(salesman) <> ''
        ORDER BY salesman ASC
    `)

    const targetResult = await db.execute(sql`
        SELECT salesman, target_revenue AS "targetRevenue"
        FROM a2r_sales_targets
        WHERE period = ${period}
    `)

    const activeSalesmen = Array.from(new Set((activeSalesmenResult.rows as Array<{ salesman: string | null }>)
        .map((row) => normalizeA2RSalesman(row.salesman))
        .filter((value): value is string => Boolean(value))
    ))

    const fallbackSalesmen = Array.from(new Set((fallbackSalesmenResult.rows as Array<{ salesman: string | null }>)
        .map((row) => normalizeA2RSalesman(row.salesman))
        .filter((value): value is string => Boolean(value))
    ))

    const targetMap = new Map<string, number>()
    for (const row of targetResult.rows as Array<{ salesman: string; targetRevenue: number | string | null }>) {
        const salesman = normalizeA2RSalesman(row.salesman)
        if (!salesman) {
            continue
        }

        targetMap.set(salesman, (targetMap.get(salesman) || 0) + Number(row.targetRevenue || 0))
    }

    const salesmen = Array.from(new Set([
        ...activeSalesmen,
        ...fallbackSalesmen,
        ...Array.from(targetMap.keys()),
    ])).sort((left, right) => left.localeCompare(right))

    return {
        success: true,
        data: {
            period,
            periodLabel: monthLabel(period),
            salesmen: salesmen.map((salesman) => ({
                salesman,
                targetRevenue: targetMap.get(salesman) || 0,
                isActiveThisPeriod: activeSalesmen.includes(salesman),
            })),
        },
    }
}

export async function saveA2RCompetitionTargets(period: string, items: z.infer<typeof a2rSalesTargetItemSchema>[]) {
    await getAuthenticatedSession("sales-dashboard", "edit")
    await ensureA2RSalesTargetsTable()

    const parsedItems = z.array(a2rSalesTargetItemSchema).parse(items)
    const dedupedItemMap = new Map<string, { salesman: string; targetRevenue: number }>()
    for (const item of parsedItems) {
        const salesman = normalizeA2RSalesman(item.salesman)
        if (!salesman) {
            continue
        }

        const existing = dedupedItemMap.get(salesman)
        if (existing) {
            existing.targetRevenue += Number(item.targetRevenue || 0)
            continue
        }

        dedupedItemMap.set(salesman, {
            salesman,
            targetRevenue: Number(item.targetRevenue || 0),
        })
    }

    const dedupedItems = Array.from(dedupedItemMap.values())

    await db.transaction(async (tx) => {
        await tx.execute(sql`
            DELETE FROM a2r_sales_targets
            WHERE period = ${period}
        `)

        if (dedupedItems.length === 0) {
            return
        }

        for (const item of dedupedItems) {
            await tx.execute(sql`
                INSERT INTO a2r_sales_targets (period, salesman, target_revenue, updated_at)
                VALUES (${period}, ${item.salesman}, ${item.targetRevenue}, NOW())
            `)
        }
    })

    return { success: true }
}

export async function getA2RCompetitionData(rawFilters: z.input<typeof a2rCompetitionFiltersSchema>) {
    await getAuthenticatedSession("sales-dashboard", "view")
    await ensureA2RSalesTargetsTable()

    const filters = a2rCompetitionFiltersSchema.parse(rawFilters)
    const selectedMonths = buildSelectedMonths(filters.year, filters.months)
    const selectedPeriods = selectedMonths.map((month) => monthKey(filters.year, month))
    const { startDate, endDateExclusive } = getRangeBounds(filters.year, selectedMonths)
    const selectedPeriodsSql = sql.join(selectedPeriods.map((period) => sql`${period}`), sql`, `)

    const [salesResult, slowMovingResult, cosmeticMatchResult, consignmentMatchResult, targetResult, materialCategoryResult] = await Promise.all([
        db.execute(sql`
            SELECT
                TO_CHAR(billing_date, 'MM.YYYY') AS period,
                TRIM(salesman) AS salesman,
                customer_name AS "customerName",
                material_no AS "materialNo",
                material_description AS "materialDescription",
                size_dimen AS "sizeDimen",
                COALESCE(qty, 0)::double precision AS qty,
                COALESCE(revenue_in_doc_curr, 0)::double precision AS "revenueInDocCurr",
                delivery_no AS "deliveryNo"
            FROM sales_revenue_sap
            WHERE billing_date >= ${startDate}::date
              AND billing_date < ${endDateExclusive}::date
              AND TO_CHAR(billing_date, 'MM.YYYY') IN (${selectedPeriodsSql})
              AND salesman IS NOT NULL
              AND TRIM(salesman) <> ''
              AND (
                customer_name IS NULL
                OR customer_name NOT ILIKE '%Chitra Paratama Singapore Branch%'
              )
              AND customer NOT ILIKE '%ITC008%'
              AND customer NOT ILIKE '%1000289A%'
              AND customer_name NOT ILIKE '%Chitra Paratama%'
              AND customer_name NOT ILIKE '%Transityre b.v%'
              AND customer_name NOT ILIKE '%TRANSITYRE B.V%'
        `),
        db.execute(sql`
            SELECT UPPER(TRIM(material_number)) AS "materialNumber"
            FROM slow_moving_products
            WHERE material_number IS NOT NULL
              AND TRIM(material_number) <> ''
        `),
        // Fuzzy match cosmetic tires by material number AND serial number (via delivery)
        // This handles regular deliveries where DO SAP matches sales_revenue_sap.delivery_no
        db.execute(sql`
            SELECT DISTINCT
                COALESCE(d.do_sap, '') AS "doSap",
                COALESCE(d.delivery_number, '') AS "deliveryNumber",
                COALESCE(products.material_number, '') AS "materialNumber"
            FROM deliveries d
            JOIN delivery_items di ON di.delivery_id = d.id
            JOIN products ON products.id = di.product_id
            JOIN cosmetic_tires ct
              ON UPPER(TRIM(COALESCE(ct.material_number, ''))) = UPPER(TRIM(COALESCE(products.material_number, '')))
             AND EXISTS (
                SELECT 1
                FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
                WHERE REGEXP_REPLACE(UPPER(TRIM(sn)), '\\s+', '', 'g') = REGEXP_REPLACE(UPPER(TRIM(COALESCE(ct.serial_number, ''))), '\\s+', '', 'g')
             )
        `),
        // Consignment matching: Get customer-material pairs for consignment deliveries with cosmetic tires
        // This handles cases where DO SAP doesn't match (consignment) but customer+material+SN match
        db.execute(sql`
            SELECT DISTINCT
                c.name AS "customerName",
                COALESCE(products.material_number, '') AS "materialNumber"
            FROM deliveries d
            JOIN sales_orders so ON so.id = d.sales_order_id
            JOIN customers c ON c.id = so.customer_id
            JOIN delivery_items di ON di.delivery_id = d.id
            JOIN products ON products.id = di.product_id
            JOIN cosmetic_tires ct
              ON UPPER(TRIM(COALESCE(ct.material_number, ''))) = UPPER(TRIM(COALESCE(products.material_number, '')))
             AND EXISTS (
                SELECT 1
                FROM UNNEST(COALESCE(di.serial_numbers, ARRAY[]::text[])) AS sn
                WHERE REGEXP_REPLACE(UPPER(TRIM(sn)), '\\s+', '', 'g') = REGEXP_REPLACE(UPPER(TRIM(COALESCE(ct.serial_number, ''))), '\\s+', '', 'g')
             )
        `),
        db.execute(sql`
            SELECT period, salesman, target_revenue AS "targetRevenue"
            FROM a2r_sales_targets
            WHERE period IN (${selectedPeriodsSql})
        `),
        db.execute(sql`
            SELECT
                UPPER(TRIM(material_number)) AS "materialNumber",
                MAX(UPPER(TRIM(category))) AS "category"
            FROM products
            WHERE material_number IS NOT NULL
              AND TRIM(material_number) <> ''
              AND category IS NOT NULL
              AND TRIM(category) <> ''
            GROUP BY UPPER(TRIM(material_number))
        `),
    ])

    const salesRows = salesResult.rows as SalesRow[]
    const slowMovingSet = new Set(
        (slowMovingResult.rows as Array<{ materialNumber: string | null }>)
            .map((row) => normalizeMaterialKey(row.materialNumber))
            .filter(Boolean)
    )
    const materialCategoryMap = new Map<string, string>(
        (materialCategoryResult.rows as Array<{ materialNumber: string | null; category: string | null }>)
            .map((row) => [normalizeMaterialKey(row.materialNumber), normalizeCategoryKey(row.category)] as const)
            .filter(([materialNumber]) => Boolean(materialNumber))
    )
    const cosmeticMatchSet = new Set<string>()
    // Consignment match: customerName + materialNumber (for consignment without matching DO)
    const consignmentMatchSet = new Set<string>()

    for (const row of cosmeticMatchResult.rows as Array<{ doSap: string; deliveryNumber: string; materialNumber: string }>) {
        const materialKey = normalizeMaterialKey(row.materialNumber)
        const doSapKey = normalizeDeliveryKey(row.doSap)
        const deliveryNumberKey = normalizeDeliveryKey(row.deliveryNumber)

        if (doSapKey && materialKey) {
            cosmeticMatchSet.add(`${doSapKey}|${materialKey}`)
        }
        if (deliveryNumberKey && materialKey) {
            cosmeticMatchSet.add(`${deliveryNumberKey}|${materialKey}`)
        }
    }

    // Build consignment match set (customer + material pairs that have cosmetic tires)
    for (const row of consignmentMatchResult.rows as Array<{ customerName: string; materialNumber: string }>) {
        const customerKey = normalizeCustomerKey(row.customerName)
        const materialKey = normalizeMaterialKey(row.materialNumber)
        if (customerKey && materialKey) {
            consignmentMatchSet.add(`${customerKey}|${materialKey}`)
        }
    }

    const targetMap = new Map<string, number>()
    for (const row of targetResult.rows as TargetRow[]) {
        const salesman = normalizeA2RSalesman(row.salesman)
        if (!salesman) {
            continue
        }

        const key = `${row.period}|${salesman}`
        targetMap.set(key, (targetMap.get(key) || 0) + Number(row.targetRevenue || 0))
    }

    const monthlyMap = new Map<string, MonthlySalesmanAccumulator>()

    const ensureMonthlyAccumulator = (period: string, salesman: string) => {
        const key = `${period}|${salesman}`
        const existing = monthlyMap.get(key)
        if (existing) {
            return existing
        }

        const accumulator: MonthlySalesmanAccumulator = {
            period,
            salesman,
            revenueActual: 0,
            revenueTarget: targetMap.get(key) || 0,
            inventoryMaterialKeys: new Set<string>(),
            slowMovingMaterialKeys: new Set<string>(),
            cosmeticCustomerBuckets: new Map(),
            r49CustomerBuckets: new Map(),
        }

        monthlyMap.set(key, accumulator)
        return accumulator
    }

    for (const period of selectedPeriods) {
        const targetSalesmen = (targetResult.rows as TargetRow[])
            .filter((row) => row.period === period)
            .map((row) => normalizeA2RSalesman(row.salesman))
            .filter(Boolean)

        for (const salesman of targetSalesmen) {
            ensureMonthlyAccumulator(period, salesman)
        }
    }

    for (const row of salesRows) {
        const salesman = normalizeA2RSalesman(row.salesman)
        if (!salesman || !selectedPeriods.includes(row.period)) {
            continue
        }

        const accumulator = ensureMonthlyAccumulator(row.period, salesman)
        accumulator.revenueActual += Number(row.revenueInDocCurr || 0)

        const materialKey = normalizeMaterialKey(row.materialNo)
        const category = materialCategoryMap.get(materialKey) || ""
        const isTyre = isTyreCategory(category)
        const customerKey = normalizeCustomerKey(row.customerName)
        const isR49 = isR49Material(row.materialDescription, row.sizeDimen)
        const isRepair = isRepairMaterial(row.materialDescription)
        const materialNo = row.materialNo?.trim() || "-"
        const materialDescription = row.materialDescription?.trim() || "Tanpa deskripsi"

        if (materialKey && isTyre && !isR49) {
            if (slowMovingSet.has(materialKey)) {
                accumulator.slowMovingMaterialKeys.add(materialKey)
            } else {
                accumulator.inventoryMaterialKeys.add(materialKey)
            }
        }

        if (isR49 && isTyre && !isRepair) {
            const customerBucket = accumulator.r49CustomerBuckets.get(customerKey) || {
                customerName: row.customerName?.trim() || "Unknown Customer",
                revenue: 0,
                qty: 0,
                materials: new Map(),
            }

            customerBucket.revenue += Number(row.revenueInDocCurr || 0)
            customerBucket.qty += Number(row.qty || 0)

            if (materialKey) {
                const materialBucket = customerBucket.materials.get(materialKey) || {
                    materialKey,
                    materialNo,
                    materialDescription,
                    category,
                    revenue: 0,
                    qty: 0,
                }

                materialBucket.revenue += Number(row.revenueInDocCurr || 0)
                materialBucket.qty += Number(row.qty || 0)
                customerBucket.materials.set(materialKey, materialBucket)
            }

            accumulator.r49CustomerBuckets.set(customerKey, customerBucket)

            const deliveryKey = normalizeDeliveryKey(row.deliveryNo)
            // Check cosmetic match by delivery_no (regular) OR by customer+material (consignment)
            const isCosmeticMatch = deliveryKey && materialKey && cosmeticMatchSet.has(`${deliveryKey}|${materialKey}`)
            const isConsignmentMatch = materialKey && consignmentMatchSet.has(`${customerKey}|${materialKey}`)

            if (isCosmeticMatch || isConsignmentMatch) {
                const cosmeticBucket = accumulator.cosmeticCustomerBuckets.get(customerKey) || {
                    customerName: row.customerName?.trim() || "Unknown Customer",
                    materials: new Map(),
                }

                const materialBucket = cosmeticBucket.materials.get(materialKey) || {
                    materialKey,
                    materialNo,
                    materialDescription,
                    category,
                    revenue: 0,
                }

                materialBucket.revenue += Number(row.revenueInDocCurr || 0)
                cosmeticBucket.materials.set(materialKey, materialBucket)
                accumulator.cosmeticCustomerBuckets.set(customerKey, cosmeticBucket)
            }
        }
    }

    const monthlyScores = Array.from(monthlyMap.values())
        .map((accumulator) => buildMonthlyScore(accumulator))
        .sort((left, right) => {
            if (right.totalPoints !== left.totalPoints) {
                return right.totalPoints - left.totalPoints
            }
            return right.revenueActual - left.revenueActual
        })

    const cumulativeMap = new Map<string, {
        salesman: string
        revenueActual: number
        revenueTarget: number
        revenuePoints: number
        r49HighCustomers: number
        r49MidCustomers: number
        r49Points: number
        cosmeticCustomers: number
        cosmeticPoints: number
        inventoryItems: number
        inventoryPoints: number
        slowMovingItems: number
        slowMovingPoints: number
        totalPoints: number
        monthlyBreakdown: MonthlySalesmanScore[]
        soldProducts: Map<string, {
            materialKey: string
            materialNo: string
            materialDescription: string
            category: string
            qty: number
            revenue: number
            customers: Set<string>
            periods: Set<string>
            r49Points: number
            cosmeticPoints: number
            inventoryPoints: number
            slowMovingPoints: number
        }>
    }>()

    for (const score of monthlyScores) {
        const existing = cumulativeMap.get(score.salesman)
        if (existing) {
            existing.revenueActual += score.revenueActual
            existing.revenueTarget += score.revenueTarget
            existing.revenuePoints += score.revenuePoints
            existing.r49HighCustomers += score.r49HighCustomers
            existing.r49MidCustomers += score.r49MidCustomers
            existing.r49Points += score.r49Points
            existing.cosmeticCustomers += score.cosmeticCustomers
            existing.cosmeticPoints += score.cosmeticPoints
            existing.inventoryItems += score.inventoryItems
            existing.inventoryPoints += score.inventoryPoints
            existing.slowMovingItems += score.slowMovingItems
            existing.slowMovingPoints += score.slowMovingPoints
            existing.totalPoints += score.totalPoints
            existing.monthlyBreakdown.push(score)
            continue
        }

        cumulativeMap.set(score.salesman, {
            salesman: score.salesman,
            revenueActual: score.revenueActual,
            revenueTarget: score.revenueTarget,
            revenuePoints: score.revenuePoints,
            r49HighCustomers: score.r49HighCustomers,
            r49MidCustomers: score.r49MidCustomers,
            r49Points: score.r49Points,
            cosmeticCustomers: score.cosmeticCustomers,
            cosmeticPoints: score.cosmeticPoints,
            inventoryItems: score.inventoryItems,
            inventoryPoints: score.inventoryPoints,
            slowMovingItems: score.slowMovingItems,
            slowMovingPoints: score.slowMovingPoints,
            totalPoints: score.totalPoints,
            monthlyBreakdown: [score],
            soldProducts: new Map(),
        })
    }

    const ensureSoldProduct = (
        salesman: string,
        input: {
            materialKey: string
            materialNo: string
            materialDescription: string
            category: string
        }
    ) => {
        const current = cumulativeMap.get(salesman)
        if (!current) {
            return null
        }

        const existing = current.soldProducts.get(input.materialKey)
        if (existing) {
            return existing
        }

        const product = {
            materialKey: input.materialKey,
            materialNo: input.materialNo,
            materialDescription: input.materialDescription,
            category: input.category,
            qty: 0,
            revenue: 0,
            customers: new Set<string>(),
            periods: new Set<string>(),
            r49Points: 0,
            cosmeticPoints: 0,
            inventoryPoints: 0,
            slowMovingPoints: 0,
        }

        current.soldProducts.set(input.materialKey, product)
        return product
    }

    for (const row of salesRows) {
        const salesman = normalizeA2RSalesman(row.salesman)
        const materialKey = normalizeMaterialKey(row.materialNo)
        const materialNo = row.materialNo?.trim() || "-"
        const materialDescription = row.materialDescription?.trim() || "Tanpa deskripsi"
        const productKey = materialKey || `${normalizeText(materialDescription)}|NO-MATERIAL`
        const product = ensureSoldProduct(salesman, {
            materialKey: productKey,
            materialNo,
            materialDescription,
            category: materialCategoryMap.get(materialKey) || "-",
        })

        if (!product) {
            continue
        }

        product.qty += Number(row.qty || 0)
        product.revenue += Number(row.revenueInDocCurr || 0)

        if (row.customerName?.trim()) {
            product.customers.add(row.customerName.trim())
        }

        if (row.period) {
            product.periods.add(row.period)
        }
    }

    for (const accumulator of monthlyMap.values()) {
        for (const materialKey of accumulator.slowMovingMaterialKeys) {
            const product = ensureSoldProduct(accumulator.salesman, {
                materialKey,
                materialNo: materialKey,
                materialDescription: "Tanpa deskripsi",
                category: materialCategoryMap.get(materialKey) || "TYRE",
            })

            if (product) {
                product.category = "TYRE"
                product.slowMovingPoints += POINT_SLOW_MOVING
            }
        }

        for (const materialKey of accumulator.inventoryMaterialKeys) {
            const product = ensureSoldProduct(accumulator.salesman, {
                materialKey,
                materialNo: materialKey,
                materialDescription: "Tanpa deskripsi",
                category: materialCategoryMap.get(materialKey) || "TYRE",
            })

            if (product) {
                product.category = "TYRE"
                product.inventoryPoints += POINT_INVENTORY
            }
        }

        for (const customerBucket of accumulator.r49CustomerBuckets.values()) {
            if (customerBucket.qty <= 0 || customerBucket.materials.size === 0) {
                continue
            }

            const unitPrice = getR49UnitPrice(customerBucket.revenue, customerBucket.qty)
            const points = getR49PointsFromUnitPrice(unitPrice)

            if (points <= 0) {
                continue
            }

            const assignedMaterial = Array.from(customerBucket.materials.values())
                .sort((left, right) => {
                    if (right.revenue !== left.revenue) {
                        return right.revenue - left.revenue
                    }
                    return right.qty - left.qty
                })[0]

            if (!assignedMaterial) {
                continue
            }

            const product = ensureSoldProduct(accumulator.salesman, assignedMaterial)
            if (product) {
                product.category = "TYRE"
                product.r49Points += points
            }
        }

        for (const customerBucket of accumulator.cosmeticCustomerBuckets.values()) {
            const assignedMaterial = Array.from(customerBucket.materials.values())
                .sort((left, right) => right.revenue - left.revenue)[0]

            if (!assignedMaterial) {
                continue
            }

            const product = ensureSoldProduct(accumulator.salesman, assignedMaterial)
            if (product) {
                product.category = "TYRE"
                product.cosmeticPoints += POINT_COSMETIC
            }
        }
    }

    const rows = Array.from(cumulativeMap.values())
        .map((item) => ({
            ...item,
            achievementPct: item.revenueTarget > 0 ? (item.revenueActual / item.revenueTarget) * 100 : 0,
            monthsParticipated: item.monthlyBreakdown.length,
            monthlyBreakdown: item.monthlyBreakdown.sort((left, right) => left.period.localeCompare(right.period)),
            soldProducts: Array.from(item.soldProducts.values())
                .map((product) => ({
                    materialNo: product.materialNo,
                    materialDescription: product.materialDescription,
                    category: product.category,
                    qty: product.qty,
                    revenue: product.revenue,
                    customerCount: product.customers.size,
                    customers: Array.from(product.customers).sort((left, right) => left.localeCompare(right)),
                    periods: Array.from(product.periods)
                        .sort((left, right) => left.localeCompare(right))
                        .map((period) => monthLabel(period)),
                    r49Points: product.r49Points,
                    cosmeticPoints: product.cosmeticPoints,
                    inventoryPoints: product.inventoryPoints,
                    slowMovingPoints: product.slowMovingPoints,
                    totalPoints: product.r49Points + product.cosmeticPoints + product.inventoryPoints + product.slowMovingPoints,
                } satisfies SalesProductDetail))
                .sort((left, right) => {
                    if (right.totalPoints !== left.totalPoints) {
                        return right.totalPoints - left.totalPoints
                    }
                    if (right.revenue !== left.revenue) {
                        return right.revenue - left.revenue
                    }
                    return right.qty - left.qty
                }),
        }))
        .sort((left, right) => {
            if (right.totalPoints !== left.totalPoints) {
                return right.totalPoints - left.totalPoints
            }
            return right.revenueActual - left.revenueActual
        })

    const monthlyLeaders = selectedPeriods.map((period) => {
        const candidates = monthlyScores
            .filter((score) => score.period === period)
            .sort((left, right) => {
                if (right.totalPoints !== left.totalPoints) {
                    return right.totalPoints - left.totalPoints
                }
                return right.revenueActual - left.revenueActual
            })

        return {
            period,
            periodLabel: monthLabel(period),
            leader: candidates[0] || null,
        }
    })

    const grandChampion = rows[0] || null
    const summary = rows.reduce(
        (accumulator, row) => {
            accumulator.totalRevenue += row.revenueActual
            accumulator.totalTarget += row.revenueTarget
            accumulator.totalPoints += row.totalPoints
            accumulator.totalR49Customers += row.r49HighCustomers + row.r49MidCustomers
            accumulator.totalCosmeticCustomers += row.cosmeticCustomers
            accumulator.totalInventoryItems += row.inventoryItems
            accumulator.totalSlowMovingItems += row.slowMovingItems
            return accumulator
        },
        {
            totalRevenue: 0,
            totalTarget: 0,
            totalPoints: 0,
            totalR49Customers: 0,
            totalCosmeticCustomers: 0,
            totalInventoryItems: 0,
            totalSlowMovingItems: 0,
        }
    )

    return {
        success: true,
        data: {
            selectedYear: filters.year,
            selectedMonths: selectedMonths.map((month) => String(month).padStart(2, "0")),
            selectedPeriods,
            periodLabels: selectedPeriods.map((period) => ({
                period,
                label: monthLabel(period),
            })),
            rules: {
                revenueCap: POINT_REVENUE_CAP,
                r49HighThreshold: R49_HIGH_THRESHOLD,
                r49MidThreshold: R49_MID_THRESHOLD,
                r49HighPoint: POINT_R49_HIGH,
                r49MidPoint: POINT_R49_MID,
                cosmeticPoint: POINT_COSMETIC,
                inventoryPoint: POINT_INVENTORY,
                slowMovingPoint: POINT_SLOW_MOVING,
            },
            summary: {
                ...summary,
                activeSalesmen: rows.length,
                achievementPct: summary.totalTarget > 0 ? (summary.totalRevenue / summary.totalTarget) * 100 : 0,
            },
            rows,
            monthlyLeaders,
            grandChampion,
        },
    }
}
