"use server"

import { db } from "@/db"
import { stockMovements } from "@/db/schema"
import { desc, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAuthenticatedSession } from "@/lib/rbac"
import { getAllowedWarehouseIdsForCurrentUser } from "@/lib/warehouse-access"
import { normalizeSlocFields } from "@/lib/sloc"

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

let ensureSourceColumnPromise: Promise<void> | null = null

const isMissingSourceColumnError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    return message.toLowerCase().includes("source") && message.toLowerCase().includes("stock_movements")
}

export const ensureStockMovementSourceColumn = async () => {
    if (!ensureSourceColumnPromise) {
        ensureSourceColumnPromise = (async () => {
            await db.execute(sql`
                ALTER TABLE IF EXISTS "stock_movements"
                ADD COLUMN IF NOT EXISTS "source" varchar(50) DEFAULT 'OTHER' NOT NULL;
            `)

            await db.execute(sql`
                UPDATE "stock_movements"
                SET "source" = CASE
                    WHEN "type" = 'GR_SAP' THEN 'INBOUND_SAP'
                    WHEN "type" = 'GR_MANUAL' THEN 'INBOUND_MANUAL'
                    WHEN "type" = 'DELIVERY' THEN 'DELIVERY'
                    WHEN "type" IN ('TRANSFER_IN', 'TRANSFER_OUT') THEN 'TRANSFER'
                    WHEN "type" = 'ADJUSTMENT' THEN 'ADJUSTMENT'
                    ELSE 'OTHER'
                END
                WHERE "source" IS NULL OR "source" = '' OR "source" = 'OTHER';
            `)
        })().finally(() => {
            ensureSourceColumnPromise = null
        })
    }

    await ensureSourceColumnPromise
}

const insertStockMovement = async (
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
) => {
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
        try {
            await insertStockMovement(tx, data)
        } catch (error) {
            if (!isMissingSourceColumnError(error)) {
                throw error
            }

            await tx.execute(sql`
                ALTER TABLE IF EXISTS "stock_movements"
                ADD COLUMN IF NOT EXISTS "source" varchar(50) DEFAULT 'OTHER' NOT NULL;
            `)

            await tx.execute(sql`
                UPDATE "stock_movements"
                SET "source" = CASE
                    WHEN "type" = 'GR_SAP' THEN 'INBOUND_SAP'
                    WHEN "type" = 'GR_MANUAL' THEN 'INBOUND_MANUAL'
                    WHEN "type" = 'DELIVERY' THEN 'DELIVERY'
                    WHEN "type" IN ('TRANSFER_IN', 'TRANSFER_OUT') THEN 'TRANSFER'
                    WHEN "type" = 'ADJUSTMENT' THEN 'ADJUSTMENT'
                    ELSE 'OTHER'
                END
                WHERE "source" IS NULL OR "source" = '' OR "source" = 'OTHER';
            `)

            await insertStockMovement(tx, data)
        }
        return { success: true }
    } catch (error) {
        console.error("Error recording stock movement:", error)
        return { success: false, error: "Failed to record stock movement" }
    }
}

export async function getStockMovements() {
    await getAuthenticatedSession("stock-movements", "view")
    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")

    if (allowedWarehouseIds && allowedWarehouseIds.length === 0) {
        return []
    }

    try {
        const rows = await db.query.stockMovements.findMany({
            where: allowedWarehouseIds ? inArray(stockMovements.warehouseId, allowedWarehouseIds) : undefined,
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
        return normalizeSlocFields(rows)
    } catch (error) {
        if (!isMissingSourceColumnError(error)) {
            throw error
        }

        await ensureStockMovementSourceColumn()

        const rows = await db.query.stockMovements.findMany({
            where: allowedWarehouseIds ? inArray(stockMovements.warehouseId, allowedWarehouseIds) : undefined,
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
        return normalizeSlocFields(rows)
    }
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

