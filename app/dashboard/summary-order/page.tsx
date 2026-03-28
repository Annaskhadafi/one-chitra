import { ClipboardList } from "lucide-react"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"
import { PageHeader } from "@/components/page-header"
import { getSummaryOrders } from "@/app/actions/summary-order"
import { SummaryOrderClient } from "./summary-order-client"

export const dynamic = "force-dynamic"

export default async function SummaryOrderPage() {
    const data = await getSummaryOrders()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <AutoCloseSidebar />
            <div className="min-w-0 w-full">
                <PageHeader
                    title="Sales Order Summary"
                    subtitle="Ringkasan gabungan proses Sales Order, Delivery, dan Billing dengan filter sales, status invoice, dan link detail."
                    icon={ClipboardList}
                />
            </div>

            <SummaryOrderClient data={data} />
        </div>
    )
}
