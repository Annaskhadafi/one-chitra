"use server"

import { db } from "@/db"
import { customers } from "@/db/schema"
import { salesRevenueSap as historyOrders } from "@/db/schema/sap"
import { notIlike, sql, and, isNotNull } from "drizzle-orm"

export interface CustomerRFMAggregate {
    customer_name: string;
    last_date: string;
    frequency: number;
    monetary: number;
    global_first_purchase: string;
}

export interface MarketingSegmentOption {
    segment: string;
    description: string;
    totalCustomers: number;
    matchedRecipients: number;
}

export interface MarketingSegmentRecipient {
    email: string;
    name: string;
    company: string;
    position: string;
    segment: string;
}

export interface MarketingSegmentCustomerInsight {
    customerName: string;
    segment: string;
    recency: number;
    frequency: number;
    monetary: number;
    lastDate: string;
}

export interface CustomerMarketingInsight extends MarketingSegmentCustomerInsight {
    normalizedName: string;
}

export interface CustomerCampaignLaunchContext {
    customerName: string;
    segment: string | null;
    matchedEmail: string | null;
    matchedContactName: string | null;
    suggestedBrief: string;
}

const SEGMENT_DESCRIPTIONS: Record<string, string> = {
    Champions: "Pelanggan terbaik, aktif, sering belanja, dan nilai transaksinya tinggi.",
    "Loyal Customers": "Pelanggan setia yang rutin bertransaksi dan layak dijaga retensinya.",
    "New Customer": "Pelanggan baru yang mulai bertransaksi di periode analisis.",
    "Potential Loyalists": "Pelanggan yang menunjukkan potensi untuk menjadi pelanggan setia.",
    "Recent Customers": "Pelanggan yang baru bertransaksi dan perlu diarahkan ke repeat order.",
    "At Risk": "Pelanggan bernilai baik yang mulai lama tidak bertransaksi.",
    Hibernating: "Pelanggan lama dengan aktivitas rendah yang mulai tertidur.",
    Lost: "Pelanggan yang sangat lama tidak bertransaksi dan perlu reaktivasi khusus.",
    "Needs Attention": "Pelanggan menengah yang perlu disentuh agar tidak turun kualitasnya.",
}

const EXCLUDED_SEGMENTATION_CUSTOMERS = [
    "TRANSITYRE B.V",
]

function formatDateOnly(date: Date) {
    return date.toISOString().split("T")[0]
}

function subtractMonths(date: Date, months: number) {
    const next = new Date(date)
    next.setMonth(next.getMonth() - months)
    return next
}

function getSegmentationCustomerWhereClause() {
    return and(
        sql`${historyOrders.customerName} IS NOT NULL`,
        notIlike(historyOrders.customerName, "%Chitra Paratama Singapore Branch%"),
        ...EXCLUDED_SEGMENTATION_CUSTOMERS.map((customerName) => sql`UPPER(TRIM(${historyOrders.customerName})) <> ${customerName}`)
    )
}

