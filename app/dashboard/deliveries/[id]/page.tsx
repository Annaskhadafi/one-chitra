import { getDelivery, getSalesOrdersForDelivery } from "@/app/actions/delivery"
import { getWarehouses } from "@/app/actions/warehouse"
import { DeliveryForm } from "../_components/delivery-form"
import { notFound } from "next/navigation"

export default async function EditDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const delivery = await getDelivery(Number(id))

    if (!delivery) return notFound()

    const salesOrders = await getSalesOrdersForDelivery()
    const hasCurrentSalesOrder = salesOrders.some((order) => order.id === delivery.salesOrderId)
    const salesOrdersForForm = hasCurrentSalesOrder
        ? salesOrders
        : [{
            ...delivery.salesOrder,
            status: "confirmed",
            salesDate: delivery.scheduledDate,
            categoryPo: delivery.salesOrder?.categoryPo ?? null,
            warehouseId: delivery.salesOrder?.warehouseId ?? delivery.warehouseId ?? null,
            items: delivery.salesOrder.items.map((item) => {
                const editedItem = delivery.items.find((deliveryItem) => deliveryItem.salesOrderItemId === item.id)
                const alreadyDelivered = editedItem ? Number(editedItem.deliveredQuantity) : Number(item.quantity ?? 0)
                return {
                    ...item,
                    alreadyDelivered,
                    remainingQuantity: Math.max(Number(item.quantity ?? 0) - alreadyDelivered, 0),
                }
            }),
        }, ...salesOrders]
    const warehouses = await getWarehouses()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <DeliveryForm
                salesOrders={salesOrdersForForm as Parameters<typeof DeliveryForm>[0]["salesOrders"]}
                warehouses={warehouses}
                initialData={delivery as Parameters<typeof DeliveryForm>[0]["initialData"]}
            />
        </div>
    )
}
