import { NextRequest, NextResponse } from "next/server"
import { getMemoryFactsAction } from "@/app/actions/rag-growth"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/rag/memory/facts
 * Menginspeksi daftar memori/fakta yang sudah dipelajari sistem
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const topic = searchParams.get("topic") || undefined
        const search = searchParams.get("search") || undefined
        const activeOnly = searchParams.get("active_only") === "true"

        const result = await getMemoryFactsAction({
            topic,
            search,
            activeOnly,
        })

        return NextResponse.json(result, { status: 200 })
    } catch (error) {
        console.error("[API GET /api/v1/rag/memory/facts] Error:", error)
        return NextResponse.json(
            {
                status: "error",
                message: error instanceof Error ? error.message : "Internal Server Error",
                total_facts: 0,
                facts: [],
            },
            { status: 500 }
        )
    }
}
