import { NextRequest, NextResponse } from "next/server"
import { getRagSessionsAction } from "@/app/actions/rag-growth"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/rag/sessions
 * Mengambil daftar riwayat sesi percakapan pengguna
 */
export async function GET(req: NextRequest) {
    try {
        const result = await getRagSessionsAction()
        return NextResponse.json(result, { status: 200 })
    } catch (error) {
        console.error("[API GET /api/v1/rag/sessions] Error:", error)
        return NextResponse.json(
            {
                status: "error",
                message: error instanceof Error ? error.message : "Internal Server Error",
                total_sessions: 0,
                sessions: [],
            },
            { status: 500 }
        )
    }
}
