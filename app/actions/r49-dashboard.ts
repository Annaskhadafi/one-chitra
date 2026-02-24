"use server"

import { db } from "@/db"
import { historyOrders } from "@/db/schema/history-orders"
import { sql, and, isNotNull, ne, or, notIlike, desc, asc, ilike, inArray } from "drizzle-orm"
import { type SQL } from "drizzle-orm"

export interface R49DashboardFilters {
    years?: string[];
    months?: string[];
    salesman?: string[];
    customers?: string[];
    page?: number;
    pageSize?: number;
    sortByYear?: string;
    sortOrder?: 'asc' | 'desc';
}

export async function getR49DashboardFilters() {
    try {
        const baseWhere = and(
            isNotNull(historyOrders.billingDate),
            ne(historyOrders.billingDate, ""),
            ilike(historyOrders.revType, '%Trading%'),
            ilike(historyOrders.matGrpDesc, '%EARTHMOVER TIRES R49%'),
            or(
                sql`${historyOrders.customerName} IS NULL`,
                and(
                    notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%'),
                    notIlike(historyOrders.customerName, '%PT. CHITRA PARATAMA%')
                )
            )
        );

        const [customers, salesmen] = await Promise.all([
            db.selectDistinct({ v: historyOrders.customerName }).from(historyOrders).where(baseWhere).orderBy(historyOrders.customerName),
            db.selectDistinct({ v: historyOrders.salesman }).from(historyOrders).where(baseWhere).orderBy(historyOrders.salesman),
        ]);

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

        return {
            success: true,
            data: {
                customers: customers.map(c => c.v).filter(Boolean),
                salesmen: salesmen.map(s => s.v).filter(Boolean),
                years: Array.from(years).sort().reverse(),
                months: Array.from(months).sort(),
            }
        };
    } catch (error) {
        console.error("Failed to fetch R49 dashboard filters:", error);
        return { success: false, error: "Failed to fetch filters" };
    }
}


export async function getR49DashboardData(filters: R49DashboardFilters = {}) {
    let topCustomersQuery: ReturnType<typeof db.select> | null = null;
    try {
        const {
            years = [],
            months = [],
            salesman = [],
            customers = [],
            page = 1,
            pageSize = 30,
            sortByYear = '',
            sortOrder = 'desc'
        } = filters;

        const offset = (page - 1) * pageSize;

        const filterArray: (SQL | undefined)[] = [
            and(
                isNotNull(historyOrders.billingDate),
                ne(historyOrders.billingDate, ""),
                ilike(historyOrders.revType, '%Trading%'),
                ilike(historyOrders.matGrpDesc, '%EARTHMOVER TIRES R49%'),
                or(
                    sql`${historyOrders.customerName} IS NULL`,
                    and(
                        notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%'),
                        notIlike(historyOrders.customerName, '%PT. CHITRA PARATAMA%')
                    )
                )
            )
        ];

        if (customers.length > 0) filterArray.push(inArray(historyOrders.customerName, customers));
        if (salesman.length > 0) filterArray.push(inArray(historyOrders.salesman, salesman));

        if (years.length > 0) {
            filterArray.push(inArray(sql`split_part(${historyOrders.billingDate}, '/', 3)`, years));
        }
        if (months.length > 0) {
            const monthList = months.flatMap(m => [m.padStart(2, '0'), parseInt(m).toString()]);
            const uniqueMonthList = Array.from(new Set(monthList));
            filterArray.push(inArray(sql`split_part(${historyOrders.billingDate}, '/', 1)`, uniqueMonthList));
        }

        const finalWhere = and(...filterArray);

        const orderExpr = sortByYear
            ? sql`SUM(CASE WHEN split_part(${historyOrders.billingDate}, '/', 3) = ${sortByYear} THEN COALESCE(${historyOrders.revenueInDocCurr}, 0) ELSE 0 END)`
            : sql`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`;

        topCustomersQuery = db.select({
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

        const customerNames = paginatedCustomers.map((c: { customerName: string | null }) => c.customerName).filter(Boolean) as string[];

        const pivotDataRaw = customerNames.length > 0 ? await db.select({
            customerName: historyOrders.customerName,
            materialDescription: historyOrders.materialDescription,
            year: sql<string>`split_part(${historyOrders.billingDate}, '/', 3)`,
            qty: sql<number>`SUM(COALESCE(${historyOrders.qty}, 0))`,
            revenue: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`
        })
            .from(historyOrders)
            .where(and(finalWhere, inArray(historyOrders.customerName, customerNames)))
            .groupBy(historyOrders.customerName, historyOrders.materialDescription, sql`split_part(${historyOrders.billingDate}, '/', 3)`) : [];

        const top5Customers = await db.select({
            label: historyOrders.customerName,
            value: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`
        })
            .from(historyOrders)
            .where(finalWhere)
            .groupBy(historyOrders.customerName)
            .orderBy(desc(sql`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`))
            .limit(5);

        const monthlyTrend = await db.select({
            month: sql<string>`split_part(${historyOrders.billingDate}, '/', 1)`,
            year: sql<string>`split_part(${historyOrders.billingDate}, '/', 3)`,
            value: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`
        })
            .from(historyOrders)
            .where(finalWhere)
            .groupBy(sql`split_part(${historyOrders.billingDate}, '/', 1)`, sql`split_part(${historyOrders.billingDate}, '/', 3)`);

        const materialBreakdown = await db.select({
            label: historyOrders.materialDescription,
            value: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`
        })
            .from(historyOrders)
            .where(finalWhere)
            .groupBy(historyOrders.materialDescription);

        const avgPriceTrend = await db.select({
            year: sql<string>`split_part(${historyOrders.billingDate}, '/', 3)`,
            value: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0)) / NULLIF(SUM(COALESCE(${historyOrders.qty}, 0)), 0)`
        })
            .from(historyOrders)
            .where(finalWhere)
            .groupBy(sql`split_part(${historyOrders.billingDate}, '/', 3)`);

        const revByOrg = await db.select({
            label: historyOrders.plant,
            value: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`
        })
            .from(historyOrders)
            .where(finalWhere)
            .groupBy(historyOrders.plant);

        const qtyVsRev = await db.select({
            label: sql<string>`split_part(${historyOrders.billingDate}, '/', 3)`,
            rev: sql<number>`SUM(COALESCE(${historyOrders.revenueInDocCurr}, 0))`,
            qty: sql<number>`SUM(COALESCE(${historyOrders.qty}, 0))`
        })
            .from(historyOrders)
            .where(finalWhere)
            .groupBy(sql`split_part(${historyOrders.billingDate}, '/', 3)`);

        return {
            success: true,
            data: {
                pivotTable: pivotDataRaw,
                customerOrder: paginatedCustomers,
                totalCustomers: totalCount,
                charts: {
                    topCustomers: top5Customers,
                    monthlyTrend,
                    materialBreakdown,
                    avgPriceTrend,
                    revByOrg,
                    qtyVsRev
                }
            }
        };
    } catch (error: unknown) {
        console.error("Failed to fetch R49 dashboard data:", error);
        if (topCustomersQuery) {
            // Error logging preserved for telemetry in production if needed, or removed
            // console.log("Failed SQL:", topCustomersQuery.toSQL().sql);
        }
        return { success: false, error: "Failed to fetch data" };
    }
}
