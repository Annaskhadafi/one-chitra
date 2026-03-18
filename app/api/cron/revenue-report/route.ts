import { NextResponse } from "next/server"
import { fetchDashboardRevenueForecast, fetchDashboardInventory } from "@/app/actions/dashboard-revenue-logic"
import { getRevenueReportConfig } from "@/app/actions/dashboard-revenue"
import { sendSystemTemplatedEmailByCode, resolveUserEmailsFromRolesAndIds } from "@/lib/email"
import { SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email-template-registry"
import { formatCurrency } from "@/lib/utils"
import { generateRevenueReportPdf } from "@/lib/revenue-report-pdf"

/**
 * GET /api/cron/revenue-report
 * 
 * Daily report automation triggered by Vercel Cron or similar.
 */
export async function GET(request: Request) {
    // 1. Security check - verify CRON_SECRET
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const authHeader = request.headers.get("authorization")
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    try {
        console.log("[CRON] Starting Revenue Report automation at", new Date().toISOString())

        // 2. Prepare periods (Current month)
        const now = new Date()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const year = now.getFullYear()
        const period = `${month}.${year}`

        // 3. Fetch Data & Config
        const [revenueRes, inventoryRes, configRes] = await Promise.all([
            fetchDashboardRevenueForecast({ period }),
            fetchDashboardInventory(),
            getRevenueReportConfig()
        ])

        if (!revenueRes.success || !inventoryRes.success || !configRes.success) {
            throw new Error("Failed to fetch dashboard data or configuration")
        }

        const rev = revenueRes.data!
        const inv = inventoryRes.data!
        const config = configRes.data!

        // Scheduling Logic (UTC+7 / WIB)
        const nowUtc = new Date().getTime()
        const wibTime = new Date(nowUtc + (7 * 60 * 60 * 1000))
        const currentHour = wibTime.getUTCHours()
        const currentDay = wibTime.getUTCDay() 
        const [schedHour] = (config.scheduleTime || "08:00").split(":").map(Number)

        if (currentHour !== schedHour) {
            return NextResponse.json({ success: true, message: `Skipped: Hour ${currentHour} != ${schedHour}` })
        }

        if (config.scheduleType === "weekly" || config.scheduleType === "custom") {
            const allowedDays = config.scheduleValue?.split(",") || []
            if (!allowedDays.includes(String(currentDay))) {
                return NextResponse.json({ success: true, message: "Skipped: Day mismatch" })
            }
        }

        // 4. Resolve Recipients
        const recipients = await resolveUserEmailsFromRolesAndIds(config.recipientRoles, config.recipientUserIds)
        
        if (recipients.length === 0) {
            console.log("[CRON] No recipients configured for revenue report. Skipping.")
            return NextResponse.json({ success: true, message: "No recipients configured" })
        }

        // 5. Generate PDF
        const pdfContent = await generateRevenueReportPdf({
            ...rev,
            inventory: inv
        })

        // 6. Format achievement percentages for email body (legacy support)
        const getPct = (actual: number, target: number) => 
            target > 0 ? ((actual / target) * 100).toFixed(1) : "0.0"

        // 7. Send Email
        const emailResult = await sendSystemTemplatedEmailByCode({
            code: SYSTEM_EMAIL_TEMPLATE_CODES.revenueReport,
            to: recipients,
            data: {
                period,
                customMessage: config.customMessage, // User-defined message
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

                actionUrl: "/dashboard/revenue-forecast"
            },
            // Add PDF Attachment
            attachments: [
                {
                    filename: `Revenue_Report_${period}.pdf`,
                    content: pdfContent,
                    contentType: "application/pdf"
                }
            ]
        })

        if (emailResult.success) {
            console.log("[CRON] Revenue report email sent successfully to", recipients.length, "users")
            return NextResponse.json({ success: true, message: "Report sent" })
        } else {
            console.error("[CRON] Failed to send email:", emailResult.error)
            return NextResponse.json({ success: false, error: emailResult.error }, { status: 500 })
        }

    } catch (error) {
        console.error("[CRON] Unexpected error in revenue report:", error)
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
        }, { status: 500 })
    }
}
