import { NextRequest, NextResponse } from "next/server"
import { submitRagFeedbackAction } from "@/app/actions/rag-growth"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/rag/feedback
 * Menerima rating (thumbs up/down) dan teks koreksi/masukan untuk self-growth
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}))
        const { query, answer, rating, correction, session_id, message_id, auto_learn } = body

        if (!query || !answer || !rating) {
            return NextResponse.json(
                {
                    status: "error",
                    message: "Field 'query', 'answer', dan 'rating' (thumbs_up/thumbs_down) wajib diisi",
                },
                { status: 400 }
            )
        }

        const result = await submitRagFeedbackAction({
            query,
            answer,
            rating,
            correction: correction || undefined,
            sessionId: session_id || undefined,
            messageId: message_id || undefined,
            autoLearnCorrection: auto_learn !== false,
        })

        if (result.status === "error") {
            return NextResponse.json(result, { status: 400 })
        }

        return NextResponse.json(result, { status: 200 })
    } catch (error) {
        console.error("[API POST /api/v1/rag/feedback] Error:", error)
        return NextResponse.json(
            {
                status: "error",
                message: error instanceof Error ? error.message : "Internal Server Error",
            },
            { status: 500 }
        )
    }
}
