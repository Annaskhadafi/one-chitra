"use server"

import { db } from "@/db"
import { products, stockLevels } from "@/db/schema"
import { eq, sql, inArray, ilike } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { productSchema } from "@/lib/schemas"
import { normalizeSloc, normalizeSlocFields } from "@/lib/sloc"

const DEFAULT_PRODUCT_CATEGORIES = [
    "ACC",
    "FLAP",
    "IMT PART",
    "Material Consumable",
    "SPM",
    "TUBE",
    "TYRE",
    "WHEEL & RIM",
]

type ProductListRow = typeof products.$inferSelect & {
    totalStock: number
    stockLevelCount: number
    movementCount: number
    salesOrderCount: number
    deliveryCount: number
    quotationCount: number
}

type ProductDisplayRow = Omit<
    ProductListRow,
    "stockLevelCount" | "movementCount" | "salesOrderCount" | "deliveryCount" | "quotationCount"
>

function dedupeProductsForDisplay(rows: ProductListRow[]): ProductDisplayRow[] {
    const bestByKey = new Map<string, ProductListRow>()

    const scoreRow = (row: ProductListRow) => {
        const referenceCount =
            row.stockLevelCount +
            row.movementCount +
            row.salesOrderCount +
            row.deliveryCount +
            row.quotationCount

        return {
            hasReferences: referenceCount > 0 ? 1 : 0,
            referenceCount,
            stockMagnitude: Math.abs(row.totalStock),
            updatedAt: row.updatedAt?.getTime() ?? 0,
            id: row.id,
        }
    }

    for (const row of rows) {
        const key = `${(row.materialNumber || "").trim().toUpperCase()}|${normalizeSloc(row.sloc)}`
        const current = bestByKey.get(key)

        if (!current) {
            bestByKey.set(key, row)
            continue
        }

        const candidateScore = scoreRow(row)
        const currentScore = scoreRow(current)

        const shouldReplace =
            candidateScore.hasReferences > currentScore.hasReferences ||
            (candidateScore.hasReferences === currentScore.hasReferences &&
                candidateScore.referenceCount > currentScore.referenceCount) ||
            (candidateScore.hasReferences === currentScore.hasReferences &&
                candidateScore.referenceCount === currentScore.referenceCount &&
                candidateScore.stockMagnitude > currentScore.stockMagnitude) ||
            (candidateScore.hasReferences === currentScore.hasReferences &&
                candidateScore.referenceCount === currentScore.referenceCount &&
                candidateScore.stockMagnitude === currentScore.stockMagnitude &&
                candidateScore.updatedAt > currentScore.updatedAt) ||
            (candidateScore.hasReferences === currentScore.hasReferences &&
                candidateScore.referenceCount === currentScore.referenceCount &&
                candidateScore.stockMagnitude === currentScore.stockMagnitude &&
                candidateScore.updatedAt === currentScore.updatedAt &&
                candidateScore.id > currentScore.id)

        if (shouldReplace) {
            bestByKey.set(key, row)
        }
    }

    return Array.from(bestByKey.values())
        .map(({ stockLevelCount, movementCount, salesOrderCount, deliveryCount, quotationCount, ...row }) => row)
        .sort((a, b) => a.materialNumber.localeCompare(b.materialNumber))
}

export async function getProducts(): Promise<ProductDisplayRow[]> {
    const aggregatedStock = db.select({
        productId: stockLevels.productId,
        totalStockSum: sql<number>`sum(${stockLevels.totalStock})`.as('total_stock_sum')
    })
        .from(stockLevels)
        .groupBy(stockLevels.productId)
        .as('aggregated_stock')

    const results = await db.select({
        id: products.id,
        category: products.category,
        materialNumber: products.materialNumber,
        materialNumberCk: products.materialNumberCk,
        oldMaterialNo: products.oldMaterialNo,
        materialDescription: products.materialDescription,
        brand: products.brand,
        costSap: products.costSap,
        plant: products.plant,
        sloc: products.sloc,
        slocDescription: products.slocDescription,
        typeWarehouse: products.typeWarehouse,
        imageUrl: products.imageUrl,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        isBundle: products.isBundle,
        isConsignment: products.isConsignment,
        totalStock: sql<number>`coalesce(${aggregatedStock.totalStockSum}, 0)`.mapWith(Number),
        stockLevelCount: sql<number>`(
            select count(*)
            from stock_levels sl
            where sl.product_id = ${products.id}
        )`.mapWith(Number),
        movementCount: sql<number>`(
            select count(*)
            from stock_movements sm
            where sm.product_id = ${products.id}
        )`.mapWith(Number),
        salesOrderCount: sql<number>`(
            select count(*)
            from sales_order_items soi
            where soi.product_id = ${products.id}
        )`.mapWith(Number),
        deliveryCount: sql<number>`(
            select count(*)
            from delivery_items di
            where di.product_id = ${products.id}
        )`.mapWith(Number),
        quotationCount: sql<number>`(
            select count(*)
            from quotation_items qi
            where qi.product_id = ${products.id}
        )`.mapWith(Number),
    })
        .from(products)
        .leftJoin(aggregatedStock, eq(products.id, aggregatedStock.productId))
        .orderBy(products.materialNumber)

    return dedupeProductsForDisplay(normalizeSlocFields(results))
}

