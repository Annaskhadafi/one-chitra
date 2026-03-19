import { getCustomers } from "@/app/actions/customer"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { getSalesOrderPicUsers } from "@/app/actions/sales-order"
import { getEvhsMasterPrices } from "@/app/actions/evhs-master"
import { db } from "@/db"
import { ocrPoSessions } from "@/db/schema/ocr-po-sessions"
import { eq } from "drizzle-orm"
import ValidationSplit from "./validation-split"

export default async function OcrValidatePage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
    const params = await searchParams
    const sessionId = Number(params.session || 0)
    const [session] = sessionId
        ? await db.select().from(ocrPoSessions).where(eq(ocrPoSessions.id, sessionId)).limit(1)
        : []
    const [customers, products, warehouses, users, ckMasterPrices] = await Promise.all([
        getCustomers(),
        getProducts(),
        getWarehouses(),
        getSalesOrderPicUsers(),
        getEvhsMasterPrices(),
    ])
    return (
        <ValidationSplit
            session={session || null}
            customers={customers}
            products={products}
            warehouses={warehouses}
            users={users}
            ckMasterPrices={ckMasterPrices}
        />
    )
}
