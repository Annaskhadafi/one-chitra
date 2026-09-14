import { db } from "@/db"
import { salesRevenueSap, zmc9StockSap } from "@/db/schema/sap"
import { forecasts } from "@/db/schema/forecasts"
import { eq, sql, and, isNotNull, or, isNull, notIlike, ilike, not } from "drizzle-orm"
import { settings } from "@/db/schema/settings"
import { normalizeRevenueReportConfig, type RevenueReportConfig } from "@/lib/revenue-report-config"
import { mergeRevenueTypeTotals } from "@/lib/revenue-type"
import { salesRevenueCountableQty } from "@/lib/sales-revenue-sql"

export interface DashboardRevenueFilters {
    period: string; // MM.YYYY or YYYY
    range?: "this-week" | "this-month" | "this-quarter";
}

function getPeriodBounds(period: string) {
    const isYearlyView = !period.includes(".");

    if (isYearlyView) {
        const year = Number(period);
        return {
            startDate: `${year}-01-01`,
            endDate: `${year}-12-31`,
        };
    }

    const [monthStr, yearStr] = period.split(".");
    const month = Number(monthStr);
    const year = Number(yearStr);
    const lastDay = new Date(year, month, 0).getDate();

    return {
        startDate: `${yearStr}-${monthStr.padStart(2, "0")}-01`,
        endDate: `${yearStr}-${monthStr.padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
}

export async function fetchDashboardRevenueForecast(filters: DashboardRevenueFilters) {
    const periodStr = filters.period;
    const isYearlyView = !periodStr.includes('.');
    const [, year] = isYearlyView ? ["", periodStr] : periodStr.split('.');
    const requestedPeriodKey = isYearlyView
        ? Number(year) * 12 + 11
        : Number(year) * 12 + Number(periodStr.split('.')[0]) - 1;
    const now = new Date();
    const currentPeriodKey = now.getFullYear() * 12 + now.getMonth();
    const combineMaFq = requestedPeriodKey >= currentPeriodKey;
    const { startDate, endDate } = getPeriodBounds(periodStr);
    const rangeDateFilter = and(
        sql`${salesRevenueSap.billingDate} >= ${startDate}`,
        sql`${salesRevenueSap.billingDate} <= ${endDate}`,
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
    const primeProdMatGrpFilter = and(
        or(
            ilike(salesRevenueSap.matGrpDesc, '%TIRE%'),
            ilike(salesRevenueSap.matGrpDesc, '%TYRE%'),
            ilike(salesRevenueSap.matGrpDesc, '%TYR%')
        ),
        not(ilike(salesRevenueSap.matGrpDesc, '%ACCESS%'))
    );

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
    const paMtGrpFilter = not(primeProdMatGrpFilter);

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

    const revTypeTable = mergeRevenueTypeTotals(
        revTypeData.map((item) => ({
            type: item.type,
            total: Number(item.total),
        }))
    );

    const revTypeMap = new Map(
        revTypeTable.map((item) => [item.type.toUpperCase(), item.total])
    );

    const pinnedRevTypes = ["TRADING", "REPAIR", "SERVICE", "RETREAD"].map((type) => ({
        type,
        total: revTypeMap.get(type) ?? 0,
    }));

    const extraRevTypes = revTypeTable
        .filter((item) => !["TRADING", "REPAIR", "SERVICE", "RETREAD"].includes(item.type.toUpperCase()))
        .sort((a, b) => b.total - a.total);

    const finalRevTypeTable = [...pinnedRevTypes, ...extraRevTypes];

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
        qty: sql<number>`SUM(${salesRevenueCountableQty})`
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

    const yearlyChartData = isYearlyView
        ? [{
            name: periodStr,
            revenue: revenueConsolidate,
            forecast: forecastConsolidate,
        }]
        : ytdData.map(y => ({
            name: y.month,
            revenue: Number(y.rev),
            forecast: forecastMap.get(y.month || "") || 0,
        }))

    return {
        success: true,
        data: {
            period: periodStr,
            isYearlyView,
            combineMaFq,
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
                ma_ag: {
                    revenue: salesmanRevenue.ma_ag + (combineMaFq ? salesmanRevenue.ma_fq : 0),
                    forecast: (targetMap.get("MA AG") || 0) + (combineMaFq ? (targetMap.get("MA FQ") || 0) : 0)
                },
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
            revTypes: finalRevTypeTable,
            matGroups: matGrp1Data.map(m => ({ desc: m.desc || "Unknown", revenue: Number(m.total) })),
            ytdChart: yearlyChartData
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
        const { startDate, endDate } = getPeriodBounds(periodStr);

        // Date filter
        const dateFormat = isYearlyView ? 'YYYY' : 'MM.YYYY';
        const dateFilter = sql`to_char(${salesRevenueSap.billingDate}, ${dateFormat}) = ${periodStr}`;
        const rangeDateFilter = and(
            sql`${salesRevenueSap.billingDate} >= ${startDate}`,
            sql`${salesRevenueSap.billingDate} <= ${endDate}`,
        );
        const salesRevenueFilter = and(
            isNotNull(salesRevenueSap.billingDate),
            dateFilter,
            rangeDateFilter,
        );

        // Fetch all data
        const rawData = await db.select().from(salesRevenueSap).where(salesRevenueFilter);
        const allData = rawData.map(row => ({
            ...row,
            billingNo: row.billingNo?.endsWith('.0') ? row.billingNo.slice(0, -2) : row.billingNo
        }));

        // Calculate total revenue_in_loc_curr
        const totalResult = await db.select({
            total: sql<number>`SUM(COALESCE(${salesRevenueSap.revenueInLocCurr}, 0))`
        }).from(salesRevenueSap).where(salesRevenueFilter);

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

export async function fetchRevenueReportConfig() {
    try {
        const result = await db.select().from(settings).where(eq(settings.key, "revenue_report_config")).limit(1)
        
        if (result.length === 0) {
            return {
                success: true,
                data: normalizeRevenueReportConfig(null) as RevenueReportConfig,
            }
        }

        const rawData = JSON.parse(result[0].value)
        const data = normalizeRevenueReportConfig(rawData)

        return {
            success: true,
            data
        }
    } catch (error) {
        console.error("Failed to fetch revenue report config:", error)
        return { success: false, error: "Failed to fetch configuration" }
    }
}
