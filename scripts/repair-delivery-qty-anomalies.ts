import "dotenv/config"
import { db } from "@/db"
import { deliveryItems } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

type RepairCandidate = {
    deliveryNumber: string
    deliveryId: number
    deliveryItemId: number
    productId: number
    materialNumber: string | null
    materialDescription: string | null
    salesOrderItemId: number | null
    soQty: number | null
    orderedQuantity: number
    deliveredQuantity: number
    serialCount: number
    correctedOrderedQuantity: number | null
    correctedDeliveredQuantity: number | null
}

async function loadRepairCandidates() {
    const result = await db.execute(sql<RepairCandidate>`
        select
            d.delivery_number as "deliveryNumber",
            d.id as "deliveryId",
            di.id as "deliveryItemId",
            di.product_id as "productId",
            p.material_number as "materialNumber",
            p.material_description as "materialDescription",
            di.sales_order_item_id as "salesOrderItemId",
            soi.quantity as "soQty",
            di.ordered_quantity as "orderedQuantity",
            di.delivered_quantity as "deliveredQuantity",
            coalesce(array_length(di.serial_numbers, 1), 0)::int as "serialCount",
            case
                when soi.id is not null then soi.quantity
                else null
            end as "correctedOrderedQuantity",
            case
                when coalesce(array_length(di.serial_numbers, 1), 0) > 0 then coalesce(array_length(di.serial_numbers, 1), 0)::int
                else null
            end as "correctedDeliveredQuantity"
        from delivery_items di
        join deliveries d on d.id = di.delivery_id
        left join sales_order_items soi on soi.id = di.sales_order_item_id
        left join products p on p.id = di.product_id
        where soi.id is not null
          and coalesce(array_length(di.serial_numbers, 1), 0) > 0
          and (
                di.delivered_quantity <> coalesce(array_length(di.serial_numbers, 1), 0)::int
             or di.ordered_quantity <> soi.quantity
          )
        order by d.delivery_number asc, di.id asc
    `)

    return result.rows.filter((row) =>
        row.correctedOrderedQuantity !== null && row.correctedDeliveredQuantity !== null,
    )
}

async function main() {
    const candidates = await loadRepairCandidates()

    if (candidates.length === 0) {
        console.log(JSON.stringify({
            repaired: 0,
            message: "No delivery qty anomalies found.",
        }, null, 2))
        return
    }

    await db.transaction(async (tx) => {
        for (const candidate of candidates) {
            await tx.update(deliveryItems)
                .set({
                    orderedQuantity: candidate.correctedOrderedQuantity as number,
                    deliveredQuantity: candidate.correctedDeliveredQuantity as number,
                })
                .where(eq(deliveryItems.id, candidate.deliveryItemId))
        }
    })

    const deliveryCount = new Set(candidates.map((candidate) => candidate.deliveryId)).size

    console.log(JSON.stringify({
        repaired: candidates.length,
        deliveryCount,
        sample: candidates.slice(0, 20),
    }, null, 2))
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Delivery qty repair failed:", error)
        process.exit(1)
    })
