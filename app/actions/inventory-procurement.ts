"use server"

import { and, eq, sql } from "drizzle-orm"
import { sendSystemTemplatedEmailByCode } from "@/lib/email"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"
import { getAuthenticatedSession } from "@/lib/rbac"
import { db } from "@/db"
import { stockLevels } from "@/db/schema/stock-levels"
import { products } from "@/db/schema/products"
import { warehouses } from "@/db/schema/warehouses"
import { stockMovements } from "@/db/schema/stock-movements"

export async function sendInventoryProcurementRequest(input: { stockLevelId: number }) {
    try {
        const session = await getAuthenticatedSession("reports", "view")

        const stockLevelId = Number(input.stockLevelId)
        if (!Number.isFinite(stockLevelId) || stockLevelId <= 0) {
            return { success: false, error: "Item inventory tidak valid." }
        }

        const [stockRow] = await db
            .select({
                id: stockLevels.id,
                productId: stockLevels.productId,
                warehouseId: stockLevels.warehouseId,
                productCode: products.materialNumber,
                productName: products.materialDescription,
                warehouseLabel: warehouses.sloc,
                currentStock: stockLevels.totalStock,
                minStock: stockLevels.minStock,
                valuationValue: stockLevels.valuationValue,
            })
            .from(stockLevels)
            .innerJoin(products, eq(products.id, stockLevels.productId))
            .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
            .where(eq(stockLevels.id, stockLevelId))
            .limit(1)

        if (!stockRow) {
            return { success: false, error: "Item inventory tidak ditemukan." }
        }

        const [usageRow] = await db
            .select({
                avgDailyUsage: sql<number>`COALESCE(ABS(SUM(CASE WHEN ${stockMovements.quantity} < 0 THEN ${stockMovements.quantity} ELSE 0 END))::numeric / 30, 0)`,
            })
            .from(stockMovements)
            .where(and(
                eq(stockMovements.productId, stockRow.productId),
                eq(stockMovements.warehouseId, stockRow.warehouseId),
                sql`${stockMovements.createdAt} >= NOW() - INTERVAL '30 days'`,
            ))

        const currentStock = Number(stockRow.currentStock ?? 0)
        const minStock = Number(stockRow.minStock ?? 0)
        const valuationValue = Number(stockRow.valuationValue ?? 0)
        const avgDailyUsage = Number(usageRow?.avgDailyUsage ?? 0)
        const recommendedRestockQty = Math.max(minStock - currentStock, 0)
        const unitCost = currentStock > 0 ? valuationValue / currentStock : 0
        const recommendedRestockValue = recommendedRestockQty * unitCost
        const daysToStockout = avgDailyUsage > 0 && currentStock > 0 ? Number((currentStock / avgDailyUsage).toFixed(1)) : null

        const urgencyLevel =
            currentStock === 0
                ? "Critical"
                : daysToStockout !== null && daysToStockout <= 7
                    ? "Critical"
                    : currentStock <= minStock
                        ? "Warning"
                        : "Monitor"

        const result = await sendSystemTemplatedEmailByCode({
            code: SYSTEM_EMAIL_TEMPLATE_CODES.inventoryProcurementRequest,
            data: {
                requestorName: session.user.name || session.user.email || "System User",
                productCode: stockRow.productCode || "-",
                productName: stockRow.productName || "Unknown Product",
                warehouseLabel: stockRow.warehouseLabel || "-",
                currentStock: currentStock.toLocaleString("id-ID"),
                minStock: minStock.toLocaleString("id-ID"),
                avgDailyUsage: avgDailyUsage > 0 ? avgDailyUsage.toFixed(1) : "No signal",
                daysToStockout: formatDaysToStockout(daysToStockout),
                recommendedRestockQty: recommendedRestockQty.toLocaleString("id-ID"),
                recommendedRestockValue: formatCurrency(recommendedRestockValue),
                urgencyLevel,
                actionUrl: "/dashboard/reports/inventory",
                appName: "One Chitra",
            },
        })

        if (!result.success) {
            return {
                success: false,
                error: result.error || "Email procurement gagal dikirim. Pastikan template aktif dan penerima sudah diatur.",
            }
        }

        return {
            success: true,
            message: "Email procurement berhasil dikirim.",
        }
    } catch (error) {
        console.error("Failed to send inventory procurement request:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Gagal mengirim email procurement.",
        }
    }
}

function formatDaysToStockout(value: number | null) {
    if (value === null) return "No signal"
    if (value < 1) return "< 1 day"
    if (value < 30) return `${value.toFixed(1)} days`
    return `${Math.round(value)} days`
}

function formatCurrency(val: number): string {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)} Miliar`
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)} Juta`
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`
    return `Rp ${val.toLocaleString("id-ID")}`
}
