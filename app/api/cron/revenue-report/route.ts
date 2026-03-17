import { NextResponse } from "next/server"
import { fetchDashboardRevenueForecast, fetchDashboardInventory } from "@/app/actions/dashboard-revenue-logic"
import { sendSystemTemplatedEmailByCode, SYSTEM_EMAIL_TEMPLATE_CODES } from "@/lib/email"
import { formatCurrency } from "@/lib/utils"
import { toCanonicalAppUrl } from "@/lib/app-url"

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

        // 3. Fetch Data
        const [revenueRes, inventoryRes] = await Promise.all([
            fetchDashboardRevenueForecast({ period }),
            fetchDashboardInventory()
        ])

        if (!revenueRes.success || !inventoryRes.success) {
            throw new Error("Failed to fetch dashboard data")
        }

        const rev = revenueRes.data!
        const inv = inventoryRes.data!

        // 4. Format achievement percentages
        const getPct = (actual: number, target: number) => 
            target > 0 ? ((actual / target) * 100).toFixed(1) : "0.0"

        // 5. Generate Materials Table Rows (Top 10)
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

        // 6. Send Email
        const emailResult = await sendSystemTemplatedEmailByCode({
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

                inventoryJasum: formatCurrency(inv.jasum),
                inventoryKalEi: formatCurrency(inv.kalEi),
                inventorySingapore: formatCurrency(inv.singapore),
                inventoryTotal: formatCurrency(inv.total),

                materialsTableRows,
                materialsTextRows,
                actionUrl: "/dashboard/revenue-forecast"
            }
        })

        if (emailResult.success) {
            console.log("[CRON] Revenue report email sent successfully")
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
