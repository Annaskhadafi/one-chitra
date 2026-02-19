"use server"

import Papa from "papaparse";

export interface CompetitorItem {
    Timestamp: string;
    Sales: string;
    Customer: string;
    Brand: string;
    Pattern: string;
    Size: string;
    Price: string;
    "Foto Kegiatan": string;
    Status: string;
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
