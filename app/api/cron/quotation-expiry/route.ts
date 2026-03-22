import { NextResponse } from "next/server"
import { expireQuotations } from "@/app/actions/quotation"

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const authHeader = request.headers.get("authorization")
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    const result = await expireQuotations()

    if (!result.success) {
        return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        expired: result.expired,
        timestamp: new Date().toISOString(),
    })
}
