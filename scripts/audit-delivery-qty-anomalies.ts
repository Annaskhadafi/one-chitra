import "dotenv/config"
import { db } from "@/db"
import { sql } from "drizzle-orm"

type SummaryRow = {
    deliveryCount: number
    deliveryItemCount: number
    withSerialCount: number
    maxQtyMultiplier: string | number | null
}

type DetailRow = {
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
    qtyMultiplier: string | number | null
    transferQty: number | null
    movementQtyAbs: number | null
}

async function main() {
    const [summaryResult, detailsResult] = await Promise.all([
        db.execute(sql<SummaryRow>`
            with anomalous_items as (
                select
                    d.id as delivery_id,
                    di.id as delivery_item_id,
                    di.delivered_quantity,
                    coalesce(array_length(di.serial_numbers, 1), 0) as serial_count,
                    soi.quantity as so_qty
                from delivery_items di
                join deliveries d on d.id = di.delivery_id
                left join sales_order_items soi on soi.id = di.sales_order_item_id
                where soi.id is not null
                  and (di.delivered_quantity > soi.quantity or di.ordered_quantity > soi.quantity)
            )
            select
                count(distinct delivery_id)::int as "deliveryCount",
                count(*)::int as "deliveryItemCount",
                count(*) filter (where serial_count > 0)::int as "withSerialCount",
                max(
                    case
                        when coalesce(so_qty, 0) > 0 then round(delivered_quantity::numeric / so_qty::numeric, 2)
                        else null
                    end
                ) as "maxQtyMultiplier"
            from anomalous_items
        `),
        db.execute(sql<DetailRow>`
            with transfer_totals as (
                select
                    st.delivery_id,
                    sti.product_id,
                    sum(sti.quantity)::int as transfer_qty
                from stock_transfer_items sti
                join stock_transfers st on st.id = sti.transfer_id
                group by st.delivery_id, sti.product_id
            ),
            movement_totals as (
                select
                    sm.reference_number,
                    sm.product_id,
                    abs(sum(sm.quantity))::int as movement_qty_abs
                from stock_movements sm
                where sm.reference_number is not null
                group by sm.reference_number, sm.product_id
            )
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
                    when coalesce(soi.quantity, 0) > 0 then round(di.delivered_quantity::numeric / soi.quantity::numeric, 2)
                    else null
                end as "qtyMultiplier",
                tt.transfer_qty as "transferQty",
                mt.movement_qty_abs as "movementQtyAbs"
            from delivery_items di
            join deliveries d on d.id = di.delivery_id
            left join sales_order_items soi on soi.id = di.sales_order_item_id
            left join products p on p.id = di.product_id
            left join transfer_totals tt on tt.delivery_id = di.delivery_id and tt.product_id = di.product_id
            left join movement_totals mt on mt.reference_number = d.delivery_number and mt.product_id = di.product_id
            where soi.id is not null
              and (di.delivered_quantity > soi.quantity or di.ordered_quantity > soi.quantity)
            order by d.delivery_number asc, di.id asc
        `),
    ])

    const summary = summaryResult.rows[0]
    const details = detailsResult.rows

    const report = {
        generatedAt: new Date().toISOString(),
        summary,
        sample: details.slice(0, 20),
        allFindings: details,
    }

    console.log(JSON.stringify(report, null, 2))
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Delivery qty audit failed:", error)
        process.exit(1)
    })
