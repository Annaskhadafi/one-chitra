"use server"

import { db } from "@/db"
import { stockLevels, stockMovements } from "@/db/schema"
import { eq, and, gt, desc } from "drizzle-orm"
import { getAuthenticatedSession } from "@/lib/rbac"

export interface DeadStockItem {
    productId: number;
    productName: string;
    sku: string;
    warehouseName: string;
    quantity: number;
    value: number;
    lastMovementDate: Date | null;
    daysInactive: number;
}

export async function getDeadStockReport(thresholdDays: number = 90) {
    try {
        await getAuthenticatedSession("inventory", "view");

        // 1. Get all stocks > 0
        const stocks = await db.query.stockLevels.findMany({
            where: gt(stockLevels.totalStock, 0),
            with: {
                product: true,
                warehouse: true,
            }
        });

        const deadStocks: DeadStockItem[] = [];
        const now = new Date();

        for (const stock of stocks) {
            // 2. Find last OUT movement for this specific stock (product + warehouse)
            const lastMovement = await db.query.stockMovements.findFirst({
                where: and(
                    eq(stockMovements.productId, stock.productId),
                    eq(stockMovements.warehouseId, stock.warehouseId),
                    // We care about when it last moved "OUT" or was "ADJUSTED" (activity)
                    // Or maybe any movement? Usually dead stock means "no sales" or "no consumption".
                    // Let's look for any movement. If it hasn't moved at all, it's stagnant.
                ),
                orderBy: [desc(stockMovements.createdAt)],
            });

            const lastDate = lastMovement?.createdAt || stock.updatedAt || stock.createdAt;

            // Calculate days difference
            const diffTime = Math.abs(now.getTime() - lastDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > thresholdDays) {
                const cost = stock.product.costSap ? parseFloat(stock.product.costSap.toString()) : 0;

                deadStocks.push({
                    productId: stock.productId,
                    productName: stock.product.materialDescription || "Unknown",
                    sku: stock.product.materialNumber || "-",
                    warehouseName: stock.warehouse.sloc + " - " + stock.warehouse.description,
                    quantity: stock.totalStock,
                    value: stock.totalStock * cost,
                    lastMovementDate: lastDate,
                    daysInactive: diffDays
                });
            }
        }

        // Sort by value descending (highest capital stuck first)
        deadStocks.sort((a, b) => b.value - a.value);

        return { success: true, data: deadStocks };

    } catch (error) {
        console.error("Failed to get dead stock report:", error);
        return { success: false, error: "Failed to generate dead stock report" };
    }
}
