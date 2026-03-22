"use server"

import { db } from "@/db"
import { stockLevels } from "@/db/schema"
import { aiInventoryPredictions } from "@/db/schema/ai-predictions"
import { gt, and, lte, desc, eq, inArray } from "drizzle-orm"
import type { ReorderAlert, ReorderPredictionStock } from "@/lib/types"
import { getStocks } from "./stock"
import { generateMLPrediction } from "./inventory-ml"
import { normalizeSlocFields } from "@/lib/sloc"

/**
 * Returns all stock entries below their minimum stock level.
 * urgency: 'critical' = stock is 0, 'warning' = stock < min, 'ok' = fine (filtered out)
 */
export async function getReorderAlerts(): Promise<ReorderAlert[]> {
    const rows = await db.query.stockLevels.findMany({
        where: and(
            gt(stockLevels.minStock, 0),
            lte(stockLevels.totalStock, stockLevels.minStock)
        ),
        with: {
            product: true,
            warehouse: true,
        },
        orderBy: (sl, { asc }) => [asc(sl.totalStock)],
    })

    // Filter only rows where product and warehouse exist, add urgency label
    const alerts: ReorderAlert[] = rows
        .filter((r) => r.product && r.warehouse)
        .map((r) => ({
            ...r,
            product: r.product!,
            warehouse: r.warehouse!,
            urgency: r.totalStock === 0 ? "critical" : "warning",
        })) as ReorderAlert[]

    return normalizeSlocFields(alerts)
}

/**
 * Returns stock table rows with the latest ML Safety Stock recommendation.
 * This powers the "Re Order Prediction" tab in Reorder Alert page.
 */
export async function getReorderPredictionStocks(): Promise<ReorderPredictionStock[]> {
    const stocks = await getStocks()

    const materialNumbers = Array.from(new Set(
        stocks
            .map((stock) => stock.product?.materialNumber?.trim())
            .filter((materialNo): materialNo is string => Boolean(materialNo))
    ))

    if (materialNumbers.length === 0) {
        return []
    }

    const predictions = await db
        .select({
            id: aiInventoryPredictions.id,
            productCode: aiInventoryPredictions.productCode,
            recommendedStock: aiInventoryPredictions.recommendedStock,
            createdAt: aiInventoryPredictions.createdAt,
        })
        .from(aiInventoryPredictions)
        .where(
            and(
                eq(aiInventoryPredictions.predictionType, "SAFETY_STOCK"),
                inArray(aiInventoryPredictions.productCode, materialNumbers)
            )
        )
        .orderBy(desc(aiInventoryPredictions.createdAt))

    const latestPredictionByMaterial = new Map<
        string,
        { id: number; recommendedStock: number; createdAt: Date }
    >()

    for (const prediction of predictions) {
        const normalizedCode = prediction.productCode.trim()
        if (!latestPredictionByMaterial.has(normalizedCode)) {
            latestPredictionByMaterial.set(normalizedCode, {
                id: prediction.id,
                recommendedStock: prediction.recommendedStock,
                createdAt: prediction.createdAt,
            })
        }
    }

    return normalizeSlocFields(stocks
        .filter((stock) => stock.product && stock.warehouse)
        .map((stock) => {
            const normalizedMaterialNo = stock.product?.materialNumber?.trim() || ""
            const latestPrediction = latestPredictionByMaterial.get(normalizedMaterialNo)

            return {
                ...stock,
                product: stock.product!,
                warehouse: stock.warehouse!,
                mlMinimumStock: latestPrediction?.recommendedStock ?? null,
                mlPredictionId: latestPrediction?.id ?? null,
                mlPredictedAt: latestPrediction?.createdAt ?? null,
            }
        }) as ReorderPredictionStock[])
}

/**
 * Fill missing ML minimum stock values in batches for materials that do not yet
 * have SAFETY_STOCK predictions.
 */
export async function fillMissingReorderPredictionStocks(batchSize: number = 12) {
    try {
        const safeBatchSize = Math.min(Math.max(batchSize, 1), 25)
        const stocks = await getStocks()

        const materialNumbers = Array.from(new Set(
            stocks
                .map((stock) => stock.product?.materialNumber?.trim())
                .filter((materialNo): materialNo is string => Boolean(materialNo))
        ))

        if (materialNumbers.length === 0) {
            return {
                success: true,
                attempted: 0,
                generated: 0,
                failed: 0,
                remaining: 0,
                failedMaterials: [] as string[],
            }
        }

        const existingPredictions = await db
            .select({
                productCode: aiInventoryPredictions.productCode,
            })
            .from(aiInventoryPredictions)
            .where(
                and(
                    eq(aiInventoryPredictions.predictionType, "SAFETY_STOCK"),
                    inArray(aiInventoryPredictions.productCode, materialNumbers)
                )
            )

        const existingSet = new Set(
            existingPredictions.map((item) => item.productCode.trim())
        )

        const missingMaterials = materialNumbers.filter((materialNo) => !existingSet.has(materialNo))
        const toProcess = missingMaterials.slice(0, safeBatchSize)

        let generated = 0
        let failed = 0
        const failedMaterials: string[] = []

        for (const materialNo of toProcess) {
            const result = await generateMLPrediction(materialNo, "SAFETY_STOCK")
            if (result.success) {
                generated += 1
            } else {
                failed += 1
                failedMaterials.push(materialNo)
            }
        }

        const remaining = Math.max(0, missingMaterials.length - toProcess.length)

        return {
            success: true,
            attempted: toProcess.length,
            generated,
            failed,
            remaining,
            failedMaterials,
        }
    } catch (error) {
        console.error("Failed to fill reorder prediction stocks:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fill reorder prediction stocks",
            attempted: 0,
            generated: 0,
            failed: 0,
            remaining: 0,
            failedMaterials: [] as string[],
        }
    }
}

/**
 * Summary stats for the alert dashboard card.
 */
export async function getReorderAlertSummary() {
    const alerts = await getReorderAlerts()
    const critical = alerts.filter((a) => a.urgency === "critical").length
    const warning = alerts.filter((a) => a.urgency === "warning").length
    return { total: alerts.length, critical, warning }
}
