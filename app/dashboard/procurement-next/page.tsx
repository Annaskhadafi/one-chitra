import { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { Boxes, ShoppingBasket } from "lucide-react"
import { ProcurementNextClient } from "./_components/procurement-next-client"

export const metadata: Metadata = {
    title: "Procurement Next",
    description: "Analytical procurement workspace for stock health and sales history.",
}

export default function ProcurementNextPage() {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <PageHeader
                        title="Procurement Next"
                        subtitle="Analitik procurement berbasis stock lokal dan history order. Halaman ini hanya untuk insight replenishment, bukan pembuatan PO SAP."
                        icon={ShoppingBasket}
                    />
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    <Boxes className="h-3.5 w-3.5" />
                    Analytics Only
                </span>
            </div>

            <ProcurementNextClient />
        </div>
    )
}
