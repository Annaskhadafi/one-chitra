"use server"

import { db } from "@/db"
import { products, stockLevels, me2lPurchDocsSap, warehouses, zvendorPoReportSap } from "@/db/schema"
import { eq, and, gte, lte, isNotNull, ne, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { recordStockMovement } from "./stock-movement"
import { getAuthenticatedSession } from "@/lib/rbac"
import { normalizeSloc } from "@/lib/sloc"



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

        const poNumbers = Array.from(
            new Set(
                filteredData
                    .map((item) => item.purchasingDoc?.trim())
                    .filter((value): value is string => !!value)
            )
        )

        const vendorPoRows = poNumbers.length > 0
            ? await db.query.zvendorPoReportSap.findMany({
                where: inArray(zvendorPoReportSap.poNo, poNumbers),
            })
            : []

        const vendorPoByItem = new Map<string, number>()
        const vendorPoByPo = new Map<string, number>()
        const vendorPoRowCountByPo = new Map<string, number>()

        for (const row of vendorPoRows) {
            const poNo = row.poNo?.trim()
            if (!poNo) continue

            vendorPoRowCountByPo.set(poNo, (vendorPoRowCountByPo.get(poNo) ?? 0) + 1)

            if (row.item !== null && row.item !== undefined) {
                vendorPoByItem.set(`${poNo}-${row.item}`, Number(row.grQuantity ?? 0))
            }

            if (!vendorPoByPo.has(poNo)) {
                vendorPoByPo.set(poNo, Number(row.grQuantity ?? 0))
            }
        }

        const mappedData: SAPGoodReceiveItem[] = filteredData.map(item => {
            const poNo = item.purchasingDoc?.trim() || ""
            const itemKey = `${poNo}-${item.item ?? 0}`
            const vendorItemGrQty = vendorPoByItem.get(itemKey)
            const vendorPoGrQty = vendorPoRowCountByPo.get(poNo) === 1 ? vendorPoByPo.get(poNo) : undefined
            const resolvedGrQty = vendorItemGrQty ?? vendorPoGrQty ?? item.deliveredQty ?? 0

            return {
                ponumb: item.purchasingDoc || "",
                item: item.item || 0,
                vendor: item.vendorName || "",
                prnumb: item.trackingNo || null,
                podate: item.docDate || "",
                materialnumb: item.material || null,
                material: item.shortText || "",
                poqty: item.orderQty || 0,
                togr: (item.orderQty || 0) - resolvedGrQty,
                toinvo: item.invoicedQty || 0,
                grqty: resolvedGrQty,
                isProcessed: !!item.grProcessedDate,
                processedDate: item.grProcessedDate,
                warehouseId: item.grWarehouseId
            }
        })

        return { success: true, data: mappedData }
    } catch (error) {
        console.error("Error fetching Good Receive data:", error)
        return { success: false, error: "Failed to fetch data" }
    }
}

const _goodReceiveItemSchema = z.object({
    materialNumber: z.string(),
    quantity: z.number().min(0.001),
    ponumb: z.string(),
    itemIndex: z.number() // Added to track specific SAP item line
})

export async function processGoodReceive(
    items: z.infer<typeof _goodReceiveItemSchema>[],
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
                const warehouseRow = await tx.query.warehouses.findFirst({
                    where: eq(warehouses.id, warehouseId),
                    columns: {
                        sloc: true,
                    },
                })

                const product = warehouseRow
                    ? await tx.query.products.findFirst({
                        where: and(
                            eq(products.materialNumber, materialNumber),
                            eq(products.sloc, normalizeSloc(warehouseRow.sloc))
                        ),
                    })
                    : null

                if (!product) {
                    errors.push(`Product ${materialNumber} not found in inventory.`)
                    continue
                }

                // 3. Update or Create Stock Level
                await tx.insert(stockLevels).values({
                    warehouseId,
                    productId: product.id,
                    totalStock: item.quantity,
                    bookedStock: 0,
                    minStock: 0,
                    valuationValue: '0',
                })
                    .onConflictDoUpdate({
                        target: [stockLevels.productId, stockLevels.warehouseId],
                        set: {
                            totalStock: sql`${stockLevels.totalStock} + ${item.quantity}`,
                            updatedAt: new Date(),
                        },
                    })

                // 4. Record Movement
                await recordStockMovement(tx, {
                    productId: product.id,
                    warehouseId: warehouseId,
                    quantity: item.quantity,
                    type: "GR_SAP",
                    recordedBy: userId,
                    referenceNumber: `PO: ${ponumb} Item: ${itemIndex}`
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