export async function getProductCategories(): Promise<string[]> {
    const rows = await db
        .selectDistinct({
            category: products.category,
        })
        .from(products)

    const categories = new Set<string>(DEFAULT_PRODUCT_CATEGORIES)

    for (const row of rows) {
        const value = row.category?.trim()
        if (value) {
            categories.add(value)
        }
    }

    return Array.from(categories).sort((a, b) => a.localeCompare(b))
}

export async function createProduct(data: z.infer<typeof productSchema>) {
    return await upsertProduct(data)
}

export async function updateProduct(id: number, data: z.infer<typeof productSchema>) {
    return await upsertProduct(data, id)
}

export async function upsertProduct(data: z.infer<typeof productSchema>, id?: number) {
    try {
        const normalizedData = {
            ...data,
            category: data.category.trim(),
            materialNumber: data.materialNumber.trim().toUpperCase(),
            oldMaterialNo: data.oldMaterialNo?.trim() || null,
            materialDescription: data.materialDescription?.trim() || null,
            brand: data.brand?.trim() || null,
            plant: data.plant?.trim().toUpperCase() || null,
            sloc: normalizeSloc(data.sloc),
            slocDescription: data.slocDescription?.trim() || null,
            imageUrl: data.imageUrl?.trim() || null,
        }

        if (!normalizedData.sloc) {
            return { success: false, error: "Sloc is required" }
        }

        if (!normalizedData.category) {
            return { success: false, error: "Category is required" }
        }

        if (id) {
            const existingProducts = await db.select({ id: products.id, sloc: products.sloc })
                .from(products)
                .where(eq(products.materialNumber, normalizedData.materialNumber))
            const existing = existingProducts.find((product) => normalizeSloc(product.sloc) === normalizedData.sloc)
            if (existing && existing.id !== id) {
                return { success: false, error: "Product with this Material Number and Sloc already exists" }
            }

            await db.update(products)
                .set({
                    category: normalizedData.category,
                    materialNumber: normalizedData.materialNumber,
                    oldMaterialNo: normalizedData.oldMaterialNo,
                    materialDescription: normalizedData.materialDescription,
                    brand: normalizedData.brand,
                    costSap: normalizedData.costSap,
                    plant: normalizedData.plant,
                    sloc: normalizedData.sloc,
                    slocDescription: normalizedData.slocDescription,
                    imageUrl: normalizedData.imageUrl,
                    updatedAt: new Date()
                })
                .where(eq(products.id, id))
        } else {
            const existingProducts = await db.select({ id: products.id, sloc: products.sloc })
                .from(products)
                .where(eq(products.materialNumber, normalizedData.materialNumber))
            const existing = existingProducts.find((product) => normalizeSloc(product.sloc) === normalizedData.sloc)
            if (existing) {
                return { success: false, error: "Product with this Material Number and Sloc already exists" }
            }
            await db.insert(products).values({
                category: normalizedData.category,
                materialNumber: normalizedData.materialNumber,
                oldMaterialNo: normalizedData.oldMaterialNo,
                materialDescription: normalizedData.materialDescription,
                brand: normalizedData.brand,
                costSap: normalizedData.costSap,
                plant: normalizedData.plant,
                sloc: normalizedData.sloc,
                slocDescription: normalizedData.slocDescription,
                imageUrl: normalizedData.imageUrl,
            })
        }

        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        console.error("Upsert Product Error:", _error)
        return { success: false, error: "Failed to upsert product" }
    }
}

export async function deleteProduct(id: number) {
    try {
        await db.delete(products).where(eq(products.id, id))
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to delete product" }
    }
}

