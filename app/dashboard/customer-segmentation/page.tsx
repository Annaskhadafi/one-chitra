import { Metadata } from "next"
import { CustomerSegmentationClient } from "./_components/customer-segmentation-client"

export const metadata: Metadata = {
    title: "Segmentasi Customer",
    description: "RFM Analysis and Customer Segmentation",
}

export default function CustomerSegmentationPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Segmentasi Customer</h2>
            </div>
            <CustomerSegmentationClient />
        </div>
    )
}
