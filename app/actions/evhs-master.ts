"use server"

import { db } from "@/db"
import { evhsMasterPrices } from "@/db/schema/evhs"
import { products } from "@/db/schema/products"
import { eq, and, sql, inArray, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"

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
    materialNumberCk?: string
    warehouseId: number
    price: string
}) {
    try {
        // Cek jika sudah ada data untuk material & warehouse ini
        const existing = await db.query.evhsMasterPrices.findFirst({
            where: and(
                eq(evhsMasterPrices.materialNumberCp, data.materialNumberCp),
                eq(evhsMasterPrices.warehouseId, data.warehouseId)
            )
        })

        if (existing) {
            await db.update(evhsMasterPrices)
                .set({
                    materialNumberCk: data.materialNumberCk,
                    price: data.price,
                    updatedAt: new Date()
                })
                .where(eq(evhsMasterPrices.id, existing.id))
        } else {
            await db.insert(evhsMasterPrices).values({
                materialNumberCp: data.materialNumberCp,
                materialNumberCk: data.materialNumberCk,
                warehouseId: data.warehouseId,
                price: data.price
            })
        }

        revalidatePath("/dashboard/evhs")
        return { success: true }
    } catch (error) {
        return { success: false, error: getErrorMessage(error) }
    }
}

export async function deleteMasterPrice(id: number) {
    try {
        await db.delete(evhsMasterPrices).where(eq(evhsMasterPrices.id, id))
        revalidatePath("/dashboard/evhs")
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

        revalidatePath("/dashboard/evhs")
        return { success: true }
    } catch (error) {
        console.error("Error bulk deleting master prices:", error)
        return { success: false, error: getErrorMessage(error) }
    }
}

export async function importMasterPrices(prices: ImportedMasterPriceRow[]) {
    try {
        const warehouses = await db.query.warehouses.findMany()

        for (const priceData of prices) {
            let warehouseId = priceData.warehouseId

            // Jika ada sloc tapi tidak ada warehouseId, cari berdasarkan sloc
            if (!warehouseId && priceData.sloc) {
                const found = warehouses.find(h => h.sloc.toLowerCase() === priceData.sloc.toLowerCase())
                if (found) {
                    warehouseId = found.id
                }
            }

            if (warehouseId) {
                await createOrUpdateMasterPrice({
                    materialNumberCp: priceData.materialNumberCp,
                    materialNumberCk: priceData.materialNumberCk,
                    warehouseId: warehouseId,
                    price: priceData.price.toString()
                })
            }
        }
        revalidatePath("/dashboard/evhs")
        return { success: true }
    } catch (error) {
        console.error("Error importing master prices:", error)
        return { success: false, error: getErrorMessage(error) }
    }
}
