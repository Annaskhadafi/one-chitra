import { Suspense } from "react"
import { getR49DashboardFilters } from "@/app/actions/r49-dashboard"
import { R49DashboardClient } from "./_components/r49-dashboard-client"

export default async function R49DashboardPage() {
    const filtersResponse = await getR49DashboardFilters();

    const filterOptions = filtersResponse.success && filtersResponse.data ? {
        customers: filtersResponse.data.customers.filter((v): v is string => Boolean(v)),
        salesmen: filtersResponse.data.salesmen.filter((v): v is string => Boolean(v)),
        matGrp2Desc: filtersResponse.data.matGrp2Desc.filter((v): v is string => Boolean(v)),
        years: filtersResponse.data.years,
        months: filtersResponse.data.months,
    } : {
        customers: [],
        salesmen: [],
        matGrp2Desc: [],
        years: [],
        months: []
    };

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 bg-slate-50/50 min-h-screen">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-[#172B4D]">Dashboard R49 Tire</h2>
                    <p className="text-slate-500">
                        Analysis for EARTHMOVER TIRES R49 (Trading)
                    </p>
                </div>
            </div>

            <Suspense fallback={
                <div className="h-[600px] flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-100">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                        <p className="text-sm font-medium text-slate-500 italic">Preparing R49 Analytics...</p>
                    </div>
                </div>
            }>
                <R49DashboardClient initialFilterOptions={filterOptions} />
            </Suspense>
        </div>
    )
}

import { Loader2 } from "lucide-react"
