import { NextRequest, NextResponse } from "next/server"
import { getRagSessionMessagesAction } from "@/app/actions/rag-growth"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/rag/sessions/[sessionId]/messages
 * Mengambil histori chat lengkap dari sesi tertentu
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await context.params
        if (!sessionId) {
            return NextResponse.json(
                { status: "error", message: "Parameter sessionId wajib disertakan" },
                { status: 400 }
            )
        }

        const result = await getRagSessionMessagesAction(sessionId)
        return NextResponse.json(result, { status: 200 })
    } catch (error) {
        console.error("[API GET /api/v1/rag/sessions/:sessionId/messages] Error:", error)
        return NextResponse.json(
            {
                status: "error",
                message: error instanceof Error ? error.message : "Internal Server Error",
                messages: [],
            },
            { status: 500 }
        )
    }
}
