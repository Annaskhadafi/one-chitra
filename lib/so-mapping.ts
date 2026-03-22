import Fuse from "fuse.js"
import { db } from "@/db"
import { customers, products } from "@/db/schema"
import type { ExtractedSOData } from "./mistral-ocr"

export type MappedCustomer = {
    id: number | null
    name: string
    code?: string | null
    confidence: number
    candidates: Array<{ id: number; name: string; code: string; score: number }>
}

export type MappedProduct = {
    id: number | null
    name: string
    code?: string | null
    confidence: number
    candidates: Array<{ id: number; name: string; materialNumber: string; score: number }>
}

export type MappingResult = {
    customer: MappedCustomer
    items: MappedProduct[]
}

function normalizeName(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

export async function mapExtractedToMaster(data: ExtractedSOData): Promise<MappingResult> {
    const custList = await db.select().from(customers)
    const prodList = await db.select().from(products)

    const custFuse = new Fuse(custList, {
        keys: ["name", "customerCode"],
        includeScore: true,
        threshold: 0.4,
        ignoreLocation: true,
        findAllMatches: true,
        minMatchCharLength: 2,
    })
    const prodFuse = new Fuse(prodList, {
        keys: ["materialDescription", "materialNumber", "oldMaterialNo"],
        includeScore: true,
        threshold: 0.4,
        ignoreLocation: true,
        findAllMatches: true,
        minMatchCharLength: 2,
    })

    const custQuery = normalizeName(data.customer_company_name)
    const custMatches = custFuse.search(custQuery).slice(0, 5)
    const custBest = custMatches[0]
    const customer: MappedCustomer = {
        id: custBest ? custBest.item.id : null,
        name: data.customer_company_name,
        code: data.customer_code || null,
        confidence: custBest ? 1 - (custBest.score ?? 0) : 0,
        candidates: custMatches.map(m => ({
            id: m.item.id,
            name: m.item.name,
            code: m.item.customerCode,
            score: 1 - (m.score ?? 1),
        })),
    }

    const items: MappedProduct[] = data.products.map((p) => {
        const nameQuery = normalizeName(p.name)
        const codeQuery = (p.code || "").trim()
        let matches = prodFuse.search(nameQuery).slice(0, 5)
        if (codeQuery) {
            const codeHits = prodFuse.search(codeQuery).slice(0, 5)
            matches = [...codeHits, ...matches].slice(0, 5)
        }
        const best = matches[0]
        return {
            id: best ? best.item.id : null,
            name: p.name,
            code: p.code || null,
            confidence: best ? 1 - (best.score ?? 0) : 0,
            candidates: matches.map(m => ({
                id: m.item.id,
                name: m.item.materialDescription || m.item.materialNumber,
                materialNumber: m.item.materialNumber,
                score: 1 - (m.score ?? 1),
            })),
        }
    })

    return { customer, items }
}
