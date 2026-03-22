import { getCustomers } from "@/app/actions/customer"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { getSalesOrderPicUsers } from "@/app/actions/sales-order"
import { getEvhsMasterPrices } from "@/app/actions/evhs-master"
import { db } from "@/db"
import { ocrPoSessions } from "@/db/schema/ocr-po-sessions"
import { quotations } from "@/db/schema"
import { eq } from "drizzle-orm"
import ValidationSplit from "./validation-split"

export default async function OcrValidatePage({ searchParams }: { searchParams: Promise<{ session?: string; quotation?: string }> }) {
    const params = await searchParams
    const sessionId = Number(params.session || 0)
    const quotationId = Number(params.quotation || 0)
    const [session, quotation] = await Promise.all([
        sessionId
            ? db.select().from(ocrPoSessions).where(eq(ocrPoSessions.id, sessionId)).limit(1).then((rows) => rows[0] || null)
            : Promise.resolve(null),
        quotationId
            ? db.query.quotations.findFirst({
                where: eq(quotations.id, quotationId),
                with: {
                    customer: true,
                    createdByUser: true,
                    items: {
                        with: {
                            product: true,
                        },
                    },
                },
            })
            : Promise.resolve(null),
    ])
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
            quotation={quotation || null}
            quotationId={Number.isInteger(quotationId) && quotationId > 0 ? quotationId : null}
            customers={customers}
            products={products}
            warehouses={warehouses}
            users={users}
            ckMasterPrices={ckMasterPrices}
        />
    )
}
