"use server"

import { db } from "@/db"
import { salesRevenueSap as historyOrders } from "@/db/schema/sap"
import { desc, notIlike, sql, and } from "drizzle-orm"

export interface CustomerRFMAggregate {
    customer_name: string;
    last_date: string;
    frequency: number;
    monetary: number;
    global_first_purchase: string;
}

export async function getMaxBillingDate() {
    try {
        const result = await db.select({
            max_date: sql<string>`MAX(${historyOrders.billingDate})`
        })
            .from(historyOrders)
            .where(
                and(
                    sql`${historyOrders.customerName} IS NOT NULL`,
                    notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%')
                )
            );

        if (result[0]?.max_date) {
            return { success: true, maxDate: new Date(result[0].max_date).toISOString().split('T')[0] };
        }
        return { success: false, maxDate: '2025-12-31' };
    } catch (error) {
        console.error("Failed to fetch max billing date:", error);
        return { success: false, maxDate: '2025-12-31' };
    }
}

export async function getHistoryOrderForSegmentation(startDate?: string, endDate?: string) {
    try {
        // Default range if not provided
        const start = startDate || '2025-01-01';
        const end = endDate || '2025-12-31';

        // 1. Dapatkan global first purchase per customer
        const globalFirstPurchaseQuery = db.select({
            customer_name: historyOrders.customerName,
            global_first_purchase: sql<string>`MIN(${historyOrders.billingDate})`.as('global_first_purchase')
        })
            .from(historyOrders)
            .where(
                and(
                    sql`${historyOrders.customerName} IS NOT NULL`,
                    notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%')
                )
            )
            .groupBy(historyOrders.customerName)
            .as('gf');

        // 2. Aggregate metrics dalam range terpilih
        const data = await db.select({
            customer_name: historyOrders.customerName,
            last_date: sql<string>`MAX(${historyOrders.billingDate})`,
            frequency: sql<number>`COUNT(*)::int`,
            monetary: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`,
            global_first_purchase: globalFirstPurchaseQuery.global_first_purchase
        })
            .from(historyOrders)
            .innerJoin(globalFirstPurchaseQuery, sql`${historyOrders.customerName} = ${globalFirstPurchaseQuery.customer_name}`)
            .where(
                and(
                    sql`${historyOrders.customerName} IS NOT NULL`,
                    notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%'),
                    sql`${historyOrders.billingDate} BETWEEN ${start} AND ${end}`
                )
            )
            .groupBy(historyOrders.customerName, globalFirstPurchaseQuery.global_first_purchase);

        const formattedData: CustomerRFMAggregate[] = data.map((item) => ({
            customer_name: item.customer_name || 'Unknown',
            last_date: item.last_date ? new Date(item.last_date).toISOString() : '',
            frequency: Number(item.frequency) || 0,
            monetary: Number(item.monetary) || 0,
            global_first_purchase: item.global_first_purchase ? new Date(item.global_first_purchase).toISOString() : ''
        }));

        return { success: true, data: formattedData };
    } catch (error) {
        console.error("Failed to fetch history order for segmentation:", error);
        return { success: false, error: "Failed to fetch history order" };
    }
}

export type OrderHistoryItem = {
    materialNo: string;
    materialDescription: string;
    category: string;
    revenue: number;
    lastPurchaseDate: string | null;
    totalQty: number;
}

export async function getCustomerOrderHistory(customerName: string) {
    try {
        // Clean name for better matching (remove PT/CV/TBK and special chars)
        let cleanName = customerName
            .replace(/\bpt\.?\s*/gi, '')
            .replace(/\bcv\.?\s*/gi, '')
            .replace(/\btbk\.?\s*/gi, '')
            .replace(/[.,\-_]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // If it gets too short, just use the original without punctuation
        if (cleanName.length < 3) cleanName = customerName.replace(/[.,\-_]/g, ' ').trim();

        const data = await db.select({
            materialNo: historyOrders.materialNo,
            materialDescription: historyOrders.materialDescription,
            category: historyOrders.matGrpDesc,
            revenue: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`,
            lastPurchaseDate: sql<string>`MAX(${historyOrders.billingDate})`,
            totalQty: sql<number>`SUM(COALESCE(${historyOrders.qty}, 0))`
        })
            .from(historyOrders)
            .where(sql`${historyOrders.customerName} ILIKE ${'%' + cleanName + '%'}`)
            .groupBy(
                historyOrders.materialNo,
                historyOrders.materialDescription,
                historyOrders.matGrpDesc
            );

        // Group by category and pick top 10
        const grouped: Record<string, OrderHistoryItem[]> = {};

        for (const item of data) {
            const cat = item.category || "Uncategorized";
            if (!grouped[cat]) grouped[cat] = [];

            grouped[cat].push({
                materialNo: item.materialNo || "",
                materialDescription: item.materialDescription || "",
                category: cat,
                revenue: Number(item.revenue || 0),
                lastPurchaseDate: item.lastPurchaseDate ? new Date(item.lastPurchaseDate).toISOString() : null,
                totalQty: Number(item.totalQty || 0)
            });
        }

        // Sort descending by lastPurchaseDate and take top 10
        for (const cat of Object.keys(grouped)) {
            grouped[cat].sort((a, b) => {
                const timeA = a.lastPurchaseDate ? new Date(a.lastPurchaseDate).getTime() : 0;
                const timeB = b.lastPurchaseDate ? new Date(b.lastPurchaseDate).getTime() : 0;
                return timeB - timeA; // Descending
            });
            grouped[cat] = grouped[cat].slice(0, 10);
        }

        return { success: true, data: grouped };
    } catch (error) {
        console.error("Failed to fetch order history for customer:", error);
        return { success: false, error: "Failed to fetch order history" };
    }
}

