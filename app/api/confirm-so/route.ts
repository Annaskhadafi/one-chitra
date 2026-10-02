import { requireApiSession } from "@/lib/api-auth"
import { NextRequest } from "next/server"
import { db } from "@/db"
import { salesOrders } from "@/db/schema/sales-orders"
import { auditLogs } from "@/db/schema/audit-logs"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
    const session = await requireApiSession(req.headers)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const body = await req.json().catch(() => null)
    if (!body) {
        return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const { id } = body as { id?: number | string | null }
    const numericId = typeof id === "string" ? Number(id) : id
    if (!numericId || Number.isNaN(numericId)) {
        return Response.json({ error: "id is required" }, { status: 400 })
    }
    const [updated] = await db.update(salesOrders).set({
        status: "tervalidasi",
        updatedAt: new Date(),
    }).where(eq(salesOrders.id, numericId)).returning()
    if (!updated) {
        return Response.json({ error: "Sales Order not found" }, { status: 404 })
    }
    try {
        await db.insert(auditLogs).values({
            userId: session.user.id,
            action: "CONFIRM_SO",
            description: `Sales Order ${numericId} dikonfirmasi`,
        })
    } catch {}
    return Response.json({ id: updated.id, status: updated.status })
}
