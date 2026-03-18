import { getDeliveries, getDeliveryItemsFlat } from "@/app/actions/delivery"

export const dynamic = "force-dynamic"

export default async function TestDeliveryPage() {
    try {
        const [deliveriesData, itemsData] = await Promise.all([
            getDeliveries(),
            getDeliveryItemsFlat()
        ])

        return (
            <div>
                <h1>Test Delivery Page</h1>
                <p>Deliveries: {deliveriesData.length}</p>
                <p>Items: {itemsData.length}</p>
            </div>
        )
    } catch (error) {
        return (
            <div>
                <h1>Error Loading Test Page</h1>
                <pre>{error instanceof Error ? error.message : String(error)}</pre>
            </div>
        )
    }
}
