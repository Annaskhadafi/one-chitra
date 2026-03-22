"use server"

import { db } from "@/db"
import { historyOrders } from "@/db/schema/history-orders"
import { sql, and, isNotNull, ne, or, notIlike, desc, asc } from "drizzle-orm"
import { type SQL } from "drizzle-orm"

export interface SalesDashboardFilters {
    years?: string[];
    months?: string[];
    salesman?: string[];
    customers?: string[];
    revTypes?: string[];
    areas?: string[];
    page?: number;
    pageSize?: number;
    sortByYear?: string;
    sortOrder?: 'asc' | 'desc';
}

export async function getSalesDashboardFilters() {
    try {
        const baseWhere = and(
            isNotNull(historyOrders.billingDate),
            ne(historyOrders.billingDate, ""),
            or(
                sql`${historyOrders.customerName} IS NULL`,
                notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%')
            )
        );

        const [customers, salesmen, revTypes, plants] = await Promise.all([
            db.selectDistinct({ v: historyOrders.customerName }).from(historyOrders).where(baseWhere).orderBy(historyOrders.customerName),
            db.selectDistinct({ v: historyOrders.salesman }).from(historyOrders).where(baseWhere).orderBy(historyOrders.salesman),
            db.selectDistinct({ v: historyOrders.revType }).from(historyOrders).where(baseWhere),
            db.selectDistinct({ v: historyOrders.plant }).from(historyOrders).where(baseWhere),
        ]);

        // Get years and months from billingDate (text format M/D/YYYY)
        const dates = await db.selectDistinct({ date: historyOrders.billingDate }).from(historyOrders).where(baseWhere);
        const years = new Set<string>();
        const months = new Set<string>();

        dates.forEach(d => {
            if (d.date) {
                const parts = d.date.split('/');
                if (parts.length === 3) {
                    years.add(parts[2]);
                    months.add(parts[0].padStart(2, '0'));
                }
            }
        });

        const areaMapping: Record<string, string> = {
            "1001": "JAWA BARAT",
            "2001": "KALIMANTAN TIMUR",
            "2002": "KALIMANTAN TIMUR",
            "3001": "KALIMANTAN SELATAN",
            "4001": "SUMATERA SELATAN",
            "5001": "SULAWESI",
            "6001": "PEKANBARU",
            "7001": "SANGATA",
            "8001": "KENDARI",
        };

        const uniqueAreas = Array.from(new Set(plants.map(p => areaMapping[p.v || ""] || "OTHER").filter(a => a !== "OTHER")));

        return {
            success: true,
            data: {
                customers: customers.map(c => c.v).filter(Boolean),
                salesmen: salesmen.map(s => s.v).filter(Boolean),
                revTypes: revTypes.map(r => r.v?.trim()).filter(Boolean),
                areas: uniqueAreas,
                years: Array.from(years).sort().reverse(),
                months: Array.from(months).sort(),
            }
        };
    } catch (error) {
        console.error("Failed to fetch dashboard filters:", error);
        return { success: false, error: "Failed to fetch dashboard filters" };
    }
}

// Helper SQL for Group Revenue mapping
const groupRevenueSql = sql`
    CASE 
        WHEN TRIM(${historyOrders.revType}) IN ('Trading') AND ${historyOrders.matGrp1Desc} = 'CP TIRE' THEN 'Tire'
        WHEN TRIM(${historyOrders.revType}) IN ('Repair', 'Service') THEN 'Services'
        WHEN ${historyOrders.matGrp1Desc} = 'CP ACCESSORIES' THEN 'Product Accessories'
        ELSE 'Others'
    END
`;

