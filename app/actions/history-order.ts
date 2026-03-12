"use server"

import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
import { desc, notIlike, isNull, isNotNull, or, and, eq, ne, gte, SQL, sql } from "drizzle-orm"
import { getSetting } from "./settings"

export interface HistoryOrderItem {
    customer_name: string;
    material_no: string;
    description: string;
    qty: number;
    revenue: number;
    revenue_formatted: string;
    billing_date: string;
    billing_no: string;
    plant: string;
    po_number: string;
    po_date: string;
    mat_grp_desc: string;
    salesman: string;
}

export interface HistoryOrderFilters {
    search?: string;
    customers?: string[];
    plants?: string[];
    matGrps?: string[];
    years?: string[];
    months?: string[];
    page?: number;
    pageSize?: number;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
}

export async function getHistoryOrderFilters() {
    try {
        const baseWhere = and(
            isNotNull(salesRevenueSap.billingDate),
            or(
                isNull(salesRevenueSap.customerName),
                and(
                    notIlike(salesRevenueSap.customerName, '%Chitra Paratama%'),
                    notIlike(salesRevenueSap.customerName, '%Transityre b.v%')
                )
            )
        );

        const [customers, plants, matGrps] = await Promise.all([
            db.selectDistinct({ name: salesRevenueSap.customerName }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.customerName),
            db.selectDistinct({ name: salesRevenueSap.plant }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.plant),
            db.selectDistinct({ name: salesRevenueSap.matGrpDesc }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.matGrpDesc),
        ]);

        // Get years and months from billingDate (Date type)
        const yearsQuery = await db.selectDistinct({
            year: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY')`
        }).from(salesRevenueSap).where(baseWhere);

        const monthsQuery = await db.selectDistinct({
            month: sql<string>`to_char(${salesRevenueSap.billingDate}, 'MM')`
        }).from(salesRevenueSap).where(baseWhere);

        return {
            success: true,
            data: {
                customers: customers.map(c => c.name).filter(Boolean),
                plants: plants.map(p => p.name).filter(Boolean),
                matGrps: matGrps.map(m => m.name).filter(Boolean),
                years: yearsQuery.map(y => y.year).sort().reverse(),
                months: monthsQuery.map(m => m.month).sort(),
            }
        };
    } catch (error) {
        console.error("Failed to fetch filter options:", error);
        return { success: false, error: "Failed to fetch filter options" };
    }
}


