import { Metadata } from "next"
import { CustomerIndustryClient } from "./_components/customer-industry-client"

export const metadata: Metadata = {
    title: "Customer Industry Mapping | One Chitra",
    description: "Pemetaan customer berdasarkan bidang usaha dan kategori ban yang dibeli",
}

export default function CustomerIndustryPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Customer Industry Mapping</h2>
                    <p className="text-muted-foreground mt-1">
                        Pemetaan customer berdasarkan bidang usaha &amp; kategori ban yang pernah dibeli
                    </p>
                </div>
            </div>
            <CustomerIndustryClient />
        </div>
    )
}