function normalizeCustomerName(name: string) {
    return name
        .toLowerCase()
        .replace(/\bpt\.?\s*/gi, "")
        .replace(/\bcv\.?\s*/gi, "")
        .replace(/\btbk\.?\s*/gi, "")
        .replace(/[.,\-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function scoreValue(value: number, allValues: number[], reverse = false) {
    const sorted = [...new Set(allValues)].sort((a, b) => a - b);
    if (sorted.length === 0) return 1;
    const idx = sorted.findIndex((v) => v >= value);
    const score = Math.min(5, Math.max(1, Math.ceil(((idx + 1) / sorted.length) * 5)));
    return reverse ? 6 - score : score;
}

function deriveCustomerSegments(
    rawData: CustomerRFMAggregate[],
    startDate: string,
    endDate: string
) {
    if (rawData.length === 0) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);

    const baseList = rawData.map((item) => {
        const lastDate = new Date(item.last_date);
        return {
            customerName: item.customer_name,
            lastDate,
            frequency: item.frequency,
            monetary: item.monetary,
            globalFirstDate: new Date(item.global_first_purchase),
            recency: Math.max(0, Math.floor((end.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))),
        };
    });

    const recencies = baseList.map((item) => item.recency);
    const frequencies = baseList.map((item) => item.frequency);
    const monetaries = baseList.map((item) => item.monetary);

    return baseList.map((item) => {
        const r = scoreValue(item.recency, recencies, true);
        const f = scoreValue(item.frequency, frequencies);
        const m = scoreValue(item.monetary, monetaries);

        let segment = "Needs Attention";
        const isFirstInRange = item.globalFirstDate >= start && item.globalFirstDate <= end;

        if (isFirstInRange) segment = "New Customer";
        else if (r >= 4 && f >= 4 && m >= 4) segment = "Champions";
        else if (r >= 3 && f >= 3) segment = "Loyal Customers";
        else if (r >= 4 && f <= 2) segment = "Recent Customers";
        else if (r <= 2 && f >= 4) segment = "At Risk";
        else if (r <= 1) segment = "Lost";
        else if (r <= 2) segment = "Hibernating";
        else if (r >= 3 && m >= 3) segment = "Potential Loyalists";

        return {
            ...item,
            r,
            f,
            m,
            segment,
            normalizedName: normalizeCustomerName(item.customerName),
        };
    });
}

function findBestCustomerMatch(
    normalizedName: string,
    customerCandidates: Array<{
        id: number;
        name: string;
        email: string;
        contactName: string | null;
    }>
) {
    const exact = customerCandidates.find((candidate) => candidate.name === normalizedName);
    if (exact) return exact;

    const includes = customerCandidates.find(
        (candidate) =>
            candidate.name.includes(normalizedName) || normalizedName.includes(candidate.name)
    );

    return includes ?? null;
}

async function resolveSegmentationRange(startDate?: string, endDate?: string) {
    if (startDate && endDate) {
        return { start: startDate, end: endDate }
    }

    const result = await db.select({
        max_date: sql<string>`MAX(${historyOrders.billingDate})`
    })
        .from(historyOrders)
        .where(getSegmentationCustomerWhereClause())

    const latestBillingDate = result[0]?.max_date ? new Date(result[0].max_date) : new Date()
    const end = endDate || formatDateOnly(latestBillingDate)
    const rollingStartBase = subtractMonths(latestBillingDate, 11)
    rollingStartBase.setDate(1)
    const start = startDate || formatDateOnly(rollingStartBase)

    return { start, end }
}

export async function getMaxBillingDate() {
    try {
        const { end } = await resolveSegmentationRange()
        return { success: true as const, maxDate: end }
    } catch (error) {
        console.error("Failed to fetch max billing date:", error);
        return { success: false as const, maxDate: formatDateOnly(new Date()) };
    }
}

export async function getHistoryOrderForSegmentation(startDate?: string, endDate?: string) {
    try {
        const { start, end } = await resolveSegmentationRange(startDate, endDate)

        // 1. Dapatkan global first purchase per customer
        const globalFirstPurchaseQuery = db.select({
            customer_name: historyOrders.customerName,
            global_first_purchase: sql<string>`MIN(${historyOrders.billingDate})`.as('global_first_purchase')
        })
            .from(historyOrders)
            .where(getSegmentationCustomerWhereClause())
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
                    getSegmentationCustomerWhereClause(),
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

export async function getMarketingSegmentOptions(startDate?: string, endDate?: string) {
    try {
        const { start, end } = await resolveSegmentationRange(startDate, endDate)
        const segmentation = await getHistoryOrderForSegmentation(start, end);

        if (!segmentation.success || !segmentation.data) {
            return { success: false as const, error: "Failed to load segmentation data" };
        }

        const enriched = deriveCustomerSegments(segmentation.data, start, end);
        const customerRows = await db
            .select({
                id: customers.id,
                name: customers.name,
                email: customers.email,
                contactName: customers.contactName,
            })
            .from(customers)
            .where(isNotNull(customers.email));

        const candidateMap = customerRows
            .filter((row): row is typeof row & { email: string } => Boolean(row.email))
            .map((row) => ({
                id: row.id,
                name: normalizeCustomerName(row.name),
                email: row.email,
                contactName: row.contactName,
            }));

        const grouped = new Map<string, { totalCustomers: number; matchedRecipients: number }>();

        for (const item of enriched) {
            const existing = grouped.get(item.segment) || { totalCustomers: 0, matchedRecipients: 0 };
            existing.totalCustomers += 1;

            const match = findBestCustomerMatch(item.normalizedName, candidateMap);
            if (match) existing.matchedRecipients += 1;

            grouped.set(item.segment, existing);
        }

        const options: MarketingSegmentOption[] = Array.from(grouped.entries())
            .map(([segment, values]) => ({
                segment,
                description: SEGMENT_DESCRIPTIONS[segment] || "Segment customer hasil analisis perilaku transaksi.",
                totalCustomers: values.totalCustomers,
                matchedRecipients: values.matchedRecipients,
            }))
            .sort((a, b) => b.matchedRecipients - a.matchedRecipients || b.totalCustomers - a.totalCustomers);

        return { success: true as const, data: options };
    } catch (error) {
        console.error("Failed to build marketing segment options:", error);
        return { success: false as const, error: "Failed to build marketing segment options" };
    }
}

export async function getSegmentEmailRecipients(
    segmentNames: string[],
    startDate?: string,
    endDate?: string
) {
    try {
        if (segmentNames.length === 0) return { success: true as const, data: [] as MarketingSegmentRecipient[] };

        const { start, end } = await resolveSegmentationRange(startDate, endDate)
        const segmentation = await getHistoryOrderForSegmentation(start, end);

        if (!segmentation.success || !segmentation.data) {
            return { success: false as const, error: "Failed to load segmentation data" };
        }

        const enriched = deriveCustomerSegments(segmentation.data, start, end).filter((item) =>
            segmentNames.includes(item.segment)
        );

        const customerRows = await db
            .select({
                id: customers.id,
                name: customers.name,
                email: customers.email,
                contactName: customers.contactName,
            })
            .from(customers)
            .where(isNotNull(customers.email));

        const candidateMap = customerRows
            .filter((row): row is typeof row & { email: string } => Boolean(row.email))
            .map((row) => ({
                id: row.id,
                name: normalizeCustomerName(row.name),
                email: row.email,
                contactName: row.contactName,
            }));

        const recipients = new Map<string, MarketingSegmentRecipient>();

        for (const item of enriched) {
            const match = findBestCustomerMatch(item.normalizedName, candidateMap);
            if (!match) continue;

            if (!recipients.has(match.email.toLowerCase())) {
                recipients.set(match.email.toLowerCase(), {
                    email: match.email.toLowerCase(),
                    name: match.contactName || item.customerName,
                    company: item.customerName,
                    position: item.segment,
                    segment: item.segment,
                });
            }
        }

        return { success: true as const, data: Array.from(recipients.values()) };
    } catch (error) {
        console.error("Failed to resolve segment recipients:", error);
        return { success: false as const, error: "Failed to resolve segment recipients" };
    }
}

export async function getMarketingSegmentCustomerInsights(
    segmentNames?: string[],
    startDate?: string,
    endDate?: string,
    limit: number = 20
) {
    try {
        const { start, end } = await resolveSegmentationRange(startDate, endDate)
        const segmentation = await getHistoryOrderForSegmentation(start, end);

        if (!segmentation.success || !segmentation.data) {
            return { success: false as const, error: "Failed to load segmentation data" };
        }

        const selectedSegments = Array.isArray(segmentNames) && segmentNames.length > 0 ? segmentNames : null;
        const enriched = deriveCustomerSegments(segmentation.data, start, end)
            .filter((item) => !selectedSegments || selectedSegments.includes(item.segment))
            .sort((a, b) => b.monetary - a.monetary || b.frequency - a.frequency)
            .slice(0, Math.max(1, limit))
            .map<MarketingSegmentCustomerInsight>((item) => ({
                customerName: item.customerName,
                segment: item.segment,
                recency: item.recency,
                frequency: item.frequency,
                monetary: item.monetary,
                lastDate: item.lastDate.toISOString(),
            }));

        return { success: true as const, data: enriched };
    } catch (error) {
        console.error("Failed to build marketing segment customer insights:", error);
        return { success: false as const, error: "Failed to build marketing segment customer insights" };
    }
}

export async function getCustomerMarketingInsight(
    customerName: string,
    startDate?: string,
    endDate?: string
) {
    try {
        const safeName = String(customerName || "").trim();
        if (!safeName) {
            return { success: false as const, error: "Customer name is required" };
        }

        const { start, end } = await resolveSegmentationRange(startDate, endDate)
        const segmentation = await getHistoryOrderForSegmentation(start, end);

        if (!segmentation.success || !segmentation.data) {
            return { success: false as const, error: "Failed to load segmentation data" };
        }

        const normalizedSearchName = normalizeCustomerName(safeName);
        const enriched = deriveCustomerSegments(segmentation.data, start, end);
        const matched =
            enriched.find((item) => item.normalizedName === normalizedSearchName) ||
            enriched.find(
                (item) =>
                    item.normalizedName.includes(normalizedSearchName) ||
                    normalizedSearchName.includes(item.normalizedName)
            );

        if (!matched) {
            return { success: false as const, error: "Customer insight not found" };
        }

        const insight: CustomerMarketingInsight = {
            customerName: matched.customerName,
            segment: matched.segment,
            recency: matched.recency,
            frequency: matched.frequency,
            monetary: matched.monetary,
            lastDate: matched.lastDate.toISOString(),
            normalizedName: matched.normalizedName,
        };

        return { success: true as const, data: insight };
    } catch (error) {
        console.error("Failed to build customer marketing insight:", error);
        return { success: false as const, error: "Failed to build customer marketing insight" };
    }
}

export async function getCustomerCampaignLaunchContext(customerName: string, segment?: string | null) {
    try {
        const safeName = String(customerName || "").trim();
        if (!safeName) {
            return { success: false as const, error: "Customer name is required" };
        }

        const customerRows = await db
            .select({
                id: customers.id,
                name: customers.name,
                email: customers.email,
                contactName: customers.contactName,
            })
            .from(customers)
            .where(isNotNull(customers.email));

        const candidateMap = customerRows
            .filter((row): row is typeof row & { email: string } => Boolean(row.email))
            .map((row) => ({
                id: row.id,
                name: normalizeCustomerName(row.name),
                email: row.email,
                contactName: row.contactName,
            }));

        const match = findBestCustomerMatch(normalizeCustomerName(safeName), candidateMap);
        const suggestedBrief = segment
            ? `Siapkan campaign untuk customer ${safeName} yang berada di segmen ${segment}. Gunakan history order, kecocokan fleet, dan stok yang tersedia untuk menentukan produk dan pesan yang paling relevan.`
            : `Siapkan campaign untuk customer ${safeName}. Gunakan history order, kecocokan fleet, dan stok yang tersedia untuk menentukan produk dan pesan yang paling relevan.`;

        const data: CustomerCampaignLaunchContext = {
            customerName: safeName,
            segment: segment ?? null,
            matchedEmail: match?.email ?? null,
            matchedContactName: match?.contactName ?? null,
            suggestedBrief,
        };

        return { success: true as const, data };
    } catch (error) {
        console.error("Failed to build customer campaign launch context:", error);
        return { success: false as const, error: "Failed to build customer campaign launch context" };
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

