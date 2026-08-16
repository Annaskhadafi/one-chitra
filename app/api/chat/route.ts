import { NextRequest, NextResponse } from "next/server"
import { chatWithRag } from "@/lib/raray-rag"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const messages = Array.isArray(body?.messages) ? body.messages : []
        const rawQuery = body?.query || messages[messages.length - 1]?.content
        const topK = typeof body?.top_k === "number" ? body.top_k : 4

        if (!rawQuery || typeof rawQuery !== "string" || !rawQuery.trim()) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 })
        }

        const ragResult = await chatWithRag(rawQuery, topK)

        if (ragResult.status === "error" || !ragResult.data) {
            return NextResponse.json(
                { error: ragResult.error || "RAG backend failed to generate response" },
                { status: 500 }
            )
        }

        return NextResponse.json({
            role: "assistant",
            content: ragResult.data.answer,
            sources: ragResult.data.sources || [],
            latency_ms: ragResult.data.latency_ms ?? 0,
        })
    } catch (error) {
        console.error("[/api/chat] Error:", error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}
