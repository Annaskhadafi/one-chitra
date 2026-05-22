import { NextRequest, NextResponse } from "next/server"
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
    const cleaned = customerName.replace(/\bpt\.?\s*/gi, "").replace(/\bcv\.?\s*/gi, "").replace(/\btbk\.?\s*/gi, "").trim()
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
