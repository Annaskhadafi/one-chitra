import { Suspense } from "react"
import { getSalesDashboardFilters } from "@/app/actions/sales-dashboard"
import { SalesDashboardClient } from "./_components/sales-dashboard-client"

export const metadata = {
    title: "Sales Dashboard | One Chitra",
    description: "Detailed sales analysis and pivot tables",
}

export default async function SalesDashboardPage() {
    const filtersResponse = await getSalesDashboardFilters();

    const filterOptions = filtersResponse.success ? filtersResponse.data : {
        customers: [],
        salesmen: [],
        revTypes: [],
        areas: [],
        years: [],
        months: []
    };

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <Suspense fallback={<div>Loading Dashboard...</div>}>
                <SalesDashboardClient initialFilterOptions={filterOptions} />
            </Suspense>
        </div>
    )
}
