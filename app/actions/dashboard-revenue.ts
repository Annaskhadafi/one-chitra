"use server"
import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema/sap"
import { settings } from "@/db/schema/settings"
import { getAuthenticatedSession } from "@/lib/rbac"
import { eq } from "drizzle-orm"
import type { DashboardRevenueFilters } from "./dashboard-revenue-logic"
import { 
    fetchDashboardRevenueForecast, 
    fetchDashboardInventory,
    fetchAllSalesRevenueData,
    fetchRevenueReportConfig,
    type RevenueReportConfig
} from "./dashboard-revenue-logic"



export async function getAllSalesRevenueData(filters: DashboardRevenueFilters) {
    try {
        await getAuthenticatedSession("revenue-forecast", "view")
        return await fetchAllSalesRevenueData(filters)
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

import { sendSystemTemplatedEmailByCode } from "@/lib/email"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"
import { formatCurrency } from "@/lib/utils"

import { generateRevenueReportPdf } from "@/lib/revenue-report-pdf"
import { resolveUserEmailsFromRolesAndIds } from "@/lib/email"

export async function sendManualRevenueReport(period: string) {
    try {
        console.log(`[RevenueReport] Starting manual report for period: ${period}`)
        await getAuthenticatedSession("revenue-forecast", "view")

        const [revenueRes, inventoryRes, configRes] = await Promise.all([
            fetchDashboardRevenueForecast({ period }),
            fetchDashboardInventory(),
            getRevenueReportConfig()
        ])

        if (!revenueRes.success || !inventoryRes.success || !configRes.success) {
            console.error("[RevenueReport] Failed to fetch data:", { 
                rev: revenueRes.success, 
                inv: inventoryRes.success, 
                conf: configRes.success 
            })
            throw new Error("Failed to fetch dashboard data or configuration")
        }

        const rev = revenueRes.data!
        const inv = inventoryRes.data!
        const config = configRes.data!

        console.log(`[RevenueReport] Resolving recipients for roles: ${config.recipientRoles.join(', ')}`)
        const recipients = await resolveUserEmailsFromRolesAndIds(config.recipientRoles, config.recipientUserIds)
        
        if (recipients.length === 0) {
            console.warn("[RevenueReport] No recipients resolved.")
            return { success: false, error: "No recipients configured for revenue report." }
        }

        console.log(`[RevenueReport] Generating PDF for ${recipients.length} recipients...`)
        const pdfContent = await generateRevenueReportPdf({
            ...rev,
            inventory: inv
        })

        console.log(`[RevenueReport] Sending email via system template...`)
        const result = await sendSystemTemplatedEmailByCode({
            code: SYSTEM_EMAIL_TEMPLATE_CODES.revenueReport,
            to: recipients,
            data: {
                period,
                customMessage: config.customMessage,
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

                inventoryTotal: formatCurrency(inv.total),
                actionUrl: "/dashboard/revenue-forecast"
            },
            ignoreTemplateRecipients: true,
            attachments: [
                {
                    filename: `Revenue_Report_${period}.pdf`,
                    content: pdfContent,
                    contentType: "application/pdf"
                }
            ]
        })

        if (result.success) console.log("[RevenueReport] Manual report sent successfully")
        else console.error("[RevenueReport] Failed to send email:", result.error)

        return result
    } catch (error) {
        console.error("Failed to send manual revenue report:", error)
        return { success: false, error: error instanceof Error ? error.message : "Failed to send report" }
    }
}

const getPct = (actual: number, target: number) => 
    target > 0 ? ((actual / target) * 100).toFixed(1) : "0.0"


export async function getRevenueReportConfig() {
    try {
        await getAuthenticatedSession("revenue-forecast", "view")
        return await fetchRevenueReportConfig()
    } catch (error) {
        console.error("Failed to fetch revenue report config:", error)
        return { success: false, error: "Failed to fetch configuration" }
    }
}


export async function saveRevenueReportConfig(config: RevenueReportConfig) {
    try {
        await getAuthenticatedSession("revenue-forecast", "edit")
        
        const value = JSON.stringify(config)
        
        const existing = await db.select().from(settings).where(eq(settings.key, "revenue_report_config")).limit(1)
        
        if (existing.length > 0) {
            await db.update(settings)
                .set({ value, updatedAt: new Date() })
                .where(eq(settings.key, "revenue_report_config"))
        } else {
            await db.insert(settings)
                .values({ key: "revenue_report_config", value })
        }

        return { success: true }
    } catch (error) {
        console.error("Failed to save revenue report config:", error)
        return { success: false, error: "Failed to save configuration" }
    }
}
