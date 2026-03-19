import Fuse from "fuse.js"
import { db } from "@/db"
import { products } from "@/db/schema"

export type OcrItemInput = {
    product_name: string
    quantity: number
    price: number
}

export type OcrMappedItem = OcrItemInput & {
    product_id: number | "product_not_found"
    matched_name: string | null
    confidence: number
}

function normalizeText(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

export async function mapOcrItemsToProductIds(items: OcrItemInput[]): Promise<OcrMappedItem[]> {
    const productRows = await db.select({
        id: products.id,
        materialNumber: products.materialNumber,
        oldMaterialNo: products.oldMaterialNo,
        materialDescription: products.materialDescription,
    }).from(products)

    const fuse = new Fuse(productRows, {
        keys: ["materialDescription", "materialNumber", "oldMaterialNo"],
        includeScore: true,
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
    })

    return items.map((item) => {
        const query = normalizeText(item.product_name)
        const best = fuse.search(query, { limit: 1 })[0]
        const confidence = best ? 1 - (best.score ?? 1) : 0

        if (!best || confidence < 0.5) {
            return {
                ...item,
                product_id: "product_not_found",
                matched_name: null,
                confidence,
            }
        }

        return {
            ...item,
            product_id: best.item.id,
            matched_name: best.item.materialDescription || best.item.materialNumber,
            confidence,
        }
    })
}
