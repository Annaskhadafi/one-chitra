import { requireApiSession } from "@/lib/api-auth"
import { NextRequest } from "next/server"
import { mapExtractedToMaster } from "@/lib/so-mapping"

type ExtractedPayload = Parameters<typeof mapExtractedToMaster>[0]

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
    const session = await requireApiSession(req.headers)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const body = await req.json().catch(() => null)
    if (!body) {
        return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const { extracted } = body as { extracted?: unknown }
    if (!extracted) {
        return Response.json({ error: "extracted is required" }, { status: 400 })
    }
    const result = await mapExtractedToMaster(extracted as ExtractedPayload)
    return Response.json(result)
}
