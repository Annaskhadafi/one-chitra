"use server"

import Papa from "papaparse"

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
    salesman: string;
}

export async function getHistoryOrder() {
    try {
        const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vT2fjeoEPzqBSU8PCBKLqaBDoxkeDqvKUQSfm0LY0tSkZUECvRePwBVlGZS-z7akbWpO_ipZDCJIj_r/pub?gid=327655631&single=true&output=csv", {
            cache: "no-store",
            next: { revalidate: 300 } // Cache for 5 minutes
        });

        const csvText = await response.text();

        const { data } = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => {
                return header.trim();
            }
        });

        // Map CSV headers to our interface keys
        const formattedData: HistoryOrderItem[] = data.map((item: any) => {
            // Parse Revenue: "163.794.218" -> 163794218
            const revenueStr = item['Revenue in Loc Curr.'] || '0';
            // Remove dots, modify comma to dot if needed (but here it seems purely number with dots as thousands)
            // The example "163.794.218" suggests IDR where dots are thousands separators.
            // If there are decimals like "12.172,57", we need to handle that.
            // Let's assume standard ID formatting: dot = thousand, comma = decimal

            let revenue = 0;
            if (revenueStr) {
                const cleanStr = revenueStr.replace(/\./g, "").replace(/,/g, ".");
                revenue = parseFloat(cleanStr);
            }

            const revenueFormatted = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(revenue);

            return {
                customer_name: item['Customer Name'] || '',
                material_no: item['Material No'] || '',
                description: item['Material Description'] || '',
                qty: parseInt(item['Qty'] || '0'),
                revenue: revenue,
                revenue_formatted: revenueFormatted,
                billing_date: item['BillingDate'] || '',
                plant: item['Plant'] || '',
                po_number: item['PO No.'] || '',
                po_date: item['PO Date'] || '',
                salesman: item['Salesman'] || ''
            };
        });

        return { success: true, data: formattedData };
    } catch (error) {
        console.error("Failed to fetch history order:", error);
        return { success: false, error: "Failed to fetch history order" };
    }
}
