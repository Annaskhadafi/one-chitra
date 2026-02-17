"use server"

import { db } from "@/db"
import { products, stockLevels } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const goodReceiveItemSchema = z.object({
    materialNumber: z.string(),
    quantity: z.number().min(1),
})

export type SAPGoodReceiveItem = {
    ponumb: string
    vendor: string
    prnumb: string | null
    podate: string
    materialnumb: string | null
    material: string
    poqty: number
    togr: number
    toinvo: number
    grqty: number
}

export async function fetchGoodReceiveFromSAP(startDate: string, endDate: string) {
    try {
        const response = await fetch(
            `https://ics.chitraparatama.co.id/product/api/apiconnect.php?function=get_goodreceive&start_date=${startDate}&end_date=${endDate}`,
            { cache: "no-store" }
        )

        if (!response.ok) {
            throw new Error("Failed to fetch data from SAP")
        }

        const data = await response.json()

        if (data.status !== "OK") {
            // Handle case where status is not OK but technically http request succeeded (api level error)
            // or just return empty if result is not present
            if (data.result) return { success: true, data: data.result as SAPGoodReceiveItem[] }
            return { success: false, error: "API returned status not OK or no result" }
        }

        return { success: true, data: data.result as SAPGoodReceiveItem[] }
    } catch (error) {
        console.error("Error fetching Good Receive data:", error)
        return { success: false, error: "Failed to fetch data" }
    }
}

export async function processGoodReceive(
    items: z.infer<typeof goodReceiveItemSchema>[],
    warehouseId: number
) {
    try {
        let processedCount = 0
        let errors: string[] = []

        for (const item of items) {
            // Find product by material number
            const product = await db.query.products.findFirst({
                where: eq(products.materialNumber, item.materialNumber),
            })

            if (!product) {
                errors.push(`Product not found for material number: ${item.materialNumber}`)
                continue
            }

            // Check if stock level exists
            const existingStock = await db.query.stockLevels.findFirst({
                where: and(
                    eq(stockLevels.productId, product.id),
                    eq(stockLevels.warehouseId, warehouseId)
                ),
            })

            if (existingStock) {
                // Update total stock
                await db.update(stockLevels)
                    .set({
                        totalStock: existingStock.totalStock + item.quantity,
                        updatedAt: new Date(),
                    })
                    .where(eq(stockLevels.id, existingStock.id))
            } else {
                // Create new stock level
                await db.insert(stockLevels).values({
                    warehouseId,
                    productId: product.id,
                    totalStock: item.quantity,
                    bookedStock: 0,
                    minStock: 0,
                    valuationValue: '0', // Default valuation
                })
            }
            processedCount++
        }

        revalidatePath("/dashboard/stocks")
        revalidatePath("/dashboard/good-receive")

        return {
            success: true,
            processed: processedCount,
            errors: errors.length > 0 ? errors : undefined
        }

    } catch (error) {
        console.error("Error processing Good Receive:", error)
        return { success: false, error: "Failed to process Good Receive" }
    }
}
