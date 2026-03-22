import { NextRequest } from "next/server"
import { db } from "@/db"
import { salesOrders, salesOrderItems } from "@/db/schema/sales-orders"
import { auditLogs } from "@/db/schema/audit-logs"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

type DraftSoItemInput = {
    productId?: number | null
    qty?: number
    quantity?: number
    unitPrice?: number | string
    discount?: number | string
    tax?: number | string
}

type DraftSoPostInput = {
    customerId?: number
    customerPo?: string | null
    salesDate?: string | Date | null
    items?: DraftSoItemInput[]
    status?: string | null
    notes?: string | null
    discount?: number | string | null
    shipping?: number | string | null
    warehouseId?: number | null
    salesPersonId?: string | null
    poDocument?: string | null
    termsConditions?: string | null
}

type DraftSoPutInput = {
    id?: number
    status?: string | null
    items?: DraftSoItemInput[]
    notes?: string | null
    discount?: number | string | null
    shipping?: number | string | null
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null)
    if (!body) {
        return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const {
        customerId,
        customerPo,
        salesDate,
        items,
        status,
        notes,
        discount,
        shipping,
        warehouseId,
        salesPersonId,
        poDocument,
        termsConditions,
    } = body as DraftSoPostInput
    if (!customerId || !Array.isArray(items) || items.length === 0) {
        return Response.json({ error: "customerId and items are required" }, { status: 400 })
    }
    const [order] = await db
        .insert(salesOrders)
        .values({
            customerId,
            customerPo: customerPo || null,
            salesDate: salesDate ? new Date(salesDate) : new Date(),
            status: status || "ocr",
            notes: notes || null,
            discount: String(discount ?? 0),
            shipping: String(shipping ?? 0),
            warehouseId: warehouseId || null,
            salesPersonId: salesPersonId || null,
            poDocument: poDocument || null,
            termsConditions: termsConditions || null,
        })
        .returning()
    for (const item of items) {
        await db.insert(salesOrderItems).values({
            salesOrderId: order.id,
            productId: item.productId || null,
            quantity: Number(item.qty ?? item.quantity ?? 0),
            unitPrice: String(item.unitPrice ?? 0),
            discount: String(item.discount ?? 0),
            tax: String(item.tax ?? 0),
        })
    }
    return Response.json({ id: order.id, status: order.status })
}

export async function PUT(req: NextRequest) {
    const body = await req.json().catch(() => null)
    if (!body) {
        return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const { id, status, items, notes, discount, shipping } = body as DraftSoPutInput
    if (!id) {
        return Response.json({ error: "id is required" }, { status: 400 })
    }
    await db.update(salesOrders).set({
        status: status || undefined,
        notes: notes ?? undefined,
        discount: discount != null ? String(discount) : undefined,
        shipping: shipping != null ? String(shipping) : undefined,
        updatedAt: new Date(),
    }).where(eq(salesOrders.id, id))
    if (Array.isArray(items)) {
        await db.delete(salesOrderItems).where(eq(salesOrderItems.salesOrderId, id))
        for (const item of items) {
            await db.insert(salesOrderItems).values({
                salesOrderId: id,
                productId: item.productId || null,
                quantity: Number(item.qty ?? item.quantity ?? 0),
                unitPrice: String(item.unitPrice ?? 0),
                discount: String(item.discount ?? 0),
                tax: String(item.tax ?? 0),
            })
        }
    }
    try {
        await db.insert(auditLogs).values({
            userId: "system",
            action: "UPDATE_SO_DRAFT",
            description: `Sales Order ${id} draft diperbarui`,
        })
    } catch {}
    return Response.json({ id })
}
