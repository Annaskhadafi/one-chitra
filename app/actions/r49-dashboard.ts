"use server"

import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
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
            isNotNull(salesRevenueSap.billingDate),
            ilike(salesRevenueSap.revType, '%Trading%'),
            ilike(salesRevenueSap.matGrpDesc, '%EARTHMOVER TIRES R49%'),
            or(
                sql`${salesRevenueSap.customerName} IS NULL`,
                and(
                    notIlike(salesRevenueSap.customerName, '%Chitra Paratama Singapore Branch%'),
                    notIlike(salesRevenueSap.customerName, '%PT. CHITRA PARATAMA%')
                )
            )
        );

        const [customers, salesmen] = await Promise.all([
            db.selectDistinct({ v: salesRevenueSap.customerName }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.customerName),
            db.selectDistinct({ v: salesRevenueSap.salesman }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.salesman),
        ]);

        const dates = await db.selectDistinct({ date: salesRevenueSap.billingDate }).from(salesRevenueSap).where(baseWhere);
        const years = new Set<string>();
        const months = new Set<string>();

        dates.forEach(d => {
            if (d.date) {
                const dateObj = new Date(d.date);
                if (!isNaN(dateObj.getTime())) {
                    years.add(dateObj.getFullYear().toString());
                    months.add((dateObj.getMonth() + 1).toString().padStart(2, '0'));
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
                isNotNull(salesRevenueSap.billingDate),
                ilike(salesRevenueSap.revType, '%Trading%'),
                ilike(salesRevenueSap.matGrpDesc, '%EARTHMOVER TIRES R49%'),
                or(
                    sql`${salesRevenueSap.customerName} IS NULL`,
                    and(
                        notIlike(salesRevenueSap.customerName, '%Chitra Paratama Singapore Branch%'),
                        notIlike(salesRevenueSap.customerName, '%PT. CHITRA PARATAMA%')
                    )
                )
            )
        ];

        if (customers.length > 0) filterArray.push(inArray(salesRevenueSap.customerName, customers));
        if (salesman.length > 0) filterArray.push(inArray(salesRevenueSap.salesman, salesman));

        if (years.length > 0) {
            filterArray.push(inArray(sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})::text`, years));
        }
        if (months.length > 0) {
            filterArray.push(inArray(sql`to_char(${salesRevenueSap.billingDate}, 'MM')`, months));
        }

        const finalWhere = and(...filterArray);

        const orderExpr = sortByYear
            ? sql`SUM(CASE WHEN EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})::text = ${sortByYear} THEN COALESCE(${salesRevenueSap.revenueInDocCurr}, 0) ELSE 0 END)`
            : sql`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`;

        const paginatedCustomers = await db.select({
            customerName: salesRevenueSap.customerName,
            totalRevenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(salesRevenueSap.customerName)
            .orderBy(sortOrder === 'desc' ? desc(orderExpr) : asc(orderExpr))
            .limit(pageSize)
            .offset(offset);
        const totalCustomersCountResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${salesRevenueSap.customerName})` })
            .from(salesRevenueSap)
            .where(finalWhere);
        const totalCount = Number(totalCustomersCountResult[0].count);

        const customerNames = paginatedCustomers.map((c: { customerName: string | null }) => c.customerName).filter(Boolean) as string[];

        const pivotDataRaw = customerNames.length > 0 ? await db.select({
            customerName: salesRevenueSap.customerName,
            materialDescription: salesRevenueSap.materialDescription,
            year: sql<string>`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})::text`,
            qty: sql<number>`SUM(COALESCE(${salesRevenueSap.qty}, 0))`,
            revenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(and(finalWhere, inArray(salesRevenueSap.customerName, customerNames)))
            .groupBy(salesRevenueSap.customerName, salesRevenueSap.materialDescription, sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})`) : [];

        const top5Customers = await db.select({
            label: salesRevenueSap.customerName,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(salesRevenueSap.customerName)
            .orderBy(desc(sql`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`))
            .limit(5);

        const monthlyTrend = await db.select({
            month: sql<string>`to_char(${salesRevenueSap.billingDate}, 'MM')`,
            year: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY')`,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(sql`to_char(${salesRevenueSap.billingDate}, 'MM')`, sql`to_char(${salesRevenueSap.billingDate}, 'YYYY')`);

        const materialBreakdown = await db.select({
            label: salesRevenueSap.materialDescription,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(salesRevenueSap.materialDescription);

        const avgPriceTrend = await db.select({
            year: sql<string>`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})::text`,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0)) / NULLIF(SUM(COALESCE(${salesRevenueSap.qty}, 0)), 0)`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})`);

        const revByOrg = await db.select({
            label: salesRevenueSap.plant,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(salesRevenueSap.plant);

        const qtyVsRev = await db.select({
            label: sql<string>`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})::text`,
            rev: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`,
            qty: sql<number>`SUM(COALESCE(${salesRevenueSap.qty}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})`);

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
        return { success: false, error: "Failed to fetch data" };
    }
}
