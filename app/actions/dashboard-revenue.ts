"use server"

import { db } from "@/db"
import { historyOrders } from "@/db/schema/history-orders"
import { forecasts } from "@/db/schema/forecasts"
import { eq, sql, and, isNotNull, ne, or, isNull, notIlike, ilike } from "drizzle-orm"

export interface DashboardRevenueFilters {
    period: string; // MM.YYYY or YYYY
}

// Mat grp desc for Prime Product (Tires)
const PRIME_PRODUCT_MAT_GRPS = [
    'TRUCK&BUS TIRES R24', 'TRUCK&BUS TIRES R20', 'TRUCK&BUS TIRES R16', 'TRUCK&BUS TIRES R10',
    'PASSENGER TIRES R16',
    'INDUSTRIAL TIRES R15', 'INDUSTRIAL TIRES R22', 'INDUSTRIAL TIRES R20', 'INDUSTRIAL TIRES R18',
    'INDUSTRIAL TIRES R11', 'INDUSTRIAL TIRES R12',
    'EARTHMOVER TIRES R63', 'EARTHMOVER TIRES R57', 'EARTHMOVER TIRES R51', 'EARTHMOVER TIRES R49',
    'EARTHMOVER TIRES R45', 'EARTHMOVER TIRES R35', 'EARTHMOVER TIRES R33', 'EARTHMOVER TIRES R25'
]

// Mat grp desc for PA (Product Accessories)
const PA_MAT_GRPS = [
    'CP ACCESSORIES', 'CP TOOLS', 'CP WHEEL & RIM', 'CP CONSUMEABLE', 'CP EQUIPMENT', 'CP SERVICE'
]


