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

export async function importHistoryOrderBatch(batchData: any[]) {
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
            sorg: item['Sorg.'] || null,
            billTy: item['BillTy'] || null,
            revType: item['Rev. Type'] || null,
            customer: item['Customer'] || null,
            customerName: item['Customer Name'] || null,
            salesman: item['Salesman'] || null,
            item: item['Item'] || null,
            sloc: item['Sloc'] || null,
            plant: item['Plant'] || null,
            materialNo: item['Material No'] || null,
            materialDescription: item['Material Description'] || null,
            sizeDimen: item['Size/Dimen'] || null,
            materialGroup: item['Material Group'] || null,
            matGrpDesc: item['Mat Grp Desc.'] || null,
            matGrp1: item['Mat Grp1'] || null,
            matGrp1Desc: item['Mat Grp1 Desc.'] || null,
            matGrp2: item['Mat Grp2'] || null,
            matGrp2Desc: item['Mat Grp2 Desc.'] || null,
            matGrp3: item['Mat Grp3'] || null,
            matGrp3Desc: item['Mat Grp3 Desc.'] || null,
            matGrp4: item['Mat Grp4'] || null,
            matGrp4Desc: item['Mat Grp4 Desc.'] || null,
            matGrp5: item['Mat Grp5'] || null,
            matGrp5Desc: item['Mat Grp5 Desc.'] || null,
            qty: parseNumber(item['Qty']),
            uom: item['UOM'] || null,
            curr: item['Curr'] || null,
            basePrice: parseNumber(item['Base Price']),
            intdeptPrice: parseNumber(item['Intdept Price']),
            adjustmentPrice: parseNumber(item['Adjustment Price']),
            revenueInDocCurr: parseNumber(item['Revenue in Doc Curr.']),
            revenueInLocCurr: parseNumber(item['Revenue in Loc Curr.']),
            billingNo: item['Billing No'] || null,
            billingDate: item['Billing Date'] || item['BillingDate'] || null,
            inco1: item['INCO1'] || null,
            inco2: item['INCO2'] || null,
            c: item['C'] || null,
            cancelled: item['Cancelled'] || null,
            deliveryNo: item['Delivery No'] || null,
            salesOrder: item['Sales Order'] || null,
            workOrder: item['Work Order'] || null,
            poNo: item['PO No.'] || null,
            poDate: item['PO Date'] || null,
            poType: item['PO Type'] || null,
            costOfSales: parseNumber(item['Cost Of Sales']),
            profitMargin: parseNumber(item['Profit Margin'])
        }));

        await db.insert(historyOrders).values(mappedBatch);
        return { success: true, count: mappedBatch.length };
    } catch (error: any) {
        console.error("Failed to import history orders batch:", error);
        return { success: false, error: error.message || "Failed to import duplicate or invalid rows" };
    }
}
