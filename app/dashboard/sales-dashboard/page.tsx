import { Suspense } from "react"
import { getSalesDashboardFilters } from "@/app/actions/sales-dashboard"
import { SalesDashboardClient } from "./_components/sales-dashboard-client"

export const metadata = {
    title: "Sales Dashboard | One Chitra",
    description: "Detailed sales analysis and pivot tables",
}

export default async function SalesDashboardPage() {
    const filtersResponse = await getSalesDashboardFilters();

    const filterOptions = filtersResponse.success && filtersResponse.data ? {
        customers: filtersResponse.data.customers.filter((v): v is string => Boolean(v)),
        salesmen: filtersResponse.data.salesmen.filter((v): v is string => Boolean(v)),
        revTypes: filtersResponse.data.revTypes.filter((v): v is string => Boolean(v)),
        areas: filtersResponse.data.areas,
        years: filtersResponse.data.years,
        months: filtersResponse.data.months,
    } : {
        customers: [],
        salesmen: [],
        revTypes: [],
        areas: [],
        years: [],
        months: []
    };

    return (
        <div className="flex-1 space-y-4 px-3 py-4 sm:px-4 sm:py-5 lg:p-8 lg:pt-6">
            <Suspense fallback={<div>Loading Dashboard...</div>}>
                <SalesDashboardClient initialFilterOptions={filterOptions} />
            </Suspense>
        </div>
    )
}