export async function getHistoryOrder(filters: HistoryOrderFilters = {}) {
    try {
        const {
            search = "",
            customers = [],
            plants = [],
            matGrps = [],
            years = [],
            months = [],
            page = 1,
            pageSize = 50,
            sortField = 'billing_date',
            sortOrder = 'desc'
        } = filters;

        const offset = (page - 1) * pageSize;

        // Filter logic
        const filterArray: SQL[] = [];

        const baseFilter = and(
            isNotNull(salesRevenueSap.billingDate),
            or(
                isNull(salesRevenueSap.customerName),
                and(
                    notIlike(salesRevenueSap.customerName, '%Chitra Paratama%'),
                    notIlike(salesRevenueSap.customerName, '%Transityre b.v%')
                )
            )
        );

        if (baseFilter) {
            filterArray.push(baseFilter);
        }

        if (search) {
            const searchFilter = or(
                sql`${salesRevenueSap.customerName} ILIKE ${`%${search}%`}`,
                sql`${salesRevenueSap.materialNo} ILIKE ${`%${search}%`}`,
                sql`${salesRevenueSap.materialDescription} ILIKE ${`%${search}%`}`,
                sql`${salesRevenueSap.poNo} ILIKE ${`%${search}%`}`,
                sql`${salesRevenueSap.salesman} ILIKE ${`%${search}%`}`
            );

            if (searchFilter) {
                filterArray.push(searchFilter);
            }
        }

        if (customers.length > 0) filterArray.push(sql`${salesRevenueSap.customerName} IN ${customers}`);
        if (plants.length > 0) filterArray.push(sql`${salesRevenueSap.plant} IN ${plants}`);
        if (matGrps.length > 0) filterArray.push(sql`${salesRevenueSap.matGrpDesc} IN ${matGrps}`);

        if (years.length > 0) {
            const yearFilter = or(...years.map(y => sql`to_char(${salesRevenueSap.billingDate}, 'YYYY') = ${y}`));
            if (yearFilter) {
                filterArray.push(yearFilter);
            }
        }

        if (months.length > 0) {
            const monthFilter = or(...months.map(m => sql`to_char(${salesRevenueSap.billingDate}, 'MM') = ${m.padStart(2, '0')}`));
            if (monthFilter) {
                filterArray.push(monthFilter);
            }
        }

        const finalWhere = and(...filterArray);

        // 1. Fetch Paginated Data
        const dataQuery = db.select().from(salesRevenueSap).where(finalWhere);

        // Handle logical sorting
        if (sortField === 'billing_date') {
            dataQuery.orderBy(
                sortOrder === 'desc'
                    ? desc(salesRevenueSap.billingDate)
                    : salesRevenueSap.billingDate
            );
        } else {
            dataQuery.orderBy(desc(salesRevenueSap.billingDate));
        }

        const data = await dataQuery.limit(pageSize).offset(offset);

        // 2. Fetch Aggregations (Scorecards)
        const aggregation = await db.select({
            totalRevenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`,
            totalQty: sql<number>`SUM(COALESCE(${salesRevenueSap.qty}, 0))`,
            uniqueCust: sql<number>`COUNT(DISTINCT ${salesRevenueSap.customerName})`,
            uniqueOrders: sql<number>`COUNT(DISTINCT ${salesRevenueSap.poNo})`,
            totalCount: sql<number>`COUNT(*)`
        })
            .from(salesRevenueSap)
            .where(finalWhere);

        const stats = aggregation[0] || { totalRevenue: 0, totalQty: 0, uniqueCust: 0, uniqueOrders: 0, totalCount: 0 };

        // 3. Fetch Chart Data (Top 10 Customers)
        const topCustomers = await db.select({
            name: salesRevenueSap.customerName,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(salesRevenueSap.customerName)
            .orderBy(sql`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0)) DESC`)
            .limit(10);

        // 4. Fetch Chart Data (Revenue by Plant)
        const plantStats = await db.select({
            name: salesRevenueSap.plant,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(salesRevenueSap.plant)
            .orderBy(sql`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0)) DESC`);

        // 5. Fetch Chart Data (Monthly Trend)
        const monthlyTrend = await db.select({
            name: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`)
            .orderBy(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY-MM')`);

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
                billing_no: item.billingNo || '',
                plant: item.plant || '',
                po_number: item.poNo || '',
                po_date: item.poDate || '',
                mat_grp_desc: item.matGrpDesc || '',
                salesman: item.salesman || ''
            };
        });

        return {
            success: true,
            data: formattedData,
            meta: {
                totalCount: Number(stats.totalCount),
                scorecards: {
                    totalRevenue: Number(stats.totalRevenue),
                    totalQty: Number(stats.totalQty),
                    uniqueCust: Number(stats.uniqueCust),
                    uniqueOrders: Number(stats.uniqueOrders)
                },
                charts: {
                    topCustomers: topCustomers.map(c => ({ name: c.name || "Unknown", value: Number(c.value) })),
                    plantStats: plantStats.map(p => ({ name: p.name || "Unknown", value: Number(p.value) })),
                    monthlyTrend: monthlyTrend.map(m => ({ name: m.name, value: Number(m.value) }))
                }
            }
        };
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

        const parseDate = (val: string | undefined | null) => {
            if (!val) return null;
            const dateStr = String(val).trim();
            // Try parsing MM/DD/YYYY
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    // Check if parts[2] is year (length 4)
                    if (parts[2].length === 4) {
                        const m = parseInt(parts[0]) - 1;
                        const d = parseInt(parts[1]);
                        const y = parseInt(parts[2]);
                        const date = new Date(y, m, d);
                        return isNaN(date.getTime()) ? null : date;
                    }
                }
            }
            // Fallback to standard JS parsing (ISO etc)
            const parsed = new Date(dateStr);
            return isNaN(parsed.getTime()) ? null : parsed;
        };

        const mappedBatch = batchData.map(item => {
            const billingDateVal = (item['Billing Date'] as string) || (item['BillingDate'] as string) || null;
            const poDateVal = (item['PO Date'] as string) || null;

            return {
                sorg: (item['Sorg.'] as string) || null,
                billTy: (item['BillTy'] as string) || null,
                revType: (item['Rev. Type'] as string) || null,
                customer: (item['Customer'] as string) || null,
                customerName: (item['Customer Name'] as string) || null,
                salesman: (item['Salesman'] as string) || null,
                item: parseInt(String(item['Item'])) || 0,
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
                qty: Math.round(parseNumber(item['Qty'] as string) || 0),
                uom: (item['UOM'] as string) || null,
                curr: (item['Curr'] as string) || null,
                basePrice: parseNumber(item['Base Price'] as string),
                intdeptPrice: parseNumber(item['Intdept Price'] as string),
                adjustmentPrice: parseNumber(item['Adjustment Price'] as string),
                revenueInDocCurr: parseNumber(item['Revenue in Doc Curr.'] as string),
                revenueInLocCurr: parseNumber(item['Revenue in Loc Curr.'] as string),
                billingNo: (item['Billing No'] as string) || null,
                billingDate: parseDate(billingDateVal),
                inco1: (item['INCO1'] as string) || null,
                inco2: (item['INCO2'] as string) || null,
                c: (item['C'] as string) || null,
                cancelled: (item['Cancelled'] as string) || null,
                deliveryNo: (item['Delivery No'] as string) || null,
                salesOrder: (item['Sales Order'] as string) || null,
                workOrder: (item['Work Order'] as string) || null,
                poNo: (item['PO No.'] as string) || null,
                poDate: parseDate(poDateVal),
                poType: (item['PO Type'] as string) || null,
                costOfSales: parseNumber(item['Cost Of Sales'] as string),
                profitMargin: parseNumber(item['Profit Margin'] as string)
            };
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.insert(salesRevenueSap).values(mappedBatch as any);
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
            .from(salesRevenueSap)
            .where(eq(salesRevenueSap.materialNo, materialNo));

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
