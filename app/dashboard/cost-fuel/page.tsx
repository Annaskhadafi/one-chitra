import { Fuel } from "lucide-react"

import { getCostFuelMasterData } from "@/app/actions/cost-fuel"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"
import { PageHeader } from "@/components/page-header"

import { CostFuelClient } from "./_components/cost-fuel-client"

export const dynamic = "force-dynamic"

export default async function CostFuelPage() {
    const masterData = await getCostFuelMasterData()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <AutoCloseSidebar />
            <PageHeader
                title="Cost Fuel"
                subtitle="Isi form penggunaan bahan bakar delivery atau operasional, lalu cetak dokumen untuk tanda tangan tim terkait."
                icon={Fuel}
            />

            <CostFuelClient masterData={masterData} />
        </div>
    )
}
