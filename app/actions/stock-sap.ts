"use server"

import { db } from "@/db"
import { products, warehouses, stockLevels } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { normalizeSloc } from "@/lib/sloc"

export async function syncIndividualStock(data: { materialNumber: string, sloc: string, qty: number, value: number }) {
    try {
        const normalizedSloc = normalizeSloc(data.sloc)
        const warehouseRows = await db.select({ id: warehouses.id, sloc: warehouses.sloc }).from(warehouses)
        const warehouse = warehouseRows.find((row) => normalizeSloc(row.sloc) === normalizedSloc)

        const product = warehouse
            ? await db.query.products.findFirst({
                where: and(
                    eq(products.materialNumber, data.materialNumber),
                    eq(products.sloc, normalizedSloc)
                )
            })
            : null

        if (!product || !warehouse) {
            return {
                success: false,
                error: `Mapping not found: ${!product ? 'Product' : ''} ${!warehouse ? 'Warehouse' : ''}`
            }
        }

        await db.insert(stockLevels)
            .values({
                productId: product.id,
                warehouseId: warehouse.id,
                totalStock: data.qty,
                valuationValue: data.value.toString(),
            })
            .onConflictDoUpdate({
                target: [stockLevels.productId, stockLevels.warehouseId],
                set: {
                    totalStock: data.qty,
                    valuationValue: data.value.toString(),
                    updatedAt: new Date()
                }
            })

        revalidatePath("/dashboard/stocks")
        revalidatePath("/dashboard/stocks-sap")

        return { success: true }
    } catch (_error) {
        return { success: false, error: "SAP Sync failed" }
    }
}
