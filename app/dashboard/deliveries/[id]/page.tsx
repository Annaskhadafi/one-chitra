import { getDelivery, getSalesOrdersForDelivery } from "@/app/actions/delivery"
import { getWarehouses } from "@/app/actions/warehouse"
import { DeliveryForm } from "../_components/delivery-form"
import { notFound } from "next/navigation"

export default async function EditDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const delivery = await getDelivery(Number(id))

    if (!delivery) return notFound()

    const salesOrders = await getSalesOrdersForDelivery()
    const warehouses = await getWarehouses()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <DeliveryForm
                salesOrders={salesOrders}
                warehouses={warehouses}
                initialData={delivery}
            />
        </div>
    )
}
