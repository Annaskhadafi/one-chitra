"use server"

import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
import { sql, and, isNotNull, or, notIlike, desc, asc } from "drizzle-orm"
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
            isNotNull(salesRevenueSap.billingDate),
            or(
                sql`${salesRevenueSap.customerName} IS NULL`,
                and(
                    notIlike(salesRevenueSap.customerName, '%Chitra Paratama Singapore Branch%'),
                    notIlike(salesRevenueSap.customerName, '%Transitetyre B.V%')
                )
            )
        );

        const [customers, salesmen, revTypes, plants] = await Promise.all([
            db.selectDistinct({ v: salesRevenueSap.customerName }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.customerName),
            db.selectDistinct({ v: salesRevenueSap.salesman }).from(salesRevenueSap).where(baseWhere).orderBy(salesRevenueSap.salesman),
            db.selectDistinct({ v: salesRevenueSap.revType }).from(salesRevenueSap).where(baseWhere),
            db.selectDistinct({ v: salesRevenueSap.plant }).from(salesRevenueSap).where(baseWhere),
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
        WHEN TRIM(${salesRevenueSap.revType}) IN ('Trading') AND ${salesRevenueSap.matGrp1Desc} = 'CP TIRE' THEN 'Tire'
        WHEN TRIM(${salesRevenueSap.revType}) IN ('Repair', 'Service') THEN 'Services'
        WHEN ${salesRevenueSap.matGrp1Desc} = 'CP ACCESSORIES' THEN 'Product Accessories'
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
            areas = [],
            page = 1,
            pageSize = 30,
            sortByYear = '', // If empty, sort by Total overall
            sortOrder = 'desc'
        } = filters;

        const offset = (page - 1) * pageSize;

        const filterArray: (SQL | undefined)[] = [
            and(
                isNotNull(salesRevenueSap.billingDate),
                or(
                    sql`${salesRevenueSap.customerName} IS NULL`,
                    and(
                        notIlike(salesRevenueSap.customerName, '%Chitra Paratama Singapore Branch%'),
                        notIlike(salesRevenueSap.customerName, '%Transitetyre B.V%'),
                        notIlike(salesRevenueSap.customerName, '%TRANSITYRE B.V%')
                    )
                )
            )
        ];

        if (customers.length > 0) filterArray.push(sql`${salesRevenueSap.customerName} IN ${customers}`);
        if (salesman.length > 0) filterArray.push(sql`${salesRevenueSap.salesman} IN ${salesman}`);
        if (revTypes.length > 0) filterArray.push(sql`TRIM(${salesRevenueSap.revType}) IN ${revTypes}`);

        if (years.length > 0) {
            filterArray.push(or(...years.map(y => sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate}) = ${Number(y)}`)));
        }
        if (months.length > 0) {
            filterArray.push(or(...months.map(m => sql`EXTRACT(MONTH FROM ${salesRevenueSap.billingDate}) = ${Number(m)}`)));
        }

        if (areas.length > 0) {
            filterArray.push(
                or(
                    ...areas.map((area) => sql`
                        CASE 
                            WHEN ${salesRevenueSap.plant} IN ('2001', '2002') THEN 'KALIMANTAN TIMUR'
                            WHEN ${salesRevenueSap.plant} = '3001' THEN 'KALIMANTAN SELATAN'
                            WHEN ${salesRevenueSap.plant} = '4001' THEN 'SUMATERA SELATAN'
                            WHEN ${salesRevenueSap.plant} = '5001' THEN 'SULAWESI'
                            WHEN ${salesRevenueSap.plant} = '1001' THEN 'JAWA BARAT'
                            WHEN ${salesRevenueSap.plant} = '6001' THEN 'PEKANBARU'
                            WHEN ${salesRevenueSap.plant} = '7001' THEN 'SANGATA'
                            WHEN ${salesRevenueSap.plant} = '8001' THEN 'KENDARI'
                            ELSE 'OTHER'
                        END = ${area}
                    `)
                )
            );
        }

        const finalWhere = and(...filterArray);

        // 1. Get Top Customers with Pagination and Sorting
        // First, get the list of customers and their total revenue for sorting
        const orderExpr = sortByYear
            ? sql`SUM(CASE WHEN EXTRACT(YEAR FROM ${salesRevenueSap.billingDate}) = ${Number(sortByYear)} THEN COALESCE(${salesRevenueSap.revenueInDocCurr}, 0) ELSE 0 END)`
            : sql`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`;

        const topCustomersQuery = db.select({
            customerName: salesRevenueSap.customerName,
            totalRevenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(salesRevenueSap.customerName)
            .orderBy(sortOrder === 'desc' ? desc(orderExpr) : asc(orderExpr))
            .limit(pageSize)
            .offset(offset);

        const paginatedCustomers = await topCustomersQuery;
        const totalCustomersCountResult = await db.select({ count: sql<number>`COUNT(DISTINCT ${salesRevenueSap.customerName})` })
            .from(salesRevenueSap)
            .where(finalWhere);
        const totalCount = Number(totalCustomersCountResult[0].count);

        const customerNames = paginatedCustomers.map(c => c.customerName).filter(Boolean) as string[];

        // 2. Fetch Nested Pivot Data only for these customers
        // We need: Customer -> Group Revenue -> Year -> Amount
        const nestedPivotData = customerNames.length > 0 ? await db.select({
            customerName: salesRevenueSap.customerName,
            groupRevenue: groupRevenueSql,
            year: sql<string>`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})::text`,
            revenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(and(finalWhere, sql`${salesRevenueSap.customerName} IN ${customerNames}`))
            .groupBy(salesRevenueSap.customerName, groupRevenueSql, sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})`) : [];

        // 3. Category Stats for Charts (No changes needed if they use existing category field, 
        // but for parity with pivot, maybe charts should also use "Group Revenue"?)
        // Let's keep existing charts using revType as per previous screenshot unless asked.
        const categoryDataRaw = await db.select({
            category: sql<string>`TRIM(${salesRevenueSap.revType})`,
            year: sql<string>`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})::text`,
            revenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(sql`TRIM(${salesRevenueSap.revType})`, sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})`);

        const areaCase = sql`
            CASE 
                WHEN ${salesRevenueSap.plant} IN ('2001', '2002') THEN 'KALIMANTAN TIMUR'
                WHEN ${salesRevenueSap.plant} = '3001' THEN 'KALIMANTAN SELATAN'
                WHEN ${salesRevenueSap.plant} = '4001' THEN 'SUMATERA SELATAN'
                WHEN ${salesRevenueSap.plant} = '5001' THEN 'SULAWESI'
                WHEN ${salesRevenueSap.plant} = '1001' THEN 'JAWA BARAT'
                WHEN ${salesRevenueSap.plant} = '6001' THEN 'PEKANBARU'
                WHEN ${salesRevenueSap.plant} = '7001' THEN 'SANGATA'
                WHEN ${salesRevenueSap.plant} = '8001' THEN 'KENDARI'
                ELSE 'OTHER'
            END
        `;

        const areaDataRaw = await db.select({
            area: areaCase,
            year: sql<string>`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})::text`,
            revenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(areaCase, sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})`);

        const monthlyDataRaw = await db.select({
            month: sql<string>`LPAD(EXTRACT(MONTH FROM ${salesRevenueSap.billingDate})::text, 2, '0')`,
            year: sql<string>`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})::text`,
            revenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInDocCurr}, 0))`
        })
            .from(salesRevenueSap)
            .where(finalWhere)
            .groupBy(sql`EXTRACT(MONTH FROM ${salesRevenueSap.billingDate})`, sql`EXTRACT(YEAR FROM ${salesRevenueSap.billingDate})`);

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