export async function importProducts(data: (typeof products.$inferInsert)[]) {
    try {
        if (data.length === 0) return { success: true }

        console.log(`[importProducts] Received ${data.length} products to import`)

        // De-duplicate data in the batch to prevent "duplicate key" error within the same INSERT statement
        const seen = new Set<string>()
        const uniqueData: (typeof products.$inferInsert)[] = []
        let skippedInvalidRows = 0

        for (const item of data) {
            // Normalize data: Trim and UpperCase to match database consistency rules
            const matNum = (item.materialNumber || "").trim().toUpperCase()
            const sloc = normalizeSloc(item.sloc)
            if (!matNum || !sloc) {
                skippedInvalidRows++
                continue
            }
            const key = `${matNum}|${sloc}`

            if (!seen.has(key)) {
                seen.add(key)
                uniqueData.push({
                    ...item,
                    materialNumber: matNum,
                    sloc: sloc,
                    // Also normalize other fields just in case
                    category: (item.category || "TYRE").toUpperCase(),
                    plant: item.plant?.trim().toUpperCase(),
                })
            }
        }

        if (uniqueData.length !== data.length) {
            console.log(`[importProducts] Removed ${data.length - uniqueData.length} duplicates from the batch`)
        }
        if (skippedInvalidRows > 0) {
            console.log(`[importProducts] Skipped ${skippedInvalidRows} rows without material number or sloc`)
        }

        console.log(`[importProducts] Starting import of ${uniqueData.length} unique products`)

        // Insert in chunks
        const chunkSize = 50
        for (let i = 0; i < uniqueData.length; i += chunkSize) {
            const chunk = uniqueData.slice(i, i + chunkSize)
            console.log(`[importProducts] Inserting chunk ${Math.floor(i / chunkSize) + 1}, size: ${chunk.length}`)
            await db.insert(products)
                .values(chunk)
                .onConflictDoUpdate({
                    target: [products.materialNumber, products.sloc],
                    set: {
                        category: sql`excluded.category`,
                        oldMaterialNo: sql`excluded.old_material_no`,
                        materialDescription: sql`excluded.material_description`,
                        brand: sql`excluded.brand`,
                        costSap: sql`excluded.cost_sap`,
                        plant: sql`excluded.plant`,
                        slocDescription: sql`excluded.sloc_description`,
                        typeWarehouse: sql`excluded.type_warehouse`,
                        imageUrl: sql`excluded.image_url`,
                        updatedAt: new Date()
                    }
                })
        }

        console.log(`[importProducts] Import complete!`)
        revalidatePath("/dashboard/products")
        return {
            success: true,
            skippedInvalidRows,
        }
    } catch (_error) {
        console.error("Import error:", _error)
        const msg = (_error as { message?: string })?.message || "Unknown error"
        return { success: false, error: `Failed to import products: ${msg}` }
    }
}

export async function importMaterialCk(data: { materialNumber: string, materialNumberCk: string }[]) {
    try {
        if (data.length === 0) return { success: true }

        console.log(`[importMaterialCk] Received ${data.length} mappings`)

        const uniqueData = new Map<string, string>()
        for (const item of data) {
            const matNum = (item.materialNumber || "").trim().toUpperCase()
            const ckNum = (item.materialNumberCk || "").trim().toUpperCase()
            if (matNum && ckNum) {
                uniqueData.set(matNum, ckNum)
            }
        }

        console.log(`[importMaterialCk] Processing ${uniqueData.size} unique mappings`)

        let updatedCount = 0
        const entries = Array.from(uniqueData.entries())
        const chunkSize = 50

        for (let i = 0; i < entries.length; i += chunkSize) {
            const chunk = entries.slice(i, i + chunkSize)
            // For each item in the chunk, update the product
            // Drizzle doesn't have a bulk update with multiple different values easily without raw SQL CASE statements,
            // so we can loop or use a transaction. Given the context, executing individually in a Promise.all or sequentially is fine for typical sizes.
            await Promise.all(chunk.map(async ([matNum, ckNum]) => {
                const res = await db.update(products)
                    .set({ materialNumberCk: ckNum, updatedAt: new Date() })
                    .where(ilike(products.materialNumber, matNum))
                
                // Note: db.update.where might update multiple rows if materialNumber is not unique (e.g. diff sloc). 
                // That's acceptable here since Material Number CK is tied to Material Number theoretically.
            }))
            updatedCount += chunk.length
        }

        console.log(`[importMaterialCk] Import complete. Processed chunks for ${updatedCount} products.`)
        revalidatePath("/dashboard/products")
        return { success: true, count: updatedCount }
    } catch (_error) {
        console.error("Import CK error:", _error)
        const msg = (_error as { message?: string })?.message || "Unknown error"
        return { success: false, error: `Failed to import Material CK: ${msg}` }
    }
}


