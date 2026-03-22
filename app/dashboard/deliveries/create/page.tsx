import { getSalesOrdersForDelivery } from "@/app/actions/delivery"
import { getWarehouses } from "@/app/actions/warehouse"
import { DeliveryForm } from "../_components/delivery-form"

export default async function CreateDeliveryPage({ searchParams }: { searchParams: Promise<{ so?: string }> }) {
    const resolvedSearchParams = await searchParams
    const salesOrders = await getSalesOrdersForDelivery()
    const warehouses = await getWarehouses()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <DeliveryForm
                salesOrders={salesOrders as Parameters<typeof DeliveryForm>[0]["salesOrders"]}
                warehouses={warehouses}
                defaultSalesOrderId={resolvedSearchParams.so ? parseInt(resolvedSearchParams.so) : undefined}
            />
        </div>
    )
}
