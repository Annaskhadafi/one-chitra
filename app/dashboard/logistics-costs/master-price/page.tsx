import { Truck } from "lucide-react"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"
import { PageHeader } from "@/components/page-header"
import { getLogisticsMasterPrices } from "@/app/actions/logistics-master-price"
import { LogisticsMasterPriceClient } from "./_components/logistics-master-price-client"

export default async function LogisticsMasterPricePage() {
    const prices = await getLogisticsMasterPrices()

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <AutoCloseSidebar />
            <PageHeader
                title="Master Price Delivery"
                subtitle="Kelola harga delivery, kapasitas per ring, truck type, dan product type untuk kebutuhan quotation."
                icon={Truck}
            />

            <LogisticsMasterPriceClient initialRows={prices} />
        </div>
    )
}
