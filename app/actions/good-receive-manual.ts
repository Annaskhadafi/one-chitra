"use server"

import { db } from "@/db"
import { goodReceiveManual, goodReceiveManualItems, stockLevels } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { eq, and } from "drizzle-orm"
import { recordStockMovement } from "./stock-movement"
import { getAuthenticatedSession } from "@/lib/rbac"

export type CreateGoodReceiveManualInput = {
    supplier: string
    poNumber: string
    receiveDate: Date
    deliveryType: "Partial" | "Complete"
    referenceDocument?: string
    items: {
        productId: number
        warehouseId: number
        quantity: number
        notes?: string
    }[]
}

export async function createGoodReceiveManual(input: CreateGoodReceiveManualInput) {
    try {
        const session = await getAuthenticatedSession('good-receive-manual', 'create')
        const userId = session.user.id

        await db.transaction(async (tx) => {
            // 1. Create Header
            const [header] = await tx.insert(goodReceiveManual).values({
                supplier: input.supplier,
                poNumber: input.poNumber,
                receiveDate: input.receiveDate.toISOString(),
                deliveryType: input.deliveryType,
                referenceDocument: input.referenceDocument,
            }).returning()

            // 2. Create Items and Update Stock
            for (const item of input.items) {
                await tx.insert(goodReceiveManualItems).values({
                    headerId: header.id,
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    quantity: item.quantity,
                    notes: item.notes,
                })

                // 3. Update or Insert Stock Level
                const existingStock = await tx.select()
                    .from(stockLevels)
                    .where(
                        and(
                            eq(stockLevels.productId, item.productId),
                            eq(stockLevels.warehouseId, item.warehouseId)
                        )
                    )
                    .limit(1)

                if (existingStock.length > 0) {
                    await tx.update(stockLevels)
                        .set({
                            totalStock: existingStock[0].totalStock + item.quantity,
                            updatedAt: new Date()
                        })
                        .where(eq(stockLevels.id, existingStock[0].id))
                } else {
                    await tx.insert(stockLevels).values({
                        productId: item.productId,
                        warehouseId: item.warehouseId,
                        totalStock: item.quantity, // Initial stock
                        bookedStock: 0,
                        minStock: 0,
                        valuationValue: "0",
                    })
                }

                // 4. Record Movement
                await recordStockMovement(tx, {
                    productId: item.productId,
                    warehouseId: item.warehouseId,
                    quantity: item.quantity,
                    type: "GR_MANUAL",
                    referenceNumber: header.poNumber,
                    recordedBy: userId,
                })
            }
        })

        revalidatePath("/dashboard/good-receive-manual")
        revalidatePath("/dashboard/stocks")

        return { success: true }
    } catch (error) {
        console.error("Error creating manual good receive:", error)
        return { success: false, error: "Failed to create good receive record" }
    }
}