export async function getSalesDashboardData(filters: SalesDashboardFilters = {}) {
    try {
        const {
            years = [],
            months = [],
            salesman = [],
            customers = [],
            revTypes = [],
            page = 1,
            pageSize = 30,
            sortByYear = '', // If empty, sort by Total overall
            sortOrder = 'desc'
        } = filters;

        const offset = (page - 1) * pageSize;

        const filterArray: (SQL | undefined)[] = [
            and(
                isNotNull(historyOrders.billingDate),
                ne(historyOrders.billingDate, ""),
                or(
                    sql`${historyOrders.customerName} IS NULL`,
                    notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%')
                )
            )
        ];

        if (customers.length > 0) filterArray.push(sql`${historyOrders.customerName} IN ${customers}`);
        if (salesman.length > 0) filterArray.push(sql`${historyOrders.salesman} IN ${salesman}`);
        if (revTypes.length > 0) filterArray.push(sql`TRIM(${historyOrders.revType}) IN ${revTypes}`);

        if (years.length > 0) {
            filterArray.push(or(...years.map(y => sql`${historyOrders.billingDate} LIKE ${`%/%/${y}`} `)));
        }
        if (months.length > 0) {
            filterArray.push(or(...months.map(m => sql`${historyOrders.billingDate} LIKE ${`${parseInt(m)}/%/%`} `)));
        }

        const finalWhere = and(...filterArray);

        // 1. Get Top Customers with Pagination and Sorting
        // First, get the list of customers and their total revenue for sorting
        const orderExpr = sortByYear
            ? sql`SUM(CASE WHEN split_part(${historyOrders.billingDate}, '/', 3) = ${sortByYear} THEN COALESCE(${historyOrders.revenueInDocCurr}, 0) ELSE 0 END)`
            : sql`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`;

        const topCustomersQuery = db.select({
            customerName: historyOrders.customerName,
            totalRevenue: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`
        })
            .from(historyOrders)
            .where(finalWhere)
            .groupBy(historyOrders.customerName)
            .orderBy(sortOrder === 'desc' ? desc(orderExpr) : asc(orderExpr))
            .limit(pageSize)
            .offset(offset);

        const paginatedCustomers = await topCustomersQuery;
        const totalCustomersCountResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${historyOrders.customerName})` })
            .from(historyOrders)
            .where(finalWhere);
        const totalCount = Number(totalCustomersCountResult[0].count);

        const customerNames = paginatedCustomers.map(c => c.customerName).filter(Boolean) as string[];

        // 2. Fetch Nested Pivot Data only for these customers
        // We need: Customer -> Group Revenue -> Year -> Amount
        const nestedPivotData = customerNames.length > 0 ? await db.select({
            customerName: historyOrders.customerName,
            groupRevenue: groupRevenueSql,
            year: sql<string>`split_part(${historyOrders.billingDate}, '/', 3)`,
            revenue: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`
        })
            .from(historyOrders)
            .where(and(finalWhere, sql`${historyOrders.customerName} IN ${customerNames}`))
            .groupBy(historyOrders.customerName, groupRevenueSql, sql`split_part(${historyOrders.billingDate}, '/', 3)`) : [];

        // 3. Category Stats for Charts (No changes needed if they use existing category field, 
        // but for parity with pivot, maybe charts should also use "Group Revenue"?)
        // Let's keep existing charts using revType as per previous screenshot unless asked.
        const categoryDataRaw = await db.select({
            category: sql<string>`TRIM(${historyOrders.revType})`,
            year: sql<string>`split_part(${historyOrders.billingDate}, '/', 3)`,
            revenue: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`
        })
            .from(historyOrders)
            .where(finalWhere)
            .groupBy(sql`TRIM(${historyOrders.revType})`, sql`split_part(${historyOrders.billingDate}, '/', 3)`);

        const areaCase = sql`
            CASE 
                WHEN ${historyOrders.plant} IN ('2001', '2002') THEN 'KALIMANTAN TIMUR'
                WHEN ${historyOrders.plant} = '3001' THEN 'KALIMANTAN SELATAN'
                WHEN ${historyOrders.plant} = '4001' THEN 'SUMATERA SELATAN'
                WHEN ${historyOrders.plant} = '5001' THEN 'SULAWESI'
                WHEN ${historyOrders.plant} = '1001' THEN 'JAWA BARAT'
                ELSE 'OTHER'
            END
        `;

        const areaDataRaw = await db.select({
            area: areaCase,
            year: sql<string>`split_part(${historyOrders.billingDate}, '/', 3)`,
            revenue: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`
        })
            .from(historyOrders)
            .where(finalWhere)
            .groupBy(areaCase, sql`split_part(${historyOrders.billingDate}, '/', 3)`);

        const monthlyDataRaw = await db.select({
            month: sql<string>`split_part(${historyOrders.billingDate}, '/', 1)`,
            year: sql<string>`split_part(${historyOrders.billingDate}, '/', 3)`,
            revenue: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`
        })
            .from(historyOrders)
            .where(finalWhere)
            .groupBy(sql`split_part(${historyOrders.billingDate}, '/', 1)`, sql`split_part(${historyOrders.billingDate}, '/', 3)`);

        return {
            success: true,
            data: {
                pivotTable: nestedPivotData,
                customerOrder: paginatedCustomers, // To maintain sorting on frontend
                totalCustomers: totalCount,
                categoryStats: categoryDataRaw,
                areaStats: areaDataRaw,
                monthlyStats: monthlyDataRaw
            }
        };
    } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        return { success: false, error: "Failed to fetch dashboard data" };
    }
}
