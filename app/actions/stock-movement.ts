"use server"

import { db } from "@/db"
import { stockMovements } from "@/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAuthenticatedSession } from "@/lib/rbac"

export type StockMovementType =
    | "GR_SAP"
    | "GR_MANUAL"
    | "DELIVERY"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "ADJUSTMENT"

export async function recordStockMovement(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    data: {
        productId: number
        warehouseId: number
        quantity: number
        type: StockMovementType
        referenceNumber?: string
        recordedBy?: string
        customerId?: number
        fromWarehouseId?: number
        toWarehouseId?: number
        notes?: string
    }
) {
    try {
        await tx.insert(stockMovements).values({
            productId: data.productId,
            warehouseId: data.warehouseId,
            quantity: data.quantity,
            type: data.type,
            referenceNumber: data.referenceNumber,
            recordedBy: data.recordedBy,
            customerId: data.customerId,
            fromWarehouseId: data.fromWarehouseId,
            toWarehouseId: data.toWarehouseId,
            notes: data.notes,
        })
        return { success: true }
    } catch (error) {
        console.error("Error recording stock movement:", error)
        return { success: false, error: "Failed to record stock movement" }
    }
}

export async function getStockMovements() {
    return await db.query.stockMovements.findMany({
        with: {
            product: true,
            warehouse: true,
            recordedByUser: true,
            customer: true,
            fromWarehouse: true,
            toWarehouse: true,
        },
        orderBy: [desc(stockMovements.createdAt)],
    })
}
