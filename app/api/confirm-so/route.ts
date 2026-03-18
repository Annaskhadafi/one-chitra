import { NextRequest } from "next/server"
import { db } from "@/db"
import { salesOrders } from "@/db/schema/sales-orders"
import { auditLogs } from "@/db/schema/audit-logs"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null)
    if (!body) {
        return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const { id } = body as any
    if (!id) {
        return Response.json({ error: "id is required" }, { status: 400 })
    }
    const [updated] = await db.update(salesOrders).set({
        status: "tervalidasi",
        updatedAt: new Date(),
    }).where(eq(salesOrders.id, id)).returning()
    try {
        await db.insert(auditLogs).values({
            userId: "system",
            action: "CONFIRM_SO",
            description: `Sales Order ${id} dikonfirmasi`,
        })
    } catch {}
    return Response.json({ id: updated.id, status: updated.status })
}
