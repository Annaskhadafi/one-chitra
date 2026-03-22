import { NextResponse } from "next/server"
import { updateComparisonData } from "@/app/actions/inventory-ml"

/**
 * GET /api/cron/update-comparison-data
 *
 * Auto-update comparison data daily at 00:00 with latest sales data from SAP
 * Requirement 7.10
 *
 * Run this endpoint on a schedule (daily at 00:00 via cron job or Vercel Cron).
 * Secures the route with a CRON_SECRET env var.
 *
 * Vercel Cron configuration (add to vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/update-comparison-data",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 *
 * Or use curl for manual testing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/update-comparison-data
 */
export async function GET(request: Request) {
    // Security check - verify CRON_SECRET
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const authHeader = request.headers.get("authorization")
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    try {
        console.log("[CRON] Starting comparison data update at", new Date().toISOString())
        
        // Call the update function
        const result = await updateComparisonData()

        if (result.success) {
            console.log(`[CRON] Successfully updated ${result.updatedCount} predictions`)
            return NextResponse.json({
                success: true,
                message: result.message,
                updatedCount: result.updatedCount,
                timestamp: new Date().toISOString(),
            })
        } else {
            console.error("[CRON] Failed to update comparison data:", result.error)
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                    timestamp: new Date().toISOString(),
                },
                { status: 500 }
            )
        }
    } catch (error) {
        console.error("[CRON] Unexpected error during comparison data update:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred",
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        )
    }
}
