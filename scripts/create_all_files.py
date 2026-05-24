import os, sys

base = r"D:\[01] PROJECT\one-chitra"

def write(rel, content):
    p = os.path.join(base, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    print("wrote:", rel)

# 1. customers schema
write("db/schema/customers.ts", '''import { pgTable, serial, varchar, text, timestamp, date } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
    id: serial("id").primaryKey(),
    customerCode: varchar("customer_code", { length: 100 }).unique().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    birthday: date("birthday"),
    address1: text("address_1"),
    address2: text("address_2"),
    address3: text("address_3"),
    address4: text("address_4"),
    address5: text("address_5"),
    businessCategory: varchar("business_category", { length: 255 }),
    businessCategorySource: varchar("business_category_source", { length: 100 }),
    businessCategoryEnrichedAt: timestamp("business_category_enriched_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
''')

# 2. migration
write("drizzle/0043_customer_business_category.sql", '''ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_category" varchar(255);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_category_source" varchar(100);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "business_category_enriched_at" timestamp;
''')

# 3. server action
write("app/actions/customer-industry.ts", '''"use server"

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
        .replace(/\\bpt\\.?\\s*/gi, "")
        .replace(/\\bcv\\.?\\s*/gi, "")
        .replace(/\\btbk\\.?\\s*/gi, "")
        .replace(/[.,\\-_]/g, " ")
        .replace(/\\s+/g, " ")
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
''')

# 4. API route
write("app/api/customer-industry-enrich/route.ts", '''import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { customers } from "@/db/schema"
import { eq, isNull, or } from "drizzle-orm"

const WEB_FETCH_BASE = "https://9router.chitraparatama.com/v1/web/fetch"
const WEB_FETCH_TOKEN = "sk-ee87ff36bc463f56-sxrwh0-272f06c4"

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
    "Mining Contractor": ["mining contractor", "kontraktor tambang", "pertambangan", "coal mining", "nickel mining", "gold mining", "copper mining", "mine contractor", "mining services"],
    "Mining Owner": ["mine owner", "pemilik tambang", "mining company", "perusahaan tambang", "coal producer", "mineral producer"],
    "Perkebunan": ["perkebunan", "plantation", "kelapa sawit", "palm oil", "karet", "rubber plantation", "agribusiness"],
    "Konstruksi": ["konstruksi", "construction", "kontraktor", "civil contractor", "infrastructure"],
    "Minyak dan Gas": ["oil and gas", "minyak gas", "migas", "petroleum", "oil company", "gas company", "energy company"],
    "Kehutanan": ["kehutanan", "forestry", "logging", "hutan", "timber"],
    "Transportasi dan Logistik": ["transportasi", "logistik", "logistics", "trucking", "angkutan", "freight", "cargo", "ekspedisi"],
    "Pemerintah": ["pemerintah", "government", "dinas", "bumn", "state-owned", "kementerian", "ministry"],
    "Manufaktur": ["manufaktur", "manufacturing", "pabrik", "factory", "industri", "industrial"],
    "Perdagangan": ["perdagangan", "trading", "distributor", "dealer", "supplier"],
    "Quarry": ["quarry", "galian", "stone quarry", "aggregate"],
    "Agribisnis": ["agribisnis", "agribusiness", "pertanian", "agriculture", "farming"],
}

async function webFetch(model: "tavily" | "firecrawl", url: string): Promise<string | null> {
    try {
        const res = await fetch(WEB_FETCH_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${WEB_FETCH_TOKEN}` },
            body: JSON.stringify({ model, url, format: "markdown", max_characters: 8000 }),
            signal: AbortSignal.timeout(20000),
        })
        if (!res.ok) return null
        const json = await res.json()
        return json?.content || json?.markdown || json?.text || null
    } catch { return null }
}

function detectIndustry(text: string): string | null {
    if (!text) return null
    const lower = text.toLowerCase()
    for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
        for (const kw of keywords) {
            if (lower.includes(kw)) return industry
        }
    }
    return null
}

function buildSearchUrl(customerName: string): string {
    const cleaned = customerName.replace(/\\bpt\\.?\\s*/gi, "").replace(/\\bcv\\.?\\s*/gi, "").replace(/\\btbk\\.?\\s*/gi, "").trim()
    return `https://www.google.com/search?q=${encodeURIComponent(cleaned + " perusahaan bidang usaha Indonesia")}`
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { customerName, customerId } = body as { customerName?: string; customerId?: number }
        if (!customerName) return NextResponse.json({ error: "customerName is required" }, { status: 400 })

        const searchUrl = buildSearchUrl(customerName)
        let content = await webFetch("tavily", searchUrl)
        let source = "tavily"
        if (!content) { content = await webFetch("firecrawl", searchUrl); source = "firecrawl" }

        const industry = content ? detectIndustry(content) : null

        if (customerId && industry) {
            await db.update(customers).set({
                businessCategory: industry,
                businessCategorySource: source,
                businessCategoryEnrichedAt: new Date(),
                updatedAt: new Date(),
            }).where(eq(customers.id, customerId))
        }

        return NextResponse.json({ customerName, industry, source: content ? source : null, enriched: !!industry })
    } catch (err) {
        console.error("[customer-industry-enrich POST]", err)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const limit = parseInt(searchParams.get("limit") || "20", 10)

        const unenriched = await db.select({ id: customers.id, name: customers.name })
            .from(customers)
            .where(or(isNull(customers.businessCategory), eq(customers.businessCategory, "")))
            .limit(limit)

        const results: Array<{ id: number; name: string; industry: string | null; source: string | null }> = []

        for (const customer of unenriched) {
            const searchUrl = buildSearchUrl(customer.name)
            let content = await webFetch("tavily", searchUrl)
            let source: string | null = "tavily"
            if (!content) { content = await webFetch("firecrawl", searchUrl); source = content ? "firecrawl" : null }
            const industry = content ? detectIndustry(content) : null
            if (industry) {
                await db.update(customers).set({
                    businessCategory: industry,
                    businessCategorySource: source,
                    businessCategoryEnrichedAt: new Date(),
                    updatedAt: new Date(),
                }).where(eq(customers.id, customer.id))
            }
            results.push({ id: customer.id, name: customer.name, industry, source })
            await new Promise((r) => setTimeout(r, 300))
        }

        return NextResponse.json({ enriched: results.filter((r) => r.industry).length, total: results.length, results })
    } catch (err) {
        console.error("[customer-industry-enrich GET]", err)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
''')

# 5. page
write("app/dashboard/customer-industry/page.tsx", '''import { Metadata } from "next"
import { CustomerIndustryClient } from "./_components/customer-industry-client"

export const metadata: Metadata = {
    title: "Customer Industry Mapping | One Chitra",
    description: "Pemetaan customer berdasarkan bidang usaha dan kategori ban yang dibeli",
}

export default function CustomerIndustryPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Customer Industry Mapping</h2>
                    <p className="text-muted-foreground mt-1">
                        Pemetaan customer berdasarkan bidang usaha &amp; kategori ban yang pernah dibeli
                    </p>
                </div>
            </div>
            <CustomerIndustryClient />
        </div>
    )
}
''')

print("All files written successfully!")
