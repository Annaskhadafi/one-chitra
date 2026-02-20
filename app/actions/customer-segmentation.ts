"use server"

import { db } from "@/db"
import { historyOrders } from "@/db/schema/history-orders"
import { desc, notIlike, isNull, or } from "drizzle-orm"

export interface HistoryOrderItem {
    customer_name: string;
    material_no: string;
    description: string;
    qty: number;
    revenue: number;
    revenue_formatted: string;
    billing_date: string;
    plant: string;
    po_number: string;
    po_date: string;
    mat_grp_desc: string;
    salesman: string;
}

export async function getHistoryOrderForSegmentation() {
    try {
        // Exclude Singapore Branch per request
        const data = await db.select()
            .from(historyOrders)
            .where(
                or(
                    isNull(historyOrders.customerName),
                    notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%')
                )
            )
            .orderBy(desc(historyOrders.billingDate));

        // Map database records to our interface keys
        const formattedData: HistoryOrderItem[] = data.map((item) => {
            const revenue = item.revenueInDocCurr || 0;

            const revenueFormatted = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(revenue);

            return {
                customer_name: item.customerName || '',
                material_no: item.materialNo || '',
                description: item.materialDescription || '',
                qty: item.qty || 0,
                revenue: revenue,
                revenue_formatted: revenueFormatted,
                billing_date: item.billingDate || '',
                plant: item.plant || '',
                po_number: item.poNo || '',
                po_date: item.poDate || '',
                mat_grp_desc: item.matGrpDesc || '',
                salesman: item.salesman || ''
            };
        });

        // Sort the data chronologically descending (newest first)
        formattedData.sort((a, b) => {
            const dateA = new Date(a.billing_date).getTime();
            const dateB = new Date(b.billing_date).getTime();

            if (isNaN(dateA) && isNaN(dateB)) return 0;
            if (isNaN(dateA)) return 1;
            if (isNaN(dateB)) return -1;

            return dateB - dateA;
        });

        return { success: true, data: formattedData };
    } catch (error) {
        console.error("Failed to fetch history order for segmentation:", error);
        return { success: false, error: "Failed to fetch history order" };
    }
}
