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

export type StockMovementSource =
    | "INBOUND_SAP"
    | "INBOUND_MANUAL"
    | "DELIVERY"
    | "TRANSFER"
    | "ADJUSTMENT"
    | "OTHER"

const inferMovementSource = (type: StockMovementType): StockMovementSource => {
    switch (type) {
        case "GR_SAP":
            return "INBOUND_SAP"
        case "GR_MANUAL":
            return "INBOUND_MANUAL"
        case "DELIVERY":
            return "DELIVERY"
        case "TRANSFER_IN":
        case "TRANSFER_OUT":
            return "TRANSFER"
        case "ADJUSTMENT":
            return "ADJUSTMENT"
        default:
            return "OTHER"
    }
}

export async function recordStockMovement(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    data: {
        productId: number
        warehouseId: number
        quantity: number
        type: StockMovementType
        source?: StockMovementSource
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
            source: data.source ?? inferMovementSource(data.type),
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

export async function clearStockMovements() {
    try {
        const session = await getAuthenticatedSession()
        const dbUser = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, session.user.id),
        })

        if (!dbUser || (dbUser.role.toLowerCase() !== "admin" && dbUser.role.toLowerCase() !== "superuser")) {
            throw new Error("Only Admin can clear logs")
        }

        await db.delete(stockMovements)

        revalidatePath("/dashboard/stock-movements")
        revalidatePath("/dashboard/inventory")

        return { success: true }
    } catch (error) {
        console.error("Error clearing stock movements:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to clear movements" }
    }
}

