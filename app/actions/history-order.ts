"use server"

import { db } from "@/db"
import { historyOrders } from "@/db/schema/history-orders"
import { salesRevenueSap } from "@/db/schema/sap"
import { desc, notIlike, isNull, isNotNull, or, and, eq, SQL } from "drizzle-orm"
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
                notIlike(salesRevenueSap.customerName, '%Chitra Paratama Singapore Branch%')
            )
        );

        const [customers, plants, matGrps] = await Promise.all([
            db.selectDistinct({ name: salesRevenueSap.customerName }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.customerName),
            db.selectDistinct({ name: salesRevenueSap.plant }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.plant),
            db.selectDistinct({ name: salesRevenueSap.matGrpDesc }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.matGrpDesc),
        ]);

        const dates = await db.selectDistinct({ date: salesRevenueSap.billingDate }).from(salesRevenueSap).where(baseWhere);
        const years = new Set<string>();
        const months = new Set<string>();

        dates.forEach(d => {
            if (d.date) {
                const billingDate = new Date(d.date);

                if (!Number.isNaN(billingDate.getTime())) {
                    years.add(String(billingDate.getFullYear()));
                    months.add(String(billingDate.getMonth() + 1).padStart(2, '0'));
                }
            }
        });

        return {
            success: true,
            data: {
                customers: customers.map(c => c.name).filter(Boolean),
                plants: plants.map(p => p.name).filter(Boolean),
                matGrps: matGrps.map(m => m.name).filter(Boolean),
                years: Array.from(years).sort().reverse(),
                months: Array.from(months).sort(),
            }
        };
    } catch (error) {
        console.error("Failed to fetch filter options:", error);
        return { success: false, error: "Failed to fetch filter options" };
    }
}

import { sql } from "drizzle-orm"

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
                notIlike(salesRevenueSap.customerName, '%Chitra Paratama Singapore Branch%')
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
            const yearFilter = or(...years.map(y => sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate}) = ${Number(y)}`));
            if (yearFilter) {
                filterArray.push(yearFilter);
            }
        }
        if (months.length > 0) {
            const monthFilter = or(...months.map(m => sql`EXTRACT(MONTH FROM ${salesRevenueSap.billingDate}) = ${Number(m)}`));
            if (monthFilter) {
                filterArray.push(monthFilter);
            }
        }

        const finalWhere = and(...filterArray);

        const dataQuery = db.select().from(salesRevenueSap).where(finalWhere);

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

        const topCustomers = await db.select({
            name: salesRevenueSap.customerName,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(salesRevenueSap.customerName)
            .orderBy(sql`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0)) DESC`)
            .limit(10);

        const plantStats = await db.select({
            name: salesRevenueSap.plant,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(salesRevenueSap.plant)
            .orderBy(sql`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0)) DESC`);

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
                billing_date: item.billingDate ? new Date(item.billingDate).toISOString().split("T")[0] : '',
                plant: item.plant || '',
                po_number: item.poNo || '',
                po_date: item.poDate ? new Date(item.poDate).toISOString().split("T")[0] : '',
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

        const data = await db.select()
            .from(salesRevenueSap)
            .where(eq(salesRevenueSap.materialNo, materialNo));

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
                if (item.unitPrice < minPrice) return false;

                if (!item.billingDate) return false;
                const itemDate = new Date(item.billingDate);
                return !isNaN(itemDate.getTime()) && itemDate >= threeYearsAgo;
            });

        const customerMap = new Map<string, typeof processedData[0]>();

        processedData.forEach(item => {
            const existing = customerMap.get(item.customerName);
            if (!existing) {
                customerMap.set(item.customerName, item);
            } else {
                const existingDate = new Date(existing.billingDate).getTime();
                const currentDate = new Date(item.billingDate).getTime();

                if (currentDate > existingDate || (currentDate === existingDate && item.unitPrice > existing.unitPrice)) {
                    customerMap.set(item.customerName, item);
                }
            }
        });

        const uniqueCustomerHistory = Array.from(customerMap.values());

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
