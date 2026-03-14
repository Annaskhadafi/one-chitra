"use server"

import { db } from "@/db"
import { aiInventoryPredictions, aiSettings, restockNotifications } from "@/db/schema/ai-predictions"
import { zmc9StockSap } from "@/db/schema/sap"
import { historyOrders } from "@/db/schema/history-orders"
import { salesRevenueSap } from "@/db/schema/sap"
import { eq, sql, desc, and, ilike, or, gte, lte, lt, gt, inArray } from "drizzle-orm"
import { getAuthenticatedSession } from "@/lib/rbac"
import { getFleetList } from "./fleet"
import { revalidatePath } from "next/cache"
import { calculateMovingAverage } from "@/lib/ai-utils"

const GROQ_API_KEY = "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";

// Default ML settings (fallback if database settings are not available)
const DEFAULT_ML_SETTINGS = {
    model: "qwen/qwen3-32b",
    temperature: 0.1,
    maxTokens: 8192,
    cacheDuration: 24,
    thinkingMode: false
};

/**
 * Get ML settings from database with fallback to defaults
 * Requirements: 9.9
 */
export async function getMLSettings() {
    try {
        const settings = await db.select()
            .from(aiSettings)
            .where(
                or(
                    eq(aiSettings.settingKey, 'ai_model'),
                    eq(aiSettings.settingKey, 'ai_temperature'),
                    eq(aiSettings.settingKey, 'ai_max_tokens'),
                    eq(aiSettings.settingKey, 'ai_cache_duration'),
                    eq(aiSettings.settingKey, 'ai_thinking_mode')
                )
            );

        const settingsMap = new Map(settings.map(s => [s.settingKey, s.settingValue]));

        return {
            model: settingsMap.get('ai_model') || DEFAULT_ML_SETTINGS.model,
            temperature: parseFloat(settingsMap.get('ai_temperature') || String(DEFAULT_ML_SETTINGS.temperature)),
            maxTokens: parseInt(settingsMap.get('ai_max_tokens') || String(DEFAULT_ML_SETTINGS.maxTokens)),
            cacheDuration: parseInt(settingsMap.get('ai_cache_duration') || String(DEFAULT_ML_SETTINGS.cacheDuration)),
            thinkingMode: settingsMap.get('ai_thinking_mode') === 'true'
        };
    } catch (error) {
        console.error("Failed to fetch ML settings, using defaults:", error);
        return DEFAULT_ML_SETTINGS;
    }
}

/**
 * Filter parameters for prediction list
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6
 */
export interface PredictionFilters {
    predictionType?: "REPLENISHMENT" | "SAFETY_STOCK" | "CUSTOMER_RECOMMENDATION"
    dateFrom?: Date
    dateTo?: Date
    materialGroup?: string
    stockRange?: "low" | "medium" | "high" | "all"
    accuracyLevel?: "high" | "medium" | "low" | "all"
    searchQuery?: string
    page?: number // Requirements: 10.2 - pagination support
    pageSize?: number // Requirements: 10.2 - items per page (default 20)
}

/**
 * Get recent predictions with optional filters
 * Requirements: 6.7, 6.8
 */
export async function getRecentPredictions(filters?: PredictionFilters) {
    try {
        await getAuthenticatedSession("inventory", "view");

        // Build WHERE conditions array
        const conditions = [];

        // Date range filter (Requirements: 6.2)
        if (filters?.dateFrom) {
            conditions.push(gte(aiInventoryPredictions.createdAt, filters.dateFrom));
        }
        if (filters?.dateTo) {
            // Add one day to include the entire end date
            const endDate = new Date(filters.dateTo);
            endDate.setDate(endDate.getDate() + 1);
            conditions.push(lt(aiInventoryPredictions.createdAt, endDate));
        }

        if (filters?.predictionType) {
            conditions.push(eq(aiInventoryPredictions.predictionType, filters.predictionType));
        }

        // Stock range filter (Requirements: 6.4)
        if (filters?.stockRange && filters.stockRange !== "all") {
            if (filters.stockRange === "low") {
                conditions.push(lt(aiInventoryPredictions.recommendedStock, 100));
            } else if (filters.stockRange === "medium") {
                conditions.push(
                    and(
                        gte(aiInventoryPredictions.recommendedStock, 100),
                        lte(aiInventoryPredictions.recommendedStock, 500)
                    )
                );
            } else if (filters.stockRange === "high") {
                conditions.push(gt(aiInventoryPredictions.recommendedStock, 500));
            }
        }

        // Accuracy level filter (Requirements: 6.5)
        if (filters?.accuracyLevel && filters.accuracyLevel !== "all") {
            if (filters.accuracyLevel === "high") {
                conditions.push(gt(aiInventoryPredictions.accuracyPercentage, 80));
            } else if (filters.accuracyLevel === "medium") {
                conditions.push(
                    and(
                        gte(aiInventoryPredictions.accuracyPercentage, 60),
                        lte(aiInventoryPredictions.accuracyPercentage, 80)
                    )
                );
            } else if (filters.accuracyLevel === "low") {
                conditions.push(lt(aiInventoryPredictions.accuracyPercentage, 60));
            }
        }

        // Search query filter (Requirements: 6.6)
        if (filters?.searchQuery && filters.searchQuery.trim() !== "") {
            const searchTerm = `%${filters.searchQuery.trim()}%`;
            conditions.push(
                or(
                    ilike(aiInventoryPredictions.productCode, searchTerm),
                    ilike(aiInventoryPredictions.productName, searchTerm)
                )
            );
        }

        // Pagination (Requirements: 10.2)
        const page = filters?.page || 1;
        const pageSize = filters?.pageSize || 20; // Default 20 items per page
        const offset = (page - 1) * pageSize;

        // Material group filter (Requirements: 6.3)
        // Note: Material group is not directly in aiInventoryPredictions table
        // We need to join with salesRevenueSap to filter by material group

        let data;
        let totalCount = 0;

        if (filters?.materialGroup) {
            // Join with SAP sales revenue table to filter by material group
            const query = db
                .select({
                    id: aiInventoryPredictions.id,
                    productCode: aiInventoryPredictions.productCode,
                    productName: aiInventoryPredictions.productName,
                    predictionType: aiInventoryPredictions.predictionType,
                    recommendedStock: aiInventoryPredictions.recommendedStock,
                    rationale: aiInventoryPredictions.rationale,
                    createdAt: aiInventoryPredictions.createdAt,
                    actualSales: aiInventoryPredictions.actualSales,
                    accuracyPercentage: aiInventoryPredictions.accuracyPercentage,
                    batchId: aiInventoryPredictions.batchId,
                    currentStock: aiInventoryPredictions.currentStock,
                })
                .from(aiInventoryPredictions)
                .leftJoin(
                    salesRevenueSap,
                    eq(aiInventoryPredictions.productCode, salesRevenueSap.materialNo)
                )
                .where(
                    and(
                        eq(salesRevenueSap.materialGroup, filters.materialGroup),
                        conditions.length > 0 ? and(...conditions) : undefined
                    )
                )
                .orderBy(desc(aiInventoryPredictions.createdAt))
                .limit(pageSize);

            data = await (offset > 0 ? query.offset(offset) : query);

            // Get total count for filtered results
            const countResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(aiInventoryPredictions)
                .leftJoin(
                    salesRevenueSap,
                    eq(aiInventoryPredictions.productCode, salesRevenueSap.materialNo)
                )
                .where(
                    and(
                        eq(salesRevenueSap.materialGroup, filters.materialGroup),
                        conditions.length > 0 ? and(...conditions) : undefined
                    )
                );

            totalCount = Number(countResult[0]?.count || 0);
        } else {
            // Query without material group filter
            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            const query = db
                .select()
                .from(aiInventoryPredictions)
                .where(whereClause)
                .orderBy(desc(aiInventoryPredictions.createdAt))
                .limit(pageSize);

            data = await (offset > 0 ? query.offset(offset) : query);

            // Get total count for filtered results (Requirements: 6.8)
            const countResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(aiInventoryPredictions)
                .where(whereClause);

            totalCount = Number(countResult[0]?.count || 0);
        }

        const totalPages = Math.ceil(totalCount / pageSize);
        const hasMore = page < totalPages;

        return {
            success: true,
            data,
            totalCount, // Requirements: 6.8 - display number of results matching filter criteria
            page,
            pageSize,
            totalPages,
            hasMore // Requirements: 10.2 - for infinite scroll implementation
        };
    } catch (error) {
        console.error("Failed to fetch predictions:", error);
        return { success: false, error: "Failed to fetch AI predictions" };
    }
}

interface HistoricalInsightFilters {
    predictionType: "REPLENISHMENT" | "SAFETY_STOCK" | "CUSTOMER_RECOMMENDATION"
    days?: number
}

const parseStatusFromRationale = (rationale: string): "Safe" | "Warning" | "Critical" | null => {
    if (!rationale) return null

    try {
        const parsed = JSON.parse(rationale)
        if (parsed?.status === "Safe" || parsed?.status === "Warning" || parsed?.status === "Critical") {
            return parsed.status
        }
    } catch {
        // Ignore parse error and fallback to keyword matching
    }

    const normalized = rationale.toLowerCase()
    if (normalized.includes("critical") || normalized.includes("kritis")) return "Critical"
    if (normalized.includes("warning") || normalized.includes("peringatan")) return "Warning"
    if (normalized.includes("safe") || normalized.includes("aman")) return "Safe"
    return null
}

