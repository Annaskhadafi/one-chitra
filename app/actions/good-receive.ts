"use server"

import { db } from "@/db"
import { products, stockLevels, me2lPurchDocsSap } from "@/db/schema"
import { eq, and, gte, lte, isNotNull, ne, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { recordStockMovement } from "./stock-movement"
import { getAuthenticatedSession } from "@/lib/rbac"



export type SAPGoodReceiveItem = {
    ponumb: string
    item: number | null
    vendor: string
    prnumb: string | null
    podate: string
    materialnumb: string | null
    material: string
    poqty: number
    togr: number
    toinvo: number
    grqty: number
    isProcessed: boolean
    processedDate: Date | null
    warehouseId: number | null
}

export async function fetchGoodReceiveFromSAP(startDate: string, endDate: string, type: 'pending' | 'history' = 'pending') {
    try {
        const data = await db.query.me2lPurchDocsSap.findMany({
            where: and(
                gte(me2lPurchDocsSap.docDate, startDate),
                lte(me2lPurchDocsSap.docDate, endDate),
                isNotNull(me2lPurchDocsSap.material),
                ne(me2lPurchDocsSap.material, ""),
                ne(me2lPurchDocsSap.material, "-")
            ),
            orderBy: (t, { desc }) => [desc(t.docDate), desc(t.purchDocId)]
        })

        // Group by Unique PO + Item to handle "append" data
        // Key: purchasingDoc + item
        const uniqueItemsMap = new Map<string, typeof data[0]>()

        for (const record of data) {
            const key = `${record.purchasingDoc}-${record.item}`
            // Since we sorted by docDate desc and purchDocId desc, the first one we encounter for each key is the "latest"
            if (!uniqueItemsMap.has(key)) {
                uniqueItemsMap.set(key, record)
            }
        }

        const filteredData = Array.from(uniqueItemsMap.values()).filter(item => {
            if (type === 'pending') return !item.grProcessedDate
            if (type === 'history') return !!item.grProcessedDate
            return true
        })

        const mappedData: SAPGoodReceiveItem[] = filteredData.map(item => ({
            ponumb: item.purchasingDoc || "",
            item: item.item || 0,
            vendor: item.vendorName || "",
            prnumb: item.trackingNo || null,
            podate: item.docDate || "",
            materialnumb: item.material || null,
            material: item.shortText || "",
            poqty: item.orderQty || 0,
            togr: (item.orderQty || 0) - (item.deliveredQty || 0),
            toinvo: item.invoicedQty || 0,
            grqty: item.deliveredQty || 0,
            isProcessed: !!item.grProcessedDate,
            processedDate: item.grProcessedDate,
            warehouseId: item.grWarehouseId
        }))

        return { success: true, data: mappedData }
    } catch (error) {
        console.error("Error fetching Good Receive data:", error)
        return { success: false, error: "Failed to fetch data" }
    }
}

const goodReceiveItemSchema = z.object({
    materialNumber: z.string(),
    quantity: z.number().min(0.001),
    ponumb: z.string(),
    itemIndex: z.number() // Added to track specific SAP item line
})

export async function processGoodReceive(
    items: z.infer<typeof goodReceiveItemSchema>[],
    warehouseId: number
) {
    try {
        const session = await getAuthenticatedSession('good-receive', 'create')
        const userId = session.user.id
        let processedCount = 0
        const errors: string[] = []

        await db.transaction(async (tx) => {
            for (const item of items) {
                const materialNumber = item.materialNumber.trim();
                const ponumb = item.ponumb.trim();
                const itemIndex = item.itemIndex;

                // 1. Check if this PO+Item combination is already processed (in ANY row, to handle append duplicates)
                const existingProcessed = await tx.query.me2lPurchDocsSap.findFirst({
                    where: and(
                        eq(me2lPurchDocsSap.purchasingDoc, ponumb),
                        eq(me2lPurchDocsSap.item, itemIndex),
                        isNotNull(me2lPurchDocsSap.grProcessedDate)
                    )
                })

                if (existingProcessed) {
                    errors.push(`Item PO: ${ponumb}, Item: ${itemIndex} was already processed.`)
                    continue;
                }

                // 2. Find internal product
                const product = await tx.query.products.findFirst({
                    where: eq(products.materialNumber, materialNumber),
                })

                if (!product) {
                    errors.push(`Product ${materialNumber} not found in inventory.`)
                    continue
                }

                // 3. Update or Create Stock Level
                const existingStock = await tx.query.stockLevels.findFirst({
                    where: and(
                        eq(stockLevels.productId, product.id),
                        eq(stockLevels.warehouseId, warehouseId)
                    ),
                })

                if (existingStock) {
                    await tx.update(stockLevels)
                        .set({
                            totalStock: existingStock.totalStock + item.quantity,
                            updatedAt: new Date(),
                        })
                        .where(eq(stockLevels.id, existingStock.id))
                } else {
                    await tx.insert(stockLevels).values({
                        warehouseId,
                        productId: product.id,
                        totalStock: item.quantity,
                        bookedStock: 0,
                        minStock: 0,
                        valuationValue: '0',
                    })
                }

                // 4. Record Movement
                await recordStockMovement(tx, {
                    productId: product.id,
                    warehouseId: warehouseId,
                    quantity: item.quantity,
                    type: "GR_SAP",
                    recordedBy: userId,
                    reference: `PO: ${ponumb} Item: ${itemIndex}`
                })

                // 5. Update ALL matching PO+Item records as processed
                // This ensures "append" duplicates are all marked
                await tx.update(me2lPurchDocsSap)
                    .set({
                        grProcessedDate: new Date(),
                        grWarehouseId: warehouseId
                    })
                    .where(and(
                        eq(me2lPurchDocsSap.purchasingDoc, ponumb),
                        eq(me2lPurchDocsSap.item, itemIndex)
                    ))

                processedCount++
            }
        })

        revalidatePath("/dashboard/stocks")
        revalidatePath("/dashboard/good-receive")
        revalidatePath("/dashboard/stock-movements")

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
