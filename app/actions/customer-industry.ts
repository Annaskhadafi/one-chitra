"use server"

import { db } from "@/db"
import { customers } from "@/db/schema"
import { salesRevenueSap } from "@/db/schema/sap"
import { sql, and, isNotNull, notIlike, eq, isNull, or } from "drizzle-orm"

export interface CustomerIndustryRow {
    customerId: number | null
    customerName: string
    businessCategory: string | null
    businessCategorySource: string | null
    totalRevenue: number
    tyreCategories: string[]
    tyreCategoryRevenue: Record<string, number>
    lastPurchaseDate: string | null
}

export interface IndustrySummary {
    industry: string
    customerCount: number
    totalRevenue: number
    topTyreCategories: string[]
}

export interface CustomerIndustryDashboardData {
    rows: CustomerIndustryRow[]
    industrySummary: IndustrySummary[]
    tyreCategoryList: string[]
    totalCustomers: number
    enrichedCount: number
    unenrichedCount: number
}

function buildBaseWhere() {
    return and(
        isNotNull(salesRevenueSap.customerName),
        notIlike(salesRevenueSap.customerName, "%Chitra Paratama Singapore Branch%"),
        notIlike(salesRevenueSap.customerName, "%Chitra Paratama%"),
        notIlike(salesRevenueSap.customerName, "%TRANSITYRE B.V%"),
        notIlike(salesRevenueSap.customer, "%ITC008%"),
        notIlike(salesRevenueSap.customer, "%1000289A%"),
    )
}

function normName(n: string) {
    return n.toLowerCase()
        .replace(/\bpt\.?\s*/gi, "")
        .replace(/\bcv\.?\s*/gi, "")
        .replace(/\btbk\.?\s*/gi, "")
        .replace(/[.,\-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

export async function getCustomerIndustryDashboard(): Promise<{ success: true; data: CustomerIndustryDashboardData } | { success: false; error: string }> {
    try {
        const revenueRows = await db
            .select({
                customerName: salesRevenueSap.customerName,
                matGrpDesc: salesRevenueSap.matGrpDesc,
                totalRevenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`,
                lastPurchaseDate: sql<string>`MAX(${salesRevenueSap.billingDate})`,
            })
            .from(salesRevenueSap)
            .where(buildBaseWhere())
            .groupBy(salesRevenueSap.customerName, salesRevenueSap.matGrpDesc)

        const customerRows = await db
            .select({
                id: customers.id,
                name: customers.name,
                businessCategory: customers.businessCategory,
                businessCategorySource: customers.businessCategorySource,
            })
            .from(customers)

        const customerMap = new Map<string, { id: number; businessCategory: string | null; businessCategorySource: string | null }>()
        for (const c of customerRows) {
            customerMap.set(normName(c.name), { id: c.id, businessCategory: c.businessCategory, businessCategorySource: c.businessCategorySource })
        }

        const customerAgg = new Map<string, {
            customerId: number | null
            businessCategory: string | null
            businessCategorySource: string | null
            totalRevenue: number
            tyreCategoryRevenue: Record<string, number>
            lastPurchaseDate: string | null
        }>()

        const tyreCategorySet = new Set<string>()

        for (const row of revenueRows) {
            const name = row.customerName || ""
            if (!name) continue
            const matched = customerMap.get(normName(name))
            const matGrp = (row.matGrpDesc || "").trim()
            const rev = Number(row.totalRevenue) || 0
            const lastDate = row.lastPurchaseDate ? String(row.lastPurchaseDate) : null
            const existing = customerAgg.get(name)
            if (!existing) {
                customerAgg.set(name, {
                    customerId: matched?.id ?? null,
                    businessCategory: matched?.businessCategory ?? null,
                    businessCategorySource: matched?.businessCategorySource ?? null,
                    totalRevenue: rev,
                    tyreCategoryRevenue: matGrp ? { [matGrp]: rev } : {},
                    lastPurchaseDate: lastDate,
                })
            } else {
                existing.totalRevenue += rev
                if (matGrp) existing.tyreCategoryRevenue[matGrp] = (existing.tyreCategoryRevenue[matGrp] || 0) + rev
                if (lastDate && (!existing.lastPurchaseDate || lastDate > existing.lastPurchaseDate)) existing.lastPurchaseDate = lastDate
            }
            if (matGrp) tyreCategorySet.add(matGrp)
        }

        const rows: CustomerIndustryRow[] = Array.from(customerAgg.entries()).map(([name, agg]) => ({
            customerId: agg.customerId,
            customerName: name,
            businessCategory: agg.businessCategory,
            businessCategorySource: agg.businessCategorySource,
            totalRevenue: agg.totalRevenue,
            tyreCategories: Object.keys(agg.tyreCategoryRevenue).sort(),
            tyreCategoryRevenue: agg.tyreCategoryRevenue,
            lastPurchaseDate: agg.lastPurchaseDate,
        })).sort((a, b) => b.totalRevenue - a.totalRevenue)

        const industryAgg = new Map<string, { customerCount: number; totalRevenue: number; tyreCats: Map<string, number> }>()
        for (const row of rows) {
            const industry = row.businessCategory || "Belum Dikategorikan"
            const existing = industryAgg.get(industry)
            if (!existing) {
                const tyreCats = new Map<string, number>()
                for (const [cat, rev] of Object.entries(row.tyreCategoryRevenue)) tyreCats.set(cat, rev)
                industryAgg.set(industry, { customerCount: 1, totalRevenue: row.totalRevenue, tyreCats })
            } else {
                existing.customerCount++
                existing.totalRevenue += row.totalRevenue
                for (const [cat, rev] of Object.entries(row.tyreCategoryRevenue)) existing.tyreCats.set(cat, (existing.tyreCats.get(cat) || 0) + rev)
            }
        }

        const industrySummary: IndustrySummary[] = Array.from(industryAgg.entries())
            .map(([industry, agg]) => ({
                industry,
                customerCount: agg.customerCount,
                totalRevenue: agg.totalRevenue,
                topTyreCategories: Array.from(agg.tyreCats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat]) => cat),
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue)

        const enrichedCount = rows.filter((r) => r.businessCategory).length

        return {
            success: true,
            data: {
                rows,
                industrySummary,
                tyreCategoryList: Array.from(tyreCategorySet).sort(),
                totalCustomers: rows.length,
                enrichedCount,
                unenrichedCount: rows.length - enrichedCount,
            },
        }
    } catch (err) {
        console.error("[getCustomerIndustryDashboard] error:", err)
        return { success: false, error: "Failed to fetch customer industry data" }
    }
}

export async function updateCustomerBusinessCategory(customerId: number, businessCategory: string) {
    try {
        await db.update(customers).set({
            businessCategory,
            businessCategorySource: "manual",
            businessCategoryEnrichedAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(customers.id, customerId))
        return { success: true }
    } catch (err) {
        console.error("[updateCustomerBusinessCategory] error:", err)
        return { success: false, error: "Failed to update business category" }
    }
}

export async function getUnenrichedCustomers(limit = 50) {
    try {
        const rows = await db.select({ id: customers.id, name: customers.name })
            .from(customers)
            .where(or(isNull(customers.businessCategory), eq(customers.businessCategory, "")))
            .limit(limit)
        return { success: true, data: rows }
    } catch (err) {
        return { success: false, error: "Failed to fetch unenriched customers" }
    }
}
