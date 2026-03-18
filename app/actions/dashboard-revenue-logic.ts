import { db } from "@/db"
import { salesRevenueSap, zmc9StockSap } from "@/db/schema/sap"
import { forecasts } from "@/db/schema/forecasts"
import { eq, sql, and, isNotNull, or, isNull, notIlike, ilike } from "drizzle-orm"

export interface DashboardRevenueFilters {
    period: string; // MM.YYYY or YYYY
    range?: "this-week" | "this-month" | "this-quarter";
}

function getRangeBounds(range: "this-week" | "this-month" | "this-quarter") {
    const now = new Date();
    const endDate = new Date(now);

    if (range === "this-week") {
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        return { startDate, endDate };
    }

    if (range === "this-quarter") {
        const startMonth = Math.floor(now.getMonth() / 3) * 3;
        const startDate = new Date(now.getFullYear(), startMonth, 1);
        startDate.setHours(0, 0, 0, 0);
        return { startDate, endDate };
    }

    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate };
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

export async function fetchDashboardRevenueForecast(filters: DashboardRevenueFilters) {
    const periodStr = filters.period;
    const range = filters.range || "this-month";
    const isYearlyView = !periodStr.includes('.');
    const [, year] = isYearlyView ? ["", periodStr] : periodStr.split('.');
    const { startDate, endDate } = getRangeBounds(range);
    const rangeDateFilter = and(
        sql`${salesRevenueSap.billingDate} >= ${startDate.toISOString().slice(0, 10)}`,
        sql`${salesRevenueSap.billingDate} <= ${endDate.toISOString().slice(0, 10)}`,
    );

    // 1. Fetch Forecast for the requested period
    const forecastData = await db.select().from(forecasts).where(eq(forecasts.period, periodStr));

    const targetMap = new Map<string, number>();
    forecastData.forEach(item => {
        targetMap.set(item.targetName, item.amount);
    });

    // 2. Date filter
    const dateFormat = isYearlyView ? 'YYYY' : 'MM.YYYY';
    const dateFilter = sql`to_char(${salesRevenueSap.billingDate}, ${dateFormat}) = ${periodStr}`;
    const baseFilter = and(
        isNotNull(salesRevenueSap.billingDate),
        dateFilter,
        rangeDateFilter,
        or(
            isNull(salesRevenueSap.customerName),
            notIlike(salesRevenueSap.customerName, '%Chitra Paratama Singapore Branch%')
        ),
        // Exclude ITC008, 1000289A, and Chitra Paratama groups
        notIlike(salesRevenueSap.customer, '%ITC008%'),
        notIlike(salesRevenueSap.customer, '%1000289A%'),
        notIlike(salesRevenueSap.customerName, '%Chitra Paratama%'),
        notIlike(salesRevenueSap.customerName, '%Transityre b.v%')
    );

    // ─── A. Revenue Prime Product ───────────────────────────────────────────
    const primeProdMatGrpFilter = sql`upper(trim(${salesRevenueSap.matGrpDesc})) = ANY(ARRAY[${sql.raw(
        PRIME_PRODUCT_MAT_GRPS.map(g => `'${g}'`).join(', ')
    )}]::text[])`;

    const primeProductData = await db.select({
        total: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
    }).from(salesRevenueSap).where(and(
        baseFilter,
        ilike(salesRevenueSap.revType, 'Trading'),
        primeProdMatGrpFilter
    ));
    const revenuePrimeProduct = Number(primeProductData[0]?.total || 0);

    // ─── B. Revenue Service ─────────────────────────────────────────────────
    const serviceData = await db.select({
        total: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
    }).from(salesRevenueSap).where(and(
        baseFilter,
        notIlike(salesRevenueSap.revType, 'Trading')
    ));
    const revenueService = Number(serviceData[0]?.total || 0);

    // ─── C. Revenue PA (Product Accessories) ───────────────────────────────
    const paMtGrpFilter = sql`upper(trim(${salesRevenueSap.matGrpDesc})) = ANY(ARRAY[${sql.raw(
        PA_MAT_GRPS.map(g => `'${g}'`).join(', ')
    )}]::text[])`;

    const paData = await db.select({
        total: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
    }).from(salesRevenueSap).where(and(
        baseFilter,
        ilike(salesRevenueSap.revType, 'Trading'),
        paMtGrpFilter
    ));
    const revenuePA = Number(paData[0]?.total || 0);

    // ─── D. Consolidate = Total Revenue (same exclusions, no range filter) ──
    const consolidateFilter = and(
        isNotNull(salesRevenueSap.billingDate),
        dateFilter,
        or(
            isNull(salesRevenueSap.customerName),
            notIlike(salesRevenueSap.customerName, '%Chitra Paratama Singapore Branch%')
        ),
        notIlike(salesRevenueSap.customer, '%ITC008%'),
        notIlike(salesRevenueSap.customer, '%1000289A%'),
        notIlike(salesRevenueSap.customerName, '%Chitra Paratama%'),
        notIlike(salesRevenueSap.customerName, '%Transityre b.v%')
    );
    const consolidateData = await db.select({
        total: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
    }).from(salesRevenueSap).where(consolidateFilter);
    const revenueConsolidate = Number(consolidateData[0]?.total || 0);

    // ─── E. Forecast Consolidate = Inputted value ──────────────────────────
    const forecastPrime = targetMap.get("Prime Product") || 0;
    const forecastService = targetMap.get("Service") || 0;
    const forecastPA = targetMap.get("PA") || 0;
    const forecastConsolidate = targetMap.get("Consolidate") || 0;

    // ─── F. Revenue By Customer (CK vs SIS) ────────────────────────────────
    const customerRevenueData = await db.select({
        cust: salesRevenueSap.customerName,
        total: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
    }).from(salesRevenueSap).where(baseFilter).groupBy(salesRevenueSap.customerName);

    let revenueCK = 0;
    let revenueSIS = 0;
    customerRevenueData.forEach(c => {
        const name = (c.cust || "").toUpperCase();
        if (name === 'PT. CIPTA KRIDATAMA') revenueCK += Number(c.total);
        if (name === 'PT. SAPTAINDRA SEJATI') revenueSIS += Number(c.total);
    });

    // ─── G. Salesman Revenue ────────────────────────────────────────────────
    const salesData = await db.select({
        salesman: salesRevenueSap.salesman,
        total: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
    }).from(salesRevenueSap).where(baseFilter).groupBy(salesRevenueSap.salesman);

    const salesmanRevenue: Record<string, number> = {
        ma_oc: 0, ma_ws: 0, ma_fq: 0, ma_br: 0, ma_ag: 0, ma_mc: 0
    };
    const ocNames = ["OCKY HEGAR PRATAMA", "ZULFIKAR", "MUHAMMAD IKBAL LAISA", "NUR SABRINA FAZLIHUL UMAR", "BAMBANG IRAWAN", "TOMMY INDRA ALDINY RAMBE"];
    const mcNames = ["MICHAEL ADRIAN", "FEBRIAL HARIRI"];
    const agNames = ["AGUNG ARI PRASETIO"];
    const wsNames = ["RIKI DARMAWAN", "GREGORIUS DWIJOSAPUTRA RAHARJO", "KETUT SADHUNATA WISNUKEPAKISAN"];
    const brNames = ["BURI ANTONI", "HARRIZ ICHWAN"];
    const fqNames = ["MUHAMMAD FURQAN"];

    salesData.forEach(s => {
        const name = (s.salesman || "").toUpperCase().trim();
        if (ocNames.includes(name)) salesmanRevenue.ma_oc += Number(s.total);
        else if (wsNames.includes(name)) salesmanRevenue.ma_ws += Number(s.total);
        else if (fqNames.includes(name)) salesmanRevenue.ma_fq += Number(s.total);
        else if (brNames.includes(name)) salesmanRevenue.ma_br += Number(s.total);
        else if (agNames.includes(name)) salesmanRevenue.ma_ag += Number(s.total);
        else if (mcNames.includes(name)) salesmanRevenue.ma_mc += Number(s.total);
    });

    // ─── H. Rev Type Table ──────────────────────────────────────────────────
    const revTypeData = await db.select({
        type: salesRevenueSap.revType,
        total: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
    }).from(salesRevenueSap).where(baseFilter).groupBy(salesRevenueSap.revType);

    const revTypeTable = revTypeData
        .filter(r => {
            const type = (r.type || "").toUpperCase();
            return type === 'REPAIR' || type === 'SERVICE' || type === 'RETREAD';
        })
        .map(r => ({
            type: r.type || "Unknown",
            total: Number(r.total)
        })).sort((a, b) => b.total - a.total);

    // ─── I. Product Accessories Detail ─────────────────────────────────────
    const matGrp1Data = await db.select({
        desc: salesRevenueSap.matGrp1Desc,
        total: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
    }).from(salesRevenueSap).where(and(baseFilter, paMtGrpFilter, ilike(salesRevenueSap.revType, 'Trading')))
        .groupBy(salesRevenueSap.matGrp1Desc)
        .orderBy(sql`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0)) DESC`);

    // ─── J. Top Materials (Rank Material Sell Out) ─────────────────────────
    const materialsData = await db.select({
        materialDesc: salesRevenueSap.materialDescription,
        totalRevenue: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`,
        qty: sql<number>`SUM(COALESCE(${salesRevenueSap.qty}, 0))`
    }).from(salesRevenueSap)
        .where(and(baseFilter, ilike(salesRevenueSap.revType, 'Trading')))
        .groupBy(salesRevenueSap.materialDescription)
        .orderBy(sql`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0)) DESC`)
        .limit(20);

    // ─── K. YTD Revenue Chart ───────────────────────────────────────────────
    const baseFilterYTD = and(
        isNotNull(salesRevenueSap.billingDate),
        sql`to_char(${salesRevenueSap.billingDate}, 'YYYY') = ${year}`,
        or(
            isNull(salesRevenueSap.customerName),
            notIlike(salesRevenueSap.customerName, '%Chitra Paratama Singapore Branch%')
        ),
        // Exclude ITC008, 1000289A, and Chitra Paratama groups
        notIlike(salesRevenueSap.customer, '%ITC008%'),
        notIlike(salesRevenueSap.customer, '%1000289A%'),
        notIlike(salesRevenueSap.customerName, '%Chitra Paratama%'),
        notIlike(salesRevenueSap.customerName, '%Transityre b.v%')
    );

    const ytdData = await db.select({
        month: sql<string>`to_char(${salesRevenueSap.billingDate}, 'MM.YYYY')`,
        rev: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
    }).from(salesRevenueSap)
        .where(baseFilterYTD)
        .groupBy(sql`to_char(${salesRevenueSap.billingDate}, 'MM.YYYY')`)
        .orderBy(sql`to_char(${salesRevenueSap.billingDate}, 'MM.YYYY')`);

    const forecastYtdData = await db.select().from(forecasts).where(
        and(
            ilike(forecasts.period, `%${year}`),
            eq(forecasts.targetName, 'Consolidate')
        )
    );
    const forecastMap = new Map<string, number>();
    forecastYtdData.forEach(f => forecastMap.set(f.period || "", f.amount));

    // ─── L. Top 5 Customer by Revenue in Local Currency ───────────────────
    const topCustomersLocCurr = await db.select({
        customerName: salesRevenueSap.customerName,
        revenueInLocCurr: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
    }).from(salesRevenueSap)
        .where(baseFilter)
        .groupBy(salesRevenueSap.customerName)
        .orderBy(sql`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0)) DESC`)
        .limit(5);

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
                ma_ws: { revenue: salesmanRevenue.ma_ws, forecast: targetMap.get("MA WIS") || targetMap.get("MA WS") || 0 },
                ma_fq: { revenue: salesmanRevenue.ma_fq, forecast: targetMap.get("MA FQ") || 0 },
                ma_br: { revenue: salesmanRevenue.ma_br, forecast: targetMap.get("MA BUR") || targetMap.get("MA BR") || 0 },
                ma_ag: { revenue: salesmanRevenue.ma_ag, forecast: targetMap.get("MA AG") || 0 },
                ma_mc: { revenue: salesmanRevenue.ma_mc, forecast: targetMap.get("MA MIC") || targetMap.get("MA MC") || 0 },
            },
            materials: materialsData.map(m => ({
                desc: m.materialDesc || "Unknown",
                revenue: Number(m.totalRevenue),
                qty: Number(m.qty)
            })),
            topCustomersLocCurr: topCustomersLocCurr.map(c => ({
                customerName: c.customerName || "Unknown",
                revenueInLocCurr: Number(c.revenueInLocCurr || 0)
            })),
            revTypes: revTypeTable,
            matGroups: matGrp1Data.map(m => ({ desc: m.desc || "Unknown", revenue: Number(m.total) })),
            ytdChart: ytdData.map(y => ({ name: y.month, revenue: Number(y.rev), forecast: forecastMap.get(y.month || "") || 0 }))
        }
    };
}

export async function fetchDashboardInventory() {
    const inventoryData = await db.select({
        plantCode: zmc9StockSap.plantCode,
        valueStock: sql<number>`SUM(COALESCE(${zmc9StockSap.valueStock}, 0))`
    }).from(zmc9StockSap)
    .groupBy(zmc9StockSap.plantCode);

    let jasum = 0;
    let kalEi = 0;
    let singapore = 0;

    inventoryData.forEach(item => {
        const val = Number(item.valueStock) || 0;
        switch(item.plantCode) {
            case "2000": jasum += val; break;
            case "2001":
            case "2002": kalEi += val; break;
            case "2200": singapore += val; break;
            default: break;
        }
    });

    return {
        success: true,
        data: { jasum, kalEi, singapore, total: jasum + kalEi + singapore }
    };
}

export async function fetchAllSalesRevenueData(filters: DashboardRevenueFilters) {
    try {
        const periodStr = filters.period || "02.2026";
        const isYearlyView = !periodStr.includes('.');

        // Date filter
        const dateFormat = isYearlyView ? 'YYYY' : 'MM.YYYY';
        const dateFilter = sql`to_char(${salesRevenueSap.billingDate}, ${dateFormat}) = ${periodStr}`;

        // Fetch all data
        const allData = await db.select().from(salesRevenueSap).where(dateFilter);

        // Calculate total revenue_in_loc_curr
        const totalResult = await db.select({
            total: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
        }).from(salesRevenueSap).where(dateFilter);

        const totalRevenue = Number(totalResult[0]?.total || 0);

        return {
            success: true,
            data: allData,
            total: totalRevenue,
            count: allData.length
        };
    } catch (error) {
        console.error("Failed to fetch all sales revenue data:", error);
        return { success: false, error: "Failed to fetch sales revenue data" };
    }
}
