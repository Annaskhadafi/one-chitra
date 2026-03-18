import { getCustomers } from "@/app/actions/customer"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { getSalesOrderPicUsers } from "@/app/actions/sales-order"
import { db } from "@/db"
import { ocrPoSessions } from "@/db/schema/ocr-po-sessions"
import { eq } from "drizzle-orm"
import ValidationSplit from "./validation-split"

export default async function OcrValidatePage({ searchParams }: { searchParams: { session?: string } }) {
    const sessionId = Number(searchParams.session || 0)
    const [session] = sessionId
        ? await db.select().from(ocrPoSessions).where(eq(ocrPoSessions.id, sessionId)).limit(1)
        : []
    const [customers, products, warehouses, users] = await Promise.all([
        getCustomers(),
        getProducts(),
        getWarehouses(),
        getSalesOrderPicUsers(),
    ])
    return (
        <ValidationSplit
            session={session || null}
            customers={customers}
            products={products}
            warehouses={warehouses}
            users={users}
        />
    )
}