export async function getPredictionHistoricalInsights(filters: HistoricalInsightFilters) {
    try {
        await getAuthenticatedSession("inventory", "view")

        const days = filters.days ?? 90
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - days)

        const data = await db
            .select({
                id: aiInventoryPredictions.id,
                productCode: aiInventoryPredictions.productCode,
                productName: aiInventoryPredictions.productName,
                recommendedStock: aiInventoryPredictions.recommendedStock,
                accuracyPercentage: aiInventoryPredictions.accuracyPercentage,
                rationale: aiInventoryPredictions.rationale,
                createdAt: aiInventoryPredictions.createdAt,
            })
            .from(aiInventoryPredictions)
            .where(
                and(
                    eq(aiInventoryPredictions.predictionType, filters.predictionType),
                    gte(aiInventoryPredictions.createdAt, sinceDate)
                )
            )
            .orderBy(desc(aiInventoryPredictions.createdAt))

        const riskBuckets = { Safe: 0, Warning: 0, Critical: 0 }
        const productCounter = new Map<string, { count: number; name: string }>()

        data.forEach((item) => {
            const key = item.productCode
            if (!productCounter.has(key)) {
                productCounter.set(key, { count: 0, name: item.productName || item.productCode })
            }
            const current = productCounter.get(key)!
            current.count += 1

            const status = parseStatusFromRationale(item.rationale)
            if (status) riskBuckets[status] += 1
        })

        const topProducts = Array.from(productCounter.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([code, value]) => ({
                code,
                name: value.name,
                count: value.count,
            }))

        const weeklyMap = new Map<string, { totalRecommended: number; count: number; accuracySum: number; accuracyCount: number }>()
        data.forEach((item) => {
            const date = new Date(item.createdAt)
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-W${Math.ceil(date.getDate() / 7)}`
            if (!weeklyMap.has(key)) {
                weeklyMap.set(key, { totalRecommended: 0, count: 0, accuracySum: 0, accuracyCount: 0 })
            }
            const bucket = weeklyMap.get(key)!
            bucket.totalRecommended += item.recommendedStock || 0
            bucket.count += 1
            if (typeof item.accuracyPercentage === "number") {
                bucket.accuracySum += item.accuracyPercentage
                bucket.accuracyCount += 1
            }
        })

        const weeklyTrend = Array.from(weeklyMap.entries())
            .map(([period, bucket]) => ({
                period,
                avgRecommendedStock: bucket.count > 0 ? Number((bucket.totalRecommended / bucket.count).toFixed(2)) : 0,
                avgAccuracy: bucket.accuracyCount > 0 ? Number((bucket.accuracySum / bucket.accuracyCount).toFixed(2)) : 0,
            }))
            .sort((a, b) => a.period.localeCompare(b.period))
            .slice(-8)

        const firstRecommended = weeklyTrend[0]?.avgRecommendedStock ?? 0
        const lastRecommended = weeklyTrend[weeklyTrend.length - 1]?.avgRecommendedStock ?? 0
        const recommendationTrend = weeklyTrend.length > 1
            ? (((lastRecommended - firstRecommended) / Math.max(firstRecommended, 1)) * 100)
            : 0

        const accuracyValues = data
            .filter((item) => typeof item.accuracyPercentage === "number")
            .map((item) => item.accuracyPercentage as number)
        const avgAccuracy = accuracyValues.length > 0
            ? accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length
            : 0

        const insightBullets = [
            `Total ${data.length} prediksi ${filters.predictionType} dalam ${days} hari terakhir.`,
            `Rata-rata akurasi tercatat ${avgAccuracy.toFixed(1)}% dengan tren rekomendasi ${recommendationTrend >= 0 ? "naik" : "turun"} ${Math.abs(recommendationTrend).toFixed(1)}%.`,
            `Distribusi risiko: Safe ${riskBuckets.Safe}, Warning ${riskBuckets.Warning}, Critical ${riskBuckets.Critical}.`
        ]

        return {
            success: true,
            data: {
                totalPredictions: data.length,
                avgAccuracy: Number(avgAccuracy.toFixed(2)),
                riskBuckets,
                topProducts,
                weeklyTrend,
                recommendationTrend: Number(recommendationTrend.toFixed(2)),
                insightBullets,
            }
        }
    } catch (error) {
        console.error("Failed to generate prediction historical insights:", error)
        return { success: false, error: "Failed to generate historical insights" }
    }
}


export async function getDashboardMetrics() {
    try {
        await getAuthenticatedSession("inventory", "view");

        const now = new Date();

        // Calculate date ranges
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Query predictions for last 7 days
        const predictions7Days = await db.select({ count: sql<number>`count(*)` })
            .from(aiInventoryPredictions)
            .where(sql`${aiInventoryPredictions.createdAt} >= ${sevenDaysAgo}`);

        // Query predictions for last 30 days
        const predictions30Days = await db.select({ count: sql<number>`count(*)` })
            .from(aiInventoryPredictions)
            .where(sql`${aiInventoryPredictions.createdAt} >= ${thirtyDaysAgo}`);

        // Calculate breakdown by prediction type (last 30 days)
        const predictionsByType = await db.select({
            predictionType: aiInventoryPredictions.predictionType,
            count: sql<number>`count(*)`
        })
            .from(aiInventoryPredictions)
            .where(sql`${aiInventoryPredictions.createdAt} >= ${thirtyDaysAgo}`)
            .groupBy(aiInventoryPredictions.predictionType);

        const typeBreakdown = {
            replenishment: 0,
            safetyStock: 0,
            customerRecommendation: 0
        };

        predictionsByType.forEach(item => {
            if (item.predictionType === 'REPLENISHMENT') {
                typeBreakdown.replenishment = Number(item.count);
            } else if (item.predictionType === 'SAFETY_STOCK') {
                typeBreakdown.safetyStock = Number(item.count);
            } else if (item.predictionType === 'CUSTOMER_RECOMMENDATION') {
                typeBreakdown.customerRecommendation = Number(item.count);
            }
        });

        // Get top 10 products with highest restock recommendations
        // Only include REPLENISHMENT type predictions
        const topRestockProducts = await db.select({
            productCode: aiInventoryPredictions.productCode,
            productName: aiInventoryPredictions.productName,
            recommendedStock: aiInventoryPredictions.recommendedStock,
            currentStock: aiInventoryPredictions.currentStock
        })
            .from(aiInventoryPredictions)
            .where(eq(aiInventoryPredictions.predictionType, 'REPLENISHMENT'))
            .orderBy(desc(aiInventoryPredictions.recommendedStock))
            .limit(10);

        // Calculate products approaching restock point (<20% of recommended)
        // Only count products where currentStock is not null and recommendedStock > 0
        const productsNearRestockResult = await db.select({
            count: sql<number>`count(*)`
        })
            .from(aiInventoryPredictions)
            .where(
                and(
                    sql`${aiInventoryPredictions.currentStock} IS NOT NULL`,
                    sql`${aiInventoryPredictions.recommendedStock} > 0`,
                    sql`(${aiInventoryPredictions.currentStock}::float / ${aiInventoryPredictions.recommendedStock}::float) < 0.20`
                )
            );

        const productsNearRestock = Number(productsNearRestockResult[0]?.count || 0);

        // Calculate average prediction accuracy for current month
        const accuracyResult = await db.select({
            avgAccuracy: sql<number>`AVG(${aiInventoryPredictions.accuracyPercentage})`
        })
            .from(aiInventoryPredictions)
            .where(
                and(
                    sql`${aiInventoryPredictions.createdAt} >= ${currentMonthStart}`,
                    sql`${aiInventoryPredictions.accuracyPercentage} IS NOT NULL`
                )
            );

        const averageAccuracy = accuracyResult[0]?.avgAccuracy
            ? Number(accuracyResult[0].avgAccuracy)
            : null;

        const metrics = {
            predictions7Days: Number(predictions7Days[0]?.count || 0),
            predictions30Days: Number(predictions30Days[0]?.count || 0),
            predictionsByType: typeBreakdown,
            topRestockProducts: topRestockProducts.map(p => ({
                productCode: p.productCode,
                productName: p.productName,
                recommendedStock: p.recommendedStock,
                currentStock: p.currentStock
            })),
            productsNearRestock,
            averageAccuracy
        };

        return { success: true, data: metrics };
    } catch (error) {
        console.error("Failed to fetch dashboard metrics:", error);
        return { success: false, error: "Failed to fetch dashboard metrics" };
    }
}

export async function deleteMLPrediction(id: number) {
    try {
        await getAuthenticatedSession("inventory", "edit");
        await db.delete(aiInventoryPredictions).where(eq(aiInventoryPredictions.id, id));
        revalidatePath("/dashboard/inventory-ai");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete prediction:", error);
        return { success: false, error: "Failed to delete AI prediction" };
    }
}

export async function searchCustomers(query: string) {
    try {
        await getAuthenticatedSession("inventory", "view");
        if (!query || query.length < 2) return { success: true, data: [] };

        // Search customers from sales revenue (SAP)
        const data = await db.select({
            customerCode: salesRevenueSap.customer,
            customerName: salesRevenueSap.customerName,
        }).from(salesRevenueSap)
            .where(
                or(
                    ilike(salesRevenueSap.customer, `%${query}%`),
                    ilike(salesRevenueSap.customerName, `%${query}%`)
                )
            )
            .limit(30);

        // Remove duplicates
        const unique = Array.from(new Map(data.filter(d => d.customerCode).map(item => [item.customerCode, item])).values());

        return { success: true, data: unique };
    } catch (error) {
        console.error("Failed to search customers:", error);
        return { success: false, error: "Failed to search customers" };
    }
}

export async function searchMaterials(query: string) {
    try {
        await getAuthenticatedSession("inventory", "view");
        if (!query || query.length < 2) return { success: true, data: [] };

        const data = await db.select({
            materialNo: zmc9StockSap.materialNo,
            materialDesc: zmc9StockSap.materialDesc,
        }).from(zmc9StockSap)
            .where(
                or(
                    sql`cast(${zmc9StockSap.materialNo} as text) ilike ${`%${query}%`}`,
                    ilike(zmc9StockSap.materialDesc, `%${query}%`)
                )
            )
            .limit(30);

        // Remove duplicates by materialNo
        const unique = Array.from(new Map(data.filter(d => d.materialNo).map(item => [item.materialNo, item])).values());

        return { success: true, data: unique };
    } catch (error) {
        console.error("Failed to search materials:", error);
        return { success: false, error: "Failed to search materials" };
    }
}

export async function generateMLPrediction(productCode: string, predictionType: 'REPLENISHMENT' | 'SAFETY_STOCK') {
    try {
        await getAuthenticatedSession("inventory", "edit");

        const normalizedProductCode = productCode.trim()
        if (!normalizedProductCode) {
            return { success: false, error: "Material Number wajib diisi" };
        }

        // Get ML settings from database (Requirement 9.9)
        const aiConfig = await getMLSettings();

        // 1. Check if prediction within cache duration exists
        const existing = await db.select().from(aiInventoryPredictions)
            .where(and(
                eq(aiInventoryPredictions.productCode, normalizedProductCode),
                eq(aiInventoryPredictions.predictionType, predictionType)
            ))
            .orderBy(desc(aiInventoryPredictions.createdAt))
            .limit(1);

        if (existing.length > 0) {
            const lastPred = existing[0];
            const hoursSince = (new Date().getTime() - lastPred.createdAt.getTime()) / (1000 * 60 * 60);
            // Use configurable cache duration (Requirement 9.9)
            if (hoursSince < aiConfig.cacheDuration) {
                return { success: true, data: lastPred, cached: true };
            }
        }

        // 2. Fetch Data (Stock & History Sales)
        const stockSelection = {
            materialNo: zmc9StockSap.materialNo,
            materialDesc: zmc9StockSap.materialDesc,
            totalStock: zmc9StockSap.totalStock,
            plantCode: zmc9StockSap.plantCode,
            plantName: zmc9StockSap.plantName,
            storLoc: zmc9StockSap.storLoc,
            storLocDesc: zmc9StockSap.storLocDesc,
            baseUnitOfMeasure: zmc9StockSap.baseUnitOfMeasure,
        };

        let stockData = await db.select(stockSelection).from(zmc9StockSap)
            .where(sql`trim(cast(${zmc9StockSap.materialNo} as text)) = ${normalizedProductCode}`);

        if (stockData.length === 0) {
            stockData = await db.select(stockSelection).from(zmc9StockSap)
                .where(sql`cast(${zmc9StockSap.materialNo} as text) ilike ${`%${normalizedProductCode}%`}`);
        }

        // Fetch 2 years (24 months) of sales history from history_orders table
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const salesDataRaw = await db.select({
            billingDate: historyOrders.billingDate,
            qty: historyOrders.qty,
            customerName: historyOrders.customerName
        }).from(historyOrders)
            .where(and(
                eq(historyOrders.materialNo, normalizedProductCode),
                sql`to_date(${historyOrders.billingDate}, 'MM/DD/YYYY') >= ${twoYearsAgo}`
            ));

        // Group by month in JS for safer handling of string dates, and track customers
        const monthlySales: Record<string, number> = {};
        const customers: Record<string, number> = {};
        let totalQty = 0;
        const qtyList: number[] = [];

        salesDataRaw.forEach(item => {
            if (item.billingDate) {
                const date = new Date(item.billingDate);
                if (!isNaN(date.getTime())) {
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    monthlySales[monthKey] = (monthlySales[monthKey] || 0) + (item.qty || 0);
                    totalQty += (item.qty || 0);
                    qtyList.push(item.qty || 0);

                    if (item.customerName) {
                        customers[item.customerName] = (customers[item.customerName] || 0) + (item.qty || 0);
                    }
                }
            }
        });

        // Top 3 Customers
        const topCustomers = Object.entries(customers)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([name, qty]) => `${name} (${qty} unit)`)
            .join(", ");

        const formattedSalesData = Object.entries(monthlySales)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, qty]) => ({ date, qty }));

        const historyText = formattedSalesData.map(s => `${s.date}: ${s.qty}`).join(", ");

        const productName = stockData[0]?.materialDesc || "Unknown Product";
        const currentStock = stockData.reduce((acc, curr) => acc + Number(curr.totalStock), 0);

        // MATHEMATICAL ANALYSIS
        const avgMonthlyConsumption = totalQty / 24;
        const dailyConsumption = avgMonthlyConsumption / 30;
        const daysToRunOut = dailyConsumption > 0 ? currentStock / dailyConsumption : 0;

        const mean = totalQty / (qtyList.length || 1);
        const variance = qtyList.length > 0
            ? qtyList.reduce((acc, q) => acc + Math.pow(q - mean, 2), 0) / qtyList.length
            : 0;
        const stdDev = Math.sqrt(variance);
        const safetyStockMath = Math.ceil(stdDev * 1.65);


        // 3. Construct Prompt
        let prompt = "";
        const jsonSchema = `{
  "recommendedStock": number,
  "report": {
    "summary": "Analisis singkat kondisi stok saat ini",
    "status": "Safe" | "Warning" | "Critical",
    "metrics": [
      { "label": "Stok SAP", "value": "${currentStock.toLocaleString()}", "icon": "Box" },
      { "label": "Konsumsi Bulanan", "value": "${avgMonthlyConsumption.toFixed(0)}", "icon": "TrendingUp" },
      { "label": "Ketahanan Stok", "value": "${daysToRunOut.toFixed(0)} Hari", "icon": "Clock" }
    ],
    "history": [ { "period": "Bulan/Tahun", "qty": number } ],
    "recommendations": [ { "title": "Judul Saran", "detail": "Penjelasan detail" } ],
    "customerInsights": "Wawasan tentang pelanggan utama"
  }
}`;

        if (predictionType === 'REPLENISHMENT') {
            prompt = `Anda adalah ML Engineer & Senior Supply Chain Manager di PT Chitra Paratama. 
Tugas Anda adalah memberikan "Laporan Analisis Pengadaan Barang" dalam format JSON TERSTRUKTUR.

--- DATA INPUT ---
Produk: ${productName} (${normalizedProductCode})
Stok SAP: ${currentStock}
Avg Consumption: ${avgMonthlyConsumption.toFixed(2)} unit/bulan
Run-out: ${daysToRunOut.toFixed(1)} hari
Top Buyer: ${topCustomers}
Histori: ${JSON.stringify(formattedSalesData)}

--- INSTRUKSI ---
Isi field "report" dengan analisis mendalam:
1. **summary**: Jelaskan apakah barang ini High/Low Demand dan urgensi ordernya.
2. **status**: Tentukan "Safe", "Warning", atau "Critical" berdasarkan sisa stok vs lead time (30 hari).
3. **metrics**: Sesuaikan nilai metrik agar akurat.
4. **history**: Gunakan data histori yang diberikan untuk mengisi array history.
5. **recommendations**: Berikan minimal 3 saran strategis (kapan PO, jumlah PO, negosiasi buyer).

Format Output HARUS valid JSON sesuai schema ini:
${jsonSchema}`;
        } else {
            prompt = `Anda adalah ML Engineer & Senior Inventory Strategist.
Tugas Anda adalah memberikan "Laporan Optimasi Stok Minimum (Safety Stock)" dalam format JSON TERSTRUKTUR.

--- DATA INPUT ---
Produk: ${productName} (${normalizedProductCode})
Stok SAP: ${currentStock}
Safety Stock (Math): ${safetyStockMath}
Std Dev: ${stdDev.toFixed(2)}
Histori: ${JSON.stringify(formattedSalesData)}

--- INSTRUKSI ---
Isi field "report" dengan analisis mendalam:
1. **summary**: Jelaskan mengapa angka Safety Stock ${safetyStockMath} diperlukan.
2. **status**: "Safe" jika stok jauh di atas safety stock, "Critical" jika di bawah.
3. **metrics**: Tambahkan metrik "Safety Stock Target" dan "Volatility Index".
4. **history**: Masukkan data riwayat penjualan.
5. **recommendations**: Berikan saran kapan harus me-review stok minimum ini.

Format Output HARUS valid JSON sesuai schema ini:
${jsonSchema}`;
        }

        // 4. Call Groq API with configurable parameters (Requirement 9.9)
        console.log("[ML] Calling Groq API with model:", aiConfig.model, "for product:", productCode);
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: aiConfig.model,
                messages: [
                    { role: "system", content: "Respond with ONLY a JSON object following the provided schema: {\"recommendedStock\": number, \"report\": object}. No other text." },
                    { role: "user", content: prompt }
                ],
                temperature: aiConfig.temperature,
                max_tokens: aiConfig.maxTokens
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[AI] Groq API response error:", response.status, errorText);
            throw new Error(`Groq API Error (${response.status}): ${errorText}`);
        }

        const jsonResponse = await response.json();
        console.log("[AI] Groq API response received:", JSON.stringify(jsonResponse).slice(0, 200));
        const content = jsonResponse.choices[0]?.message?.content;

        let parsedResult;
        const rawContent = content || "";
        console.log("[AI] Raw content length:", rawContent.length);
        console.log("[AI] Raw content first 300 chars:", rawContent.substring(0, 300));

        // Strategy: Extract JSON from AI response that may contain thinking blocks
        let jsonStr = rawContent;

        // Step 1: If content has </think>, take everything after it
        const thinkEndTag = "</think>";
        const thinkEndIdx = jsonStr.lastIndexOf(thinkEndTag);
        if (thinkEndIdx !== -1) {
            jsonStr = jsonStr.substring(thinkEndIdx + thinkEndTag.length).trim();
            console.log("[AI] After think removal:", jsonStr.substring(0, 200));
        }

        // Step 2: Remove markdown code fences
        jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();

        // Step 3: Find the JSON object between first { and last }
        const openBrace = jsonStr.indexOf('{');
        const closeBrace = jsonStr.lastIndexOf('}');
        if (openBrace !== -1 && closeBrace > openBrace) {
            jsonStr = jsonStr.substring(openBrace, closeBrace + 1);
        }

        console.log("[AI] JSON to parse:", jsonStr.substring(0, 300));

        try {
            parsedResult = JSON.parse(jsonStr);
        } catch (e) {
            // Last resort: try to find JSON in the ENTIRE raw content (skip think)
            try {
                const allBraceStart = rawContent.lastIndexOf('{"');
                const allBraceEnd = rawContent.lastIndexOf('}');
                if (allBraceStart !== -1 && allBraceEnd > allBraceStart) {
                    const lastJson = rawContent.substring(allBraceStart, allBraceEnd + 1);
                    console.log("[AI] Last resort parse:", lastJson.substring(0, 200));
                    parsedResult = JSON.parse(lastJson);
                } else {
                    throw e;
                }
            } catch (_e2) {
                console.error("[AI] All parse attempts failed. Content (first 500):", rawContent.substring(0, 500));
                console.error("[AI] Content (last 500):", rawContent.substring(rawContent.length - 500));
                throw new Error("AI gagal mengembalikan JSON yang valid. Silakan coba lagi.");
            }
        }

        // 5. Save to Database
        const [saved] = await db.insert(aiInventoryPredictions).values({
            productCode: normalizedProductCode,
            productName,
            predictionType,
            recommendedStock: Number(parsedResult.recommendedStock) || 0,
            rationale: JSON.stringify(parsedResult.report || { summary: parsedResult.rationale || "No rationale provided" })
        }).returning();

        console.log("[AI] Prediction saved to DB:", saved.id);
        return { success: true, data: saved, cached: false };

    } catch (error: unknown) {
        console.error("[AI] Failed to generate AI Prediction:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to generate AI prediction";
        return { success: false, error: errorMessage };
    }
}

export const generateAIPrediction = generateMLPrediction;

export async function generateMLCustomerRecommendation(customerCode: string) {
    try {
        await getAuthenticatedSession("inventory", "edit");

        // Get ML settings from database (Requirement 9.9)
        const aiConfig = await getMLSettings();

        // 1. Check Cache (configurable duration)
        const existing = await db.select().from(aiInventoryPredictions)
            .where(and(
                eq(aiInventoryPredictions.productCode, customerCode),
                eq(aiInventoryPredictions.predictionType, 'CUSTOMER_RECOMMENDATION')
            ))
            .orderBy(desc(aiInventoryPredictions.createdAt))
            .limit(1);

        if (existing.length > 0) {
            const lastPred = existing[0];
            const hoursSince = (new Date().getTime() - lastPred.createdAt.getTime()) / (1000 * 60 * 60);
            // Use configurable cache duration (Requirement 9.9)
            if (hoursSince < aiConfig.cacheDuration) {
                return { success: true, data: lastPred, cached: true };
            }
        }

        // a. History Sales (Last 2 years from history_orders)
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const salesHistory = await db.select({
            materialNo: historyOrders.materialNo,
            materialDesc: historyOrders.materialDescription,
            materialGroup: historyOrders.materialGroup,
            size: historyOrders.sizeDimen,
            qty: sql<number>`SUM(COALESCE(${historyOrders.qty}, 0))`,
            lastBuy: sql<string>`MAX(to_date(${historyOrders.billingDate}, 'MM/DD/YYYY'))`
        }).from(historyOrders)
            .where(and(
                eq(historyOrders.customer, customerCode),
                sql`to_date(${historyOrders.billingDate}, 'MM/DD/YYYY') >= ${twoYearsAgo}`
            ))
            .groupBy(historyOrders.materialNo, historyOrders.materialDescription, historyOrders.materialGroup, historyOrders.sizeDimen)
            .orderBy(desc(sql`MAX(to_date(${historyOrders.billingDate}, 'MM/DD/YYYY'))`))
            .limit(30);

        // b. Fleet Data
        const fleetResult = await getFleetList();
        const customerName = salesHistory[0]?.materialDesc ? "Customer Samples" : ""; // Placeholder, will get from list

        // Find matching fleet
        let fleetItems: Array<{
            customer?: string
            site?: string
            unit_manufacture?: string
            model?: string
            tire_size?: string
            totaltire?: number | string
        }> = [];
        const custInfo = await db.select({ name: historyOrders.customerName })
            .from(historyOrders)
            .where(eq(historyOrders.customer, customerCode))
            .limit(1);

        if (fleetResult.success && Array.isArray(fleetResult.data)) {
            const targetName = custInfo[0]?.name?.toLowerCase() || "";
            if (targetName) {
                fleetItems = fleetResult.data.filter((f: { customer?: string }) =>
                    f.customer?.toLowerCase().includes(targetName) ||
                    targetName.includes(f.customer?.toLowerCase() || "")
                ).slice(0, 20); // Limit fleet items to prevent Error 413
            }
        }

        // c. Current Stock (Top available items)
        const availableStock = await db.select({
            materialNo: zmc9StockSap.materialNo,
            materialDesc: zmc9StockSap.materialDesc,
            qty: sql<number>`SUM(${zmc9StockSap.totalStock})`
        }).from(zmc9StockSap)
            .groupBy(zmc9StockSap.materialNo, zmc9StockSap.materialDesc)
            .where(sql`${zmc9StockSap.totalStock} > 0`)
            .orderBy(desc(sql`SUM(${zmc9StockSap.totalStock})`))
            .limit(50);

        // 3. Construct Prompt
        const historyText = salesHistory.map(h => `- ${h.materialNo} (${h.materialDesc}): Beli sebanyak ${h.qty}, terakhir ${h.lastBuy}`).join("\n");
        const fleetText = fleetItems.map(f => `- Lokasi ${f.site}, Unit ${f.unit_manufacture} ${f.model}, Pakai Ban Size ${f.tire_size}, Total Ban ${f.totaltire}`).join("\n");
        const stockText = availableStock.map(s => `- ${s.materialNo}: ${s.materialDesc} (Stok: ${s.qty})`).join(", ").slice(0, 1000);

        const jsonSchema = `{
  "report": {
    "summary": "Analisis singkat profil customer",
    "status": "Safe" | "Warning" | "Critical",
    "metrics": [
      { "label": "Loyalty Score", "value": "A+", "icon": "UserCheck" },
      { "label": "Avg Order", "value": "50 Unit", "icon": "ShoppingCart" }
    ],
    "history": [ { "period": "Bulan/Tahun", "qty": number } ],
    "recommendations": [ { "title": "Judul Saran", "detail": "Penjelasan detail" } ],
    "customerInsights": "Wawasan mendalam tentang fleet & kebiasaan beli"
  }
}`;

        const prompt = `Anda adalah ML Engineer & Senior Sales Strategy Manager.
Tugas Anda adalah menyusun "Laporan Rekomendasi Penjualan" dalam format JSON TERSTRUKTUR.

--- DATA CUSTOMER ---
Nama: ${custInfo[0]?.name || "Pelanggan"} (Kode: ${customerCode})
Histori: ${JSON.stringify(salesHistory)}
Fleet: ${fleetText || "Tidak ada data armada"}
Stok Tersedia: ${stockText}

--- INSTRUKSI ---
Isi field "report" dengan:
1. **summary**: Profil singkat customer dan potensi penjualannya.
2. **status**: "Safe" jika mereka rutin beli, "Warning" jika sudah lama tidak order.
3. **metrics**: Tambahkan metrik "Total Items Bought" dan "Matching Score".
4. **history**: Gunakan data histori pembelian mereka.
5. **recommendations**: Berikan saran produk mana yang harus di-push tim sales.

Format Output HARUS valid JSON sesuai schema ini:
${jsonSchema}`;


        // 4. Call Groq with configurable parameters (Requirement 9.9)
        console.log("[AI] Generating Customer Recommendation for:", customerCode);
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY} `,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: aiConfig.model,
                messages: [
                    { role: "system", content: "Respond with ONLY a JSON object following the provided schema: {\"report\": object}. No other text." },
                    { role: "user", content: prompt }
                ],
                temperature: aiConfig.temperature,
                max_tokens: aiConfig.maxTokens
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API Error: ${response.status} `);
        }

        const jsonResponse = await response.json();
        const content = jsonResponse.choices[0]?.message?.content || "";

        // Parsing logic (reuse existing robust logic)
        let jsonStr = content;
        const thinkEndTag = "</think>";
        const thinkEndIdx = jsonStr.lastIndexOf(thinkEndTag);
        if (thinkEndIdx !== -1) jsonStr = jsonStr.substring(thinkEndIdx + thinkEndTag.length).trim();
        jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
        const openBrace = jsonStr.indexOf('{');
        const closeBrace = jsonStr.lastIndexOf('}');
        if (openBrace !== -1 && closeBrace > openBrace) jsonStr = jsonStr.substring(openBrace, closeBrace + 1);

        const parsedResult = JSON.parse(jsonStr);

        // 5. Save to DB
        const [saved] = await db.insert(aiInventoryPredictions).values({
            productCode: customerCode,
            productName: custInfo[0]?.name || "Customer",
            predictionType: 'CUSTOMER_RECOMMENDATION',
            recommendedStock: 0,
            rationale: JSON.stringify(parsedResult.report || { summary: parsedResult.rationale || "No recommendation provided" })
        }).returning();

        return { success: true, data: saved, cached: false };

    } catch (error: unknown) {
        console.error("[AI] Failed to generate customer recommendation:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to generate recommendation";
        return { success: false, error: errorMessage };
    }
}

/**
 * Get sales history for a material with 3-month moving average
 * Fetches last 6 months of sales data from salesRevenueSap
 * Requirements: 2.2, 2.6
 */
export async function getSalesHistory(materialNo: string) {
    try {
        await getAuthenticatedSession("inventory", "view");

        if (!materialNo.trim()) {
            return {
                success: true,
                data: []
            };
        }

        // Calculate date range for the last 6 months
        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Query raw sales rows from history_orders and aggregate in JS.
        const salesDataRaw = await db.select({
            billingDate: historyOrders.billingDate,
            qty: historyOrders.qty,
            revenue: historyOrders.revenueInLocCurr
        }).from(historyOrders)
            .where(
                and(
                    eq(historyOrders.materialNo, materialNo),
                    sql`to_date(${historyOrders.billingDate}, 'MM/DD/YYYY') >= ${sixMonthsAgo}`
                )
            );

        const monthlyAggregation: Record<string, { qty: number, revenue: number }> = {};

        salesDataRaw.forEach(item => {
            if ("month" in item && typeof item.month === "string") {
                if (!monthlyAggregation[item.month]) {
                    monthlyAggregation[item.month] = { qty: 0, revenue: 0 };
                }
                monthlyAggregation[item.month].qty += Number(item.qty || 0);
                monthlyAggregation[item.month].revenue += Number(item.revenue || 0);
                return;
            }

            if (item.billingDate) {
                const date = new Date(item.billingDate);
                if (!isNaN(date.getTime())) {
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    if (!monthlyAggregation[monthKey]) {
                        monthlyAggregation[monthKey] = { qty: 0, revenue: 0 };
                    }
                    monthlyAggregation[monthKey].qty += (item.qty || 0);
                    monthlyAggregation[monthKey].revenue += (item.revenue || 0);
                }
            }
        });

        const salesData = Object.entries(monthlyAggregation)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-6)
            .map(([month, data]) => ({
                month,
                qty: data.qty,
                revenue: data.revenue
            }));

        // Transform data for charting
        const chartData = salesData.map(item => ({
            month: item.month,
            sales: Number(item.qty),
            revenue: Number(item.revenue)
        }));

        // Calculate 3-month moving average
        const salesValues = chartData.map(d => d.sales);
        const movingAverages = calculateMovingAverage(salesValues, 3);

        // Add moving average to chart data
        const chartDataWithMA = chartData.map((item, index) => ({
            ...item,
            movingAverage: movingAverages[index]
        }));

        return {
            success: true,
            data: chartDataWithMA
        };
    } catch (error) {
        console.error("Failed to fetch sales history:", error);
        return {
            success: false,
            error: "Failed to fetch sales history"
        };
    }
}

/**
 * Calculate prediction accuracy for predictions older than 30 days
 * Compares recommended stock with actual sales data
 * Formula: 100 - ABS((Predicted - Actual) / Actual * 100)
 * Requirements: 3.1, 3.2, 3.4
 */
export async function calculatePredictionAccuracy() {
    try {
        await getAuthenticatedSession("inventory", "edit");

        // Calculate date 30 days ago
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Query predictions older than 30 days that don't have accuracy calculated yet
        const oldPredictions = await db.select()
            .from(aiInventoryPredictions)
            .where(
                and(
                    sql`${aiInventoryPredictions.createdAt} < ${thirtyDaysAgo}`,
                    sql`${aiInventoryPredictions.accuracyPercentage} IS NULL`
                )
            )
            .limit(100); // Process in batches to avoid overwhelming the system

        if (oldPredictions.length === 0) {
            return {
                success: true,
                message: "No predictions to process",
                processed: 0,
                updated: 0
            };
        }

        let updatedCount = 0;
        const errors: string[] = [];

        // Process each prediction
        for (const prediction of oldPredictions) {
            try {
                // Calculate the date range for actual sales
                // We look at sales data from the prediction date to 30 days after
                const predictionDate = new Date(prediction.createdAt);
                const endDate = new Date(predictionDate);
                endDate.setDate(endDate.getDate() + 30);

                // Fetch actual sales data for the product in the 30-day period after prediction
                const actualSalesResult = await db.select({
                    totalQty: sql<number>`SUM(COALESCE(${salesRevenueSap.qty}, 0))`
                })
                    .from(salesRevenueSap)
                    .where(
                        and(
                            eq(salesRevenueSap.materialNo, prediction.productCode),
                            sql`${salesRevenueSap.billingDate} >= ${predictionDate}`,
                            sql`${salesRevenueSap.billingDate} <= ${endDate}`
                        )
                    );

                const actualSales = Number(actualSalesResult[0]?.totalQty || 0);

                // Calculate accuracy using the formula: 100 - ABS((Predicted - Actual) / Actual * 100)
                let accuracy: number | null = null;

                if (actualSales > 0) {
                    const predicted = prediction.recommendedStock;
                    const variance = Math.abs((predicted - actualSales) / actualSales * 100);
                    accuracy = Math.max(0, 100 - variance); // Ensure accuracy is between 0 and 100
                } else {
                    // If there were no actual sales, we can't calculate meaningful accuracy
                    // Set accuracy to null or 0 depending on business logic
                    // For now, we'll skip updating this prediction
                    continue;
                }

                // Update the prediction with actual sales and accuracy
                await db.update(aiInventoryPredictions)
                    .set({
                        actualSales: actualSales,
                        accuracyPercentage: accuracy
                    })
                    .where(eq(aiInventoryPredictions.id, prediction.id));

                updatedCount++;

            } catch (error) {
                console.error(`Failed to calculate accuracy for prediction ${prediction.id}:`, error);
                errors.push(`Prediction ${prediction.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        return {
            success: true,
            message: `Processed ${oldPredictions.length} predictions, updated ${updatedCount}`,
            processed: oldPredictions.length,
            updated: updatedCount,
            errors: errors.length > 0 ? errors : undefined
        };

    } catch (error) {
        console.error("Failed to calculate prediction accuracy:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to calculate prediction accuracy"
        };
    }
}

/**
 * Get accuracy trend data for the last 6 months
 * Returns monthly average accuracy percentages for charting
 * Requirements: 3.6
 */
export async function getAccuracyTrend() {
    try {
        await getAuthenticatedSession("inventory", "view");

        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        // Query predictions with accuracy data from the last 6 months
        const predictions = await db.select({
            createdAt: aiInventoryPredictions.createdAt,
            accuracyPercentage: aiInventoryPredictions.accuracyPercentage
        })
            .from(aiInventoryPredictions)
            .where(
                and(
                    sql`${aiInventoryPredictions.createdAt} >= ${sixMonthsAgo}`,
                    sql`${aiInventoryPredictions.accuracyPercentage} IS NOT NULL`
                )
            )
            .orderBy(aiInventoryPredictions.createdAt);

        // Group by month and calculate average accuracy
        const monthlyData = new Map<string, { total: number; count: number }>();

        predictions.forEach(pred => {
            if (pred.accuracyPercentage !== null) {
                const date = new Date(pred.createdAt);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                const existing = monthlyData.get(monthKey) || { total: 0, count: 0 };
                existing.total += pred.accuracyPercentage;
                existing.count += 1;
                monthlyData.set(monthKey, existing);
            }
        });

        // Generate array of last 6 months with data
        const trendData = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            const data = monthlyData.get(monthKey);
            trendData.push({
                month: monthKey,
                averageAccuracy: data ? Number((data.total / data.count).toFixed(1)) : null,
                predictionCount: data ? data.count : 0
            });
        }

        return {
            success: true,
            data: trendData
        };

    } catch (error) {
        console.error("Failed to fetch accuracy trend:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch accuracy trend"
        };
    }
}

/**
 * Process bulk predictions for multiple products
 * Accepts array of material numbers (max 50), processes sequentially with 2-second delay
 * Checks cache for each product before calling AI
 * Requirements: 4.2, 4.4, 4.5, 4.6, 4.7, 4.8, 4.11
 */
export async function processBulkPredictions(
    materialNumbers: string[],
    predictionType: 'REPLENISHMENT' | 'SAFETY_STOCK'
) {
    try {
        await getAuthenticatedSession("inventory", "edit");

        // Validate input
        if (!materialNumbers || materialNumbers.length === 0) {
            return {
                success: false,
                error: "No material numbers provided"
            };
        }

        // Enforce max 50 products limit (Requirement 4.4)
        if (materialNumbers.length > 50) {
            return {
                success: false,
                error: "Maximum 50 products allowed per batch"
            };
        }

        // Generate unique batch ID for tracking
        const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Track results for each product
        const results: Array<{
            materialNo: string;
            status: 'success' | 'failed' | 'cached';
            predictionId?: number;
            error?: string;
        }> = [];

        let successCount = 0;
        let failedCount = 0;
        let cachedCount = 0;

        // Process predictions sequentially with delay (Requirements 4.6, 4.7)
        for (let i = 0; i < materialNumbers.length; i++) {
            const materialNo = materialNumbers[i].trim();

            if (!materialNo) {
                results.push({
                    materialNo: materialNo || `Item ${i + 1}`,
                    status: 'failed',
                    error: 'Empty material number'
                });
                failedCount++;
                continue;
            }

            try {
                // Check cache first (Requirement 4.11)
                const existing = await db.select()
                    .from(aiInventoryPredictions)
                    .where(
                        and(
                            eq(aiInventoryPredictions.productCode, materialNo),
                            eq(aiInventoryPredictions.predictionType, predictionType)
                        )
                    )
                    .orderBy(desc(aiInventoryPredictions.createdAt))
                    .limit(1);

                if (existing.length > 0) {
                    const lastPred = existing[0];
                    const hoursSince = (new Date().getTime() - lastPred.createdAt.getTime()) / (1000 * 60 * 60);

                    // Use cached data if less than 24 hours old
                    if (hoursSince < 24) {
                        // Update batch ID for cached prediction
                        await db.update(aiInventoryPredictions)
                            .set({ batchId })
                            .where(eq(aiInventoryPredictions.id, lastPred.id));

                        results.push({
                            materialNo,
                            status: 'cached',
                            predictionId: lastPred.id
                        });
                        cachedCount++;

                        // Add delay before next iteration (Requirement 4.6)
                        if (i < materialNumbers.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                        continue;
                    }
                }

                // Generate new prediction
                const predictionResult = await generateMLPrediction(materialNo, predictionType);

                if (predictionResult.success && predictionResult.data) {
                    // Update batch ID for the new prediction
                    await db.update(aiInventoryPredictions)
                        .set({ batchId })
                        .where(eq(aiInventoryPredictions.id, predictionResult.data.id));

                    results.push({
                        materialNo,
                        status: 'success',
                        predictionId: predictionResult.data.id
                    });
                    successCount++;
                } else {
                    // Prediction failed
                    results.push({
                        materialNo,
                        status: 'failed',
                        error: predictionResult.error || 'Unknown error'
                    });
                    failedCount++;
                }

            } catch (error) {
                // Handle individual product failure (Requirement 4.7)
                console.error(`Failed to process material ${materialNo}:`, error);
                results.push({
                    materialNo,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                failedCount++;
            }

            // Add 2-second delay between requests to avoid rate limiting (Requirement 4.6)
            if (i < materialNumbers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Revalidate the page to show new predictions (skip in test environment)
        try {
            revalidatePath("/dashboard/inventory-ai");
        } catch (error) {
            // Ignore revalidation errors in test environment
            console.log("Skipping revalidatePath in test environment");
        }

        // Return summary report (Requirement 4.8)
        return {
            success: true,
            batchId,
            summary: {
                total: materialNumbers.length,
                successful: successCount,
                failed: failedCount,
                cached: cachedCount
            },
            results
        };

    } catch (error) {
        console.error("Failed to process bulk predictions:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to process bulk predictions"
        };
    }
}

/**
 * Export predictions to Excel with separate sheets for each prediction type
 * Includes columns: Material Number, Product Name, Current Stock, Recommended Stock, Rationale, Prediction Date, Accuracy
 * Supports filtering by date range, product category, and other criteria
 * Requirements: 5.3, 5.4, 5.8
 */
export async function exportToExcel(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    predictionType?: 'REPLENISHMENT' | 'SAFETY_STOCK' | 'CUSTOMER_RECOMMENDATION' | 'ALL';
    productCategory?: string;
    minAccuracy?: number;
    maxAccuracy?: number;
}) {
    try {
        await getAuthenticatedSession("inventory", "view");

        // Import xlsx dynamically to avoid issues with server-side rendering
        const XLSX = await import('xlsx');

        // Build query conditions based on filters
        const conditions = [];

        if (filters?.dateFrom) {
            conditions.push(sql`${aiInventoryPredictions.createdAt} >= ${filters.dateFrom}`);
        }

        if (filters?.dateTo) {
            conditions.push(sql`${aiInventoryPredictions.createdAt} <= ${filters.dateTo}`);
        }

        if (filters?.predictionType && filters.predictionType !== 'ALL') {
            conditions.push(eq(aiInventoryPredictions.predictionType, filters.predictionType));
        }

        if (filters?.minAccuracy !== undefined) {
            conditions.push(sql`${aiInventoryPredictions.accuracyPercentage} >= ${filters.minAccuracy}`);
        }

        if (filters?.maxAccuracy !== undefined) {
            conditions.push(sql`${aiInventoryPredictions.accuracyPercentage} <= ${filters.maxAccuracy}`);
        }

        // Query predictions with filters applied
        const query = db.select({
            id: aiInventoryPredictions.id,
            materialNumber: aiInventoryPredictions.productCode,
            productName: aiInventoryPredictions.productName,
            predictionType: aiInventoryPredictions.predictionType,
            currentStock: aiInventoryPredictions.currentStock,
            recommendedStock: aiInventoryPredictions.recommendedStock,
            rationale: aiInventoryPredictions.rationale,
            predictionDate: aiInventoryPredictions.createdAt,
            accuracy: aiInventoryPredictions.accuracyPercentage,
            batchId: aiInventoryPredictions.batchId
        })
            .from(aiInventoryPredictions)
            .orderBy(desc(aiInventoryPredictions.createdAt));

        const predictions = conditions.length > 0
            ? await query.where(and(...conditions))
            : await query;

        if (predictions.length === 0) {
            return {
                success: false,
                error: "No predictions found matching the filters"
            };
        }

        // Group predictions by type
        const replenishmentData = predictions.filter(p => p.predictionType === 'REPLENISHMENT');
        const safetyStockData = predictions.filter(p => p.predictionType === 'SAFETY_STOCK');
        const customerRecommendationData = predictions.filter(p => p.predictionType === 'CUSTOMER_RECOMMENDATION');

        // Helper function to format data for Excel
        const formatDataForExcel = (data: typeof predictions) => {
            return data.map(item => ({
                'Material Number': item.materialNumber,
                'Product Name': item.productName || 'N/A',
                'Current Stock': item.currentStock !== null ? item.currentStock : 'N/A',
                'Recommended Stock': item.recommendedStock,
                'Rationale': item.rationale,
                'Prediction Date': item.predictionDate.toISOString().split('T')[0],
                'Accuracy (%)': item.accuracy !== null ? Number(item.accuracy).toFixed(2) : 'N/A',
                'Batch ID': item.batchId || 'N/A'
            }));
        };

        // Create workbook
        const workbook = XLSX.utils.book_new();

        // Add sheets for each prediction type (Requirement 5.3)
        if (replenishmentData.length > 0) {
            const replenishmentSheet = XLSX.utils.json_to_sheet(formatDataForExcel(replenishmentData));

            // Set column widths for better readability
            replenishmentSheet['!cols'] = [
                { wch: 15 }, // Material Number
                { wch: 30 }, // Product Name
                { wch: 15 }, // Current Stock
                { wch: 18 }, // Recommended Stock
                { wch: 50 }, // Rationale
                { wch: 15 }, // Prediction Date
                { wch: 12 }, // Accuracy
                { wch: 20 }  // Batch ID
            ];

            XLSX.utils.book_append_sheet(workbook, replenishmentSheet, 'Predictive Replenishment');
        }

        if (safetyStockData.length > 0) {
            const safetyStockSheet = XLSX.utils.json_to_sheet(formatDataForExcel(safetyStockData));

            safetyStockSheet['!cols'] = [
                { wch: 15 },
                { wch: 30 },
                { wch: 15 },
                { wch: 18 },
                { wch: 50 },
                { wch: 15 },
                { wch: 12 },
                { wch: 20 }
            ];

            XLSX.utils.book_append_sheet(workbook, safetyStockSheet, 'Dynamic Safety Stock');
        }

        if (customerRecommendationData.length > 0) {
            const customerSheet = XLSX.utils.json_to_sheet(formatDataForExcel(customerRecommendationData));

            customerSheet['!cols'] = [
                { wch: 15 },
                { wch: 30 },
                { wch: 15 },
                { wch: 18 },
                { wch: 50 },
                { wch: 15 },
                { wch: 12 },
                { wch: 20 }
            ];

            XLSX.utils.book_append_sheet(workbook, customerSheet, 'Customer Recommendations');
        }

        // Add summary sheet
        const summaryData = [
            { 'Metric': 'Total Predictions', 'Value': predictions.length },
            { 'Metric': 'Predictive Replenishment', 'Value': replenishmentData.length },
            { 'Metric': 'Dynamic Safety Stock', 'Value': safetyStockData.length },
            { 'Metric': 'Customer Recommendations', 'Value': customerRecommendationData.length },
            { 'Metric': 'Export Date', 'Value': new Date().toISOString().split('T')[0] },
            {
                'Metric': 'Date Range', 'Value': filters?.dateFrom && filters?.dateTo
                    ? `${filters.dateFrom.toISOString().split('T')[0]} to ${filters.dateTo.toISOString().split('T')[0]}`
                    : 'All dates'
            }
        ];

        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        summarySheet['!cols'] = [{ wch: 30 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary', true); // Insert at beginning

        // Generate Excel file buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Convert buffer to base64 for transmission
        const base64 = Buffer.from(excelBuffer).toString('base64');

        // Generate filename with timestamp (Requirement 5.10)
        const timestamp = new Date().toISOString().split('T')[0];
        const typeLabel = filters?.predictionType && filters.predictionType !== 'ALL'
            ? filters.predictionType
            : 'All';
        const filename = `AI_Forecast_${typeLabel}_${timestamp}.xlsx`;

        return {
            success: true,
            data: {
                buffer: base64,
                filename,
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        };

    } catch (error) {
        console.error("Failed to export to Excel:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to export to Excel"
        };
    }
}

/**
 * Update ML settings in database
 * Requirements: 9.8, 9.9
 */
export async function updateMLSettings(settings: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    cacheDuration?: number;
    thinkingMode?: boolean;
}, _updatedBy: string) {
    try {
        // Check admin/inventory_manager role (Requirement 9.2)
        const _session = await getAuthenticatedSession("inventory", "edit");

        // Additional role check for admin or inventory_manager
        // This assumes the session has a role property
        // Adjust based on your actual RBAC implementation

        const updates: Array<{ key: string; value: string }> = [];

        if (settings.model !== undefined) {
            // Validate model selection (Requirement 9.3)
            const validModels = ['qwen/qwen3-32b', 'llama-3.3-70b-versatile', 'mixtral-8x7b'];
            if (!validModels.includes(settings.model)) {
                return {
                    success: false,
                    error: `Invalid model. Must be one of: ${validModels.join(', ')}`
                };
            }
            updates.push({ key: 'ai_model', value: settings.model });
        }

        if (settings.temperature !== undefined) {
            // Validate temperature range (Requirement 9.4)
            if (settings.temperature < 0 || settings.temperature > 1) {
                return {
                    success: false,
                    error: 'Temperature must be between 0.0 and 1.0'
                };
            }
            updates.push({ key: 'ai_temperature', value: String(settings.temperature) });
        }

        if (settings.maxTokens !== undefined) {
            // Validate max_tokens range (Requirement 9.5)
            if (settings.maxTokens < 1000 || settings.maxTokens > 8192) {
                return {
                    success: false,
                    error: 'Max tokens must be between 1000 and 8192'
                };
            }
            updates.push({ key: 'ai_max_tokens', value: String(settings.maxTokens) });
        }

        if (settings.cacheDuration !== undefined) {
            // Validate cache duration (Requirement 9.6)
            const validDurations = [12, 24, 48];
            if (!validDurations.includes(settings.cacheDuration)) {
                return {
                    success: false,
                    error: 'Cache duration must be 12, 24, or 48 hours'
                };
            }
            updates.push({ key: 'ai_cache_duration', value: String(settings.cacheDuration) });
        }

        if (settings.thinkingMode !== undefined) {
            // Update thinking mode (Requirement 9.7)
            updates.push({ key: 'ai_thinking_mode', value: String(settings.thinkingMode) });
        }

        // Update settings in database
        for (const update of updates) {
            await db.update(aiSettings)
                .set({
                    settingValue: update.value,
                    updatedAt: new Date(),
                    updatedBy: _updatedBy
                })
                .where(eq(aiSettings.settingKey, update.key));
        }

        revalidatePath("/dashboard/inventory-ai/settings");

        return {
            success: true,
            message: `Updated ${updates.length} setting(s)`
        };

    } catch (error) {
        console.error("Failed to update AI settings:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update AI settings"
        };
    }
}

/**
 * Test ML settings with sample data
 * Requirements: 9.10
 */
export async function testMLSettings(testSettings: {
    model: string;
    temperature: number;
    maxTokens: number;
}) {
    try {
        await getAuthenticatedSession("inventory", "edit");

        // Use a simple test prompt
        const testPrompt = `Anda adalah AI Analis Inventory. Berikan rekomendasi singkat untuk produk test.

Format Response Anda HARUS valid JSON saja:
{
  "recommendedStock": 100,
  "rationale": "Ini adalah test response."
}`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: testSettings.model,
                messages: [
                    { role: "system", content: "Respond with ONLY a JSON object: {\"recommendedStock\": number, \"rationale\": \"string\"}. No other text." },
                    { role: "user", content: testPrompt }
                ],
                temperature: testSettings.temperature,
                max_tokens: testSettings.maxTokens
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error (${response.status}): ${errorText}`);
        }

        const jsonResponse = await response.json();
        const content = jsonResponse.choices[0]?.message?.content || "";

        // Try to parse the response
        let jsonStr = content;
        const thinkEndTag = "</think>";
        const thinkEndIdx = jsonStr.lastIndexOf(thinkEndTag);
        if (thinkEndIdx !== -1) jsonStr = jsonStr.substring(thinkEndIdx + thinkEndTag.length).trim();
        jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
        const openBrace = jsonStr.indexOf('{');
        const closeBrace = jsonStr.lastIndexOf('}');
        if (openBrace !== -1 && closeBrace > openBrace) jsonStr = jsonStr.substring(openBrace, closeBrace + 1);

        const parsedResult = JSON.parse(jsonStr);

        return {
            success: true,
            data: {
                response: parsedResult,
                rawContent: content.substring(0, 500) // Return first 500 chars for inspection
            }
        };

    } catch (error) {
        console.error("Failed to test AI settings:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to test AI settings"
        };
    }
}

/**
 * Reset ML settings to defaults
 * Requirements: 9.12
 */
export async function resetMLSettings(updatedBy: string) {
    try {
        await getAuthenticatedSession("inventory", "edit");

        const defaultSettings = [
            { key: 'ai_model', value: 'qwen/qwen3-32b' },
            { key: 'ai_temperature', value: '0.1' },
            { key: 'ai_max_tokens', value: '8192' },
            { key: 'ai_cache_duration', value: '24' },
            { key: 'ai_thinking_mode', value: 'false' }
        ];

        for (const setting of defaultSettings) {
            await db.update(aiSettings)
                .set({
                    settingValue: setting.value,
                    updatedAt: new Date(),
                    updatedBy
                })
                .where(eq(aiSettings.settingKey, setting.key));
        }

        revalidatePath("/dashboard/inventory-ai/settings");

        return {
            success: true,
            message: 'AI settings reset to defaults'
        };

    } catch (error) {
        console.error("Failed to reset AI settings:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to reset AI settings"
        };
    }
}

export const getAISettings = getMLSettings;
export const updateAISettings = updateMLSettings;
export const testAISettings = testMLSettings;
export const resetAISettings = resetMLSettings;

/**
 * Export predictions to PDF with company header and formatted tables
 * Includes summary statistics on first page and prediction details in table format
 * Supports filtering by date range, product category, and other criteria
 * Requirements: 5.5, 5.6, 5.7
 */
export async function exportToPDF(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    predictionType?: 'REPLENISHMENT' | 'SAFETY_STOCK' | 'CUSTOMER_RECOMMENDATION' | 'ALL';
    productCategory?: string;
    minAccuracy?: number;
    maxAccuracy?: number;
}) {
    try {
        await getAuthenticatedSession("inventory", "view");

        // Import jsPDF and jspdf-autotable dynamically
        const { default: jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        // Build query conditions based on filters
        const conditions = [];

        if (filters?.dateFrom) {
            conditions.push(sql`${aiInventoryPredictions.createdAt} >= ${filters.dateFrom}`);
        }

        if (filters?.dateTo) {
            conditions.push(sql`${aiInventoryPredictions.createdAt} <= ${filters.dateTo}`);
        }

        if (filters?.predictionType && filters.predictionType !== 'ALL') {
            conditions.push(eq(aiInventoryPredictions.predictionType, filters.predictionType));
        }

        if (filters?.minAccuracy !== undefined) {
            conditions.push(sql`${aiInventoryPredictions.accuracyPercentage} >= ${filters.minAccuracy}`);
        }

        if (filters?.maxAccuracy !== undefined) {
            conditions.push(sql`${aiInventoryPredictions.accuracyPercentage} <= ${filters.maxAccuracy}`);
        }

        // Query predictions with filters applied
        const query = db.select({
            id: aiInventoryPredictions.id,
            materialNumber: aiInventoryPredictions.productCode,
            productName: aiInventoryPredictions.productName,
            predictionType: aiInventoryPredictions.predictionType,
            currentStock: aiInventoryPredictions.currentStock,
            recommendedStock: aiInventoryPredictions.recommendedStock,
            rationale: aiInventoryPredictions.rationale,
            predictionDate: aiInventoryPredictions.createdAt,
            accuracy: aiInventoryPredictions.accuracyPercentage,
            batchId: aiInventoryPredictions.batchId
        })
            .from(aiInventoryPredictions)
            .orderBy(desc(aiInventoryPredictions.createdAt));

        const predictions = conditions.length > 0
            ? await query.where(and(...conditions))
            : await query;

        if (predictions.length === 0) {
            return {
                success: false,
                error: "No predictions found matching the filters"
            };
        }

        // Group predictions by type
        const replenishmentData = predictions.filter(p => p.predictionType === 'REPLENISHMENT');
        const safetyStockData = predictions.filter(p => p.predictionType === 'SAFETY_STOCK');
        const customerRecommendationData = predictions.filter(p => p.predictionType === 'CUSTOMER_RECOMMENDATION');

        // Calculate summary statistics
        const totalPredictions = predictions.length;
        const predictionsWithAccuracy = predictions.filter(p => p.accuracy !== null);
        const averageAccuracy = predictionsWithAccuracy.length > 0
            ? (predictionsWithAccuracy.reduce((sum, p) => sum + (p.accuracy || 0), 0) / predictionsWithAccuracy.length).toFixed(2)
            : 'N/A';

        // Create PDF document
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Add company header (Requirement 5.5)
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('PT Chitra Paratama', 15, 20);

        doc.setFontSize(16);
        doc.text('AI Inventory Forecast Report', 15, 30);

        // Add timestamp (Requirement 5.5)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const timestamp = new Date().toLocaleString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        doc.text(`Generated: ${timestamp}`, 15, 37);

        // Add summary statistics on first page (Requirement 5.6)
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary Statistics', 15, 50);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const summaryData = [
            ['Total Predictions', totalPredictions.toString()],
            ['Predictive Replenishment', replenishmentData.length.toString()],
            ['Dynamic Safety Stock', safetyStockData.length.toString()],
            ['Customer Recommendations', customerRecommendationData.length.toString()],
            ['Average Accuracy', averageAccuracy + '%'],
            ['Date Range', filters?.dateFrom && filters?.dateTo
                ? `${filters.dateFrom.toISOString().split('T')[0]} to ${filters.dateTo.toISOString().split('T')[0]}`
                : 'All dates']
        ];

        autoTable(doc, {
            startY: 55,
            head: [['Metric', 'Value']],
            body: summaryData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 80, fontStyle: 'bold' },
                1: { cellWidth: 60 }
            }
        });

        // Helper function to format prediction data for PDF table
        const formatDataForPDF = (data: typeof predictions, type: string) => {
            if (data.length === 0) return;

            // Add new page for prediction details
            doc.addPage();

            // Add section header
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            const typeLabel = type === 'REPLENISHMENT' ? 'Predictive Replenishment'
                : type === 'SAFETY_STOCK' ? 'Dynamic Safety Stock'
                    : 'Customer Recommendations';
            doc.text(typeLabel, 15, 20);

            // Prepare table data
            const tableData = data.map(item => [
                item.materialNumber,
                item.productName || 'N/A',
                item.currentStock !== null ? item.currentStock.toString() : 'N/A',
                item.recommendedStock.toString(),
                // Truncate rationale to fit in table
                item.rationale.length > 80 ? item.rationale.substring(0, 77) + '...' : item.rationale,
                item.predictionDate.toISOString().split('T')[0],
                item.accuracy !== null ? Number(item.accuracy).toFixed(2) + '%' : 'N/A'
            ]);

            // Add table with prediction details (Requirement 5.7)
            autoTable(doc, {
                startY: 25,
                head: [['Material No', 'Product Name', 'Current Stock', 'Recommended', 'Rationale', 'Date', 'Accuracy']],
                body: tableData,
                theme: 'striped',
                headStyles: {
                    fillColor: [41, 128, 185],
                    textColor: 255,
                    fontStyle: 'bold',
                    fontSize: 9
                },
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    overflow: 'linebreak'
                },
                columnStyles: {
                    0: { cellWidth: 25 },  // Material No
                    1: { cellWidth: 40 },  // Product Name
                    2: { cellWidth: 20 },  // Current Stock
                    3: { cellWidth: 25 },  // Recommended
                    4: { cellWidth: 80 },  // Rationale
                    5: { cellWidth: 22 },  // Date
                    6: { cellWidth: 18 }   // Accuracy
                },
                margin: { left: 15, right: 15 },
                didDrawPage: (_data) => {
                    // Add page numbers
                    const pageCount = doc.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.text(
                        `Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}`,
                        doc.internal.pageSize.width / 2,
                        doc.internal.pageSize.height - 10,
                        { align: 'center' }
                    );
                }
            });
        };

        // Add prediction details for each type (Requirement 5.7)
        if (replenishmentData.length > 0) {
            formatDataForPDF(replenishmentData, 'REPLENISHMENT');
        }

        if (safetyStockData.length > 0) {
            formatDataForPDF(safetyStockData, 'SAFETY_STOCK');
        }

        if (customerRecommendationData.length > 0) {
            formatDataForPDF(customerRecommendationData, 'CUSTOMER_RECOMMENDATION');
        }

        // Generate PDF as base64
        const pdfBuffer = doc.output('arraybuffer');
        const base64 = Buffer.from(pdfBuffer).toString('base64');

        // Generate filename with timestamp (Requirement 5.10)
        const dateStamp = new Date().toISOString().split('T')[0];
        const typeLabel = filters?.predictionType && filters.predictionType !== 'ALL'
            ? filters.predictionType
            : 'All';
        const filename = `AI_Forecast_${typeLabel}_${dateStamp}.pdf`;

        return {
            success: true,
            data: {
                buffer: base64,
                filename,
                mimeType: 'application/pdf'
            }
        };

    } catch (error) {
        console.error("Failed to export to PDF:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to export to PDF"
        };
    }
}

/**
 * Comparison data filters
 * Requirements: 7.6
 */
export interface ComparisonFilters {
    timePeriod?: 'monthly' | 'quarterly' | 'all'
    dateFrom?: Date
    dateTo?: Date
}

/**
 * Comparison data result
 * Requirements: 7.2, 7.3
 */
export interface ComparisonDataItem {
    predictionId: number
    productCode: string
    productName: string | null
    predictionType: string
    predictedStock: number
    actualSales: number
    variancePercentage: number
    predictionDate: Date
    currentStock: number | null
}

/**
 * Comparison summary statistics
 * Requirements: 7.7
 */
export interface ComparisonSummary {
    averageVariance: number
    totalOverPrediction: number
    totalUnderPrediction: number
    totalComparisons: number
}

/**
 * Get comparison data aggregation
 * Queries predictions with actual sales data and calculates variance
 * Requirements: 7.2, 7.3, 7.6, 7.7, 7.10
 */
export async function getComparisonData(filters?: ComparisonFilters) {
    try {
        await getAuthenticatedSession("inventory", "view");

        // Build WHERE conditions
        const conditions = [];

        // Only include predictions that have actual sales data (Requirement 7.2)
        conditions.push(sql`${aiInventoryPredictions.actualSales} IS NOT NULL`);

        // Time period filtering (Requirement 7.6)
        if (filters?.timePeriod && filters.timePeriod !== 'all') {
            const now = new Date();
            let startDate: Date;

            if (filters.timePeriod === 'monthly') {
                // Last month
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            } else if (filters.timePeriod === 'quarterly') {
                // Last quarter (3 months)
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            } else {
                startDate = new Date(0); // All time
            }

            conditions.push(gte(aiInventoryPredictions.createdAt, startDate));
        }

        // Custom date range filtering
        if (filters?.dateFrom) {
            conditions.push(gte(aiInventoryPredictions.createdAt, filters.dateFrom));
        }
        if (filters?.dateTo) {
            const endDate = new Date(filters.dateTo);
            endDate.setDate(endDate.getDate() + 1);
            conditions.push(lt(aiInventoryPredictions.createdAt, endDate));
        }

        // Query predictions with actual sales data (Requirement 7.2)
        const predictions = await db
            .select({
                predictionId: aiInventoryPredictions.id,
                productCode: aiInventoryPredictions.productCode,
                productName: aiInventoryPredictions.productName,
                predictionType: aiInventoryPredictions.predictionType,
                predictedStock: aiInventoryPredictions.recommendedStock,
                actualSales: aiInventoryPredictions.actualSales,
                predictionDate: aiInventoryPredictions.createdAt,
                currentStock: aiInventoryPredictions.currentStock,
            })
            .from(aiInventoryPredictions)
            .where(and(...conditions))
            .orderBy(desc(aiInventoryPredictions.createdAt));

        // Calculate variance percentage for each prediction (Requirement 7.3)
        // Formula: ((Predicted - Actual) / Actual * 100)
        const comparisonData: ComparisonDataItem[] = predictions.map(pred => {
            const actual = pred.actualSales || 0;
            const predicted = pred.predictedStock;

            // Calculate variance percentage
            let variancePercentage = 0;
            if (actual !== 0) {
                variancePercentage = ((predicted - actual) / actual) * 100;
            } else if (predicted > 0) {
                // If actual is 0 but predicted is not, variance is 100%
                variancePercentage = 100;
            }

            return {
                predictionId: pred.predictionId,
                productCode: pred.productCode,
                productName: pred.productName,
                predictionType: pred.predictionType,
                predictedStock: predicted,
                actualSales: actual,
                variancePercentage: Number(variancePercentage.toFixed(2)),
                predictionDate: pred.predictionDate,
                currentStock: pred.currentStock,
            };
        });

        // Calculate summary statistics (Requirement 7.7)
        const summary: ComparisonSummary = {
            averageVariance: 0,
            totalOverPrediction: 0,
            totalUnderPrediction: 0,
            totalComparisons: comparisonData.length,
        };

        if (comparisonData.length > 0) {
            // Calculate average variance (absolute value)
            const totalAbsVariance = comparisonData.reduce(
                (sum, item) => sum + Math.abs(item.variancePercentage),
                0
            );
            summary.averageVariance = Number((totalAbsVariance / comparisonData.length).toFixed(2));

            // Count over-predictions (predicted > actual, positive variance)
            summary.totalOverPrediction = comparisonData.filter(
                item => item.variancePercentage > 0
            ).length;

            // Count under-predictions (predicted < actual, negative variance)
            summary.totalUnderPrediction = comparisonData.filter(
                item => item.variancePercentage < 0
            ).length;
        }

        return {
            success: true,
            data: comparisonData,
            summary,
        };

    } catch (error) {
        console.error("Failed to fetch comparison data:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch comparison data"
        };
    }
}

/**
 * Update comparison data with latest sales data from SAP
 * This function should be called daily at 00:00 (Requirement 7.10)
 * Can be triggered by a cron job or scheduled task
 */
export async function updateComparisonData() {
    try {
        await getAuthenticatedSession("inventory", "edit");

        // Get all predictions that don't have actual sales data yet
        // or predictions from the last 90 days (to update recent data)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const predictions = await db
            .select({
                id: aiInventoryPredictions.id,
                productCode: aiInventoryPredictions.productCode,
                recommendedStock: aiInventoryPredictions.recommendedStock,
                createdAt: aiInventoryPredictions.createdAt,
                actualSales: aiInventoryPredictions.actualSales,
            })
            .from(aiInventoryPredictions)
            .where(
                and(
                    gte(aiInventoryPredictions.createdAt, ninetyDaysAgo),
                    or(
                        sql`${aiInventoryPredictions.actualSales} IS NULL`,
                        sql`${aiInventoryPredictions.accuracyPercentage} IS NULL`
                    )
                )
            );

        let updatedCount = 0;

        // Update each prediction with actual sales data
        for (const prediction of predictions) {
            // Calculate date range for actual sales
            // Look at sales data from prediction date to 30 days after
            const predictionDate = prediction.createdAt;
            const endDate = new Date(predictionDate);
            endDate.setDate(endDate.getDate() + 30);

            // Query actual sales from SAP for this product in the time period
            // Convert dates to string format for comparison with date column
            const predictionDateStr = predictionDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];

            const salesResult = await db
                .select({
                    totalQty: sql<number>`COALESCE(SUM(${salesRevenueSap.qty}), 0)`,
                })
                .from(salesRevenueSap)
                .where(
                    and(
                        eq(salesRevenueSap.materialNo, prediction.productCode),
                        sql`${salesRevenueSap.billingDate} >= ${predictionDateStr}::date`,
                        sql`${salesRevenueSap.billingDate} <= ${endDateStr}::date`
                    )
                );

            const actualSales = Number(salesResult[0]?.totalQty || 0);

            // Calculate accuracy percentage
            let accuracyPercentage: number | null = null;
            if (actualSales > 0) {
                const predicted = prediction.recommendedStock;
                const variance = Math.abs((predicted - actualSales) / actualSales * 100);
                accuracyPercentage = Math.max(0, 100 - variance);
            }

            // Update the prediction with actual sales and accuracy
            await db
                .update(aiInventoryPredictions)
                .set({
                    actualSales,
                    accuracyPercentage: accuracyPercentage !== null ? Number(accuracyPercentage.toFixed(2)) : null,
                })
                .where(eq(aiInventoryPredictions.id, prediction.id));

            updatedCount++;
        }

        return {
            success: true,
            message: `Updated ${updatedCount} predictions with actual sales data`,
            updatedCount,
        };

    } catch (error) {
        console.error("Failed to update comparison data:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update comparison data"
        };
    }
}

/**
 * Generate restock alerts for products with low stock
 * Requirements: 8.2, 8.6
 * 
 * Queries products where current stock < 20% of recommended stock
 * Categorizes urgency: Critical (<10%), High (10-20%), Medium (20-30%)
 * Saves notifications to database
 */
export async function generateRestockAlerts() {
    try {
        await getAuthenticatedSession("inventory", "view");

        // Get recent predictions (last 30 days) with current stock data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const predictions = await db
            .select({
                id: aiInventoryPredictions.id,
                productCode: aiInventoryPredictions.productCode,
                productName: aiInventoryPredictions.productName,
                currentStock: aiInventoryPredictions.currentStock,
                recommendedStock: aiInventoryPredictions.recommendedStock,
            })
            .from(aiInventoryPredictions)
            .where(
                and(
                    gte(aiInventoryPredictions.createdAt, thirtyDaysAgo),
                    sql`${aiInventoryPredictions.currentStock} IS NOT NULL`,
                    sql`${aiInventoryPredictions.recommendedStock} > 0`
                )
            );

        const alertsToCreate = [];

        // Process each prediction to determine if alert is needed
        for (const prediction of predictions) {
            const currentStock = prediction.currentStock || 0;
            const recommendedStock = prediction.recommendedStock;

            // Calculate stock percentage
            const stockPercentage = (currentStock / recommendedStock) * 100;

            // Determine urgency level based on stock percentage
            let urgencyLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | null = null;

            if (stockPercentage < 10) {
                urgencyLevel = 'CRITICAL'; // Critical: <10%
            } else if (stockPercentage < 20) {
                urgencyLevel = 'HIGH'; // High: 10-20%
            } else if (stockPercentage < 30) {
                urgencyLevel = 'MEDIUM'; // Medium: 20-30%
            }

            // Only create alert if urgency level is determined (stock < 30%)
            if (urgencyLevel) {
                alertsToCreate.push({
                    productCode: prediction.productCode,
                    productName: prediction.productName,
                    currentStock,
                    recommendedStock,
                    urgencyLevel,
                    predictionId: prediction.id,
                    isAcknowledged: 0,
                    createdAt: new Date(),
                });
            }
        }

        // Check for existing unacknowledged alerts for these products to avoid duplicates
        let existingProductCodes = new Set<string>();

        if (alertsToCreate.length > 0) {
            const productCodesToCheck = alertsToCreate.map(a => a.productCode);

            const existingAlerts = await db
                .select({
                    productCode: restockNotifications.productCode,
                })
                .from(restockNotifications)
                .where(
                    and(
                        eq(restockNotifications.isAcknowledged, 0),
                        inArray(restockNotifications.productCode, productCodesToCheck)
                    )
                );

            existingProductCodes = new Set(existingAlerts.map(a => a.productCode));
        }

        // Filter out products that already have unacknowledged alerts
        const newAlerts = alertsToCreate.filter(
            alert => !existingProductCodes.has(alert.productCode)
        );

        // Insert new alerts into database
        let createdCount = 0;
        if (newAlerts.length > 0) {
            await db.insert(restockNotifications).values(newAlerts);
            createdCount = newAlerts.length;
        }

        return {
            success: true,
            message: `Generated ${createdCount} new restock alerts`,
            createdCount,
            totalEvaluated: predictions.length,
            breakdown: {
                critical: newAlerts.filter(a => a.urgencyLevel === 'CRITICAL').length,
                high: newAlerts.filter(a => a.urgencyLevel === 'HIGH').length,
                medium: newAlerts.filter(a => a.urgencyLevel === 'MEDIUM').length,
            }
        };

    } catch (error) {
        console.error("Failed to generate restock alerts:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to generate restock alerts"
        };
    }
}

/**
 * Get active restock notifications
 * Requirements: 8.3, 8.4, 8.7
 * 
 * Returns list of notifications sorted by urgency level
 */
export async function getRestockNotifications() {
    try {
        await getAuthenticatedSession("inventory", "view");

        // Get all unacknowledged notifications
        const notifications = await db
            .select()
            .from(restockNotifications)
            .where(eq(restockNotifications.isAcknowledged, 0))
            .orderBy(
                // Sort by urgency: CRITICAL first, then HIGH, then MEDIUM
                sql`CASE 
                    WHEN ${restockNotifications.urgencyLevel} = 'CRITICAL' THEN 1
                    WHEN ${restockNotifications.urgencyLevel} = 'HIGH' THEN 2
                    WHEN ${restockNotifications.urgencyLevel} = 'MEDIUM' THEN 3
                    ELSE 4
                END`,
                desc(restockNotifications.createdAt)
            );

        // Get count by urgency level
        const countByUrgency = {
            critical: notifications.filter(n => n.urgencyLevel === 'CRITICAL').length,
            high: notifications.filter(n => n.urgencyLevel === 'HIGH').length,
            medium: notifications.filter(n => n.urgencyLevel === 'MEDIUM').length,
        };

        return {
            success: true,
            data: notifications,
            totalCount: notifications.length,
            countByUrgency
        };

    } catch (error) {
        console.error("Failed to fetch restock notifications:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch notifications"
        };
    }
}

/**
 * Mark a notification as acknowledged
 * Requirements: 8.9, 8.10
 * 
 * Updates notification status and records acknowledgment timestamp
 */
export async function acknowledgeNotification(notificationId: number) {
    try {
        await getAuthenticatedSession("inventory", "edit");

        await db
            .update(restockNotifications)
            .set({
                isAcknowledged: 1,
                acknowledgedAt: new Date()
            })
            .where(eq(restockNotifications.id, notificationId));

        revalidatePath("/dashboard/inventory-ai");

        return {
            success: true,
            message: "Notification acknowledged successfully"
        };

    } catch (error) {
        console.error("Failed to acknowledge notification:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to acknowledge notification"
        };
    }
}

/**
 * Get notification count for badge display
 * Requirements: 8.3
 */
export async function getNotificationCount() {
    try {
        await getAuthenticatedSession("inventory", "view");

        const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(restockNotifications)
            .where(eq(restockNotifications.isAcknowledged, 0));

        return {
            success: true,
            count: Number(result[0]?.count || 0)
        };

    } catch (error) {
        console.error("Failed to get notification count:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to get notification count",
            count: 0
        };
    }
}

/**
 * Get notification history (acknowledged notifications)
 * Requirements: 8.10
 * 
 * Returns list of acknowledged notifications for audit trail
 */
export async function getNotificationHistory(limit: number = 50) {
    try {
        await getAuthenticatedSession("inventory", "view");

        // Get acknowledged notifications ordered by acknowledgment date
        const notifications = await db
            .select()
            .from(restockNotifications)
            .where(eq(restockNotifications.isAcknowledged, 1))
            .orderBy(desc(restockNotifications.acknowledgedAt))
            .limit(limit);

        return {
            success: true,
            data: notifications,
            totalCount: notifications.length
        };

    } catch (error) {
        console.error("Failed to fetch notification history:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch notification history"
        };
    }
}