export async function getDashboardRevenueForecast(filters: DashboardRevenueFilters) {
    try {
        const periodStr = filters.period || "02.2026";
        const isYearlyView = !periodStr.includes('.');
        const [, year] = isYearlyView ? ["", periodStr] : periodStr.split('.');

        // 1. Fetch Forecast for the requested period
        const forecastData = await db.select().from(forecasts).where(eq(forecasts.period, periodStr));

        const targetMap = new Map<string, number>();
        forecastData.forEach(item => {
            targetMap.set(item.targetName, item.amount);
        });

        // 2. Date filter
        const dateFormat = isYearlyView ? 'YYYY' : 'MM.YYYY';
        const dateFilter = sql`to_char(to_date(${historyOrders.billingDate}, 'MM/DD/YYYY'), ${dateFormat}) = ${periodStr}`;
        const baseFilter = and(
            isNotNull(historyOrders.billingDate),
            ne(historyOrders.billingDate, ""),
            dateFilter,
            or(
                isNull(historyOrders.customerName),
                notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%')
            )
        );

        // Customer NOT (ITC008 or 100289)
        const customerNotExcluded = and(
            notIlike(historyOrders.customer!, '%ITC008%'),
            notIlike(historyOrders.customer!, '%100289%')
        );

        // ─── A. Revenue Prime Product ───────────────────────────────────────────
        // Filter: rev_type = 'Trading', mat_grp_desc IN (Tire list)
        const primeProdMatGrpFilter = sql`upper(trim(${historyOrders.matGrpDesc})) = ANY(ARRAY[${sql.raw(
            PRIME_PRODUCT_MAT_GRPS.map(g => `'${g}'`).join(', ')
        )}]::text[])`;

        const primeProductData = await db.select({
            total: sql<number>`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0))`
        }).from(historyOrders).where(and(
            baseFilter,
            ilike(historyOrders.revType!, 'Trading'),
            primeProdMatGrpFilter
        ));
        const revenuePrimeProduct = Number(primeProductData[0]?.total || 0);

        // ─── B. Revenue Service ─────────────────────────────────────────────────
        // Filter: rev_type != 'Trading', exclude customer ITC008/100289
        const serviceData = await db.select({
            total: sql<number>`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0))`
        }).from(historyOrders).where(and(
            baseFilter,
            notIlike(historyOrders.revType!, 'Trading'),
            customerNotExcluded
        ));
        const revenueService = Number(serviceData[0]?.total || 0);

        // ─── C. Revenue PA (Product Accessories) ───────────────────────────────
        // Filter: rev_type = 'Trading', mat_grp_desc ILIKE CP*, exclude ITC008/100289
        const paMtGrpFilter = sql`upper(trim(${historyOrders.matGrpDesc})) = ANY(ARRAY[${sql.raw(
            PA_MAT_GRPS.map(g => `'${g}'`).join(', ')
        )}]::text[])`;

        const paData = await db.select({
            total: sql<number>`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0))`
        }).from(historyOrders).where(and(
            baseFilter,
            ilike(historyOrders.revType!, 'Trading'),
            paMtGrpFilter,
            customerNotExcluded
        ));
        const revenuePA = Number(paData[0]?.total || 0);

        // ─── D. Consolidate = Prime + PA + Service ─────────────────────────────
        const revenueConsolidate = revenuePrimeProduct + revenuePA + revenueService;

        // ─── E. Forecast Consolidate = sum of sub-forecasts ────────────────────
        const forecastPrime = targetMap.get("Prime Product") || 0;
        const forecastService = targetMap.get("Service") || 0;
        const forecastPA = targetMap.get("PA") || 0;
        const forecastConsolidate = forecastPrime + forecastService + forecastPA;

        // ─── F. Revenue By Customer (CK vs SIS) ────────────────────────────────
        const customerRevenueData = await db.select({
            cust: historyOrders.customerName,
            total: sql<number>`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0))`
        }).from(historyOrders).where(baseFilter).groupBy(historyOrders.customerName);

        let revenueCK = 0;
        let revenueSIS = 0;
        customerRevenueData.forEach(c => {
            const name = (c.cust || "").toUpperCase();
            if (name.includes('CIPTA KRIDATAMA')) revenueCK += Number(c.total);
            if (name.includes('SAPTAINDRA SEJATI') || (name.includes('SIS') && !name.includes('SIMPSON'))) revenueSIS += Number(c.total);
        });

        // ─── G. Salesman Revenue ────────────────────────────────────────────────
        const salesData = await db.select({
            salesman: historyOrders.salesman,
            total: sql<number>`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0))`
        }).from(historyOrders).where(baseFilter).groupBy(historyOrders.salesman);

        const salesmanRevenue: Record<string, number> = {
            ma_oc: 0, ma_wis: 0, ma_fq: 0, ma_bur: 0, ma_ag: 0, ma_mic: 0
        };
        salesData.forEach(s => {
            const name = (s.salesman || "").toUpperCase();
            if (name.includes("OCKY") || name === "MA OC") salesmanRevenue.ma_oc += Number(s.total);
            else if (name.includes("WIS") || name.includes("WISHNU")) salesmanRevenue.ma_wis += Number(s.total);
            else if (name.includes("FQ") || name.includes("FAQIH")) salesmanRevenue.ma_fq += Number(s.total);
            else if (name.includes("BUR") || name.includes("BURHAN")) salesmanRevenue.ma_bur += Number(s.total);
            else if (name.includes("AG ") || name === "MA AG" || name.includes("AGUS")) salesmanRevenue.ma_ag += Number(s.total);
            else if (name.includes("MIC") || name.includes("MICHAEL")) salesmanRevenue.ma_mic += Number(s.total);
        });

        // ─── H. Rev Type Table ──────────────────────────────────────────────────
        const revTypeData = await db.select({
            type: historyOrders.revType,
            total: sql<number>`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0))`
        }).from(historyOrders).where(baseFilter).groupBy(historyOrders.revType);

        const revTypeTable = revTypeData.map(r => ({
            type: r.type || "Unknown",
            total: Number(r.total)
        })).sort((a, b) => b.total - a.total);

        // ─── I. Product Accessories Detail ─────────────────────────────────────
        const matGrp1Data = await db.select({
            desc: historyOrders.matGrp1Desc,
            total: sql<number>`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0))`
        }).from(historyOrders).where(and(baseFilter, paMtGrpFilter, ilike(historyOrders.revType!, 'Trading')))
            .groupBy(historyOrders.matGrp1Desc)
            .orderBy(sql`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0)) DESC`);

        // ─── J. Top Materials (Rank Material Sell Out) ─────────────────────────
        const materialsData = await db.select({
            materialDesc: historyOrders.materialDescription,
            totalRevenue: sql<number>`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0))`,
            qty: sql<number>`SUM(COALESCE(${historyOrders.qty}, 0))`
        }).from(historyOrders)
            .where(baseFilter)
            .groupBy(historyOrders.materialDescription)
            .orderBy(sql`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0)) DESC`)
            .limit(20);

        // ─── K. YTD Revenue Chart ───────────────────────────────────────────────
        const baseFilterYTD = and(
            isNotNull(historyOrders.billingDate),
            ne(historyOrders.billingDate, ""),
            sql`to_char(to_date(${historyOrders.billingDate}, 'MM/DD/YYYY'), 'YYYY') = ${year}`,
            or(
                isNull(historyOrders.customerName),
                notIlike(historyOrders.customerName, '%Chitra Paratama Singapore Branch%')
            )
        );

        const ytdData = await db.select({
            month: sql<string>`to_char(to_date(${historyOrders.billingDate}, 'MM/DD/YYYY'), 'MM.YYYY')`,
            rev: sql<number>`SUM(COALESCE(${historyOrders.revenueInLocCurr}, 0))`
        }).from(historyOrders)
            .where(baseFilterYTD)
            .groupBy(sql`to_char(to_date(${historyOrders.billingDate}, 'MM/DD/YYYY'), 'MM.YYYY')`)
            .orderBy(sql`to_char(to_date(${historyOrders.billingDate}, 'MM/DD/YYYY'), 'MM.YYYY')`);

        // ─── Build Result ───────────────────────────────────────────────────────
        return {
            success: true,
            data: {
                period: periodStr,
                isYearlyView,
                targets: {
                    consolidate: { revenue: revenueConsolidate, forecast: forecastConsolidate },
                    primeProduct: { revenue: revenuePrimeProduct, forecast: forecastPrime },
                    service: { revenue: revenueService, forecast: forecastService },
                    pa: { revenue: revenuePA, forecast: forecastPA },
                    paService: {
                        revenue: revenuePA + revenueService,
                        forecast: forecastPA + forecastService
                    },
                    ck: { revenue: revenueCK, forecast: targetMap.get("CK") || 0 },
                    sis: { revenue: revenueSIS, forecast: targetMap.get("SIS") || 0 },
                    ma_oc: { revenue: salesmanRevenue.ma_oc, forecast: targetMap.get("MA OC") || 0 },
                    ma_wis: { revenue: salesmanRevenue.ma_wis, forecast: targetMap.get("MA WIS") || 0 },
                    ma_fq: { revenue: salesmanRevenue.ma_fq, forecast: targetMap.get("MA FQ") || 0 },
                    ma_bur: { revenue: salesmanRevenue.ma_bur, forecast: targetMap.get("MA BUR") || 0 },
                    ma_ag: { revenue: salesmanRevenue.ma_ag, forecast: targetMap.get("MA AG") || 0 },
                    ma_mic: { revenue: salesmanRevenue.ma_mic, forecast: targetMap.get("MA MIC") || 0 },
                },
                materials: materialsData.map(m => ({
                    desc: m.materialDesc || "Unknown",
                    revenue: Number(m.totalRevenue),
                    qty: Number(m.qty)
                })),
                revTypes: revTypeTable,
                matGroups: matGrp1Data.map(m => ({ desc: m.desc || "Unknown", revenue: Number(m.total) })),
                ytdChart: ytdData.map(y => ({ name: y.month, revenue: Number(y.rev) }))
            }
        };

    } catch (error) {
        console.error("Failed to fetch dashboard revenue forecast:", error);
        return { success: false, error: "Failed to fetch dashboard data" };
    }
}
