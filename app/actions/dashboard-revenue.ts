import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
import { getAuthenticatedSession } from "@/lib/rbac"
import { 
    fetchDashboardRevenueForecast, 
    fetchDashboardInventory,
    DashboardRevenueFilters 
} from "./dashboard-revenue-logic"

export type { DashboardRevenueFilters }

export async function getAllSalesRevenueData(filters: DashboardRevenueFilters) {
    try {
        await getAuthenticatedSession("revenue-forecast", "view")
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

import { sql } from "drizzle-orm"

export async function getDashboardRevenueForecast(filters: DashboardRevenueFilters) {
    try {
        await getAuthenticatedSession("revenue-forecast", "view")
        return await fetchDashboardRevenueForecast(filters)
    } catch (error) {
        console.error("Failed to fetch dashboard revenue forecast:", error);
        return { success: false, error: "Failed to fetch dashboard data" };
    }
}

export async function getDashboardInventory() {
    try {
        await getAuthenticatedSession("revenue-forecast", "view")
        return await fetchDashboardInventory()
    } catch (error) {
        console.error("Failed to fetch dashboard inventory:", error);
        return { success: false, error: "Failed to fetch dashboard inventory" };
    }
}

import { sendSystemTemplatedEmailByCode, SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email"
import { formatCurrency } from "@/lib/utils"

export async function sendManualRevenueReport(period: string) {
    try {
        await getAuthenticatedSession("revenue-forecast", "view")

        const [revenueRes, inventoryRes] = await Promise.all([
            fetchDashboardRevenueForecast({ period }),
            fetchDashboardInventory()
        ])

        if (!revenueRes.success || !inventoryRes.success) {
            throw new Error("Failed to fetch data for report")
        }

        const rev = revenueRes.data!
        const inv = inventoryRes.data!

        // 4. Format achievement percentages
        const getPct = (actual: number, target: number) => 
            target > 0 ? ((actual / target) * 100).toFixed(1) : "0.0"

        // 5. Generate Salesman Table Rows
        const salesmanData = [
            { name: "MA OC", rev: rev.targets.ma_oc.revenue, target: rev.targets.ma_oc.forecast },
            { name: "MA WS", rev: rev.targets.ma_ws.revenue, target: rev.targets.ma_ws.forecast },
            { name: "MA FQ", rev: rev.targets.ma_fq.revenue, target: rev.targets.ma_fq.forecast },
            { name: "MA BR", rev: rev.targets.ma_br.revenue, target: rev.targets.ma_br.forecast },
            { name: "MA AG", rev: rev.targets.ma_ag.revenue, target: rev.targets.ma_ag.forecast },
            { name: "MA MC", rev: rev.targets.ma_mc.revenue, target: rev.targets.ma_mc.forecast },
        ]

        const salesmanTableRows = salesmanData.map(s => `
            <tr>
              <td style="padding:10px;border:1px solid #cbd5e1;">${s.name}</td>
              <td style="padding:10px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(s.rev)}</td>
              <td style="padding:10px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(s.target)}</td>
              <td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${getPct(s.rev, s.target)}%</td>
            </tr>
        `).join("")

        // 6. Generate Materials Table Rows (Top 10)
        const materialsTableRows = rev.materials.slice(0, 10).map((m, i) => `
            <tr>
              <td style="padding:10px;border:1px solid #cbd5e1;">${m.desc}</td>
              <td style="padding:10px;border:1px solid #cbd5e1;text-align:right;">${m.qty}</td>
              <td style="padding:10px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(m.revenue)}</td>
            </tr>
        `).join("")

        const materialsTextRows = rev.materials.slice(0, 10)
            .map(m => `- ${m.desc}: ${m.qty} pcs (${formatCurrency(m.revenue)})`)
            .join("\n")

        return await sendSystemTemplatedEmailByCode({
            code: SYSTEM_EMAIL_TEMPLATE_CODES.revenueReport,
            data: {
                period,
                consolidateRevenue: formatCurrency(rev.targets.consolidate.revenue),
                consolidateForecast: formatCurrency(rev.targets.consolidate.forecast),
                consolidatePct: getPct(rev.targets.consolidate.revenue, rev.targets.consolidate.forecast),
                
                primeProductRevenue: formatCurrency(rev.targets.primeProduct.revenue),
                primeProductForecast: formatCurrency(rev.targets.primeProduct.forecast),
                primeProductPct: getPct(rev.targets.primeProduct.revenue, rev.targets.primeProduct.forecast),
                
                serviceRevenue: formatCurrency(rev.targets.service.revenue),
                serviceForecast: formatCurrency(rev.targets.service.forecast),
                servicePct: getPct(rev.targets.service.revenue, rev.targets.service.forecast),
                
                paRevenue: formatCurrency(rev.targets.pa.revenue),
                paForecast: formatCurrency(rev.targets.pa.forecast),
                paPct: getPct(rev.targets.pa.revenue, rev.targets.pa.forecast),

                ckRevenue: formatCurrency(rev.targets.ck.revenue),
                ckPct: getPct(rev.targets.ck.revenue, rev.targets.ck.forecast),
                sisRevenue: formatCurrency(rev.targets.sis.revenue),
                sisPct: getPct(rev.targets.sis.revenue, rev.targets.sis.forecast),

                inventoryJasum: formatCurrency(inv.jasum),
                inventoryKalEi: formatCurrency(inv.kalEi),
                inventorySingapore: formatCurrency(inv.singapore),
                inventoryTotal: formatCurrency(inv.total),

                salesmanTableRows,
                materialsTableRows,
                materialsTextRows,
                actionUrl: "/dashboard/revenue-forecast"
            }
        })
    } catch (error) {
        console.error("Failed to send manual revenue report:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to send report" }
    }
}
