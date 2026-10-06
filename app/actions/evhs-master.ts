"use server"

import { db } from "@/db"
import { evhsMasterPrices } from "@/db/schema/evhs"
import { products } from "@/db/schema/products"
import { eq, and, sql, inArray, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { parseCleanPrice, formatPriceToDbString, matchWarehouse } from "@/lib/evhs-price-parser"

function safeRevalidate(path: string) {
    try {
        revalidatePath(path)
    } catch {
        // Abaikan jika dipanggil di luar active request context
    }
}

type ImportedMasterPriceRow = {
    warehouseId?: number
    sloc?: string
    materialNumberCp: string
    materialNumberCk?: string
    price: string | number
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui"
}

function normalizeMaterialKey(value?: string | null) {
    const normalized = value?.trim()
    if (!normalized) return null

    const upper = normalized.toUpperCase()
    if (upper === "N/A" || upper === "NA" || upper === "-") {
        return null
    }

    return normalized
}

export async function getEvhsMasterPrices() {
    try {
        const data = await db.query.evhsMasterPrices.findMany({
            with: {
                warehouse: true
            },
            orderBy: (prices, { desc }) => [desc(prices.createdAt)]
        })

        const materialNumbers = Array.from(
            new Set(
                data
                    .flatMap((item) => [
                        normalizeMaterialKey(item.materialNumberCk),
                        normalizeMaterialKey(item.materialNumberCp),
                    ])
                    .filter((value): value is string => Boolean(value))
            )
        )

        if (materialNumbers.length === 0) {
            return data.map((item) => ({
                ...item,
                productDescription: null,
            }))
        }

        const matchedProducts = await db
            .select({
                materialNumber: products.materialNumber,
                materialNumberCk: products.materialNumberCk,
                materialDescription: products.materialDescription,
            })
            .from(products)
            .where(
                or(
                    inArray(products.materialNumberCk, materialNumbers),
                    inArray(products.materialNumber, materialNumbers)
                )
            )

        const productDescriptionByMaterial = new Map(
            matchedProducts.flatMap((product) => {
                const description = product.materialDescription?.trim() || null
                const keys = [product.materialNumberCk?.trim(), product.materialNumber?.trim()].filter(
                    (value): value is string => Boolean(value)
                )

                return keys.map((key) => [key, description] as const)
            })
        )

        return data.map((item) => ({
            ...item,
            productDescription:
                (normalizeMaterialKey(item.materialNumberCk)
                    ? (productDescriptionByMaterial.get(normalizeMaterialKey(item.materialNumberCk)!) ?? null)
                    : null) ??
                (normalizeMaterialKey(item.materialNumberCp)
                    ? (productDescriptionByMaterial.get(normalizeMaterialKey(item.materialNumberCp)!) ?? null)
                    : null),
        }))
    } catch (error) {
        console.error("Error fetching master prices:", error)
        return []
    }
}

export async function createOrUpdateMasterPrice(data: {
    materialNumberCp: string
    materialNumberCk?: string | null
    warehouseId: number
    price: string | number
}) {
    try {
        const materialCp = data.materialNumberCp?.trim()
        if (!materialCp) {
            return { success: false, error: "Material CP wajib diisi" }
        }

        if (!data.warehouseId) {
            return { success: false, error: "Warehouse / Sloc wajib dipilih" }
        }

        const numericPrice = parseCleanPrice(data.price)
        if (numericPrice === null || numericPrice < 0) {
            return { success: false, error: `Format harga tidak valid: ${String(data.price || "")}` }
        }

        const dbPriceString = formatPriceToDbString(numericPrice)
        const materialCk = data.materialNumberCk?.trim() || null

        // Cek jika sudah ada data untuk material & warehouse ini
        const existing = await db.query.evhsMasterPrices.findFirst({
            where: and(
                eq(evhsMasterPrices.materialNumberCp, materialCp),
                eq(evhsMasterPrices.warehouseId, data.warehouseId)
            )
        })

        if (existing) {
            await db.update(evhsMasterPrices)
                .set({
                    materialNumberCk: materialCk,
                    price: dbPriceString,
                    updatedAt: new Date()
                })
                .where(eq(evhsMasterPrices.id, existing.id))
        } else {
            await db.insert(evhsMasterPrices).values({
                materialNumberCp: materialCp,
                materialNumberCk: materialCk,
                warehouseId: data.warehouseId,
                price: dbPriceString
            })
        }

        safeRevalidate("/dashboard/evhs")
        return { success: true }
    } catch (error) {
        return { success: false, error: getErrorMessage(error) }
    }
}

export async function deleteMasterPrice(id: number) {
    try {
        await db.delete(evhsMasterPrices).where(eq(evhsMasterPrices.id, id))
        safeRevalidate("/dashboard/evhs")
        return { success: true }
    } catch (error) {
        return { success: false, error: getErrorMessage(error) }
    }
}

export async function bulkDeleteMasterPrices(ids: number[]) {
    try {
        if (!ids || ids.length === 0) return { success: true }

        await db.execute(sql`
            DELETE FROM evhs_master_prices
            WHERE id IN (${sql.join(ids, sql`, `)})
        `)

        safeRevalidate("/dashboard/evhs")
        return { success: true }
    } catch (error) {
        console.error("Error bulk deleting master prices:", error)
        return { success: false, error: getErrorMessage(error) }
    }
}

export type BulkImportMasterPriceInput = {
    materialNumberCp: string
    materialNumberCk?: string | null
    warehouseId?: number
    sloc?: string | null
    warehouseName?: string | null
    price: string | number
}

export type BulkImportMasterPriceResult = {
    success: boolean
    total: number
    successCount: number
    failedCount: number
    errors: Array<{
        line: number
        error: string
        data: {
            sloc?: string
            warehouseName?: string
            materialNumberCp?: string
            materialNumberCk?: string
            price?: string | number
        }
    }>
}

export async function bulkImportMasterPrices(
    items: BulkImportMasterPriceInput[]
): Promise<BulkImportMasterPriceResult> {
    const errors: BulkImportMasterPriceResult["errors"] = []
    let successCount = 0

    if (!items || items.length === 0) {
        return {
            success: true,
            total: 0,
            successCount: 0,
            failedCount: 0,
            errors: []
        }
    }

    try {
        const warehouses = await db.query.warehouses.findMany()

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const line = i + 2 // +2 untuk memperhitungkan baris header (1-indexed)

            const errorData = {
                sloc: item.sloc || undefined,
                warehouseName: item.warehouseName || undefined,
                materialNumberCp: item.materialNumberCp,
                materialNumberCk: item.materialNumberCk || undefined,
                price: item.price
            }

            // 1. Warehouse resolution
            let resolvedWarehouseId = item.warehouseId
            if (!resolvedWarehouseId) {
                const found = matchWarehouse(warehouses, item.sloc, item.warehouseName)
                if (found) {
                    resolvedWarehouseId = found.id
                }
            }

            if (!resolvedWarehouseId) {
                const identifier = item.sloc || item.warehouseName || "KOSONG"
                errors.push({
                    line,
                    error: `Warehouse/Sloc '${identifier}' tidak ditemukan di sistem`,
                    data: errorData
                })
                continue
            }

            // 2. Material CP validation
            const materialCp = item.materialNumberCp?.trim()
            if (!materialCp) {
                errors.push({
                    line,
                    error: "Material CP wajib diisi",
                    data: errorData
                })
                continue
            }

            // 3. Price validation & formatting
            const parsedPrice = parseCleanPrice(item.price)
            if (parsedPrice === null || parsedPrice < 0) {
                errors.push({
                    line,
                    error: `Format harga '${String(item.price || "KOSONG")}' tidak valid`,
                    data: errorData
                })
                continue
            }

            const dbPriceString = formatPriceToDbString(parsedPrice)
            const materialCk = item.materialNumberCk?.trim() || null

            try {
                // Upsert
                const existing = await db.query.evhsMasterPrices.findFirst({
                    where: and(
                        eq(evhsMasterPrices.materialNumberCp, materialCp),
                        eq(evhsMasterPrices.warehouseId, resolvedWarehouseId)
                    )
                })

                if (existing) {
                    await db.update(evhsMasterPrices)
                        .set({
                            materialNumberCk: materialCk,
                            price: dbPriceString,
                            updatedAt: new Date()
                        })
                        .where(eq(evhsMasterPrices.id, existing.id))
                } else {
                    await db.insert(evhsMasterPrices).values({
                        materialNumberCp: materialCp,
                        materialNumberCk: materialCk,
                        warehouseId: resolvedWarehouseId,
                        price: dbPriceString
                    })
                }

                successCount++
            } catch (upsertError) {
                errors.push({
                    line,
                    error: getErrorMessage(upsertError),
                    data: errorData
                })
            }
        }

        safeRevalidate("/dashboard/evhs")
        return {
            success: errors.length === 0,
            total: items.length,
            successCount,
            failedCount: errors.length,
            errors
        }
    } catch (globalError) {
        console.error("Error bulk importing master prices:", globalError)
        return {
            success: false,
            total: items.length,
            successCount,
            failedCount: items.length - successCount,
            errors: [
                ...errors,
                {
                    line: 1,
                    error: getErrorMessage(globalError),
                    data: {}
                }
            ]
        }
    }
}

export async function importMasterPrices(prices: ImportedMasterPriceRow[]) {
    try {
        const result = await bulkImportMasterPrices(
            prices.map((p) => ({
                materialNumberCp: p.materialNumberCp,
                materialNumberCk: p.materialNumberCk,
                warehouseId: p.warehouseId,
                sloc: p.sloc,
                price: p.price
            }))
        )
        return { success: result.failedCount === 0, error: result.errors[0]?.error }
    } catch (error) {
        console.error("Error importing master prices:", error)
        return { success: false, error: getErrorMessage(error) }
    }
}

