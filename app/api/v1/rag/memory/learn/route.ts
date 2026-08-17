import { NextRequest, NextResponse } from "next/server"
import { learnMemoryFactAction } from "@/app/actions/rag-growth"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/rag/memory/learn
 * Endpoint langsung untuk mengajari AI fakta/aturan baru tanpa perlu upload file PDF
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}))
        const { topic, fact, source, tags, confidence_score, sync_to_vector } = body

        if (!fact || !fact.trim()) {
            return NextResponse.json(
                {
                    status: "error",
                    message: "Field 'fact' (isi fakta/aturan yang diajarkan) wajib diisi",
                },
                { status: 400 }
            )
        }

        const result = await learnMemoryFactAction({
            topic: topic || "Umum",
            fact: fact.trim(),
            source: source || "Self-Growth Input",
            tags: tags || [],
            confidenceScore: typeof confidence_score === "number" ? confidence_score : 1.0,
            syncToVector: sync_to_vector !== false,
        })

        if (result.status === "error") {
            return NextResponse.json(result, { status: 400 })
        }

        return NextResponse.json(result, { status: 200 })
    } catch (error) {
        console.error("[API POST /api/v1/rag/memory/learn] Error:", error)
        return NextResponse.json(
            {
                status: "error",
                message: error instanceof Error ? error.message : "Internal Server Error",
            },
            { status: 500 }
        )
    }
}
