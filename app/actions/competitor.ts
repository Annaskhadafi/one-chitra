"use server"


import Papa from "papaparse"

export interface CompetitorItem {
    timestamp: string;
    customer: string;
    size_tire: string;
    brand: string;
    category_tire: string;
    supplier: string;
    currency: string;
    price: string;
    remark: string;
    tanggal_informasi: string;
    business_consultant: string;
    price_formatted: string;
}

export async function getCompetitorInfo() {
    try {
        const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vTFCYrDPugIyxFQMQaUS2e11OY8NIGSOqd-jz5jznHSMGORjl0SSFEFNA2p0Iw_r8FHz3PGJ78IncXk/pub?gid=1444121083&single=true&output=csv", {
            cache: "no-store"
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
        const formattedData: CompetitorItem[] = data.map((item: Record<string, unknown>) => ({
            timestamp: item['Timestamp'] || '',
            customer: item['Nama Customer'] || '',
            size_tire: item['Size Tire'] || '',
            brand: item['Brand'] || '',
            category_tire: item['Category Tire'] || '',
            supplier: item['Supplier'] || '',
            currency: item['Currency'] || '',
            price: item['Price'] || '',
            remark: item['Remark / Delivery Drop Point'] || '',
            tanggal_informasi: item['Tanggal Informasi'] || '',
            business_consultant: item['Business Consultant'] || '',
            price_formatted: formatPrice(item['Price'], item['Currency'])
        }));

        return { success: true, data: formattedData };
    } catch (error) {
        console.error("Failed to fetch competitor info:", error);
        return { success: false, error: "Failed to fetch competitor info" };
    }
}

function formatPrice(priceStr: string, currency: string): string {
    if (!priceStr) return "";

    // Remove dots and handle potential decimals if any (though CSV seems to use dots for thousands)
    // Assuming dots are purely thousands separators based on the data seen
    const numericValue = parseFloat(priceStr.replace(/\./g, "").replace(/,/g, "."));

    if (isNaN(numericValue)) return priceStr;

    if (currency?.trim().toUpperCase() === "USD") {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(numericValue);
    }

    // Default to IDR
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(numericValue);
}
