import { Metadata } from "next"
import { CompetitorTable } from "./_components/competitor-table"

export const metadata: Metadata = {
    title: "Competitor Info",
    description: "Competitor analysis and market intelligence",
}

export default function CompetitorInfoPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Competitor Info</h2>
            </div>
            <CompetitorTable />
        </div>
    )
}