export async function getProductByMaterialNumber(materialNumber: string) {
    return await db.query.products.findFirst({
        where: eq(products.materialNumber, materialNumber)
    })
}

export async function getProductStats() {
    const allProducts = await getProducts()
    return {
        total: allProducts.length
    }
}

export async function updateProductField(id: number, field: keyof typeof products.$inferSelect, value: string | number | Date | null) {
    try {
        await db.update(products)
            .set({
                [field]: value,
                updatedAt: new Date()
            })
            .where(eq(products.id, id))

        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        return { success: false, error: "Failed to update product" }
    }
}

export async function bulkDeleteProducts(ids: number[]) {
    try {
        await db.delete(products).where(inArray(products.id, ids))
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        console.error("Bulk delete error:", _error)
        return { success: false, error: "Failed to delete products" }
    }
}

export async function bulkUpdateProductCategory(ids: number[], category: string) {
    try {
        await db.update(products)
            .set({ category, updatedAt: new Date() })
            .where(inArray(products.id, ids))
        revalidatePath("/dashboard/products")
        return { success: true }
    } catch (_error) {
        console.error("Bulk update category error:", _error)
        return { success: false, error: "Failed to update product categories" }
    }
}

type StockSapCostRow = {
    stock_id: number
    material_no: string | null
    stor_loc: string | null
    total_stock: string | number | null
    value_stock: string | number | null
}

const normalizeMaterial = (value: string | null | undefined) => (value || "").trim().toUpperCase()

const formatCost = (value: number) => {
    if (!Number.isFinite(value)) return "0"
    return value.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
}

export async function syncProductCostSapFromStockSapNew() {
    try {
        const result = await db.execute(sql`
            SELECT DISTINCT ON (material_no, stor_loc)
                stock_id,
                material_no,
                stor_loc,
                total_stock,
                value_stock,
                base_unit_of_measure
            FROM public.zmc9_stock_sap
            ORDER BY material_no, stor_loc, extracted_at DESC NULLS LAST, stock_id DESC
        `)

        const sapRows = result.rows as StockSapCostRow[]

        if (!sapRows.length) {
            return { success: true as const, updatedCount: 0, skippedCount: 0, message: "No Stock SAP New rows with UoM PC" }
        }

        const allProducts = await db.select({
            id: products.id,
            materialNumber: products.materialNumber,
            sloc: products.sloc,
            costSap: products.costSap,
        }).from(products)

        const productMap = new Map<string, { id: number; costSap: string | null }>()
        for (const product of allProducts) {
            const key = `${normalizeMaterial(product.materialNumber)}|${normalizeSloc(product.sloc)}`
            productMap.set(key, { id: product.id, costSap: product.costSap })
        }

        let updatedCount = 0
        let skippedCount = 0

        for (const row of sapRows) {
            const material = normalizeMaterial(row.material_no)
            const sloc = normalizeSloc(row.stor_loc)
            if (!material || !sloc) {
                skippedCount++
                continue
            }

            const qty = Number(row.total_stock ?? 0)
            const valuation = Number(row.value_stock ?? 0)

            if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(valuation)) {
                skippedCount++
                continue
            }

            const costSap = formatCost(valuation / qty)
            const key = `${material}|${sloc}`
            const target = productMap.get(key)

            if (!target) {
                skippedCount++
                continue
            }

            if ((target.costSap || "") === costSap) {
                continue
            }

            await db.update(products)
                .set({ costSap, updatedAt: new Date() })
                .where(eq(products.id, target.id))

            updatedCount++
        }

        revalidatePath("/dashboard/products")
        revalidatePath("/dashboard/stocks")
        revalidatePath("/dashboard/inventory")

        return {
            success: true as const,
            updatedCount,
            skippedCount,
            message: `Synced ${updatedCount} product costs from Stock SAP New`
        }
    } catch (error) {
        console.error("Sync Product Cost SAP from Stock SAP New failed:", error)
        return { success: false as const, error: "Failed to sync Cost SAP from Stock SAP New" }
    }
}
