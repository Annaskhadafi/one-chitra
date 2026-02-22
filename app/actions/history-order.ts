"use server"

import { db } from "@/db"
import { historyOrders } from "@/db/schema/history-orders"
import { desc, notIlike, isNull, or, and, eq, gte } from "drizzle-orm"
import { getSetting } from "./settings"

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

export async function getHistoryOrder() {
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
        console.error("Failed to fetch history order:", error);
        return { success: false, error: "Failed to fetch history order" };
    }
}

export async function importHistoryOrderBatch(batchData: Record<string, unknown>[]) {
    try {
        if (!batchData || batchData.length === 0) {
            return { success: false, error: "No data provided" };
        }

        const parseNumber = (val: string | undefined | null) => {
            if (!val) return null;
            const cleanStr = String(val).replace(/\./g, "").replace(/,/g, ".");
            const parsed = parseFloat(cleanStr);
            return isNaN(parsed) ? null : parsed;
        };

        const mappedBatch = batchData.map(item => ({
            sorg: (item['Sorg.'] as string) || null,
            billTy: (item['BillTy'] as string) || null,
            revType: (item['Rev. Type'] as string) || null,
            customer: (item['Customer'] as string) || null,
            customerName: (item['Customer Name'] as string) || null,
            salesman: (item['Salesman'] as string) || null,
            item: (item['Item'] as string) || null,
            sloc: (item['Sloc'] as string) || null,
            plant: (item['Plant'] as string) || null,
            materialNo: (item['Material No'] as string) || null,
            materialDescription: (item['Material Description'] as string) || null,
            sizeDimen: (item['Size/Dimen'] as string) || null,
            materialGroup: (item['Material Group'] as string) || null,
            matGrpDesc: (item['Mat Grp Desc.'] as string) || null,
            matGrp1: (item['Mat Grp1'] as string) || null,
            matGrp1Desc: (item['Mat Grp1 Desc.'] as string) || null,
            matGrp2: (item['Mat Grp2'] as string) || null,
            matGrp2Desc: (item['Mat Grp2 Desc.'] as string) || null,
            matGrp3: (item['Mat Grp3'] as string) || null,
            matGrp3Desc: (item['Mat Grp3 Desc.'] as string) || null,
            matGrp4: (item['Mat Grp4'] as string) || null,
            matGrp4Desc: (item['Mat Grp4 Desc.'] as string) || null,
            matGrp5: (item['Mat Grp5'] as string) || null,
            matGrp5Desc: (item['Mat Grp5 Desc.'] as string) || null,
            qty: parseNumber(item['Qty'] as string),
            uom: (item['UOM'] as string) || null,
            curr: (item['Curr'] as string) || null,
            basePrice: parseNumber(item['Base Price'] as string),
            intdeptPrice: parseNumber(item['Intdept Price'] as string),
            adjustmentPrice: parseNumber(item['Adjustment Price'] as string),
            revenueInDocCurr: parseNumber(item['Revenue in Doc Curr.'] as string),
            revenueInLocCurr: parseNumber(item['Revenue in Loc Curr.'] as string),
            billingNo: (item['Billing No'] as string) || null,
            billingDate: (item['Billing Date'] as string) || (item['BillingDate'] as string) || null,
            inco1: (item['INCO1'] as string) || null,
            inco2: (item['INCO2'] as string) || null,
            c: (item['C'] as string) || null,
            cancelled: (item['Cancelled'] as string) || null,
            deliveryNo: (item['Delivery No'] as string) || null,
            salesOrder: (item['Sales Order'] as string) || null,
            workOrder: (item['Work Order'] as string) || null,
            poNo: (item['PO No.'] as string) || null,
            poDate: (item['PO Date'] as string) || null,
            poType: (item['PO Type'] as string) || null,
            costOfSales: parseNumber(item['Cost Of Sales'] as string),
            profitMargin: parseNumber(item['Profit Margin'] as string)
        }));

        await db.insert(historyOrders).values(mappedBatch);
        return { success: true, count: mappedBatch.length };
    } catch (error) {
        console.error("Failed to import history orders batch:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to import duplicate or invalid rows" };
    }
}

export async function getProductHistoryForQuotation(materialNo: string, costSap: number) {
    try {
        const rateStr = await getSetting("manual_usd_rate")
        const exchangeRate = rateStr ? Number(rateStr) : 1
        const minPrice = costSap * exchangeRate

        const threeYearsAgo = new Date()
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)

        // Fetch all history for this material
        const data = await db.select()
            .from(historyOrders)
            .where(eq(historyOrders.materialNo, materialNo));

        // Filter and sort in JS because of string dates and complex multi-column sorting
        const processedData = data
            .map(item => {
                const revenue = item.revenueInDocCurr || 0;
                const qty = item.qty || 1;
                const unitPrice = revenue / (qty || 1);

                return {
                    customerName: item.customerName || 'Unknown',
                    unitPrice: unitPrice,
                    billingDate: item.billingDate || '',
                    poNo: item.poNo || '',
                };
            })
            .filter(item => {
                // Threshold check: unitPrice >= costSap * exchangeRate
                if (item.unitPrice < minPrice) return false;

                if (!item.billingDate) return false;
                // Support both MM/DD/YYYY and YYYY-MM-DD
                const itemDate = new Date(item.billingDate);
                return !isNaN(itemDate.getTime()) && itemDate >= threeYearsAgo;
            });

        // Pick only one (latest) reference per unique customer
        const customerMap = new Map<string, typeof processedData[0]>();

        processedData.forEach(item => {
            const existing = customerMap.get(item.customerName);
            if (!existing) {
                customerMap.set(item.customerName, item);
            } else {
                const existingDate = new Date(existing.billingDate).getTime();
                const currentDate = new Date(item.billingDate).getTime();

                // If this one is newer, OR it's the same date but higher price
                if (currentDate > existingDate || (currentDate === existingDate && item.unitPrice > existing.unitPrice)) {
                    customerMap.set(item.customerName, item);
                }
            }
        });

        const uniqueCustomerHistory = Array.from(customerMap.values());

        // Sort by billingDate DESC (latest), then unitPrice DESC (highest)
        uniqueCustomerHistory.sort((a, b) => {
            const dateA = new Date(a.billingDate).getTime();
            const dateB = new Date(b.billingDate).getTime();
            if (dateB !== dateA) return dateB - dateA;
            return b.unitPrice - a.unitPrice;
        });

        return { success: true, data: uniqueCustomerHistory.slice(0, 10) };
    } catch (error) {
        console.error("Failed to fetch product history for quotation:", error);
        return { success: false, error: "Failed to fetch product history" };
    }
}
