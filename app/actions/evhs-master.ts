"use server"

import { db } from "@/db"
import { evhsMasterPrices } from "@/db/schema/evhs"
import { eq, and, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getEvhsMasterPrices() {
    try {
        const data = await db.query.evhsMasterPrices.findMany({
            with: {
                warehouse: true
            },
            orderBy: (prices: any, { desc }: any) => [desc(prices.createdAt)]
        })
        return data
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
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function deleteMasterPrice(id: number) {
    try {
        await db.delete(evhsMasterPrices).where(eq(evhsMasterPrices.id, id))
        revalidatePath("/dashboard/evhs")
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
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
    } catch (error: any) {
        console.error("Error bulk deleting master prices:", error)
        return { success: false, error: error.message }
    }
}

export async function importMasterPrices(prices: any[]) {
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
    } catch (error: any) {
        console.error("Error importing master prices:", error)
        return { success: false, error: error.message }
    }
}
