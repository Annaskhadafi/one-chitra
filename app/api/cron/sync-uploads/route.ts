import { NextResponse } from "next/server"
import { syncLocalUploadsToObjectStorage } from "@/lib/upload-storage"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const authHeader = request.headers.get("authorization")
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
    }

    try {
        const result = await syncLocalUploadsToObjectStorage({
            deleteLocalAfterSync: true,
            maxFiles: 200,
        })

        return NextResponse.json({
            ...result,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error("[CronSyncUploads] Error during upload sync:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown sync error",
            },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    return GET(request)
}
