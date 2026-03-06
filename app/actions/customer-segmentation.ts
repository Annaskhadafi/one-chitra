"use server"

import { db } from "@/db"
import { salesRevenueSap as historyOrders } from "@/db/schema/sap"
import { desc, notIlike, isNull, or, sql, and } from "drizzle-orm"

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
                or(
                    isNull(historyOrders.customerName),
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
                or(
                    isNull(historyOrders.customerName),
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
                    or(
                        isNull(historyOrders.customerName),
                        notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%')
                    ),
                    sql`${historyOrders.billingDate} BETWEEN ${start} AND ${end}`
                )
            )
            .groupBy(historyOrders.customerName, globalFirstPurchaseQuery.global_first_purchase);

        const formattedData: CustomerRFMAggregate[] = data.map((item) => ({
            customer_name: item.customer_name || 'Unknown',
            last_date: item.last_date ? new Date(item.last_date).toISOString() : '',
            frequency: item.frequency || 0,
            monetary: item.monetary || 0,
            global_first_purchase: item.global_first_purchase ? new Date(item.global_first_purchase).toISOString() : ''
        }));

        return { success: true, data: formattedData };
    } catch (error) {
        console.error("Failed to fetch history order for segmentation:", error);
        return { success: false, error: "Failed to fetch history order" };
    }
}
