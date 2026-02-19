"use server"

import Papa from "papaparse";

export interface CompetitorItem {
    Timestamp: string;
    "Nama Customer": string;
    "Size Tire": string;
    Brand: string;
    "Category Tire": string;
    Supplier: string;
    Currency: string;
    Price: string;
    "Remark / Delivery Drop Point": string;
    "Tanggal Informasi": string;
    "Business Consultant": string;
    PRICE: string;
    "Foto Kegiatan"?: string; // Optional as it wasn't in the list but might still be there or useful
    Status?: string; // Optional
}

export async function getCompetitorData() {
    const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?gid=1444121083&single=true&output=csv";

    try {
        const response = await fetch(CSV_URL, { cache: 'no-store' });
        const csvText = await response.text();

        const parsed = Papa.parse<CompetitorItem>(csvText, {
            header: true,
            skipEmptyLines: true,
        });

        return { success: true, data: parsed.data };
    } catch (error) {
        console.error("Failed to fetch competitor data:", error);
        return { success: false, error: "Failed to fetch competitor data" };
    }
}
