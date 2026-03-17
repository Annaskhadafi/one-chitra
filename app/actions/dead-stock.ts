"use server"

import { db } from "@/db"
import { stockLevels, stockMovements } from "@/db/schema"
import { eq, and, gt, desc } from "drizzle-orm"
import { getAuthenticatedSession } from "@/lib/rbac"
import { formatWarehouseLabel } from "@/lib/sloc"

export interface DeadStockItem {
    productId: number;
    productName: string;
    sku: string;
    warehouseName: string;
    category: string;
    brand: string;
    quantity: number;
    value: number;
    lastMovementDate: Date | null;
    daysInactive: number;
}

export interface DeadStockSummary {
    totalValue: number;
    totalItems: number;
    avgDaysInactive: number;
    highestValueItem: string;
    highestValueAmount: number;
}

export interface DeadStockBreakdown {
    name: string;
    value: number;
    count: number;
}

export interface AgingBand {
    band: string;
    value: number;
    count: number;
    order: number;
}

export interface DeadStockReport {
    items: DeadStockItem[];
    summary: DeadStockSummary;
    categoryBreakdown: DeadStockBreakdown[];
    warehouseBreakdown: DeadStockBreakdown[];
    agingBands: AgingBand[];
}

function getAgingBandLabel(days: number): { band: string; order: number } {
    if (days <= 60) return { band: "30-60 days", order: 1 };
    if (days <= 90) return { band: "60-90 days", order: 2 };
    if (days <= 180) return { band: "90-180 days", order: 3 };
    if (days <= 365) return { band: "180-365 days", order: 4 };
    return { band: "365+ days", order: 5 };
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
            // 2. Find last movement for this specific stock (product + warehouse)
            const lastMovement = await db.query.stockMovements.findFirst({
                where: and(
                    eq(stockMovements.productId, stock.productId),
                    eq(stockMovements.warehouseId, stock.warehouseId),
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
                    warehouseName: formatWarehouseLabel(stock.warehouse),
                    category: stock.product.category || "Uncategorized",
                    brand: stock.product.brand || "-",
                    quantity: stock.totalStock,
                    value: stock.totalStock * cost,
                    lastMovementDate: lastDate,
                    daysInactive: diffDays
                });
            }
        }

        // Sort by value descending (highest capital stuck first)
        deadStocks.sort((a, b) => b.value - a.value);

        // Compute summary
        const totalValue = deadStocks.reduce((s, i) => s + i.value, 0);
        const totalItems = deadStocks.length;
        const avgDaysInactive = totalItems > 0
            ? Math.round(deadStocks.reduce((s, i) => s + i.daysInactive, 0) / totalItems)
            : 0;
        const highest = deadStocks[0]; // already sorted by value desc

        const summary: DeadStockSummary = {
            totalValue,
            totalItems,
            avgDaysInactive,
            highestValueItem: highest?.productName ?? "-",
            highestValueAmount: highest?.value ?? 0,
        };

        // Compute category breakdown
        const catMap = new Map<string, { value: number; count: number }>();
        for (const item of deadStocks) {
            const existing = catMap.get(item.category) || { value: 0, count: 0 };
            existing.value += item.value;
            existing.count += 1;
            catMap.set(item.category, existing);
        }
        const categoryBreakdown: DeadStockBreakdown[] = Array.from(catMap.entries())
            .map(([name, { value, count }]) => ({ name, value, count }))
            .sort((a, b) => b.value - a.value);

        // Compute warehouse breakdown
        const whMap = new Map<string, { value: number; count: number }>();
        for (const item of deadStocks) {
            const existing = whMap.get(item.warehouseName) || { value: 0, count: 0 };
            existing.value += item.value;
            existing.count += 1;
            whMap.set(item.warehouseName, existing);
        }
        const warehouseBreakdown: DeadStockBreakdown[] = Array.from(whMap.entries())
            .map(([name, { value, count }]) => ({ name, value, count }))
            .sort((a, b) => b.value - a.value);

        // Compute aging bands
        const agingMap = new Map<string, { value: number; count: number; order: number }>();
        for (const item of deadStocks) {
            const { band, order } = getAgingBandLabel(item.daysInactive);
            const existing = agingMap.get(band) || { value: 0, count: 0, order };
            existing.value += item.value;
            existing.count += 1;
            agingMap.set(band, existing);
        }
        const agingBands: AgingBand[] = Array.from(agingMap.entries())
            .map(([band, { value, count, order }]) => ({ band, value, count, order }))
            .sort((a, b) => a.order - b.order);

        const report: DeadStockReport = {
            items: deadStocks,
            summary,
            categoryBreakdown,
            warehouseBreakdown,
            agingBands,
        };

        return { success: true, data: report };

    } catch (error) {
        console.error("Failed to get dead stock report:", error);
        return { success: false, error: "Failed to generate dead stock report" };
    }
}
