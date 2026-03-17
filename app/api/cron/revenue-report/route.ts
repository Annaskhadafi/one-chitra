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

        // 7. Send Email
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
