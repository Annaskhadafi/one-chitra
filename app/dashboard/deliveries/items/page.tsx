import { Suspense } from "react"
import { getDeliveryItemsFlat } from "@/app/actions/delivery"
import { DeliveryItemsTable } from "./_components/delivery-items-table"

export default async function DeliveryItemsPage() {
    const data = await getDeliveryItemsFlat()

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Delivery Items</h1>
                    <p className="text-muted-foreground">List of all products delivered across all delivery documents.</p>
                </div>
            </div>

            <Suspense fallback={<div className="text-sm text-muted-foreground p-4">Loading delivery items...</div>}>
                <DeliveryItemsTable data={data} />
            </Suspense>
        </div>
    )
}
