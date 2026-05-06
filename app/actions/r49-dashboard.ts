"use server"

import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
import { sql, and, isNotNull, or, notIlike, desc, asc, ilike, inArray } from "drizzle-orm"
import { type SQL } from "drizzle-orm"
import { salesRevenueCountableQty } from "@/lib/sales-revenue-sql"

const ACTIVE_SALESMAN_BILLING_START = '2026-01-01';
const ACTIVE_SALESMAN_BILLING_END = '2027-01-01';

export interface R49DashboardFilters {
    years?: string[];
    months?: string[];
    salesman?: string[];
    customers?: string[];
    matGrp2Desc?: string[];
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

        const salesmanFilterWhere = and(
            baseWhere,
            sql`${salesRevenueSap.billingDate} >= ${ACTIVE_SALESMAN_BILLING_START}::date`,
            sql`${salesRevenueSap.billingDate} < ${ACTIVE_SALESMAN_BILLING_END}::date`,
            sql`NULLIF(BTRIM(${salesRevenueSap.salesman}), '') IS NOT NULL`
        );

        const [customers, salesmen, matGrp2DescList] = await Promise.all([
            db.selectDistinct({ v: salesRevenueSap.customerName }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.customerName),
            db.selectDistinct({ v: sql<string>`BTRIM(${salesRevenueSap.salesman})` })
                .from(salesRevenueSap)
                .where(salesmanFilterWhere)
                .orderBy(sql`BTRIM(${salesRevenueSap.salesman})`),
            db.selectDistinct({ v: salesRevenueSap.matGrp2Desc })
                .from(salesRevenueSap)
                .where(baseWhere)
                .orderBy(salesRevenueSap.matGrp2Desc),
        ]);

        const [yearsResult, monthsResult] = await Promise.all([
            db.selectDistinct({ v: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY')` }).from(salesRevenueSap).where(baseWhere),
            db.selectDistinct({ v: sql<string>`to_char(${salesRevenueSap.billingDate}, 'MM')` }).from(salesRevenueSap).where(baseWhere),
        ]);

        return {
            success: true,
            data: {
                customers: customers.map(c => c.v).filter(Boolean),
                salesmen: salesmen.map(s => s.v).filter(Boolean),
                matGrp2Desc: matGrp2DescList.map(m => m.v).filter(Boolean),
                years: yearsResult.map(y => y.v).filter(Boolean).sort().reverse(),
                months: monthsResult.map(m => m.v).filter(Boolean).sort(),
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
            matGrp2Desc = [],
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
        if (salesman.length > 0) filterArray.push(inArray(sql<string>`BTRIM(${salesRevenueSap.salesman})`, salesman));
        if (matGrp2Desc.length > 0) filterArray.push(inArray(salesRevenueSap.matGrp2Desc, matGrp2Desc));

        if (years.length > 0) {
            filterArray.push(inArray(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY')`, years));
        }
        if (months.length > 0) {
            const monthList = months.flatMap(m => [m.padStart(2, '0'), parseInt(m).toString()]);
            const uniqueMonthList = Array.from(new Set(monthList.map(m => m.padStart(2, '0'))));
            filterArray.push(inArray(sql`to_char(${salesRevenueSap.billingDate}, 'MM')`, uniqueMonthList));
        }

        const finalWhere = and(...filterArray);

        const orderExpr = sortByYear
            ? sql`SUM(CASE WHEN to_char(${salesRevenueSap.billingDate}, 'YYYY') = ${sortByYear} THEN COALESCE(${salesRevenueSap.revenueInDocCurr}, 0) ELSE 0 END)`
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
            year: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY')`,
            qty: sql<number>`SUM(${salesRevenueCountableQty})`,
            revenueDocCurr: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`,
            revenueLocCurr: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(and(finalWhere, inArray(salesRevenueSap.customerName, customerNames)))
            .groupBy(salesRevenueSap.customerName, salesRevenueSap.materialDescription, sql`to_char(${salesRevenueSap.billingDate}, 'YYYY')`) : [];

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
            year: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY')`,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0)) / NULLIF(SUM(${salesRevenueCountableQty}), 0)`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY')`);

        const revByOrg = await db.select({
            label: salesRevenueSap.plant,
            value: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(salesRevenueSap.plant);

        const qtyVsRev = await db.select({
            label: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY')`,
            rev: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`,
            qty: sql<number>`SUM(${salesRevenueCountableQty})`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY')`);

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

export async function exportR49DashboardToExcel(filters: R49DashboardFilters = {}) {
    try {
        const {
            years = [],
            months = [],
            salesman = [],
            customers = [],
            matGrp2Desc = []
        } = filters;

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
        if (salesman.length > 0) filterArray.push(inArray(sql<string>`BTRIM(${salesRevenueSap.salesman})`, salesman));
        if (matGrp2Desc.length > 0) filterArray.push(inArray(salesRevenueSap.matGrp2Desc, matGrp2Desc));

        if (years.length > 0) {
            filterArray.push(inArray(sql`to_char(${salesRevenueSap.billingDate}, 'YYYY')`, years));
        }
        if (months.length > 0) {
            const monthList = months.flatMap(m => [m.padStart(2, '0'), parseInt(m).toString()]);
            const uniqueMonthList = Array.from(new Set(monthList.map(m => m.padStart(2, '0'))));
            filterArray.push(inArray(sql`to_char(${salesRevenueSap.billingDate}, 'MM')`, uniqueMonthList));
        }

        const finalWhere = and(...filterArray);

        const exportData = await db.select({
            customerName: salesRevenueSap.customerName,
            materialDescription: salesRevenueSap.materialDescription,
            matGrp2Desc: salesRevenueSap.matGrp2Desc,
            year: sql<string>`to_char(${salesRevenueSap.billingDate}, 'YYYY')`,
            month: sql<string>`to_char(${salesRevenueSap.billingDate}, 'MM')`,
            salesman: sql<string>`BTRIM(${salesRevenueSap.salesman})`,
            qty: sql<number>`SUM(${salesRevenueCountableQty})`,
            revenueDocCurr: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`,
            revenueLocCurr: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(
                salesRevenueSap.customerName,
                salesRevenueSap.materialDescription,
                salesRevenueSap.matGrp2Desc,
                sql`to_char(${salesRevenueSap.billingDate}, 'YYYY')`,
                sql`to_char(${salesRevenueSap.billingDate}, 'MM')`,
                sql`BTRIM(${salesRevenueSap.salesman})`
            )
            .orderBy(
                sql`to_char(${salesRevenueSap.billingDate}, 'YYYY')`,
                sql`to_char(${salesRevenueSap.billingDate}, 'MM')`,
                salesRevenueSap.customerName
            );

        return {
            success: true,
            data: exportData
        };
    } catch (error: unknown) {
        console.error("Failed to export R49 dashboard data:", error);
        return { success: false, error: "Failed to export data" };
    }
}