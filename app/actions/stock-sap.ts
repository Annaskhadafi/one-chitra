"use server"

import { db } from "@/db"
import { products, warehouses, stockLevels } from "@/db/schema"
import { and, eq, sql } from "drizzle-orm"
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

export async function getStocksFromSapForSlowMoving() {
    const result = await db.execute(sql`
        SELECT 
            material_no,
            old_material_no,
            MAX(material_desc) as material_desc,
            SUM(total_stock) as total_stock,
            SUM(value_stock) as total_value,
            MAX(extracted_at) as extracted_at
        FROM public.zmc9_stock_sap
        GROUP BY material_no, old_material_no
    `)

    let fakeId = 1
    return result.rows.map((row: any) => {
        const totalQty = Number(row.total_stock) || 0
        const totalValue = Number(row.total_value) || 0
        const costSap = totalQty > 0 ? (totalValue / totalQty).toString() : "0"

        return {
            id: fakeId++,
            productId: 0,
            warehouseId: 0,
            totalStock: totalQty,
            minStock: 0,
            valuationValue: totalValue.toString(),
            createdAt: row.extracted_at ? new Date(row.extracted_at) : new Date(),
            updatedAt: row.extracted_at ? new Date(row.extracted_at) : new Date(),
            product: {
                id: 0,
                materialNumber: String(row.material_no || ""),
                oldMaterialNo: String(row.old_material_no || ""),
                materialDescription: String(row.material_desc || ""),
                costSap: costSap,
            },
            warehouse: null,
            stockBookings: [],
        }
    })
}
